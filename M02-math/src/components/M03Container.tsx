/**
 * M03Container — Trigonometric Function Comparison Lab
 *
 * Layout (Tailwind):
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  TopBar: title · formula preview · Reset · Undo · Redo        │
 *   ├─────────────┬─────────────────────────────────────────────────┤
 *   │  Left panel │  Canvas A (base)  │  Canvas B (user params)     │
 *   │  A/ω/φ/k   │  y = sin(x)       │  y = A·sin(ωx+φ)+k         │
 *   │  sliders   │  (read-only)       │  (pan/zoom independent)     │
 *   └─────────────┴─────────────────────────────────────────────────┘
 *
 * Architecture:
 *  - Two independent `useDualCanvas` instances → isolated Viewports + Editors
 *  - `useParamSlider` drives each slider (drag-preview-commit lifecycle)
 *  - `UpdateTrigParamCommand` writes Undo entries to shared historyStore
 *  - `useTrigStore` holds all state; Canvas A reads BASE_TRIG_PARAMS (fixed)
 */

import { useEffect, useCallback, useRef } from 'react';
import { Viewport } from '@/canvas/Viewport';
import { useDualCanvas } from '@/hooks/useDualCanvas';
import { useParamSlider } from '@/hooks/useParamSlider';
import {
  useTrigStore,
  BASE_TRIG_PARAMS,
  DEFAULT_TRIG_VIEWPORT,
} from '@/editor/store/trigStore';
import { useHistoryStore } from '@/editor/store/historyStore';
import { PanZoomTool } from '@/editor/tools/PanZoomTool';
import { renderAxis } from '@/canvas/renderers/axisRenderer';
import {
  generateSinePath,
  renderTrigCurve,
  buildFormulaText,
} from '@/canvas/renderers/trigCurveRenderer';
import { UpdateTrigParamCommand } from '@/editor/commands/UpdateTrigParamCommand';
import { Slider } from '@/components/ui/slider';
import { EditorInjectable } from '@/editor/core/EditorInjectable';

// ─── Colours (local to avoid coupling to M02 dark theme) ─────────────────────
const C = {
  bg:          '#0F0F13',
  surface:     '#16161A',
  panel:       '#1C1C22',
  border:      '#2A2A32',
  text:        '#F0F0F0',
  textMuted:   '#9CA3AF',
  primary:     '#32D583',   // Canvas B curve & accent
  compare:     '#60A5FA',   // Canvas A (base) curve — blue
  canvasBg:    '#FFFFFF',
} as const;

// ─── Param row descriptor ─────────────────────────────────────────────────────
interface ParamConfig {
  key:   'A' | 'omega' | 'phi' | 'k';
  label: string;
  symbol: string;
  min:   number;
  max:   number;
  step:  number;
}

const PARAMS: ParamConfig[] = [
  { key: 'A',     label: 'A',  symbol: '振幅',  min: -5,          max: 5,          step: 0.1  },
  { key: 'omega', label: 'ω',  symbol: '角频率', min: 0.1,         max: 5,          step: 0.1  },
  { key: 'phi',   label: 'φ',  symbol: '初相',  min: -Math.PI,    max: Math.PI,    step: 0.05 },
  { key: 'k',     label: 'k',  symbol: '纵移',  min: -5,          max: 5,          step: 0.1  },
];

// ─── TrigCanvasPanel ──────────────────────────────────────────────────────────

interface TrigCanvasPanelProps {
  /** Label shown above the canvas. */
  label:      string;
  /** Canvas A = '#60A5FA' (base), Canvas B = '#32D583' (user). */
  color:      string;
  /**
   * Which store viewport to read for rendering and for the EditorInjectable.
   * Canvas A → viewportA, Canvas B → viewportB.
   */
  viewportKey: 'viewportA' | 'viewportB';
  /**
   * The Zustand action that EditorInjectable calls on every pan/zoom.
   * Must be a stable reference (Zustand actions are stable).
   */
  setViewportFn: (vp: import('@/types').ViewportState) => void;
  /**
   * Parameters to render. Canvas A uses BASE_TRIG_PARAMS; Canvas B uses
   * the live userParams from useTrigStore.
   */
  params: import('@/canvas/renderers/trigCurveRenderer').TrigParams;
}

