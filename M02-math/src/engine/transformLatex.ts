/**
 * transformLatex — M04 Phase 3
 *
 * Pure function that builds a KaTeX-renderable LaTeX string for
 *   y = A · fn(ω·x + φ) + k
 *
 * Simplification rules:
 *  - A = 1   → omit coefficient
 *  - A = -1  → show only "-"
 *  - ω = 1   → omit (show plain "x")
 *  - ω = -1  → show "-x"
 *  - φ = 0   → omit "+ φ" term
 *  - k = 0   → omit "+ k" term
 *  - φ       → always formatted as π-fractions via formatPiLatex
 *
 * @example
 * buildTransformLatex(2, 3, Math.PI/4, 1, 'sin')
 * → 'y = 2\\sin(3x+\\frac{\\pi}{4})+1'
 *
 * buildTransformLatex(1, 1, 0, 0, 'cos')
 * → 'y = \\cos(x)'
 */

import { formatPiLatex } from '@/engine/piAxisEngine';
import type { FnType } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a scalar: integer → integer string, else 1 decimal (no trailing zero). */
function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace(/\.0$/, '');
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildTransformLatex(
  A:     number,
  omega: number,
  phi:   number,
  k:     number,
  fn:    FnType,
): string {
  const fnLatex = `\\${fn}`;

  // ── Amplitude prefix ──────────────────────────────────────────────────────
  let aStr: string;
  if (A === 1)       aStr = '';
  else if (A === -1) aStr = '-';
  else               aStr = fmt(A);   // includes sign for negative values

  // ── Argument: ω·x ────────────────────────────────────────────────────────
  let argStr: string;
  if (omega === 1)       argStr = 'x';
  else if (omega === -1) argStr = '-x';
  else                   argStr = `${fmt(omega)}x`;

  // ── Phase shift: +φ or −|φ| ───────────────────────────────────────────────
  const phiLatex = formatPiLatex(phi);
  if (phiLatex !== '0') {
    // formatPiLatex already prefixes negative values with "-"
    argStr += phiLatex.startsWith('-') ? phiLatex : `+${phiLatex}`;
  }

  // ── Vertical shift ────────────────────────────────────────────────────────
  let kStr = '';
  if (k !== 0) {
    kStr = k > 0 ? `+${fmt(k)}` : fmt(k);
  }

  return `y = ${aStr}${fnLatex}(${argStr})${kStr}`;
}
