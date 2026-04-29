/**
 * Renderer for movable points on curves.
 *
 * Performance-optimized:
 *  - Pre-computed canvas coords in typed arrays
 *  - Single beginPath()/stroke() for trajectory (3 alpha bands)
 *  - parseColor cached per color string
 *  - Inline viewport transform where possible
 */

import type { Viewport } from '@/canvas/Viewport';
import type { MovablePointEntity } from '@/types';

interface TrajectoryPoint {
  x: number;
  y: number;
}

// ─── Color cache ─────────────────────────────────────────────────────────────

const _colorCache = new Map<string, [number, number, number]>();

function parseColor(color: string): [number, number, number] {
  let cached = _colorCache.get(color);
  if (cached) return cached;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    cached = hex.length === 3
      ? [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
      : [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  } else {
    cached = [50, 213, 131];
  }
  _colorCache.set(color, cached);
  return cached;
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export function renderMovablePoints(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  points: MovablePointEntity[],
  trajectories: Record<string, TrajectoryPoint[]>,
  activeEntityId?: string | null,
): void {
  for (const point of points) {
    if (!point.visible) continue;

    // Trajectory (behind everything)
    if (point.params.showTrajectory) {
      const trace = trajectories[point.id];
      if (trace && trace.length > 1) {
        renderGradientTrajectory(ctx, vp, trace, point.color);
      }
    }

    const [cx, cy] = vp.toCanvas(point.params.mathX, point.params.mathY);

    // Axis projections
    if (point.params.showProjections) {
      renderProjections(ctx, vp, point.params.mathX, point.params.mathY, cx, cy, point.color);
    }

    // Point dot with subtle shadow
    ctx.save();
    ctx.fillStyle = point.color;
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.shadowColor = point.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 6.2832);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    renderPointName(ctx, cx, cy, point.label ?? 'P', point.color);

    // Selection ring when active
    if (point.id === activeEntityId) {
      ctx.save();
      ctx.strokeStyle = '#32D583';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, 6.2832);
      ctx.stroke();
      ctx.restore();
    }

    if (point.id !== activeEntityId) continue;

    // Coordinate label for the active point only.
    const label = `(${point.params.mathX.toFixed(2)}, ${point.params.mathY.toFixed(2)})`;
    ctx.save();
    ctx.font = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.textBaseline = 'top';
    const tw = ctx.measureText(label).width;
    const rawX = cx + 10;
    const rawY = cy + 10;
    const lx = clamp(rawX, 8, vp.width - tw - 8);
    const ly = clamp(rawY, 8, vp.height - 20);

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.fillStyle = '#111827';
    ctx.strokeText(label, lx, ly);
    ctx.fillText(label, lx, ly);
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function renderPointName(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  label: string,
  color: string,
): void {
  ctx.save();
  ctx.font = '700 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = color;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  const text = label.length > 8 ? label.slice(0, 8) : label;
  const lx = cx + 9;
  const ly = cy - 7;
  ctx.strokeText(text, lx, ly);
  ctx.fillText(text, lx, ly);
  ctx.restore();
}

// ─── Axis projection lines ───────────────────────────────────────────────────

function renderProjections(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  mx: number, my: number,
  px: number, py: number,
  color: string,
): void {
  const [fxCx, fxCy] = vp.toCanvas(mx, 0);
  const [fyCx, fyCy] = vp.toCanvas(0, my);

  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = color + '55';

  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(fxCx, fxCy);
  ctx.moveTo(px, py);
  ctx.lineTo(fyCx, fyCy);
  ctx.stroke();

  ctx.setLineDash([]);

  // Foot dots
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(fxCx, fxCy, 3, 0, 6.2832);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(fyCx, fyCy, 3, 0, 6.2832);
  ctx.fill();

  // Foot labels — bold, larger, high-contrast
  ctx.globalAlpha = 1;
  ctx.font = '700 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  ctx.fillStyle = color;

  // x-foot: label below axis
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(mx.toFixed(2), fxCx, fxCy + 6);

  // y-foot: label left of axis
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(my.toFixed(2), fyCx - 7, fyCy);

  ctx.restore();
}

// ─── Gradient trajectory (3-band batched) ────────────────────────────────────

function renderGradientTrajectory(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  points: TrajectoryPoint[],
  color: string,
): void {
  const len = points.length;
  if (len < 2) return;

  const rgb = parseColor(color);

  // Pre-compute all canvas coords into flat typed arrays
  const vpXMin = vp.xMin;
  const vpYMin = vp.yMin;
  const scX = vp.width / vp.xRange;
  const scY = vp.height / vp.yRange;
  const vpH = vp.height;

  const cxArr = new Float64Array(len);
  const cyArr = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    cxArr[i] = (points[i].x - vpXMin) * scX;
    cyArr[i] = vpH - (points[i].y - vpYMin) * scY;
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const colorStr = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

  // 3 bands: tail (faint, thin), middle, head (bright, thick)
  const bands: [number, number, number, number][] = [
    [0,            len * 0.33, 0.12, 1.0],
    [len * 0.33,   len * 0.66, 0.4,  1.8],
    [len * 0.66,   len,        0.85, 2.5],
  ];

  for (const [startF, endF, alpha, width] of bands) {
    const start = Math.max(1, Math.floor(startF));
    const end = Math.min(len, Math.ceil(endF));
    if (start >= end) continue;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colorStr;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(cxArr[start - 1], cyArr[start - 1]);
    for (let i = start; i < end; i++) {
      ctx.lineTo(cxArr[i], cyArr[i]);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Snap preview (for MovablePointDragTool hover) ───────────────────────────

export function renderSnapPreview(
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  mx: number,
  my: number,
  color: string,
): void {
  const [cx, cy] = vp.toCanvas(mx, my);

  ctx.save();

  // Pulsing rings
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, 6.2832);
  ctx.stroke();

  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, 6.2832);
  ctx.stroke();

  // Center dot
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, 6.2832);
  ctx.fill();

  // Coordinate label — light card style
  const label = `(${mx.toFixed(2)}, ${my.toFixed(2)})`;
  ctx.globalAlpha = 1;
  ctx.font = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(label).width;
  const lx = Math.round(cx + 18);
  const ly = Math.round(cy - 18);
  const pw = tw + 12;
  const ph = 20;

  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(lx - 6, ly - ph / 2, pw, ph, 6);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = '#1A1A2E';
  ctx.fillText(label, lx, ly);

  ctx.restore();
}
