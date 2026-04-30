import { useState } from 'react';
import { COLORS } from '@/styles/tokens';

interface PanelSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function PanelSection({ title, children, defaultOpen = true }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors"
        style={{
          color: COLORS.text,
          background: open ? COLORS.bgMuted : 'transparent',
        }}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span className="text-xs" style={{ color: COLORS.textMuted }}>
          {open ? '▼' : '›'}
        </span>
      </button>
      {open && <div className="px-4 pb-3 pt-1">{children}</div>}
    </section>
  );
}
