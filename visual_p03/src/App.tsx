import { Component, type ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useModuleStore } from '@/store/moduleStore';
import { RefractionSvgCanvas } from '@/components/scene/RefractionSvgCanvas';
import { SnellWindowCanvas } from '@/components/scene/SnellWindowCanvas';
import { InterfaceScene3D } from '@/components/scene/InterfaceScene3D';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { LensSvgCanvas } from '@/components/scene/LensSvgCanvas';
import { DoubleSlitCanvas } from '@/components/scene/DoubleSlitCanvas';
import { DiffractionCanvas } from '@/components/scene/DiffractionCanvas';
import { ThinFilmCanvas } from '@/components/scene/ThinFilmCanvas';
import { useDoubleSlitStore } from '@/store/doubleSlitStore';
import { useDiffractionStore } from '@/store/diffractionStore';
import { useThinFilmStore } from '@/store/thinFilmStore';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  render() {
    if (this.state.error) return (
      <div style={{ color: 'red', padding: 20, whiteSpace: 'pre-wrap' }}>
        <b>渲染错误：</b>{this.state.error}
      </div>
    );
    return this.props.children;
  }
}

function DoubleSlitWrapper() {
  const settings = useDoubleSlitStore((s) => s.settings);
  const updateSettings = useDoubleSlitStore((s) => s.updateSettings);
  return <DoubleSlitCanvas settings={settings} onUpdateSettings={(fn) => updateSettings(fn(settings))} />;
}

function DiffractionWrapper() {
  const settings = useDiffractionStore((s) => s.settings);
  const updateSettings = useDiffractionStore((s) => s.updateSettings);
  return <DiffractionCanvas settings={settings} onUpdateSettings={(fn) => updateSettings(fn(settings))} />;
}

function ThinFilmWrapper() {
  const settings = useThinFilmStore((s) => s.settings);
  const updateSettings = useThinFilmStore((s) => s.updateSettings);
  return <ThinFilmCanvas settings={settings} onUpdateSettings={(fn) => updateSettings(fn(settings))} />;
}

function RefractionRouter() {
  const shape = useSimulationStore((s) => s.settings.shape);
  const renderMode = useUIStore((s) => s.renderMode);

  if (shape === 'snellwindow') return <SnellWindowCanvas />;
  if (shape === 'interface' && renderMode === '3d') return <InterfaceScene3D />;
  return <RefractionSvgCanvas />;
}

export default function App() {
  const activeModule = useModuleStore((s) => s.activeModule);

  return (
    <AppLayout>
      <ErrorBoundary key={activeModule}>
        {activeModule === 'refraction' && <RefractionRouter />}
        {activeModule === 'lens' && <LensSvgCanvas />}
        {activeModule === 'doubleslit' && <DoubleSlitWrapper />}
        {activeModule === 'diffraction' && <DiffractionWrapper />}
        {activeModule === 'thinfilm' && <ThinFilmWrapper />}
      </ErrorBoundary>
    </AppLayout>
  );
}
