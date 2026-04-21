/**
 * Renders a LineEntity, chord visualization, focal triangles, area shading,
 * dual |AF|/|BF| labels, and intersection dots with anti-overlap positioning.
 *
 * renderLine               — dashed stroke + equation label near right edge.
 * renderChord              — double-headed red arrow between A and B, with
 *                            |AB| mid-label (exact radical form when possible).
 * renderFocalTriangle      — semi-transparent triangle △F₂AB (other focus + chord).
 * renderFocalDistanceLabels — |AF| and |BF| labels on chord segments.
 * renderLatusRectumHighlight — bright highlight when chord is the latus rectum.
 * renderAreaShading        — shade the region between the chord and conic arc.
 * renderIntersectionPoints — large red dots with dynamic anti-overlap coordinate pills.
 */

import type { Viewport } from '@/canvas/Viewport';
import type { LineEntity, ConicEntity } from '@/types';
import type { IntersectionResult } from '@/engine/intersectionEngine';
import { toRadicalForm } from '@/engine/radicalEngine';
import { sampleConicEntity } from '@/engine/parametricSampler';

const INTERSECTION_RED = '#EF4444';
const FOCAL_TRIANGLE_FILL = 'rgba(251, 191, 36, 0.12)';
const FOCAL_TRIANGLE_STROKE = 'rgba(251, 191, 36, 0.50)';
const LATUS_RECTUM_COLOR = '#F59E0B';
const AREA_SHADE_FILL = 'rgba(50, 213, 131, 0.08)';
const AREA_SHADE_STROKE = 'rgba(50, 213, 131, 0.25)';

// ─── Line stroke ──────────────────────────────────────────────────────────────

export function renderLine(
  ctx:      CanvasRenderingContext2D,
  line:     LineEntity,
  viewport: Viewport,
): void {
  if (!line.visible) return;

  let x1: number, y1: number, x2: number, y2: number;

  if (line.params.vertical) {
    const x = line.params.x;
    x1 = x2 = x;
    y1 = viewport.yMin - 1;
    y2 = viewport.yMax + 1;
  } else {
    const { k, b } = line.params;
    x1 = viewport.xMin - 1;
    y1 = k * x1 + b;
    x2 = viewport.xMax + 1;
    y2 = k * x2 + b;
  }

  const [cx1, cy1] = viewport.toCanvas(x1, y1);
  const [cx2, cy2] = viewport.toCanvas(x2, y2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx1, cy1);
  ctx.lineTo(cx2, cy2);
  ctx.strokeStyle = line.color;
  ctx.lineWidth   = 2;
  ctx.setLineDash([8, 5]);
  ctx.stroke();

  renderLineLabel(ctx, line, viewport);
  ctx.restore();
}

function renderLineLabel(
  ctx:      CanvasRenderingContext2D,
  line:     LineEntity,
  viewport: Viewport,
): void {
  const FONT = '600 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
  const PAD  = 5;

  let label: string;
  if (line.params.vertical) {
    label = `x = ${fmtNum(line.params.x)}`;
  } else {
    const { k, b } = line.params;
    let kStr: string;
    if (Math.abs(k) < 1e-9)        kStr = '';
    else if (Math.abs(k - 1) < 1e-9) kStr = 'x';
    else if (Math.abs(k + 1) < 1e-9) kStr = '\u2212x';
    else                              kStr = `${fmtNum(k)}x`;

    let bStr: string;
    if (Math.abs(b) < 1e-9 && kStr !== '') {
      bStr = '';
    } else if (kStr === '') {
      bStr = fmtNum(b);
    } else {
      bStr = b >= 0 ? ` + ${fmtNum(b)}` : ` \u2212 ${fmtNum(Math.abs(b))}`;
    }

    label = `y = ${kStr}${bStr}`;
  }

  const anchorMathX = viewport.xMax - viewport.xRange * 0.05;
  const anchorMathY = line.params.vertical
    ? viewport.yMax - viewport.yRange * 0.08
    : line.params.k * anchorMathX + line.params.b;

  const [ax, ay] = viewport.toCanvas(anchorMathX, anchorMathY);

  ctx.font = FONT;
  const tw  = ctx.measureText(label).width;
  const bx  = ax - tw - PAD * 2;
  const by  = ay - 14;

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(bx, by, tw + PAD * 2, 16, 3);
  ctx.fill();

  ctx.fillStyle    = line.color;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + PAD, by + 8);
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// ─── Chord double-arrow ───────────────────────────────────────────────────────

