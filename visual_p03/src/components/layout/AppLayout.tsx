import { type ReactNode, useState } from 'react';
import { TopBar } from './TopBar';
import { useModuleStore } from '@/store/moduleStore';

import { ParameterPanel } from '../panels/ParameterPanel';
import { MetricsPanel } from '../panels/MetricsPanel';
import { LensParameterPanel } from '../panels/LensParameterPanel';
import { LensMetricsPanel } from '../panels/LensMetricsPanel';
import { DoubleSlitParameterPanel } from '../panels/DoubleSlitParameterPanel';
import { DoubleSlitMetricsPanel } from '../panels/DoubleSlitMetricsPanel';
import { DiffractionParameterPanel } from '../panels/DiffractionParameterPanel';
import { DiffractionMetricsPanel } from '../panels/DiffractionMetricsPanel';
import { ThinFilmParameterPanel } from '../panels/ThinFilmParameterPanel';
import { ThinFilmMetricsPanel } from '../panels/ThinFilmMetricsPanel';

import { useDoubleSlitStore } from '@/store/doubleSlitStore';
import { useDiffractionStore } from '@/store/diffractionStore';
import { useThinFilmStore } from '@/store/thinFilmStore';

interface AppLayoutProps {
  children: ReactNode;
}

function ActiveParameterPanel() {
  const mod = useModuleStore((s) => s.activeModule);
  const dblSettings = useDoubleSlitStore((s) => s.settings);
  const dblUpdate = useDoubleSlitStore((s) => s.updateSettings);
  const diffSettings = useDiffractionStore((s) => s.settings);
  const diffUpdate = useDiffractionStore((s) => s.updateSettings);
  const tfSettings = useThinFilmStore((s) => s.settings);
  const tfUpdate = useThinFilmStore((s) => s.updateSettings);

  switch (mod) {
    case 'refraction': return <ParameterPanel />;
    case 'lens': return <LensParameterPanel />;
    case 'doubleslit': return <DoubleSlitParameterPanel settings={dblSettings} onUpdateSettings={dblUpdate} />;
    case 'diffraction': return <DiffractionParameterPanel settings={diffSettings} onUpdateSettings={diffUpdate} />;
    case 'thinfilm': return <ThinFilmParameterPanel settings={tfSettings} onUpdateSettings={tfUpdate} />;
  }
}

function ActiveMetricsPanel() {
  const mod = useModuleStore((s) => s.activeModule);
  const dblSettings = useDoubleSlitStore((s) => s.settings);
  const diffSettings = useDiffractionStore((s) => s.settings);
  const tfSettings = useThinFilmStore((s) => s.settings);

  switch (mod) {
    case 'refraction': return <MetricsPanel />;
    case 'lens': return <LensMetricsPanel />;
    case 'doubleslit': return <DoubleSlitMetricsPanel settings={dblSettings} />;
    case 'diffraction': return <DiffractionMetricsPanel settings={diffSettings} />;
    case 'thinfilm': return <ThinFilmMetricsPanel settings={tfSettings} />;
  }
}

export function AppLayout({ children }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const panelContent = (
    <>
      <div className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <ActiveParameterPanel />
      </div>
      <div className="p-4">
        <h3
          className="mb-3 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          实时读数
        </h3>
        <ActiveMetricsPanel />
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
        </main>

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
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
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
              <span className="text-sm font-semibold" style={{ color: 'var(--theme-text-muted)' }}>
                控制面板
              </span>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ color: 'var(--theme-text-muted)' }}
                onClick={() => setDrawerOpen(false)}
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
