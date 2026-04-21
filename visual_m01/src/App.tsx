import { AppLayout } from '@/components/layout/AppLayout';
import { Scene3D } from '@/components/scene/Scene3D';
import { useEditorInit } from '@/editor/init';

function App() {
  useEditorInit();

  return (
    <AppLayout>
      <Scene3D />
    </AppLayout>
  );
}

export default App;
