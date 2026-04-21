import type { Viewport } from '@/canvas/Viewport';
import type { Transform, FunctionEntry } from '@/types';
import {
  evaluateAt,
  compileExpression,
  isParseError,
  type CompiledExpression,
} from '@/engine/expressionEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SamplePoint {
  readonly x: number;
  readonly y: number;
  /** false → NaN / Infinity / clipped out of drawable range */
  readonly isValid: boolean;
  /** true → lift pen here (vertical asymptote or large discontinuity) */
  readonly isBreak: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * |Δy| > yRange × BREAK_THRESHOLD  →  treat as discontinuity.
 * Covers tan(x), cot(x), 1/x, etc.
 */
const BREAK_THRESHOLD = 2.5;

/**
 * Points with |y| > yRange × CLIP_FACTOR are discarded entirely
 * (isValid = false) to keep Canvas path data bounded.
 */
const CLIP_FACTOR = 10;

/**
 * Additional asymptote-crossing heuristic: if adjacent valid points have
 * opposite signs AND at least one has |y| > yRange × SIGN_FACTOR, it is
 * almost certainly an asymptote crossing, not a genuine zero crossing.
 */
const SIGN_FACTOR = 1.5;

// ─── Internal helpers ────────────────────────────────────────────────────────

function checkBreak(
  rawY: number,
  prevValidY: number,
  yRange: number,
): boolean {
  const deltaY = Math.abs(rawY - prevValidY);
  if (deltaY > yRange * BREAK_THRESHOLD) return true;

  // Asymptote-crossing: opposite signs + at least one extreme value
  if (
    Math.sign(rawY) !== Math.sign(prevValidY) &&
    (Math.abs(rawY) > yRange * SIGN_FACTOR ||
      Math.abs(prevValidY) > yRange * SIGN_FACTOR)
  ) {
    return true;
  }
  return false;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sample `expr` across the viewport's x-range in `steps` evenly-spaced steps.
 *
 * Discontinuity detection (for y = 1/x, tan(x), etc.):
 *  - Condition 1: |Δy| > viewport.yRange × 2.5  →  isBreak = true
 *  - Condition 2: sign change + extreme magnitude →  isBreak = true
 *
 * @param steps  Number of sample intervals (default 800).
 */
export function sample(
  expr: CompiledExpression,
  viewport: Viewport,
  steps = 800,
  scope?: Record<string, unknown>,
): SamplePoint[] {
  const { xMin, xMax, yMin, yMax, yRange } = viewport;
  const dx           = (xMax - xMin) / steps;
  const clipYMin     = yMin - yRange * CLIP_FACTOR;
  const clipYMax     = yMax + yRange * CLIP_FACTOR;

  const points: SamplePoint[] = [];
  let prevValidY: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const x    = xMin + i * dx;
    const rawY = evaluateAt(expr, x, scope);

    const isValid =
      isFinite(rawY) && rawY > clipYMin && rawY < clipYMax;

    if (!isValid) {
      points.push({ x, y: rawY, isValid: false, isBreak: false });
      prevValidY = null;
      continue;
    }

    const isBreak: boolean =
      prevValidY !== null && checkBreak(rawY, prevValidY, yRange);

    points.push({ x, y: rawY, isValid: true, isBreak });
    // After a break the "previous valid" resets so the next segment starts fresh
    prevValidY = isBreak ? null : rawY;
  }

  return points;
}

/**
 * Sample `expr` with the parametric transform  y = a · f(b(x − h)) + k.
 *
 * Chain rule for derivative rendering (Phase 6):  y′ = a·b · f′(b(x−h))
 *
 * @param steps  Number of sample intervals (default 800).
 */
export function sampleWithTransform(
  expr: CompiledExpression,
  viewport: Viewport,
  transform: Transform,
  steps = 800,
  scope?: Record<string, unknown>,
): SamplePoint[] {
  const { a, b, h, k }           = transform;
  const { xMin, xMax, yMin, yMax, yRange } = viewport;
  const dx       = (xMax - xMin) / steps;
  const clipYMin = yMin - yRange * CLIP_FACTOR;
  const clipYMax = yMax + yRange * CLIP_FACTOR;

  const points: SamplePoint[] = [];
  let prevValidY: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const x      = xMin + i * dx;
    const xPrime = b * (x - h);           // horizontal transform
    const rawFx  = evaluateAt(expr, xPrime, scope);
    const rawY   = isFinite(rawFx) ? a * rawFx + k : rawFx; // vertical transform

    const isValid =
      isFinite(rawY) && rawY > clipYMin && rawY < clipYMax;

    if (!isValid) {
      points.push({ x, y: rawY, isValid: false, isBreak: false });
      prevValidY = null;
      continue;
    }

    const isBreak: boolean =
      prevValidY !== null && checkBreak(rawY, prevValidY, yRange);

    points.push({ x, y: rawY, isValid: true, isBreak });
    prevValidY = isBreak ? null : rawY;
  }

  return points;
}

