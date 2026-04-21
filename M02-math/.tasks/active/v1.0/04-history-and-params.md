# Task: Phase 4 — History & Parameter Transforms

**Task ID**: v0.2-p4
**Status**: ✅ COMPLETE
**Date started**: 2026-03-12

---

## Scope

| Sub-task | File | Status |
|----------|------|--------|
| T4.0 | historyStore review + Ctrl+Z/Y keyboard shortcuts in M02Layout | ✅ done |
| T4.1–T4.3 | Commands (AddFunction / RemoveFunction / UpdateFunctionParam) | ✅ done (Phase 3) |
| T4.2 | `src/components/panels/HistoryPanel.tsx` | ✅ done |
| T4.4 | `src/components/panels/TransformPanel.tsx` | ✅ done |
| T4.5 | `src/components/panels/ViewportPanel.tsx` | ✅ done |
| T4.6 | `src/components/layout/M02Layout.tsx` layout update | ✅ done |

---

## Key Design Decisions

### UpdateFunctionParamCommand label
Extended constructor signature: `(id, before, after, label = '修改函数参数')`.
TransformPanel passes descriptive labels like `调整 a (1.0 → 2.5)` for HistoryPanel display.

### Zero-skip (a, b)
`skipZero(newValue, prevValue)`: if `|newValue| < 0.05`, snap to ±0.1 based on `prevValue` sign.
Applied on both `onValueChange` (live) and `onValueCommit` (undo snapshot).

### Drag-commit pattern
`dragStartRef.current` captures transform at first `onValueChange` call (lazy capture on first drag).
Reset to `null` after `onValueCommit` writes the command. No-op if value unchanged.

### Animation (a oscillation)
`requestAnimationFrame` sine wave: `a(t) = 4.5 · sin(2π·t / 4000ms)`.
Zero-skip applied per frame. Slider disabled during play. Stop restores pre-animation `a`.
RAF cancelled in `useEffect` cleanup and when `activeFunctionId` changes.

### ViewportPanel
Collapsible (default collapsed). Validates `xMin < xMax`, `yMin < yMax` on blur/Enter.
Viewport changes NOT recorded in Undo history (per spec).

### M02Layout panel order
```
函数列表   ← always
表达式输入 ← activeFunctionId != null
变换参数   ← activeFunctionId != null AND mode=standard
操作历史   ← always
视口范围   ← always, collapsed by default
```

---

## Execution Log

**[2026-03-12] T4.0** historyStore + Ctrl+Z/Y
- historyStore confirmed complete from Phase 1 — no changes needed
- Added `useEffect` keyboard handler in M02Layout: Ctrl+Z=undo, Ctrl+Y/Ctrl+Shift+Z=redo
- lint ✅  tsc ✅

**[2026-03-12] HistoryPanel** `src/components/panels/HistoryPanel.tsx`
- undoStack (oldest→newest), ▶ marker on current entry
- redoStack shown grey + strikethrough below current position
- Scrollable max-height 160px
- lint ✅  tsc ✅

**[2026-03-12] UpdateFunctionParamCommand** — added optional `label` parameter
- Backwards-compatible: default value `'修改函数参数'`
- lint ✅  tsc ✅

**[2026-03-12] T4.4** `src/components/panels/TransformPanel.tsx`
- Grid layout: param letter | Slider | value display [▶ for a]
- onValueChange → store direct update (live preview); onValueCommit → UpdateFunctionParamCommand
- skipZero applied both paths; RAF animation for `a` (4.5 amplitude, 4s period)
- 重置变换 writes UpdateFunctionParamCommand (Undo-able)
- lint ✅  tsc ✅

**[2026-03-12] T4.5** `src/components/panels/ViewportPanel.tsx`
- 4 number inputs (xMin, xMax, yMin, yMax); commit on blur or Enter
- Validation: NaN check + xMin<xMax, yMin<yMax; inline error message
- Syncs fields from store when external viewport changes (pan/zoom/dblclick reset)
- Collapsible header, default collapsed
- lint ✅  tsc ✅

**[2026-03-12] T4.6** `src/components/layout/M02Layout.tsx`
- Conditional panel rendering per spec (standard mode guard for TransformPanel)
- `Divider` helper component for consistent separators
- lint ✅  tsc ✅
