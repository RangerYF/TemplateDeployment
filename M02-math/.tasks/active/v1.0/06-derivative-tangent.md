# Task: Phase 6 — Derivative Curve & Tangent Line

**Task ID**: v0.2-p6
**Status**: ✅ COMPLETE
**Date started**: 2026-03-12
**Date completed**: 2026-03-13

---

## Scope

| Sub-task | File | Status |
|----------|------|--------|
| Store | `functionStore.ts` — tangentY, tangentSlope, setTangentPoint | ✅ done |
| Types | `tools/types.ts` — onPointerLeave | ✅ done |
| Editor | `Editor.ts` — dispatchPointerLeave | ✅ done |
| T6.1 | `FunctionCanvas.tsx` — derivative curve on static layer | ✅ done |
| T6.2 | `tangentRenderer.ts` (new) | ✅ done |
| T6.3 | `TraceTool.ts` (new) | ✅ done |
| T6.4 | `FunctionCanvas.tsx` — tangent on dynamic layer | ✅ done |
| T6.5 | `DerivativePanel.tsx` (new) | ✅ done |
| Layout | `M02Layout.tsx` | ✅ done |

---

## Architecture

### functionStore.ts changes
- `tangentX: number | null` (was `number`)
- `tangentY: number` (new)
- `tangentSlope: number | null` (new)
- `setTangentPoint(x, y, slope)` — atomic set for all three tangent fields

### tangentRenderer.ts (T6.2)
`renderTangent(ctx, x0, y0, slope, viewport, color): void`
1. Tangent line: extended to viewport edges (lineWidth 1.5, alpha 0.8)
2. Tangent point: filled circle radius 5px + white border ring + glow shadowBlur=12
3. Slope label: `k = 1.234` at (+10, -14) from canvas point
4. Coord label: `(x₀, y₀)` at (+10, +18) from canvas point
5. slope=NaN → circle only; slope=±Infinity → vertical line + `k = ∞`

### TraceTool.ts (T6.3)
- `onPointerMove`: calls `evaluateStandard` + `getNumericalDerivative`, writes via `setTangentPoint`
- `onPointerLeave`: clears tangent state (`setTangentPoint(null, 0, null)`)
- Activated/deactivated by DerivativePanel "显示切线" toggle

### FunctionCanvas.tsx (T6.1 + T6.4)
- T6.1: After regular curves, if `features.showDerivative`: compileDerivative + derivTransform `{a:a*b, b, h, k:0}` + renderCurve `{alpha:0.5, lineDash:[5,4], lineWidth:1.5}`
- T6.4: New `useEffect` on dynamic canvas; deps `[features.showTangent, tangentX/Y/Slope, functions, viewport, canvasSize]`; calls renderTangent with activeFn.color
- Snap suppression: `if (!isDraggingRef.current && !showTangentNow) updateSnap(...)`
- Static layer effect deps updated to include `features.showDerivative`

### DerivativePanel.tsx (T6.5)
- Only renders when `activeFunctionId && mode === 'standard'`
- "显示导数曲线" toggle → `setFeature('showDerivative', ...)`
- Symbolic derivative display: `f′(x) = cos(x)` via `symbolicDerivativeStr`
- "显示切线" toggle → calls `editorInstance.activateTool(TraceTool|PanZoomTool)`
- Tangent info block: x₀, y₀, k — visible when `showTangent && tangentX !== null`
- `|k| < 0.01` → green "极值点附近" hint

---

## Execution Log

**[2026-03-12] Store + Types + Editor**
- functionStore: tangentX nullable, tangentY+tangentSlope added, setTangentPoint atomic action
- tools/types.ts: onPointerLeave?() added to Tool interface
- Editor.ts: dispatchPointerLeave() added
- lint ✅  tsc ✅

**[2026-03-13] T6.2 + T6.3 + T6.1 + T6.4 + T6.5 + Layout**
- tangentRenderer.ts: renderTangent with line/circle/labels
- TraceTool.ts: evaluateStandard + getNumericalDerivative → setTangentPoint
- PanZoomTool.ts: onPointerLeave() no-op added
- FunctionCanvas.tsx: T6.1 derivative block + T6.4 tangent useEffect + snap guard + dep fix
- DerivativePanel.tsx: full panel with toggles + tangent info
- M02Layout.tsx: DerivativePanel added above HistoryPanel for standard functions
- lint ✅  tsc ✅
