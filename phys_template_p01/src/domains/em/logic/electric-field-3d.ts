import type { CoordinateTransform, FieldLineDensity, Vec2 } from '@/core/types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MIN_FIELD_MAGNITUDE = 1e-4;
const MIN_STEP_SIZE = 0.0018;
const MAX_STEP_SIZE = 0.024;
const MIN_START_RADIUS = 0.012;
const MAX_START_RADIUS = 0.08;
const MIN_TERMINATE_DISTANCE = 0.012;
const MAX_TERMINATE_DISTANCE = 0.12;
const MIN_MARGIN = 0.24;
const MAX_MARGIN = 1.2;
const MAX_STEPS = 1400;
const REFERENCE_CHARGE = 1e-6;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PointCharge3DInput {
  id: string;
  position: Vec2;
  charge: number;
  radius?: number;
}

export interface PointCharge3D {
  id: string;
  position: Vec3;
  charge: number;
  radius?: number;
}

export interface FieldLine3D {
  points: Vec3[];
  startChargeId: string;
  sourceSign: 1 | -1;
  reachesSink: boolean;
}

export interface ProjectedPoint3D {
  x: number;
  y: number;
  cameraZ: number;
  depth: number;
  scale: number;
  visible: boolean;
}

export interface ProjectionCamera3D {
  position: Vec3;
  target: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  focalLength: number;
  near: number;
  far: number;
}

export interface FieldProjectionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface FieldBounds3D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

interface FieldTraceConfig3D {
  stepSize: number;
  startRadius: number;
  terminateDistance: number;
  margin: number;
  maxSteps: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale3(v: Vec3, scalar: number): Vec3 {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

function dot3(a: Vec3, b: Vec3): number {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: (a.y * b.z) - (a.z * b.y),
    y: (a.z * b.x) - (a.x * b.z),
    z: (a.x * b.y) - (a.y * b.x),
  };
}

function length3(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalize3(v: Vec3): Vec3 {
  const magnitude = length3(v);
  if (magnitude < 1e-9) {
    return { x: 0, y: 0, z: 0 };
  }
  return scale3(v, 1 / magnitude);
}

function distance3(a: Vec3, b: Vec3): number {
  return length3(sub3(a, b));
}

function averageVec3(points: Vec3[]): Vec3 {
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
      z: acc.z + point.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  return scale3(sum, 1 / points.length);
}

function toPointCharge3D(charge: PointCharge3DInput): PointCharge3D {
  return {
    id: charge.id,
    position: {
      x: charge.position.x,
      y: charge.position.y,
      z: 0,
    },
    charge: charge.charge,
    radius: charge.radius,
  };
}

function densitySeedCount(density: FieldLineDensity, absCharge: number): number {
  const base = density === 'sparse' ? 9 : density === 'dense' ? 20 : 14;
  const chargeScale = Math.sqrt(Math.max(absCharge / REFERENCE_CHARGE, 0.28));
  return clamp(Math.round(base * chargeScale), 8, 24);
}

function nearestChargeDistance(charges: PointCharge3D[]): number | null {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < charges.length; i += 1) {
    for (let j = i + 1; j < charges.length; j += 1) {
      const distance = distance3(charges[i]!.position, charges[j]!.position);
      if (distance > 1e-6) {
        minDistance = Math.min(minDistance, distance);
      }
    }
  }

  return Number.isFinite(minDistance) ? minDistance : null;
}

function characteristicLength(
  charges: PointCharge3D[],
  bounds: FieldProjectionBounds,
): number {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const nearestDistance = nearestChargeDistance(charges);
  return nearestDistance ?? Math.max(spanX, spanY) / 5;
}

function buildTraceConfig(
  charges: PointCharge3D[],
  bounds: FieldProjectionBounds,
): FieldTraceConfig3D {
  const characteristic = characteristicLength(charges, bounds);
  const averageRadius =
    charges.reduce((sum, charge) => sum + (charge.radius ?? 0), 0) /
    Math.max(charges.length, 1);

  return {
    stepSize: clamp(characteristic / 34, MIN_STEP_SIZE, MAX_STEP_SIZE),
    startRadius: clamp(
      Math.max((averageRadius * 1.8), characteristic * 0.11, MIN_START_RADIUS),
      MIN_START_RADIUS,
      MAX_START_RADIUS,
    ),
    terminateDistance: clamp(
      Math.max((averageRadius * 2.1), characteristic * 0.095, MIN_TERMINATE_DISTANCE),
      MIN_TERMINATE_DISTANCE,
      MAX_TERMINATE_DISTANCE,
    ),
    margin: clamp(
      Math.max(characteristic * 1.05, MIN_MARGIN),
      MIN_MARGIN,
      MAX_MARGIN,
    ),
    maxSteps: MAX_STEPS,
  };
}

function buildBounds3D(
  charges: PointCharge3D[],
  bounds: FieldProjectionBounds,
  config: FieldTraceConfig3D,
): FieldBounds3D {
  const characteristic = characteristicLength(charges, bounds);
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, characteristic);
  const depthExtent = Math.max(characteristic * 5.4, span * 0.84, 0.44);

