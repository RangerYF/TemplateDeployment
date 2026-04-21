import { AppLayout } from '@/components/layout/AppLayout';
import { CrystalScene3D } from '@/components/scene/CrystalScene3D';
import { useCrystalViewerInit } from '@/editor/init';

function App() {
  useCrystalViewerInit();
  return (
    <AppLayout>
      <CrystalScene3D />
    </AppLayout>
  );
}

export default App;
