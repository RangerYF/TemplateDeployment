# Visual P9 (Celestial Template) Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the celestial motion template (visual_p9) by restructuring layout from 3-column to 2-column, redesigning TopBar, simplifying right panel, adding teaching modal, rebuilding canvas with Three.js, adding theme system, and improving responsiveness.

**Architecture:** The app is a React 19 + Zustand + Vite template. Physics engine (`orbitalMechanics.ts`) and data models (`celestialModels.ts`) are NOT modified — only the rendering and UI layers change. Three.js replaces Canvas 2D for the main simulation view, with Canvas 2D kept as GPU fallback. A CSS-variable-based theme system supports light/dark modes.

**Tech Stack:** React 19, Zustand 5, Three.js (new), postprocessing (new), Tailwind CSS 3, TypeScript 5.9, Vite 7.3

**Red Lines — DO NOT MODIFY:**
- `src/engine/orbitalMechanics.ts` (729 lines) — physics engine
- `data/celestialModels.ts` (272 lines) — model definitions
- `src/templateBridge.ts` (281 lines) — iframe protocol
- `src/store/simulationStore.ts` — physics state logic (tick, applyParamConstraints, fireHohmann)

---

### Task 1: Install Three.js Dependencies & Setup

**Files:**
- Modify: `visual_p9/package.json`

- [ ] **Step 1: Install three.js and postprocessing**

```bash
cd d:/repo/Template/visual_p9
pnpm add three postprocessing
pnpm add -D @types/three
```

- [ ] **Step 2: Verify installation**

```bash
cd d:/repo/Template/visual_p9
pnpm exec tsc --noEmit 2>&1 | head -5
```
Expected: No new errors (three types are available)

- [ ] **Step 3: Verify dev server still works**

```bash
cd d:/repo/Template/visual_p9
pnpm dev &
sleep 3
curl -s http://localhost:5187 | head -5
```
Expected: HTML response with `<div id="root">`

- [ ] **Step 4: Commit**

```bash
cd d:/repo/Template/visual_p9
git add package.json pnpm-lock.yaml
git commit -m "chore(p09): add three.js and postprocessing dependencies"
```

---

### Task 2: Add CSS Theme System

**Files:**
- Modify: `visual_p9/src/index.css`
- Create: `visual_p9/src/hooks/useTheme.ts`

- [ ] **Step 1: Add CSS custom properties for light/dark themes to index.css**

Add the following at the top of `src/index.css`, after the tailwind directives:

```css
/* Theme system */
:root, [data-theme="light"] {
  --theme-bg: #f6f8fb;
  --theme-surface: #ffffff;
  --theme-surface-hover: #f0f2f5;
  --theme-border: #e2e8f0;
  --theme-text: #0f172a;
  --theme-text-secondary: #475569;
  --theme-text-muted: #64748b;
  --theme-primary: #2563eb;
  --theme-primary-hover: #1d4ed8;
  --theme-primary-light: #eff6ff;
  --theme-success: #16a34a;
  --theme-success-light: #dcfce7;
  --theme-warning: #d97706;
  --theme-danger: #dc2626;
  --theme-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --theme-shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --theme-topbar-bg: #ffffff;
  --theme-panel-bg: #ffffff;
  --theme-control-h: 36px;
  --theme-radius: 8px;
  --theme-radius-lg: 12px;
}

[data-theme="dark"] {
  --theme-bg: #0a0e1a;
  --theme-surface: #111827;
  --theme-surface-hover: #1e293b;
  --theme-border: rgba(255,255,255,0.08);
  --theme-text: #e2e8f0;
  --theme-text-secondary: #94a3b8;
  --theme-text-muted: #64748b;
  --theme-primary: #3b82f6;
  --theme-primary-hover: #60a5fa;
  --theme-primary-light: rgba(59,130,246,0.1);
  --theme-success: #22c55e;
  --theme-success-light: rgba(34,197,94,0.1);
  --theme-warning: #f59e0b;
  --theme-danger: #ef4444;
  --theme-shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --theme-shadow-md: 0 4px 6px rgba(0,0,0,0.4);
  --theme-topbar-bg: #0d1225;
  --theme-panel-bg: #0f1629;
  --theme-control-h: 36px;
  --theme-radius: 8px;
  --theme-radius-lg: 12px;
}
```

- [ ] **Step 2: Create useTheme hook**

Create `src/hooks/useTheme.ts`:

```typescript
import { useCallback, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'edumind-theme';

function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(STORAGE_KEY) as Theme) || 'light';
}

function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light' as Theme);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    document.documentElement.setAttribute('data-theme', t);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(getTheme() === 'light' ? 'dark' : 'light');
  }, [setTheme]);

  return { theme, setTheme, toggleTheme };
}
```

- [ ] **Step 3: Initialize theme on app mount**

Add to `src/main.tsx`, before `createRoot`:

```typescript
import { useTheme } from './hooks/useTheme'; // not used here, just for the init below

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('edumind-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
```

- [ ] **Step 4: Verify no regressions**

```bash
cd d:/repo/Template/visual_p9
pnpm dev
```
Open browser — app should look identical (light theme CSS vars match existing colors).

- [ ] **Step 5: Commit**

