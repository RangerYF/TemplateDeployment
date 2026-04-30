import { AppLayout } from '@/components/layout/AppLayout';
import { OrbitCanvas } from '@/components/scene/OrbitCanvas';

export default function App() {
  return (
    <AppLayout>
      <OrbitCanvas />
    </AppLayout>
  );
}
