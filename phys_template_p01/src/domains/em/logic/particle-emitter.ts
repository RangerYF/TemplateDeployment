import type { Entity, SceneDefinition, Vec2 } from '@/core/types';
import { getSignedBz } from './lorentz-force';
import { angleFromVelocity, normalizeAngleDeg, velocityFromSpeedAndAngle } from './point-charge-kinematics';

export type ParticleEmitterPattern =
  | 'translation-circle'
  | 'rotation-circle'
  | 'scaling-circle'
  | 'focusing'
  | 'divergence';

interface ParticleLaunchConfig {
  position: Vec2;
  velocity: Vec2;
  speed: number;
  angleDeg: number;
}

const MIN_MASS = 1e-6;
const MIN_BFIELD_FOR_FOCUS = 0.1;
const MIN_FOCUS_SIDE_OFFSET = 0.28;
const MIN_SPEED = 0.05;
const FULL_CIRCLE_SPAN_DEG = 360;

export function isParticleEmitter(entity: Entity): boolean {
  return entity.type === 'particle-emitter';
}

export function syncParticleEmitters(scene: SceneDefinition): void {
  const emitters = Array.from(scene.entities.values()).filter(isParticleEmitter);
  if (emitters.length === 0) return;

  const primaryBField = Array.from(scene.entities.values()).find(
    (entity) => entity.type === 'uniform-bfield',
  );

  for (const emitter of emitters) {
    const particles = scene.relations
      .filter((relation) => relation.type === 'emits' && relation.sourceEntityId === emitter.id)
      .map((relation) => scene.entities.get(relation.targetEntityId))
      .filter((entity): entity is Entity => entity?.type === 'point-charge');

    if (particles.length === 0) continue;
    syncEmitterParticlePool(emitter, particles, primaryBField);
  }
}

function syncEmitterParticlePool(
  emitter: Entity,
  particles: Entity[],
  primaryBField?: Entity,
): void {
  const props = emitter.properties as Record<string, unknown>;
  const pattern = resolvePattern(props.pattern);
  const charge = readNumber(props.charge, 0.1);
  const mass = Math.max(readNumber(props.mass, 0.1), MIN_MASS);
  const particleRadius = Math.max(readNumber(props.particleRadius, 0.11), 0.02);
  const particleCount = clampInteger(readNumber(props.particleCount, particles.length), 1, particles.length);
  const showParticleLabels = props.showParticleLabels === true;

  const activeParticles = particles.slice(0, particleCount);
  const launches = buildLaunches(pattern, emitter, activeParticles.length, charge, mass, primaryBField);
  syncEmitterBoundaryCircle(pattern, emitter, launches, charge, mass, primaryBField);

  particles.forEach((particle, index) => {
    const particleProps = particle.properties as Record<string, unknown>;
    const isActive = index < particleCount;

    particleProps.pointChargeRole = 'particle';
    particleProps.particleActive = isActive;
    particleProps.charge = charge;
    particleProps.mass = mass;
    particleProps.radius = particleRadius;

    delete particleProps.stoppedOnPlate;
    delete particleProps.stoppedOnScreen;
    delete particleProps.screenHitEntityId;
    delete particleProps.screenHitPoint;
    delete particleProps.electrogravityDetached;

    if (!isActive) {
      particle.label = undefined;
      return;
    }

    const launch = launches[index]!;
    particle.transform.position = { ...launch.position };
    particleProps.initialVelocity = { ...launch.velocity };
    particleProps.initialSpeed = launch.speed;
    particleProps.initialDirectionDeg = launch.angleDeg;
    particle.label = showParticleLabels ? buildParticleLabel(pattern, index, launch) : undefined;
  });
}

