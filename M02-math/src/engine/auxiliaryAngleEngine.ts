/**
 * auxiliaryAngleEngine — M04 Phase 4
 *
 * Converts  a·sin x + b·cos x  →  R·sin(x + φ)
 *
 * where  R = √(a² + b²)  and  φ = atan2(b, a).
 *
 * LaTeX formatting rules:
 *  - R: exact integer if (a²+b²) is a perfect square, otherwise \sqrt{a²+b²}
 *  - φ: use formatPiLatex if it matches a special angle (π/4, π/6, …),
 *       otherwise format as \arctan(\frac{b}{a})
 */

import { formatPiLatex }  from '@/engine/piAxisEngine';
import { lookupAngle }    from '@/engine/exactValueEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuxiliaryResult {
  /** Synthesis amplitude √(a²+b²). */
  R:            number;
  /** Phase shift atan2(b, a) in radians. */
  phi:          number;
  /** LaTeX for R (exact integer or \sqrt{…}). */
  RLatex:       string;
  /** LaTeX for φ (special-angle fraction or \arctan{…}). */
  phiLatex:     string;
  /** Full identity formula in KaTeX. */
  formulaLatex: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format an integer or simple fraction coefficient for LaTeX (omit 1, handle -1). */
function coeffLatex(n: number): string {
  if (n === 1)  return '';
  if (n === -1) return '-';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/** Build LaTeX for the R value: integer if perfect square, else \sqrt{n²}. */
function buildRLatex(R: number): string {
  const R2    = Math.round(R * R * 1e6) / 1e6;  // round off float noise
  const intR2 = Math.round(R2);
  if (Math.abs(R2 - intR2) < 1e-6) {
    const sqrtInt = Math.round(Math.sqrt(intR2));
    if (sqrtInt * sqrtInt === intR2) return String(sqrtInt);   // perfect square
    return `\\sqrt{${intR2}}`;
  }
  return R.toFixed(4);
}

/** Build LaTeX for φ: π-fraction if special, else \arctan form. */
function buildPhiLatex(phi: number, a: number, b: number): string {
  // Try exact π-fraction first
  const piLabel = formatPiLatex(phi);
  if (piLabel !== phi.toFixed(4)) return piLabel;  // matched a π-fraction

  // Try lookupAngle (3° tolerance)
  const { snapped } = lookupAngle(phi);
  if (snapped) {
    const matched = formatPiLatex(phi);
    if (matched !== phi.toFixed(4)) return matched;
  }

  // Fallback: arctan form
  if (a === 0) return phi > 0 ? '\\dfrac{\\pi}{2}' : '-\\dfrac{\\pi}{2}';

  const bStr = Number.isInteger(b) ? String(b) : b.toFixed(2);
  const aStr = Number.isInteger(a) ? String(a) : a.toFixed(2);
  return `\\arctan\\dfrac{${bStr}}{${aStr}}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Synthesize  a·sin x + b·cos x  =  R·sin(x + φ).
 *
 * @param a  Coefficient of sin x
 * @param b  Coefficient of cos x
 */
export function synthesizeAuxiliaryAngle(a: number, b: number): AuxiliaryResult {
  const R   = Math.sqrt(a * a + b * b);
  const phi = Math.atan2(b, a);

  const RLatex   = buildRLatex(R);
  const phiLatex = buildPhiLatex(phi, a, b);

  // Build the identity formula
  const aPart = a === 0 ? '' : `${coeffLatex(a)}\\sin x`;
  const bSign = b >= 0 ? '+' : '';
  const bPart = b === 0 ? '' : `${bSign}${coeffLatex(b)}\\cos x`;

  const lhs = aPart + bPart || '0';
  const rhs = `${RLatex}\\sin\\!\\left(x+${phiLatex}\\right)`;

  const formulaLatex = `${lhs} = ${rhs}`;

  return { R, phi, RLatex, phiLatex, formulaLatex };
}
