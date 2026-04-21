/**
 * unitCircleRenderer — M04 Phase 1
 *
 * Two rendering functions for the dual-layer unit circle canvas:
 *
 *  renderStaticUnitCircle  → StaticCanvas layer
 *    - Unit circle outline
 *    - 24 special-angle indicator dots
 *
 *  renderDynamicAngle      → DynamicCanvas layer
 *    - Draggable point P at (cos θ, sin θ)
 *    - Optional sin/cos projection lines
 *    - Optional angle arc from 0 to θ
 *    - Optional coordinate labels
 *    - Quadrant roman numeral hints
 */

import type { Viewport } from '@/canvas/Viewport';
import type { SpecialAngleValues } from '@/types';
import { COLORS } from '@/styles/colors';
import { EXACT_VALUE_TABLE } from '@/engine/exactValueEngine';
import { formatPiLabel } from '@/engine/piAxisEngine';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface UnitCircleRenderOptions {
  showProjections:   boolean;
  showAngleArc:      boolean;
  showLabels:        boolean;
  showQuadrantHints: boolean;
  isSnapped:         boolean;
}

// ─── Colours / sizing constants ───────────────────────────────────────────────

const CIRCLE_COLOR  = '#374151';   // unit circle outline (dark grey for contrast)
const SPECIAL_DOT   = '#1F2937';   // 24 special angle dots (high contrast)
const POINT_P_COLOR = COLORS.primary;
const POINT_P_RADIUS = 9;          // larger for projector (diameter 18px)
const POINT_P_SNAPPED_GLOW = 'rgba(50, 213, 131, 0.30)';

// ─── Static layer ─────────────────────────────────────────────────────────────

/**
 * Render the unit circle outline and the 24 special-angle indicator dots.
 * Called on canvas resize / viewport change.
 */
export function renderStaticUnitCircle(
  ctx:      CanvasRenderingContext2D,
  viewport: Viewport,
): void {
  ctx.save();

  // ── Unit circle ──────────────────────────────────────────────────────────
  const [cx0, cy0] = viewport.toCanvas(0, 0);
  const [cx1]      = viewport.toCanvas(1, 0);
  const radiusPx   = cx1 - cx0;  // pixels per math unit

  ctx.beginPath();
  ctx.arc(cx0, cy0, radiusPx, 0, Math.PI * 2);
  ctx.strokeStyle = CIRCLE_COLOR;
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  // ── Special-angle dots with degree/radian labels ───────────────────────
  // Only label the 12 standard angles (multiples of π/6 and π/4) to avoid clutter
  const LABELED_ANGLES = new Set([
    0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2,
    2 * Math.PI / 3, 3 * Math.PI / 4, 5 * Math.PI / 6, Math.PI,
    7 * Math.PI / 6, 5 * Math.PI / 4, 4 * Math.PI / 3, 3 * Math.PI / 2,
    5 * Math.PI / 3, 7 * Math.PI / 4, 11 * Math.PI / 6,
  ]);

  for (const entry of EXACT_VALUE_TABLE) {
    const x = Math.cos(entry.angleDecimal);
    const y = Math.sin(entry.angleDecimal);
    const [px, py] = viewport.toCanvas(x, y);

    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = SPECIAL_DOT;
    ctx.fill();

    // Label: "60° / π/3" for key angles (only if circle is large enough)
    const isLabeled = LABELED_ANGLES.has(entry.angleDecimal) ||
      [...LABELED_ANGLES].some((a) => Math.abs(a - entry.angleDecimal) < 0.01);
    if (isLabeled && radiusPx > 80) {
      const deg = Math.round(entry.angleDecimal * 180 / Math.PI);
      const piLabel = formatPiLabel(entry.angleDecimal);
      const labelText = `${deg}°/${piLabel}`;

      // Position label outside the circle
      const offset = radiusPx + 14;
      const lx = cx0 + offset * Math.cos(-entry.angleDecimal);
      const ly = cy0 + offset * Math.sin(-entry.angleDecimal);

      ctx.save();
      ctx.font = '10px monospace';
      ctx.fillStyle = '#6B7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, lx, ly);
      ctx.restore();
    }
  }

  ctx.restore();
}

// ─── Dynamic layer ────────────────────────────────────────────────────────────

/**
 * Render the angle-dependent elements: point P, projections, arc, labels.
 * Called every RAF when the angle changes.
 */
