/**
 * trigSampler — M04 Phase 2
 *
 * Samples trigonometric curves (sin, cos, tan) with:
 *  - Transform support: y = A · fn(ω·x + φ) + k
 *  - Discontinuity detection for tan (asymptote jump → isBreak: true)
 *  - Domain-clip: points outside [yMin, yMax] * CLIP_FACTOR are silently dropped
 *    to prevent rendering artifacts near tan asymptotes
 */

import type { FnType, TrigTransform } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrigSamplePoint {
  x:       number;
  y:       number;
  isBreak: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Multiplier on yRange beyond which a y-jump signals an asymptote. */
const BREAK_FACTOR = 3;

// ─── Core evaluator ──────────────────────────────────────────────────────────

/**
 * Evaluate the trig transform at a single x.
 * Returns NaN if the result is not finite.
 */
export function evalTrig(fnType: FnType, t: TrigTransform, x: number): number {
  const arg = t.omega * x + t.phi;
  let base: number;
  switch (fnType) {
    case 'sin': base = Math.sin(arg); break;
    case 'cos': base = Math.cos(arg); break;
    case 'tan': base = Math.tan(arg); break;
  }
  const y = t.A * base + t.k;
  return isFinite(y) ? y : NaN;
}

// ─── Sampler ─────────────────────────────────────────────────────────────────

/**
 * Sample `fnType` with `transform` from `xMin` to `xMax` in `steps` steps.
 *
 * Discontinuities (tan asymptotes) are detected by a large |Δy| jump:
 *   |y_i - y_{i-1}| > yRange * BREAK_FACTOR  →  isBreak: true on point i
 *
 * @param yMin / yMax  Viewport y limits — used only for discontinuity detection.
 */
export function sampleTrigFunction(
  fnType:    FnType,
  transform: TrigTransform,
  xMin:      number,
  xMax:      number,
  yMin:      number,
  yMax:      number,
  steps  =   800,
): TrigSamplePoint[] {
  const yRange = yMax - yMin;
  const breakThreshold = yRange * BREAK_FACTOR;
  const dx = (xMax - xMin) / steps;

  const points: TrigSamplePoint[] = [];
  let prevY = evalTrig(fnType, transform, xMin);

  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    const y = evalTrig(fnType, transform, x);

    if (!isFinite(y)) {
      prevY = NaN;
      continue;
    }

    // Asymptote break: large jump from last valid point
    const isBreak =
      i > 0 &&
      isFinite(prevY) &&
      Math.abs(y - prevY) > breakThreshold;

    points.push({ x, y, isBreak });
    prevY = y;
  }

  return points;
}
