import type { Viewport } from '@/canvas/Viewport';
import type { ParametricPoint } from '@/types';

/**
 * Render a `ParametricPoint[]` array as a 2D canvas path.
 *
 * Mirrors M02's `renderCurve` pen-lift logic:
 *  - `isBreak = true`  → `moveTo` (lift pen — reserved for future implicit sampler)
 *  - first point       → `moveTo`
 *  - subsequent points → `lineTo`
 *
 * Parametric curves (ellipse / parabola / circle) never set `isBreak`;
 * the field exists for forward-compatibility with `implicitSampler.ts` (Phase 8+).
 *
 * @param options.lineWidth  Stroke width in canvas pixels (default 2).
 * @param options.lineDash   Dash pattern — `[]` = solid (default).
 * @param options.alpha      Global alpha 0–1 (default 1).
 */
export function renderParametricCurve(
  ctx:      CanvasRenderingContext2D,
  points:   ParametricPoint[],
  viewport: Viewport,
  color:    string,
  options?: {
    lineWidth?: number;
    lineDash?:  number[];
    alpha?:     number;
  },
): void {
  if (points.length === 0) return;

  const lineWidth = options?.lineWidth ?? 2.5;
  const lineDash  = options?.lineDash  ?? [];
  const alpha     = options?.alpha     ?? 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.setLineDash(lineDash);

  ctx.beginPath();
  let penDown = false;

  for (const pt of points) {
    const [cx, cy] = viewport.toCanvas(pt.x, pt.y);

    if (!penDown || pt.isBreak) {
      ctx.moveTo(cx, cy);
      penDown = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }

  ctx.stroke();
  ctx.restore();
}
