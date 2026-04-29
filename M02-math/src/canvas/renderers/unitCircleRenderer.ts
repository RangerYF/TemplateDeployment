/**
 * unitCircleRenderer — M04 Phase 1 (refactored for clarity)
 *
 * Two rendering functions for the dual-layer unit circle canvas:
 *
 *  renderStaticUnitCircle  → StaticCanvas layer
 *    - Unit circle outline
 *    - 24 special-angle indicator dots (density adapts to zoom)
 *    - Angle labels with collision avoidance
 *
 *  renderDynamicAngle      → DynamicCanvas layer
 *    - Draggable point P at (cos θ, sin θ)
 *    - Optional sin/cos projection lines (subtler than before)
 *    - Optional angle arc from 0 to θ
 *    - Smart label placement via LabelPlacer (no overlap)
 *    - Quadrant roman numeral hints (very subtle)
 *
 * Rendering priority (highest → lowest):
 *   1. Point P + "P" label
 *   2. Main trig value labels (sin, cos)
 *   3. Angle arc + θ label
 *   4. Projection lines (dashed, light)
 *   5. Origin-to-P line
 *   6. Static angle labels (around circle)
 *   7. Quadrant hints
 */

import type { Viewport } from '@/canvas/Viewport';
import type { SpecialAngleValues } from '@/types';
import { COLORS } from '@/styles/colors';
import { EXACT_VALUE_TABLE } from '@/engine/exactValueEngine';
import { formatPiLabel } from '@/engine/piAxisEngine';
import { LabelPlacer } from '@/canvas/renderers/labelStrategy';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface UnitCircleRenderOptions {
  showProjections:   boolean;
  showAngleArc:      boolean;
  showLabels:        boolean;
  showQuadrantHints: boolean;
  isSnapped:         boolean;
}

// ─── Tuning constants (easy to tweak) ────────────────────────────────────────

/** Visual parameters for the static unit circle layer */
const STATIC = {
  circleColor:    '#374151',
  circleWidth:    2.5,
  dotColor:       '#1F2937',
  dotRadius:      3.5,
  /** Min circle radius (px) before showing any angle labels */
  labelMinRadius: 100,
  /** Radial offset from circle edge for angle labels */
  labelOffset:    16,
  labelFont:      '10px monospace',
  labelColor:     '#6B7280',
  /** Zoom thresholds for secondary (45° steps) and tertiary (30° steps) labels */
  secondaryThreshold: 140,
  tertiaryThreshold:  200,
} as const;

/** Visual parameters for the dynamic angle layer */
const DYNAMIC = {
  // ── Point P ──
  pointRadius:      9,
  pointColor:       COLORS.primary,
  pointStroke:      '#FFFFFF',
  pointStrokeWidth: 2,
  snapGlowRadius:   14,
  snapGlowColor:    'rgba(50, 213, 131, 0.25)',

  // ── Origin-to-P line ──
  radiusLineColor:  'rgba(100,116,139,0.35)',
  radiusLineWidth:  1.5,

  // ── Projection lines (subtler) ──
  projLineWidth:    1.5,
  projDash:         [4, 4] as number[],
  projAlpha:        0.6,       // applied via globalAlpha
  footDotRadius:    3,

  // ── Angle arc ──
  arcColor:         COLORS.angleArc,
  arcWidth:         1.5,
  arcRadiusFrac:    0.22,    // fraction of unit radius
  arcMinPx:         10,
  arrowSize:        5,

  // ── Labels ──
  labelFont:        'bold 12px monospace',
  labelFontSmall:   '11px monospace',
  angleLabelColor:  COLORS.angleArc,
  sinLabelColor:    COLORS.sinColor,
  cosLabelColor:    COLORS.cosColor,
  pLabelFont:       'bold 13px monospace',
  pLabelOffset:     12,

  // ── Quadrant hints ──
  quadrantColor:    'rgba(100,116,139,0.25)',
  quadrantFont:     'bold 14px serif',
} as const;

// ─── Angle sets ──────────────────────────────────────────────────────────────

const PRIMARY_ANGLES = new Set([
  0, Math.PI / 2, Math.PI, 3 * Math.PI / 2,
]);

const SECONDARY_ANGLES = new Set([
  Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4,
]);

const TERTIARY_ANGLES = new Set([
  Math.PI / 6, Math.PI / 3, 2 * Math.PI / 3, 5 * Math.PI / 6,
  7 * Math.PI / 6, 4 * Math.PI / 3, 5 * Math.PI / 3, 11 * Math.PI / 6,
]);

