/**
 * Implicit curve engine — parse "f(x,y) = 0" equations and compile evaluators.
 *
 * Reuses `preprocessExpression` from expressionEngine.ts for implicit multiplication
 * and the AST-walk pattern from coefficientDetector.ts for coefficient detection.
 */

import * as math from 'mathjs';
import type { FunctionParam } from '@/types';
import { preprocessExpression } from '@/engine/expressionEngine';

// ─── Reserved symbols (same as coefficientDetector but with 'y' added) ───────

const RESERVED = new Set([
  'x', 'y',
  'e', 'pi', 'PI',
  'i',
  'Infinity', 'NaN', 'true', 'false', 'null',
]);

// ─── AST coefficient collection ──────────────────────────────────────────────

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

// ─── Public types ────────────────────────────────────────────────────────────

export interface CompiledImplicitCurve {
  exprStr: string;
  evaluator: (x: number, y: number) => number;
}

export interface ImplicitParseResult {
  exprStr: string;
  namedParams: FunctionParam[];
}

// ─── Compilation cache ───────────────────────────────────────────────────────

/**
 * Cache key = exprStr + param values.  Avoids re-parsing math.js every frame
 * when only the viewport changes (which is every pan/zoom).
 */
const _compilationCache = new Map<string, {
  compiled: ReturnType<math.MathNode['compile']>;
}>();

function getCacheKey(exprStr: string, namedParams: FunctionParam[]): string {
  let key = exprStr;
  for (const p of namedParams) {
    key += `|${p.name}=${p.value}`;
  }
  return key;
}

// ─── Parse implicit equation ─────────────────────────────────────────────────

/**
 * Normalize a raw equation string to f(x,y) = 0 form.
 *
 * Supported inputs:
 *   "x^2 + y^2 = r^2"       → "(x^2 + y^2) - (r^2)"
 *   "x^2 + y^2 - 25 = 0"    → "x^2 + y^2 - 25"
 *   "x^2 + y^2 - 25"         → treated as "= 0" implicitly
 */
export function parseImplicitEquation(
  raw: string,
  existing: FunctionParam[],
): ImplicitParseResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let exprStr: string;

  // Split on '=' (but not '==' or '<=' or '>=')
  const eqParts = trimmed.split(/(?<![<>!])=(?!=)/);

  if (eqParts.length === 2) {
    const lhs = eqParts[0].trim();
    const rhs = eqParts[1].trim();
    if (rhs === '0') {
      exprStr = lhs;
    } else {
      exprStr = `(${lhs}) - (${rhs})`;
    }
  } else if (eqParts.length === 1) {
    exprStr = eqParts[0];
  } else {
    return null;
  }

  const processed = preprocessExpressionXY(exprStr);

  let node: math.MathNode;
  try {
    node = math.parse(processed);
  } catch {
    return null;
  }

  const detected = collectSymbols(node);
  const existingMap = new Map(existing.map((p) => [p.name, p]));

  const namedParams = detected.map((name): FunctionParam => {
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

  return { exprStr: processed, namedParams };
}

/**
 * Extended preprocessor that handles both x and y variables.
 */
function preprocessExpressionXY(expr: string): string {
  let result = preprocessExpression(expr);
  result = result.replace(/(?<![a-zA-Z])([a-xzA-XZ])(y)(?![a-zA-Z0-9_])/g, '$1*$2');
  result = result.replace(/(?<![a-zA-Z0-9_])(y)(?=[a-zA-Z])/g, '$1*');
  return result;
}

// ─── Compile implicit curve ──────────────────────────────────────────────────

/**
 * Compile an implicit curve expression and return an evaluator function.
 *
 * Uses a compilation cache keyed on (exprStr + param values) to avoid
 * re-parsing math.js every render frame.  The returned evaluator reuses
 * a single scope object to minimize GC pressure on the hot path
 * (~160K calls per frame at grid 400).
 */
export function compileImplicitCurve(
  params: { exprStr: string; namedParams: FunctionParam[] },
): CompiledImplicitCurve | null {
  const cacheKey = getCacheKey(params.exprStr, params.namedParams);

  let entry = _compilationCache.get(cacheKey);
  if (!entry) {
    try {
      const node = math.parse(params.exprStr);
      entry = { compiled: node.compile() };

      // Evict oldest if cache grows large
      if (_compilationCache.size >= 30) {
        const [oldest] = _compilationCache.keys();
        _compilationCache.delete(oldest);
      }
      _compilationCache.set(cacheKey, entry);
    } catch {
      return null;
    }
  }

  const compiled = entry.compiled;

  // Build a reusable scope object — mutated in-place on the hot path
  const scope: Record<string, unknown> = { x: 0, y: 0 };
  for (const p of params.namedParams) {
    scope[p.name] = p.value;
  }

  const evaluator = (x: number, y: number): number => {
    try {
      scope.x = x;
      scope.y = y;
      const result: unknown = compiled.evaluate(scope);
      return typeof result === 'number' ? result : NaN;
    } catch {
      return NaN;
    }
  };

  return { exprStr: params.exprStr, evaluator };
}
