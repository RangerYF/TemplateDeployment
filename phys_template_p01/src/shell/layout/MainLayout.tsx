import type { ReactNode } from 'react';

export interface MainLayoutProps {
  leftPanel: ReactNode;
  canvas: ReactNode;
  rightPanel: ReactNode;
  timeline: ReactNode;
  pageStyle?: React.CSSProperties;
  topRowStyle?: React.CSSProperties;
}

/**
 * 三栏布局容器 + 底部时间轴
 */
export function MainLayout({
  leftPanel,
  canvas,
  rightPanel,
  timeline,
  pageStyle,
  topRowStyle,
}: MainLayoutProps) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={pageStyle}>
      {/* 上方三栏 */}
      <div className="flex flex-1 overflow-hidden" style={topRowStyle}>
        {leftPanel}
        {canvas}
        {rightPanel}
      </div>

      {/* 底部时间轴 */}
      {timeline}
    </div>
  );
}
