import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { COLORS, SHADOWS } from '@/styles/tokens';

interface PanelCardProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}

export function PanelCard({ title, subtitle, right, children }: PanelCardProps) {
  return (
    <Card
      variant="default"
      className="p-0"
      style={{ borderColor: COLORS.border, boxShadow: SHADOWS.md, cursor: 'default' }}
    >
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: COLORS.border }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: COLORS.text }}>{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}
