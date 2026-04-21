/**
 * lineExpressionEngine — parse symbolic line equations, detect free coefficients,
 * and resolve them to numeric LineParams for rendering.
 *
 * Reuses the AST-walk pattern from coefficientDetector.ts and the implicit-
 * multiplication preprocessor from expressionEngine.ts.
 */

import * as math from 'mathjs';
import type { FunctionParam, LineParams } from '@/types';
import { preprocessExpression } from '@/engine/expressionEngine';

// ─── Reserved identifiers (not user coefficients) ───────────────────────────

const RESERVED = new Set([
  'x', 'y',
  'e', 'pi', 'PI',
  'i',
  'Infinity', 'NaN', 'true', 'false', 'null',
]);

// ─── Equation form classification ───────────────────────────────────────────

export type EquationForm = 'y-equals' | 'x-equals' | 'implicit' | null;

/**
 * Classify the user-typed equation string into one of three forms.
 * Simple string inspection — no math parsing.
 */
export function classifyEquationForm(raw: string): EquationForm {
  const s = raw.replace(/\s+/g, '').toLowerCase().replace(/\u2212/g, '-');
  if (/^y=/.test(s)) return 'y-equals';
  if (/^x=/.test(s)) return 'x-equals';
  // implicit: anything ending with "= 0" or "=0"
  if (/=\s*0$/.test(s)) return 'implicit';
  return null;
}

// ─── AST symbol collection ──────────────────────────────────────────────────

function collectFreeSymbols(node: math.MathNode): string[] {
  const found = new Set<string>();
  node.traverse((n: math.MathNode) => {
    if (n.type === 'SymbolNode') {
      const name = (n as math.SymbolNode).name;
      if (!RESERVED.has(name)) found.add(name);
    }
  });
  return [...found].sort();
}

// ─── Extract math expression from equation string ───────────────────────────

/**
 * Given a raw equation string, extract the parseable math expression(s).
 * Returns the expression string suitable for math.parse(), or null on failure.
 */
function extractExpr(raw: string, form: EquationForm): string | null {
  const s = raw.replace(/\s+/g, '').replace(/\u2212/g, '-');
  switch (form) {
    case 'y-equals': {
      // y = <rhs>
      const m = s.match(/^[yY]=(.+)$/);
      return m ? m[1] : null;
    }
    case 'x-equals': {
      // x = <rhs>
      const m = s.match(/^[xX]=(.+)$/);
      return m ? m[1] : null;
    }
    case 'implicit': {
      // <lhs> = 0
      const m = s.match(/^(.+)=0$/);
      return m ? m[1] : null;
    }
    default:
      return null;
  }
}

// ─── Public: formatEquationDisplay ───────────────────────────────────────────

/**
 * Beautify an equation string for display.
 * Removes explicit `*` between coefficient and variable (a*x → ax),
 * normalizes whitespace, and replaces ASCII minus with proper formatting.
 *
 * Input:  "y = k*x + b"  →  "y = kx + b"
 * Input:  "a*x+b*y+c=0"  →  "ax + by + c = 0"
 */
