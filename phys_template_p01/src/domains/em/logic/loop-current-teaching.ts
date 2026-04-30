import type { ParamValues } from '@/core/types';
import { MU_0 } from './straight-wire-teaching';
import type { LoopCurrentDirection } from './current-direction';

export const LOOP_BFIELD_PRESET_ID = 'P02-EMF022-circular-current-bfield';

export type LoopViewMode = 'isometric' | 'top' | 'front';

interface LoopViewTransitionState {
  active: LoopViewMode | null;
  previous: LoopViewMode | null;
  startedAt: number;
}

interface LoopVisualStrength {
  currentNormalized: number;
  centerNormalized: number;
  loopLineWidth: number;
  fieldLineWidth: number;
  fieldAlpha: number;
  centerGlowAlpha: number;
  arrowSize: number;
  fieldLoopCount: number;
  centerSymbolCount: number;
  outerLoopScale: number;
}

let loopViewTransitionState: LoopViewTransitionState = {
  active: null,
  previous: null,
  startedAt: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeLoopViewMode(value: unknown): LoopViewMode {
  if (value === 'top' || value === 'front' || value === 'isometric') {
    return value;
  }
  return 'isometric';
}

export function getLoopViewMode(paramValues?: ParamValues): LoopViewMode {
  return normalizeLoopViewMode(paramValues?.loopViewMode);
}

export function getLoopViewLabel(mode: LoopViewMode): string {
  if (mode === 'top') return '俯视图';
  if (mode === 'front') return '侧视图';
  return '3D视角';
}

export function computeLoopCenterField(current: number, radius: number): number {
  const safeRadius = Math.max(radius, 1e-9);
  return (MU_0 * Math.abs(current)) / (2 * safeRadius);
}

export function getLoopTopFieldSymbol(direction: LoopCurrentDirection): 'out' | 'into' {
  return direction === 'counterclockwise' ? 'out' : 'into';
}

export function getLoopTopFieldLabel(direction: LoopCurrentDirection): string {
  return direction === 'counterclockwise' ? '穿出屏幕' : '穿入屏幕';
}

export function getLoopFrontAxisDirection(direction: LoopCurrentDirection): 'up' | 'down' {
  return direction === 'counterclockwise' ? 'up' : 'down';
}

export function getLoopFrontAxisLabel(direction: LoopCurrentDirection): string {
  return direction === 'counterclockwise' ? '向上' : '向下';
}

export function getLoopCurrentViewpointHint(direction: LoopCurrentDirection): string {
  return direction === 'counterclockwise'
    ? '俯视为逆时针，中心磁场穿出屏幕'
    : '俯视为顺时针，中心磁场穿入屏幕';
}

export function getLoopVisualStrength(current: number, radius: number): LoopVisualStrength {
  const currentNormalized = clamp((Math.abs(current) - 0.5) / 19.5, 0, 1);
  const inverseRadiusNormalized = clamp((3 - radius) / 2.5, 0, 1);
  const centerNormalized = clamp(currentNormalized * 0.72 + inverseRadiusNormalized * 0.28, 0, 1);

  return {
    currentNormalized,
    centerNormalized,
    loopLineWidth: 2.6 + currentNormalized * 2.1,
    fieldLineWidth: 1.35 + currentNormalized * 2 + inverseRadiusNormalized * 0.35,
    fieldAlpha: 0.26 + currentNormalized * 0.5,
    centerGlowAlpha: 0.12 + centerNormalized * 0.38,
    arrowSize: 5.5 + currentNormalized * 5.8,
    fieldLoopCount: 4 + Math.round(currentNormalized * 3),
    centerSymbolCount: 3 + Math.round(centerNormalized * 2),
    outerLoopScale: 1.08 + radius * 0.18,
  };
}

export function resolveLoopViewTransition(
  mode: LoopViewMode,
  durationMs = 220,
): {
  mode: LoopViewMode;
  previous: LoopViewMode | null;
  progress: number;
} {
  const now = performance.now();

  if (loopViewTransitionState.active === null) {
    loopViewTransitionState = { active: mode, previous: null, startedAt: now };
    return { mode, previous: null, progress: 1 };
  }

  if (loopViewTransitionState.active !== mode) {
    loopViewTransitionState = {
      active: mode,
      previous: loopViewTransitionState.active,
      startedAt: now,
    };
  }

  if (!loopViewTransitionState.previous) {
    return { mode: loopViewTransitionState.active ?? mode, previous: null, progress: 1 };
  }

  const progress = clamp((now - loopViewTransitionState.startedAt) / durationMs, 0, 1);
  if (progress >= 1) {
    loopViewTransitionState.previous = null;
  }

  return {
    mode: loopViewTransitionState.active ?? mode,
    previous: loopViewTransitionState.previous,
    progress,
  };
}
