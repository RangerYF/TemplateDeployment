import type { Viewport } from '@/canvas/Viewport';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Parameterised transform for y = A · trig(ω·x + φ) + k */
export interface TrigParams {
  A:     number;   // amplitude  — vertical scale
  omega: number;   // angular frequency (ω)
  phi:   number;   // phase shift in radians (φ)
  k:     number;   // vertical offset
}

/** One sampled point on a trigonometric curve. */
export interface TrigSamplePoint {
  x:       number;
  y:       number;
  /** true → lift pen here (tan(x) asymptote crossing). */
  isBreak: boolean;
  /** false → point is NaN / ±Inf / far outside clip range; skip entirely. */
  isValid: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * If |Δy| between two consecutive valid samples exceeds
 * `yRange × BREAK_THRESHOLD`, treat as a discontinuity (tan asymptote).
 * Mirrors M02's sampler.ts value.
 */
const BREAK_THRESHOLD = 2.5;

/**
 * Points further than `yRange × CLIP_FACTOR` beyond the viewport y-range
 * are marked invalid and skipped.  Keeps the Canvas path finite even for
 * extreme zoom-out values.
 */
const CLIP_FACTOR = 10;

// ─── Core: generateSinePath ───────────────────────────────────────────────────

/**
 * Sample **y = A · sin(ω·x + φ) + k** across the viewport x-range.
 *
 * This is the primary reusable unit for M04's sin-curve rendering.
 * It calls the generalised `generateTrigPath` internally; exported separately
 * so callers that only need sin curves don't have to import `TrigParams`.
 *
 * @param A      Amplitude
 * @param omega  Angular frequency (ω)
 * @param phi    Phase shift in radians (φ)
 * @param k      Vertical offset
 * @param viewport  Current Viewport (determines x-range and clipping)
 * @param steps  Number of sample intervals (default 800; use 400 during animation)
 *
 * @example
 * ```typescript
 * const pts = generateSinePath(2, 1, Math.PI / 4, 1, viewport);
 * renderTrigCurve(ctx, pts, viewport, '#32D583');
 * ```
 */
export function generateSinePath(
  A:     number,
  omega: number,
  phi:   number,
  k:     number,
  viewport: Viewport,
  steps = 800,
): TrigSamplePoint[] {
  return generateTrigPath({ A, omega, phi, k }, 'sin', viewport, steps);
}

// ─── Core: generateTrigPath ───────────────────────────────────────────────────

/**
 * Generalised sampler for `sin | cos | tan`.
 *
 * Handles:
 *  - Vertical clipping: points beyond `±CLIP_FACTOR·yRange` are `isValid=false`
 *  - Break detection (tan asymptotes):
 *      1. `|Δy| > yRange × BREAK_THRESHOLD`
 *      2. Sign-flip with at least one `|y| > yRange × 1.5` (asymptote crossing)
 *
 * The returned array is ready to pass directly to `renderTrigCurve`.
 */
export function generateTrigPath(
  params: TrigParams,
  type:   'sin' | 'cos' | 'tan',
  viewport: Viewport,
  steps = 800,
): TrigSamplePoint[] {
  const { A, omega, phi, k } = params;
  const { xMin, xMax, yRange } = viewport;

  const dx             = (xMax - xMin) / steps;
  const breakThreshold = yRange * BREAK_THRESHOLD;
  const clipHigh       = viewport.yMax + yRange * CLIP_FACTOR;
  const clipLow        = viewport.yMin - yRange * CLIP_FACTOR;

  const pts: TrigSamplePoint[] = [];
  let prevValidY: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const x   = xMin + i * dx;
    const arg = omega * x + phi;

    // ── Evaluate ─────────────────────────────────────────────────────────
    let rawY: number;
    switch (type) {
      case 'sin':
        rawY = A * Math.sin(arg) + k;
        break;
      case 'cos':
        rawY = A * Math.cos(arg) + k;
        break;
      case 'tan': {
        const cosVal = Math.cos(arg);
        // Near-zero cosine → asymptote; use Infinity so isValid check catches it
        rawY = Math.abs(cosVal) < 1e-10 ? Infinity : A * Math.tan(arg) + k;
        break;
      }
    }

    // ── Validity check ────────────────────────────────────────────────────
    const isValid = isFinite(rawY) && rawY >= clipLow && rawY <= clipHigh;

    if (!isValid) {
      pts.push({ x, y: rawY, isValid: false, isBreak: false });
      prevValidY = null;
      continue;
    }

    // ── Discontinuity detection ───────────────────────────────────────────
    let isBreak = false;
    if (prevValidY !== null) {
      const deltaY = Math.abs(rawY - prevValidY);
      if (deltaY > breakThreshold) {
        // Condition 1: large jump (tan asymptote)
        isBreak = true;
      } else if (
        Math.sign(rawY) !== Math.sign(prevValidY) &&
        (Math.abs(rawY) > yRange * 1.5 || Math.abs(prevValidY) > yRange * 1.5)
      ) {
        // Condition 2: sign flip near y = ±∞ (asymptote crossing)
        isBreak = true;
      }
    }

    pts.push({ x, y: rawY, isValid: true, isBreak });
    prevValidY = isBreak ? null : rawY;
  }

