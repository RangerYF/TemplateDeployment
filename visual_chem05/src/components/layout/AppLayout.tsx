import type { ReactNode } from 'react';
import { COLORS } from '@/styles/tokens';
import { TopBar } from './TopBar';
import { CrystalListPanel } from '@/components/panels/CrystalListPanel';
import { RightPanel } from '@/components/panels/RightPanel';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{ backgroundColor: COLORS.bgPage }}
    >
      {/* Top bar */}
      <TopBar />

      {/* Three-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Crystal list panel (220px) */}
        <CrystalListPanel />

        {/* Center: 3D scene (flex-1) */}
        <div className="flex-1 min-w-0 relative">
          {children}
        </div>

        {/* Right: Info + controls panel (280px) */}
        <RightPanel />
      </div>
    </div>
  );
}
