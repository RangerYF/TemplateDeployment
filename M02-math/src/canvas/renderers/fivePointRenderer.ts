/**
 * fivePointRenderer — M04 Phase 4
 *
 * Renders the Five-Point Method markers on the dynamic canvas layer.
 *
 * Points 1..step are shown; points beyond step are invisible.
 * The most-recently-added point gets a subtle glow ring to draw attention.
 *
 * Role colours:
 *   zero → white     (#E0E0E8)
 *   max  → green     (COLORS.sinColor)
 *   min  → pink      (COLORS.asymptote)
 */

import type { Viewport }       from '@/canvas/Viewport';
import type { FivePointData }  from '@/engine/fivePointEngine';
import type { FivePointStep }  from '@/types';
import { COLORS }              from '@/styles/colors';

// ─── Colours ─────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  zero: '#E0E0E8',
  max:  COLORS.sinColor,
  min:  COLORS.asymptote,
};

const POINT_R      = 8;
const GLOW_R       = 15;
const LABEL_OFFSET = 12;

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Draw the visible five-point markers (indices 0…step-1) onto `ctx`.
 * Call this on the *dynamic* canvas layer each frame.
 *
 * @param step   Current step (0 = show nothing, 5 = show all 5 + connecting lines).
 */
export function renderFivePoints(
  ctx:      CanvasRenderingContext2D,
  points:   FivePointData[],
  step:     FivePointStep,
  viewport: Viewport,
): void {
  if (step === 0 || points.length === 0) return;

  const visiblePts = points.slice(0, step);

  ctx.save();

  // ── Connecting dashed line through visible points ─────────────────────────
  if (step >= 2) {
    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(100,116,139,0.4)';
    ctx.lineWidth   = 1.5;

    visiblePts.forEach((pt, i) => {
      const [cx, cy] = viewport.toCanvas(pt.x, pt.y);
      if (i === 0) ctx.moveTo(cx, cy);
      else         ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Draw each visible point ───────────────────────────────────────────────
  visiblePts.forEach((pt, i) => {
    const [cx, cy] = viewport.toCanvas(pt.x, pt.y);
    const color     = ROLE_COLOR[pt.role] ?? '#E0E0E8';
    const isNewest  = i === visiblePts.length - 1;

    // Glow ring on newest point
    if (isNewest) {
      ctx.beginPath();
      ctx.arc(cx, cy, GLOW_R, 0, Math.PI * 2);
      ctx.fillStyle = `${color}30`;
      ctx.fill();
    }

    // Filled circle
    ctx.beginPath();
    ctx.arc(cx, cy, POINT_R, 0, Math.PI * 2);
    ctx.fillStyle   = color;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Vertical dashed guide to x-axis
    const [, oy] = viewport.toCanvas(0, 0);
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = `${color}60`;
    ctx.lineWidth   = 1;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, oy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label: (x, y) values below/above point
    ctx.fillStyle    = color;
    ctx.font         = 'bold 12px monospace';
    ctx.textAlign    = 'center';
    const labelY     = pt.y >= 0 ? cy + LABEL_OFFSET + 10 : cy - LABEL_OFFSET - 2;
    ctx.textBaseline = pt.y >= 0 ? 'top' : 'bottom';
    ctx.fillText(`P${i + 1}`, cx, labelY);
  });

  ctx.restore();
}
