/**
 * Renders the moving snap-point overlay on the dynamic canvas layer.
 *
 * Visual elements (all drawn on top of each other, in order):
 *  1. Tangent line at the snap point (optional — showTangent)
 *  2. Focal chord through the snap point (optional — showFocalChord)
 *  3. Dashed focal-radius lines to each focus (ellipse / hyperbola only)
 *  4. Glow ring + filled dot at the snapped position
 *  5. Info box: coordinate + focal distances r₁ / r₂ + relationship check
 */

import type { Viewport } from '@/canvas/Viewport';
import type { SnapResult } from '@/engine/nearestPoint';
import type { ConicEntity, ImplicitCurveEntity } from '@/types';
import { isConicEntity } from '@/types';
import { focalDistance } from '@/engine/conicAnalysis';

// ─── Public options ────────────────────────────────────────────────────────────

export interface CurvePointRenderOptions {
  showTangent:    boolean;
  showNormal:     boolean;
  showFocalChord: boolean;
}

// ─── Tangent line ─────────────────────────────────────────────────────────────

/**
 * Compute the analytical tangent direction at (sx, sy) on a parametric conic.
 *
 * All parametric forms use the same convention as parametricSampler.ts:
 *   Ellipse:   x = cx + a·cos θ,   y = cy + b·sin θ
 *   Hyperbola: x = cx ± a·cosh t,  y = cy + b·sinh t
 *   Parabola:  x = cx + t²/(2p),   y = cy + t
 *   Circle:    x = cx + r·cos θ,   y = cy + r·sin θ
 *
 * Returns null at degenerate cases (e.g. parabola vertex where t=0).
 */
function computeTangentDir(
  entity: ConicEntity | ImplicitCurveEntity,
  sx:     number,
  sy:     number,
): [number, number] | null {
  if (!isConicEntity(entity)) return null;
  switch (entity.type) {
    case 'ellipse': {
      const { a, b, cx, cy } = entity.params;
      const theta = Math.atan2((sy - cy) / b, (sx - cx) / a);
      return [-a * Math.sin(theta), b * Math.cos(theta)];
    }
    case 'hyperbola': {
      const { a, b, cx, cy } = entity.params;
      const t    = Math.asinh((sy - cy) / b);
      const sign = sx >= cx ? 1 : -1;
      return [sign * a * Math.sinh(t), b * Math.cosh(t)];
    }
    case 'parabola': {
      const { p, cx, cy, orientation = 'h' } = entity.params;
      if (orientation === 'v') {
        // x = cx+t, y = cy+t²/(2p) → direction [1, t/p] where t = sx−cx
        return [1, (sx - cx) / p];   // horizontal tangent at vertex is valid
      }
      const t = sy - cy;
      if (Math.abs(t) < 1e-10) return null;   // vertex — tangent is vertical
      return [t / p, 1];
    }
    case 'circle': {
      const { r, cx, cy } = entity.params;
      const theta = Math.atan2((sy - cy) / r, (sx - cx) / r);
      return [-r * Math.sin(theta), r * Math.cos(theta)];
    }
  }
}

/** Render the normal line (perpendicular to tangent) through the snap point. */
function renderNormalLine(
  ctx:      CanvasRenderingContext2D,
  snap:     SnapResult,
  viewport: Viewport,
): void {
  if (snap.entity.type === 'line') return;
  const dir = computeTangentDir(snap.entity, snap.x, snap.y);
  if (!dir) return;

  const [dx, dy] = dir;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return;

  // Normal direction = rotate tangent 90°
  const nx = -dy / len;
  const ny =  dx / len;
  const ext = Math.max(viewport.xRange, viewport.yRange) * 1.5;

  const [x1c, y1c] = viewport.toCanvas(snap.x - nx * ext, snap.y - ny * ext);
  const [x2c, y2c] = viewport.toCanvas(snap.x + nx * ext, snap.y + ny * ext);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1c, y1c);
  ctx.lineTo(x2c, y2c);
  ctx.strokeStyle = snap.entity.color + '66';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([3, 5]);
  ctx.stroke();
  ctx.restore();
}

function renderTangentLine(
  ctx:      CanvasRenderingContext2D,
  snap:     SnapResult,
  viewport: Viewport,
): void {
  if (snap.entity.type === 'line') return;
  const dir = computeTangentDir(snap.entity, snap.x, snap.y);
  if (!dir) return;

  const [dx, dy] = dir;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return;

  // Extend ±1.5 viewport-diagonals in math space so the line always reaches edges
  const ext = Math.max(viewport.xRange, viewport.yRange) * 1.5;
  const nx = dx / len;
  const ny = dy / len;

  const [x1c, y1c] = viewport.toCanvas(snap.x - nx * ext, snap.y - ny * ext);
  const [x2c, y2c] = viewport.toCanvas(snap.x + nx * ext, snap.y + ny * ext);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1c, y1c);
  ctx.lineTo(x2c, y2c);
  ctx.strokeStyle = snap.entity.color + '88';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([6, 3]);
  ctx.stroke();
  ctx.restore();
}

// ─── Focal chord ──────────────────────────────────────────────────────────────

