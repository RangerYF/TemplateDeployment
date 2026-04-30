import type { Entity, ParamValues, Vec2 } from '@/core/types';
import { getProjectedVisibleSegments, type ProjectedLoopPoint } from './loop-current-3d';
import type { LoopViewMode } from './loop-current-teaching';
import { getLoopCurrentDirection, type LoopCurrentDirection } from './current-direction';

export const LOOP_LAB_STAGE_WIDTH = 1200;
export const LOOP_LAB_STAGE_HEIGHT = 760;

export interface LoopLabPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface LoopLabCameraState {
  yawDeg: number;
  pitchDeg: number;
  perspective: number;
}

export interface LoopLabStageGeometry {
  centerX: number;
  centerY: number;
  scale: number;
  radius: number;
  tubeRadius: number;
}

export interface LoopLabFieldSample {
  vector: LoopLabPoint3D;
  magnitude: number;
  directionLabel: string;
}

export interface LoopLabCompassVisual {
  angleDeg: number;
  displayMode: 'needle' | 'out' | 'into';
  projectedLength: number;
}

export interface LoopLabProjectedVector {
  from: Vec2;
  to: Vec2;
  angleDeg: number;
  length: number;
  depth: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const LOOP_BIOT_SAVART_SEGMENT_COUNT = 160;
const LOOP_BIOT_SAVART_ANGLE_STEP = (Math.PI * 2) / LOOP_BIOT_SAVART_SEGMENT_COUNT;
const LOOP_MU0_OVER_4PI = 1e-7;
const LOOP_FIELD_SOFTENING_RATIO = 0.025;
const LOOP_FIELD_TRACE_MIN_STEPS = 40;
const LOOP_FIELD_TRACE_MAX_STEPS = 720;
const LOOP_FIELD_TRACE_BOUNDS_FACTOR = 4.8;
const LOOP_FIELD_TRACE_BASE_STEP_RATIO = 0.042;
const LOOP_FIELD_TRACE_MIN_STEP_RATIO = 0.012;
const LOOP_FIELD_TRACE_CLOSE_FACTOR = 1.9;
const LOOP_FIELD_TRACE_SEED_OFFSET_RATIO = 0.03;
const LOOP_FIELD_TRACE_SEED_Z_MIN_RATIO = 0.12;
const LOOP_FIELD_TRACE_SEED_Z_SPAN_RATIO = 1.42;
const LOOP_FIELD_TRACE_CACHE_LIMIT = 64;

const LOOP_SEGMENT_TRIG = Array.from({ length: LOOP_BIOT_SAVART_SEGMENT_COUNT }, (_, index) => {
  const theta = (index + 0.5) * LOOP_BIOT_SAVART_ANGLE_STEP;
  return {
    cos: Math.cos(theta),
    sin: Math.sin(theta),
  };
});

const loopFieldTraceCache = new Map<string, LoopFieldLinePlanePoint[]>();

export function findLoopWire(entities: Map<string, Entity>): Entity | undefined {
  return Array.from(entities.values()).find(
    (entity) =>
      entity.type === 'current-wire' &&
      ((entity.properties.wireShape as string | undefined) ?? 'straight') === 'loop',
  );
}

export function getLoopCurrent(entity: Entity | undefined, paramValues: ParamValues): number {
  return typeof paramValues.current === 'number'
    ? Math.abs(paramValues.current)
    : Math.abs((entity?.properties.current as number) ?? 5);
}

export function getLoopRadius(entity: Entity | undefined, paramValues: ParamValues): number {
  return typeof paramValues.loopRadius === 'number'
    ? paramValues.loopRadius
    : ((entity?.properties.loopRadius as number) ?? 1);
}

export function getLoopDirection(entity: Entity | undefined): LoopCurrentDirection {
  return entity ? getLoopCurrentDirection(entity) : 'counterclockwise';
}

export function getLoopDirectionSign(direction: LoopCurrentDirection): number {
  return direction === 'counterclockwise' ? 1 : -1;
}

export function getLoopLabCamera(
  viewMode: LoopViewMode,
  paramValues: ParamValues,
): LoopLabCameraState {
  if (viewMode === 'top') {
    return { yawDeg: 0, pitchDeg: 10, perspective: 0.06 };
  }
  if (viewMode === 'front') {
    return { yawDeg: 0, pitchDeg: 72, perspective: 0.08 };
  }
  return {
    yawDeg: readFiniteNumber(paramValues.loopCameraYawDeg, -32),
    pitchDeg: clamp(readFiniteNumber(paramValues.loopCameraPitchDeg, 18), -45, 45),
    perspective: 0.12,
  };
}

export function getLoopLabStageGeometry(radius: number): LoopLabStageGeometry {
  return {
    centerX: LOOP_LAB_STAGE_WIDTH / 2,
    centerY: LOOP_LAB_STAGE_HEIGHT / 2 + 18,
    scale: 145,
    radius,
    tubeRadius: clamp(radius * 0.16, 0.12, 0.28),
  };
}

export function rotateLoopLabPoint(
  point: LoopLabPoint3D,
  camera: LoopLabCameraState,
): LoopLabPoint3D {
  const yaw = (camera.yawDeg * Math.PI) / 180;
  const pitch = (camera.pitchDeg * Math.PI) / 180;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const x1 = point.x * cosYaw + point.z * sinYaw;
  const z1 = -point.x * sinYaw + point.z * cosYaw;
  const y2 = point.y * cosPitch - z1 * sinPitch;
  const z2 = point.y * sinPitch + z1 * cosPitch;

  return { x: x1, y: y2, z: z2 };
}

export function projectLoopLabPoint(
  point: LoopLabPoint3D,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
): ProjectedLoopPoint {
  const rotated = rotateLoopLabPoint(point, camera);
  const perspectiveScale = 1 + (rotated.z * camera.perspective);
  return {
    x: geometry.centerX + rotated.x * geometry.scale * perspectiveScale,
    y: geometry.centerY - rotated.y * geometry.scale * perspectiveScale,
    depth: rotated.z,
  };
}

export function unprojectLoopLabPlanePoint(
  screenX: number,
  screenY: number,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
): LoopLabPoint3D {
  const yaw = (camera.yawDeg * Math.PI) / 180;
  const pitch = (camera.pitchDeg * Math.PI) / 180;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const safeCosYaw = Math.abs(cosYaw) < 1e-4 ? (cosYaw < 0 ? -1e-4 : 1e-4) : cosYaw;
  const safeCosPitch = Math.abs(cosPitch) < 1e-4 ? (cosPitch < 0 ? -1e-4 : 1e-4) : cosPitch;
  const xScreen = (screenX - geometry.centerX) / geometry.scale;
  const yScreen = (geometry.centerY - screenY) / geometry.scale;
  const x = xScreen / safeCosYaw;
  const y = (yScreen - x * sinYaw * Math.sin(pitch)) / safeCosPitch;
  return { x, y, z: 0 };
}

export function projectLoopLabVector(
  point: LoopLabPoint3D,
  vector: LoopLabPoint3D,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
  scale = 1,
): LoopLabProjectedVector {
  const from = projectLoopLabPoint(point, geometry, camera);
  const to = projectLoopLabPoint(
    {
      x: point.x + vector.x * scale,
      y: point.y + vector.y * scale,
      z: point.z + vector.z * scale,
    },
    geometry,
    camera,
  );
  return {
    from,
    to,
    angleDeg: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
    length: Math.hypot(to.x - from.x, to.y - from.y),
    depth: to.depth,
  };
}

export function sampleLoopMagneticField(
  point: LoopLabPoint3D,
  current: number,
  radius: number,
  direction: LoopCurrentDirection,
): LoopLabFieldSample {
  const safeRadius = Math.max(radius, 1e-6);
  const currentMagnitude = Math.abs(current);
  if (currentMagnitude < 1e-9) {
    return {
      vector: { x: 0, y: 0, z: 0 },
      magnitude: 0,
      directionLabel: '—',
    };
  }

  const sign = getLoopDirectionSign(direction);
  const unitVector = computeLoopBiotSavartUnitField(point, safeRadius);
  const scale = sign * currentMagnitude;
  const vector = {
    x: unitVector.x * scale,
    y: unitVector.y * scale,
    z: unitVector.z * scale,
  };

  return {
    vector,
    magnitude: Math.hypot(vector.x, vector.y, vector.z),
    directionLabel: describeLoopFieldDirection(vector),
  };
}

export function describeLoopFieldDirection(vector: LoopLabPoint3D): string {
  const planar = Math.hypot(vector.x, vector.y);
  if (Math.abs(vector.z) > planar * 1.35) {
    return vector.z >= 0 ? '穿出线圈平面' : '穿入线圈平面';
  }
  const horizontal = Math.abs(vector.x) >= Math.abs(vector.y);
  if (horizontal) {
    return vector.x >= 0 ? '向右偏转' : '向左偏转';
  }
  return vector.y >= 0 ? '向上偏转' : '向下偏转';
}

export function getLoopCompassVisual(
  point: LoopLabPoint3D,
  vector: LoopLabPoint3D,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
): LoopLabCompassVisual {
  const projection = projectLoopLabVector(point, vector, geometry, camera, 0.85 / Math.max(Math.hypot(vector.x, vector.y, vector.z), 1e-9));
  if (projection.length < 8) {
    const rotated = rotateLoopLabPoint(vector, camera);
    return {
      angleDeg: 0,
      displayMode: rotated.z >= 0 ? 'out' : 'into',
      projectedLength: projection.length,
    };
  }
  return {
    angleDeg: projection.angleDeg,
    displayMode: 'needle',
    projectedLength: projection.length,
  };
}

export function buildProjectedLoopRing(
  radius: number,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
  sampleCount = 180,
): ProjectedLoopPoint[] {
  const points: ProjectedLoopPoint[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const angle = (index / sampleCount) * Math.PI * 2;
    points.push(projectLoopLabPoint({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      z: 0,
    }, geometry, camera));
  }
  return points;
}

export interface LoopFieldLinePlanePoint {
  x: number;
  z: number;
}

function buildLoopFieldLineFallbackPoints(
  azimuthRad: number,
  radialScale: number,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
  sampleCount: number,
): ProjectedLoopPoint[] {
  const points: ProjectedLoopPoint[] = [];
  const horizontalRadius = geometry.radius * (0.22 + radialScale * 1.08);
  const verticalRadius = geometry.radius * (0.74 + radialScale * 0.92);
  const pinch = 0.08 + ((1 - radialScale) * 0.08);

  for (let index = 0; index < sampleCount; index += 1) {
    const theta = (index / sampleCount) * Math.PI * 2;
    const signedRadial = horizontalRadius * Math.sin(theta);
    const axial = verticalRadius * Math.cos(theta) * (1 - pinch * (Math.sin(theta) ** 2));
    points.push(projectLoopLabPoint({
      x: signedRadial * Math.cos(azimuthRad),
      y: signedRadial * Math.sin(azimuthRad),
      z: axial,
    }, geometry, camera));
  }
  return points;
}

function sampleLoopFieldPlaneVector(
  point: LoopFieldLinePlanePoint,
  radius: number,
  direction: LoopCurrentDirection,
): { x: number; z: number; magnitude: number } {
  const sample = sampleLoopMagneticField(
    { x: point.x, y: 0, z: point.z },
    1,
    radius,
    direction,
  );
  return {
    x: sample.vector.x,
    z: sample.vector.z,
    magnitude: Math.hypot(sample.vector.x, sample.vector.z),
  };
}

export function traceLoopFieldLinePlanePoints(
  radialScale: number,
  _current: number,
  radius: number,
  direction: LoopCurrentDirection,
  sampleCount = 120,
): LoopFieldLinePlanePoint[] {
  const safeRadius = Math.max(radius, 1e-6);
  const normalizedScale = clamp(radialScale, 0.08, 1.08);
  const cacheKey = [
    safeRadius.toFixed(4),
    direction,
    normalizedScale.toFixed(4),
    sampleCount,
  ].join('|');
  const cached = loopFieldTraceCache.get(cacheKey);
  if (cached) return cached;

  const seed = {
    x: Math.max(safeRadius * LOOP_FIELD_TRACE_SEED_OFFSET_RATIO, 0.012),
    z: safeRadius * (LOOP_FIELD_TRACE_SEED_Z_MIN_RATIO + normalizedScale * LOOP_FIELD_TRACE_SEED_Z_SPAN_RATIO),
  };
  const traced = traceLoopFieldLineFromSeed(seed, safeRadius, direction);
  const points = traced.length >= Math.max(sampleCount * 0.4, LOOP_FIELD_TRACE_MIN_STEPS)
    ? traced
    : [];

  if (points.length > 0) {
    setLoopFieldTraceCache(cacheKey, points);
  }

  return points;
}

function computeLoopBiotSavartUnitField(
  point: LoopLabPoint3D,
  radius: number,
): LoopLabPoint3D {
  const safeRadius = Math.max(radius, 1e-6);
  const softening = Math.max(safeRadius * LOOP_FIELD_SOFTENING_RATIO, 0.01);
  const softeningSq = softening * softening;
  let bx = 0;
  let by = 0;
  let bz = 0;

  for (const trig of LOOP_SEGMENT_TRIG) {
    const sourceX = safeRadius * trig.cos;
    const sourceY = safeRadius * trig.sin;
    const dlx = -safeRadius * trig.sin * LOOP_BIOT_SAVART_ANGLE_STEP;
    const dly = safeRadius * trig.cos * LOOP_BIOT_SAVART_ANGLE_STEP;
    const rx = point.x - sourceX;
    const ry = point.y - sourceY;
    const rz = point.z;
    const distanceSq = Math.max((rx * rx) + (ry * ry) + (rz * rz), softeningSq);
    const distance = Math.sqrt(distanceSq);
    const invDistanceCubed = 1 / (distanceSq * distance);

    bx += (dly * rz) * invDistanceCubed;
    by += (-dlx * rz) * invDistanceCubed;
    bz += ((dlx * ry) - (dly * rx)) * invDistanceCubed;
  }

  return {
    x: bx * LOOP_MU0_OVER_4PI,
    y: by * LOOP_MU0_OVER_4PI,
    z: bz * LOOP_MU0_OVER_4PI,
  };
}

function traceLoopFieldLineFromSeed(
  seed: LoopFieldLinePlanePoint,
  radius: number,
  direction: LoopCurrentDirection,
): LoopFieldLinePlanePoint[] {
  const points: LoopFieldLinePlanePoint[] = [{ ...seed }];
  const bounds = radius * LOOP_FIELD_TRACE_BOUNDS_FACTOR;
  let currentPoint = { ...seed };

  for (let stepIndex = 0; stepIndex < LOOP_FIELD_TRACE_MAX_STEPS; stepIndex += 1) {
    const nextPoint = advanceLoopFieldLine(currentPoint, radius, direction);
    if (!nextPoint) break;
    if (!Number.isFinite(nextPoint.x) || !Number.isFinite(nextPoint.z)) break;
    if (Math.abs(nextPoint.x) > bounds || Math.abs(nextPoint.z) > bounds) break;

    const traceStep = Math.max(
      radius * LOOP_FIELD_TRACE_MIN_STEP_RATIO,
      getLoopFieldTraceStep(currentPoint, radius),
    );
    const closeThreshold = traceStep * LOOP_FIELD_TRACE_CLOSE_FACTOR;
    if (
      stepIndex >= LOOP_FIELD_TRACE_MIN_STEPS &&
      Math.hypot(nextPoint.x - seed.x, nextPoint.z - seed.z) <= closeThreshold
    ) {
      break;
    }

    points.push(nextPoint);
    currentPoint = nextPoint;
  }

  return points;
}

function advanceLoopFieldLine(
  point: LoopFieldLinePlanePoint,
  radius: number,
  direction: LoopCurrentDirection,
): LoopFieldLinePlanePoint | null {
  const first = sampleLoopFieldPlaneVector(point, radius, direction);
  if (first.magnitude < 1e-12) return null;

  const step = getLoopFieldTraceStep(point, radius);
  const firstDirection = {
    x: first.x / first.magnitude,
    z: first.z / first.magnitude,
  };
  const midpoint = {
    x: point.x + firstDirection.x * step * 0.5,
    z: point.z + firstDirection.z * step * 0.5,
  };
  const second = sampleLoopFieldPlaneVector(midpoint, radius, direction);
  if (second.magnitude < 1e-12) return null;

  return {
    x: point.x + (second.x / second.magnitude) * step,
    z: point.z + (second.z / second.magnitude) * step,
  };
}

function getLoopFieldTraceStep(
  point: LoopFieldLinePlanePoint,
  radius: number,
): number {
  const safeRadius = Math.max(radius, 1e-6);
  const distanceToWire = Math.hypot(Math.abs(point.x) - safeRadius, point.z);
  const normalizedDistance = clamp(distanceToWire / safeRadius, 0.18, 1.25);
  return safeRadius * LOOP_FIELD_TRACE_BASE_STEP_RATIO * normalizedDistance;
}

function setLoopFieldTraceCache(
  key: string,
  points: LoopFieldLinePlanePoint[],
): void {
  if (loopFieldTraceCache.has(key)) {
    loopFieldTraceCache.delete(key);
  }
  loopFieldTraceCache.set(key, points);

  if (loopFieldTraceCache.size > LOOP_FIELD_TRACE_CACHE_LIMIT) {
    const oldestKey = loopFieldTraceCache.keys().next().value;
    if (typeof oldestKey === 'string') {
      loopFieldTraceCache.delete(oldestKey);
    }
  }
}

function projectLoopFieldPlanePoint(
  point: LoopFieldLinePlanePoint,
  azimuthRad: number,
): LoopLabPoint3D {
  return {
    x: point.x * Math.cos(azimuthRad),
    y: point.x * Math.sin(azimuthRad),
    z: point.z,
  };
}

function resampleLoopFieldLinePlanePoints(
  points: LoopFieldLinePlanePoint[],
  sampleCount: number,
): LoopFieldLinePlanePoint[] {
  if (sampleCount <= 0 || points.length <= sampleCount) {
    return points;
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const sourceIndex = Math.floor((index / sampleCount) * points.length);
    return points[Math.min(sourceIndex, points.length - 1)]!;
  });
}

