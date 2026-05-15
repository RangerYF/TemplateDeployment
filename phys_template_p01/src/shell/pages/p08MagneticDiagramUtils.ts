import type { Vec2 } from '@/core/types';

export type MagneticFieldDirection = 'into' | 'out';
export type ChargeSign = 1 | -1;

export interface MagneticSharedParams {
  fieldDirection: MagneticFieldDirection;
  chargeSign: ChargeSign;
  chargeMagnitude: number;
  mass: number;
  speed: number;
  fieldMagnitude: number;
}

export interface RotationTrajectory {
  center: Vec2;
  points: Vec2[];
  launchAngleDeg: number;
  orbitRadius: number;
  tangentAngleDeg: number;
  arcSpanRad: number;
}

export interface FocusingTrajectory {
  center: Vec2;
  incomingStart: Vec2;
  entry: Vec2;
  arcPoints: Vec2[];
  exit: Vec2;
}

export interface DivergenceTrajectory {
  center: Vec2;
  source: Vec2;
  entry: Vec2;
  arcPoints: Vec2[];
  exit: Vec2;
  outgoingEnd: Vec2;
}

export interface FocusingModelGeometry {
  fieldRadius: number;
  focusPoint: Vec2;
  trajectories: FocusingTrajectory[];
  curvatureSide: 1 | -1;
}

export interface DivergenceModelGeometry {
  fieldRadius: number;
  sourcePoint: Vec2;
  trajectories: DivergenceTrajectory[];
  curvatureSide: 1 | -1;
}

const TWO_PI = Math.PI * 2;
const ARC_SAMPLES = 48;

export function computeOrbitRadius(params: MagneticSharedParams): number {
  const safeField = Math.max(params.fieldMagnitude, 1e-6);
  const safeCharge = Math.max(params.chargeMagnitude, 1e-6);
  return (params.mass * params.speed) / (safeCharge * safeField);
}

export function mapPhysicalRadiusToPixels(radius: number, minPx: number, maxPx: number): number {
  const safeRadius = Math.max(radius, 1e-6);
  const normalized = Math.asinh(safeRadius / 0.35) / Math.asinh(240 / 0.35);
  return lerp(minPx, maxPx, clamp(normalized, 0, 1));
}

export function getSignedField(direction: MagneticFieldDirection): number {
  return direction === 'out' ? 1 : -1;
}

export function getSignedChargeField(params: MagneticSharedParams): number {
  return params.chargeSign * getSignedField(params.fieldDirection);
}

export function getCurvatureSide(params: MagneticSharedParams): 1 | -1 {
  return getSignedChargeField(params) >= 0 ? -1 : 1;
}

export function buildRotationTrajectories(options: {
  source: Vec2;
  particleCount: number;
  orbitRadius: number;
  params: MagneticSharedParams;
  arcSpanRad?: number;
  launchAngleStartDeg?: number;
  launchAngleEndDeg?: number;
  arcSpanVarianceRad?: number;
}): RotationTrajectory[] {
  const {
    source,
    particleCount,
    orbitRadius,
    params,
    arcSpanRad = Math.PI * 1.28,
    launchAngleStartDeg = 20,
    launchAngleEndDeg = 160,
    arcSpanVarianceRad = Math.PI * 0.22,
  } = options;
  const signedChargeField = getSignedChargeField(params) || -1;
  const angularDirection = signedChargeField >= 0 ? -1 : 1;
  const count = Math.max(1, Math.round(particleCount));
  const angleSpanDeg = launchAngleEndDeg - launchAngleStartDeg;
  const launchAnglesDeg = angleSpanDeg >= 360
    ? Array.from({ length: count }, (_, index) => launchAngleStartDeg + ((360 / count) * index))
    : interpolateRange(
      count,
      launchAngleStartDeg,
      launchAngleEndDeg,
    );

  return Array.from({ length: count }, (_, index) => {
    const launchAngleDeg = normalizeAngleDeg(launchAnglesDeg[index] ?? launchAngleStartDeg);
    const launchAngleRad = degToRad(launchAngleDeg);
    const velocityDirection = {
      x: Math.cos(launchAngleRad),
      y: Math.sin(launchAngleRad),
    };
    const forceDirection = normalize({
      x: signedChargeField * velocityDirection.y,
      y: -signedChargeField * velocityDirection.x,
    });
    const center = {
      x: source.x + (forceDirection.x * orbitRadius),
      y: source.y + (forceDirection.y * orbitRadius),
    };
    const startAngle = Math.atan2(source.y - center.y, source.x - center.x);
    const spreadT = count <= 1 ? 0.5 : index / (count - 1);
    const arcSpan = arcSpanRad + (Math.sin(spreadT * Math.PI) * arcSpanVarianceRad) - (arcSpanVarianceRad * 0.42);
    const endAngle = startAngle + (angularDirection * arcSpan);
    const points = sampleArcPoints(center, orbitRadius, startAngle, endAngle, ARC_SAMPLES);

    return {
      center,
      points,
      launchAngleDeg,
      orbitRadius,
      tangentAngleDeg: launchAngleDeg,
      arcSpanRad: arcSpan,
    };
  });
}

