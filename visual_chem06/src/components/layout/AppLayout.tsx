import { useEffect, useState, type ReactNode } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ModelLibraryPanel } from '@/components/panels/ModelLibraryPanel';
import { RightSidebar } from '@/components/panels/RightSidebar';
import { COLORS } from '@/styles/tokens';

type DragTarget = 'left' | 'right' | null;

const LEFT_MIN = 280;
const LEFT_MAX = 420;
const RIGHT_MIN = 320;
const RIGHT_MAX = 480;
const HANDLE_WIDTH = 10;
const CENTER_MIN = 420;

export function AppLayout({ children }: { children: ReactNode }) {
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(400);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));

  const isCompact = viewportWidth < 1200;
  const compactLeftWidth = Math.max(210, Math.min(260, Math.round(viewportWidth * 0.24)));
  const compactRightWidth = Math.max(240, Math.min(320, Math.round(viewportWidth * 0.3)));
  const effectiveLeftWidth = isCompact ? compactLeftWidth : leftWidth;
  const effectiveRightWidth = isCompact ? compactRightWidth : rightWidth;
  const layoutMinWidth = effectiveLeftWidth + effectiveRightWidth + CENTER_MIN + (isCompact ? 0 : HANDLE_WIDTH * 2);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!dragTarget || isCompact) return;

    const handleMove = (event: PointerEvent) => {
      if (dragTarget === 'left') {
        setLeftWidth(Math.min(LEFT_MAX, Math.max(LEFT_MIN, event.clientX)));
        return;
      }

      const nextRightWidth = window.innerWidth - event.clientX;
      setRightWidth(Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, nextRightWidth)));
    };

    const handleUp = () => setDragTarget(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragTarget, isCompact]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: COLORS.bgPage }}>
      <TopBar />
      {isCompact ? (
        <div
          className="shrink-0 border-b px-4 py-2 text-xs leading-5"
          style={{ borderColor: COLORS.border, background: '#FFF7EE', color: COLORS.textSecondary }}
        >
          当前窗口较小，已切换为三栏紧凑布局；如果中间舞台或右侧信息显得拥挤，可横向滚动查看，建议放大屏幕以获得最佳体验。
        </div>
      ) : null}
      <div className="flex flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-h-0 flex-1" style={{ minWidth: layoutMinWidth }}>
          <div
            className="shrink-0"
            style={{
              width: effectiveLeftWidth,
              minWidth: isCompact ? effectiveLeftWidth : LEFT_MIN,
              maxWidth: isCompact ? effectiveLeftWidth : LEFT_MAX,
            }}
          >
            <ModelLibraryPanel />
          </div>

          {!isCompact ? <ResizeHandle side="left" onPointerDown={() => setDragTarget('left')} active={dragTarget === 'left'} /> : null}

          <main className="min-w-0 flex-1 overflow-hidden" style={{ minWidth: CENTER_MIN }}>
            {children}
          </main>

          {!isCompact ? <ResizeHandle side="right" onPointerDown={() => setDragTarget('right')} active={dragTarget === 'right'} /> : null}

          <div
            className="shrink-0"
            style={{
              width: effectiveRightWidth,
              minWidth: isCompact ? effectiveRightWidth : RIGHT_MIN,
              maxWidth: isCompact ? effectiveRightWidth : RIGHT_MAX,
            }}
          >
            <RightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResizeHandle({ side, onPointerDown, active }: { side: 'left' | 'right'; onPointerDown: () => void; active: boolean }) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? '调整左侧栏宽度' : '调整右侧栏宽度'}
      onPointerDown={onPointerDown}
      className="group relative shrink-0"
      style={{ width: HANDLE_WIDTH, cursor: 'col-resize', background: active ? COLORS.primaryLight : COLORS.bgPage }}
    >
      <span
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full transition-colors"
        style={{ width: 4, background: active ? COLORS.primary : COLORS.border }}
      />
      <span
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
        style={{ width: 4, background: COLORS.primaryHover }}
      />
    </button>
  );
}