/**
 * Compute the OTHER endpoint of the focal chord through the snap point.
 *
 * Uses the quadratic product-of-roots formula.  For a line L through focus F
 * parametrised as Q(s) = F + s·(P−F), the snap point P is at s=1.
 * Substituting into the conic equation gives a quadratic in s whose other root
 * s₂ = C/A (product-of-roots divided by known root s₁=1).
 *
 * Returns null for:
 *   - circle (no focal chord concept)
 *   - degenerate cases (snap at parabola vertex, hyperbola line ∥ asymptote)
 */
function findFocalChordOtherEnd(
  entity: ConicEntity | ImplicitCurveEntity,
  sx:     number,
  sy:     number,
): [number, number] | null {
  if (!isConicEntity(entity)) return null;
  if (entity.type === 'circle') return null;

  // Choose the nearer focus as the chord's focus
  let fx: number;
  let fy: number;

  if (entity.type === 'parabola') {
    [fx, fy] = entity.derived.focus;
  } else {
    const [[f1x, f1y], [f2x, f2y]] = entity.derived.foci;
    const d1 = (sx - f1x) ** 2 + (sy - f1y) ** 2;
    const d2 = (sx - f2x) ** 2 + (sy - f2y) ** 2;
    [fx, fy] = d1 <= d2 ? [f1x, f1y] : [f2x, f2y];
  }

  const dx = sx - fx;
  const dy = sy - fy;
  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return null;

  let s2: number;

  if (entity.type === 'ellipse') {
    // (ex + s·p)²/a² + (ey + s·r)²/b² = 1  where ex = fx-cx, ey = fy-cy
    const { a, b, cx, cy } = entity.params;
    const ex = fx - cx;
    const ey = fy - cy;
    const p  = dx / a;
    const q  = ex / a;
    const r  = dy / b;
    const sc = ey / b;
    const A  = p * p + r * r;
    if (A < 1e-14) return null;
    const C  = q * q + sc * sc - 1;
    s2 = C / A;

  } else if (entity.type === 'hyperbola') {
    // (ex + s·p)²/a² − (ey + s·r)²/b² = 1
    const { a, b, cx, cy } = entity.params;
    const ex = fx - cx;
    const ey = fy - cy;
    const p  = dx / a;
    const q  = ex / a;
    const r  = dy / b;
    const sc = ey / b;
    const A  = p * p - r * r;
    if (Math.abs(A) < 1e-14) return null;  // line ∥ asymptote → no finite intersection
    const C  = q * q - sc * sc - 1;
    s2 = C / A;

  } else {
    const { p, orientation = 'h' } = entity.params;
    if (orientation === 'v') {
      // (x−cx)² = 2p(y−cy), focus F = (cx, cy+p/2)
      // dx = sx−cx (horizontal from focus since fx=cx)
      // s²·dx² − 2p·dy·s − p² = 0  →  s₂ = −p²/dx²
      const dx2 = dx * dx;
      if (dx2 < 1e-14) return null;        // snap at parabola vertex column
      s2 = -(p * p) / dx2;
    } else {
      // (y−cy)² = 2p(x−cx), focus F = (cx+p/2, cy)
      // s²·dy² − 2p·dx·s − p² = 0  →  s₂ = −p²/dy²
      const dy2 = dy * dy;
      if (dy2 < 1e-14) return null;        // snap at parabola vertex row
      s2 = -(p * p) / dy2;
    }
  }

  return [fx + s2 * dx, fy + s2 * dy];
}

function renderFocalChord(
  ctx:      CanvasRenderingContext2D,
  snap:     SnapResult,
  viewport: Viewport,
): void {
  if (snap.entity.type === 'line') return;
  const other = findFocalChordOtherEnd(snap.entity, snap.x, snap.y);
  if (!other) return;

  const [ox, oy] = other;
  const [px, py] = viewport.toCanvas(snap.x, snap.y);
  const [qx, qy] = viewport.toCanvas(ox, oy);

  ctx.save();
  // Chord line
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(qx, qy);
  ctx.strokeStyle = snap.entity.color + 'AA';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();

  // Second endpoint dot
  ctx.beginPath();
  ctx.arc(qx, qy, 5, 0, 2 * Math.PI);
  ctx.fillStyle   = snap.entity.color;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Chord-length label
  const chordLen = Math.sqrt((snap.x - ox) ** 2 + (snap.y - oy) ** 2);
  const midCx = (px + qx) / 2;
  const midCy = (py + qy) / 2;

  ctx.font         = '600 12px -apple-system,"Helvetica Neue",Arial,sans-serif';
  ctx.fillStyle    = snap.entity.color;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`|PQ| = ${chordLen.toFixed(4)}`, midCx, midCy - 4);

  ctx.restore();
}

// ─── Focal-radius lines ───────────────────────────────────────────────────────

