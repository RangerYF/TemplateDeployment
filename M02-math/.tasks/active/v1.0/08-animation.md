# Task: Phase 8 — Animation System

**Task ID**: v0.2-p8
**Status**: ✅ COMPLETE
**Date started**: 2026-03-13
**Date completed**: 2026-03-13

---

## Scope

| Sub-task | File | Status |
|----------|------|--------|
| T8.1 | `src/engine/animationEngine.ts` (new) | ✅ done |
| Store | `src/editor/store/animationStore.ts` (new) | ✅ done |
| T8.2 | `TransformPanel.tsx` — per-param demo buttons | ✅ done |
| T8.3 | `PanZoomTool.ts` — smooth dblclick viewport reset | ✅ done |
| T8.4 | `FunctionCanvas.tsx` — adaptive sample steps | ✅ done |

---

## Architecture

### animationEngine.ts (T8.1)
- `startAnimation(config): () => void` — single-value RAF loop, returns cancel fn
- `startMultiAnimation(configs, easing, duration, onComplete?): () => void` — parallel multi-value loop (one RAF shared across all configs), returns cancel fn
- Easings: `easeInOut` (cubic), `easeOut` (cubic), `linear`

### animationStore.ts
Minimal Zustand store: `isAnyAnimating: boolean` + `setIsAnimating(v)`.
Set to `true` while any animation is running; triggers FunctionCanvas to use 400 steps instead of 800.

### TransformPanel.tsx (T8.2)
- Replaced old sine-wave `a`-only animation with per-param demo buttons for all 4 params
- `animatingParam: ParamKey | null` + `cancelRef` track the active animation
- `stopDemo`: stable `useCallback([], [])` — cancels RAF, resets state
- Demo button: ▶ to start, ■ to stop immediately (curve stays at current position)
- Demo specs: a→2.0, b→2.0, h→3.0, k→2.0 (all 800ms easeInOut)
- `onFrame`: reads latest transform from store (no stale closure) and updates only the animated param
- `onComplete`: writes `UpdateFunctionParamCommand(capturedBefore, after)` for Undo support
- `h` hint text: "f(x−h)：h>0 右移，h<0 左移" rendered below the h row
- Slider disabled for animating param

### PanZoomTool.ts (T8.3)
- `onDblClick()` now uses `startMultiAnimation` for 400ms easeOut smooth reset
- Four parallel configs (xMin, xMax, yMin, yMax) share one RAF loop via shared mutable locals + `sync()` helper
- Sets `isAnyAnimating` true/false around the animation

### FunctionCanvas.tsx (T8.4)
- `const isAnimating = useAnimationStore(s => s.isAnyAnimating)` component-level subscription
- `const steps = isAnimating ? 400 : 800` inside static layer effect
- Steps passed to `sampleWithTransform`, `evaluatePiecewiseRange`, and derivative `sampleWithTransform`
- `isAnimating` added to static layer dep array

---

## Execution Log

**[2026-03-13] All sub-tasks**
- animationEngine.ts: startAnimation + startMultiAnimation + easeInOut/easeOut/linear
- animationStore.ts: isAnyAnimating boolean store
- TransformPanel.tsx: full rewrite — per-param ▶/■ demo with Undo, h hint, stable stopDemo
- PanZoomTool.ts: smooth 400ms animated dblclick reset
- FunctionCanvas.tsx: isAnimating subscription + adaptive steps
- lint ✅  tsc ✅