  return {
    minX: bounds.minX - config.margin,
    maxX: bounds.maxX + config.margin,
    minY: bounds.minY - config.margin,
    maxY: bounds.maxY + config.margin,
    minZ: -depthExtent,
    maxZ: depthExtent,
  };
}

function electricFieldAtPoint3D(point: Vec3, charges: PointCharge3D[]): Vec3 {
  let ex = 0;
  let ey = 0;
  let ez = 0;

  for (const charge of charges) {
    const delta = sub3(point, charge.position);
    const radiusSquared = dot3(delta, delta);
    if (radiusSquared < 1e-12) continue;
    const radius = Math.sqrt(radiusSquared);
    const radiusCubed = radiusSquared * radius;
    ex += 8.99e9 * charge.charge * delta.x / radiusCubed;
    ey += 8.99e9 * charge.charge * delta.y / radiusCubed;
    ez += 8.99e9 * charge.charge * delta.z / radiusCubed;
  }

  return { x: ex, y: ey, z: ez };
}

function fieldDirection3D(
  point: Vec3,
  charges: PointCharge3D[],
  direction: 1 | -1,
): Vec3 {
  const field = electricFieldAtPoint3D(point, charges);
  const magnitude = length3(field);
  if (magnitude < 1e-12) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: (direction * field.x) / magnitude,
    y: (direction * field.y) / magnitude,
    z: (direction * field.z) / magnitude,
  };
}

function rk4Step3D(
  point: Vec3,
  charges: PointCharge3D[],
  direction: 1 | -1,
  stepSize: number,
): Vec3 {
  const k1 = fieldDirection3D(point, charges, direction);
  const k2 = fieldDirection3D(add3(point, scale3(k1, stepSize * 0.5)), charges, direction);
  const k3 = fieldDirection3D(add3(point, scale3(k2, stepSize * 0.5)), charges, direction);
  const k4 = fieldDirection3D(add3(point, scale3(k3, stepSize)), charges, direction);

  return {
    x: point.x + (stepSize / 6) * (k1.x + (2 * k2.x) + (2 * k3.x) + k4.x),
    y: point.y + (stepSize / 6) * (k1.y + (2 * k2.y) + (2 * k3.y) + k4.y),
    z: point.z + (stepSize / 6) * (k1.z + (2 * k2.z) + (2 * k3.z) + k4.z),
  };
}

function isOutsideBounds(point: Vec3, bounds: FieldBounds3D): boolean {
  return (
    point.x < bounds.minX ||
    point.x > bounds.maxX ||
    point.y < bounds.minY ||
    point.y > bounds.maxY ||
    point.z < bounds.minZ ||
    point.z > bounds.maxZ
  );
}

