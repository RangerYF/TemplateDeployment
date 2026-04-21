# Task: Phase 5 — Cursor Snap & Interaction System

**Task ID**: v0.2-p5
**Status**: ✅ COMPLETE
**Date started**: 2026-03-12

---

## Scope

| Sub-task | File | Status |
|----------|------|--------|
| T5.1 | `src/engine/sampler.ts` — evaluateStandard + getNumericalDerivative | ✅ done |
| T5.2 | `src/editor/store/interactionStore.ts` | ✅ done |
| T5.3 | `src/components/FunctionCanvas.tsx` — snap + RAF loop | ✅ done |
| T5.4 | `src/canvas/renderers/dynamicRenderer.ts` — glow + tooltip | ✅ done |

---

## Architecture

### T5.1 — sampler.ts additions
`evaluateStandard(fn: FunctionEntry, mathX): number | null`
- Applies full transform: xPrime = b(x−h), y = a·f(xPrime)+k
- Returns null on parse error or non-finite result
- Uses LRU-cached compileExpression (no recompile overhead)

`getNumericalDerivative(fn: FunctionEntry, mathX): number | null`
- Central diff h=1e-7 on `evaluateStandard` (covers a·b chain-rule automatically)
- Returns null if either neighbour is non-evaluable

### T5.2 — interactionStore.ts
Standalone Zustand store, entirely isolated from historyStore.
`HoveredPoint`: mathX, mathY, canvasX, canvasY, functionId, slope, isVisible.
`slope` included for Phase 6 tangent line rendering (no extra computation needed).

### T5.3 — FunctionCanvas.tsx snap logic
`SNAP_PX = 20` canvas-pixel threshold.
`isDraggingRef` suppresses snap during pan/zoom drag.
`rafPendingRef` guard prevents stacking multiple RAF calls per frame.
`updateSnap(canvasX, canvasY)`:
  1. Convert canvasX → mathX via `getLiveVp().toMath()`
  2. For each visible standard-mode function: evaluateStandard → canvas Y → pixel distance
  3. Nearest within SNAP_PX wins (explicit tie-breaking)
  4. Writes to interactionStore + calls scheduleRaf()
`scheduleRaf()`:
  - One guard flag → only one pending RAF at any time
  - Inside RAF: reads live viewport from editorRef + live functions from store
  - Passes both to renderDynamic (no stale closure issues)
Static layer effect: clears dynamic canvas + nulls hoveredPoint on every redraw
  (prevents stale tooltip after pan/zoom/function change)

### T5.4 — dynamicRenderer.ts
`renderDynamic(ctx, hoveredPoint, functions, viewport)`:
1. clearRect full canvas
2. If !hoveredPoint?.isVisible → return early
3. Snap circle: shadowBlur=16 glow in fn.color + white 2px border ring
4. Tooltip: `(x.xx, y.yy)`, 12px monospace, dark semi-transparent pill background
   - Coloured 1px border at 55% opacity
   - Auto-flip: right→left when within 6px of right edge; below when within 6px of top
   - Hard-clamp to keep tooltip inside canvas in all extreme positions
5. `roundRectPath` helper (manual arcTo chain) for cross-browser rounded rects

---

## Execution Log

**[2026-03-12] T5.1** sampler.ts
- Added FunctionEntry import + compileExpression/isParseError imports
- `evaluateStandard` + `getNumericalDerivative` appended after sampleWithTransform
- lint ✅  tsc ✅

**[2026-03-12] T5.2** interactionStore.ts
- HoveredPoint interface includes slope (null-able) for Phase 6 tangent use
- Zustand create with single setHoveredPoint action
- lint ✅  tsc ✅

**[2026-03-12] T5.4** dynamicRenderer.ts
- hexToRgba helper for function-coloured tooltip border
- roundRectPath manual arcTo path (no ctx.roundRect dependency)
- Glow via ctx.shadowBlur=16 + ctx.shadowColor=fnColor
- Tooltip edge-detection + hard clamp
- lint ✅  tsc ✅

**[2026-03-12] T5.3** FunctionCanvas.tsx
- Removed unused buildVp helper (lint fix)
- Two new refs: rafPendingRef, isDraggingRef
- updateSnap + scheduleRaf defined inside event effect (close over stable refs)
- pointerleave handler added
- Static layer effect now clears dynamic canvas + interactionStore on each full redraw
- lint ✅  tsc ✅