export function buildFocusingGeometry(options: {
  fieldRadius: number;
  particleCount: number;
  params: MagneticSharedParams;
  spreadRatio?: number;
  outsideLengthRatio?: number;
}): FocusingModelGeometry {
  const {
    fieldRadius,
    particleCount,
    params,
    spreadRatio = 0.55,
    outsideLengthRatio = 0.92,
  } = options;
  const curvatureSide = getCurvatureSide(params);
  const focusPoint = { x: 0, y: curvatureSide * fieldRadius };
  const trajectories: FocusingTrajectory[] = [];
  const offsets = interpolateRange(
    Math.max(3, Math.round(particleCount)),
    -fieldRadius * spreadRatio,
    fieldRadius * spreadRatio,
  );
  const outsideLength = fieldRadius * outsideLengthRatio;

  for (const offsetY of offsets) {
    const entryX = -Math.sqrt(Math.max((fieldRadius * fieldRadius) - (offsetY * offsetY), 0));
    const entry = { x: entryX, y: offsetY };
    const center = { x: entryX, y: offsetY + (curvatureSide * fieldRadius) };
    const exit = resolveOtherCircleIntersection(
      { x: 0, y: 0 },
      fieldRadius,
      center,
      fieldRadius,
      entry,
    );
    const arcPoints = sampleDirectedArc(entry, exit, center, fieldRadius, curvatureSide);

    trajectories.push({
      center,
      incomingStart: { x: -fieldRadius - outsideLength, y: offsetY },
      entry,
      arcPoints,
      exit,
    });
  }

  return {
    fieldRadius,
    focusPoint,
    trajectories,
    curvatureSide,
  };
}

export function buildDivergenceGeometry(options: {
  fieldRadius: number;
  particleCount: number;
  params: MagneticSharedParams;
  spreadRatio?: number;
  outsideLengthRatio?: number;
}): DivergenceModelGeometry {
  const focusing = buildFocusingGeometry(options);
  const sourcePoint = { ...focusing.focusPoint };
  const outsideLength = focusing.fieldRadius * (options.outsideLengthRatio ?? 0.92);
  const trajectories = focusing.trajectories.map((trajectory) => {
    const mirroredCenter = mirrorX(trajectory.center);
    const mirroredEntry = mirrorX(trajectory.exit);
    const mirroredExit = mirrorX(trajectory.entry);
    const mirroredArc = trajectory.arcPoints.map(mirrorX).reverse();
    return {
      center: mirroredCenter,
      source: sourcePoint,
      entry: mirroredEntry,
      arcPoints: mirroredArc,
      exit: mirroredExit,
      outgoingEnd: {
        x: focusing.fieldRadius + outsideLength,
        y: mirroredExit.y,
      },
    };
  });

  return {
    fieldRadius: focusing.fieldRadius,
    sourcePoint,
    trajectories,
    curvatureSide: focusing.curvatureSide,
  };
}

export function pathFromPoints(points: Vec2[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first!.x.toFixed(2)} ${first!.y.toFixed(2)} ${rest
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')}`.trim();
}

export function samplePathPoint(points: Vec2[], progress: number): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0]! };

  const clamped = clamp(progress, 0, 0.999999);
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const length = Math.hypot(current.x - previous.x, current.y - previous.y);
    segmentLengths.push(length);
    totalLength += length;
  }
  if (totalLength <= 1e-6) return { ...points[0]! };

  const targetLength = totalLength * clamped;
  let traversed = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index]!;
    if (traversed + length >= targetLength) {
      const ratio = (targetLength - traversed) / Math.max(length, 1e-6);
      const start = points[index]!;
      const end = points[index + 1]!;
      return {
        x: lerp(start.x, end.x, ratio),
        y: lerp(start.y, end.y, ratio),
      };
    }
    traversed += length;
  }

  return { ...points[points.length - 1]! };
}

