/**
 * fivePointEngine — M04 Phase 4
 *
 * Computes the five "key points" used to sketch one full period of a
 * transformed sin or cos curve (Chinese high-school 人教版 five-point method).
 *
 * For  y = A·sin(ωx + φ) + k  the canonical inner-argument values are:
 *   0,  π/2,  π,  3π/2,  2π
 * giving roles:  zero → max → zero → min → zero
 *
 * For  y = A·cos(ωx + φ) + k:
 *   same inner args, roles:  max → zero → min → zero → max
 *
 * Each point carries:
 *  - computed (x, y) numbers
 *  - π-fraction LaTeX labels for x and y
 *  - role tag
 *  - a short KaTeX derivation string shown in FivePointPanel
 */

import { formatPiLatex } from '@/engine/piAxisEngine';
import type { TrigTransform, FnType } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FivePointRole = 'zero' | 'max' | 'min';

export interface FivePointData {
  /** Computed x-coordinate (math). */
  x: number;
  /** Computed y-coordinate (math). */
  y: number;
  /** LaTeX for x, e.g. "\\frac{\\pi}{6}". */
  xLatex: string;
  /** LaTeX for y (abstract + concrete), e.g. "A+k = 2". */
  yLatex: string;
  /** Semantic role: zero crossing, maximum, or minimum. */
  role: FivePointRole;
  /**
   * One-line KaTeX derivation shown in FivePointPanel.
   * Format:  令\,\omega x+\varphi=\alpha \Rightarrow x=\cdots,\;y=\cdots
   */
  derivationLatex: string;
}

// ─── Inner-argument tables ─────────────────────────────────────────────────────

const SIN_INNER = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, 2 * Math.PI];
const SIN_ROLES: FivePointRole[] = ['zero', 'max', 'zero', 'min', 'zero'];

const COS_ROLES: FivePointRole[] = ['max', 'zero', 'min', 'zero', 'max'];

// sin/cos function value at each canonical inner argument
const SIN_VALS  = [0,  1, 0, -1,  0];  // sin(0), sin(π/2), …
const COS_VALS  = [1,  0, -1,  0,  1]; // cos(0), cos(π/2), …

const INNER_ANGLE_LATEX = [
  '0',
  '\\dfrac{\\pi}{2}',
  '\\pi',
  '\\dfrac{3\\pi}{2}',
  '2\\pi',
];

// ─── Abstract y labels ────────────────────────────────────────────────────────

function yAbstract(role: FivePointRole, A: number): string {
  switch (role) {
    case 'max':  return A >= 0 ? 'A+k'  : '-A+k';
    case 'min':  return A >= 0 ? '-A+k' : 'A+k';
    case 'zero': return 'k';
  }
}

// ─── Format number (for concrete value) ──────────────────────────────────────

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute all five key points for the given transform and function type.
 * Returns exactly 5 entries (one per canonical phase 0…2π).
 */
export function computeFivePoints(
  transform: TrigTransform,
  fnType:    FnType,
): FivePointData[] {
  if (fnType === 'tan') return [];   // five-point method doesn't apply to tan

  const { A, omega, phi, k } = transform;
  const innerAngles = SIN_INNER;
  const roles       = fnType === 'sin' ? SIN_ROLES : COS_ROLES;
  const baseFnVals  = fnType === 'sin' ? SIN_VALS  : COS_VALS;

  return innerAngles.map((alpha, i) => {
    const x = (alpha - phi) / omega;
    const y = A * baseFnVals[i] + k;

    const xLatex     = formatPiLatex(x);
    const abstract   = yAbstract(roles[i], A);
    const yLatex     = `${abstract} = ${fmtNum(y)}`;
    const alphaLatex = INNER_ANGLE_LATEX[i];

    const derivationLatex =
      `\\text{令 }\\omega x + \\varphi = ${alphaLatex}` +
      `\\;\\Rightarrow\\; x = ${xLatex},\\quad y = ${fmtNum(y)}`;

    return {
      x,
      y,
      xLatex,
      yLatex,
      role: roles[i],
      derivationLatex,
    };
  });
}
