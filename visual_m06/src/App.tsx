import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DemoLayout } from '@/components/layout/DemoLayout';
import { Canvas2D } from '@/components/canvas/Canvas2D';
import { Canvas3D } from '@/components/canvas/Canvas3D';
import { CanvasDemo } from '@/components/canvas/CanvasDemo';
import { DemoPanel } from '@/components/panels/DemoPanel';
import { useVectorStore, useHistoryStore } from '@/editor';
import { OPERATION_META } from '@/editor/entities/types';

function CanvasRouter() {
  const operation = useVectorStore((s) => s.operation);
  if (operation === 'demoStage') return null; // handled by DemoLayout
  const dimension = OPERATION_META[operation].dimension;
  return dimension === '3D' ? <Canvas3D /> : <Canvas2D key={operation} />;
}

function KeyboardShortcuts() {
  const { canUndo, canRedo, undo, redo } = useHistoryStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        undo();
      }
      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canUndo, canRedo, undo, redo]);

  return null;
}

function App() {
  const operation = useVectorStore((s) => s.operation);

  if (operation === 'demoStage') {
    return (
      <>
        <KeyboardShortcuts />
        <DemoLayout>
          <CanvasDemo />
          <DemoPanel />
        </DemoLayout>
      </>
    );
  }

  return (
    <>
      <KeyboardShortcuts />
      <AppLayout>
        <CanvasRouter />
      </AppLayout>
    </>
  );
}

export default App;