function matchesSet(a: number, set: Set<number>): boolean {
  if (set.has(a)) return true;
  for (const v of set) {
    if (Math.abs(v - a) < 0.01) return true;
  }
  return false;
}

// ─── Static layer ────────────────────────────────────────────────────────────

export function renderStaticUnitCircle(
  ctx:      CanvasRenderingContext2D,
  viewport: Viewport,
): void {
  ctx.save();

  const [cx0, cy0] = viewport.toCanvas(0, 0);
  const [cx1]      = viewport.toCanvas(1, 0);
  const radiusPx   = cx1 - cx0;

  // ── Unit circle outline ───────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(cx0, cy0, radiusPx, 0, Math.PI * 2);
  ctx.strokeStyle = STATIC.circleColor;
  ctx.lineWidth   = STATIC.circleWidth;
  ctx.stroke();

  // ── Special-angle dots + labels ───────────────────────────────────────
  const placer = new LabelPlacer(viewport.width, viewport.height);
  // Reserve the origin area so labels don't pile on it
  placer.reserve(cx0, cy0, 12, 12);

  ctx.save();
  ctx.font = STATIC.labelFont;

  for (const entry of EXACT_VALUE_TABLE) {
    const x = Math.cos(entry.angleDecimal);
    const y = Math.sin(entry.angleDecimal);
    const [px, py] = viewport.toCanvas(x, y);

    // Dot visibility: primary always, secondary/tertiary based on zoom
    const isPrimary   = matchesSet(entry.angleDecimal, PRIMARY_ANGLES);
    const isSecondary = matchesSet(entry.angleDecimal, SECONDARY_ANGLES);
    const isTertiary  = matchesSet(entry.angleDecimal, TERTIARY_ANGLES);

    const showDot = isPrimary
      || (isSecondary && radiusPx > 80)
      || (isTertiary && radiusPx > 120);

    if (showDot) {
      ctx.beginPath();
      ctx.arc(px, py, STATIC.dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = STATIC.dotColor;
      ctx.fill();
    }

    // Label visibility: only at sufficient zoom, with higher thresholds per tier
    const showLabel = radiusPx > STATIC.labelMinRadius && (
      isPrimary
      || (isSecondary && radiusPx > STATIC.secondaryThreshold)
      || (isTertiary && radiusPx > STATIC.tertiaryThreshold)
    );

    if (showLabel) {
      const deg = Math.round(entry.angleDecimal * 180 / Math.PI);
      const piLabel = formatPiLabel(entry.angleDecimal);
      // Shorter label: just "π/3" for tertiary, "60° π/3" for primary/secondary
      const labelText = isTertiary ? piLabel : `${deg}° ${piLabel}`;

      const tw = ctx.measureText(labelText).width;
      const th = 10; // approx for 10px font

      // Place using collision avoidance
      const offset = radiusPx + STATIC.labelOffset;
      const lx = cx0 + offset * Math.cos(-entry.angleDecimal);
      const ly = cy0 + offset * Math.sin(-entry.angleDecimal);

      const hw = tw / 2;
      const hh = th / 2;

      if (!placer.wouldOverlap(lx, ly, hw, hh)) {
        // Boundary check
        if (
          lx - hw > 4 && lx + hw < viewport.width - 4 &&
          ly - hh > 4 && ly + hh < viewport.height - 4
        ) {
          ctx.fillStyle    = STATIC.labelColor;
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, lx, ly);
          placer.reserve(lx, ly, hw, hh);
        }
      }
    }
  }

  ctx.restore();
  ctx.restore();
}

// ─── Dynamic layer ───────────────────────────────────────────────────────────

