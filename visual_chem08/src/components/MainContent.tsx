import { useUIStore } from '@/store';
import { TitrationCurveChart } from './charts/TitrationCurveChart';
import { ComparisonChart } from './charts/ComparisonChart';
import { BufferBarChart } from './charts/BufferBarChart';

export function MainContent() {
  const activeTab = useUIStore((s) => s.activeTab);

  switch (activeTab) {
    case 'curve':
      return <TitrationCurveChart />;
    case 'comparison':
      return <ComparisonChart />;
    case 'buffer':
      return <BufferBarChart />;
  }
}