function isNearTargetCharge(
  point: Vec3,
  charge: PointCharge3D,
  config: FieldTraceConfig3D,
): boolean {
  const stopDistance = Math.max(config.terminateDistance, (charge.radius ?? 0) * 1.8);
  return distance3(point, charge.position) < stopDistance;
}

function traceFieldLine3D(
  start: Vec3,
  charges: PointCharge3D[],
  bounds: FieldBounds3D,
  direction: 1 | -1,
  config: FieldTraceConfig3D,
): FieldLine3D | null {
  const points: Vec3[] = [{ ...start }];
  let current = { ...start };
  let previousDirection: Vec3 | null = null;
  let reachesSink = false;

  for (let step = 0; step < config.maxSteps; step += 1) {
    const field = electricFieldAtPoint3D(current, charges);
    const fieldMagnitude = length3(field);
    if (fieldMagnitude < MIN_FIELD_MAGNITUDE) break;

    const nextDirection = normalize3(scale3(field, direction));
    if (
      previousDirection &&
      dot3(nextDirection, previousDirection) < -0.28
    ) {
      break;
    }
    previousDirection = nextDirection;

    const next = rk4Step3D(current, charges, direction, config.stepSize);
    if (distance3(next, current) < 1e-5) break;

    for (const charge of charges) {
      const isSink = direction === 1 ? charge.charge < 0 : charge.charge > 0;
      if (!isSink) continue;
      if (isNearTargetCharge(next, charge, config)) {
        points.push({ ...charge.position });
        reachesSink = true;
        return {
          points,
          startChargeId: '',
          sourceSign: 1,
          reachesSink,
        };
      }
    }

    if (step > 6) {
      for (const charge of charges) {
        const isSamePolarity = direction === 1 ? charge.charge > 0 : charge.charge < 0;
        if (!isSamePolarity) continue;
        if (isNearTargetCharge(next, charge, config)) {
          points.push({ ...next });
          return {
            points,
            startChargeId: '',
            sourceSign: 1,
            reachesSink,
          };
        }
      }
    }

    if (isOutsideBounds(next, bounds)) {
      points.push({ ...next });
      break;
    }

    points.push({ ...next });
    current = next;
  }

  if (points.length < 5) return null;
  return {
    points,
    startChargeId: '',
    sourceSign: 1,
    reachesSink,
  };
}

function makeBasisFromAxis(axis: Vec3): { forward: Vec3; right: Vec3; up: Vec3 } {
  const forward = normalize3(axis);
  const fallbackUp = Math.abs(forward.y) > 0.92
    ? { x: 0, y: 0, z: 1 }
    : { x: 0, y: 1, z: 0 };
  const right = normalize3(cross3(forward, fallbackUp));
  const up = normalize3(cross3(right, forward));
  return { forward, right, up };
}

function directionFromAngles(
  axis: Vec3,
  polar: number,
  azimuth: number,
): Vec3 {
  const basis = makeBasisFromAxis(axis);
  if (Math.abs(polar) < 1e-6) {
    return basis.forward;
  }
  const ring = add3(
    scale3(basis.right, Math.cos(azimuth)),
    scale3(basis.up, Math.sin(azimuth)),
  );
  return normalize3(
    add3(
      scale3(basis.forward, Math.cos(polar)),
      scale3(ring, Math.sin(polar)),
    ),
  );
}

function buildFibonacciDirections(axis: Vec3, count: number): Vec3[] {
  const basis = makeBasisFromAxis(axis);
  const directions: Vec3[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    const axisComponent = 1 - (2 * t);
    const ringRadius = Math.sqrt(Math.max(0, 1 - (axisComponent * axisComponent)));
    const angle = index * GOLDEN_ANGLE;
    const direction = add3(
      add3(
        scale3(basis.right, ringRadius * Math.cos(angle)),
        scale3(basis.up, ringRadius * Math.sin(angle)),
      ),
      scale3(basis.forward, axisComponent),
    );
    directions.push(normalize3(direction));
  }

  return directions;
}

