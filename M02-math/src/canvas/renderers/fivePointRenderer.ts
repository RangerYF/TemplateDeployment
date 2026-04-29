/**
 * fivePointRenderer — M04 Phase 4 (refactored for clarity)
 *
 * Renders the Five-Point Method markers on the dynamic canvas layer.
 * Accepts an optional LabelPlacer for cross-element collision avoidance.
 *
 * Visual priority:
 *   1. Point circles (always visible)
 *   2. Connecting dashed line
 *   3. Labels (collision-avoided, can be skipped)
 *   4. Vertical guides (very subtle)
 *
 * Role colours:
 *   zero → off-white  (#E0E0E8)
 *   max  → green      (COLORS.sinColor)
 *   min  → orange     (COLORS.asymptote)
 */

import type { Viewport }       from '@/canvas/Viewport';
import type { FivePointData }  from '@/engine/fivePointEngine';
import type { FivePointStep }  from '@/types';
import { COLORS }              from '@/styles/colors';
import { LabelPlacer }         from '@/canvas/renderers/labelStrategy';

// ─── Tuning constants ────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  zero: '#E0E0E8',
  max:  COLORS.sinColor,
  min:  COLORS.asymptote,
};

/** Visual parameters (easy to tune) */
const FP = {
  pointRadius:     7,          // was 8
  glowRadius:      12,         // was 15
  strokeWidth:     2,
  strokeColor:     '#FFFFFF',
  connectDash:     [5, 4] as number[],
  connectColor:    'rgba(100,116,139,0.3)',  // lighter (was 0.4)
  connectWidth:    1.2,                      // thinner (was 1.5)
  guideDash:       [3, 4] as number[],
  guideAlpha:      '30',       // hex alpha suffix (was 60)
  guideWidth:      0.8,        // thinner (was 1)
  labelFont:       'bold 11px monospace',   // smaller (was 12px)
  labelOffset:     10,         // was 12
  labelGap:        8,          // extra vertical clearance
} as const;

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Draw the visible five-point markers (indices 0…step-1) onto `ctx`.
 *
 * @param placer  Optional LabelPlacer shared with the parent frame for
 *                cross-element collision avoidance. If omitted, a fresh
 *                placer is created internally.
 */
export function renderFivePoints(
  ctx:      CanvasRenderingContext2D,
  points:   FivePointData[],
  step:     FivePointStep,
  viewport: Viewport,
  placer?:  LabelPlacer,
): void {
  if (step === 0 || points.length === 0) return;

  const visiblePts = points.slice(0, step);
  const lp = placer ?? new LabelPlacer(viewport.width, viewport.height);

  ctx.save();

  // ── Connecting dashed line ─────────────────────────────────────────────
  if (step >= 2) {
    ctx.beginPath();
    ctx.setLineDash(FP.connectDash);
    ctx.strokeStyle = FP.connectColor;
    ctx.lineWidth   = FP.connectWidth;

    visiblePts.forEach((pt, i) => {
      const [cx, cy] = viewport.toCanvas(pt.x, pt.y);
      if (i === 0) ctx.moveTo(cx, cy);
      else         ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Draw each visible point ────────────────────────────────────────────
  visiblePts.forEach((pt, i) => {
    const [cx, cy] = viewport.toCanvas(pt.x, pt.y);
    const color    = ROLE_COLOR[pt.role] ?? '#E0E0E8';
    const isNewest = i === visiblePts.length - 1;

    // Reserve the point area
    lp.reserve(cx, cy, FP.pointRadius + 2, FP.pointRadius + 2);

    // Glow ring on newest point only
    if (isNewest) {
      ctx.beginPath();
      ctx.arc(cx, cy, FP.glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = `${color}25`;
      ctx.fill();
    }

    // Filled circle
    ctx.beginPath();
    ctx.arc(cx, cy, FP.pointRadius, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.strokeStyle = FP.strokeColor;
    ctx.lineWidth   = FP.strokeWidth;
    ctx.stroke();

    // Vertical guide to x-axis (very subtle)
    const [, oy] = viewport.toCanvas(0, 0);
    if (Math.abs(cy - oy) > FP.pointRadius + 4) {
      ctx.beginPath();
      ctx.setLineDash(FP.guideDash);
      ctx.strokeStyle = `${color}${FP.guideAlpha}`;
      ctx.lineWidth   = FP.guideWidth;
      ctx.moveTo(cx, cy + (cy < oy ? FP.pointRadius : -FP.pointRadius));
      ctx.lineTo(cx, oy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Label via LabelPlacer — prefer below if y ≥ 0, above if y < 0
    const labelText = `P${i + 1}`;
    ctx.font = FP.labelFont;
    const tw = ctx.measureText(labelText).width;
    const th = 11;
    const prefDir = pt.y >= 0 ? 6 : 2;  // 6 = bottom, 2 = top

    const result = lp.place({
      text: labelText,
      anchorX: cx,
      anchorY: cy,
      textWidth: tw,
      textHeight: th,
      offset: FP.labelOffset,
      preferredDir: prefDir,
    });

    if (result) {
      ctx.fillStyle    = color;
      ctx.font         = FP.labelFont;
      ctx.textAlign    = result.textAlign;
      ctx.textBaseline = result.textBaseline;
      ctx.fillText(labelText, result.x, result.y);
    }
  });

  ctx.restore();
}
