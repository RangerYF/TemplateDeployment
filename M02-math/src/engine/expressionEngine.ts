import * as math from 'mathjs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CompiledExpression {
  readonly exprStr: string;
  readonly node: math.MathNode;
  readonly compiled: ReturnType<math.MathNode['compile']>;
}

export interface ParseError {
  readonly error: string;
}

export function isParseError(v: CompiledExpression | ParseError): v is ParseError {
  return 'error' in v;
}

// ─── Implicit-multiplication preprocessor ────────────────────────────────────

/**
 * Normalize an expression string by inserting explicit `*` operators wherever
 * math.js would otherwise treat adjacent tokens as a single identifier.
 *
 * Rules applied in order:
 *  0. Unicode shorthands: ² → ^2, ³ → ^3, × → *, ÷ /, π → pi
 *  1. digit → letter or `(`:   2x → 2*x,  3sin(x) → 3*sin(x),  2(x+1) → 2*(x+1)
 *  2. single letter (≠ x) → x at an identifier boundary:
 *        ax → a*x,  bx → b*x,  wx → w*x
 *        NOT: exp (x is followed by p), max (a is preceded by m)
 *  3. standalone x → letter:   xsin(x) → x*sin(x),  xpi → x*pi,  xsqrt(x) → x*sqrt(x)
 *        Standalone means x is NOT preceded by [a-zA-Z0-9_] — avoids breaking exp, max.
 *  4. `)` → letter:  (x+1)sin(x) → (x+1)*sin(x),  sin(x)cos(x) → sin(x)*cos(x)
 *  5. single letter → `(` (only when letter starts an identifier, not inside sin/cos/…):
 *        a(x+1) → a*(x+1)   but   sin(x) stays.
 *        Letters in `knownFns` are EXEMPT (treated as function calls, not multiplication).
 *  6. `)` → `(`:  (x+1)(x-1) → (x+1)*(x-1)
 *
 * @param knownFns  User-defined function names (e.g. ['f','g']) that should NOT
 *                  have '*' inserted before their '(' — they are genuine calls.
 */
export function preprocessExpression(expr: string, knownFns: string[] = []): string {
  const knownSet = new Set(knownFns);
  return expr
    // 0. Unicode math shorthands
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    // 1. digit followed by letter or open paren
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    // 2. single letter (not x/X), not preceded by another letter, followed by x
    //    and x is not followed by another letter (avoids breaking exp, max, etc.)
    .replace(/(?<![a-zA-Z])([a-wyzA-WYZ])(x)(?![a-zA-Z0-9_])/g, '$1*$2')
    // 3. standalone x followed by a letter — covers xsin(x)→x*sin(x), xcos→x*cos, xpi→x*pi
    //    "Standalone" = not preceded by [a-zA-Z0-9_], so 'x' in 'exp'/'max' is unaffected.
    .replace(/(?<![a-zA-Z0-9_])(x)(?=[a-zA-Z])/g, '$1*')
    // 4. close paren followed by a letter or digit — covers:
    //    (x+1)sin(x)→(x+1)*sin(x),  sin(x)cos(x)→sin(x)*cos(x),  (x+1)2→(x+1)*2
    .replace(/\)(?=[a-zA-Z\d])/g, ')*')
    // 5. single letter directly before '(' — skip user-defined function names
    .replace(/(?<![a-zA-Z])([a-zA-Z])\(/g, (_, letter) =>
      knownSet.has(letter) ? `${letter}(` : `${letter}*(`,
    )
    // 6. close paren immediately followed by open paren
    .replace(/\)\(/g, ')*(');
}

// ─── LRU Cache (max 50 entries) ──────────────────────────────────────────────

const cache = new Map<string, CompiledExpression>();

// ─── Core: compile ───────────────────────────────────────────────────────────

/**
 * Parse and compile an expression string.
 * Applies implicit-multiplication preprocessing before parsing so that natural
 * notation like "ax^2 + bx + c" or "2x" is handled correctly.
 * Results are cached by the preprocessed form; the oldest entry is evicted when full.
 *
 * @param knownFns  User-defined single-letter function names (e.g. ['f','g']) that
 *                  should be treated as function calls, not multiplications.
 */
export function compileExpression(exprStr: string, knownFns: string[] = []): CompiledExpression | ParseError {
  const trimmed = preprocessExpression(exprStr.trim(), knownFns);
  if (!trimmed) return { error: '表达式不能为空' };

  const cached = cache.get(trimmed);
  if (cached) return cached;

  try {
    const node     = math.parse(trimmed);
    const compiled = node.compile();
    const result: CompiledExpression = { exprStr: trimmed, node, compiled };

    if (cache.size >= 50) {
      // Evict oldest (Map preserves insertion order)
      const [oldestKey] = cache.keys();
      cache.delete(oldestKey);
    }
    cache.set(trimmed, result);
    return result;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ─── Core: evaluate ──────────────────────────────────────────────────────────

/**
 * Reusable minimal scope object for the no-scope fast path.
 * Mutating `x` avoids allocating a new `{ x }` object per call (800/frame/fn).
 */
const _fastScope: Record<string, unknown> = { x: 0 };

/**
 * Evaluate a compiled expression at a single x value.
 * Pass `scope` to provide named-parameter values (e.g. { a: 2, b: -1 }) and/or
 * user-defined function references (e.g. { f: (x) => x*x }) for composition.
 * Returns NaN for complex results, discontinuities, or evaluation errors.
 */
export function evaluateAt(
  expr: CompiledExpression,
  x: number,
  scope?: Record<string, unknown>,
): number {
  try {
    let evalScope: Record<string, unknown>;
    if (scope) {
      // With scope: must merge (scope may contain functions / params)
      scope.x = x;
      evalScope = scope;
    } else {
      // Hot path (no scope): reuse singleton to avoid allocation
      _fastScope.x = x;
      evalScope = _fastScope;
    }
    const result: unknown = expr.compiled.evaluate(evalScope);
    // Only accept real JS numbers; reject Complex, Matrix, Unit, etc.
    return typeof result === 'number' ? result : NaN;
  } catch {
    return NaN;
  }
}

// ─── Derivatives ─────────────────────────────────────────────────────────────

/**
 * Return a human-readable symbolic derivative string for panel display.
 * Returns null if math.js cannot differentiate the expression.
 */
export function symbolicDerivativeStr(expr: CompiledExpression): string | null {
  try {
    return math.derivative(expr.node, 'x').toString();
  } catch {
    return null;
  }
}

/**
 * Compile the symbolic derivative of an expression.
 * Used for derivative curve rendering (Phase 6).
 */
export function compileDerivative(
  expr: CompiledExpression,
): CompiledExpression | ParseError {
  try {
    const derivedNode = math.derivative(expr.node, 'x');
    return compileExpression(derivedNode.toString());
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Numerical derivative at x via central difference (h = 1e-7).
 * Used for feature-point scanning and tangent slope calculation.
 */
export function numericalDerivative(
  expr: CompiledExpression,
  x: number,
  scope?: Record<string, unknown>,
): number {
  const h      = 1e-7;
  const yPlus  = evaluateAt(expr, x + h, scope);
  const yMinus = evaluateAt(expr, x - h, scope);
  if (!isFinite(yPlus) || !isFinite(yMinus)) return NaN;
  return (yPlus - yMinus) / (2 * h);
}