  return pts;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Render a `TrigSamplePoint[]` array as a 2D canvas path.
 *
 * Pen-lift logic (mirrors M02's `curveRenderer.renderCurve`):
 *  - `isValid = false`               → skip point
 *  - `isValid = true, isBreak = true` → `moveTo` (lift pen)
 *  - first valid point in a segment   → `moveTo`
 *  - subsequent points                → `lineTo`
 *
 * @param options.lineWidth  Stroke width in canvas pixels (default 2).
 * @param options.lineDash   Dash pattern (default solid `[]`).
 * @param options.alpha      Global alpha 0–1 (default 1).
 */
export function renderTrigCurve(
  ctx:      CanvasRenderingContext2D,
  points:   TrigSamplePoint[],
  viewport: Viewport,
  color:    string,
  options?: {
    lineWidth?: number;
    lineDash?:  number[];
    alpha?:     number;
  },
): void {
  const lineWidth = options?.lineWidth ?? 2;
  const lineDash  = options?.lineDash  ?? [];
  const alpha     = options?.alpha     ?? 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.setLineDash(lineDash);

  ctx.beginPath();
  let penDown = false;

  for (const pt of points) {
    if (!pt.isValid) {
      penDown = false;
      continue;
    }

    const [cx, cy] = viewport.toCanvas(pt.x, pt.y);

    if (!penDown || pt.isBreak) {
      ctx.moveTo(cx, cy);
      penDown = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }

  ctx.stroke();
  ctx.restore();
}

// ─── Utility: formula text ────────────────────────────────────────────────────

/**
 * Build a human-readable formula string for the current TrigParams.
 * Omits coefficient `1` and addend `0` for cleaner display.
 * Does NOT use KaTeX — plain Unicode is sufficient for M03's demo UI.
 *
 * @example
 * buildFormulaText({ A: 2, omega: 3, phi: Math.PI / 4, k: -1 }, 'sin')
 * // → "y = 2·sin(3x + 0.79) - 1"
 */
export function buildFormulaText(params: TrigParams, type: 'sin' | 'cos' | 'tan'): string {
  const { A, omega, phi, k } = params;

  // Amplitude coefficient
  const AStr =
    A === 1   ? ''  :
    A === -1  ? '-' :
    `${+A.toFixed(2)}·`;

  // Angular frequency coefficient
  const omegaStr = omega === 1 ? '' : `${+omega.toFixed(2)}`;

  // Phase shift (show as decimal when non-zero)
  let phiStr = '';
  if (Math.abs(phi) > 1e-6) {
    const phiRounded = +phi.toFixed(2);
    phiStr = phiRounded >= 0 ? ` + ${phiRounded}` : ` - ${Math.abs(phiRounded)}`;
  }

  // Vertical offset
  let kStr = '';
  if (Math.abs(k) > 1e-6) {
    const kRounded = +k.toFixed(2);
    kStr = kRounded >= 0 ? ` + ${kRounded}` : ` - ${Math.abs(kRounded)}`;
  }

  return `y = ${AStr}${type}(${omegaStr}x${phiStr})${kStr}`;
}