function TrigCanvasPanel({
  label,
  color,
  viewportKey,
  setViewportFn,
  params,
}: TrigCanvasPanelProps) {
  const viewport    = useTrigStore((s) => s[viewportKey]);
  const {
    containerRef, staticRef, dynamicRef,
    canvasSize, editorRef, buildToolEvent,
  } = useDualCanvas({
    initialViewport: DEFAULT_TRIG_VIEWPORT,
    setViewportFn,
    onInit: (editor) => editor.activateTool(new PanZoomTool()),
  });

  // ── Static layer: redraw whenever params, viewport, or size change ─────────
  useEffect(() => {
    const canvas = staticRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vp = new Viewport(
      viewport.xMin, viewport.xMax,
      viewport.yMin, viewport.yMax,
      canvasSize.width, canvasSize.height,
    );

    ctx.clearRect(0, 0, vp.width, vp.height);
    renderAxis(ctx, vp, { showGrid: true });

    const pts = generateSinePath(params.A, params.omega, params.phi, params.k, vp);
    renderTrigCurve(ctx, pts, vp, color, { lineWidth: 2 });
  }, [params, color, viewport, canvasSize, staticRef]);

  // ── Canvas event handlers (stable via useCallback) ─────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
      editorRef.current?.dispatchPointerDown(buildToolEvent(e.nativeEvent as MouseEvent));
    },
    [editorRef, buildToolEvent],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      editorRef.current?.dispatchPointerMove(buildToolEvent(e.nativeEvent as MouseEvent));
    },
    [editorRef, buildToolEvent],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      editorRef.current?.dispatchPointerUp(buildToolEvent(e.nativeEvent as MouseEvent));
    },
    [editorRef, buildToolEvent],
  );

  const onPointerLeave = useCallback(
    () => { editorRef.current?.dispatchPointerLeave(); },
    [editorRef],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      editorRef.current?.dispatchDblClick(buildToolEvent(e.nativeEvent as MouseEvent));
    },
    [editorRef, buildToolEvent],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      editorRef.current?.dispatchWheel({
        ...buildToolEvent(e.nativeEvent as WheelEvent),
        deltaY: e.deltaY,
      });
    },
    [editorRef, buildToolEvent],
  );

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Canvas label */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium shrink-0"
        style={{ background: C.panel, borderBottom: `1px solid ${C.border}` }}
      >
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: color }}
        />
        <span style={{ color: C.text }}>{label}</span>
        <span className="ml-auto font-mono text-[10px]" style={{ color: C.textMuted }}>
          [{viewport.xMin.toFixed(1)}, {viewport.xMax.toFixed(1)}]
        </span>
      </div>

      {/* Dual-layer canvas wrapper */}
      <div
        ref={containerRef}
        className="relative flex-1"
        style={{ background: C.canvasBg }}
      >
        <canvas
          ref={staticRef}
          className="absolute inset-0"
          style={{ display: 'block' }}
        />
        <canvas
          ref={dynamicRef}
          className="absolute inset-0"
          style={{ display: 'block', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        />
      </div>
    </div>
  );
}

// ─── ParamSliderRow ───────────────────────────────────────────────────────────

interface ParamSliderRowProps {
  config:    ParamConfig;
  value:     number;
  editorRef: React.RefObject<EditorInjectable | null>;
}

function ParamSliderRow({ config, value, editorRef }: ParamSliderRowProps) {
  const { key, label, symbol, min, max, step } = config;

  const slider = useParamSlider<number>({
    getValue: () => useTrigStore.getState().userParams[key],
    onLiveUpdate: (v) => useTrigStore.getState().setUserParam(key, v),
    onCommit: (before, after) => {
      editorRef.current?.execute(
        new UpdateTrigParamCommand({ [key]: before }, { [key]: after }),
      );
    },
  });

  return (
    <div className="flex flex-col gap-1">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-sm font-semibold font-mono w-5 text-center"
            style={{ color: C.primary }}
          >
            {label}
          </span>
          <span className="text-[11px]" style={{ color: C.textMuted }}>
            {symbol}
          </span>
        </div>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: C.text }}
        >
          {value.toFixed(key === 'phi' ? 2 : 1)}
          {key === 'phi' ? ' rad' : ''}
        </span>
      </div>

      {/* Slider */}
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => slider.handleChange(v)}
        onValueCommit={([v]) => slider.handleCommit(v)}
      />
    </div>
  );
}

// ─── M03Container ─────────────────────────────────────────────────────────────

/**
 * Root container for the trigonometric function comparison lab.
 *
 * Demonstrates the dual-instance useDualCanvas pattern:
 *  - Canvas A and Canvas B each own an independent EditorInjectable
 *  - Their viewports (viewportA / viewportB) are stored separately in trigStore
 *  - Panning Canvas A does not affect Canvas B (complete isolation)
 *
 * The editorBRef is needed by ParamSliderRow to call editor.execute() for Undo.
 * Canvas A's editor is unused for commands (base curve is read-only).
 */
