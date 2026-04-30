import type { ParamValues } from '@/core/types';
import type { StraightCurrentDirection } from './current-direction';

export const MU_0 = 4 * Math.PI * 1e-7;
export const STRAIGHT_WIRE_REFERENCE_RADIUS = 1;
export const STRAIGHT_WIRE_REFERENCE_RADIUS_MIN = 0.35;
export const STRAIGHT_WIRE_REFERENCE_RADIUS_MAX = 2.8;
export const WIRE_BFIELD_PRESET_ID = 'P02-EMF021-wire-bfield';

export type StraightWireViewMode = 'isometric' | 'top' | 'front';

interface StraightWireViewTransitionState {
  active: StraightWireViewMode | null;
  previous: StraightWireViewMode | null;
  startedAt: number;
}

interface StraightWireVisualStrength {
  normalized: number;
  lineWidth: number;
  arrowSize: number;
  strokeAlpha: number;
  accentAlpha: number;
  ringCount: number;
  maxRadiusWorld: number;
  symbolColumns: number;
  symbolRows: number;
  symbolSize: number;
  wireWidth: number;
  currentArrowSize: number;
  glowAlpha: number;
  particleCount: number;
  particleSpeed: number;
  guideAlpha: number;
  frontBandAlpha: number;
  fieldSpread: number;
  wireGlowAlpha: number;
  wireHaloWidth: number;
  currentFlowOpacity: number;
}

let viewTransitionState: StraightWireViewTransitionState = {
  active: null,
  previous: null,
  startedAt: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeStraightWireViewMode(value: unknown): StraightWireViewMode {
  if (value === 'top' || value === 'front' || value === 'isometric') {
    return value;
  }
  return 'isometric';
}

export function getStraightWireViewMode(paramValues?: ParamValues): StraightWireViewMode {
  return normalizeStraightWireViewMode(paramValues?.wireViewMode);
}

export function getStraightWireViewLabel(mode: StraightWireViewMode): string {
  if (mode === 'top') return '俯视图';
  if (mode === 'front') return '正视图';
  return '立体图';
}

export function getStraightWireRotationText(direction: StraightCurrentDirection): '顺时针' | '逆时针' {
  return direction === 'up' ? '逆时针' : '顺时针';
}

export function getStraightWireTopViewCurrentSymbol(direction: StraightCurrentDirection): 'into' | 'out' {
  return direction === 'up' ? 'out' : 'into';
}

export function getStraightWireFrontViewSides(direction: StraightCurrentDirection): {
  left: 'into' | 'out';
  right: 'into' | 'out';
} {
  return direction === 'up'
    ? { left: 'out', right: 'into' }
    : { left: 'into', right: 'out' };
}

export function getStraightWireFrontViewText(direction: StraightCurrentDirection): string {
  const sides = getStraightWireFrontViewSides(direction);
  return `左侧${sides.left === 'out' ? '·' : '×'}，右侧${sides.right === 'out' ? '·' : '×'}`;
}

export function clampStraightWireReferenceRadius(value: number): number {
  return clamp(value, STRAIGHT_WIRE_REFERENCE_RADIUS_MIN, STRAIGHT_WIRE_REFERENCE_RADIUS_MAX);
}

export function getStraightWireReferenceRadius(paramValues?: ParamValues): number {
  const rawValue = typeof paramValues?.wireReferenceRadius === 'number'
    ? paramValues.wireReferenceRadius
    : Number(paramValues?.wireReferenceRadius);
  const radius = Number.isFinite(rawValue) ? rawValue : STRAIGHT_WIRE_REFERENCE_RADIUS;
  return clampStraightWireReferenceRadius(radius);
}

export function getStraightWireRightHandRuleText(direction: StraightCurrentDirection): string {
  return direction === 'up'
    ? '拇指沿导线向上；从俯视图看，四指沿逆时针方向环绕。'
    : '拇指沿导线向下；从俯视图看，四指沿顺时针方向环绕。';
}

export function computeStraightWireFieldAtRadius(current: number, radius: number): number {
  const safeRadius = Math.max(radius, 1e-9);
  return (MU_0 * Math.abs(current)) / (2 * Math.PI * safeRadius);
}

export function getStraightWireVisualStrength(current: number): StraightWireVisualStrength {
  const normalized = clamp((Math.abs(current) - 0.5) / 19.5, 0, 1);
  const energy = normalized ** 0.9;

  return {
    normalized: energy,
    lineWidth: 1.5 + energy * 2.5,
    arrowSize: 5.8 + energy * 6.2,
    strokeAlpha: 0.26 + energy * 0.56,
    accentAlpha: 0.16 + energy * 0.34,
    ringCount: 5 + Math.round(energy * 4),
    maxRadiusWorld: 1.55 + energy * 1.35,
    symbolColumns: 4 + Math.round(energy * 2),
    symbolRows: 5 + Math.round(energy * 4),
    symbolSize: 5.6 + energy * 5.6,
    wireWidth: 6.2 + energy * 4.8,
    currentArrowSize: 11.5 + energy * 5.8,
    glowAlpha: 0.14 + energy * 0.34,
    particleCount: 1 + Math.round(energy * 3),
    particleSpeed: 0.22 + energy * 0.56,
    guideAlpha: 0.46 + energy * 0.36,
    frontBandAlpha: 0.08 + energy * 0.18,
    fieldSpread: 0.84 + energy * 0.38,
    wireGlowAlpha: 0.12 + energy * 0.24,
    wireHaloWidth: 8 + energy * 8,
    currentFlowOpacity: 0.16 + energy * 0.32,
  };
}

export function resolveStraightWireViewTransition(
  mode: StraightWireViewMode,
  durationMs = 220,
): {
  mode: StraightWireViewMode;
  previous: StraightWireViewMode | null;
  progress: number;
} {
  const now = performance.now();

  if (viewTransitionState.active === null) {
    viewTransitionState = { active: mode, previous: null, startedAt: now };
    return { mode, previous: null, progress: 1 };
  }

  if (viewTransitionState.active !== mode) {
    viewTransitionState = {
      active: mode,
      previous: viewTransitionState.active,
      startedAt: now,
    };
  }

  if (!viewTransitionState.previous) {
    return { mode: viewTransitionState.active ?? mode, previous: null, progress: 1 };
  }

  const progress = clamp((now - viewTransitionState.startedAt) / durationMs, 0, 1);
  if (progress >= 1) {
    viewTransitionState.previous = null;
  }

  return {
    mode: viewTransitionState.active ?? mode,
    previous: viewTransitionState.previous,
    progress,
  };
}
