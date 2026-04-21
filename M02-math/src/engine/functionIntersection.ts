import type { FunctionEntry } from '@/types';
import { compileExpression, isParseError, evaluateAt } from '@/engine/expressionEngine';
import type { Viewport } from '@/canvas/Viewport';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FunctionIntersection {
  readonly mathX: number;
  readonly mathY: number;
  readonly fnId1: string;
  readonly fnId2: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Bisection: find x where h(x)=0 on [lo, hi] assuming h(lo)*h(hi) ≤ 0.
 * Runs up to `iters` iterations; converges to ~1e-12 in 40 steps.
 */
function bisect(
  h: (x: number) => number,
  lo: number,
  hi: number,
  iters = 40,
): number {
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    const hm  = h(mid);
    if (!isFinite(hm) || hm === 0) return mid;
    if (h(lo) * hm <= 0) hi = mid;
    else                  lo = mid;
  }
  return (lo + hi) / 2;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Find all intersection points of two standard-mode functions
 * within the viewport's x range.
 *
 * Algorithm:
 *  1. Sample h(x) = f1(x) − f2(x) at `steps` evenly-spaced points.
 *  2. Detect sign changes → guaranteed root between adjacent samples.
 *  3. Refine each root to ~1e-10 precision via bisection.
 *
 * Only works for `mode === 'standard'` functions (piecewise functions are
 * skipped by the caller). Non-finite h values are treated as gaps.
 */
/**
 * Fast single-point evaluator for a FunctionEntry using a pre-compiled expression.
 * Avoids repeated compileExpression lookups in tight loops.
 */
function makeFastEval(fn: FunctionEntry): ((x: number) => number) | null {
  const compiled = compileExpression(fn.exprStr);
  if (isParseError(compiled)) return null;

  const scope: Record<string, unknown> | undefined =
    fn.templateId === null && fn.namedParams.length > 0
      ? Object.fromEntries(fn.namedParams.map((p) => [p.name, p.value]))
      : undefined;

  const { a, b, h, k } = fn.transform;

  // Return a closure that skips the compile lookup per point
  return (mathX: number): number => {
    const xPrime = b * (mathX - h);
    const rawFx  = evaluateAt(compiled, xPrime, scope);
    if (!isFinite(rawFx)) return NaN;
    const y = a * rawFx + k;
    return isFinite(y) ? y : NaN;
  };
}

export function findFunctionIntersections(
  fn1: FunctionEntry,
  fn2: FunctionEntry,
  vp: Viewport,
  steps = 400,
): FunctionIntersection[] {
  const { xMin, xMax } = vp;
  const dx = (xMax - xMin) / steps;

  // Pre-compile both expressions once (not per sample point)
  const eval1 = makeFastEval(fn1);
  const eval2 = makeFastEval(fn2);
  if (!eval1 || !eval2) return [];

  // h(x) = f1(x) - f2(x); root ↔ intersection
  const h = (x: number): number => {
    const y1 = eval1(x);
    const y2 = eval2(x);
    if (!isFinite(y1) || !isFinite(y2)) return NaN;
    return y1 - y2;
  };

  const results: FunctionIntersection[] = [];
  let prevH = h(xMin);
  let prevX = xMin;

  for (let i = 1; i <= steps; i++) {
    const x     = xMin + i * dx;
    const currH = h(x);

    if (isFinite(prevH) && isFinite(currH) && prevH * currH < 0) {
      // Sign change → bisect to find the root
      const rootX = bisect(h, prevX, x);
      const y1    = eval1(rootX);
      if (isFinite(y1)) {
        // De-duplicate: skip if a root within 1e-6 already exists
        const isDup = results.some((r) => Math.abs(r.mathX - rootX) < 1e-6);
        if (!isDup) {
          results.push({ mathX: rootX, mathY: y1, fnId1: fn1.id, fnId2: fn2.id });
        }
      }
    }

    prevH = currH;
    prevX = x;
  }

  return results;
}

/**
 * Find all pairwise intersection points among all visible standard functions.
 * Time: O(n² · steps) — fast enough for n ≤ 5 at 400 steps.
 */
export function findAllIntersections(
  functions: FunctionEntry[],
  vp: Viewport,
): FunctionIntersection[] {
  const visible = functions.filter((f) => f.visible && f.mode === 'standard');
  const results: FunctionIntersection[] = [];

  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const pts = findFunctionIntersections(visible[i], visible[j], vp);
      results.push(...pts);
    }
  }

  return results;
}
