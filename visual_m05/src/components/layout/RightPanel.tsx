import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { COLORS, SHADOWS } from '@/styles/tokens';
import { ControlPanel } from '@/components/panels/ControlPanel';
import { InspectorPanel } from '@/components/panels/inspectors/InspectorPanel';
import { ResultsPanel } from '@/components/panels/ResultsPanel';

interface PanelSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function PanelSection({ title, children, defaultOpen = true }: PanelSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="border-b" style={{ borderColor: COLORS.border }}>
      <button
        className="flex items-center justify-between w-full px-4 py-2.5 text-left"
        onClick={() => setOpen(v => !v)}
        style={{ backgroundColor: COLORS.bgPage }}
      >
        <span className="font-semibold tracking-wider" style={{ color: COLORS.textSecondary, fontSize: 14 }}>
          {title}
        </span>
        {open
          ? <ChevronDown size={14} color={COLORS.textMuted} />
          : <ChevronRight size={14} color={COLORS.textMuted} />
        }
      </button>
      {open && (
        <div className="px-3 py-3" style={{ backgroundColor: COLORS.bg }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function RightPanel({ width = 280 }: { width?: number }) {
  return (
    <div
      className="flex flex-col h-full overflow-y-auto shrink-0"
      style={{
        width,
        backgroundColor: COLORS.bg,
        boxShadow: SHADOWS.md,
      }}
    >
      <PanelSection title="模拟控制">
        <ControlPanel />
      </PanelSection>

      <PanelSection title="参数设置">
        <InspectorPanel />
      </PanelSection>

      <PanelSection title="统计结果" defaultOpen={true}>
        <ResultsPanel />
      </PanelSection>
    </div>
  );
}
