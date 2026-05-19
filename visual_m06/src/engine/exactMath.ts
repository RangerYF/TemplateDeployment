import { create, all, type MathJsStatic, type MathNode } from 'mathjs';
import type { DemoEntity, DemoSlider } from '@/editor/demo/demoTypes';

const math = create(all) as MathJsStatic;

// Register √ as alias for sqrt in parser
const originalParse = math.parse.bind(math);

/**
 * Parse a user input expression to a math.js node tree.
 * Supports: integers, decimals, fractions (1/3), √() or sqrt(), π or pi, +, -, *, /
 * Returns null on parse failure.
 */
export function parseExact(expr: string): MathNode | null {
  if (!expr || !expr.trim()) return null;
  let s = expr.trim();
  // Normalize √ → sqrt
  s = s.replace(/√\(/g, 'sqrt(');
  s = s.replace(/√(\d+)/g, 'sqrt($1)');
  // Normalize × → *
  s = s.replace(/×/g, '*');
  // Normalize ÷ → /
  s = s.replace(/÷/g, '/');
  // Normalize π → pi
  s = s.replace(/π/g, 'pi');
  try {
    return originalParse(s);
  } catch {
    return null;
  }
}

/**
 * Evaluate a math.js node to a numeric value.
 */
export function evalNode(node: MathNode, scope?: Record<string, number>): number {
  try {
    const result = scope ? node.evaluate(scope) : node.evaluate();
    if (typeof result === 'number') return result;
    if (result && typeof result.toNumber === 'function') return result.toNumber();
    return Number(result);
  } catch {
    return NaN;
  }
}

/**
 * Evaluate a user expression string to a float (convenience wrapper).
 */
export function evalExact(expr: string): number {
  const node = parseExact(expr);
  if (!node) return NaN;
  return evalNode(node);
}

/**
 * Evaluate an expression with a variable scope (e.g. slider values).
 */
export function evalExactScoped(expr: string, scope: Record<string, number>): number {
  const node = parseExact(expr);
  if (!node) return NaN;
  return evalNode(node, scope);
}

/**
 * Simplify a math.js node tree.
 */
export function simplifyNode(node: MathNode): MathNode {
  try {
    return math.simplify(node);
  } catch {
    return node;
  }
}

/**
 * Format a math.js node to a human-readable string.
 * Tries to simplify first.
 */
export function formatExact(node: MathNode): string {
  try {
    const simplified = simplifyNode(node);
    return simplified.toString();
  } catch {
    return node.toString();
  }
}

/**
 * Format a math.js node to LaTeX string.
 */
export function formatExactLatex(node: MathNode): string {
  try {
    const simplified = simplifyNode(node);
    return simplified.toTex();
  } catch {
    return node.toTex();
  }
}

/**
 * Build an exact magnitude expression: sqrt(x^2 + y^2)
 * where x, y are MathNode expressions.
 */
export function exactMagnitude(xExpr: string, yExpr: string): MathNode | null {
  try {
    const expr = `sqrt((${xExpr})^2 + (${yExpr})^2)`;
    const s = expr.replace(/√\(/g, 'sqrt(').replace(/√(\d+)/g, 'sqrt($1)').replace(/π/g, 'pi');
    const node = originalParse(s);
    return simplifyNode(node);
  } catch {
    return null;
  }
}

/**
 * Build an exact dot product expression: ax*bx + ay*by
 */
export function exactDot(
  axExpr: string, ayExpr: string,
  bxExpr: string, byExpr: string,
): MathNode | null {
  try {
    const expr = `(${axExpr})*(${bxExpr}) + (${ayExpr})*(${byExpr})`;
    const s = expr.replace(/√\(/g, 'sqrt(').replace(/√(\d+)/g, 'sqrt($1)').replace(/π/g, 'pi');
    const node = originalParse(s);
    return simplifyNode(node);
  } catch {
    return null;
  }
}

/**
 * Format a number using math.js for precise display.
 * Converts float to fraction if possible, keeps sqrt/pi symbolic.
 */
export function formatNumber(n: number): string {
  try {
    const frac = math.fraction(n);
    const num = Number(frac.n) * (frac.s < 0 ? -1 : 1);
    const den = Number(frac.d);
    if (den === 1) return String(num);
    return `${num}/${den}`;
  } catch {
    return String(Math.round(n * 1e10) / 1e10);
  }
}

/**
 * Format a number to LaTeX using math.js.
 */
export function formatNumberLatex(n: number): string {
  try {
    const frac = math.fraction(n);
    const num = Number(frac.n) * (frac.s < 0 ? -1 : 1);
    const den = Number(frac.d);
    if (den === 1) return String(num);
    return `\\frac{${num}}{${den}}`;
  } catch {
    return String(Math.round(n * 1e10) / 1e10);
  }
}

/**
 * Build a scope mapping slider labels to their current values.
 */
export function buildSliderScope(entities: Record<string, DemoEntity>): Record<string, number> {
  const scope: Record<string, number> = {};
  for (const e of Object.values(entities)) {
    if (e.type === 'demoSlider') scope[(e as DemoSlider).label] = (e as DemoSlider).value;
  }
  return scope;
}

// Re-export math instance for advanced usage
export { math };