export function renderDynamicAngle(
  ctx:           CanvasRenderingContext2D,
  angleRad:      number,
  viewport:      Viewport,
  options:       UnitCircleRenderOptions,
  snappedValues: SpecialAngleValues | null,
): void {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const [px, py]   = viewport.toCanvas(cosA, sinA);    // point P canvas coords
  const [ox, oy]   = viewport.toCanvas(0, 0);          // origin canvas coords
  const [cx1]      = viewport.toCanvas(1, 0);
  const radiusPx   = cx1 - ox;

  ctx.save();

  // ── Angle arc ────────────────────────────────────────────────────────────
  if (options.showAngleArc && Math.abs(angleRad) > 1e-6) {
    const arcRadius = Math.max(radiusPx * 0.25, 10);  // 25% of unit radius
    ctx.beginPath();
    // Canvas arc goes clockwise; math angles go counter-clockwise (Y-axis flipped)
    ctx.arc(ox, oy, arcRadius, 0, -angleRad, angleRad < 0);
    ctx.strokeStyle = COLORS.angleArc;
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.stroke();

    // Small arrowhead at the arc end
    const endX = ox + arcRadius * Math.cos(-angleRad);
    const endY = oy + arcRadius * Math.sin(-angleRad);
    const tangAngle = -angleRad + (angleRad >= 0 ? Math.PI / 2 : -Math.PI / 2);
    const ARROW = 6;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - ARROW * Math.cos(tangAngle - 0.4),
      endY - ARROW * Math.sin(tangAngle - 0.4),
    );
    ctx.lineTo(
      endX - ARROW * Math.cos(tangAngle + 0.4),
      endY - ARROW * Math.sin(tangAngle + 0.4),
    );
    ctx.closePath();
    ctx.fillStyle = COLORS.angleArc;
    ctx.fill();
  }

  // ── Projections ──────────────────────────────────────────────────────────
  if (options.showProjections) {
    const [footX] = viewport.toCanvas(cosA, 0);    // foot of sin projection
    const [, footY] = viewport.toCanvas(0, sinA);  // foot of cos projection

    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);

    // Vertical: P → x-axis  (sin value)
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, oy);
    ctx.strokeStyle = COLORS.sinColor;
    ctx.stroke();

    // Horizontal: P → y-axis  (cos value)
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ox, py);
    ctx.strokeStyle = COLORS.cosColor;
    ctx.stroke();

    ctx.setLineDash([]);

    // Foot dots (larger for projector)
    ctx.beginPath();
    ctx.arc(footX, oy, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.sinColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ox, footY, 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.cosColor;
    ctx.fill();
  }

  // ── Line from origin to P ────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(px, py);
  ctx.strokeStyle = 'rgba(100,116,139,0.50)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);
  ctx.stroke();

  // ── Point P ──────────────────────────────────────────────────────────────
  if (options.isSnapped) {
    // Glow ring when snapped to a special angle
    ctx.beginPath();
    ctx.arc(px, py, POINT_P_RADIUS + 5, 0, Math.PI * 2);
    ctx.fillStyle = POINT_P_SNAPPED_GLOW;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(px, py, POINT_P_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle   = POINT_P_COLOR;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // "P" label
  ctx.fillStyle    = POINT_P_COLOR;
  ctx.font         = 'bold 14px monospace';
  ctx.textBaseline = 'bottom';
  ctx.textAlign    = 'left';
  ctx.fillText('P', px + 10, py - 6);

  // ── Angle / trig labels ──────────────────────────────────────────────────
  if (options.showLabels) {
    const anglePi = formatPiLabel(angleRad);
    const degStr  = `${(angleRad * 180 / Math.PI).toFixed(1)}°`;

    // Angle label near arc
    ctx.fillStyle    = COLORS.angleArc;
    ctx.font         = 'bold 13px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'left';

    const labelR  = Math.max(radiusPx * 0.38, 18);
    const halfA   = angleRad / 2;
    const labelX  = ox + labelR * Math.cos(halfA) + 8;
    const labelY  = oy - labelR * Math.sin(halfA);
    ctx.fillText(`θ = ${anglePi}`, labelX, labelY);
    ctx.font = '12px monospace';
    ctx.fillText(`(${degStr})`, labelX, labelY + 15);

    // Sin label on the vertical projection foot
    if (options.showProjections) {
      const [footX] = viewport.toCanvas(cosA, 0);
      const sinStr  = snappedValues
        ? snappedValues.sin.decimal.toFixed(4)
        : Math.sin(angleRad).toFixed(4);
      ctx.fillStyle    = COLORS.sinColor;
      ctx.font         = 'bold 13px monospace';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`sin = ${sinStr}`, footX + 6, oy - 6);

      // Cos label on the horizontal projection foot
      const [, footY] = viewport.toCanvas(0, sinA);
      const cosStr = snappedValues
        ? snappedValues.cos.decimal.toFixed(4)
        : Math.cos(angleRad).toFixed(4);
      ctx.fillStyle    = COLORS.cosColor;
      ctx.font         = 'bold 13px monospace';
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`cos = ${cosStr}`, ox - 6, footY);
    }
  }

  // ── Quadrant hints ───────────────────────────────────────────────────────
  if (options.showQuadrantHints) {
    const [qx1] = viewport.toCanvas( 0.6,  0.6);
    const [qx2] = viewport.toCanvas(-0.6,  0.6);
    const [qx3] = viewport.toCanvas(-0.6, -0.6);
    const [qx4] = viewport.toCanvas( 0.6, -0.6);
    const [, qy1] = viewport.toCanvas(0,  0.6);
    const [, qy2] = viewport.toCanvas(0, -0.6);

    ctx.fillStyle    = 'rgba(100,116,139,0.5)';
    ctx.font         = 'bold 16px serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'center';
    ctx.fillText('Ⅰ',  qx1, qy1);
    ctx.fillText('Ⅱ',  qx2, qy1);
    ctx.fillText('Ⅲ',  qx3, qy2);
    ctx.fillText('Ⅳ',  qx4, qy2);
  }

  ctx.restore();
}