function syncEmitterBoundaryCircle(
  pattern: ParticleEmitterPattern,
  emitter: Entity,
  launches: ParticleLaunchConfig[],
  charge: number,
  mass: number,
  primaryBField?: Entity,
): void {
  if (!primaryBField || launches.length === 0) return;

  const autoBoundaryMode = primaryBField.properties.autoBoundaryMode as string | undefined;
  if (!autoBoundaryMode) return;
  if (autoBoundaryMode === 'focusing-min-radius' && pattern !== 'focusing') return;
  if (autoBoundaryMode === 'divergence-base-speed' && pattern !== 'divergence') return;

  const referenceLaunch = selectBoundaryReferenceLaunch(autoBoundaryMode, emitter, launches, charge, mass, primaryBField);
  if (!referenceLaunch) return;

  const referenceOrbit = resolveCircularOrbit(referenceLaunch, charge, mass, primaryBField);
  if (!referenceOrbit) return;

  primaryBField.properties.boundaryShape = 'circle';
  primaryBField.properties.boundaryRadius = referenceOrbit.radius;
  primaryBField.properties.width = referenceOrbit.radius * 2;
  primaryBField.properties.height = referenceOrbit.radius * 2;
  primaryBField.transform.position = {
    x: referenceOrbit.center.x - referenceOrbit.radius,
    y: referenceOrbit.center.y - referenceOrbit.radius,
  };
}

function buildLaunches(
  pattern: ParticleEmitterPattern,
  emitter: Entity,
  count: number,
  charge: number,
  mass: number,
  primaryBField?: Entity,
): ParticleLaunchConfig[] {
  if (pattern === 'translation-circle') {
    return buildTranslationLaunches(emitter, count);
  }

  if (pattern === 'rotation-circle') {
    return buildRotationLaunches(emitter, count);
  }

  if (pattern === 'focusing') {
    return buildFocusingLaunches(emitter, count, charge, mass, primaryBField);
  }

  return buildSpeedFamilyLaunches(emitter, count);
}

function buildTranslationLaunches(
  emitter: Entity,
  count: number,
): ParticleLaunchConfig[] {
  const props = emitter.properties as Record<string, unknown>;
  const origin = emitter.transform.position;
  const launchAngleDeg = normalizeAngleDeg(readNumber(props.launchAngleDeg, 0));
  const baseSpeed = Math.max(readNumber(props.baseSpeed, 2), MIN_SPEED);
  const entrySpacing = Math.max(readNumber(props.entrySpacing, 1.4), 0);
  const forward = directionFromAngleDeg(launchAngleDeg);
  const normal = { x: -forward.y, y: forward.x };

  return offsetsByStep(count, entrySpacing).map((offset) => {
    const position = {
      x: origin.x + (normal.x * offset),
      y: origin.y + (normal.y * offset),
    };
    const velocity = velocityFromSpeedAndAngle(baseSpeed, launchAngleDeg);
    return {
      position,
      velocity,
      speed: baseSpeed,
      angleDeg: launchAngleDeg,
    };
  });
}

function buildRotationLaunches(
  emitter: Entity,
  count: number,
): ParticleLaunchConfig[] {
  const props = emitter.properties as Record<string, unknown>;
  const origin = emitter.transform.position;
  const centerAngleDeg = normalizeAngleDeg(readNumber(props.launchAngleDeg, 0));
  const angleSpreadDeg = Math.max(readNumber(props.angleSpreadDeg, 60), 0);
  const baseSpeed = Math.max(readNumber(props.baseSpeed, 2), MIN_SPEED);

  return angularOffsetsBySpan(count, angleSpreadDeg).map((offset) => {
    const angleDeg = normalizeAngleDeg(centerAngleDeg + offset);
    const velocity = velocityFromSpeedAndAngle(baseSpeed, angleDeg);
    return {
      position: { ...origin },
      velocity,
      speed: baseSpeed,
      angleDeg,
    };
  });
}

