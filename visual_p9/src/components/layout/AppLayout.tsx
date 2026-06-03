import { useState, type ReactNode } from 'react';
import { TopBar } from './TopBar';
import { ControlPanel } from '../panels/ControlPanel';
import { MetricsPanel } from '../panels/MetricsPanel';
import { ParameterPanel } from '../panels/ParameterPanel';
import { useUIStore } from '@/store/uiStore';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const renderMode = useUIStore((s) => s.renderMode);
  const is3D = renderMode === '3d';

  const panelContent = (
    <>
      <div className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <h3
          className="mb-3 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          实验参数
        </h3>
        <ParameterPanel />
      </div>

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

      <div className="p-4">
        <h3
          className="mb-3 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          实时读数
        </h3>
        <MetricsPanel />
      </div>
    </>
  );

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--theme-bg)' }}
    >
      <TopBar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          {children}

          {/* Floating gear button — mobile only, 2D only */}
          {!is3D && (
            <button
              className="lg:hidden absolute bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-lg"
              style={{
                background: 'var(--theme-panel-bg)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text-muted)',
              }}
              onClick={() => setDrawerOpen(true)}
              aria-label="打开控制面板"
            >
              ⚙
            </button>
          )}
        </main>

        {/* Right panel — desktop only, 2D only */}
        {!is3D && (
          <aside
            className="hidden shrink-0 overflow-y-auto border-l lg:block"
            style={{
              width: 320,
              borderColor: 'var(--theme-border)',
              background: 'var(--theme-panel-bg)',
            }}
          >
            {panelContent}
          </aside>
        )}
      </div>

      {/* Mobile drawer — 2D only */}
      {!is3D && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute right-0 top-0 h-full w-[320px] max-w-[85vw] overflow-y-auto shadow-xl"
            style={{
              background: 'var(--theme-panel-bg)',
              borderLeft: '1px solid var(--theme-border)',
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                控制面板
              </span>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ color: 'var(--theme-text-muted)' }}
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            {panelContent}
          </div>
        </div>
      )}
    </div>
  );
}
