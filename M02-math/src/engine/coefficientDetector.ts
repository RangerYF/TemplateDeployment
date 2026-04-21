import * as math from 'mathjs';
import type { FunctionParam } from '@/types';
import { preprocessExpression } from '@/engine/expressionEngine';

// ─── Known identifiers that are NOT user coefficients ────────────────────────

/**
 * Core math.js built-in constants that must never be treated as free coefficients.
 *
 * Intentionally minimal — only identifiers whose math.js meaning conflicts with
 * treating them as a slider-controlled coefficient:
 *  - x : the independent variable
 *  - e  : Euler's number (2.718…) — but users rarely mean this as a coefficient
 *  - pi : π — same reasoning
 *  - i  : imaginary unit — would produce complex numbers
 *  - Infinity, NaN, true, false, null : JS / math primitives
 *
 * Note: phi (golden ratio), tau (2π), and similar secondary constants are NOT
 * reserved here, so users can freely use them as slider-controlled parameters
 * (e.g. A·sin(ω·x + phi)). The scope injection overrides the math.js constant.
 */
const RESERVED = new Set([
  'x',
  'e', 'pi', 'PI',
  'i',
  'Infinity', 'NaN', 'true', 'false', 'null',
]);

// ─── AST-based coefficient detection ─────────────────────────────────────────

/**
 * Walk a math.js AST node and collect all SymbolNode names that are not
 * in the RESERVED set. These are the free coefficients in the expression.
 *
 * math.js distinguishes SymbolNode (bare identifier: a, b, c, phi) from
 * FunctionNode (function call: sin(…), cos(…)), so function names are never
 * returned even if they share a letter with a potential coefficient.
 *
 * Examples (after preprocessing):
 *   "a*x^2 + b*x + c"     → ['a', 'b', 'c']
 *   "A*sin(w*x + phi)"    → ['A', 'phi', 'w']
 *   "k*exp(x) + m"        → ['k', 'm']
 */
function collectSymbols(node: math.MathNode): string[] {
  const found = new Set<string>();
  node.traverse((n: math.MathNode) => {
    if (n.type === 'SymbolNode') {
      const name = (n as math.SymbolNode).name;
      if (!RESERVED.has(name)) {
        found.add(name);
      }
    }
  });
  return [...found].sort();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect free coefficients in an expression and merge them with existing params.
 *
 * The expression is preprocessed (implicit multiplication inserted) before
 * parsing so that "ax^2 + bx + c" correctly yields ['a', 'b', 'c'] rather
 * than treating 'ax' and 'bx' as single opaque variable names.
 *
 * Merge rules:
 *  - In new expression AND existing params → kept with their current value + ranges
 *  - In new expression but NOT existing    → added with value = 1, range [-10, 10]
 *  - In existing but NOT new expression    → removed (slider disappears)
 *
 * @returns Merged namedParams array, or `null` if the expression cannot be parsed.
 */
export function detectAndMergeCoefficients(
  exprStr: string,
  existing: FunctionParam[],
): FunctionParam[] | null {
  // Preprocess to expand implicit multiplication before parsing
  const processed = preprocessExpression(exprStr.trim());
  if (!processed) return null;

  let node: math.MathNode;
  try {
    node = math.parse(processed);
  } catch {
    return null;
  }

  const detected = collectSymbols(node);
  if (detected.length === 0) return [];

  const existingMap = new Map(existing.map((p) => [p.name, p]));

  return detected.map((name): FunctionParam => {
    const prev = existingMap.get(name);
    if (prev) {
      // Preserve value + user-adjusted range from the existing param
      return prev;
    }
    return {
      name,
      label: name,
      value: 1,
      min:   -10,
      max:   10,
      step:  0.1,
    };
  });
}