function buildSpeedFamilyLaunches(
  emitter: Entity,
  count: number,
): ParticleLaunchConfig[] {
  const props = emitter.properties as Record<string, unknown>;
  const origin = emitter.transform.position;
  const launchAngleDeg = normalizeAngleDeg(readNumber(props.launchAngleDeg, 0));
  const baseSpeed = Math.max(readNumber(props.baseSpeed, 2), MIN_SPEED);
  const speedSpread = Math.max(readNumber(props.speedSpread, 1.6), 0);
  const minSpeed = Math.max(baseSpeed - (speedSpread / 2), MIN_SPEED);
  const maxSpeed = Math.max(baseSpeed + (speedSpread / 2), minSpeed);
  const speeds = interpolateRange(count, minSpeed, maxSpeed);

  return speeds.map((speed) => {
    const velocity = velocityFromSpeedAndAngle(speed, launchAngleDeg);
    return {
      position: { ...origin },
      velocity,
      speed,
      angleDeg: launchAngleDeg,
    };
  });
}

function buildFocusingLaunches(
  emitter: Entity,
  count: number,
  charge: number,
  mass: number,
  primaryBField?: Entity,
): ParticleLaunchConfig[] {
  const props = emitter.properties as Record<string, unknown>;
  const source = emitter.transform.position;
  const launchAngleDeg = normalizeAngleDeg(readNumber(props.launchAngleDeg, 0));
  const focusDistance = Math.max(readNumber(props.focusDistance, 4.2), 0.4);
  const focusSpread = Math.max(readNumber(props.focusSpread, 1.6), 0.05);
  const forward = directionFromAngleDeg(launchAngleDeg);
  const normal = { x: -forward.y, y: forward.x };
  const focus = {
    x: source.x + (forward.x * focusDistance),
    y: source.y + (forward.y * focusDistance),
  };
  const midpoint = {
    x: (source.x + focus.x) / 2,
    y: (source.y + focus.y) / 2,
  };
  const bMagnitude = Math.max(
    readNumber(primaryBField?.properties.magnitude, MIN_BFIELD_FOR_FOCUS),
    MIN_BFIELD_FOR_FOCUS,
  );
  const signedBz = getSignedBz(
    bMagnitude,
    (primaryBField?.properties.direction as 'into' | 'out' | undefined) ?? 'into',
  );
  const curvatureSign = signedSign(charge * signedBz, -1);
  const preferredSide = -curvatureSign;
  const startOffset = Math.max(focusDistance * 0.14, MIN_FOCUS_SIDE_OFFSET);
  const offsetMagnitudes = interpolateRange(count, startOffset, startOffset + focusSpread);

  return offsetMagnitudes.map((magnitude) => {
    let center = {
      x: midpoint.x + (normal.x * preferredSide * magnitude),
      y: midpoint.y + (normal.y * preferredSide * magnitude),
    };
    let radial = normalize({
      x: center.x - source.x,
      y: center.y - source.y,
    });
    let velocityDirection = tangentDirectionFromRadial(radial, curvatureSign);

    if (dot(velocityDirection, forward) < 0) {
      center = {
        x: midpoint.x - (normal.x * preferredSide * magnitude),
        y: midpoint.y - (normal.y * preferredSide * magnitude),
      };
      radial = normalize({
        x: center.x - source.x,
        y: center.y - source.y,
      });
      velocityDirection = tangentDirectionFromRadial(radial, curvatureSign);
    }

    const radius = Math.hypot(center.x - source.x, center.y - source.y);
    const speed = Math.max((radius * Math.abs(charge) * bMagnitude) / mass, MIN_SPEED);

    return {
      position: { ...source },
      velocity: {
        x: velocityDirection.x * speed,
        y: velocityDirection.y * speed,
      },
      speed,
      angleDeg: angleFromVelocity({
        x: velocityDirection.x * speed,
        y: velocityDirection.y * speed,
      }),
    };
  });
}

function buildParticleLabel(
  pattern: ParticleEmitterPattern,
  index: number,
  launch: ParticleLaunchConfig,
): string {
  if (pattern === 'rotation-circle' || pattern === 'focusing') {
    return `θ=${Math.round(launch.angleDeg)}°`;
  }
  return `v${index + 1}=${launch.speed.toFixed(2)}`;
}

