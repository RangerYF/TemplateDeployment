import { useState, type ReactNode } from 'react';
import { COLORS } from '@/styles/tokens';
import { useCrystalStore } from '@/store';
import { CrystalInfoPanel } from './CrystalInfoPanel';
import { RenderControlPanel } from './RenderControlPanel';
import { CoordinationPanel } from './CoordinationPanel';
import { FractionalCoordsPanel } from './FractionalCoordsPanel';
import { TeachingPointsPanel } from './TeachingPointsPanel';
import { PackingControlPanel } from './PackingControlPanel';
import { BondLegendPanel } from './BondLegendPanel';

// ---------------------------------------------------------------------------
// PanelSection — collapsible panel section (shared pattern from visual_template)
// ---------------------------------------------------------------------------

interface PanelSectionProps {
  title: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}

export function PanelSection({ title, children, defaultOpen = true }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b" style={{ borderColor: COLORS.border }}>
      <button
        className="w-full flex items-center justify-between py-2.5 px-4"
        onClick={() => setOpen(!open)}
        style={{ background: 'transparent' }}
      >
        <h3
          className="text-sm font-semibold tracking-wider"
          style={{ color: COLORS.text }}
        >
          {title}
        </h3>
        <span
          className="text-xs"
          style={{
            color: COLORS.textPlaceholder,
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s',
          }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {children || (
            <div className="flex items-center justify-center min-h-[60px]">
              <span className="text-xs" style={{ color: COLORS.textPlaceholder }}>
                暂无内容
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RightPanel
// ---------------------------------------------------------------------------

export function RightPanel() {
  const activeTab = useCrystalStore((s) => s.activeTab);
  const highlightedAtomIdx = useCrystalStore((s) => s.highlightedAtomIdx);
  const showBonds = useCrystalStore((s) => s.showBonds);

  return (
    <div
      className="w-[280px] min-w-[280px] h-full flex flex-col border-l"
      style={{
        borderColor: COLORS.border,
        backgroundColor: COLORS.bg,
      }}
    >
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'crystal' ? (
          <>
            <PanelSection title="晶体信息">
              <CrystalInfoPanel />
            </PanelSection>

            <PanelSection title="渲染控制">
              <RenderControlPanel />
            </PanelSection>

            {highlightedAtomIdx !== null && (
              <PanelSection title="配位信息">
                <CoordinationPanel />
              </PanelSection>
            )}

            {showBonds && (
              <PanelSection title="化学键图例" defaultOpen={false}>
                <BondLegendPanel />
              </PanelSection>
            )}

            <PanelSection title="分数坐标" defaultOpen={false}>
              <FractionalCoordsPanel />
            </PanelSection>

            <PanelSection title="教学要点">
              <TeachingPointsPanel />
            </PanelSection>
          </>
        ) : (
          <PanelSection title="堆积控制">
            <PackingControlPanel />
          </PanelSection>
        )}
      </div>
    </div>
  );
}