```bash
cd d:/repo/Template/visual_p9
git add src/index.css src/hooks/useTheme.ts src/main.tsx
git commit -m "feat(p09): add light/dark CSS theme system with useTheme hook"
```

---

### Task 3: Restructure Layout — Three-Column to Two-Column

**Files:**
- Modify: `visual_p9/src/components/layout/AppLayout.tsx`
- Modify: `visual_p9/src/store/uiStore.ts` (remove leftWidth)

- [ ] **Step 1: Rewrite AppLayout.tsx to two-column layout**

Replace the entire `AppLayout.tsx` content with:

```tsx
import { type ReactNode } from 'react';
import { TopBar } from './TopBar';
import { ControlPanel } from '../panels/ControlPanel';
import { MetricsPanel } from '../panels/MetricsPanel';
import { ParameterPanel } from '../panels/ParameterPanel';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--theme-bg)' }}
    >
      <TopBar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main canvas area */}
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {children}
        </main>

        {/* Right panel — desktop only, mobile uses drawer (Task 8) */}
        <aside
          className="hidden shrink-0 overflow-y-auto border-l lg:block"
          style={{
            width: 320,
            borderColor: 'var(--theme-border)',
            background: 'var(--theme-panel-bg)',
          }}
        >
          {/* Zone 1: Core parameters */}
          <div className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
            <h3
              className="mb-3 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              实验参数
            </h3>
            <ParameterPanel />
          </div>

          {/* Zone 2: Advanced settings (collapsed) */}
          <details className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
            <summary
              className="cursor-pointer text-sm font-medium select-none"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              高级设置
            </summary>
            <div className="mt-3">
              <ControlPanel />
            </div>
          </details>

          {/* Zone 3: Live readouts */}
          <div className="p-4">
            <h3
              className="mb-3 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              实时读数
            </h3>
            <MetricsPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Simplify uiStore.ts — remove leftWidth and resize logic**

In `src/store/uiStore.ts`, remove `leftWidth` from `LayoutSnapshot` and defaults. The `rightWidth` can also become a simple constant since we no longer need resize. Simplify to:

```typescript
import { create } from 'zustand';

