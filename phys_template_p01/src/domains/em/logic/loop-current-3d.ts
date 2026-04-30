import type { ParamValues, Vec2 } from '@/core/types';

export interface LoopCameraState {
  yawDeg: number;
  pitchDeg: number;
}

export interface LoopPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedLoopPoint extends Vec2 {
  depth: number;
}

export const LOOP_CAMERA_DEFAULT_YAW_DEG = -32;
export const LOOP_CAMERA_DEFAULT_PITCH_DEG = 18;
export const LOOP_CAMERA_MIN_PITCH_DEG = -35;
export const LOOP_CAMERA_MAX_PITCH_DEG = 35;

const LOOP_PROJECTION_SKEW_X = 0.26;
const LOOP_PROJECTION_SKEW_Y = 0.14;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function clampLoopPitchDeg(value: number): number {
  return clamp(value, LOOP_CAMERA_MIN_PITCH_DEG, LOOP_CAMERA_MAX_PITCH_DEG);
}

export function getLoopCameraState(paramValues?: ParamValues): LoopCameraState {
  return {
    yawDeg: readFiniteNumber(paramValues?.loopCameraYawDeg, LOOP_CAMERA_DEFAULT_YAW_DEG),
    pitchDeg: clampLoopPitchDeg(
      readFiniteNumber(paramValues?.loopCameraPitchDeg, LOOP_CAMERA_DEFAULT_PITCH_DEG),
    ),
  };
}

export function getLoopShowAuxiliaryLabels(paramValues?: ParamValues): boolean {
  return paramValues?.loopShowAuxiliaryLabels !== false;
}

export function rotateLoopPoint(
  point: LoopPoint3D,
  camera: LoopCameraState,
): LoopPoint3D {
  const yaw = (camera.yawDeg * Math.PI) / 180;
  const pitch = (camera.pitchDeg * Math.PI) / 180;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);

  const pitchedY = point.y * cosPitch - point.z * sinPitch;
  const pitchedZ = point.y * sinPitch + point.z * cosPitch;

  return {
    x: point.x * cosYaw + pitchedZ * sinYaw,
    y: pitchedY,
    z: -point.x * sinYaw + pitchedZ * cosYaw,
  };
}

export function projectLoopPoint(
  point: LoopPoint3D,
  center: Vec2,
  camera: LoopCameraState,
): ProjectedLoopPoint {
  const rotated = rotateLoopPoint(point, camera);
  return {
    x: center.x + rotated.x + rotated.z * LOOP_PROJECTION_SKEW_X,
    y: center.y - rotated.y + rotated.z * LOOP_PROJECTION_SKEW_Y,
    depth: rotated.z,
  };
}

export function interpolateProjectedLoopPoint(
  from: ProjectedLoopPoint,
  to: ProjectedLoopPoint,
  threshold = 0,
): ProjectedLoopPoint {
  const denominator = to.depth - from.depth;
  const t = Math.abs(denominator) < 1e-6
    ? 0
    : (threshold - from.depth) / denominator;

  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    depth: threshold,
  };
}

export function getProjectedVisibleSegments(
  points: ProjectedLoopPoint[],
  closePath = false,
  threshold = 0,
): ProjectedLoopPoint[][] {
  if (points.length < 2) return [];

  const segments: ProjectedLoopPoint[][] = [];
  let current: ProjectedLoopPoint[] | null = null;
  const edgeCount = closePath ? points.length : points.length - 1;

  for (let index = 0; index < edgeCount; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    const startVisible = start.depth >= threshold;
    const endVisible = end.depth >= threshold;

    if (startVisible && endVisible) {
      if (!current) {
        current = [{ ...start }];
      }
      current.push({ ...end });
      continue;
    }

    if (startVisible && !endVisible) {
      if (!current) {
        current = [{ ...start }];
      }
      current.push(interpolateProjectedLoopPoint(start, end, threshold));
      segments.push(current);
      current = null;
      continue;
    }

    if (!startVisible && endVisible) {
      current = [
        interpolateProjectedLoopPoint(start, end, threshold),
        { ...end },
      ];
    }
  }

  if (current && current.length >= 2) {
    segments.push(current);
  }

  const firstPointDepth = points[0]?.depth ?? Number.NEGATIVE_INFINITY;
  const lastPointDepth = points[points.length - 1]?.depth ?? Number.NEGATIVE_INFINITY;

  if (
    closePath &&
    segments.length >= 2 &&
    firstPointDepth >= threshold &&
    lastPointDepth >= threshold
  ) {
    const first = segments[0]!;
    const last = segments[segments.length - 1]!;
    segments[0] = [...last, ...first.slice(1)];
    segments.pop();
  }

  return segments;
}
