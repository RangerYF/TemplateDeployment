import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { TopBar, type TopBarTab, type TopBarModeSwitch, type TopBarModuleSelector } from './TopBar';

export interface AppLayoutProps {
  title: string;
  tabs?: TopBarTab[];
  activeTabId?: string;
  onSelectTab?: (id: string) => void;
  onBack?: () => void;
  /** Right-sidebar content (params + readouts). */
  sidebar: ReactNode;
  /** Main canvas area. */
  children: ReactNode;
  /** Optional bottom timeline bar (shown for scenes with a duration). */
  timeline?: ReactNode;
  /** Optional page background (e.g. P08 per-module gradient). */
  pageStyle?: CSSProperties;
  /** Mode switch control (预设场景 / 自由搭建). */
  modeSwitch?: TopBarModeSwitch;
  /** Module dropdown selector. */
  moduleSelector?: TopBarModuleSelector;
}

/**
 * P09 风格运行时布局:顶栏 + 中央画布 + 右侧 320px 侧栏(<1024px 收为滑入抽屉)+ 底部时间轴槽。
 * 2D-only(去掉 P09 的 2D/3D 门控)。
 */
export function AppLayout({
  title,
  tabs,
  activeTabId,
  onSelectTab,
  onBack,
  sidebar,
  children,
  timeline,
  pageStyle,
  modeSwitch,
  moduleSelector,
}: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--theme-bg)', ...pageStyle }}
    >
      <TopBar
        title={title}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        onBack={onBack}
        modeSwitch={modeSwitch}
        moduleSelector={moduleSelector}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}

          {/* 移动端浮动按钮(仅 <lg 显示) */}
          <button
            className="lg:hidden absolute bottom-20 right-4 z-[58] flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-lg"
            style={{
              background: 'var(--theme-panel-bg)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
            onClick={() => setDrawerOpen(true)}
            aria-label="打开参数面板"
          >
            ⚙
          </button>
        </main>

        {/* 桌面右侧栏 */}
        <aside
          className="hidden shrink-0 overflow-y-auto border-l lg:block"
          style={{
            width: 320,
            borderColor: 'var(--theme-border)',
            background: 'var(--theme-panel-bg)',
          }}
        >
          {sidebar}
        </aside>
      </div>

      {timeline}

      {/* 移动端抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.42)' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute right-0 top-0 h-full overflow-y-auto shadow-xl"
            style={{
              width: 'min(320px, 85vw)',
              background: 'var(--theme-panel-bg)',
              borderLeft: '1px solid var(--theme-border)',
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
                参数与读数
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ background: 'var(--theme-surface-hover)', color: 'var(--theme-text-secondary)' }}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