/**
 * Draw a double-headed red arrow between the two intersection points, plus a
 * |AB| label (exact radical form when possible) offset perpendicular to chord.
 * Call this BEFORE renderIntersectionPoints so the dots appear on top.
 */
export function renderChord(
  ctx:      CanvasRenderingContext2D,
  result:   IntersectionResult,
  viewport: Viewport,
): void {
  if (result.pts.length < 2 || result.chordLength === null) return;

  const [[mx1, my1], [mx2, my2]] = result.pts;
  const [cx1, cy1] = viewport.toCanvas(mx1, my1);
  const [cx2, cy2] = viewport.toCanvas(mx2, my2);

  const angle  = Math.atan2(cy2 - cy1, cx2 - cx1);
  const ARROW  = 9;
  const cosA   = Math.cos(angle);
  const sinA   = Math.sin(angle);
  const margin = ARROW + 1;

  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = INTERSECTION_RED;
  ctx.fillStyle   = INTERSECTION_RED;
  ctx.lineWidth   = 2;

  // Chord segment between the two arrowheads
  ctx.beginPath();
  ctx.moveTo(cx1 + cosA * margin, cy1 + sinA * margin);
  ctx.lineTo(cx2 - cosA * margin, cy2 - sinA * margin);
  ctx.stroke();

  drawArrowhead(ctx, cx2, cy2, angle, ARROW);
  drawArrowhead(ctx, cx1, cy1, angle + Math.PI, ARROW);

  // ── |AB| label ────────────────────────────────────────────────────────────
  const radStr = toRadicalForm(result.chordLength);
  const numStr = result.chordLength.toFixed(4);
  const label  = radStr
    ? `|AB| = ${radStr} \u2248 ${numStr}`
    : `|AB| = ${numStr}`;

  const midCx = (cx1 + cx2) / 2;
  const midCy = (cy1 + cy2) / 2;

  // Offset perpendicular to the chord so the label doesn't overlap it
  const perpX = -sinA * 20;
  const perpY =  cosA * 20;

  ctx.font = '700 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
  const tw  = ctx.measureText(label).width;
  const PAD = 5;
  const lx  = midCx + perpX - tw / 2 - PAD;
  const ly  = midCy + perpY - 9;

  ctx.fillStyle   = 'rgba(255,255,255,0.94)';
  ctx.strokeStyle = INTERSECTION_RED;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(lx, ly, tw + PAD * 2, 18, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle    = INTERSECTION_RED;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx + PAD, ly + 9);

  ctx.restore();
}

