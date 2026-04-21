import type { Viewport } from '@/canvas/Viewport';
import { choosePiStep, generatePiTicks } from '@/engine/piAxisEngine';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Grid step candidates (math units). Covers 0.001-zoom to city-block scale. */
const STEP_CANDIDATES = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

/** Target pixel range per grid cell. */
const TARGET_MIN_PX = 40;
const TARGET_MAX_PX = 120;

const ARROW_SIZE = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pick the first step candidate that fits in [TARGET_MIN_PX, TARGET_MAX_PX].
 *  Fallback: first candidate that exceeds TARGET_MIN_PX (prevents invisible grid). */
function pickStep(range: number, pixels: number): number {
  const pxPerUnit = pixels / range;
  for (const s of STEP_CANDIDATES) {
    const stepPx = s * pxPerUnit;
    if (stepPx >= TARGET_MIN_PX && stepPx <= TARGET_MAX_PX) return s;
  }
  // Fallback: pick first candidate that is at least TARGET_MIN_PX wide
  for (const s of STEP_CANDIDATES) {
    if (s * pxPerUnit >= TARGET_MIN_PX) return s;
  }
  return STEP_CANDIDATES[STEP_CANDIDATES.length - 1];
}

function formatLabel(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value));
  return value.toFixed(1);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Theme colors for `renderAxis`.  All fields are optional; defaults match the
 * M02 light theme so existing callers are unaffected.
 *
 * For M03 dark theme, pass `AXIS_THEME_DARK`:
 * ```typescript
 * import { AXIS_THEME_DARK } from '@/canvas/renderers/axisRenderer';
 * renderAxis(ctx, vp, { showGrid: true, ...AXIS_THEME_DARK });
 * ```
 */
export interface AxisTheme {
  background?: string;   // canvas fill           (default '#FFFFFF')
  gridColor?:  string;   // grid line stroke      (default '#E5E7EB')
  axisColor?:  string;   // axis + arrow + origin (default '#374151')
  labelColor?: string;   // tick label text       (default '#9CA3AF')
}

/** Ready-made dark-theme preset for M03. */
export const AXIS_THEME_DARK: Required<AxisTheme> = {
  background: '#1A1A1E',
  gridColor:  '#2D2D32',
  axisColor:  '#4B5563',
  labelColor: '#6B7280',
};

/**
 * Render coordinate axes, optional grid, tick labels, origin marker, and
 * axis arrows onto `ctx`.
 *
 * @param options.showGrid    Draw grid lines (default true).
 * @param options.background  Canvas fill color.
 * @param options.gridColor   Grid line stroke color.
 * @param options.axisColor   Axis line, arrow, and origin dot color.
 * @param options.labelColor  Tick label text color.
 * @param options.piMode      When true, x-axis uses π-fraction labels (default false).
 */
export function renderAxis(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  options?: { showGrid?: boolean; piMode?: boolean; showLabels?: boolean } & AxisTheme,
): void {
  const { width, height, xMin, xMax, yMin, yMax, xRange, yRange } = viewport;
  const showGrid   = options?.showGrid   ?? true;
  const piMode     = options?.piMode     ?? false;
  const showLabels = options?.showLabels ?? true;
  const background = options?.background ?? '#FFFFFF';
  const gridColor  = options?.gridColor  ?? '#E5E7EB';
  const axisColor  = options?.axisColor  ?? '#374151';
  const labelColor = options?.labelColor ?? '#374151';

  // ── Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const xStep = pickStep(xRange, width);
  const yStep = pickStep(yRange, height);

  // ── Grid lines ──────────────────────────────────────────────────────────
  if (showGrid) {
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    // Vertical grid lines (constant x values)
    const xStart = Math.ceil(xMin / xStep) * xStep;
    for (let xi = xStart; xi <= xMax + xStep * 0.001; xi += xStep) {
      const [cx] = viewport.toCanvas(xi, 0);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
    }

    // Horizontal grid lines (constant y values)
    const yStart = Math.ceil(yMin / yStep) * yStep;
    for (let yi = yStart; yi <= yMax + yStep * 0.001; yi += yStep) {
      const [, cy] = viewport.toCanvas(0, yi);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  // ── Axes ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  const [axisX] = viewport.toCanvas(0, 0);
  const [, axisY] = viewport.toCanvas(0, 0);

  // X-axis (horizontal)
  ctx.beginPath();
  ctx.moveTo(0, axisY);
  ctx.lineTo(width, axisY);
  ctx.stroke();

  // Y-axis (vertical)
  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX, height);
  ctx.stroke();

  // ── Axis arrows ─────────────────────────────────────────────────────────
  ctx.fillStyle = axisColor;

  // X-axis right arrow (always at right edge)
  ctx.beginPath();
  ctx.moveTo(width, axisY);
  ctx.lineTo(width - ARROW_SIZE, axisY - ARROW_SIZE / 2);
  ctx.lineTo(width - ARROW_SIZE, axisY + ARROW_SIZE / 2);
  ctx.closePath();
  ctx.fill();

  // Y-axis top arrow (always at top edge)
  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX - ARROW_SIZE / 2, ARROW_SIZE);
  ctx.lineTo(axisX + ARROW_SIZE / 2, ARROW_SIZE);
  ctx.closePath();
  ctx.fill();

  // ── Tick labels ─────────────────────────────────────────────────────────
  if (showLabels) {
  ctx.fillStyle = labelColor;
  ctx.font = '600 13px -apple-system,"Helvetica Neue",Arial,sans-serif';

  // X-axis labels: below the X-axis line (clamped to canvas)
  const labelOffsetY = 4;
  const labelH = 14;
  const xLabelY = Math.min(Math.max(axisY + labelOffsetY, 0), height - labelH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  if (piMode) {
    // π-fraction labels for trig-function canvases
    const piStep  = choosePiStep(viewport);
    const piTicks = generatePiTicks(xMin, xMax, piStep);
    for (const { value, label } of piTicks) {
      if (Math.abs(value) < piStep * 0.01) continue;  // skip origin
      const [cx] = viewport.toCanvas(value, 0);
      if (cx < 5 || cx > width - 5) continue;
      ctx.fillText(label, cx, xLabelY);
    }
  } else {
    const xLabelStart = Math.ceil(xMin / xStep) * xStep;
    for (let xi = xLabelStart; xi <= xMax + xStep * 0.001; xi += xStep) {
      if (Math.abs(xi) < xStep * 0.01) continue; // skip origin
      const [cx] = viewport.toCanvas(xi, 0);
      if (cx < 5 || cx > width - 5) continue;    // skip if too close to edge
      ctx.fillText(formatLabel(xi, xStep), cx, xLabelY);
    }
  }

  // Y-axis labels: to the left of the Y-axis line (clamped to canvas)
  const labelOffsetX = 4;
  const yLabelX = Math.max(axisX - labelOffsetX, 30);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const yLabelStart = Math.ceil(yMin / yStep) * yStep;
  for (let yi = yLabelStart; yi <= yMax + yStep * 0.001; yi += yStep) {
    if (Math.abs(yi) < yStep * 0.01) continue; // skip origin
    const [, cy] = viewport.toCanvas(0, yi);
    if (cy < 5 || cy > height - 5) continue;   // skip if too close to edge
    ctx.fillText(formatLabel(yi, yStep), yLabelX, cy);
  }
  } // end showLabels

  // ── Origin marker ───────────────────────────────────────────────────────
  if (
    axisX >= 0 && axisX <= width &&
    axisY >= 0 && axisY <= height
  ) {
    ctx.fillStyle = axisColor;
    ctx.beginPath();
    ctx.arc(axisX, axisY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