export function renderDynamicAngle(
  ctx:           CanvasRenderingContext2D,
  angleRad:      number,
  viewport:      Viewport,
  options:       UnitCircleRenderOptions,
  snappedValues: SpecialAngleValues | null,
): void {
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const [px, py] = viewport.toCanvas(cosA, sinA);
  const [ox, oy] = viewport.toCanvas(0, 0);
  const [cx1]    = viewport.toCanvas(1, 0);
  const radiusPx = cx1 - ox;

  const placer = new LabelPlacer(viewport.width, viewport.height);
  // Reserve the origin and point P so labels avoid them
  placer.reserve(ox, oy, 10, 10);
  placer.reserve(px, py, DYNAMIC.pointRadius + 2, DYNAMIC.pointRadius + 2);

  ctx.save();

  // ── 1. Angle arc (low visual weight) ──────────────────────────────────
  if (options.showAngleArc && Math.abs(angleRad) > 1e-6) {
    const arcRadius = Math.max(radiusPx * DYNAMIC.arcRadiusFrac, DYNAMIC.arcMinPx);

    ctx.beginPath();
    ctx.arc(ox, oy, arcRadius, 0, -angleRad, angleRad < 0);
    ctx.strokeStyle = DYNAMIC.arcColor;
    ctx.lineWidth   = DYNAMIC.arcWidth;
    ctx.setLineDash([]);
    ctx.stroke();

    // Small arrowhead
    const endX = ox + arcRadius * Math.cos(-angleRad);
    const endY = oy + arcRadius * Math.sin(-angleRad);
    const tangAngle = -angleRad + (angleRad >= 0 ? Math.PI / 2 : -Math.PI / 2);
    const A = DYNAMIC.arrowSize;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - A * Math.cos(tangAngle - 0.4), endY - A * Math.sin(tangAngle - 0.4));
    ctx.lineTo(endX - A * Math.cos(tangAngle + 0.4), endY - A * Math.sin(tangAngle + 0.4));
    ctx.closePath();
    ctx.fillStyle = DYNAMIC.arcColor;
    ctx.fill();
  }

  // ── 2. Origin-to-P line (subtle) ──────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(px, py);
  ctx.strokeStyle = DYNAMIC.radiusLineColor;
  ctx.lineWidth   = DYNAMIC.radiusLineWidth;
  ctx.setLineDash([]);
  ctx.stroke();

  // ── 3. Projections (lighter, less dominant) ───────────────────────────
  if (options.showProjections) {
    const [footX] = viewport.toCanvas(cosA, 0);
    const [, footY] = viewport.toCanvas(0, sinA);

    ctx.save();
    ctx.globalAlpha = DYNAMIC.projAlpha;
    ctx.lineWidth   = DYNAMIC.projLineWidth;
    ctx.setLineDash(DYNAMIC.projDash);

    // Vertical: P → x-axis (sin)
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, oy);
    ctx.strokeStyle = COLORS.sinColor;
    ctx.stroke();

    // Horizontal: P → y-axis (cos)
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ox, py);
    ctx.strokeStyle = COLORS.cosColor;
    ctx.stroke();

    ctx.setLineDash([]);

    // Foot dots (smaller)
    ctx.beginPath();
    ctx.arc(footX, oy, DYNAMIC.footDotRadius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.sinColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ox, footY, DYNAMIC.footDotRadius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.cosColor;
    ctx.fill();

    ctx.restore();

    // Reserve foot dot positions so labels avoid them
    placer.reserve(footX, oy, 6, 6);
    placer.reserve(ox, footY, 6, 6);
  }

  // ── 4. Point P (highest priority) ─────────────────────────────────────
  if (options.isSnapped) {
    ctx.beginPath();
    ctx.arc(px, py, DYNAMIC.snapGlowRadius, 0, Math.PI * 2);
    ctx.fillStyle = DYNAMIC.snapGlowColor;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(px, py, DYNAMIC.pointRadius, 0, Math.PI * 2);
  ctx.fillStyle   = DYNAMIC.pointColor;
  ctx.fill();
  ctx.strokeStyle = DYNAMIC.pointStroke;
  ctx.lineWidth   = DYNAMIC.pointStrokeWidth;
  ctx.stroke();

  // ── 5. Smart label placement ──────────────────────────────────────────
  if (options.showLabels) {
    // --- "P" label: place away from the radius line ---
    {
      ctx.font = DYNAMIC.pLabelFont;
      const tw = ctx.measureText('P').width;
      const th = 13;
      // Preferred direction: away from origin (outward from P)
      const pAngle = Math.atan2(-(py - oy), px - ox); // canvas angle (Y flipped)
      const prefDir = angleToDirIndex(pAngle);
      const result = placer.place({
        text: 'P',
        anchorX: px,
        anchorY: py,
        textWidth: tw,
        textHeight: th,
        offset: DYNAMIC.pLabelOffset,
        preferredDir: prefDir,
      });
      if (result) {
        ctx.fillStyle    = DYNAMIC.pointColor;
        ctx.font         = DYNAMIC.pLabelFont;
        ctx.textAlign    = result.textAlign;
        ctx.textBaseline = result.textBaseline;
        ctx.fillText('P', result.x, result.y);
      }
    }

    // --- Angle label near arc (only when arc is visible) ---
    if (options.showAngleArc && Math.abs(angleRad) > 1e-6) {
      const anglePi = formatPiLabel(angleRad);
      const degStr  = `${(angleRad * 180 / Math.PI).toFixed(1)}°`;
      // Compact: "θ = π/3" on one line, skip degree when snapped
      const angleText = snappedValues
        ? `θ = ${anglePi}`
        : `θ = ${degStr}`;

      ctx.font = DYNAMIC.labelFontSmall;
      const tw = ctx.measureText(angleText).width;
      const th = 12;

      // Place near the midpoint of the arc, biased outward
      const halfA = angleRad / 2;
      const labelR = Math.max(radiusPx * 0.35, 20);
      const anchorX = ox + labelR * Math.cos(-halfA);
      const anchorY = oy + labelR * Math.sin(-halfA);

      const result = placer.place({
        text: angleText,
        anchorX,
        anchorY,
        textWidth: tw,
        textHeight: th,
        offset: 6,
        preferredDir: angleToDirIndex(Math.atan2(-(anchorY - oy), anchorX - ox)),
      });
      if (result) {
        ctx.fillStyle    = DYNAMIC.angleLabelColor;
        ctx.font         = DYNAMIC.labelFontSmall;
        ctx.textAlign    = result.textAlign;
        ctx.textBaseline = result.textBaseline;
        ctx.fillText(angleText, result.x, result.y);
      }
    }

    // --- Sin value label (near x-axis foot, only with projections) ---
    if (options.showProjections && Math.abs(sinA) > 0.05) {
      const sinStr = snappedValues
        ? snappedValues.sin.decimal.toFixed(4)
        : sinA.toFixed(4);
      const sinText = `sin ${sinStr}`;

      ctx.font = DYNAMIC.labelFont;
      const tw = ctx.measureText(sinText).width;
      const th = 12;

      const [footX] = viewport.toCanvas(cosA, 0);
      // Prefer placing to the right of the foot, below x-axis
      const result = placer.place({
        text: sinText,
        anchorX: footX,
        anchorY: oy,
        textWidth: tw,
        textHeight: th,
        offset: 8,
        preferredDir: sinA > 0 ? 2 : 6, // above if sin > 0, below if sin < 0
      });
      if (result) {
        ctx.fillStyle    = DYNAMIC.sinLabelColor;
        ctx.font         = DYNAMIC.labelFont;
        ctx.textAlign    = result.textAlign;
        ctx.textBaseline = result.textBaseline;
        ctx.fillText(sinText, result.x, result.y);
      }
    }

    // --- Cos value label (near y-axis foot, only with projections) ---
    if (options.showProjections && Math.abs(cosA) > 0.05) {
      const cosStr = snappedValues
        ? snappedValues.cos.decimal.toFixed(4)
        : cosA.toFixed(4);
      const cosText = `cos ${cosStr}`;

      ctx.font = DYNAMIC.labelFont;
      const tw = ctx.measureText(cosText).width;
      const th = 12;

      const [, footY] = viewport.toCanvas(0, sinA);
      // Prefer placing to the left of foot
      const result = placer.place({
        text: cosText,
        anchorX: ox,
        anchorY: footY,
        textWidth: tw,
        textHeight: th,
        offset: 8,
        preferredDir: cosA > 0 ? 4 : 0, // left if cos > 0, right if cos < 0
      });
      if (result) {
        ctx.fillStyle    = DYNAMIC.cosLabelColor;
        ctx.font         = DYNAMIC.labelFont;
        ctx.textAlign    = result.textAlign;
        ctx.textBaseline = result.textBaseline;
        ctx.fillText(cosText, result.x, result.y);
      }
    }
  }

  // ── 6. Quadrant hints (very subtle) ───────────────────────────────────
  if (options.showQuadrantHints) {
    const hints = [
      { label: 'Ⅰ', mx:  0.6, my:  0.6 },
      { label: 'Ⅱ', mx: -0.6, my:  0.6 },
      { label: 'Ⅲ', mx: -0.6, my: -0.6 },
      { label: 'Ⅳ', mx:  0.6, my: -0.6 },
    ];
    ctx.fillStyle    = DYNAMIC.quadrantColor;
    ctx.font         = DYNAMIC.quadrantFont;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'center';
    for (const h of hints) {
      const [qx, qy] = viewport.toCanvas(h.mx, h.my);
      ctx.fillText(h.label, qx, qy);
    }
  }

  ctx.restore();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a canvas-space angle to a direction index (0-7). */
function angleToDirIndex(canvasAngle: number): number {
  // Normalize to [0, 2π)
  const a = ((canvasAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.round(a / (Math.PI / 4)) % 8;
}