function drawArrowhead(
  ctx:   CanvasRenderingContext2D,
  x:     number,
  y:     number,
  angle: number,
  size:  number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size / 2.5);
  ctx.lineTo(-size,  size / 2.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─── Focal triangle rendering ─────────────────────────────────────────────────

/**
 * Render the focal triangle △F₂AB (or △F₁AB) as a semi-transparent filled
 * polygon when the chord passes through a focus of an ellipse/hyperbola.
 */
export function renderFocalTriangle(
  ctx:      CanvasRenderingContext2D,
  result:   IntersectionResult,
  viewport: Viewport,
): void {
  if (
    result.pts.length < 2 ||
    !result.otherFocalPoint ||
    result.focalTriangleArea === null
  ) return;

  const [A, B] = result.pts;
  const F = result.otherFocalPoint;

  const [ax, ay] = viewport.toCanvas(A[0], A[1]);
  const [bx, by] = viewport.toCanvas(B[0], B[1]);
  const [fx, fy] = viewport.toCanvas(F[0], F[1]);

  ctx.save();
  ctx.setLineDash([]);

  // Fill
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(fx, fy);
  ctx.closePath();
  ctx.fillStyle = FOCAL_TRIANGLE_FILL;
  ctx.fill();

  // Stroke
  ctx.strokeStyle = FOCAL_TRIANGLE_STROKE;
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Area label at centroid
  const centroidCx = (ax + bx + fx) / 3;
  const centroidCy = (ay + by + fy) / 3;
  const areaStr    = result.focalTriangleArea.toFixed(2);
  const otherLabel = result.focalLabel === 'F\u2081' ? 'F\u2082' : 'F\u2081';
  const triLabel   = `S\u25b3${otherLabel}AB = ${areaStr}`;

  ctx.font = '700 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  const tw  = ctx.measureText(triLabel).width;
  const PAD = 4;
  const tlx = centroidCx - tw / 2 - PAD;
  const tly = centroidCy - 7;

  ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
  ctx.beginPath();
  ctx.roundRect(tlx, tly, tw + PAD * 2, 14, 3);
  ctx.fill();

  ctx.fillStyle    = '#B45309';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(triLabel, tlx + PAD, tly + 7);

  ctx.restore();
}

// ─── Focal distance labels (|AF|, |BF|) ──────────────────────────────────────

/**
 * Render |AF| and |BF| distance labels at the midpoint of each segment
 * from an intersection point to the focal point.
 */
export function renderFocalDistanceLabels(
  ctx:      CanvasRenderingContext2D,
  result:   IntersectionResult,
  viewport: Viewport,
): void {
  if (
    result.pts.length < 2 ||
    !result.focalPoint ||
    !result.focalDistances
  ) return;

  const [A, B] = result.pts;
  const F = result.focalPoint;
  const [dAF, dBF] = result.focalDistances;
  const fLabel = result.focalLabel ?? 'F';

  const labels = ['A', 'B'];
  const points = [A, B];
  const dists  = [dAF, dBF];

  ctx.save();
  ctx.setLineDash([]);

  for (let i = 0; i < 2; i++) {
    const P = points[i];
    const dist = dists[i];
    const letter = labels[i];

    const [px, py] = viewport.toCanvas(P[0], P[1]);
    const [fx, fy] = viewport.toCanvas(F[0], F[1]);

    // Midpoint of segment PF
    const midX = (px + fx) / 2;
    const midY = (py + fy) / 2;

    // Perpendicular offset
    const segAngle = Math.atan2(fy - py, fx - px);
    const offX = -Math.sin(segAngle) * 14;
    const offY =  Math.cos(segAngle) * 14;

    const radStr = toRadicalForm(dist);
    const text = `|${letter}${fLabel}| = ${radStr ?? dist.toFixed(2)}`;

    ctx.font = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
    const tw  = ctx.measureText(text).width;
    const PAD = 3;
    const lx  = midX + offX - tw / 2 - PAD;
    const ly  = midY + offY - 6;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
    ctx.beginPath();
    ctx.roundRect(lx, ly, tw + PAD * 2, 13, 3);
    ctx.fill();

    ctx.fillStyle    = '#D97706';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, lx + PAD, ly + 6.5);
  }

  ctx.restore();
}

// ─── Latus rectum highlight ───────────────────────────────────────────────────

/**
 * When the chord is the latus rectum (通径), draw a bright highlight and label.
 */
export function renderLatusRectumHighlight(
  ctx:      CanvasRenderingContext2D,
  result:   IntersectionResult,
  viewport: Viewport,
): void {
  if (!result.isLatusRectum || result.pts.length < 2) return;

  const [[mx1, my1], [mx2, my2]] = result.pts;
  const [cx1, cy1] = viewport.toCanvas(mx1, my1);
  const [cx2, cy2] = viewport.toCanvas(mx2, my2);

  ctx.save();
  ctx.setLineDash([]);

  // Bright overlay stroke on the chord
  ctx.beginPath();
  ctx.moveTo(cx1, cy1);
  ctx.lineTo(cx2, cy2);
  ctx.strokeStyle = LATUS_RECTUM_COLOR;
  ctx.lineWidth   = 3.5;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Glow effect
  ctx.beginPath();
  ctx.moveTo(cx1, cy1);
  ctx.lineTo(cx2, cy2);
  ctx.strokeStyle = LATUS_RECTUM_COLOR;
  ctx.lineWidth   = 8;
  ctx.globalAlpha = 0.15;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Label pill at the midpoint
  const midCx = (cx1 + cx2) / 2;
  const midCy = (cy1 + cy2) / 2;
  const label = '\u901a\u5f84 (Latus Rectum)';

  ctx.font = '700 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  const tw  = ctx.measureText(label).width;
  const PAD = 5;
  const lx  = midCx - tw / 2 - PAD;
  const ly  = midCy - 30;

  // Bright pill background
  ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
  ctx.strokeStyle = LATUS_RECTUM_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(lx, ly, tw + PAD * 2, 16, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle    = '#92400E';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx + PAD, ly + 8);

  ctx.restore();
}

