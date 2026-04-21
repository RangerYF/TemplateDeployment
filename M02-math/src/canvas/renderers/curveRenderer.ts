import type { Viewport } from '@/canvas/Viewport';
import type { SamplePoint } from '@/engine/sampler';
import { COLORS } from '@/styles/colors';

/** Unified highlight colour for all hover / selection glow effects. */
const GLOW_COLOR = COLORS.primary;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Render a sampled function curve as a 2D path.
 *
 * Discontinuity handling (informed by `SamplePoint.isBreak`):
 *  - `isValid = false`                     → skip point entirely
 *  - `isValid = true`, `isBreak = true`    → moveTo  (lift pen at discontinuity)
 *  - `isValid = true`, `isBreak = false`,
 *    first valid point in sub-path         → moveTo
 *  - `isValid = true`, `isBreak = false`,
 *    subsequent points                     → lineTo
 *
 * @param options.lineWidth  Stroke width in canvas pixels (default 2).
 * @param options.lineDash   Dash pattern, e.g. [5, 4] (default solid []).
 * @param options.alpha      Global alpha 0–1 (default 1).
 */
export function renderCurve(
  ctx: CanvasRenderingContext2D,
  points: SamplePoint[],
  viewport: Viewport,
  color: string,
  options?: {
    lineWidth?: number;
    lineDash?: number[];
    alpha?: number;
    /** When true, draw a glow effect behind the curve (for selected highlight). */
    glow?: boolean;
  },
): void {
  const lineWidth = options?.lineWidth ?? 2;
  const lineDash  = options?.lineDash  ?? [];
  const alpha     = options?.alpha     ?? 1;
  const glow      = options?.glow      ?? false;

  // Build the path once, reuse for glow + main stroke
  const buildPath = () => {
    ctx.beginPath();
    let hasMoveTo = false;
    for (const pt of points) {
      if (!pt.isValid) {
        hasMoveTo = false;
        continue;
      }
      const [cx, cy] = viewport.toCanvas(pt.x, pt.y);
      if (!hasMoveTo || pt.isBreak) {
        ctx.moveTo(cx, cy);
        hasMoveTo = true;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
  };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap  = 'round';
  ctx.setLineDash(lineDash);

  // Glow pass: wider, semi-transparent stroke with shadow blur
  if (glow) {
    ctx.save();
    ctx.globalAlpha  = 0.35;
    ctx.strokeStyle  = GLOW_COLOR;
    ctx.lineWidth    = lineWidth + 6;
    ctx.shadowColor  = GLOW_COLOR;
    ctx.shadowBlur   = 18;
    buildPath();
    ctx.stroke();
    ctx.restore();
  }

  // Main stroke
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  buildPath();
  ctx.stroke();

  ctx.restore();
}
