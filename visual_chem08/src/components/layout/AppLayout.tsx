import * as React from 'react';
import { COLORS } from '@/styles/tokens';
import { useUIStore } from '@/store';
import { TopBar } from './TopBar';
import { TitrationPanel } from '@/components/panels/TitrationPanel';
import { ComparisonPanel } from '@/components/panels/ComparisonPanel';
import { BufferPanel } from '@/components/panels/BufferPanel';
import { MainContent } from '@/components/MainContent';

const MIN_WIDTH = 260;
const MAX_WIDTH = 520;
const DEFAULT_WIDTH = 340;

function LeftPanel() {
  const activeTab = useUIStore((s) => s.activeTab);
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  const dragging = React.useRef(false);
  const startX = React.useRef(0);
  const startW = React.useRef(0);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + delta)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <aside
      className="shrink-0 border-r overflow-hidden relative"
      style={{
        width,
        borderColor: COLORS.border,
        backgroundColor: COLORS.bg,
      }}
    >
      {activeTab === 'curve' && <TitrationPanel />}
      {activeTab === 'comparison' && <ComparisonPanel />}
      {activeTab === 'buffer' && <BufferPanel />}

      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="absolute top-0 right-0 h-full"
        style={{ width: 5, cursor: 'col-resize' }}
      />
    </aside>
  );
}

export function AppLayout() {
  return (
    <div className="flex flex-col w-full h-full">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <main
          className="relative flex-1 overflow-hidden p-4"
          style={{ backgroundColor: COLORS.bgPage }}
        >
          <MainContent />
        </main>
      </div>
    </div>
  );
}