function buildAxisBiasedDirections(
  axis: Vec3,
  targetCount: number,
  includeDirectBridge: boolean,
): Vec3[] {
  const ringConfigs = includeDirectBridge
    ? [
        { polar: 0, azimuths: 1, phase: 0 },
        { polar: Math.PI * 0.15, azimuths: 4, phase: Math.PI * 0.25 },
        { polar: Math.PI * 0.3, azimuths: 4, phase: 0 },
        { polar: Math.PI * 0.48, azimuths: 4, phase: Math.PI * 0.25 },
        { polar: Math.PI * 0.66, azimuths: 6, phase: 0 },
        { polar: Math.PI * 0.82, azimuths: 6, phase: Math.PI / 6 },
      ]
    : [
        { polar: Math.PI * 0.24, azimuths: 4, phase: 0 },
        { polar: Math.PI * 0.42, azimuths: 4, phase: Math.PI * 0.25 },
        { polar: Math.PI * 0.6, azimuths: 6, phase: 0 },
        { polar: Math.PI * 0.78, azimuths: 6, phase: Math.PI / 6 },
        { polar: Math.PI * 0.94, azimuths: 4, phase: 0 },
      ];

  const directions: Vec3[] = [];
  for (const config of ringConfigs) {
    if (directions.length >= targetCount) break;
    if (config.azimuths === 1) {
      directions.push(directionFromAngles(axis, config.polar, 0));
      continue;
    }
    for (let index = 0; index < config.azimuths; index += 1) {
      if (directions.length >= targetCount) break;
      const azimuth = config.phase + ((index / config.azimuths) * Math.PI * 2);
      directions.push(directionFromAngles(axis, config.polar, azimuth));
    }
  }

  if (directions.length < targetCount) {
    directions.push(...buildFibonacciDirections(axis, targetCount - directions.length));
  }

  return directions.slice(0, targetCount);
}

function isBalancedDipole(charges: PointCharge3D[]): boolean {
  if (charges.length !== 2) return false;
  const [a, b] = charges;
  if (!a || !b) return false;
  if (a.charge * b.charge >= 0) return false;
  const maxMagnitude = Math.max(Math.abs(a.charge), Math.abs(b.charge), 1e-12);
  return Math.abs(Math.abs(a.charge) - Math.abs(b.charge)) / maxMagnitude < 0.06;
}

function centroidOfCharges(charges: PointCharge3D[]): Vec3 {
  return averageVec3(charges.map((charge) => charge.position));
}

function directionsForEmitter(
  emitter: PointCharge3D,
  allCharges: PointCharge3D[],
  targetCount: number,
): Vec3[] {
  const oppositeCharges = allCharges.filter(
    (charge) => charge.id !== emitter.id && (charge.charge * emitter.charge) < 0,
  );

  if (oppositeCharges.length > 0) {
    const axis = normalize3(sub3(centroidOfCharges(oppositeCharges), emitter.position));
    return buildAxisBiasedDirections(axis, targetCount, true);
  }

  const peer = allCharges.find((charge) => charge.id !== emitter.id);
  const fallbackAxis = peer
    ? normalize3(sub3(peer.position, emitter.position))
    : { x: 1, y: 0, z: 0 };
  return buildAxisBiasedDirections(fallbackAxis, targetCount, false);
}