/**
 * Sample a derivative expression across the viewport, but only where the
 * original function is defined (finite). This prevents derivative curves from
 * appearing in regions where the original function is undefined (e.g. x < 0
 * for ln(x), or at asymptotes for 1/x).
 *
 * @param originalExpr  The original function expression (for domain checking).
 * @param derivExpr     The symbolic derivative expression.
 * @param transform     The original function's transform (a,b,h,k). The
 *                      derivative transform uses a*b but same b,h,k.
 * @param steps         Number of sample intervals (default 800).
 */
export function sampleDerivativeWithDomain(
  originalExpr: CompiledExpression,
  derivExpr:    CompiledExpression,
  viewport:     Viewport,
  transform:    Transform,
  steps = 800,
  scope?: Record<string, unknown>,
): SamplePoint[] {
  const { a, b, h }          = transform;
  const { xMin, xMax, yMin, yMax, yRange } = viewport;
  const dx       = (xMax - xMin) / steps;
  const clipYMin = yMin - yRange * CLIP_FACTOR;
  const clipYMax = yMax + yRange * CLIP_FACTOR;

  // Derivative transform: y' = a*b * f'(b(x-h))
  const derivA = a * b;

  const points: SamplePoint[] = [];
  let prevValidY: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const x      = xMin + i * dx;
    const xPrime = b * (x - h);  // same horizontal transform

    // Domain check: original must be defined here
    const origFx = evaluateAt(originalExpr, xPrime, scope);
    if (!isFinite(origFx)) {
      points.push({ x, y: NaN, isValid: false, isBreak: false });
      prevValidY = null;
      continue;
    }

    // Evaluate derivative
    const derivFx = evaluateAt(derivExpr, xPrime, scope);
    const rawY    = isFinite(derivFx) ? derivA * derivFx : derivFx;  // k=0 for derivatives

    const isValid =
      isFinite(rawY) && rawY > clipYMin && rawY < clipYMax;

    if (!isValid) {
      points.push({ x, y: rawY, isValid: false, isBreak: false });
      prevValidY = null;
      continue;
    }

    const isBreak: boolean =
      prevValidY !== null && checkBreak(rawY, prevValidY, yRange);

    points.push({ x, y: rawY, isValid: true, isBreak });
    prevValidY = isBreak ? null : rawY;
  }

  return points;
}

// ─── High-level FunctionEntry evaluators (snapping / interaction) ─────────

/**
 * Evaluate a full FunctionEntry (expression + transform) at a single math x.
 *
 * Applies y = a · f(b(x−h)) + k.
 * Returns null when the expression fails to parse or the result is non-finite.
 */
export function evaluateStandard(fn: FunctionEntry, mathX: number): number | null {
  const compiled = compileExpression(fn.exprStr);
  if (isParseError(compiled)) return null;

  // For custom functions (templateId === null) that have detected named params,
  // build a scope so math.js can resolve coefficient symbols like a, b, c.
  const scope: Record<string, unknown> | undefined =
    fn.templateId === null && fn.namedParams.length > 0
      ? Object.fromEntries(fn.namedParams.map((p) => [p.name, p.value]))
      : undefined;

  const { a, b, h, k } = fn.transform;
  const xPrime = b * (mathX - h);
  const rawFx  = evaluateAt(compiled, xPrime, scope);
  if (!isFinite(rawFx)) return null;

  const y = a * rawFx + k;
  return isFinite(y) ? y : null;
}

/**
 * Numerical derivative of the full transformed curve at mathX.
 *
 * Central difference h = 1e-7 on `evaluateStandard`, so the result
 * already accounts for the a·b chain-rule factor analytically.
 * Returns null if either neighbour cannot be evaluated.
 */
export function getNumericalDerivative(fn: FunctionEntry, mathX: number): number | null {
  const H      = 1e-7;
  const yPlus  = evaluateStandard(fn, mathX + H);
  const yMinus = evaluateStandard(fn, mathX - H);
  if (yPlus === null || yMinus === null) return null;
  return (yPlus - yMinus) / (2 * H);
}
