# Task: Phase 3 — Renderer & Real-time Integration

**Task ID**: v0.2-p3
**Status**: ✅ COMPLETE
**Date started**: 2026-03-12

---

## Scope

| Sub-task | File | Status |
|----------|------|--------|
| T3.1 | `src/canvas/renderers/axisRenderer.ts` | ✅ done |
| T3.2 | `src/canvas/renderers/curveRenderer.ts` | ✅ done |
| T3.3 | `src/editor/tools/types.ts` + `PanZoomTool.ts` + `Editor.ts` | ✅ done |
| Cmds | `src/editor/commands/AddFunctionCommand.ts` | ✅ done |
| Cmds | `src/editor/commands/RemoveFunctionCommand.ts` | ✅ done |
| Cmds | `src/editor/commands/UpdateFunctionParamCommand.ts` | ✅ done |
| T3.4 | `src/components/FunctionCanvas.tsx` render scheduling | ✅ done |
| T3.5 | `src/components/panels/FunctionListPanel.tsx` | ✅ done |
| T3.6 | `src/components/panels/FunctionInputPanel.tsx` | ✅ done |
| Layout | `src/components/layout/M02Layout.tsx` panels integration | ✅ done |

---

## ESLint Note

`eslint-plugin-react-hooks@4.6.2` crashes (`context.getSource is not a function`) on ESLint 9
when the rule detects missing deps and attempts to generate an autofix suggestion.
Fix: structure `useEffect` dep arrays to be complete so the rule never reaches the autofix path.
In `FunctionInputPanel.tsx`, use `useFunctionStore.getState()` inside the effect body so the
dep array only contains `activeFunctionId` (which is fully listed).

---

## Execution Log

**[2026-03-12] T3.1** `axisRenderer.ts`
- `pickStep`: candidates [0.1..100], first to fit [40, 120]px, fallback to first ≥40px
- Background fill `#141417`, dashed grid [1,3] `#2A2A2E`, solid axes `#555` 1.5px
- X-axis labels below line, Y-axis labels left of line, origin skipped; 12px monospace `#6B6B70`
- Origin circle 3px `#555`; axis arrows (triangles) at canvas edges
- lint ✅  tsc ✅

**[2026-03-12] T3.2** `curveRenderer.ts`
- `renderCurve(ctx, points, viewport, color, options?)`: Path2D with break detection
- `isValid=false` → reset `hasMoveTo`, skip; `isBreak=true` → moveTo; else lineTo
- Supports `lineWidth`, `lineDash`, `alpha` options for Phase 6 derivative rendering
- lint ✅  tsc ✅

**[2026-03-12] T3.3** Tool types + PanZoomTool + Editor
- Added `onDblClick?(event: ToolEvent): void` to `Tool` interface
- `PanZoomTool`: canvas-pixel delta pan `(dMathX = (canvasΔX / vp.width) * vp.xRange)`
- `PanZoomTool.onDblClick()`: resets viewport to `Viewport(-10,10,-6,6,w,h)`
- `Editor.dispatchDblClick(event)`: delegates to `activeTool?.onDblClick?.(event)`
- Lint fix: `onDblClick()` no param (unused-param rule)
- lint ✅  tsc ✅

**[2026-03-12] Commands** AddFunctionCommand / RemoveFunctionCommand / UpdateFunctionParamCommand
- Exact spec from T4.1–T4.3; created in Phase 3 because T3.5/T3.6 panels need them
- lint ✅  tsc ✅

**[2026-03-12] T3.4** `FunctionCanvas.tsx` render scheduling
- `useState(canvasSize)` triggers re-render on ResizeObserver events
- Zustand subscriptions: `functions`, `viewport`, `features`
- Static layer effect deps: `[functions, viewport, features.showGrid, canvasSize]`
- Added `dblclick` event listener → `dispatchDblClick`
- lint ✅  tsc ✅

**[2026-03-12] T3.5** `FunctionListPanel.tsx`
- Color dot, label = exprStr, 👁 toggle (no Undo), 🗑 RemoveFunctionCommand
- [+] button: AddFunctionCommand with auto-label (f(x)..t(x)), max 8 functions
- Active row highlighted; click row → setActiveFunctionId
- lint ✅  tsc ✅

**[2026-03-12] T3.6** `FunctionInputPanel.tsx`
- Live compile on change → green ✓/red ✗ indicator; valid → preview update (no Command)
- blur/Enter → `UpdateFunctionParamCommand`; Escape/invalid → revert to last valid expr
- 8 quick-insert buttons (sin, cos, tan, sqrt, abs, log, π, e); `onMouseDown` + `e.preventDefault()`
  prevents input blur when clicking symbol buttons
- lint ✅  tsc ✅

**[2026-03-12] Layout** `M02Layout.tsx`
- Replaced placeholder aside with `<FunctionListPanel />` + `<FunctionInputPanel />`
- Removed unused `editorInstance` import
- lint ✅  tsc ✅
