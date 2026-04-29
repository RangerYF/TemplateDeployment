/**
 * M03 解析几何画板 — Three-Zone Layout
 *
 * Visual design based on design_guid (SYXMA) tokens for mature, polished feel.
 * TopBar uses subtle shadow + refined pill buttons.
 * Panels use clean card-like styling with soft borders.
 */

import { useEffect, useState } from 'react';
import {
  Undo2, Redo2, Crosshair, Move, MapPin,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { GeometryCanvas } from '@/components/GeometryCanvas';
import { EntityListPanel } from '@/components/panels/EntityListPanel';
import { ConicParamPanel } from '@/components/panels/ConicParamPanel';
import { DerivedInfoPanel } from '@/components/panels/DerivedInfoPanel';
import { EccentricityPanel } from '@/components/panels/EccentricityPanel';
import { LocusPanel }        from '@/components/panels/LocusPanel';
import { OpticalPanel }      from '@/components/panels/OpticalPanel';
import { LineParamPanel }            from '@/components/panels/LineParamPanel';
import { ImplicitCurveParamPanel }   from '@/components/panels/ImplicitCurveParamPanel';
import { MovablePointAnimPanel }     from '@/components/panels/MovablePointAnimPanel';
import { PresetsPanel }              from '@/components/panels/PresetsPanel';
import { useHistoryStore } from '@/editor/store/historyStore';
import { useEntityStore } from '@/editor/store/entityStore';
import { COLORS } from '@/styles/colors';

export function M03Layout() {
  const canUndo        = useHistoryStore((s) => s.canUndo);
  const canRedo        = useHistoryStore((s) => s.canRedo);
  const undo           = useHistoryStore((s) => s.undo);
  const redo           = useHistoryStore((s) => s.redo);
  const activeTool     = useEntityStore((s) => s.activeTool);
  const setTool        = useEntityStore((s) => s.setActiveTool);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const entities       = useEntityStore((s) => s.entities);
  const activeEntity   = entities.find((e) => e.id === activeEntityId);
  const activeType     = activeEntity?.type;
  const hasSelection   = activeEntityId !== null;

  const [leftOpen, setLeftOpen]   = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Esc → reset tool to default (skip if focus is on an input/textarea)
      if (e.key === 'Escape') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (useEntityStore.getState().activeTool !== 'pan-zoom') {
          useEntityStore.getState().setActiveTool('pan-zoom');
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
      } else if (
        (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        useHistoryStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-eduMind-bgPage">

      {/* ── TopBar ───────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center h-11 px-3 gap-2 bg-white shrink-0 z-10"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        {/* Title */}
        <span className="text-eduMind-text font-semibold text-[13px] tracking-wide select-none">
          解析几何画板
        </span>

        {/* Presets */}
        <div className="ml-2">
          <PresetsPanel />
        </div>

        {/* ── Tools ──────────────────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Pan/Snap toggle */}
          <ToolButton
            active={activeTool === 'point-on-curve'}
            onClick={() => setTool(activeTool === 'point-on-curve' ? 'pan-zoom' : 'point-on-curve')}
            title={activeTool === 'point-on-curve' ? '切换到平移缩放' : '动点追踪'}
            activeColor="#00C06B"
          >
            {activeTool === 'point-on-curve'
              ? <><Crosshair size={13} /><span>追踪</span></>
              : <><Move size={13} /><span>平移</span></>}
          </ToolButton>

          {/* Movable point tool */}
          <ToolButton
            active={activeTool === 'movable-point'}
            onClick={() => setTool(activeTool === 'movable-point' ? 'pan-zoom' : 'movable-point')}
            title={activeTool === 'movable-point' ? '退出动点模式' : '放置/拖拽动点'}
            activeColor="#F59E0B"
          >
            <MapPin size={13} /><span>动点</span>
          </ToolButton>

          {/* Divider */}
          <div className="w-px h-4 bg-eduMind-border mx-0.5" />

          {/* Panel toggles + undo/redo */}
          <IconButton onClick={() => setLeftOpen((v) => !v)} title={leftOpen ? '收起列表' : '展开列表'}>
            {leftOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </IconButton>
          <IconButton onClick={undo} disabled={!canUndo} title="撤销 Ctrl+Z">
            <Undo2 size={15} />
          </IconButton>
          <IconButton onClick={redo} disabled={!canRedo} title="重做 Ctrl+Y">
            <Redo2 size={15} />
          </IconButton>
          <IconButton onClick={() => setRightOpen((v) => !v)} title={rightOpen ? '收起参数' : '展开参数'}>
            {rightOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </IconButton>
        </div>
      </header>

      {/* ── Main Three-Zone ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Entity List ──────────────────────────────────────────── */}
        <aside
          className="shrink-0 bg-white border-r border-eduMind-border flex flex-col overflow-hidden transition-[width] duration-200"
          style={{ width: leftOpen ? 224 : 0 }}
        >
          {leftOpen && (
            <div className="flex flex-col h-full overflow-y-auto">
              <EntityListPanel />
            </div>
          )}
        </aside>

        {/* ── CENTER: Canvas ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden bg-eduMind-bgPage">
          <GeometryCanvas />
        </div>

        {/* ── RIGHT: Param Panels ────────────────────────────────────────── */}
        <aside
          className="shrink-0 bg-white border-l border-eduMind-border flex flex-col overflow-hidden transition-[width] duration-200"
          style={{ width: rightOpen ? 268 : 0 }}
        >
          {rightOpen && (
            <div className="flex flex-col h-full overflow-y-auto">
              {hasSelection ? (
                activeType === 'line' ? (
                  <LineParamPanel />
                ) : activeType === 'implicit-curve' ? (
                  <ImplicitCurveParamPanel />
                ) : activeType === 'movable-point' ? (
                  <MovablePointAnimPanel />
                ) : (
                  <>
                    <ConicParamPanel />
                    <DerivedInfoPanel />
                    <LocusPanel />
                    <OpticalPanel />
                    <EccentricityPanel />
                  </>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-eduMind-bgMuted flex items-center justify-center mb-3">
                    <Crosshair size={18} className="text-eduMind-textPlaceholder" />
                  </div>
                  <p className="text-[13px] font-medium text-eduMind-textMuted">
                    选择一个实体以编辑参数
                  </p>
                  <p className="text-[11px] text-eduMind-textPlaceholder mt-1">
                    在左侧列表中点击曲线，或直接在画布上选择
                  </p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ─── Shared button components ────────────────────────────────────────────────

function ToolButton({
  active, onClick, title, activeColor, children,
}: {
  active: boolean; onClick: () => void; title: string;
  activeColor: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150"
      style={active ? {
        background: activeColor,
        color: COLORS.white,
        boxShadow: `0 1px 4px ${activeColor}44`,
      } : {
        background: 'transparent',
        color: COLORS.textSecondary,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = COLORS.surfaceAlt;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
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
