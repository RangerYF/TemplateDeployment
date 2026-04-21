import type { Viewport } from '@/canvas/Viewport';
import type { PiecewiseSegment } from '@/types';
import {
  compileExpression,
  isParseError,
  evaluateAt,
} from '@/engine/expressionEngine';

// ─── Domain check ────────────────────────────────────────────────────────────

/**
 * Returns true if x falls within the segment's domain, respecting
 * inclusive/exclusive endpoints and null (= ±∞) bounds.
 */
function inDomain(seg: PiecewiseSegment, x: number): boolean {
  const { xMin, xMax, xMinInclusive, xMaxInclusive } = seg.domain;
  const leftOk  = xMin === null ? true : xMinInclusive ? x >= xMin : x > xMin;
  const rightOk = xMax === null ? true : xMaxInclusive ? x <= xMax : x < xMax;
  return leftOk && rightOk;
}

// ─── Single-point evaluation ─────────────────────────────────────────────────

/**
 * Evaluate a piecewise function at a single x value.
 * Segments are checked in order; the first matching domain wins.
 * Returns null if no segment matches or the expression fails to evaluate.
 */
export function evaluatePiecewise(
  segments: PiecewiseSegment[],
  x: number,
): number | null {
  for (const seg of segments) {
    if (!inDomain(seg, x)) continue;
    const compiled = compileExpression(seg.exprStr);
    if (isParseError(compiled)) continue;
    const y = evaluateAt(compiled, x);
    return isFinite(y) ? y : null;
  }
  return null;
}

// ─── Range sampling ──────────────────────────────────────────────────────────

/**
 * Sample all segments across the viewport's x-range.
 * Each segment is sampled independently so the renderer can:
 *   - Draw each sub-curve as a separate path
 *   - Render the correct endpoint symbol (● included / ○ excluded)
 *
 * Points outside the segment's domain are skipped, so each returned
 * `points` array contains only in-domain samples.
 */
export function evaluatePiecewiseRange(
  segments: PiecewiseSegment[],
  viewport: Viewport,
  steps = 800,
): Array<{ segment: PiecewiseSegment; points: [number, number][] }> {
  const { xMin, xMax } = viewport;
  const dx = (xMax - xMin) / steps;

  return segments.map((seg) => {
    const compiled = compileExpression(seg.exprStr);
    const points: [number, number][] = [];

    if (isParseError(compiled)) return { segment: seg, points };

    for (let i = 0; i <= steps; i++) {
      const x = xMin + i * dx;
      if (!inDomain(seg, x)) continue;
      const y = evaluateAt(compiled, x);
      if (isFinite(y)) points.push([x, y]);
    }

    return { segment: seg, points };
  });
}
