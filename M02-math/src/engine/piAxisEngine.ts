/**
 * piAxisEngine — M04 Phase 1
 *
 * Utilities for rendering π-fraction axis labels on the function-graph canvas.
 * Used by axisRenderer (piMode=true) and usePiSlider (Phase 3).
 */

import type { Viewport } from '@/canvas/Viewport';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * π-fraction step candidates in ascending order.
 * Chosen to cover all common trig-function x-axis scales.
 */
const PI_STEPS = [
  Math.PI / 12,    // π/12
  Math.PI / 6,     // π/6
  Math.PI / 4,     // π/4
  Math.PI / 3,     // π/3
  Math.PI / 2,     // π/2
  Math.PI,         // π
  2 * Math.PI,     // 2π
  3 * Math.PI,     // 3π
  4 * Math.PI,     // 4π
];

const TARGET_MIN_PX = 40;
const TARGET_MAX_PX = 120;

// ─── formatPiLabel ────────────────────────────────────────────────────────────

/**
 * Format a radian value as a Unicode π-fraction string suitable for canvas
 * `ctx.fillText` labels (e.g. "π/6", "-2π/3", "π", "-π").
 *
 * Tries denominators {1, 2, 3, 4, 6, 12} in order.
 * Falls back to 2-decimal string if no match is found.
 *
 * @example
 * formatPiLabel(Math.PI / 3)          // "π/3"
 * formatPiLabel(-2 * Math.PI / 3)     // "-2π/3"
 * formatPiLabel(Math.PI)              // "π"
 * formatPiLabel(0)                    // "0"
 */
export function formatPiLabel(value: number): string {
  if (Math.abs(value) < 1e-10) return '0';

  const DENOMINATORS = [1, 2, 3, 4, 6, 12];

  for (const d of DENOMINATORS) {
    const n = Math.round(value / (Math.PI / d));
    if (Math.abs(n * Math.PI / d - value) < 1e-9) {
      if (n === 0) return '0';
      const sign   = n < 0 ? '-' : '';
      const absN   = Math.abs(n);
      if (d === 1) {
        return absN === 1 ? `${sign}π` : `${sign}${absN}π`;
      }
      return absN === 1 ? `${sign}π/${d}` : `${sign}${absN}π/${d}`;
    }
  }

  return value.toFixed(2);
}

/**
 * Like `formatPiLabel` but returns a LaTeX string for KaTeX rendering
 * (e.g. "\\frac{\\pi}{6}", "-\\frac{2\\pi}{3}").
 * Used by usePiSlider (Phase 3) and KaTeXRenderer.
 */
export function formatPiLatex(value: number): string {
  if (Math.abs(value) < 1e-10) return '0';

  const DENOMINATORS = [1, 2, 3, 4, 6, 12];

  for (const d of DENOMINATORS) {
    const n = Math.round(value / (Math.PI / d));
    if (Math.abs(n * Math.PI / d - value) < 1e-9) {
      if (n === 0) return '0';
      const sign = n < 0 ? '-' : '';
      const absN = Math.abs(n);
      if (d === 1) {
        return absN === 1 ? `${sign}\\pi` : `${sign}${absN}\\pi`;
      }
      const num = absN === 1 ? '\\pi' : `${absN}\\pi`;
      return `${sign}\\frac{${num}}{${d}}`;
    }
  }

  return value.toFixed(4);
}

// ─── choosePiStep ─────────────────────────────────────────────────────────────

/**
 * Select the most readable π-fraction step for a given viewport.
 * Picks the first step whose pixel width falls in [TARGET_MIN_PX, TARGET_MAX_PX].
 */
export function choosePiStep(viewport: Viewport): number {
  const pxPerUnit = viewport.width / viewport.xRange;

  for (const s of PI_STEPS) {
    const stepPx = s * pxPerUnit;
    if (stepPx >= TARGET_MIN_PX && stepPx <= TARGET_MAX_PX) return s;
  }

  // Fallback: last (largest) step
  return PI_STEPS[PI_STEPS.length - 1];
}

// ─── generatePiTicks ─────────────────────────────────────────────────────────

/**
 * Generate all tick positions and labels for a π-fraction x-axis.
 *
 * @param xMin   Left viewport bound (math coords)
 * @param xMax   Right viewport bound (math coords)
 * @param step   Step size returned by `choosePiStep`
 *
 * @returns Array of `{ value, label }` pairs where `label` is a Unicode
 *          π-fraction string (ready for `ctx.fillText`).
 */
export function generatePiTicks(
  xMin: number,
  xMax: number,
  step: number,
): { value: number; label: string }[] {
  const ticks: { value: number; label: string }[] = [];
  const startN = Math.ceil(xMin / step - 1e-9);
  const endN   = Math.floor(xMax / step + 1e-9);

  for (let n = startN; n <= endN; n++) {
    const value = n * step;
    ticks.push({ value, label: formatPiLabel(value) });
  }

  return ticks;
}
