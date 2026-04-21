import { TopBar } from './TopBar';
import { COLORS } from '@/styles/tokens';

interface DemoLayoutProps {
  children: [React.ReactNode, React.ReactNode]; // [canvas, panel]
}

export function DemoLayout({ children }: DemoLayoutProps) {
  const [canvas, panel] = children;
  return (
    <div className="flex flex-col w-full h-full" style={{ backgroundColor: COLORS.bgPage }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* 中央：演示台画布 */}
        <main
          className="relative flex-1 overflow-hidden"
          style={{ minWidth: 0, backgroundColor: COLORS.bg }}
        >
          {canvas}
        </main>

        {/* 右侧：演示台面板 */}
        {panel}
      </div>
    </div>
  );
}
