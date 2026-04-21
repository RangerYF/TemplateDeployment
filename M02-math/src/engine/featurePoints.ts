import {
  evaluateAt,
  numericalDerivative,
  type CompiledExpression,
} from '@/engine/expressionEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FeaturePointType = 'zero' | 'localMax' | 'localMin' | 'inflection';

export interface FeaturePoint {
  readonly x: number;
  readonly y: number;
  readonly type: FeaturePointType;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Bisection iterations → precision ≈ xRange / steps / 2^ITERATIONS ≈ 1e-6 */
const BISECTION_ITERATIONS = 20;

/** Scan resolution: enough to catch all roots of typical high-school functions */
const SCAN_STEPS = 1000;

/** Step for second-derivative central difference */
const D2_H = 1e-5;

// ─── Bisection ───────────────────────────────────────────────────────────────

/**
 * Find the root of f in [a, b] via bisection.
 * Precondition: f(a) and f(b) have opposite signs.
 */
function bisect(f: (x: number) => number, a: number, b: number): number {
  let lo = a;
  let hi = b;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

// ─── Zero Finder ─────────────────────────────────────────────────────────────

/**
 * Scan for zeros of `expr` in [xMin, xMax].
 *
 * Accuracy note (人教版):
 *   sin(x) on [-2π, 2π] produces exactly 5 zeros: -2π, -π, 0, π, 2π.
 *   The duplicate-guard uses a 2×dx window to prevent double-counting.
 */
export function findZeros(
  expr: CompiledExpression,
  xMin: number,
  xMax: number,
  steps = SCAN_STEPS,
  scope?: Record<string, number>,
): FeaturePoint[] {
  const results: FeaturePoint[] = [];
  const dx  = (xMax - xMin) / steps;
  const f   = (x: number) => evaluateAt(expr, x, scope);
  let prev  = f(xMin);

  for (let i = 1; i <= steps; i++) {
    const x    = xMin + i * dx;
    const curr = f(x);

    if (!isFinite(prev) || !isFinite(curr)) {
      prev = curr;
      continue;
    }

    // Sign change → refine via bisection
    if (prev * curr < 0) {
      const xZero = bisect(f, x - dx, x);
      const yZero = f(xZero);
      if (isFinite(yZero) && Math.abs(yZero) < 1e-6) {
        results.push({ x: xZero, y: 0, type: 'zero' });
      }
    }

    // Point lands exactly on zero (e.g. sin(π) with floating-point rounding)
    if (Math.abs(curr) < 1e-9 && Math.abs(prev) > 1e-9) {
      const isDuplicate = results.some((p) => Math.abs(p.x - x) < dx * 2);
      if (!isDuplicate) {
        results.push({ x, y: 0, type: 'zero' });
      }
    }

    prev = curr;
  }
  return results;
}

// ─── Extrema Finder ──────────────────────────────────────────────────────────

/**
 * Scan for local maxima and minima of `expr` in [xMin, xMax].
 * Detected via sign changes in f′(x) (numerical central difference).
 *
 *   f′ changes + → −  →  local maximum
 *   f′ changes − → +  →  local minimum
 */
export function findExtrema(
  expr: CompiledExpression,
  xMin: number,
  xMax: number,
  steps = SCAN_STEPS,
  scope?: Record<string, number>,
): FeaturePoint[] {
  const results: FeaturePoint[] = [];
  const dx   = (xMax - xMin) / steps;
  const df   = (x: number) => numericalDerivative(expr, x, scope);
  let prevD  = df(xMin);

  for (let i = 1; i <= steps; i++) {
    const x     = xMin + i * dx;
    const currD = df(x);

    if (!isFinite(prevD) || !isFinite(currD)) {
      prevD = currD;
      continue;
    }

    if (prevD * currD < 0) {
      const xExt = bisect(df, x - dx, x);
      const y    = evaluateAt(expr, xExt, scope);
      if (!isFinite(y)) {
        prevD = currD;
        continue;
      }
      const type: FeaturePointType = prevD > 0 ? 'localMax' : 'localMin';
      results.push({ x: xExt, y, type });
    }

    prevD = currD;
  }
  return results;
}

// ─── Inflection Finder ───────────────────────────────────────────────────────

/**
 * Scan for inflection points of `expr` in [xMin, xMax].
 * Detected via sign changes in f″(x) (central difference on f′).
 */
export function findInflections(
  expr: CompiledExpression,
  xMin: number,
  xMax: number,
  steps = SCAN_STEPS,
  scope?: Record<string, number>,
): FeaturePoint[] {
  const results: FeaturePoint[] = [];
  const dx = (xMax - xMin) / steps;

  const d2f = (x: number): number => {
    const yp = numericalDerivative(expr, x + D2_H, scope);
    const ym = numericalDerivative(expr, x - D2_H, scope);
    if (!isFinite(yp) || !isFinite(ym)) return NaN;
    return (yp - ym) / (2 * D2_H);
  };

  let prevD2 = d2f(xMin);

  for (let i = 1; i <= steps; i++) {
    const x      = xMin + i * dx;
    const currD2 = d2f(x);

    if (!isFinite(prevD2) || !isFinite(currD2)) {
      prevD2 = currD2;
      continue;
    }

    if (prevD2 * currD2 < 0) {
      const xInfl = bisect(d2f, x - dx, x);
      const y     = evaluateAt(expr, xInfl, scope);
      if (isFinite(y)) {
        results.push({ x: xInfl, y, type: 'inflection' });
      }
    }

    prevD2 = currD2;
  }
  return results;
}

// ─── Unified Entry Point ─────────────────────────────────────────────────────

/**
 * Run all three scanners and return a combined, sorted result set.
 * Used by Phase 5 feature-point rendering.
 */
export function scanFeaturePoints(
  expr: CompiledExpression,
  xMin: number,
  xMax: number,
  scope?: Record<string, number>,
): FeaturePoint[] {
  return [
    ...findZeros(expr, xMin, xMax, SCAN_STEPS, scope),
    ...findExtrema(expr, xMin, xMax, SCAN_STEPS, scope),
    ...findInflections(expr, xMin, xMax, SCAN_STEPS, scope),
  ].sort((a, b) => a.x - b.x);
}