export function buildLoopFieldLinePoints(
  azimuthRad: number,
  radialScale: number,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
  current: number,
  direction: LoopCurrentDirection,
  sampleCount = 120,
): ProjectedLoopPoint[] {
  const tracedPoints = resampleLoopFieldLinePlanePoints(
    traceLoopFieldLinePlanePoints(radialScale, current, geometry.radius, direction, sampleCount),
    sampleCount,
  );

  if (tracedPoints.length < Math.max(24, Math.floor(sampleCount * 0.2))) {
    return buildLoopFieldLineFallbackPoints(
      azimuthRad,
      radialScale,
      geometry,
      camera,
      sampleCount,
    );
  }

  return tracedPoints.map((point) =>
    projectLoopLabPoint(
      projectLoopFieldPlanePoint(point, azimuthRad),
      geometry,
      camera,
    ),
  );
}

export function buildLoopAxisLinePoints(
  offset: number,
  geometry: LoopLabStageGeometry,
  camera: LoopLabCameraState,
): ProjectedLoopPoint[] {
  return [
    projectLoopLabPoint({ x: offset, y: 0, z: -geometry.radius * 1.6 }, geometry, camera),
    projectLoopLabPoint({ x: offset, y: 0, z: geometry.radius * 1.6 }, geometry, camera),
  ];
}

export function getLoopVisibleSegments(points: ProjectedLoopPoint[], closePath = false): ProjectedLoopPoint[][] {
  return getProjectedVisibleSegments(points, closePath);
}

export function pointsToSvgPath(points: ProjectedLoopPoint[], closePath = false): string {
  if (points.length === 0) return '';
  const commands = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`);
  return `${commands.join(' ')}${closePath ? ' Z' : ''}`;
}

export function getNearestRingPoint(
  screenX: number,
  screenY: number,
  ringPoints: ProjectedLoopPoint[],
): { point: ProjectedLoopPoint; index: number; distance: number } | null {
  if (ringPoints.length === 0) return null;

  let nearest = ringPoints[0]!;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  ringPoints.forEach((point, index) => {
    const distance = Math.hypot(point.x - screenX, point.y - screenY);
    if (distance < nearestDistance) {
      nearest = point;
      nearestIndex = index;
      nearestDistance = distance;
    }
  });

  return {
    point: nearest,
    index: nearestIndex,
    distance: nearestDistance,
  };
}

export function getRingAngleByIndex(index: number, count: number): number {
  return (index / Math.max(count, 1)) * Math.PI * 2;
}
