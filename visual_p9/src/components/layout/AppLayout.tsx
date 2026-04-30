import { useEffect, useState } from 'react';
import { TopBar } from './TopBar';
import { ControlPanel } from '@/components/panels/ControlPanel';
import { FormulaPanel } from '@/components/panels/FormulaPanel';
import { MetricsPanel } from '@/components/panels/MetricsPanel';
import { ModelListPanel } from '@/components/panels/ModelListPanel';
import { PanelSection } from '@/components/panels/PanelSection';
import { ParameterPanel } from '@/components/panels/ParameterPanel';
import { SourcePanel } from '@/components/panels/SourcePanel';
import { TeachingPanel } from '@/components/panels/TeachingPanel';
import { useUIStore } from '@/store/uiStore';
import { COLORS } from '@/styles/tokens';

interface AppLayoutProps {
  children: React.ReactNode;
}

type DragTarget = 'left' | 'right';

interface ResizeState {
  target: DragTarget;
  startX: number;
  startWidth: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function AppLayout({ children }: AppLayoutProps) {
  const leftWidth = useUIStore((state) => state.layout.leftWidth);
  const rightWidth = useUIStore((state) => state.layout.rightWidth);
  const setLayoutWidths = useUIStore((state) => state.setLayoutWidths);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  useEffect(() => {
    if (!resizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - resizeState.startX;
      if (resizeState.target === 'left') {
        setLayoutWidths({ leftWidth: clamp(resizeState.startWidth + deltaX, 196, 340) });
      } else {
        setLayoutWidths({ rightWidth: clamp(resizeState.startWidth - deltaX, 280, 460) });
      }
    };
    const handlePointerUp = () => setResizeState(null);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [resizeState, setLayoutWidths]);

  const startResize = (target: DragTarget, startX: number, startWidth: number) => {
    setResizeState({ target, startX, startWidth });
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: COLORS.bgPage }}>
      <TopBar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative hidden shrink-0 lg:block">
          <ModelListPanel widthPx={leftWidth} />
          <button
            aria-label="调整左侧模型栏宽度"
            className="absolute right-[-5px] top-0 z-20 hidden h-full w-2 cursor-col-resize lg:block"
            style={{ background: resizeState?.target === 'left' ? 'rgba(33,150,243,0.18)' : 'transparent' }}
            onPointerDown={(event) => {
              event.preventDefault();
              startResize('left', event.clientX, leftWidth);
            }}
          >
            <span className="absolute left-1/2 top-1/2 h-14 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
          </button>
        </div>
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {children}
        </main>
        <button
          aria-label="调整右侧参数栏宽度"
          className="relative z-20 hidden w-2 shrink-0 cursor-col-resize xl:block"
          style={{ background: resizeState?.target === 'right' ? 'rgba(33,150,243,0.18)' : 'transparent' }}
          onPointerDown={(event) => {
            event.preventDefault();
            startResize('right', event.clientX, rightWidth);
          }}
        >
          <span className="absolute left-1/2 top-1/2 h-14 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </button>
        <aside
          className="hidden shrink-0 overflow-y-auto border-l xl:block"
          style={{ width: rightWidth, borderColor: COLORS.border, background: COLORS.bg }}
        >
          <PanelSection title="播放与显示">
            <ControlPanel />
          </PanelSection>
          <PanelSection title="参数设置">
            <ParameterPanel />
          </PanelSection>
          <PanelSection title="实时数值">
            <MetricsPanel />
          </PanelSection>
          <PanelSection title="公式与关系" defaultOpen={false}>
            <FormulaPanel />
          </PanelSection>
          <PanelSection title="教学提示" defaultOpen={false}>
            <TeachingPanel />
          </PanelSection>
          <PanelSection title="数据来源" defaultOpen={false}>
            <SourcePanel />
          </PanelSection>
        </aside>
      </div>
    </div>
  );
}
