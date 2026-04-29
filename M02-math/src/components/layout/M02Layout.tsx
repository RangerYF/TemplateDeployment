/**
 * M02 函数图形实验室 — Three-Zone Layout
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │ TopBar: [← 首页] "M02 函数图形实验室" [Library] [↩ 撤销][↪] │
 * ├──────────────┬─────────────────────────┬───────────────────────┤
 * │ LEFT 220px   │   CENTER (flex-1)       │  RIGHT 260px          │
 * │ "Library"    │   Canvas                │  "Tuner"              │
 * │ FunctionList │   FunctionCanvas        │  Per-function panels  │
 * │ + Add btn    │                         │  (sliders, transform) │
 * └──────────────┴─────────────────────────┴───────────────────────┘
 */

import { useEffect, useRef, useState } from 'react';
import {
  Undo2, Redo2,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { FunctionCanvas } from '@/components/FunctionCanvas';
import type { FunctionCanvasHandle } from '@/components/FunctionCanvas';
import { FunctionLibraryPanel } from '@/components/panels/FunctionLibraryPanel';
import { FunctionListPanel } from '@/components/panels/FunctionListPanel';
import { FunctionInputPanel } from '@/components/panels/FunctionInputPanel';
import { TemplateParamPanel } from '@/components/panels/TemplateParamPanel';
import { TransformPanel } from '@/components/panels/TransformPanel';

import { ViewportPanel } from '@/components/panels/ViewportPanel';
import { DerivativePanel } from '@/components/panels/DerivativePanel';
import { AnimationControlPanel } from '@/components/panels/AnimationControlPanel';
import { PiecewisePanel } from '@/components/panels/PiecewisePanel';
import { CanvasSettingsPanel } from '@/components/panels/CanvasSettingsPanel';
import { useHistoryStore } from '@/editor/store/historyStore';
import { useFunctionStore } from '@/editor/store/functionStore';
import { editorInstance } from '@/editor/core/Editor';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import { useCanvasToolStore } from '@/editor/store/canvasToolStore';
import { COLORS } from '@/styles/colors';
import { createId } from '@/lib/id';

export function M02Layout() {
  const canvasRef        = useRef<FunctionCanvasHandle>(null);
  const canUndo          = useHistoryStore((s) => s.canUndo);
  const canRedo          = useHistoryStore((s) => s.canRedo);
  const activeFunctionId = useFunctionStore((s) => s.activeFunctionId);
  const activeMode       = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId)?.mode,
  );
  const activeTemplateId = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId)?.templateId ?? null,
  );
  const activeHasParams = useFunctionStore((s) =>
    (s.functions.find((f) => f.id === s.activeFunctionId)?.namedParams.length ?? 0) > 0,
  );
  const activeLabel = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId)?.label ?? '',
  );

  const [leftOpen, setLeftOpen]   = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const handleUndo = () => { useHistoryStore.getState().undo(); };
  const handleRedo = () => { useHistoryStore.getState().redo(); };

  const handleModeSwitch = () => {
    if (!activeFunctionId) return;
    const store = useFunctionStore.getState();
    const fn = store.functions.find((f) => f.id === activeFunctionId);
    if (!fn) return;
    const nextMode = fn.mode === 'standard' ? 'piecewise' : 'standard';
    const before = { mode: fn.mode, segments: fn.segments };
    let nextSegments = fn.segments;
    if (nextMode === 'piecewise' && fn.segments.length === 0) {
      nextSegments = [{
        id: createId(),
        exprStr: 'x',
        domain: { xMin: 0, xMax: 1, xMinInclusive: true, xMaxInclusive: false },
      }];
    }
    const after = { mode: nextMode as 'standard' | 'piecewise', segments: nextSegments };
    editorInstance?.execute(
      new UpdateFunctionParamCommand(activeFunctionId, before, after, '切换函数模式'),
    );
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Esc → reset tool to default (skip if focus is on an input/textarea)
      if (e.key === 'Escape') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (useCanvasToolStore.getState().mode !== 'pan-zoom') {
          useCanvasToolStore.getState().setMode('pan-zoom');
        }
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        useHistoryStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-eduMind-bgPage">

      {/* ── TopBar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center h-11 px-3 gap-2 bg-white shrink-0 z-10"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        {/* Title */}
        <span className="text-eduMind-text font-semibold text-[13px] tracking-wide select-none">
          函数图形实验室
        </span>

        {/* Function Library inline in top bar */}
        <div className="ml-2">
          <FunctionLibraryPanel />
        </div>

        {/* ── Right controls ──────────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-1.5">
          <IconButton onClick={() => setLeftOpen((v) => !v)} title={leftOpen ? '收起列表' : '展开列表'}>
            {leftOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </IconButton>
          <IconButton onClick={handleUndo} disabled={!canUndo} title="撤销 Ctrl+Z">
            <Undo2 size={15} />
          </IconButton>
          <IconButton onClick={handleRedo} disabled={!canRedo} title="重做 Ctrl+Y">
            <Redo2 size={15} />
          </IconButton>
          <IconButton onClick={() => setRightOpen((v) => !v)} title={rightOpen ? '收起参数' : '展开参数'}>
            {rightOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </IconButton>
        </div>
      </header>

      {/* ── Main Three-Zone ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: "Library" — Function List ────────────────────────────────── */}
        <aside
          className="shrink-0 bg-white border-r border-eduMind-border flex flex-col overflow-hidden transition-[width] duration-200"
          style={{ width: leftOpen ? 224 : 0 }}
        >
          {leftOpen && (
            <div className="flex flex-col h-full overflow-y-auto p-3">
              <FunctionListPanel />
            </div>
          )}
        </aside>

        {/* ── CENTER: Canvas ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-hidden bg-eduMind-bgPage">
          <FunctionCanvas ref={canvasRef} />
        </div>

        {/* ── RIGHT: "Tuner" — Parameter Panels ──────────────────────────────── */}
        <aside
          className="shrink-0 bg-white border-l border-eduMind-border flex flex-col overflow-hidden transition-[width] duration-200"
          style={{ width: rightOpen ? 268 : 0 }}
        >
          {rightOpen && (
            <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden p-3">
              {activeFunctionId ? (
                <>
                  {/* Function header: indicator dot + label + type badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="shrink-0"
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: COLORS.primary,
                      }}
                    />
                    <span className="text-[13px] font-semibold" style={{ color: COLORS.textPrimary }}>
                      {activeLabel}
                    </span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        background: activeMode === 'piecewise'
                          ? `${COLORS.warning}1A`
                          : `${COLORS.primary}12`,
                        color: activeMode === 'piecewise'
                          ? COLORS.warning
                          : COLORS.textSecondary,
                      }}
                    >
                      {activeMode === 'piecewise' ? '分段' : '标准'}
                    </span>
                  </div>

                  {/* Mode toggle: only for custom (non-template) functions */}
                  {activeTemplateId === null && (
                    <div className="flex gap-1.5 mb-2.5">
                      <ModeTab active={activeMode === 'standard'} onClick={activeMode !== 'standard' ? handleModeSwitch : undefined}>
                        普通函数
                      </ModeTab>
                      <ModeTab active={activeMode === 'piecewise'} onClick={activeMode !== 'piecewise' ? handleModeSwitch : undefined}>
                        分段函数
                      </ModeTab>
                    </div>
                  )}

                  {activeMode === 'standard' ? (
                    activeTemplateId !== null ? (
                      <>
                        <TemplateParamPanel />
                        <Divider />
                        <AnimationControlPanel canvasRef={canvasRef} />
                        <Divider />
                        <DerivativePanel />
                      </>
                    ) : (
                      <>
                        <FunctionInputPanel />
                        {activeHasParams && (
                          <>
                            <TemplateParamPanel />
                            <Divider />
                          </>
                        )}
                        <TransformPanel />
                        <Divider />
                        <AnimationControlPanel canvasRef={canvasRef} />
                        <Divider />
                        <DerivativePanel />
                      </>
                    )
                  ) : (
                    <PiecewisePanel />
                  )}
                  <Divider />
                  <ViewportPanel />
                </>
              ) : (
                <CanvasSettingsPanel />
              )}
            </div>
          )}
        </aside>
      </div>

    </div>
  );
}

function Divider() {
  return <hr className="border-t border-eduMind-border my-2.5 shrink-0" />;
}

function ModeTab({ active, onClick, children }: {
  active: boolean; onClick?: (() => void); children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-1 px-2 text-xs rounded-full font-semibold transition-colors"
      style={{
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        background: active ? `${COLORS.primary}22` : COLORS.surface,
        color: active ? COLORS.primary : COLORS.textSecondary,
        cursor: active ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function IconButton({
  onClick, disabled, title, children,
}: {
  onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1 rounded-md text-eduMind-textPlaceholder hover:text-eduMind-text hover:bg-eduMind-bgMuted disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
