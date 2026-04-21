/**
 * compositionEngine — M02 Feature 6
 *
 * Builds a math.js-compatible scope object that maps user-defined function
 * labels (f, g, h, …) to JavaScript functions, enabling expressions like
 * g(x) = f(x+1) + 2 to correctly invoke the already-defined f(x).
 *
 * Recursion protection: a module-level depth counter caps nested calls at 30
 * levels, returning NaN on overflow (prevents infinite loops from crashing).
 */

import type { FunctionEntry } from '@/types';
import { compileExpression, isParseError, evaluateAt } from '@/engine/expressionEngine';

// ─── Recursion guard ─────────────────────────────────────────────────────────

let _callDepth = 0;
const MAX_CALL_DEPTH = 30;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a scope object `{ f: (x) => number, g: (x) => number, … }` from the
 * current function list, for use in math.js expression evaluation.
 *
 * @param functions   All FunctionEntry objects in the store.
 * @param excludeId   The id of the function currently being evaluated —
 *                    excluded from the scope to prevent direct self-recursion.
 * @returns           A scope object safe to merge with the numeric-param scope.
 */
export function buildFunctionScope(
  functions: FunctionEntry[],
  excludeId?: string,
): Record<string, (x: number) => number> {
  const scope: Record<string, (x: number) => number> = {};

  for (const fn of functions) {
    if (fn.id === excludeId) continue;
    if (fn.mode !== 'standard') continue;

    // Extract the plain name: 'f' from 'f(x)', 'g' from 'g(x)', etc.
    const nameMatch = fn.label.match(/^([a-zA-Z][a-zA-Z0-9]*)(?:\(x\))?$/);
    if (!nameMatch) continue;
    const fnName = nameMatch[1];

    const capturedFn = fn;  // stable closure reference

    // Pre-compile expression once at scope-build time (not per sample point).
    const compiled = compileExpression(capturedFn.exprStr);
    if (isParseError(compiled)) continue;

    // Pre-build the param scope once (only changes on slider commit, not per point).
    const paramScope: Record<string, unknown> =
      capturedFn.templateId === null && capturedFn.namedParams.length > 0
        ? Object.fromEntries(capturedFn.namedParams.map((p) => [p.name, p.value]))
        : {};

    const { a, b, h, k } = capturedFn.transform;

    // Each closure evaluates capturedFn at the given xVal, using the already-
    // built scope (allows g to call f as long as f was defined before g).
    scope[fnName] = (xVal: number): number => {
      _callDepth++;
      if (_callDepth > MAX_CALL_DEPTH) {
        _callDepth--;
        return NaN;
      }

      try {
        const xPrime = b * (xVal - h);
        // Include `scope` itself so nested composition works (g calls f which is in scope)
        const rawFx = evaluateAt(compiled, xPrime, { ...paramScope, ...scope });
        _callDepth--;

        if (!isFinite(rawFx)) return NaN;
        const y = a * rawFx + k;
        return isFinite(y) ? y : NaN;
      } catch {
        _callDepth--;
        return NaN;
      }
    };
  }

  return scope;
}

/**
 * Extract the names of all user-defined functions from the function list,
 * excluding `excludeId`. Used to tell the preprocessor which single letters
 * should NOT have `*` inserted before their `(` — they are function calls.
 *
 * @example  getKnownFunctionNames(functions, fn.id)  →  ['f', 'g']
 */
export function getKnownFunctionNames(
  functions: FunctionEntry[],
  excludeId?: string,
): string[] {
  const names: string[] = [];
  for (const fn of functions) {
    if (fn.id === excludeId) continue;
    if (fn.mode !== 'standard') continue;
    const nameMatch = fn.label.match(/^([a-zA-Z][a-zA-Z0-9]*)(?:\(x\))?$/);
    if (nameMatch) names.push(nameMatch[1]);
  }
  return names;
}