export function formatEquationDisplay(raw: string): string {
  return raw
    // Remove * between letter and letter/( — "a*x" → "ax", "a*sin(" → "asin("
    .replace(/([a-zA-Z])\*([a-zA-Z(])/g, '$1$2')
    // Remove * between digit and letter — "2*x" → "2x"
    .replace(/(\d)\*([a-zA-Z])/g, '$1$2')
    // Normalize spacing around + and -
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s*-\s*/g, ' - ')
    // Normalize spacing around =
    .replace(/\s*=\s*/g, ' = ')
    // Fix leading "- " after "= " — "y = - x" → "y = -x"
    .replace(/= - /g, '= -')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Public: detectLineCoefficients ─────────────────────────────────────────

/**
 * Detect free coefficients in a symbolic line equation and merge with existing params.
 *
 * @returns Merged FunctionParam[] or null if the expression cannot be parsed.
 */
export function detectLineCoefficients(
  raw: string,
  existing: FunctionParam[],
): FunctionParam[] | null {
  const form = classifyEquationForm(raw);
  if (!form) return null;

  const exprStr = extractExpr(raw, form);
  if (!exprStr) return null;

  const processed = preprocessExpression(exprStr.trim());
  if (!processed) return null;

  let node: math.MathNode;
  try {
    node = math.parse(processed);
  } catch {
    return null;
  }

  const detected = collectFreeSymbols(node);
  if (detected.length === 0) return [];

  const existingMap = new Map(existing.map((p) => [p.name, p]));

  return detected.map((name): FunctionParam => {
    const prev = existingMap.get(name);
    if (prev) return prev;
    return {
      name,
      label: name,
      value: 1,
      min: -10,
      max: 10,
      step: 0.1,
    };
  });
}

// ─── Public: resolveLineParams ──────────────────────────────────────────────

/**
 * Evaluate a symbolic line equation with current param values → numeric LineParams.
 *
 * @returns LineParams or null if evaluation fails.
 */
export function resolveLineParams(
  equationStr: string,
  params: FunctionParam[],
): LineParams | null {
  const form = classifyEquationForm(equationStr);
  if (!form) return null;

  const exprStr = extractExpr(equationStr, form);
  if (!exprStr) return null;

  const processed = preprocessExpression(exprStr.trim());
  if (!processed) return null;

  let compiled: ReturnType<math.MathNode['compile']>;
  try {
    compiled = math.parse(processed).compile();
  } catch {
    return null;
  }

  // Build scope from named params
  const scope: Record<string, number> = {};
  for (const p of params) {
    scope[p.name] = p.value;
  }

  try {
    switch (form) {
      case 'x-equals': {
        // x = <expr>  → vertical line
        const val = compiled.evaluate({ ...scope });
        if (typeof val !== 'number' || !isFinite(val)) return null;
        return { vertical: true, x: val, k: 0, b: 0 };
      }
      case 'y-equals': {
        // y = <expr>  → evaluate at x=0 and x=1 to get intercept and slope
        const y0 = compiled.evaluate({ ...scope, x: 0 });
        const y1 = compiled.evaluate({ ...scope, x: 1 });
        if (typeof y0 !== 'number' || typeof y1 !== 'number') return null;
        if (!isFinite(y0) || !isFinite(y1)) return null;
        const k = y1 - y0;
        const b = y0;
        return { vertical: false, k, b, x: 0 };
      }
      case 'implicit': {
        // <expr> = 0 → evaluate at three points to extract coefficients of x and y
        // expr(x,y) = a_coeff * x + b_coeff * y + c_coeff (linear assumption)
        const f00 = compiled.evaluate({ ...scope, x: 0, y: 0 });
        const f10 = compiled.evaluate({ ...scope, x: 1, y: 0 });
        const f01 = compiled.evaluate({ ...scope, x: 0, y: 1 });
        if (typeof f00 !== 'number' || typeof f10 !== 'number' || typeof f01 !== 'number') return null;
        if (!isFinite(f00) || !isFinite(f10) || !isFinite(f01)) return null;

        const aCoeff = f10 - f00; // coefficient of x
        const bCoeff = f01 - f00; // coefficient of y
        const cCoeff = f00;       // constant term

        if (Math.abs(bCoeff) < 1e-12) {
          // No y term → vertical line: aCoeff * x + cCoeff = 0 → x = -cCoeff / aCoeff
          if (Math.abs(aCoeff) < 1e-12) return null; // degenerate
          return { vertical: true, x: -cCoeff / aCoeff, k: 0, b: 0 };
        }

        const k = -aCoeff / bCoeff;
        const b = -cCoeff / bCoeff;
        if (!isFinite(k) || !isFinite(b)) return null;
        return { vertical: false, k, b, x: 0 };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
