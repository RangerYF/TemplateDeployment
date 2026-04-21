import type { ReactNode } from 'react';

export interface MainLayoutProps {
  leftPanel: ReactNode;
  canvas: ReactNode;
  rightPanel: ReactNode;
  timeline: ReactNode;
}

/**
 * 三栏布局容器 + 底部时间轴
 */
export function MainLayout({ leftPanel, canvas, rightPanel, timeline }: MainLayoutProps) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* 上方三栏 */}
      <div className="flex flex-1 overflow-hidden">
        {leftPanel}
        {canvas}
        {rightPanel}
      </div>

      {/* 底部时间轴 */}
      {timeline}
    </div>
  );
}
