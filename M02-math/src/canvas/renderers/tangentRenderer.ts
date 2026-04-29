import type { Viewport } from '@/canvas/Viewport';

/**
 * Render a tangent line + point + annotations on the dynamic canvas.
 *
 * @param ctx     Dynamic canvas context
 * @param x0      Tangent point — math x
 * @param y0      Tangent point — math y
 * @param slope   dy/dx at (x0, y0); NaN → point only; ±Infinity → vertical
 * @param viewport  Live viewport (used for math↔canvas conversion)
 * @param color   Function colour (hex string)
 */
export function renderTangent(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  slope: number,
  viewport: Viewport,
  color: string,
): void {
  const [cx, cy] = viewport.toCanvas(x0, y0);

  ctx.save();

  // ── 1. Tangent line ──────────────────────────────────────────────────────

  if (!isNaN(slope)) {
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();

    if (!isFinite(slope)) {
      // Vertical tangent line
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, ctx.canvas.height);
    } else if (Math.abs(slope) < 1e-10) {
      // Horizontal tangent line. Avoid dividing by a near-zero slope.
      const [cxL, cyL] = viewport.toCanvas(viewport.xMin, y0);
      const [cxR, cyR] = viewport.toCanvas(viewport.xMax, y0);
      ctx.moveTo(cxL, cyL);
      ctx.lineTo(cxR, cyR);
    } else {
      // y - y0 = slope*(x - x0)  →  x = (y - y0)/slope + x0
      // Compute canvas x at canvas y=0 and y=height
      const mathYTop    = viewport.yMax;
      const mathYBottom = viewport.yMin;
      const mathXLeft   = (mathYTop    - y0) / slope + x0;
      const mathXRight  = (mathYBottom - y0) / slope + x0;
      const [cxL, cyL]  = viewport.toCanvas(mathXLeft,  mathYTop);
      const [cxR, cyR]  = viewport.toCanvas(mathXRight, mathYBottom);
      ctx.moveTo(cxL, cyL);
      ctx.lineTo(cxR, cyR);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── 2. Tangent point circle ──────────────────────────────────────────────

  ctx.shadowBlur   = 12;
  ctx.shadowColor  = color;
  ctx.fillStyle    = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Dark border ring (visible on light canvas)
  ctx.strokeStyle = 'rgba(30, 30, 30, 0.3)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.stroke();

  // ── 3. Text annotations ──────────────────────────────────────────────────

  ctx.font      = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'left';

  // Slope label — top-right of point
  if (!isNaN(slope)) {
    const slopeStr = !isFinite(slope)
      ? 'k = ∞'
      : `k = ${slope.toFixed(3)}`;
    ctx.fillStyle = '#1F2937';
    ctx.fillText(slopeStr, cx + 10, cy - 14);
  }

  // Coord label — directly below point
  ctx.fillStyle = '#6B7280';
  ctx.fillText(`(${x0.toFixed(2)}, ${y0.toFixed(2)})`, cx + 10, cy + 18);

  ctx.restore();
}
