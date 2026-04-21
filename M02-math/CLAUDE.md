# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**M-02 函数图形实验室** — A professional 2D function graphing lab built as an independent repository. The full development plan is in `M02-vv.md`.

## Tech Stack

- **Framework**: React + TypeScript (Vite)
- **Math engine**: math.js (expression parsing, symbolic differentiation)
- **State**: Zustand
- **Canvas**: Native dual-layer Canvas 2D (no third-party drawing libs)
- **Styling**: Tailwind CSS + clsx + tailwind-merge
- **Icons**: lucide-react
- **Package manager**: pnpm

## Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm tsc --noEmit # type check (run after each phase)
pnpm lint         # ESLint check (run after each phase)
```

After each development phase, run both checks before proceeding:
```bash
pnpm lint && pnpm tsc --noEmit
```

## Architecture

### Core Structure

```
src/
├── editor/           ← Architecture core
│   ├── core/Editor.ts          ← Central controller (owns Viewport, HistoryStack, active Tool)
│   ├── commands/               ← Command pattern for Undo/Redo (max depth: 50)
│   │   ├── types.ts            ← Command interface: execute/undo
│   │   ├── AddFunctionCommand.ts
│   │   ├── RemoveFunctionCommand.ts
│   │   └── UpdateFunctionParamCommand.ts
│   ├── tools/                  ← Tool interface: onPointerDown/Move/Up/Wheel
│   │   ├── PanZoomTool.ts      ← Canvas pan + scroll zoom
│   │   └── TraceTool.ts        ← Curve trace + tangent interaction
│   └── store/
│       ├── functionStore.ts    ← Zustand: functions[], activeFunctionId, viewport, features
│       └── historyStore.ts     ← Zustand: undoStack, redoStack, canUndo/canRedo
├── engine/
│   ├── expressionEngine.ts     ← math.js wrapper, LRU cache (50 entries), symbolic derivative
│   ├── sampler.ts              ← High-frequency sampling + discontinuity detection
│   ├── featurePoints.ts        ← Zero/extrema/inflection point scanner (bisection, 20 iterations)
│   └── piecewiseEvaluator.ts   ← Piecewise function evaluation
├── canvas/
│   ├── Viewport.ts             ← Coordinate transform (Y-axis flip), zoom, pan
│   └── renderers/
│       ├── axisRenderer.ts
│       ├── curveRenderer.ts
│       ├── tangentRenderer.ts
│       └── featurePointRenderer.ts
├── components/
│   ├── FunctionCanvas.tsx      ← Dual-layer canvas container (staticRef + dynamicRef)
│   └── panels/
│       ├── FunctionListPanel.tsx
│       ├── FunctionInputPanel.tsx
│       ├── ViewportPanel.tsx
│       ├── TransformPanel.tsx
│       ├── DerivativePanel.tsx
│       └── PiecewisePanel.tsx
├── styles/colors.ts            ← Design tokens (COLORS object)
└── types.ts                    ← Shared types: Transform, FunctionEntry, PiecewiseSegment, etc.
```

### Key Architectural Decisions

**1. Dual-layer Canvas rendering**
- `staticRef` (bottom): axes, grid, curves — redrawn on viewport/function changes
- `dynamicRef` (top): tangent lines, highlighted feature points — redrawn on mouse move
- Both layers share the same pixel dimensions via `ResizeObserver`

**2. Viewport Y-axis flip** (`src/canvas/Viewport.ts`)
- Math coords: Y-axis up; Canvas pixels: Y-axis down
- `toCanvas`: `cy = height - (mathY - yMin) / yRange * height`
- `toMath`: `my = (height - canvasY) / height * yRange + yMin`
- Viewport is immutable — all mutations return a new instance

**3. Discontinuity detection** (`src/engine/sampler.ts`)
- Handles `y=1/x`, `tan(x)`, etc.
- Break condition 1: `|Δy| > viewport.yRange * 2.5` → `moveTo` instead of `lineTo`
- Break condition 2: opposite signs + `|y| > yRange * 1.5` (asymptote crossing)
- `isBreak: true` on the `SamplePoint` signals the renderer to lift the pen

**4. Transform formula**: `y = a·f(b(x-h))+k`
- `a`, `b`: range `-5~5`, excluding `0` (auto-skip past zero)
- `h`, `k`: range `-20~20`
- Derivative with transform: `y' = a·b·f'(b(x-h))` (chain rule)
- `b=-1` produces Y-axis reflection `f(-x)`

**5. Command pattern / Undo-Redo**
- All user mutations go through `editor.execute(command)` which calls `command.execute()` and pushes to history
- Slider drag (mid-drag): direct store update, no command (live preview)
- Slider drag end: one `UpdateFunctionParamCommand(before, after)`
- Animation frames: direct store update; on `onComplete` write one command

**6. Tool system**
- `PanZoomTool` (default) and `TraceTool` are mutually exclusive
- "Show tangent" toggle switches active tool: on→TraceTool, off→PanZoomTool
- `TraceTool.onPointerLeave()` fires `CustomEvent('m02:clear-dynamic')` to clear DynamicCanvas

### Design Tokens (`src/styles/colors.ts`)

```ts
COLORS.primary = '#32D583'  // main green — must not be hardcoded elsewhere
```

### Feature Points (人教版 math accuracy)

- `sin(x)` on `[-2π, 2π]` has exactly **5 zeros**: `-2π, -π, 0, π, 2π`
- Bisection scan: 1000 steps, 20 iterations per root → precision ~1e-6
- Cache in `functionStore.featureCache` — invalidated when `exprStr` or `xMin/xMax` changes

### Performance

- Normal rendering: 800 sample steps
- During animation: 400 sample steps (`useAnimationStore(s => s.isAnyAnimating)`)
- Target: ≥ 55 fps during slider drag (verified with DevTools Performance)

## Development Phases

Phases execute serially: 1→2→3→4→5→6→7→8. Each phase must pass `pnpm lint && pnpm tsc --noEmit` and manual acceptance criteria before the next begins.

| Phase | Focus |
|-------|-------|
| 1 | Editor skeleton + Viewport + dual Canvas + layout |
| 2 | math.js wrapper + sampler + feature point scanner |
| 3 | Axis/grid rendering + curve rendering + viewport interaction |
| 4 | Function list + a/b/h/k sliders + Undo/Redo |
| 5 | Feature point annotation (zeros/extrema/inflection) |
| 6 | Derivative curve + TraceTool + real-time tangent |
| 7 | Piecewise functions (data structure + interval editor + endpoint rendering) |
| 8 | Animation system (RAF interpolation + transform demo animations) |

## Design System (`design_guid/`)

The `design_guid/` folder contains the EduMind/SYXMA design system. Use it for all right-panel UI components. **Two-track color system**:

| Import path | Primary | Theme | Use for |
|-------------|---------|-------|---------|
| `design_guid/styles/tokens.ts` → `COLORS, RADIUS, SHADOWS` | `#00C06B` | Light | Inside UI components (Button, Slider, Input, Switch…) |
| `src/styles/colors.ts` → `COLORS` | `#32D583` | Dark | Canvas layout, panel backgrounds, TopBar |

