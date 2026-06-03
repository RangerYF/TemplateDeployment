import { lazy, Suspense, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { OrbitCanvas } from '@/components/scene/OrbitCanvas';
import { useUIStore } from '@/store/uiStore';
import { detectGPU } from '@/lib/utils/detectGPU';

const ThreeCanvas = lazy(() =>
  import('@/components/scene/ThreeCanvas').then((m) => ({ default: m.ThreeCanvas })),
);

export default function App() {
  const gpu = useMemo(() => detectGPU(), []);
  const renderMode = useUIStore((s) => s.renderMode);

  const use3D = renderMode === '3d' && gpu === 'high';

  return (
    <AppLayout>
      {use3D ? (
        <Suspense fallback={<OrbitCanvas />}>
          <ThreeCanvas />
        </Suspense>
      ) : (
        <OrbitCanvas />
      )}
    </AppLayout>
  );
}