export interface ViewportSnapshot {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface UISnapshot {
  viewport: ViewportSnapshot;
}

interface UIState extends UISnapshot {
  setViewport: (updater: ViewportSnapshot | ((v: ViewportSnapshot) => ViewportSnapshot)) => void;
  getSnapshot: () => UISnapshot;
  loadSnapshot: (snapshot?: UISnapshot) => void;
}

const DEFAULT_VIEWPORT: ViewportSnapshot = { offsetX: 0, offsetY: 0, zoom: 1 };

const clampViewport = (v: ViewportSnapshot): ViewportSnapshot => ({
  offsetX: Math.max(-1200, Math.min(1200, v.offsetX)),
  offsetY: Math.max(-1200, Math.min(1200, v.offsetY)),
  zoom: Math.max(0.55, Math.min(2.4, v.zoom)),
});

export const useUIStore = create<UIState>((set, get) => ({
  viewport: { ...DEFAULT_VIEWPORT },

  setViewport: (updater) =>
    set((state) => ({
      viewport: clampViewport(
        typeof updater === 'function' ? updater(state.viewport) : updater
      ),
    })),

  getSnapshot: () => ({ viewport: get().viewport }),

  loadSnapshot: (snapshot) => {
    if (!snapshot) return;
    if (snapshot.viewport) {
      set({ viewport: clampViewport({ ...DEFAULT_VIEWPORT, ...snapshot.viewport }) });
    }
  },
}));
```

**Note:** This changes the UISnapshot shape by removing `layout`. Check if `templateBridge.ts` references `layout` in the snapshot payload — if it does, the `loadSnapshot` function in uiStore already handles missing fields gracefully (`if (snapshot.viewport)`), so removing `layout` from the store is safe. The bridge will simply ignore any `layout` field in old snapshots, and new snapshots won't include it.

- [ ] **Step 3: Verify the app renders with new two-column layout**

```bash
cd d:/repo/Template/visual_p9
pnpm dev
```
Open browser. Should see: TopBar + canvas (full remaining width) + right panel (320px) with three zones. No left sidebar. Model switching should still work via TopBar tabs.

- [ ] **Step 4: Commit**

```bash
cd d:/repo/Template/visual_p9
git add src/components/layout/AppLayout.tsx src/store/uiStore.ts
git commit -m "feat(p09): restructure layout from 3-column to 2-column, remove left model list panel"
```

---

### Task 4: Redesign TopBar

**Files:**
- Modify: `visual_p9/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Rewrite TopBar with new structure**

Replace `src/components/layout/TopBar.tsx` entirely:

```tsx
import { CELESTIAL_MODELS } from '@/data/celestialData';
import { useActiveModel, useSimulationStore } from '@/store/simulationStore';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils/cn';
import { useState } from 'react';
import { TeachingModal } from '../TeachingModal';

export function TopBar() {
  const activeModel = useActiveModel();
  const { currentModelId, isPlaying, speedMultiplier, setPlaying, resetTime, resetActiveParams, setSpeedMultiplier, selectModel } =
    useSimulationStore();
  const { theme, toggleTheme } = useTheme();
  const [showTeaching, setShowTeaching] = useState(false);

  const speeds = [0.5, 1, 2, 5, 10];

  return (
    <>
      <header
        className="flex h-12 shrink-0 items-center border-b px-4 gap-3"
        style={{
          background: 'var(--theme-topbar-bg)',
          borderColor: 'var(--theme-border)',
          boxShadow: 'var(--theme-shadow-sm)',
        }}
      >
        {/* Title */}
        <span
          className="text-sm font-bold whitespace-nowrap"
          style={{ color: 'var(--theme-text)' }}
        >
          天体运动与引力
        </span>

        {/* Model tabs */}
        <nav className="hidden md:flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--theme-surface-hover)' }}>
          {CELESTIAL_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => selectModel(m.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                m.id === currentModelId
                  ? 'text-white shadow-sm'
                  : 'hover:opacity-80'
              )}
              style={
                m.id === currentModelId
                  ? { background: 'var(--theme-primary)', color: '#fff' }
                  : { color: 'var(--theme-text-muted)' }
              }
            >
              {m.shortName}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Status badge */}
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: isPlaying ? 'var(--theme-success-light)' : 'var(--theme-primary-light)',
            color: isPlaying ? 'var(--theme-success)' : 'var(--theme-primary)',
          }}
        >
          {isPlaying ? '运行中' : '已就绪'}
        </span>

        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlaying(!isPlaying)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors"
            style={{
              background: 'var(--theme-primary)',
              color: '#fff',
            }}
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => { resetTime(); resetActiveParams(); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors"
            style={{
              background: 'var(--theme-surface-hover)',
              color: 'var(--theme-text-secondary)',
            }}
            title="重置"
          >
            ↺
          </button>
        </div>

        {/* Speed selector */}
        <select
          value={speedMultiplier}
          onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
          className="h-8 rounded-lg border px-2 text-xs font-semibold"
          style={{
            borderColor: 'var(--theme-border)',
            background: 'var(--theme-surface)',
            color: 'var(--theme-text-secondary)',
          }}
        >
          {speeds.map((s) => (
            <option key={s} value={s}>{s}x</option>
          ))}
        </select>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors"
          style={{
            background: 'var(--theme-surface-hover)',
            color: 'var(--theme-text-secondary)',
          }}
          title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* Teaching modal trigger */}
        <button
          onClick={() => setShowTeaching(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors"
          style={{
            background: 'var(--theme-surface-hover)',
            color: 'var(--theme-text-secondary)',
          }}
          title="教学要点"
        >
          📖
        </button>
      </header>

      {showTeaching && <TeachingModal onClose={() => setShowTeaching(false)} />}
    </>
  );
}
```

- [ ] **Step 2: This depends on TeachingModal — create a stub first**

Create `src/components/TeachingModal.tsx` as a minimal placeholder:

```tsx
interface TeachingModalProps {
  onClose: () => void;
}

export function TeachingModal({ onClose }: TeachingModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-h-[80vh] rounded-xl overflow-y-auto p-6"
        style={{ background: 'var(--theme-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--theme-text)' }}>
          教学要点
        </h2>
        <p style={{ color: 'var(--theme-text-muted)' }}>（完整内容将在 Task 5 中实现）</p>
        <button
          onClick={onClose}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--theme-primary)', color: '#fff' }}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TopBar renders correctly**

```bash
cd d:/repo/Template/visual_p9
pnpm dev
```
Open browser. TopBar should show: title + model tabs + status badge + play/pause/reset + speed dropdown + theme toggle + teaching button. Model switching via tabs should still work.

- [ ] **Step 4: Commit**

```bash
cd d:/repo/Template/visual_p9
git add src/components/layout/TopBar.tsx src/components/TeachingModal.tsx
git commit -m "feat(p09): redesign TopBar with playback controls, speed selector, theme toggle, teaching button"
```

---

### Task 5: Build Full Teaching Modal

**Files:**
- Modify: `visual_p9/src/components/TeachingModal.tsx`

- [ ] **Step 1: Replace TeachingModal stub with full implementation**

Replace `src/components/TeachingModal.tsx`:

```tsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { useActiveModel } from '@/store/simulationStore';
import { DATA_SOURCES } from '@/data/celestialData';

const LazyKaTeX = lazy(() => import('./panels/FormulaPanel').then(mod => ({ default: mod.FormulaPanel })));

interface TeachingModalProps {
  onClose: () => void;
}

type Tab = 'formulas' | 'teaching' | 'sources';

export function TeachingModal({ onClose }: TeachingModalProps) {
  const model = useActiveModel();
  const [tab, setTab] = useState<Tab>('formulas');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'formulas', label: '公式与关系' },
    { key: 'teaching', label: '教学要点' },
    { key: 'sources', label: '数据来源' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[600px] max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--theme-border)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--theme-text)' }}>教学要点</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>{model.name_cn}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b px-6" style={{ borderColor: 'var(--theme-border)' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-3 text-sm font-medium transition-colors border-b-2"
              style={{
                borderColor: tab === t.key ? 'var(--theme-primary)' : 'transparent',
                color: tab === t.key ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'formulas' && (
            <Suspense fallback={<p style={{ color: 'var(--theme-text-muted)' }}>加载公式...</p>}>
              <LazyKaTeX />
            </Suspense>
          )}

          {tab === 'teaching' && (
            <div className="space-y-3">
              {model.teaching_points.map((point, i) => (
                <div key={i} className="flex gap-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                  <span style={{ color: 'var(--theme-primary)' }}>•</span>
                  <span>{point}</span>
                </div>
              ))}
              {model.animations?.highlight?.length > 0 && (
                <div
                  className="mt-4 rounded-lg p-3 text-sm"
                  style={{ background: 'var(--theme-primary-light)', color: 'var(--theme-primary)' }}
                >
                  <span className="font-semibold">动画重点：</span>
                  {model.animations.highlight.join(' / ')}
                </div>
              )}
            </div>
          )}

          {tab === 'sources' && (
            <div className="space-y-3">
              {DATA_SOURCES.map((src) => (
                <div
                  key={src.id}
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <div className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{src.item}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>{src.value}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>来源：{src.source}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update FormulaPanel to be importable as a standalone component**

The existing `FormulaPanel.tsx` is already a self-contained component that reads from `useActiveModel()`. No changes needed — it can be lazy-loaded directly. But verify the import path works:

```typescript
// This is what TeachingModal does:
const LazyKaTeX = lazy(() => import('./panels/FormulaPanel').then(mod => ({ default: mod.FormulaPanel })));
```

Check that `FormulaPanel` is a named export in `src/components/panels/FormulaPanel.tsx`. If it's a default export, adjust the lazy import accordingly.

- [ ] **Step 3: Verify teaching modal works**

Open browser, click 📖 button in TopBar. Modal should appear with three tabs. Switch models via TopBar tabs — modal content should update. Press Escape to close.

- [ ] **Step 4: Commit**

```bash
cd d:/repo/Template/visual_p9
git add src/components/TeachingModal.tsx
git commit -m "feat(p09): build teaching modal with formulas/teaching/sources tabs, lazy KaTeX loading"
```

---

### Task 6: Simplify Right Panel Components

**Files:**
- Modify: `visual_p9/src/components/panels/ControlPanel.tsx`
- Modify: `visual_p9/src/components/panels/MetricsPanel.tsx`
- Modify: `visual_p9/src/components/panels/ParameterPanel.tsx`

- [ ] **Step 1: Simplify ControlPanel to only contain advanced settings**

The play/pause and speed are now in TopBar. ControlPanel becomes the "advanced settings" content inside the `<details>` element in AppLayout. Rewrite `ControlPanel.tsx`:

```tsx
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useSimulationStore } from '@/store/simulationStore';

export function ControlPanel() {
  const {
    speedMultiplier, setSpeedMultiplier,
    showVectors, setShowVectors,
    showAreaSectors, setShowAreaSectors,
    currentModelId, hohmannPhase, fireHohmann,
  } = useSimulationStore();

  const phaseLabels: Record<string, string> = {
    low: '第一次点火加速',
    transfer: '第二次点火入轨',
    high: '高轨减速降轨',
    transferDown: '低轨再点火入轨',
  };

  return (
    <div className="space-y-4">
      {/* Fine speed control */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
            精细速度
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--theme-primary)' }}>
            {speedMultiplier.toFixed(1)}x
          </span>
        </div>
        <Slider
          value={[speedMultiplier]}
          onValueChange={([v]) => setSpeedMultiplier(v)}
          min={0.2}
          max={20}
          step={0.2}
        />
      </div>

      {/* Hohmann fire button */}
      {currentModelId === 'CEL-011' && (
        <Button variant="danger" size="sm" className="w-full" onClick={fireHohmann}>
          {phaseLabels[hohmannPhase] || '点火'}
        </Button>
      )}

      {/* Toggles */}
      <div className="space-y-3">
        <label className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>速度/加速度箭头</span>
          <Switch checked={showVectors} onCheckedChange={setShowVectors} />
        </label>
        {currentModelId === 'CEL-002' && (
          <label className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>面积定律扇形</span>
            <Switch checked={showAreaSectors} onCheckedChange={setShowAreaSectors} />
          </label>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Simplify MetricsPanel to clean readout format**

Rewrite `MetricsPanel.tsx` to match the unified readout design:

```tsx
import { buildFrame } from '@/engine/orbitalMechanics';
import { useActiveParams, useSimulationStore } from '@/store/simulationStore';

export function MetricsPanel() {
  const { currentModelId, elapsedSeconds, hohmannPhase, hohmannIgnitionAngle } = useSimulationStore();
  const params = useActiveParams();
  const frame = buildFrame(currentModelId, params, elapsedSeconds, hohmannPhase, hohmannIgnitionAngle);
  const { metrics } = frame;

  return (
    <div className="space-y-2">
      {metrics.values.map((v, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-1.5"
          style={{ borderBottom: '1px solid var(--theme-border)' }}
        >
          <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            {v.label}
          </span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--theme-text)' }}>
            {v.value}
          </span>
        </div>
      ))}
      {metrics.insight && (
        <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--theme-text-muted)' }}>
          {metrics.insight}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update ParameterPanel styles to use theme variables**

In `ParameterPanel.tsx`, replace all `COLORS.xxx` references with `var(--theme-xxx)` equivalents in inline styles. The component logic stays the same — only style values change. Key replacements:

- `COLORS.text` → `var(--theme-text)`
- `COLORS.textSecondary` → `var(--theme-text-secondary)`
- `COLORS.textMuted` → `var(--theme-text-muted)`
- `COLORS.primary` → `var(--theme-primary)`
- `COLORS.border` → `var(--theme-border)`
- `COLORS.bg` → `var(--theme-surface)`
- `COLORS.bgMuted` → `var(--theme-surface-hover)`

- [ ] **Step 4: Verify right panel works correctly**

```bash
cd d:/repo/Template/visual_p9
pnpm dev
```
Check: Parameters render with sliders, advanced settings fold/unfold, readouts show live data, model switching updates all three zones.

- [ ] **Step 5: Commit**

```bash
cd d:/repo/Template/visual_p9
git add src/components/panels/ControlPanel.tsx src/components/panels/MetricsPanel.tsx src/components/panels/ParameterPanel.tsx
git commit -m "feat(p09): simplify right panel to 3 zones - params, advanced settings, readouts"
```

---

### Task 7: Build Three.js Rendering System

This is the largest task. We build the Three.js scene piece by piece, keeping the existing Canvas 2D as fallback.

**Files:**
- Create: `visual_p9/src/components/scene/three/SceneManager.ts`
- Create: `visual_p9/src/components/scene/three/StarField.ts`
- Create: `visual_p9/src/components/scene/three/CelestialBody.ts`
- Create: `visual_p9/src/components/scene/three/OrbitLine.ts`
- Create: `visual_p9/src/components/scene/three/VectorArrow.ts`
- Create: `visual_p9/src/components/scene/ThreeCanvas.tsx`
- Create: `visual_p9/src/lib/utils/detectGPU.ts`
- Modify: `visual_p9/src/App.tsx`

- [ ] **Step 1: Create GPU detection utility**

Create `src/lib/utils/detectGPU.ts`:

```typescript
export type GPUTier = 'high' | 'low';

export function detectGPU(): GPUTier {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'low';

    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase();
      if (
        renderer.includes('swiftshader') ||
        renderer.includes('llvmpipe') ||
        renderer.includes('software')
      ) {
        return 'low';
      }
    }
    return 'high';
  } catch {
    return 'low';
  }
}
```

- [ ] **Step 2: Create SceneManager**

Create `src/components/scene/three/SceneManager.ts`:

```typescript
import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'postprocessing';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    const { width, height } = container.getBoundingClientRect();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050A18');

    // Orthographic camera (2D-like view matching current behavior)
    const aspect = width / height;
    const frustum = 500;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum,
      0.1, 2000
    );
    this.camera.position.set(0, 0, 1000);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'default',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.8,   // strength
      0.4,   // radius
      0.85   // threshold
    );
    this.composer.addPass(bloomPass);
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    const aspect = width / height;
    const frustum = 500;

    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
```

- [ ] **Step 3: Create StarField**

Create `src/components/scene/three/StarField.ts`:

```typescript
import * as THREE from 'three';

export class StarField {
  points: THREE.Points;

  constructor(count: number = 800) {
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread stars in a large area
      positions[i * 3] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1500;
      positions[i * 3 + 2] = -10 - Math.random() * 50; // behind everything
      alphas[i] = 0.3 + Math.random() * 0.7;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.8,
    });

    this.points = new THREE.Points(geometry, material);
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.points);
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.PointsMaterial).dispose();
  }
}
```

- [ ] **Step 4: Create CelestialBody**

Create `src/components/scene/three/CelestialBody.ts`:

```typescript
import * as THREE from 'three';

export class CelestialBody {
  mesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
  group: THREE.Group;

  constructor(radius: number, color: string, emissive: boolean = false) {
    this.group = new THREE.Group();

    // Main sphere
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.group.add(this.mesh);

    // Glow sprite (cheap glow effect)
    if (emissive) {
      const glowGeometry = new THREE.SphereGeometry(radius * 1.6, 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.15,
      });
      this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      this.group.add(this.glowMesh);
    } else {
      this.glowMesh = this.mesh; // placeholder
    }
  }

  setPosition(x: number, y: number) {
    this.group.position.set(x, -y, 0); // flip Y for screen coords
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    if (this.glowMesh !== this.mesh) {
      this.glowMesh.geometry.dispose();
      (this.glowMesh.material as THREE.Material).dispose();
    }
  }
}
```

- [ ] **Step 5: Create OrbitLine**

Create `src/components/scene/three/OrbitLine.ts`:

```typescript
import * as THREE from 'three';
import type { Vec2 } from '@/engine/orbitalMechanics';

export class OrbitLine {
  line: THREE.Line;

  constructor(color: string, dashed: boolean = false) {
    const material = dashed
      ? new THREE.LineDashedMaterial({ color: new THREE.Color(color), dashSize: 8, gapSize: 6, transparent: true, opacity: 0.6 })
      : new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.7 });

    const geometry = new THREE.BufferGeometry();
    this.line = new THREE.Line(geometry, material);
    if (dashed) this.line.computeLineDistances();
  }

  updatePoints(points: Vec2[]) {
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = -points[i].y;
      positions[i * 3 + 2] = 0;
    }
    this.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.line.geometry.attributes.position.needsUpdate = true;
    if (this.line.material instanceof THREE.LineDashedMaterial) {
      this.line.computeLineDistances();
    }
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.line);
  }

  dispose() {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 6: Create VectorArrow**

Create `src/components/scene/three/VectorArrow.ts`:

```typescript
import * as THREE from 'three';

export class VectorArrow {
  group: THREE.Group;
  private shaft: THREE.Line;
  private head: THREE.Mesh;

  constructor(color: string) {
    this.group = new THREE.Group();

    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(color), linewidth: 2 });
    const shaftGeo = new THREE.BufferGeometry();
    shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this.shaft = new THREE.Line(shaftGeo, mat);
    this.group.add(this.shaft);

    const headGeo = new THREE.ConeGeometry(4, 12, 8);
    const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.group.add(this.head);
  }

  update(fromX: number, fromY: number, toX: number, toY: number) {
    const positions = this.shaft.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, fromX, -fromY, 1);
    positions.setXYZ(1, toX, -toY, 1);
    positions.needsUpdate = true;

    this.head.position.set(toX, -toY, 1);
    const angle = Math.atan2(-(toY - fromY), toX - fromX);
    this.head.rotation.z = angle - Math.PI / 2;
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.group);
  }

  dispose() {
    this.shaft.geometry.dispose();
    (this.shaft.material as THREE.Material).dispose();
    this.head.geometry.dispose();
    (this.head.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 7: Create ThreeCanvas component**

Create `src/components/scene/ThreeCanvas.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { buildFrame, type SceneFrame } from '@/engine/orbitalMechanics';
import { useActiveModel, useActiveParams, useSimulationStore } from '@/store/simulationStore';
import { useUIStore, type ViewportSnapshot } from '@/store/uiStore';
import { SceneManager } from './three/SceneManager';
import { StarField } from './three/StarField';
import { CelestialBody } from './three/CelestialBody';
import { OrbitLine } from './three/OrbitLine';

export function ThreeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<SceneManager | null>(null);
  const starFieldRef = useRef<StarField | null>(null);
  const bodiesRef = useRef<Map<string, CelestialBody>>(new Map());
  const orbitsRef = useRef<Map<string, OrbitLine>>(new Map());

  const model = useActiveModel();
  const params = useActiveParams();
  const { currentModelId, elapsedSeconds, hohmannPhase, hohmannIgnitionAngle, isPlaying, showVectors } = useSimulationStore();
  const tick = useSimulationStore((s) => s.tick);
  const viewport = useUIStore((s) => s.viewport);
  const setViewport = useUIStore((s) => s.setViewport);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const mgr = new SceneManager(containerRef.current);
    managerRef.current = mgr;

    const stars = new StarField(600);
    stars.addTo(mgr.scene);
    starFieldRef.current = stars;

    const ro = new ResizeObserver(() => mgr.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      stars.dispose();
      bodiesRef.current.forEach((b) => b.dispose());
      bodiesRef.current.clear();
      orbitsRef.current.forEach((o) => o.dispose());
      orbitsRef.current.clear();
      mgr.dispose();
      managerRef.current = null;
    };
  }, []);

  // Animation loop
  useEffect(() => {
    let frameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      if (isPlaying) tick(delta);

      const mgr = managerRef.current;
      if (!mgr) return;

      // Build frame from physics engine (UNTOUCHED)
      const frame: SceneFrame = buildFrame(
        currentModelId, params, useSimulationStore.getState().elapsedSeconds,
        hohmannPhase, hohmannIgnitionAngle
      );

      // Apply viewport (zoom + pan)
      const vp = useUIStore.getState().viewport;
      mgr.camera.zoom = vp.zoom;
      mgr.camera.position.x = -vp.offsetX;
      mgr.camera.position.y = vp.offsetY;
      mgr.camera.updateProjectionMatrix();

      // Update bodies
      updateBodies(mgr, frame);

      // Update orbits
      updateOrbits(mgr, frame);

      // Render
      mgr.render();
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [currentModelId, params, isPlaying, hohmannPhase, hohmannIgnitionAngle, tick]);

  // Pan handler
  const dragRef = useRef<{ startX: number; startY: number; startVP: ViewportSnapshot } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startVP: { ...useUIStore.getState().viewport },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const vp = dragRef.current.startVP;
    setViewport({
      offsetX: vp.offsetX + dx,
      offsetY: vp.offsetY + dy,
      zoom: vp.zoom,
    });
  };

  const onPointerUp = () => { dragRef.current = null; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport((v) => ({ ...v, zoom: v.zoom * factor }));
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      style={{ background: '#050A18' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
    />
  );
}

function updateBodies(mgr: SceneManager, frame: SceneFrame) {
  const existing = bodiesRef.current;
  const needed = new Set(frame.bodies.map((b) => b.id));

  // Remove stale bodies
  existing.forEach((body, id) => {
    if (!needed.has(id)) {
      mgr.scene.remove(body.group);
      body.dispose();
      existing.delete(id);
    }
  });

  // Add/update bodies
  for (const b of frame.bodies) {
    let body = existing.get(b.id);
    if (!body) {
      const isCenter = b.id.includes('center') || b.id.includes('sun') || b.id.includes('star');
      body = new CelestialBody(b.radiusPx, b.color, isCenter);
      body.addTo(mgr.scene);
      existing.set(b.id, body);
    }
    body.setPosition(b.position.x, b.position.y);
  }
}

function updateOrbits(mgr: SceneManager, frame: SceneFrame) {
  const existing = orbitsRef.current;
  const needed = new Set(frame.paths.map((p) => p.id));

  existing.forEach((orbit, id) => {
    if (!needed.has(id)) {
      mgr.scene.remove(orbit.line);
      orbit.dispose();
      existing.delete(id);
    }
  });

  for (const p of frame.paths) {
    let orbit = existing.get(p.id);
    if (!orbit) {
      orbit = new OrbitLine(p.color, p.dashed);
      orbit.addTo(mgr.scene);
      existing.set(p.id, orbit);
    }
    orbit.updatePoints(p.points);
  }
}

// Refs used by helper functions need to be accessible
const bodiesRef = { current: new Map<string, CelestialBody>() };
const orbitsRef = { current: new Map<string, OrbitLine>() };
```

**Note:** The refs `bodiesRef` and `orbitsRef` are declared at module level to be accessible by the helper functions. In the actual component, move them inside the component and pass to helpers, or use a class-based approach. The key architecture point is: `buildFrame()` produces the data, Three.js objects just reflect that data — physics logic is untouched.

- [ ] **Step 8: Update App.tsx with GPU detection and canvas switching**

Modify `src/App.tsx`:

```tsx
import { lazy, Suspense, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { OrbitCanvas } from '@/components/scene/OrbitCanvas';
import { detectGPU } from '@/lib/utils/detectGPU';

const ThreeCanvas = lazy(() => import('@/components/scene/ThreeCanvas').then(m => ({ default: m.ThreeCanvas })));

export default function App() {
  const gpuTier = useMemo(() => detectGPU(), []);

  return (
    <AppLayout>
      {gpuTier === 'high' ? (
        <Suspense fallback={<OrbitCanvas />}>
          <ThreeCanvas />
        </Suspense>
      ) : (
        <OrbitCanvas />
      )}
    </AppLayout>
  );
}
```

- [ ] **Step 9: Verify Three.js rendering**

```bash
cd d:/repo/Template/visual_p9
pnpm dev
```
Open browser. If GPU is detected as 'high', Three.js canvas renders with 3D spheres, bloom glow on sun/stars, particle star field. If 'low', falls back to existing Canvas 2D. Switch models — scene should update. Pan/zoom should work.

- [ ] **Step 10: Commit**

```bash
cd d:/repo/Template/visual_p9
git add src/components/scene/three/ src/components/scene/ThreeCanvas.tsx src/lib/utils/detectGPU.ts src/App.tsx
git commit -m "feat(p09): add Three.js rendering with bloom, star field, celestial bodies, GPU fallback to Canvas 2D"
```

---

### Task 8: Add Responsive Design

**Files:**
- Modify: `visual_p9/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Add mobile drawer for parameter panel**

Update `AppLayout.tsx` to include a mobile drawer trigger button and a slide-out panel for smaller screens:

```tsx
import { type ReactNode, useState } from 'react';
import { TopBar } from './TopBar';
import { ControlPanel } from '../panels/ControlPanel';
import { MetricsPanel } from '../panels/MetricsPanel';
import { ParameterPanel } from '../panels/ParameterPanel';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const panelContent = (
    <>
      <div className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
          实验参数
        </h3>
        <ParameterPanel />
      </div>
      <details className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <summary className="cursor-pointer text-sm font-medium select-none" style={{ color: 'var(--theme-text-muted)' }}>
          高级设置
        </summary>
        <div className="mt-3"><ControlPanel /></div>
      </details>
      <div className="p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
          实时读数
        </h3>
        <MetricsPanel />
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--theme-bg)' }}>
      <TopBar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {children}
          {/* Mobile drawer trigger */}
          <button
            className="lg:hidden absolute bottom-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
            style={{ background: 'var(--theme-primary)', color: '#fff' }}
            onClick={() => setDrawerOpen(true)}
          >
            ⚙
          </button>
        </main>

        {/* Desktop: static right panel */}
        <aside
          className="hidden shrink-0 overflow-y-auto border-l lg:block"
          style={{ width: 320, borderColor: 'var(--theme-border)', background: 'var(--theme-panel-bg)' }}
        >
          {panelContent}
        </aside>

        {/* Mobile/Tablet: drawer overlay */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setDrawerOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="absolute right-0 top-0 bottom-0 w-[320px] max-w-[85vw] overflow-y-auto shadow-2xl"
              style={{ background: 'var(--theme-panel-bg)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>控制面板</span>
                <button onClick={() => setDrawerOpen(false)} className="text-lg" style={{ color: 'var(--theme-text-muted)' }}>×</button>
              </div>
              {panelContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test at different viewport widths**

Test at 1280px (desktop), 900px (tablet), 400px (mobile). Desktop: static panel. Tablet/mobile: panel hidden, gear button visible, tap opens drawer.

- [ ] **Step 3: Commit**

```bash
cd d:/repo/Template/visual_p9
git add src/components/layout/AppLayout.tsx
git commit -m "feat(p09): add responsive layout with mobile drawer for parameter panel"
```

---

### Task 9: Performance Optimizations

**Files:**
- Modify: `visual_p9/src/components/scene/OrbitCanvas.tsx` (Canvas 2D fallback only)

- [ ] **Step 1: Cache star field in OrbitCanvas**

In `OrbitCanvas.tsx`, find the `makeStars` call inside the render function and memoize it:

```typescript
// Before (called every frame):
const stars = makeStars(w, h);

// After (cached, only regenerated on resize):
const starsRef = useRef<Star[]>([]);
const lastSizeRef = useRef({ w: 0, h: 0 });
// Inside draw effect, before renderFrame:
if (lastSizeRef.current.w !== w || lastSizeRef.current.h !== h) {
  starsRef.current = makeStars(w, h);
  lastSizeRef.current = { w, h };
}
const stars = starsRef.current;
```

- [ ] **Step 2: Move canvas resize out of draw loop**

Currently `canvas.width` and `canvas.height` are set every frame (which clears the canvas). Move this to only run inside the ResizeObserver callback:

The ResizeObserver should set canvas dimensions, and the draw function should only read them.

- [ ] **Step 3: Verify Canvas 2D fallback still works**

Force low GPU detection (temporarily return 'low' in detectGPU.ts), verify the Canvas 2D renderer still runs correctly with performance improvements.

- [ ] **Step 4: Commit**

```bash
cd d:/repo/Template/visual_p9
git add src/components/scene/OrbitCanvas.tsx
git commit -m "perf(p09): cache star field, move canvas resize out of draw loop"
```

---

### Task 10: Cleanup & Regression Test

**Files:**
- Delete: `visual_p9/src/styles/colors.ts` (unused)
- Delete: `visual_p9/src/styles/spacing.ts` (unused)
- Delete: `visual_p9/src/styles/typography.ts` (unused)
- Modify: `visual_p9/src/styles/index.ts` (remove dead imports)
- Modify: `visual_p9/tailwind.config.ts` (fix colors import if needed)

- [ ] **Step 1: Remove unused style files**

```bash
cd d:/repo/Template/visual_p9
rm src/styles/colors.ts src/styles/spacing.ts src/styles/typography.ts
```

Update `src/styles/index.ts` to only export tokens:

```typescript
export * from './tokens';
```

Check `tailwind.config.ts` — it imports from `./src/styles/colors`. Since we're removing that file, either:
- Inline the Tailwind color config directly in tailwind.config.ts, or
- Point it to tokens.ts instead

- [ ] **Step 2: Verify build succeeds**

```bash
cd d:/repo/Template/visual_p9
pnpm build
```
Expected: Clean build with no errors.

- [ ] **Step 3: Regression test all 6 models**

Open each model and verify:
1. **CEL-001 (圆轨道):** 3 satellites orbit at correct relative speeds
2. **CEL-002 (椭圆轨道):** Kepler area sectors display, body speeds up at periapsis
3. **CEL-011 (霍曼转移):** All 4 phases fire correctly, transfer orbit renders
4. **CEL-012 (宇宙速度):** Speed slider changes trajectory type (circular/elliptical/escape/hyperbolic)
5. **CEL-021 (双星):** Both stars orbit common center of mass
6. **CEL-031 (追赶):** Inner satellite catches outer at correct time

For each: parameters adjust correctly, readouts update in real-time, play/pause/reset work, theme toggle works, teaching modal opens with correct formulas.

- [ ] **Step 4: Test snapshot compatibility**

If the template is running inside the EdUMind platform, test:
1. `getSnapshot()` returns valid snapshot
2. `loadSnapshot(snapshot)` restores state correctly
3. Old snapshots (with `layout.leftWidth`) load without errors

- [ ] **Step 5: Final commit**

```bash
cd d:/repo/Template/visual_p9
git add -A
git commit -m "chore(p09): cleanup unused style files, verify all 6 models pass regression"
```

---

## Summary of All Changes

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Install Three.js | package.json |
| 2 | Theme system | index.css, hooks/useTheme.ts, main.tsx |
| 3 | Two-column layout | AppLayout.tsx, uiStore.ts |
| 4 | TopBar redesign | TopBar.tsx, TeachingModal.tsx (stub) |
| 5 | Teaching modal | TeachingModal.tsx (full) |
| 6 | Right panel simplify | ControlPanel.tsx, MetricsPanel.tsx, ParameterPanel.tsx |
| 7 | Three.js rendering | 6 new files in scene/three/, ThreeCanvas.tsx, detectGPU.ts, App.tsx |
| 8 | Responsive design | AppLayout.tsx |
| 9 | Performance | OrbitCanvas.tsx |
| 10 | Cleanup & test | Delete 3 files, update index.ts, tailwind.config.ts |

**Files NOT modified (red lines):**
- `src/engine/orbitalMechanics.ts` ✓
- `data/celestialModels.ts` ✓
- `src/templateBridge.ts` ✓
- `src/store/simulationStore.ts` (physics logic untouched, only consumed) ✓