export function buildRectFieldSymbolPositions(options: {
  width: number;
  height: number;
  spacing: number;
}): Vec2[] {
  const { width, height, spacing } = options;
  const points: Vec2[] = [];
  for (let y = spacing * 0.5; y < height; y += spacing) {
    for (let x = spacing * 0.5; x < width; x += spacing) {
      points.push({ x, y });
    }
  }
  return points;
}

export function buildCircleFieldSymbolPositions(options: {
  radius: number;
  spacing: number;
}): Vec2[] {
  const { radius, spacing } = options;
  const points: Vec2[] = [];
  for (let y = -radius + spacing * 0.5; y <= radius - spacing * 0.5; y += spacing) {
    for (let x = -radius + spacing * 0.5; x <= radius - spacing * 0.5; x += spacing) {
      if ((x * x) + (y * y) <= (radius - spacing * 0.2) * (radius - spacing * 0.2)) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

export function toSvgPoint(origin: Vec2, point: Vec2): Vec2 {
  return {
    x: origin.x + point.x,
    y: origin.y - point.y,
  };
}

export function polarOffset(radius: number, angleDeg: number): Vec2 {
  const radians = degToRad(angleDeg);
  return {
    x: Math.cos(radians) * radius,
    y: Math.sin(radians) * radius,
  };
}

export function mirrorX(point: Vec2): Vec2 {
  return { x: -point.x, y: point.y };
}

export function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function normalizeAngleDeg(value: number): number {
  const normalized = value % 360;
  return normalized >= 0 ? normalized : normalized + 360;
}

function sampleDirectedArc(
  start: Vec2,
  end: Vec2,
  center: Vec2,
  radius: number,
  angularDirection: 1 | -1,
): Vec2[] {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  let endAngle = Math.atan2(end.y - center.y, end.x - center.x);

  if (angularDirection > 0) {
    while (endAngle <= startAngle) endAngle += TWO_PI;
  } else {
    while (endAngle >= startAngle) endAngle -= TWO_PI;
  }

  return sampleArcPoints(center, radius, startAngle, endAngle, ARC_SAMPLES);
}

function sampleArcPoints(
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): Vec2[] {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    const angle = lerp(startAngle, endAngle, t);
    return {
      x: center.x + (Math.cos(angle) * radius),
      y: center.y + (Math.sin(angle) * radius),
    };
  });
}

function resolveOtherCircleIntersection(
  circleA: Vec2,
  radiusA: number,
  circleB: Vec2,
  radiusB: number,
  knownPoint: Vec2,
): Vec2 {
  const dx = circleB.x - circleA.x;
  const dy = circleB.y - circleA.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1e-9) return { ...knownPoint };

  const baseDistance = ((radiusA * radiusA) - (radiusB * radiusB) + (distance * distance)) / (2 * distance);
  const heightSquared = Math.max((radiusA * radiusA) - (baseDistance * baseDistance), 0);
  const height = Math.sqrt(heightSquared);
  const ex = dx / distance;
  const ey = dy / distance;
  const basePoint = {
    x: circleA.x + (ex * baseDistance),
    y: circleA.y + (ey * baseDistance),
  };
  const candidates = [
    {
      x: basePoint.x + (-ey * height),
      y: basePoint.y + (ex * height),
    },
    {
      x: basePoint.x - (-ey * height),
      y: basePoint.y - (ex * height),
    },
  ];

  return candidates.reduce((best, current) => (
    distanceBetween(current, knownPoint) > distanceBetween(best, knownPoint)
      ? current
      : best
  ));
}

function interpolateRange(count: number, start: number, end: number): number[] {
  if (count <= 1) return [start];
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return lerp(start, end, t);
  });
}

function normalize(vector: Vec2): Vec2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude <= 1e-9) return { x: 1, y: 0 };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerp(start: number, end: number, t: number): number {
  return start + ((end - start) * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