export function M03Container() {
  const userParams = useTrigStore((s) => s.userParams);
  const canUndo    = useHistoryStore((s) => s.canUndo);
  const canRedo    = useHistoryStore((s) => s.canRedo);

  // Stable setViewportFn reference for Canvas A (Zustand actions never re-create)
  const setViewportA = useTrigStore.getState().setViewportA;

  // editorBRef — we need a ref to Canvas B's editor for Undo commands.
  // We pass it down to ParamSliderRow so sliders can call editor.execute().
  // We cannot get it from useDualCanvas here (useDualCanvas is called inside
  // TrigCanvasPanel), so we use a forwarded ref pattern via a shared ref object.
  const editorBRef = useRef<EditorInjectable | null>(null);

  // ── Formula string for display ─────────────────────────────────────────────
  const formulaStr = buildFormulaText(userParams, 'sin');

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    useTrigStore.getState().resetUserParams();
  };

  const handleUndo = () => { useHistoryStore.getState().undo(); };
  const handleRedo = () => { useHistoryStore.getState().redo(); };

  return (
    <div
      className="flex flex-col w-full h-screen"
      style={{ background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif' }}
    >
      {/* ── TopBar ──────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-4 shrink-0"
        style={{
          height: '48px',
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span className="text-sm font-semibold" style={{ color: C.primary }}>
          三角函数对比实验室
        </span>

        {/* Live formula preview */}
        <span
          className="hidden sm:block text-xs font-mono px-2 py-0.5 rounded"
          style={{ background: C.panel, color: C.text }}
        >
          Canvas B: {formulaStr}
        </span>

        <div className="flex-1" />

        {/* Reset */}
        <button
          onClick={handleReset}
          className="px-3 py-1 text-xs rounded transition-opacity hover:opacity-80"
          style={{ background: C.panel, color: C.textMuted, border: `1px solid ${C.border}` }}
        >
          重置参数
        </button>

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="px-3 py-1 text-xs rounded transition-opacity"
          style={{
            background: C.panel,
            color:  canUndo ? C.text    : C.textMuted,
            border: `1px solid ${C.border}`,
            opacity: canUndo ? 1 : 0.45,
            cursor:  canUndo ? 'pointer' : 'not-allowed',
          }}
          title="撤销 (Ctrl+Z)"
        >
          ↩ 撤销
        </button>

        {/* Redo */}
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className="px-3 py-1 text-xs rounded transition-opacity"
          style={{
            background: C.panel,
            color:  canRedo ? C.text    : C.textMuted,
            border: `1px solid ${C.border}`,
            opacity: canRedo ? 1 : 0.45,
            cursor:  canRedo ? 'pointer' : 'not-allowed',
          }}
          title="重做 (Ctrl+Y)"
        >
          ↪ 重做
        </button>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: parameter control panel (280px) ──────────────────────────── */}
        <aside
          className="flex flex-col gap-5 p-4 shrink-0 overflow-y-auto"
          style={{
            width: '260px',
            background: C.panel,
            borderRight: `1px solid ${C.border}`,
          }}
        >
          {/* Section header */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: C.textMuted }}>
              Canvas B 参数
            </h2>
            <p className="text-[11px]" style={{ color: C.textMuted }}>
              y = A · sin(ω·x + φ) + k
            </p>
          </div>

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: 0 }} />

          {/* Slider rows */}
          {PARAMS.map((cfg) => (
            <ParamSliderRow
              key={cfg.key}
              config={cfg}
              value={userParams[cfg.key]}
              editorRef={editorBRef}
            />
          ))}

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: 0 }} />

          {/* Canvas legend */}
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: C.textMuted }}>
              图例
            </h2>
            <LegendRow color={C.compare} label="Canvas A" sub="y = sin(x)（固定参考）" />
            <LegendRow color={C.primary} label="Canvas B" sub={formulaStr} />
          </div>

          {/* Interaction hint */}
          <p className="text-[10px] leading-relaxed" style={{ color: C.textMuted }}>
            拖拽平移 · 滚轮缩放 · 双击复位<br />
            两个 Canvas 视口完全独立
          </p>
        </aside>

        {/* ── Right: dual canvas area ─────────────────────────────────────────── */}
        <main className="flex flex-1 min-w-0 min-h-0 overflow-hidden divide-x"
          style={{ borderColor: C.border }}>

          {/* Canvas A — base function y = sin(x), read-only params */}
          <TrigCanvasPanel
            label="Canvas A — 基础函数"
            color={C.compare}
            viewportKey="viewportA"
            setViewportFn={setViewportA}
            params={BASE_TRIG_PARAMS}
          />

          {/* Canvas B — user-controlled comparison curve */}
          <TrigCanvasPanelB
            label="Canvas B — 对比曲线"
            color={C.primary}
            editorBRef={editorBRef}
          />
        </main>
      </div>
    </div>
  );
}

