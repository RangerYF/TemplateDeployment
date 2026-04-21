# Task Summary: Phase 1 — Infrastructure & Editor Core

**Task ID**: v0.1-p1
**Status**: ✅ COMPLETED
**Date**: 2026-03-12
**Branch**: master

---

## Objectives

Set up the complete engineering scaffold for the M02 Function Lab, establishing the Editor architecture core, Viewport coordinate system, Zustand state stores, dual-layer Canvas container, and application layout. All subsequent phases build on this foundation.

---

## Artifacts Created

### Config & Project Scaffold
| File | Description |
|------|-------------|
| `package.json` | Vite + React + TS project, dependencies: mathjs, zustand, lucide-react, clsx, tailwind-merge, tailwindcss |
| `vite.config.ts` | `@vitejs/plugin-react`, path alias `@/` → `src/` |
| `tsconfig.app.json` | Strict TS, `noEmit`, `paths: { "@/*": ["src/*"] }` |
| `eslint.config.js` | typescript-eslint + react-hooks + react-refresh; `design_guid/` excluded |
| `tailwind.config.js` | Content: `index.html` + `src/**` |
| `index.html` | App entry, `lang="zh-CN"` |

### Source Files
| File | Description |
|------|-------------|
| `src/styles/colors.ts` | Dark-theme design tokens (`COLORS` object, 12 tokens) |
| `src/types.ts` | `Transform`, `ViewportState`, `FunctionEntry`, `PiecewiseSegment`, `FUNCTION_COLORS` |
| `src/canvas/Viewport.ts` | Immutable coordinate transform class with Y-axis flip |
| `src/editor/commands/types.ts` | `Command` interface: `execute()` / `undo()` |
| `src/editor/tools/types.ts` | `Tool` interface + `ToolEvent` |
| `src/editor/store/historyStore.ts` | Zustand: undoStack / redoStack, max depth 50 |
| `src/editor/store/functionStore.ts` | Zustand: functions[], viewport, features flags |
| `src/editor/core/Editor.ts` | Central controller; `editorInstance` singleton |
| `src/editor/tools/PanZoomTool.ts` | Pan + scroll-zoom skeleton (logic completed in Phase 3) |
| `src/components/FunctionCanvas.tsx` | Dual-layer canvas + ResizeObserver + pointer/wheel dispatch |
| `src/components/layout/M02Layout.tsx` | TopBar (Undo/Redo) + FunctionCanvas + 280px right panel |
| `src/App.tsx` | Root component |
| `src/main.tsx` | ReactDOM entry |
| `src/index.css` | Tailwind directives + global reset |

---

## Technical Highlights

### Viewport Math (Y-axis Flip)

The `Viewport` class is the single source of truth for all coordinate transforms between math space (Y-up) and canvas pixels (Y-down).

```
Math → Canvas:
  cx = (mathX - xMin) / xRange * width
  cy = height - (mathY - yMin) / yRange * height   ← Y-flip

Canvas → Math (inverse):
  mx = canvasX / width * xRange + xMin
  my = (height - canvasY) / height * yRange + yMin
```

**Verified spot checks** (default viewport: xMin=-10, xMax=10, yMin=-6, yMax=6, 800×600):

| Call | Result | ✓ |
|------|--------|---|
| `toCanvas(0, 0)` | `[400, 300]` | center ✓ |
| `toCanvas(-10, 6)` | `[0, 0]` | top-left ✓ |
| `toCanvas(10, -6)` | `[800, 600]` | bottom-right ✓ |
| `toMath(toCanvas(3,-2))` | `[3, -2]` | round-trip error < 1e-10 ✓ |

`Viewport` is fully immutable: `zoomAt`, `pan`, `withSize`, `withRange` all return new instances.

### Command / History Architecture

**Key design decision**: `historyStore.execute()` is a stack-manager only — it does **not** call `cmd.execute()` again. The execution chain is strictly:

```
Editor.execute(cmd)
  ↓ cmd.execute()          ← side effects happen here
  ↓ historyStore.execute(cmd)  ← push to undoStack only
```

This prevents double-execution bugs when commands are called from animation callbacks or slider drag-end handlers.

### Dual-Layer Canvas Strategy

```
containerRef (div, 100% × 100%, ResizeObserver)
├── staticRef  (canvas, position: absolute)  ← axes, curves
└── dynamicRef (canvas, position: absolute)  ← tangent, highlights
```

Both canvases are kept pixel-identical by the `ResizeObserver`. The `dynamicRef` layer captures all pointer events; wheel events prevent default to allow zoom without page scroll.

---

## Verification

```
pnpm lint         → ✅ 0 errors, 0 warnings
pnpm tsc --noEmit → ✅ 0 errors
```

All Phase 1 acceptance criteria from `M02-vv.md` are satisfied:
- [x] `pnpm tsc --noEmit` 零错误
- [x] `pnpm lint` 零 error
- [x] 双层 Canvas 区域和右侧面板框架渲染
- [x] resize 时两层 Canvas 尺寸同步更新
- [x] 控制台可访问 `editorInstance`
- [x] `toCanvas(0,0)` 返回中心点（400, 300）
- [x] `toMath(toCanvas(3,-2))` 还原精度 < 1e-10

---

## Notes

- `design_guid/` folder added to ESLint ignore list — it contains pre-existing lint errors from another project that are not M02's responsibility.
- PanZoomTool pan logic includes the post-pan `lastMath` recalculation (fixes the "viewport drifts" bug that the original skeleton left as a TODO for Phase 3).
