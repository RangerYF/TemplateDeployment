# Task: Phase 2 — Math Engine & Sampler

**Task ID**: v0.2-p2
**Status**: ✅ COMPLETE
**Date started**: 2026-03-12

---

## Scope

| Sub-task | File | Status |
|----------|------|--------|
| T2.1 | `src/engine/expressionEngine.ts` | ✅ done |
| T2.2 | `src/engine/sampler.ts` | ✅ done |
| T2.3 | `src/engine/featurePoints.ts` | ✅ done |
| T2.4 | `src/engine/piecewiseEvaluator.ts` | ✅ done |

---

## Library Note

The project spec locks **math.js** (already installed in `package.json`) as the math engine.
`expr-eval` is NOT used — math.js provides symbolic differentiation (`math.derivative`)
which is required for T2.3 (inflection points) and Phase 6 (derivative curves).

---

## Integration Note

"Update `Editor.ts`" is a Phase 3 concern: sampling is triggered reactively when
`FunctionCanvas` re-renders in response to store changes. `Editor.getViewport()` already
exposes what the renderer needs. No changes to `Editor.ts` are required in Phase 2.

---

## Execution Log

**[2026-03-12] T2.1** `expressionEngine.ts`
- `compileExpression`: math.js parse+compile, LRU-50 cache, safe Map eviction via destructuring
- `evaluateAt`: guards against Complex/Matrix results (`typeof result === 'number'`)
- `symbolicDerivativeStr` / `compileDerivative`: math.js symbolic diff for Phase 6 panels
- `numericalDerivative`: central difference h=1e-7, used by feature scanners
- lint ✅  tsc ✅

**[2026-03-12] T2.2** `sampler.ts`
- `sample` / `sampleWithTransform`: 800-step uniform scan with CLIP_FACTOR=10
- `checkBreak` helper (extracted from loop): two conditions:
    1. |Δy| > yRange×2.5 (large jump)
    2. sign change + |y| > yRange×1.5 (asymptote crossing)
- After a break, `prevValidY` resets to null so the next sub-curve starts fresh
- `onValueCommit` added to Slider (Phase 4 drag-end Undo hook)
- lint ✅  tsc ✅

**[2026-03-12] T2.3** `featurePoints.ts`
- `bisect`: 20-iteration bisection, precision ~1e-6
- `findZeros`: scan 1000 steps; sign-change + exact-zero guards; duplicate window 2×dx
- `findExtrema`: f′ sign-change via `numericalDerivative`; +→− = localMax, −→+ = localMin
- `findInflections`: f″ sign-change via central diff on f′ with h=1e-5
- `scanFeaturePoints`: unified entry, sorts by x
- lint ✅  tsc ✅

**[2026-03-12] T2.4** `piecewiseEvaluator.ts`
- `inDomain`: handles null bounds (±∞), inclusive/exclusive flags
- `evaluatePiecewise`: first-match semantics, returns null on no-match or parse error
- `evaluatePiecewiseRange`: per-segment independent sampling, returns `{ segment, points }[]`
  so the renderer can draw each sub-curve separately and place correct endpoint symbols
- lint ✅  tsc ✅
