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

function formatCoord(value: number): string {
  if (Math.abs(value) < 1e-6) return '0';
  const roundedInt = Math.round(value);
  if (Math.abs(value - roundedInt) < 1e-4) return String(roundedInt);
  const rounded2 = Number(value.toFixed(2));
  if (Math.abs(value - rounded2) < 1e-6) return String(rounded2);
  return String(Number(value.toFixed(3)));
}

function formatPointCoord(x: number, y: number): string {
  return `(${formatCoord(x)}, ${formatCoord(y)})`;
}

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

function renderPointLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  coordText: string,
  anchorX: number,
  anchorY: number,
  color: string,
  viewport: Viewport,
): void {
  ctx.save();

  const padX = 8;
  const padY = 5;
  const gap = 10;
  const lineGap = 3;
  const titleFont = 'bold 11px monospace';
  const coordFont = '11px monospace';

  ctx.font = titleFont;
  const labelW = ctx.measureText(label).width;
  ctx.font = coordFont;
  const coordW = ctx.measureText(coordText).width;

  const boxW = Math.ceil(Math.max(labelW, coordW) + padX * 2);
  const boxH = 35;
  let boxX = anchorX + gap;
  let boxY = anchorY - boxH - gap;

  if (boxX + boxW > viewport.width - 6) boxX = anchorX - boxW - gap;
  if (boxY < 6) boxY = anchorY + gap;

  boxX = Math.max(4, Math.min(boxX, viewport.width - boxW - 4));
  boxY = Math.max(4, Math.min(boxY, viewport.height - boxH - 4));

  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 5);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(color, 0.75);
  ctx.lineWidth = 1;
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 5);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = titleFont;
  ctx.fillStyle = color;
  ctx.fillText(label, boxX + padX, boxY + padY);

  ctx.font = coordFont;
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(coordText, boxX + padX, boxY + padY + 12 + lineGap);

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

    renderPointLabel(ctx, pin.label, formatPointCoord(pin.mathX, pin.mathY), px, py, fn.color, viewport);

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

    renderPointLabel(
      ctx,
      `X ${pin.label}`,
      formatPointCoord(pin.mathX, pin.mathY),
      px,
      py,
      XSECT_COLOR,
      viewport,
    );

    ctx.restore();
  }

  // ── 3. Hovered curve snap tooltip (curve highlight is drawn by FunctionCanvas) ─
  if (hoveredPoint?.isVisible && !hoveredIntersection) {
    const fn = functions.find((f) => f.id === hoveredPoint.functionId);
    if (fn) {
      const { canvasX, canvasY } = hoveredPoint;
      renderTooltip(
        ctx,
        formatPointCoord(hoveredPoint.mathX, hoveredPoint.mathY),
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

    // Tooltip with X prefix
    renderTooltip(
      ctx,
      formatPointCoord(hoveredIntersection.mathX, hoveredIntersection.mathY),
      canvasX, canvasY,
      XSECT_COLOR,
      viewport,
      'X',
    );
  }
}