function selectBoundaryReferenceLaunch(
  autoBoundaryMode: string,
  emitter: Entity,
  launches: ParticleLaunchConfig[],
  charge: number,
  mass: number,
  primaryBField: Entity,
): ParticleLaunchConfig | null {
  if (autoBoundaryMode === 'divergence-base-speed') {
    const baseSpeed = Math.max(readNumber(emitter.properties.baseSpeed, launches[0]?.speed ?? MIN_SPEED), MIN_SPEED);
    return launches.reduce((best, current) =>
      Math.abs(current.speed - baseSpeed) < Math.abs(best.speed - baseSpeed)
        ? current
        : best,
    );
  }

  let bestLaunch: ParticleLaunchConfig | null = null;
  let bestRadius = Number.POSITIVE_INFINITY;
  for (const launch of launches) {
    const orbit = resolveCircularOrbit(launch, charge, mass, primaryBField);
    if (!orbit || orbit.radius >= bestRadius) continue;
    bestLaunch = launch;
    bestRadius = orbit.radius;
  }
  return bestLaunch;
}

function resolveCircularOrbit(
  launch: ParticleLaunchConfig,
  charge: number,
  mass: number,
  primaryBField: Entity,
): { center: Vec2; radius: number } | null {
  const bMagnitude = Math.max(readNumber(primaryBField.properties.magnitude, 0), 0);
  if (Math.abs(charge) < 1e-9 || mass < MIN_MASS || bMagnitude < 1e-9 || launch.speed < MIN_SPEED) {
    return null;
  }

  const signedBz = getSignedBz(
    bMagnitude,
    (primaryBField.properties.direction as 'into' | 'out' | undefined) ?? 'into',
  );
  const curvatureSide = -signedSign(charge * signedBz, -1);
  const direction = normalize(launch.velocity);
  const leftNormal = {
    x: -direction.y,
    y: direction.x,
  };
  const radius = (mass * launch.speed) / (Math.abs(charge) * bMagnitude);

  return {
    center: {
      x: launch.position.x + (leftNormal.x * curvatureSide * radius),
      y: launch.position.y + (leftNormal.y * curvatureSide * radius),
    },
    radius,
  };
}

function resolvePattern(value: unknown): ParticleEmitterPattern {
  switch (value) {
    case 'translation-circle':
    case 'rotation-circle':
    case 'scaling-circle':
    case 'focusing':
    case 'divergence':
      return value;
    default:
      return 'translation-circle';
  }
}

function offsetsByStep(count: number, step: number): number[] {
  if (count <= 1 || step <= 0) return [0];
  return offsetsByTotalSpan(count, step * (count - 1));
}

function offsetsByTotalSpan(count: number, totalSpan: number): number[] {
  if (count <= 1 || totalSpan <= 0) return [0];
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return (-totalSpan / 2) + (totalSpan * t);
  });
}

function angularOffsetsBySpan(count: number, totalSpan: number): number[] {
  if (count <= 1 || totalSpan <= 0) return [0];
  if (totalSpan >= FULL_CIRCLE_SPAN_DEG) {
    const stepDeg = FULL_CIRCLE_SPAN_DEG / count;
    return Array.from({ length: count }, (_, index) => index * stepDeg);
  }
  return offsetsByTotalSpan(count, totalSpan);
}

function interpolateRange(count: number, start: number, end: number): number[] {
  if (count <= 1) return [start];
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return start + ((end - start) * t);
  });
}

function tangentDirectionFromRadial(radial: Vec2, curvatureSign: number): Vec2 {
  return {
    x: -curvatureSign * radial.y,
    y: curvatureSign * radial.x,
  };
}

function directionFromAngleDeg(angleDeg: number): Vec2 {
  const velocity = velocityFromSpeedAndAngle(1, angleDeg);
  return {
    x: velocity.x,
    y: velocity.y,
  };
}

function normalize(vector: Vec2): Vec2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude < 1e-9) {
    return { x: 1, y: 0 };
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function dot(a: Vec2, b: Vec2): number {
  return (a.x * b.x) + (a.y * b.y);
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function signedSign(value: number, fallback: number): number {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return fallback >= 0 ? 1 : -1;
}
