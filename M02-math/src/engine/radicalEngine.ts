/**
 * Exact radical-form helper for chord lengths.
 *
 * Attempts to express a positive decimal as  a√b  where:
 *   • a  is a positive integer (coefficient)
 *   • b  is a square-free positive integer ≤ 50
 *
 * Algorithm: value² = a²·b  →  for each square-free b, check if
 * value²/b is (close to) a perfect square.
 *
 * Examples:
 *   7.0711…  →  "5√2"    (5²·2 = 50)
 *   2.2360…  →  "√5"     (1²·5 = 5)
 *   6.0000   →  "6"      (6²·1 = 36)
 */

function isSquareFree(n: number): boolean {
  if (n <= 1) return true;
  for (let p = 2; p * p <= n; p++) {
    if (n % (p * p) === 0) return false;
  }
  return true;
}

/**
 * Return the exact radical string (e.g. "5√2") if the value matches a
 * simple a√b form with small integers, otherwise return null.
 */
export function toRadicalForm(value: number): string | null {
  if (value <= 0 || !isFinite(value)) return null;
  const sq  = value * value;
  const tol = 1e-6 * Math.max(sq, 1);

  for (let b = 1; b <= 50; b++) {
    if (!isSquareFree(b)) continue;
    const aSq = sq / b;
    const a   = Math.round(Math.sqrt(aSq));
    if (a < 1 || a > 300) continue;
    if (Math.abs(a * a * b - sq) > tol) continue;
    // Verified: value ≈ a√b
    if (b === 1) return String(a);
    if (a === 1) return `√${b}`;
    return `${a}√${b}`;
  }
  return null;
}