function renderFocalLines(
  ctx:      CanvasRenderingContext2D,
  snap:     SnapResult,
  viewport: Viewport,
): void {
  const entity = snap.entity;
  if (entity.type !== 'ellipse' && entity.type !== 'hyperbola') return;

  const [px, py] = viewport.toCanvas(snap.x, snap.y);

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';  // amber focal-distance colour
  ctx.lineWidth   = 1;

  for (const [fxx, fyy] of entity.derived.foci) {
    const [fpx, fpy] = viewport.toCanvas(fxx, fyy);
    ctx.beginPath();
    ctx.moveTo(px,  py);
    ctx.lineTo(fpx, fpy);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Snap dot ─────────────────────────────────────────────────────────────────

function renderSnapDot(
  ctx:      CanvasRenderingContext2D,
  snap:     SnapResult,
  viewport: Viewport,
): void {
  const [px, py] = viewport.toCanvas(snap.x, snap.y);
  const color    = snap.entity.color;

  // Outer glow ring (entity colour at 20% alpha)
  ctx.beginPath();
  ctx.arc(px, py, 9, 0, 2 * Math.PI);
  ctx.fillStyle = color + '33';
  ctx.fill();

  // Solid dot
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, 2 * Math.PI);
  ctx.fillStyle   = color;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// ─── Info box ─────────────────────────────────────────────────────────────────

function buildInfoLines(snap: SnapResult): string[] {
  const lines: string[] = [];
  const e  = snap.entity;
  const fd = isConicEntity(e) ? focalDistance(e, [snap.x, snap.y]) : null;

  // Coordinate
  lines.push(`(${snap.x.toFixed(4)}, ${snap.y.toFixed(4)})`);

  if (fd) {
    if (e.type === 'ellipse') {
      lines.push(`r\u2081 = ${fd.r1.toFixed(4)}    r\u2082 = ${fd.r2.toFixed(4)}`);
      lines.push(`r\u2081+r\u2082 = ${(fd.r1 + fd.r2).toFixed(4)}  (2a = ${(2 * e.params.a).toFixed(4)})`);
    } else if (e.type === 'hyperbola') {
      lines.push(`r\u2081 = ${fd.r1.toFixed(4)}    r\u2082 = ${fd.r2.toFixed(4)}`);
      const diff = Math.abs(fd.r1 - fd.r2);
      lines.push(`|r\u2081\u2212r\u2082| = ${diff.toFixed(4)}  (2a = ${(2 * e.params.a).toFixed(4)})`);
    } else if (e.type === 'parabola') {
      lines.push(`r = ${fd.r1.toFixed(4)}`);
    } else if (e.type === 'circle') {
      lines.push(`r = ${fd.r1.toFixed(4)}  (R = ${e.params.r.toFixed(4)})`);
    }
  }

  return lines;
}

/** Draw a rounded-rect info box with optional accent border. */
function renderInfoBox(
  ctx:         CanvasRenderingContext2D,
  dotX:        number,
  dotY:        number,
  lines:       string[],
  accentColor: string,
): void {
  const FONT     = '600 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
  const FONT_H   = 17;
  const PAD      = 8;

  ctx.font = FONT;
  const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = maxW + PAD * 2;
  const boxH = lines.length * FONT_H + PAD * 2;

  // Position: prefer top-right of dot; clamp to canvas bounds
  let bx = dotX + 14;
  let by = dotY - boxH - 6;
  if (bx + boxW > ctx.canvas.width  - 4) bx = dotX - boxW - 14;
  if (by         < 4)                    by = dotY + 14;
  if (by + boxH  > ctx.canvas.height - 4) by = ctx.canvas.height - boxH - 4;

  // Background — darker for maximum text contrast
  ctx.fillStyle = 'rgba(14, 14, 18, 0.92)';
  roundRect(ctx, bx, by, boxW, boxH, 6);
  ctx.fill();

  // Accent border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth   = 1;
  roundRect(ctx, bx, by, boxW, boxH, 4);
  ctx.stroke();

  // Text — bright white for clarity
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = FONT;
  lines.forEach((line, i) => {
    ctx.fillText(line, bx + PAD, by + PAD + (i + 1) * FONT_H - 4);
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,     x + r, y);
  ctx.closePath();
}

// ─── Public entry ─────────────────────────────────────────────────────────────

/**
 * Render the full snap-point overlay on the dynamic canvas layer.
 * Caller is responsible for `clearRect` before this call.
 *
 * @param opts  Phase-8 teaching overlays (tangent, focal chord). Both default off.
 */
export function renderCurvePoint(
  ctx:      CanvasRenderingContext2D,
  snap:     SnapResult,
  viewport: Viewport,
  opts?:    CurvePointRenderOptions,
): void {
  // Phase-8 teaching overlays (rendered first — underneath the snap dot)
  if (opts?.showTangent)    renderTangentLine(ctx, snap, viewport);
  if (opts?.showNormal)     renderNormalLine (ctx, snap, viewport);
  if (opts?.showFocalChord) renderFocalChord (ctx, snap, viewport);

  renderFocalLines(ctx, snap, viewport);   // guards entity.type internally
  renderSnapDot(ctx, snap, viewport);

  const [px, py] = viewport.toCanvas(snap.x, snap.y);
  const lines    = buildInfoLines(snap);
  renderInfoBox(ctx, px, py, lines, snap.entity.color);
}
