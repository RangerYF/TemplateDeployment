/**
 * 可折叠面板容器 — 对齐 visual_template 风格
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { COLORS } from '@/styles/tokens';

interface PanelSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function PanelSection({ id, title, children, defaultOpen = true }: PanelSectionProps) {
  const collapsed = useUIStore(s => s.panelCollapsed[id] ?? !defaultOpen);
  const togglePanel = useUIStore(s => s.togglePanel);

  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <button
        className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors"
        style={{
          color: COLORS.text,
          background: collapsed ? 'transparent' : COLORS.bgMuted,
        }}
        onClick={() => togglePanel(id)}
      >
        <span>{title}</span>
        {collapsed ? (
          <ChevronRight size={14} color={COLORS.textMuted} />
        ) : (
          <ChevronDown size={14} color={COLORS.textMuted} />
        )}
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}