// ─── Area shading between chord and conic arc ─────────────────────────────────

/**
 * Shade the region between the chord AB and the conic arc.
 * Uses parametric samples clipped to the chord x-range.
 */
export function renderAreaShading(
  ctx:      CanvasRenderingContext2D,
  result:   IntersectionResult,
  conic:    ConicEntity,
  viewport: Viewport,
): void {
  if (result.pts.length < 2) return;

  const [A, B] = result.pts;

  // Get parametric samples for the conic
  const samples = sampleConicEntity(conic, viewport, 400);
  const allPts = Array.isArray(samples) ? samples : [...samples.right, ...samples.left];

  // Find arc points between A and B (within the chord x-range)
  const xLo = Math.min(A[0], B[0]);
  const xHi = Math.max(A[0], B[0]);

  // For each sample, determine if it's "between" A and B on the line side
  // We shade the region closest to the line (smallest region)
  const arcPoints: [number, number][] = [];

  for (const sp of allPts) {
    if (sp.isBreak) continue;
    if (sp.x < xLo - 0.1 || sp.x > xHi + 0.1) continue;
    arcPoints.push([sp.x, sp.y]);
  }

  if (arcPoints.length < 2) return;

  // Sort arc points by x
  arcPoints.sort((a, b) => a[0] - b[0]);

  // Determine which side of the line the arc is on
  // Use the midpoint of the arc to decide
  const arcMidIdx = Math.floor(arcPoints.length / 2);
  const arcMid = arcPoints[arcMidIdx];

  // Line equation for chord: from A to B
  const chordDx = B[0] - A[0];
  const chordDy = B[1] - A[1];

  // Cross product to determine side
  const cross = chordDx * (arcMid[1] - A[1]) - chordDy * (arcMid[0] - A[0]);

  // Filter arc points to only include those on the same side as the majority
  const filtered = arcPoints.filter(([px, py]) => {
    const c = chordDx * (py - A[1]) - chordDy * (px - A[0]);
    return c * cross >= 0;
  });

  if (filtered.length < 2) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();

  // Start from intersection point A, trace along the arc, then back via chord
  const [startCx, startCy] = viewport.toCanvas(A[0], A[1]);
  ctx.moveTo(startCx, startCy);

  for (const [px, py] of filtered) {
    const [cpx, cpy] = viewport.toCanvas(px, py);
    ctx.lineTo(cpx, cpy);
  }

  const [endCx, endCy] = viewport.toCanvas(B[0], B[1]);
  ctx.lineTo(endCx, endCy);
  ctx.closePath();

  ctx.fillStyle = AREA_SHADE_FILL;
  ctx.fill();

  ctx.strokeStyle = AREA_SHADE_STROKE;
  ctx.lineWidth   = 1;
  ctx.stroke();

  ctx.restore();
}

// ─── Intersection dots + coordinate labels ────────────────────────────────────

/**
 * Render intersection points as large red dots with:
 *   • Translucent glow halo
 *   • Solid red dot with white border
 *   • Bold letter (A, B, …)
 *   • Coordinate pill dynamically positioned to avoid the conic curve
 */
