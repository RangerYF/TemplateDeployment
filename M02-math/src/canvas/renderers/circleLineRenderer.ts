/**
 * Renders the circle-line relationship visualization:
 *  - Dashed perpendicular line from circle center to the nearest point on the line
 *  - Distance label "d = X.XXXX"
 *  - Status pill showing relationship (相交 / 相切 / 相离)
 */

import type { Viewport } from '@/canvas/Viewport';
import type { CircleEntity, LineEntity } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the foot of perpendicular from point (px, py) to a line.
 * Returns the closest point on the line.
 */
function footOfPerpendicular(
  px: number, py: number,
  line: LineEntity,
): [number, number] {
  if (line.params.vertical) {
    return [line.params.x, py];
  }
  const { k, b } = line.params;
  // Foot of perpendicular from (px, py) to y = kx + b
  // x_foot = (px + k*(py - b)) / (1 + k²)
  // y_foot = k * x_foot + b
  const denom = 1 + k * k;
  const xf = (px + k * (py - b)) / denom;
  const yf = k * xf + b;
  return [xf, yf];
}

/** Distance from point to line. */
function distPointToLine(
  px: number, py: number,
  line: LineEntity,
): number {
  if (line.params.vertical) return Math.abs(px - line.params.x);
  const { k, b } = line.params;
  return Math.abs(py - k * px - b) / Math.sqrt(1 + k * k);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Relationship classification ─────────────────────────────────────────────

export type CircleLineRelation = '相交' | '相切' | '相离';

export function classifyCircleLine(d: number, r: number): CircleLineRelation {
  if (Math.abs(d - r) < 1e-4) return '相切';
  return d < r ? '相交' : '相离';
}

const RELATION_COLORS: Record<CircleLineRelation, string> = {
  '相交': '#32D583',  // green
  '相切': '#FBBF24',  // amber
  '相离': '#EF4444',  // red
};

// ─── Renderer ────────────────────────────────────────────────────────────────

/**
 * Render the d-line from circle center to the active line,
 * with distance label and right-angle marker.
 */
export function renderCircleLineDist(
  ctx: CanvasRenderingContext2D,
  circle: CircleEntity,
  line: LineEntity,
  viewport: Viewport,
): void {
  const { cx, cy } = circle.params;
  const d = distPointToLine(cx, cy, line);
  const [fx, fy] = footOfPerpendicular(cx, cy, line);
  const relation = classifyCircleLine(d, circle.params.r);
  const color = RELATION_COLORS[relation];

  const [ccx, ccy] = viewport.toCanvas(cx, cy);
  const [fcx, fcy] = viewport.toCanvas(fx, fy);

  ctx.save();

  // Dashed perpendicular line from center to foot
  ctx.beginPath();
  ctx.moveTo(ccx, ccy);
  ctx.lineTo(fcx, fcy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Right-angle marker at foot
  if (d > 1e-3) {
    const dx = ccx - fcx;
    const dy = ccy - fcy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 10) {
      const markSize = 6;
      // Unit vectors: along d-line and along the line
      const ux = dx / len;
      const uy = dy / len;
      // Perpendicular to d-line (along the line direction)
      const vx = -uy;
      const vy = ux;

      ctx.beginPath();
      ctx.moveTo(fcx + ux * markSize, fcy + uy * markSize);
      ctx.lineTo(fcx + ux * markSize + vx * markSize, fcy + uy * markSize + vy * markSize);
      ctx.lineTo(fcx + vx * markSize, fcy + vy * markSize);
      ctx.strokeStyle = color + 'AA';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Small dot at foot of perpendicular
  ctx.beginPath();
  ctx.arc(fcx, fcy, 3, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  // Distance label "d = X.XXXX" at midpoint of d-line
  const midCx = (ccx + fcx) / 2;
  const midCy = (ccy + fcy) / 2;

  const dText = `d = ${d.toFixed(4)}`;
  ctx.font = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  const tw = ctx.measureText(dText).width;
  const pillW = tw + 8;
  const pillH = 14;
  const pillX = midCx - pillW / 2;
  const pillY = midCy - pillH - 4;

  ctx.fillStyle = 'rgba(14, 14, 18, 0.80)';
  roundRect(ctx, pillX, pillY, pillW, pillH, 3);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  roundRect(ctx, pillX, pillY, pillW, pillH, 3);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(dText, midCx, pillY + pillH / 2);

  ctx.restore();
}
