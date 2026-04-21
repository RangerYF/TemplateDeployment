/**
 * Renders the locus definition demo on the static canvas layer.
 *
 * Visual elements:
 *  - Trace dots: fading from oldest (alpha 0.15) to newest (alpha 1.0)
 *  - Current point P: 6px dot with glow ring + "P" label
 *  - Sum-of-distances preset: amber lines P→F₁ and P→F₂, distance label
 *  - Focus-directrix preset: solid P→F, dashed perpendicular P→directrix
 */

import type { Viewport } from '@/canvas/Viewport';
import type { ConicEntity } from '@/types';
import type { TracePoint, LocusPreset } from '@/editor/store/locusStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFoci(entity: ConicEntity): [number, number][] {
  switch (entity.type) {
    case 'ellipse':
    case 'hyperbola':
      return [...entity.derived.foci];
    case 'parabola':
      return [entity.derived.focus];
    case 'circle':
      return [[entity.params.cx, entity.params.cy]];
  }
}

function getDirectrixInfo(entity: ConicEntity): { x: number; isVertical: boolean } | null {
  switch (entity.type) {
    case 'parabola': {
      const isV = entity.derived.orientation === 'v';
      return { x: entity.derived.directrix, isVertical: !isV };
    }
    case 'ellipse':
      return { x: entity.derived.directrices[0], isVertical: true };
    case 'hyperbola':
      return { x: entity.derived.directrices[0], isVertical: true };
    default:
      return null;
  }
}

function distToPoint(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// ─── Trace dots ──────────────────────────────────────────────────────────────

function renderTraceDots(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  tracePoints: TracePoint[],
  color: string,
): void {
  const len = tracePoints.length;
  if (len === 0) return;

  for (let i = 0; i < len; i++) {
    const alpha = 0.15 + 0.85 * (i / Math.max(len - 1, 1));
    const [cx, cy] = viewport.toCanvas(tracePoints[i].x, tracePoints[i].y);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
    ctx.fillStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
    ctx.fill();
  }
}

// ─── Current point P ─────────────────────────────────────────────────────────

function renderCurrentPoint(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  pt: TracePoint,
  color: string,
): void {
  const [px, py] = viewport.toCanvas(pt.x, pt.y);

  // Glow ring
  ctx.beginPath();
  ctx.arc(px, py, 10, 0, 2 * Math.PI);
  ctx.fillStyle = color + '33';
  ctx.fill();

  // Solid dot
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // "P" label
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('P', px + 12, py - 6);
}

// ─── Sum-of-distances overlay ────────────────────────────────────────────────

function renderSumOfDistances(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  entity: ConicEntity,
  pt: TracePoint,
): void {
  if (entity.type !== 'ellipse' && entity.type !== 'hyperbola') return;

  const foci = entity.derived.foci;
  const [px, py] = viewport.toCanvas(pt.x, pt.y);

  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);

  // Amber lines P→F₁ and P→F₂
  const amberColor = 'rgba(251, 191, 36, 0.8)';
  ctx.strokeStyle = amberColor;

  for (const [fx, fy] of foci) {
    const [fpx, fpy] = viewport.toCanvas(fx, fy);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(fpx, fpy);
    ctx.stroke();
  }

  // Distance labels
  const r1 = distToPoint(pt.x, pt.y, foci[0][0], foci[0][1]);
  const r2 = distToPoint(pt.x, pt.y, foci[1][0], foci[1][1]);
  const a2 = 2 * entity.params.a;

  let labelText: string;
  if (entity.type === 'ellipse') {
    labelText = `r\u2081+r\u2082 = ${(r1 + r2).toFixed(2)}  (2a = ${a2.toFixed(2)})`;
  } else {
    labelText = `|r\u2081\u2212r\u2082| = ${Math.abs(r1 - r2).toFixed(2)}  (2a = ${a2.toFixed(2)})`;
  }

  ctx.font = '13px monospace';
  ctx.fillStyle = amberColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(labelText, px, py - 16);

  ctx.restore();
}

// ─── Focus-directrix overlay ─────────────────────────────────────────────────

function renderFocusDirectrix(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  entity: ConicEntity,
  pt: TracePoint,
): void {
  if (entity.type === 'circle') return;

  const foci = getFoci(entity);
  if (foci.length === 0) return;

  // Use the nearer focus
  let nearF = foci[0];
  if (foci.length > 1) {
    const d0 = distToPoint(pt.x, pt.y, foci[0][0], foci[0][1]);
    const d1 = distToPoint(pt.x, pt.y, foci[1][0], foci[1][1]);
    if (d1 < d0) nearF = foci[1];
  }

  const dirInfo = getDirectrixInfo(entity);
  if (!dirInfo) return;

  const [px, py] = viewport.toCanvas(pt.x, pt.y);
  const [fpx, fpy] = viewport.toCanvas(nearF[0], nearF[1]);

  ctx.save();

  // Solid line P→F
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(fpx, fpy);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();

  // Dashed perpendicular P→directrix
  let footX: number, footY: number;
  if (dirInfo.isVertical) {
    footX = dirInfo.x;
    footY = pt.y;
  } else {
    footX = pt.x;
    footY = dirInfo.x;
  }

  const [dpx, dpy] = viewport.toCanvas(footX, footY);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(dpx, dpy);
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();

  // Small perpendicular corner mark at the foot
  ctx.setLineDash([]);
  const markSize = 5;
  if (dirInfo.isVertical) {
    const dir = footX < pt.x ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(dpx, dpy - markSize);
    ctx.lineTo(dpx + dir * markSize, dpy - markSize);
    ctx.lineTo(dpx + dir * markSize, dpy);
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Distance label
  const distF = distToPoint(pt.x, pt.y, nearF[0], nearF[1]);
  const distD = dirInfo.isVertical
    ? Math.abs(pt.x - dirInfo.x)
    : Math.abs(pt.y - dirInfo.x);
  const ratio = distD > 1e-8 ? distF / distD : 0;

  let eValue: number;
  if (entity.type === 'parabola') eValue = 1;
  else if (entity.type === 'ellipse') eValue = entity.derived.e;
  else eValue = entity.derived.e;

  const labelText = `d(P,F)/d(P,L) = ${ratio.toFixed(3)}  (e = ${eValue.toFixed(3)})`;
  ctx.font = '13px monospace';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(labelText, px, py - 16);

  ctx.restore();
}

// ─── Public entry ────────────────────────────────────────────────────────────

export function renderLocusDemo(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  entity: ConicEntity,
  preset: LocusPreset,
  currentPoint: TracePoint | null,
  tracePoints: TracePoint[],
): void {
  ctx.save();

  // Trace dots
  renderTraceDots(ctx, viewport, tracePoints, entity.color);

  // Current point + overlay
  if (currentPoint) {
    if (preset === 'sum-of-distances') {
      renderSumOfDistances(ctx, viewport, entity, currentPoint);
    } else if (preset === 'focus-directrix') {
      renderFocusDirectrix(ctx, viewport, entity, currentPoint);
    }
    renderCurrentPoint(ctx, viewport, currentPoint, entity.color);
  }

  ctx.restore();
}
