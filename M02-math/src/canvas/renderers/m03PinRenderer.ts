/**
 * Renders pinned curve points and pinned intersection points on the M03 static canvas.
 */

import type { Viewport } from '@/canvas/Viewport';
import type { AnyEntity } from '@/types';
import type { M03PinnedPoint, M03PinnedIntersection } from '@/editor/store/m03InteractionStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function renderCoordinatePill(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  text: string,
  accentColor: string,
): void {
  ctx.font = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  const tw = ctx.measureText(text).width;
  const pw = tw + 10;
  const ph = 16;
  const px = cx - pw / 2;
  const py = cy - ph - 12;

  // Background pill
  ctx.fillStyle = 'rgba(14, 14, 18, 0.85)';
  roundRect(ctx, px, py, pw, ph, 4);
  ctx.fill();

  // Border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 0.8;
  roundRect(ctx, px, py, pw, ph, 4);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#E8E8EE';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, py + ph / 2);
}

// ─── Curve pin rendering ─────────────────────────────────────────────────────

function renderCurvePin(
  ctx: CanvasRenderingContext2D,
  pin: M03PinnedPoint,
  viewport: Viewport,
  color: string,
): void {
  const [px, py] = viewport.toCanvas(pin.mathX, pin.mathY);

  ctx.save();

  // Outer ring (entity color)
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, 2 * Math.PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Filled dot
  ctx.beginPath();
  ctx.arc(px, py, 3.5, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  // Label
  ctx.font = '700 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(pin.label, px + 10, py - 4);

  // Coordinate pill
  const coordText = `(${pin.mathX.toFixed(2)}, ${pin.mathY.toFixed(2)})`;
  renderCoordinatePill(ctx, px, py, coordText, color);

  ctx.restore();
}

// ─── Intersection pin rendering ──────────────────────────────────────────────

function renderIntersectionPin(
  ctx: CanvasRenderingContext2D,
  pin: M03PinnedIntersection,
  viewport: Viewport,
  lineColor: string,
  conicColor: string,
): void {
  const [px, py] = viewport.toCanvas(pin.mathX, pin.mathY);

  ctx.save();

  // Outer ring (line color)
  ctx.beginPath();
  ctx.arc(px, py, 8, 0, 2 * Math.PI);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner ring (conic color)
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, 2 * Math.PI);
  ctx.strokeStyle = conicColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Amber crosshair
  const ch = 4;
  ctx.beginPath();
  ctx.moveTo(px - ch, py);
  ctx.lineTo(px + ch, py);
  ctx.moveTo(px, py - ch);
  ctx.lineTo(px, py + ch);
  ctx.strokeStyle = '#FBBF24';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label
  ctx.font = '700 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
  ctx.fillStyle = '#FBBF24';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(pin.label, px + 10, py - 4);

  // Coordinate pill
  const coordText = `(${pin.mathX.toFixed(2)}, ${pin.mathY.toFixed(2)})`;
  renderCoordinatePill(ctx, px, py, coordText, '#FBBF24');

  ctx.restore();
}

// ─── Public entry ────────────────────────────────────────────────────────────

export function renderM03Pins(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  entities: AnyEntity[],
  pinnedPoints: M03PinnedPoint[],
  pinnedIntersections: M03PinnedIntersection[],
): void {
  // Build color lookup
  const colorMap = new Map<string, string>();
  for (const e of entities) {
    colorMap.set(e.id, e.color);
  }

  // Render curve pins
  for (const pin of pinnedPoints) {
    const color = colorMap.get(pin.entityId) ?? '#9CA3AF';
    renderCurvePin(ctx, pin, viewport, color);
  }

  // Render intersection pins
  for (const pin of pinnedIntersections) {
    const lineColor  = colorMap.get(pin.lineId)  ?? '#9CA3AF';
    const conicColor = colorMap.get(pin.conicId) ?? '#9CA3AF';
    renderIntersectionPin(ctx, pin, viewport, lineColor, conicColor);
  }
}
