import type { Viewport } from '@/canvas/Viewport';
import type { FunctionEntry } from '@/types';
import { COLORS } from '@/styles/colors';
import type {
  HoveredPoint,
  PinnedPoint,
  IntersectionHover,
  PinnedIntersection,
} from '@/editor/store/interactionStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a 6-digit hex colour string to an rgba(...) string. */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Draw a rounded rectangle path (without fill/stroke — caller decides). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

/** Intersection accent colour — amber, distinct from any function colour. */
const XSECT_COLOR = '#FBBF24';

/**
 * Draw a ⊕ crosshair marker (circle + perpendicular lines) at (cx, cy).
 * `r` is the outer radius.
 */
function drawCrosshairMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  glow = false,
): void {
  ctx.save();

  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur  = 14;
  }

  // Circle
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair lines (horizontal + vertical through centre)
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - r + 2, cy);
  ctx.lineTo(cx + r - 2, cy);
  ctx.moveTo(cx, cy - r + 2);
  ctx.lineTo(cx, cy + r - 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a two-colour arc ring (each half-arc uses one function's colour).
 * Used for pinned intersection markers.
 */
function drawBicolorRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color1: string,
  color2: string,
): void {
  ctx.save();
  ctx.lineWidth = 3;

  // Top half — color1
  ctx.strokeStyle = color1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.stroke();

  // Bottom half — color2
  ctx.strokeStyle = color2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.stroke();

  ctx.restore();
}

/** Render a floating coordinate tooltip. */
function renderTooltip(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchorX: number,
  anchorY: number,
  color: string,
  viewport: Viewport,
  prefix = '',
): void {
  ctx.save();
  ctx.font         = '12px monospace';
  ctx.textBaseline = 'middle';

  const fullText = prefix ? `${prefix} ${text}` : text;
  const textW    = ctx.measureText(fullText).width;
  const padX     = 8;
  const ttW      = textW + padX * 2;
  const ttH      = 22;
  const OFFSET   = 14;

  let ttX = anchorX + OFFSET;
  let ttY = anchorY - OFFSET - ttH;

  if (ttX + ttW > viewport.width  - 6) ttX = anchorX - OFFSET - ttW;
  if (ttY < 6)                          ttY = anchorY + OFFSET;

  ttX = Math.max(4, Math.min(ttX, viewport.width  - ttW - 4));
  ttY = Math.max(4, Math.min(ttY, viewport.height - ttH - 4));

  ctx.fillStyle = 'rgba(17, 24, 39, 0.88)';
  roundRectPath(ctx, ttX, ttY, ttW, ttH, 4);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(color, 0.7);
  ctx.lineWidth   = 1;
  roundRectPath(ctx, ttX, ttY, ttW, ttH, 4);
  ctx.stroke();

  ctx.fillStyle = '#F0F0F0';
  ctx.textAlign = 'left';
  ctx.fillText(fullText, ttX + padX, ttY + ttH / 2);

  ctx.restore();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Render the dynamic interaction layer onto `ctx`.
 * Called every animation frame; always clears before drawing.
 *
 * Draws (back to front):
 *  1. Pinned curve marker points (P1, P2, …)
 *  2. Pinned intersection markers (X1, X2, …)
 *  3. Hovered curve snap indicator + tooltip
 *  4. Hovered intersection indicator + tooltip  ← highest visual priority
 */
export function renderDynamic(
  ctx: CanvasRenderingContext2D,
  hoveredPoint: HoveredPoint | null,
  pinnedPoints: PinnedPoint[],
  functions: FunctionEntry[],
  viewport: Viewport,
  hoveredIntersection?: IntersectionHover | null,
  pinnedIntersections?: PinnedIntersection[],
): void {
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  // ── 1. Pinned curve marker points ─────────────────────────────────────
  for (const pin of pinnedPoints) {
    const fn = functions.find((f) => f.id === pin.functionId);
    if (!fn) continue;

    const [px, py] = viewport.toCanvas(pin.mathX, pin.mathY);

    ctx.save();

    // Outer ring
    ctx.strokeStyle = fn.color;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Inner fill
    ctx.fillStyle = hexToRgba(fn.color, 0.3);
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();

    // Label (P1, P2 …) above the point
    ctx.fillStyle    = fn.color;
    ctx.font         = 'bold 11px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(pin.label, px + 10, py - 4);

    // Coordinate text
    const coordText = `(${pin.mathX.toFixed(2)}, ${pin.mathY.toFixed(2)})`;
    ctx.font         = '10px monospace';
    ctx.fillStyle    = '#D1D5DB';
    ctx.fillText(coordText, px + 10, py + 8);

    ctx.restore();
  }

  // ── 2. Pinned intersection markers ────────────────────────────────────
  for (const pin of (pinnedIntersections ?? [])) {
    const fn1 = functions.find((f) => f.id === pin.fnId1);
    const fn2 = functions.find((f) => f.id === pin.fnId2);

    const [px, py] = viewport.toCanvas(pin.mathX, pin.mathY);

    ctx.save();

    // Bi-colour ring
    drawBicolorRing(ctx, px, py, 8, fn1?.color ?? XSECT_COLOR, fn2?.color ?? XSECT_COLOR);

    // Amber inner fill
    ctx.fillStyle = 'rgba(251,191,36,0.15)';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();

    // Crosshair
    ctx.strokeStyle = XSECT_COLOR;
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.moveTo(px - 5, py);
    ctx.lineTo(px + 5, py);
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px, py + 5);
    ctx.stroke();

    // Label (X1, X2 …)
    ctx.fillStyle    = XSECT_COLOR;
    ctx.font         = 'bold 11px monospace';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(pin.label, px + 11, py - 4);

    // Coordinate text
    ctx.font      = '10px monospace';
    ctx.fillStyle = '#D1D5DB';
    ctx.fillText(`(${pin.mathX.toFixed(3)}, ${pin.mathY.toFixed(3)})`, px + 11, py + 8);

    ctx.restore();
  }

  // ── 3. Hovered curve snap tooltip (curve highlight is drawn by FunctionCanvas) ─
  if (hoveredPoint?.isVisible && !hoveredIntersection) {
    const fn = functions.find((f) => f.id === hoveredPoint.functionId);
    if (fn) {
      const { canvasX, canvasY } = hoveredPoint;
      const xLabel = hoveredPoint.mathX.toFixed(2);
      const yLabel = hoveredPoint.mathY.toFixed(2);
      renderTooltip(
        ctx,
        `(${xLabel}, ${yLabel})`,
        canvasX, canvasY,
        COLORS.primary,
        viewport,
      );
    }
  }

  // ── 4. Hovered intersection indicator (highest priority) ──────────────
  if (hoveredIntersection) {
    const { canvasX, canvasY } = hoveredIntersection;
    const fn1 = functions.find((f) => f.id === hoveredIntersection.fnId1);
    const fn2 = functions.find((f) => f.id === hoveredIntersection.fnId2);

    // Glow behind marker
    ctx.save();
    ctx.shadowColor = XSECT_COLOR;
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = 'rgba(251,191,36,0.18)';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bi-colour ring + crosshair
    drawBicolorRing(
      ctx, canvasX, canvasY, 9,
      fn1?.color ?? XSECT_COLOR,
      fn2?.color ?? XSECT_COLOR,
    );
    drawCrosshairMarker(ctx, canvasX, canvasY, 9, XSECT_COLOR, true);

    // Tooltip with ∩ prefix
    const xLabel = hoveredIntersection.mathX.toFixed(3);
    const yLabel = hoveredIntersection.mathY.toFixed(3);
    renderTooltip(
      ctx,
      `(${xLabel}, ${yLabel})`,
      canvasX, canvasY,
      XSECT_COLOR,
      viewport,
      '∩',
    );
  }
}
