import { AppLayout } from '@/components/layout/AppLayout';
import { SimulationCanvas } from '@/components/scene/SimulationCanvas';
import { useAppInit } from '@/editor/init';

function App() {
  useAppInit();
  return (
    <AppLayout>
      <SimulationCanvas />
    </AppLayout>
  );
}

export default App;
