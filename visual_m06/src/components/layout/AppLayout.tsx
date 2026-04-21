import { TopBar } from './TopBar';
import { ScenarioPanel } from '@/components/panels/ScenarioPanel';
import { ParamPanel } from '@/components/panels/ParamPanel';
import { COLORS } from '@/styles/tokens';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex flex-col w-full h-full" style={{ backgroundColor: COLORS.bgPage }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：场景库 */}
        <ScenarioPanel />

        {/* 中央：主画布 */}
        <main
          className="relative flex-1 overflow-hidden"
          style={{ minWidth: 0, backgroundColor: COLORS.bgPage }}
        >
          {children}
        </main>

        {/* 右侧：参数面板 */}
        <ParamPanel />
      </div>
    </div>
  );
}