export function renderIntersectionPoints(
  ctx:        CanvasRenderingContext2D,
  result:     IntersectionResult,
  _lineColor: string,
  viewport:   Viewport,
  conic?:     ConicEntity,
): void {
  const LABELS = ['A', 'B', 'C', 'D'];

  result.pts.forEach(([mx, my], i) => {
    const [cx, cy] = viewport.toCanvas(mx, my);
    const letter   = LABELS[i] ?? String.fromCharCode(65 + i);

    // Glow halo
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(239,68,68,0.20)';
    ctx.fill();

    // Solid dot
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fillStyle   = INTERSECTION_RED;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Bold letter — placed away from conic curve
    const labelOffset = computeLabelOffset(mx, my, conic);

    ctx.font         = 'bold 13px monospace';
    ctx.fillStyle    = INTERSECTION_RED;
    ctx.textAlign    = labelOffset.ox > 0 ? 'left' : 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(letter, cx + labelOffset.ox, cy + labelOffset.oy);

    // Coordinate pill — offset further in the same direction
    const coord = `(${mx.toFixed(2)}, ${my.toFixed(2)})`;
    ctx.font = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
    const tw  = ctx.measureText(coord).width;
    const PAD = 3;
    const px  = cx + labelOffset.ox + (labelOffset.ox > 0 ? 0 : -tw - PAD * 2);
    const py  = cy + labelOffset.oy + 3;

    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.beginPath();
    ctx.roundRect(px, py, tw + PAD * 2, 14, 3);
    ctx.fill();

    ctx.fillStyle    = '#374151';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(coord, px + PAD, py + 2);
  });
}

/**
 * Compute a label offset that avoids overlapping the conic curve.
 * Tests 4 candidate positions (right, left, above-right, below-right)
 * and picks the one furthest from the conic surface at that location.
 */
function computeLabelOffset(
  mx: number, my: number,
  conic: ConicEntity | undefined,
): { ox: number; oy: number } {
  if (!conic) return { ox: 8, oy: 0 };

  // Compute the gradient of the conic at (mx, my) to find the normal direction
  const dx = numericGradientX(conic, mx, my);
  const dy = numericGradientY(conic, mx, my);

  // Place label in the direction of the outward normal (away from curve)
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag < 1e-10) return { ox: 8, oy: 0 };

  // Normalize and scale to pixel offset
  const scale = 10;
  const ox = (dx / mag) * scale;
  const oy = -(dy / mag) * scale; // flip Y for canvas

  // Ensure minimum offset magnitude
  const minOff = 8;
  return {
    ox: Math.abs(ox) < minOff ? (ox >= 0 ? minOff : -minOff) : ox,
    oy: Math.abs(oy) < minOff ? (oy >= 0 ? 4 : -4) : oy,
  };
}

/** Numerical gradient ∂F/∂x of the implicit conic equation F(x,y) = 0. */
function numericGradientX(conic: ConicEntity, x: number, y: number): number {
  const h = 1e-5;
  return (implicitValue(conic, x + h, y) - implicitValue(conic, x - h, y)) / (2 * h);
}

/** Numerical gradient ∂F/∂y of the implicit conic equation F(x,y) = 0. */
function numericGradientY(conic: ConicEntity, x: number, y: number): number {
  const h = 1e-5;
  return (implicitValue(conic, x, y + h) - implicitValue(conic, x, y - h)) / (2 * h);
}

/** Evaluate the implicit equation F(x,y) for a conic (F=0 on the curve). */
function implicitValue(conic: ConicEntity, x: number, y: number): number {
  switch (conic.type) {
    case 'ellipse': {
      const { a, b, cx, cy } = conic.params;
      const X = x - cx, Y = y - cy;
      return X * X / (a * a) + Y * Y / (b * b) - 1;
    }
    case 'hyperbola': {
      const { a, b, cx, cy } = conic.params;
      const X = x - cx, Y = y - cy;
      return X * X / (a * a) - Y * Y / (b * b) - 1;
    }
    case 'parabola': {
      const { p, cx, cy, orientation = 'h' } = conic.params;
      const X = x - cx, Y = y - cy;
      return orientation === 'v'
        ? X * X - 2 * p * Y
        : Y * Y - 2 * p * X;
    }
    case 'circle': {
      const { r, cx, cy } = conic.params;
      const X = x - cx, Y = y - cy;
      return X * X + Y * Y - r * r;
    }
  }
}