### Practical rules
- Right-panel interactive controls → use `design_guid/ui/` components (self-contained, light-themed)
- Canvas area / overall layout → use M02 dark `COLORS` from `src/styles/colors.ts`
- Panel heading text: override with `text-[#F0F0F0]` since panel background is dark (`#1E1E22`)
- Active numeric values: `text-[#32D583]` (M02 green)

### Required setup before using `design_guid` components
1. Create `src/lib/utils/cn.ts`:
   ```ts
   import { clsx, type ClassValue } from 'clsx';
   import { twMerge } from 'tailwind-merge';
   export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
   ```
2. Copy needed components from `design_guid/ui/` into `src/components/ui/`
3. Update their import paths: `@/styles/tokens`, `@/styles/typography`, `@/lib/utils/cn`

### Key tokens quick-ref
```ts
RADIUS.input  // 14px — input fields
RADIUS.card   // 18px — panel cards
RADIUS.full   // 9999px — pill buttons

SHADOWS.md    // "0 2px 12px rgba(0,0,0,0.06)" — card default

TYPOGRAPHY.label   // "text-sm font-medium text-[#1A1A2E]"
TYPOGRAPHY.caption // "text-xs text-[#6B7280]"
TYPOGRAPHY.body    // "text-sm text-[#595959]"

COMPONENT_SPACING.form.fieldGap  // "gap-4"
COMPONENT_SPACING.form.labelGap  // "gap-3"
```

## Constraints

- No personal email, names, or private info in any source file, comment, or doc
- `editorInstance` (exported singleton) must be accessible from browser console for debugging
- Viewport changes do **not** enter Undo history
- Git commits: use `--author` flag; do not modify global git config