export function generateElectricFieldLines3D(
  charges: PointCharge3DInput[],
  bounds: FieldProjectionBounds,
  options?: {
    density?: FieldLineDensity;
  },
): FieldLine3D[] {
  if (charges.length === 0) return [];

  const liftedCharges = charges.map(toPointCharge3D);
  const density = options?.density ?? 'standard';
  const traceConfig = buildTraceConfig(liftedCharges, bounds);
  const bounds3D = buildBounds3D(liftedCharges, bounds, traceConfig);
  const positives = liftedCharges.filter((charge) => charge.charge > 0);
  const negatives = liftedCharges.filter((charge) => charge.charge < 0);
  const emitters = positives.length > 0 ? positives : negatives;
  const lines: FieldLine3D[] = [];
  const preferSinkTerminatingLines = isBalancedDipole(liftedCharges);

  for (const emitter of emitters) {
    const sourceSign: 1 | -1 = emitter.charge >= 0 ? 1 : -1;
    const seedCount = densitySeedCount(density, Math.abs(emitter.charge));
    const directions = directionsForEmitter(emitter, liftedCharges, seedCount);
    const startRadius = Math.max(traceConfig.startRadius, (emitter.radius ?? 0) * 1.5);
    const directionSign: 1 | -1 = sourceSign === 1 ? 1 : -1;

    for (const direction of directions) {
      const start = add3(emitter.position, scale3(direction, startRadius));
      const traced = traceFieldLine3D(start, liftedCharges, bounds3D, directionSign, traceConfig);
      if (!traced || traced.points.length < 5) continue;
      lines.push({
        points: traced.points,
        startChargeId: emitter.id,
        sourceSign,
        reachesSink: traced.reachesSink,
      });
    }
  }

  if (!preferSinkTerminatingLines) return lines;

  const sinkTerminatingLines = lines.filter((line) => line.reachesSink);
  return sinkTerminatingLines.length >= Math.max(8, Math.floor(lines.length * 0.5))
    ? sinkTerminatingLines
    : lines;
}

export function createElectricFieldCamera(
  charges: PointCharge3DInput[],
  bounds: FieldProjectionBounds,
  options?: {
    yawDeg?: number;
    pitchDeg?: number;
    distanceScale?: number;
  },
): ProjectionCamera3D {
  const liftedCharges = charges.map(toPointCharge3D);
  const target = centroidOfCharges(liftedCharges);
  const characteristic = characteristicLength(liftedCharges, bounds);
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, characteristic);
  const yaw = ((options?.yawDeg ?? -34) * Math.PI) / 180;
  const pitch = ((options?.pitchDeg ?? 24) * Math.PI) / 180;
  const distance = Math.max(
    span * (options?.distanceScale ?? 1.88),
    characteristic * 6.2,
    1.35,
  );

  const offset = {
    x: distance * Math.sin(yaw) * Math.cos(pitch),
    y: distance * Math.sin(pitch),
    z: distance * Math.cos(yaw) * Math.cos(pitch),
  };
  const position = add3(target, offset);
  const forward = normalize3(sub3(target, position));
  const upReference = Math.abs(forward.y) > 0.94
    ? { x: 0, y: 0, z: 1 }
    : { x: 0, y: 1, z: 0 };
  const right = normalize3(cross3(forward, upReference));
  const up = normalize3(cross3(right, forward));

  return {
    position,
    target,
    forward,
    right,
    up,
    focalLength: Math.max(0.92, distance * 0.94),
    near: Math.max(0.18, distance * 0.24),
    far: distance + (span * 3.4),
  };
}

export function projectPoint3D(
  point: Vec3,
  camera: ProjectionCamera3D,
  coordinateTransform: CoordinateTransform,
): ProjectedPoint3D {
  const viewVector = sub3(point, camera.position);
  const cameraX = dot3(viewVector, camera.right);
  const cameraY = dot3(viewVector, camera.up);
  const cameraZ = dot3(viewVector, camera.forward);
  const safeZ = Math.max(cameraZ, camera.near * 0.3);
  const scale = camera.focalLength / safeZ;
  const depth = clamp(
    (safeZ - camera.near) / Math.max(camera.far - camera.near, 1e-6),
    0,
    1,
  );

  return {
    x: coordinateTransform.origin.x + (cameraX * scale * coordinateTransform.scale),
    y: coordinateTransform.origin.y - (cameraY * scale * coordinateTransform.scale),
    cameraZ: safeZ,
    depth,
    scale,
    visible: cameraZ > camera.near * 0.22,
  };
}

export function projectSphereRadius(
  radius: number,
  projectedPoint: ProjectedPoint3D,
  coordinateTransform: CoordinateTransform,
): number {
  return radius * projectedPoint.scale * coordinateTransform.scale;
}
