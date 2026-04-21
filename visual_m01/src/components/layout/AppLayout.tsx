import { TopBar } from './TopBar';
import { RightPanel } from './LeftPanel';
import { EntityListPanel } from '@/components/panels/EntityListPanel';
import { UnfoldingPanel } from '@/components/views/UnfoldingPanel';
import { ThreeViewPanel } from '@/components/views/ThreeViewPanel';
import { useUIStore } from '@/editor';
import { COLORS } from '@/styles/tokens';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const unfoldingEnabled = useUIStore((s) => s.unfoldingEnabled);
  const threeViewEnabled = useUIStore((s) => s.threeViewEnabled);

  const middleColumnVisible = unfoldingEnabled || threeViewEnabled;

  return (
    <div className="flex flex-col w-full h-full">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧实体列表面板 */}
        <EntityListPanel />

        {/* 3D 场景 */}
        <main className="relative" style={{ flex: '1 1 0%', minWidth: 0 }}>
          {children}
        </main>

        {/* 中间列：展开图 + 三视图（上下分割） */}
        {middleColumnVisible && (
          <div
            className="flex flex-col border-l"
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              borderColor: COLORS.border,
            }}
          >
            {unfoldingEnabled && (
              <div style={{ flex: '1 1 0%', minHeight: 0, borderBottom: threeViewEnabled ? `1px solid ${COLORS.border}` : undefined }}>
                <UnfoldingPanel />
              </div>
            )}
            {threeViewEnabled && (
              <div style={{ flex: '1 1 0%', minHeight: 0 }}>
                <ThreeViewPanel />
              </div>
            )}
          </div>
        )}

        {/* 右侧参数面板（原 LeftPanel） */}
        <RightPanel />
      </div>
    </div>
  );
}