// ─── Canvas B wrapper (exposes editorRef upwards) ─────────────────────────────

/**
 * Canvas B needs to forward its EditorInjectable ref up to M03Container so
 * that ParamSliderRow can call editor.execute() for Undo/Redo.
 * We use a render-time assignment (stable ref) rather than a React callback ref.
 */
interface TrigCanvasPanelBProps {
  label:      string;
  color:      string;
  editorBRef: React.RefObject<EditorInjectable | null>;
}

function TrigCanvasPanelB({ label, color, editorBRef }: TrigCanvasPanelBProps) {
  const viewport    = useTrigStore((s) => s.viewportB);
  const userParams  = useTrigStore((s) => s.userParams);
  const setViewportB = useTrigStore.getState().setViewportB;

  const {
    containerRef, staticRef, dynamicRef,
    canvasSize, editorRef, buildToolEvent,
  } = useDualCanvas({
    initialViewport: DEFAULT_TRIG_VIEWPORT,
    setViewportFn:   setViewportB,
    onInit: (editor) => editor.activateTool(new PanZoomTool()),
  });

  // Forward editor ref to parent so sliders can call execute()
  // This runs synchronously on every render — editorRef.current is stable
  // (set once in useDualCanvas's useEffect), so this assignment is idempotent.
  if (editorRef.current && !editorBRef.current) {
    (editorBRef as React.MutableRefObject<EditorInjectable | null>).current =
      editorRef.current;
  }

  // Static rendering
  useEffect(() => {
    const canvas = staticRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vp = new Viewport(
      viewport.xMin, viewport.xMax,
      viewport.yMin, viewport.yMax,
      canvasSize.width, canvasSize.height,
    );

    ctx.clearRect(0, 0, vp.width, vp.height);
    renderAxis(ctx, vp, { showGrid: true });

    // Render base sin(x) as faint reference
    const basePts = generateSinePath(
      BASE_TRIG_PARAMS.A, BASE_TRIG_PARAMS.omega,
      BASE_TRIG_PARAMS.phi, BASE_TRIG_PARAMS.k, vp,
    );
    renderTrigCurve(ctx, basePts, vp, C.compare, { lineWidth: 1, alpha: 0.25, lineDash: [4, 4] });

    // Render user curve
    const userPts = generateSinePath(
      userParams.A, userParams.omega, userParams.phi, userParams.k, vp,
    );
    renderTrigCurve(ctx, userPts, vp, color, { lineWidth: 2.5 });
  }, [userParams, color, viewport, canvasSize, staticRef]);

  // Event handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
      editorRef.current?.dispatchPointerDown(buildToolEvent(e.nativeEvent as MouseEvent));
    },
    [editorRef, buildToolEvent],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      editorRef.current?.dispatchPointerMove(buildToolEvent(e.nativeEvent as MouseEvent));
    },
    [editorRef, buildToolEvent],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      editorRef.current?.dispatchPointerUp(buildToolEvent(e.nativeEvent as MouseEvent));
    },
    [editorRef, buildToolEvent],
  );

  const onPointerLeave = useCallback(
    () => { editorRef.current?.dispatchPointerLeave(); },
    [editorRef],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      editorRef.current?.dispatchDblClick(buildToolEvent(e.nativeEvent as MouseEvent));
    },
    [editorRef, buildToolEvent],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      editorRef.current?.dispatchWheel({
        ...buildToolEvent(e.nativeEvent as WheelEvent),
        deltaY: e.deltaY,
      });
    },
    [editorRef, buildToolEvent],
  );

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Label */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium shrink-0"
        style={{ background: C.panel, borderBottom: `1px solid ${C.border}` }}
      >
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span style={{ color: C.text }}>{label}</span>
        <span className="ml-auto font-mono text-[10px]" style={{ color: C.textMuted }}>
          [{viewport.xMin.toFixed(1)}, {viewport.xMax.toFixed(1)}]
        </span>
      </div>

      {/* Dual-layer canvas */}
      <div
        ref={containerRef}
        className="relative flex-1"
        style={{ background: C.canvasBg }}
      >
        <canvas ref={staticRef}  className="absolute inset-0" style={{ display: 'block' }} />
        <canvas
          ref={dynamicRef}
          className="absolute inset-0"
          style={{ display: 'block', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        />
      </div>
    </div>
  );
}

// ─── Legend helper ────────────────────────────────────────────────────────────

function LegendRow({ color, label, sub }: { color: string; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="inline-block w-3 h-0.5 mt-1.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <div>
        <div className="text-xs font-medium" style={{ color: C.text }}>{label}</div>
        <div className="text-[10px] font-mono" style={{ color: C.textMuted }}>{sub}</div>
      </div>
    </div>
  );
}
