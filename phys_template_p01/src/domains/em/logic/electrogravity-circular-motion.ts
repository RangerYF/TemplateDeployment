import type { Entity, Vec2 } from '@/core/types';

const MIN_RADIUS = 1e-6;
const MIN_MASS = 1e-6;
const CRITICAL_SPEED_TOLERANCE = 0.12;

export const ELECTROGRAVITY_DETACHED_FLAG = 'electrogravityDetached';
export const ELECTROGRAVITY_RELEASE_POINT_FLAG = 'electrogravityReleasePoint';
export const ELECTROGRAVITY_RELEASE_ANGLE_FLAG = 'electrogravityReleaseAngle';
export const ELECTROGRAVITY_RELEASE_SPEED_FLAG = 'electrogravityReleaseSpeed';

export type ElectrogravityOutcome =
  | 'complete-circle'
  | 'critical-top'
  | 'detach-projectile';

export interface ElectrogravityCircleConfig {
  radius: number;
  center: Vec2;
  gravity: number;
  charge: number;
  mass: number;
  fieldMagnitude: number;
  fieldDirection: Vec2;
  electricAccelerationY: number;
  effectiveDownwardAcceleration: number;
}

export function isElectrogravityCircleScene(
  particle: Entity | undefined,
  field: Entity | undefined,
): boolean {
  return (
    Boolean(particle) &&
    particle?.type === 'point-charge' &&
    typeof particle.properties.trackRadius === 'number' &&
    Boolean(field) &&
    field?.type === 'uniform-efield'
  );
}

export function getElectrogravityCircleConfig(
  particle: Entity,
  field: Entity,
): ElectrogravityCircleConfig {
  const radius = Math.max(readNumber(particle.properties.trackRadius, 2), MIN_RADIUS);
  const center = readVec2(particle.properties.trackCenter, { x: 0, y: 0 });
  const gravity = Math.max(readNumber(particle.properties.gravity, 9.8), 0);
  const charge = readNumber(particle.properties.charge, 0);
  const mass = Math.max(readNumber(particle.properties.mass, 1), MIN_MASS);
  const fieldMagnitude = Math.max(readNumber(field.properties.magnitude, 0), 0);
  const fieldDirection = normalizeVec(readVec2(field.properties.direction, { x: 0, y: 1 }));
  const electricAccelerationY = (charge * fieldMagnitude * fieldDirection.y) / mass;

  return {
    radius,
    center,
    gravity,
    charge,
    mass,
    fieldMagnitude,
    fieldDirection,
    electricAccelerationY,
    effectiveDownwardAcceleration: gravity - electricAccelerationY,
  };
}

export function getCirclePosition(
  config: ElectrogravityCircleConfig,
  angle: number,
): Vec2 {
  return {
    x: config.center.x + config.radius * Math.sin(angle),
    y: config.center.y - config.radius * Math.cos(angle),
  };
}

export function getCircleTangent(angle: number): Vec2 {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

export function getCircleInwardNormal(angle: number): Vec2 {
  return {
    x: -Math.sin(angle),
    y: Math.cos(angle),
  };
}

export function angleFromCirclePosition(
  config: ElectrogravityCircleConfig,
  position: Vec2,
): number {
  return Math.atan2(position.x - config.center.x, config.center.y - position.y);
}

export function omegaFromCircleVelocity(
  config: ElectrogravityCircleConfig,
  angle: number,
  velocity: Vec2,
): number {
  const tangent = getCircleTangent(angle);
  return (velocity.x * tangent.x + velocity.y * tangent.y) / config.radius;
}

export function angularAccelerationForCircle(
  config: ElectrogravityCircleConfig,
  angle: number,
): number {
  return -(config.effectiveDownwardAcceleration / config.radius) * Math.sin(angle);
}

export function speedFromOmega(
  config: ElectrogravityCircleConfig,
  omega: number,
): number {
  return Math.abs(omega) * config.radius;
}

export function tensionForCircle(
  config: ElectrogravityCircleConfig,
  speed: number,
  angle: number,
): number {
  return config.mass * (
    (speed * speed) / config.radius +
    config.effectiveDownwardAcceleration * Math.cos(angle)
  );
}

export function criticalTopSpeed(config: ElectrogravityCircleConfig): number | null {
  return config.effectiveDownwardAcceleration > 0
    ? Math.sqrt(config.effectiveDownwardAcceleration * config.radius)
    : null;
}

export function criticalBottomSpeed(config: ElectrogravityCircleConfig): number | null {
  return config.effectiveDownwardAcceleration > 0
    ? Math.sqrt(5 * config.effectiveDownwardAcceleration * config.radius)
    : null;
}

export function classifyElectrogravityOutcome(
  config: ElectrogravityCircleConfig,
  launchSpeed: number,
): ElectrogravityOutcome {
  const bottomCritical = criticalBottomSpeed(config);
  if (bottomCritical == null) return 'complete-circle';

  const tolerance = Math.max(CRITICAL_SPEED_TOLERANCE, bottomCritical * 0.02);
  if (launchSpeed > bottomCritical + tolerance) return 'complete-circle';
  if (Math.abs(launchSpeed - bottomCritical) <= tolerance) return 'critical-top';
  return 'detach-projectile';
}

export function getElectrogravityOutcomeLabel(outcome: ElectrogravityOutcome): string {
  if (outcome === 'complete-circle') return '完整圆周运动';
  if (outcome === 'critical-top') return '临界过顶';
  return '松绳后斜抛';
}

export function getElectrogravityReleaseLabel(releaseAngle: number | null | undefined): string {
  if (releaseAngle == null) return '已失去约束，转入斜抛';
  if (releaseAngle >= Math.PI - 0.16) return '到顶附近绳恰好松弛，随后转入斜抛';
  if (releaseAngle >= Math.PI / 2) return '进入上半周后绳先松弛，随后转入斜抛';
  return '尚未到达上半周高点就已失去约束';
}

export function electricForceVector(config: ElectrogravityCircleConfig): Vec2 {
  return {
    x: config.charge * config.fieldMagnitude * config.fieldDirection.x,
    y: config.charge * config.fieldMagnitude * config.fieldDirection.y,
  };
}

export function gravityForceVector(config: ElectrogravityCircleConfig): Vec2 {
  return {
    x: 0,
    y: -config.mass * config.gravity,
  };
}

export function resultantAccelerationForCircle(
  config: ElectrogravityCircleConfig,
  angle: number,
  omega: number,
): Vec2 {
  const tangent = getCircleTangent(angle);
  const inward = getCircleInwardNormal(angle);
  const tangential = angularAccelerationForCircle(config, angle) * config.radius;
  const centripetal = speedFromOmega(config, omega) ** 2 / config.radius;

  return {
    x: tangent.x * tangential + inward.x * centripetal,
    y: tangent.y * tangential + inward.y * centripetal,
  };
}

export function directionLabelFromVec(vector: Vec2): string {
  if (Math.abs(vector.x) < 1e-6 && Math.abs(vector.y) < 1e-6) return '—';
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return vector.x >= 0 ? '向右' : '向左';
  }
  return vector.y >= 0 ? '向上' : '向下';
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readVec2(value: unknown, fallback: Vec2): Vec2 {
  if (
    value &&
    typeof value === 'object' &&
    'x' in value &&
    'y' in value
  ) {
    const x = readNumber((value as { x?: unknown }).x, fallback.x);
    const y = readNumber((value as { y?: unknown }).y, fallback.y);
    return { x, y };
  }
  return { ...fallback };
}

function normalizeVec(vector: Vec2): Vec2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude < 1e-9) return { x: 0, y: 0 };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}
