import type { Viewport } from '@/canvas/Viewport';
import type { PiecewiseSegment } from '@/types';
import { compileExpression, isParseError, evaluateAt } from '@/engine/expressionEngine';
import { COLORS } from '@/styles/colors';

/**
 * Render the endpoints of a single piecewise segment.
 *
 * Left endpoint  (xMin):
 *   - inclusive  → filled circle ●  (radius 4px, filled with color)
 *   - exclusive  → hollow circle ○  (radius 4px, stroke color, interior filled with COLORS.surface)
 *
 * Right endpoint (xMax):
 *   - same rules
 *
 * Endpoints at ±∞ (null) are skipped.
 * Endpoints outside the viewport x-range are skipped.
 * Endpoints whose y-value cannot be evaluated are skipped.
 */
export function renderSegmentEndpoints(
  ctx: CanvasRenderingContext2D,
  segment: PiecewiseSegment,
  viewport: Viewport,
  color: string,
): void {
  const compiled = compileExpression(segment.exprStr);
  if (isParseError(compiled)) return;

  const { xMin, xMax, xMinInclusive, xMaxInclusive } = segment.domain;

  const endpoints: Array<{ mathX: number; inclusive: boolean }> = [];
  if (xMin !== null) endpoints.push({ mathX: xMin, inclusive: xMinInclusive });
  if (xMax !== null) endpoints.push({ mathX: xMax, inclusive: xMaxInclusive });

  for (const { mathX, inclusive } of endpoints) {
    // Skip endpoints outside the visible viewport
    if (mathX < viewport.xMin || mathX > viewport.xMax) continue;

    const y = evaluateAt(compiled, mathX);
    if (!isFinite(y)) continue;
    if (y < viewport.yMin || y > viewport.yMax) continue;

    const [cx, cy] = viewport.toCanvas(mathX, y);
    const R = 4;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);

    if (inclusive) {
      // ● filled circle
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // ○ hollow circle
      ctx.fillStyle = COLORS.surface;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}
