/**
 * M04Layout — 三角函数演示台 top-level layout (Phase 2)
 *
 * Layout:
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ TopBar: 三角函数演示台                          [↩][↪]   │
 *  ├──────────────────┬─┬──────────────────────┬─────────────┤
 *  │                  │●│                      │             │
 *  │  UnitCircleCanvas│S│ FunctionGraphCanvas  │ Panel       │
 *  │    (flex-1)      │Y│    (w-[460px])       │ (w-[280px]) │
 *  │                  │N│                      │             │
 *  └──────────────────┴─┴──────────────────────┴─────────────┘
 *
 * The 1px divider between the two canvases carries a small coloured dot
 * at syncY (pixel-y of the trace point on FunctionGraphCanvas), giving a
 * visual connection between point P on the unit circle and the curve trace.
 */

import { useEffect } from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { UnitCircleCanvas }       from '@/components/UnitCircleCanvas';
import { FunctionGraphCanvas }    from '@/components/FunctionGraphCanvas';
import { TriangleCanvas }         from '@/components/TriangleCanvas';
import { UnitCirclePanel }        from '@/components/panels/UnitCirclePanel';
import { TrigTransformPanel }     from '@/components/panels/TrigTransformPanel';
import { FivePointPanel }         from '@/components/panels/FivePointPanel';
import { AuxiliaryPanel }         from '@/components/panels/AuxiliaryPanel';
import { TriangleSolverPanel }    from '@/components/panels/TriangleSolverPanel';
import { SpecialValuesTable }     from '@/components/SpecialValuesTable';
import { useHistoryStore }        from '@/editor/store/historyStore';
import { useSyncLineStore }       from '@/editor/store/syncLineStore';
import { useM04UiStore, type M04AppMode } from '@/editor/store/m04UiStore';
import { COLORS }                 from '@/styles/colors';

export function M04Layout() {
  const appMode = useM04UiStore((s) => s.appMode);
  const setAppMode = useM04UiStore((s) => s.setAppMode);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undo    = useHistoryStore((s) => s.undo);
  const redo    = useHistoryStore((s) => s.redo);
  const syncY   = useSyncLineStore((s) => s.syncY);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
          三角函数演示台
        </span>

        {/* ── Mode toggle ──────────────────────────────────────────────── */}
        <div className="ml-3 flex items-center gap-1">
          {(['trig', 'triangle'] as M04AppMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setAppMode(m)}
              className="text-[11px] font-semibold transition-all duration-150"
              style={{
                padding: '3px 10px',
                borderRadius: 9999,
                border: `1px solid ${appMode === m ? COLORS.primary : COLORS.borderMuted}`,
                background: appMode === m ? `${COLORS.primary}22` : 'transparent',
                color: appMode === m ? COLORS.primary : COLORS.textSecondary,
                cursor: appMode === m ? 'default' : 'pointer',
              }}
            >
              {m === 'trig' ? '函数图像' : '三角解算'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1 rounded-md text-eduMind-textPlaceholder hover:text-eduMind-text hover:bg-eduMind-bgMuted disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            title="撤销 Ctrl+Z"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1 rounded-md text-eduMind-textPlaceholder hover:text-eduMind-text hover:bg-eduMind-bgMuted disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            title="重做 Ctrl+Y"
          >
            <Redo2 size={15} />
          </button>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {appMode === 'trig' ? (
          <>
            {/* Unit circle canvas — fills remaining horizontal space */}
            <div className="flex-1 overflow-hidden">
              <UnitCircleCanvas />
            </div>

            {/* ── Sync divider ───────────────────────────────────────────── */}
            <div
              style={{
                width: 1,
                flexShrink: 0,
                background: COLORS.border,
                position: 'relative',
                overflow: 'visible',
                zIndex: 10,
              }}
            >
              {syncY !== null && (
                <div
                  style={{
                    position: 'absolute',
                    top:  syncY - 5,
                    left: -4,
                    width:  9,
                    height: 9,
                    borderRadius: '50%',
                    background:  COLORS.primary,
                    boxShadow:   `0 0 8px rgba(50,213,131,0.7)`,
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>

            {/* Function graph canvas */}
            <div style={{ width: 460, flexShrink: 0, overflow: 'hidden' }}>
              <FunctionGraphCanvas />
            </div>

            {/* Right panel — trig tools */}
            <aside className="w-[280px] shrink-0 bg-white border-l border-eduMind-border flex flex-col overflow-y-auto">
              <UnitCirclePanel />
              <TrigTransformPanel />
              <FivePointPanel />
              <AuxiliaryPanel />
              <SpecialValuesTable />
            </aside>
          </>
        ) : (
          <>
            {/* Triangle canvas — fills all horizontal space */}
            <div className="flex-1 overflow-hidden">
              <TriangleCanvas />
            </div>

            {/* Right panel — triangle solver */}
            <aside className="w-[280px] shrink-0 bg-white border-l border-eduMind-border flex flex-col overflow-y-auto">
              <TriangleSolverPanel />
            </aside>
          </>
        )}

      </div>
    </div>
  );
}
