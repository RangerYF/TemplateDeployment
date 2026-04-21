/**
 * exactValueEngine — M04 Phase 1
 *
 * Lookup table for all 24 standard angles (π/12 step, 0 to 23π/12)
 * that appear on the Chinese high-school (人教版) trig curriculum.
 *
 * lookupAngle(rad) snaps within ±3° (SNAP_TOLERANCE_RAD) to a special angle.
 * approximateValues(rad) returns 4-decimal approximations for non-special angles.
 */

import type { ExactValue, SpecialAngleValues } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Snap radius: ±3° (human-perceivable "close enough"). */
export const SNAP_TOLERANCE_RAD = 3 * Math.PI / 180;

const TWO_PI = 2 * Math.PI;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ev(latex: string, decimal: number): ExactValue {
  return { latex, decimal, isExact: true };
}

const UNDEFINED_TAN: ExactValue = { latex: '\\text{不存在}', decimal: Infinity, isExact: true };

// ─── Exact-value lookup table (24 entries) ────────────────────────────────────
//
// Each entry covers one canonical angle in [0, 2π).
// sin/cos values use the following exact-form LaTeX strings:
//   0          → '0'
//   1/2        → '\\frac{1}{2}'
//   √2/2       → '\\frac{\\sqrt{2}}{2}'
//   √3/2       → '\\frac{\\sqrt{3}}{2}'
//   1          → '1'
//   −½ … etc.  → negative prefix '−'
//   (√6±√2)/4  → '\\frac{\\sqrt{6}\\pm\\sqrt{2}}{4}'
// tan values:
//   0, ±1, ±√3, ±√3/3, ±(2±√3)

const EXACT_VALUE_TABLE: SpecialAngleValues[] = [
  // ── k=0: θ = 0 ──────────────────────────────────────────────────────────────
  {
    angleFraction: '0',
    angleDecimal: 0,
    sin: ev('0',   0),
    cos: ev('1',   1),
    tan: ev('0',   0),
  },
  // ── k=1: θ = π/12 (15°) ─────────────────────────────────────────────────────
  {
    angleFraction: '\\frac{\\pi}{12}',
    angleDecimal: Math.PI / 12,
    sin: ev('\\frac{\\sqrt{6}-\\sqrt{2}}{4}', Math.sin(Math.PI / 12)),
    cos: ev('\\frac{\\sqrt{6}+\\sqrt{2}}{4}', Math.cos(Math.PI / 12)),
    tan: ev('2-\\sqrt{3}',                     Math.tan(Math.PI / 12)),
  },
  // ── k=2: θ = π/6 (30°) ──────────────────────────────────────────────────────
  {
    angleFraction: '\\frac{\\pi}{6}',
    angleDecimal: Math.PI / 6,
    sin: ev('\\frac{1}{2}',         0.5),
    cos: ev('\\frac{\\sqrt{3}}{2}', Math.cos(Math.PI / 6)),
    tan: ev('\\frac{\\sqrt{3}}{3}', Math.tan(Math.PI / 6)),
  },
  // ── k=3: θ = π/4 (45°) ──────────────────────────────────────────────────────
  {
    angleFraction: '\\frac{\\pi}{4}',
    angleDecimal: Math.PI / 4,
    sin: ev('\\frac{\\sqrt{2}}{2}', Math.SQRT2 / 2),
    cos: ev('\\frac{\\sqrt{2}}{2}', Math.SQRT2 / 2),
    tan: ev('1',                    1),
  },
  // ── k=4: θ = π/3 (60°) ──────────────────────────────────────────────────────
  {
    angleFraction: '\\frac{\\pi}{3}',
    angleDecimal: Math.PI / 3,
    sin: ev('\\frac{\\sqrt{3}}{2}', Math.sin(Math.PI / 3)),
    cos: ev('\\frac{1}{2}',         0.5),
    tan: ev('\\sqrt{3}',            Math.sqrt(3)),
  },
  // ── k=5: θ = 5π/12 (75°) ────────────────────────────────────────────────────
  {
    angleFraction: '\\frac{5\\pi}{12}',
    angleDecimal: 5 * Math.PI / 12,
    sin: ev('\\frac{\\sqrt{6}+\\sqrt{2}}{4}', Math.sin(5 * Math.PI / 12)),
    cos: ev('\\frac{\\sqrt{6}-\\sqrt{2}}{4}', Math.cos(5 * Math.PI / 12)),
    tan: ev('2+\\sqrt{3}',                     Math.tan(5 * Math.PI / 12)),
  },
  // ── k=6: θ = π/2 (90°) ──────────────────────────────────────────────────────
  {
    angleFraction: '\\frac{\\pi}{2}',
    angleDecimal: Math.PI / 2,
    sin: ev('1', 1),
    cos: ev('0', 0),
    tan: UNDEFINED_TAN,
  },
  // ── k=7: θ = 7π/12 (105°) ───────────────────────────────────────────────────
  {
    angleFraction: '\\frac{7\\pi}{12}',
    angleDecimal: 7 * Math.PI / 12,
    sin: ev('\\frac{\\sqrt{6}+\\sqrt{2}}{4}',  Math.sin(7 * Math.PI / 12)),
    cos: ev('-\\frac{\\sqrt{6}-\\sqrt{2}}{4}', Math.cos(7 * Math.PI / 12)),
    tan: ev('-(2+\\sqrt{3})',                   Math.tan(7 * Math.PI / 12)),
  },
  // ── k=8: θ = 2π/3 (120°) ────────────────────────────────────────────────────
  {
    angleFraction: '\\frac{2\\pi}{3}',
    angleDecimal: 2 * Math.PI / 3,
    sin: ev('\\frac{\\sqrt{3}}{2}',  Math.sin(2 * Math.PI / 3)),
    cos: ev('-\\frac{1}{2}',        -0.5),
    tan: ev('-\\sqrt{3}',           -Math.sqrt(3)),
  },
  // ── k=9: θ = 3π/4 (135°) ────────────────────────────────────────────────────
  {
    angleFraction: '\\frac{3\\pi}{4}',
    angleDecimal: 3 * Math.PI / 4,
    sin: ev('\\frac{\\sqrt{2}}{2}',  Math.SQRT2 / 2),
    cos: ev('-\\frac{\\sqrt{2}}{2}', -(Math.SQRT2 / 2)),
    tan: ev('-1',                    -1),
  },
  // ── k=10: θ = 5π/6 (150°) ───────────────────────────────────────────────────
  {
    angleFraction: '\\frac{5\\pi}{6}',
    angleDecimal: 5 * Math.PI / 6,
    sin: ev('\\frac{1}{2}',          0.5),
    cos: ev('-\\frac{\\sqrt{3}}{2}', -Math.cos(Math.PI / 6)),
    tan: ev('-\\frac{\\sqrt{3}}{3}', -Math.tan(Math.PI / 6)),
  },
  // ── k=11: θ = 11π/12 (165°) ─────────────────────────────────────────────────
  {
    angleFraction: '\\frac{11\\pi}{12}',
    angleDecimal: 11 * Math.PI / 12,
    sin: ev('\\frac{\\sqrt{6}-\\sqrt{2}}{4}', Math.sin(11 * Math.PI / 12)),
    cos: ev('-\\frac{\\sqrt{6}+\\sqrt{2}}{4}', Math.cos(11 * Math.PI / 12)),
    tan: ev('\\sqrt{3}-2',                     Math.tan(11 * Math.PI / 12)),
  },
  // ── k=12: θ = π (180°) ──────────────────────────────────────────────────────
  {
    angleFraction: '\\pi',
    angleDecimal: Math.PI,
    sin: ev('0',  0),
    cos: ev('-1', -1),
    tan: ev('0',  0),
  },
  // ── k=13: θ = 13π/12 (195°) ─────────────────────────────────────────────────
  {
    angleFraction: '\\frac{13\\pi}{12}',
    angleDecimal: 13 * Math.PI / 12,
    sin: ev('-\\frac{\\sqrt{6}-\\sqrt{2}}{4}', Math.sin(13 * Math.PI / 12)),
    cos: ev('-\\frac{\\sqrt{6}+\\sqrt{2}}{4}', Math.cos(13 * Math.PI / 12)),
    tan: ev('2-\\sqrt{3}',                     Math.tan(13 * Math.PI / 12)),
  },
  // ── k=14: θ = 7π/6 (210°) ───────────────────────────────────────────────────
  {
    angleFraction: '\\frac{7\\pi}{6}',
    angleDecimal: 7 * Math.PI / 6,
    sin: ev('-\\frac{1}{2}',        -0.5),
    cos: ev('-\\frac{\\sqrt{3}}{2}', -Math.cos(Math.PI / 6)),
    tan: ev('\\frac{\\sqrt{3}}{3}',  Math.tan(Math.PI / 6)),
  },
  // ── k=15: θ = 5π/4 (225°) ───────────────────────────────────────────────────
  {
    angleFraction: '\\frac{5\\pi}{4}',
    angleDecimal: 5 * Math.PI / 4,
    sin: ev('-\\frac{\\sqrt{2}}{2}', -(Math.SQRT2 / 2)),
    cos: ev('-\\frac{\\sqrt{2}}{2}', -(Math.SQRT2 / 2)),
    tan: ev('1',                     1),
  },
  // ── k=16: θ = 4π/3 (240°) ───────────────────────────────────────────────────
  {
    angleFraction: '\\frac{4\\pi}{3}',
    angleDecimal: 4 * Math.PI / 3,
    sin: ev('-\\frac{\\sqrt{3}}{2}', -Math.sin(Math.PI / 3)),
    cos: ev('-\\frac{1}{2}',         -0.5),
    tan: ev('\\sqrt{3}',              Math.sqrt(3)),
  },
  // ── k=17: θ = 17π/12 (255°) ─────────────────────────────────────────────────
  {
    angleFraction: '\\frac{17\\pi}{12}',
    angleDecimal: 17 * Math.PI / 12,
    sin: ev('-\\frac{\\sqrt{6}+\\sqrt{2}}{4}', Math.sin(17 * Math.PI / 12)),
    cos: ev('-\\frac{\\sqrt{6}-\\sqrt{2}}{4}', Math.cos(17 * Math.PI / 12)),
    tan: ev('2+\\sqrt{3}',                     Math.tan(17 * Math.PI / 12)),
  },
  // ── k=18: θ = 3π/2 (270°) ───────────────────────────────────────────────────
  {
    angleFraction: '\\frac{3\\pi}{2}',
    angleDecimal: 3 * Math.PI / 2,
    sin: ev('-1', -1),
    cos: ev('0',   0),
    tan: UNDEFINED_TAN,
  },
  // ── k=19: θ = 19π/12 (285°) ─────────────────────────────────────────────────
  {
    angleFraction: '\\frac{19\\pi}{12}',
    angleDecimal: 19 * Math.PI / 12,
    sin: ev('-\\frac{\\sqrt{6}+\\sqrt{2}}{4}', Math.sin(19 * Math.PI / 12)),
    cos: ev('\\frac{\\sqrt{6}-\\sqrt{2}}{4}',  Math.cos(19 * Math.PI / 12)),
    tan: ev('-(2+\\sqrt{3})',                   Math.tan(19 * Math.PI / 12)),
  },
  // ── k=20: θ = 5π/3 (300°) ───────────────────────────────────────────────────
  {
    angleFraction: '\\frac{5\\pi}{3}',
    angleDecimal: 5 * Math.PI / 3,
    sin: ev('-\\frac{\\sqrt{3}}{2}', -Math.sin(Math.PI / 3)),
    cos: ev('\\frac{1}{2}',           0.5),
    tan: ev('-\\sqrt{3}',            -Math.sqrt(3)),
  },
  // ── k=21: θ = 7π/4 (315°) ───────────────────────────────────────────────────
  {
    angleFraction: '\\frac{7\\pi}{4}',
    angleDecimal: 7 * Math.PI / 4,
    sin: ev('-\\frac{\\sqrt{2}}{2}', -(Math.SQRT2 / 2)),
    cos: ev('\\frac{\\sqrt{2}}{2}',   Math.SQRT2 / 2),
    tan: ev('-1',                     -1),
  },
  // ── k=22: θ = 11π/6 (330°) ──────────────────────────────────────────────────
  {
    angleFraction: '\\frac{11\\pi}{6}',
    angleDecimal: 11 * Math.PI / 6,
    sin: ev('-\\frac{1}{2}',         -0.5),
    cos: ev('\\frac{\\sqrt{3}}{2}',   Math.cos(Math.PI / 6)),
    tan: ev('-\\frac{\\sqrt{3}}{3}', -Math.tan(Math.PI / 6)),
  },
  // ── k=23: θ = 23π/12 (345°) ─────────────────────────────────────────────────
  {
    angleFraction: '\\frac{23\\pi}{12}',
    angleDecimal: 23 * Math.PI / 12,
    sin: ev('-\\frac{\\sqrt{6}-\\sqrt{2}}{4}', Math.sin(23 * Math.PI / 12)),
    cos: ev('\\frac{\\sqrt{6}+\\sqrt{2}}{4}',  Math.cos(23 * Math.PI / 12)),
    tan: ev('\\sqrt{3}-2',                     Math.tan(23 * Math.PI / 12)),
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Normalize any angle to [0, 2π) by wrapping.
 */
export function normalizeAngle(rad: number): number {
  return ((rad % TWO_PI) + TWO_PI) % TWO_PI;
}

/**
 * Look up the nearest special angle to `radians`.
 * If within SNAP_TOLERANCE_RAD (±3°), returns the snapped angle and its
 * exact trig values.  Otherwise returns the raw angle with no values.
 */
export function lookupAngle(radians: number): {
  snapped:      boolean;
  snappedAngle: number;
  values:       SpecialAngleValues | null;
} {
  const norm = normalizeAngle(radians);

  let bestDist = Infinity;
  let bestEntry: SpecialAngleValues | null = null;

  for (const entry of EXACT_VALUE_TABLE) {
    // Check distance, wrapping at 0/2π boundary
    let d = Math.abs(norm - entry.angleDecimal);
    if (d > Math.PI) d = TWO_PI - d;   // shortest arc distance
    if (d < bestDist) {
      bestDist  = d;
      bestEntry = entry;
    }
  }

  if (bestDist <= SNAP_TOLERANCE_RAD && bestEntry !== null) {
    return { snapped: true, snappedAngle: bestEntry.angleDecimal, values: bestEntry };
  }
  return { snapped: false, snappedAngle: norm, values: null };
}

/**
 * Return 4-decimal approximations for any angle that does NOT match a special angle.
 * The `isExact` field is always false.
 *
 * For tan near ±π/2 + nπ, the decimal will be a large finite number.
 */
export function approximateValues(rad: number): SpecialAngleValues {
  const norm = normalizeAngle(rad);
  const sinV = Math.sin(rad);
  const cosV = Math.cos(rad);
  const tanV = Math.tan(rad);

  const fmt = (n: number) => {
    if (!isFinite(n) || Math.abs(n) > 1e6) return '\\text{不存在}';
    return n.toFixed(4);
  };

  return {
    angleFraction: norm.toFixed(4) + '\\text{ rad}',
    angleDecimal:  norm,
    sin: { latex: fmt(sinV), decimal: sinV, isExact: false },
    cos: { latex: fmt(cosV), decimal: cosV, isExact: false },
    tan: { latex: fmt(tanV), decimal: tanV, isExact: false },
  };
}

/** Expose the full table for the SpecialValuesTable component (Phase 6). */
export { EXACT_VALUE_TABLE };
