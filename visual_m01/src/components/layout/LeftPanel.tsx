import { useState } from 'react';
import { COLORS } from '@/styles/tokens';
import { ParameterPanel } from '@/components/panels/ParameterPanel';
import { AuxiliaryTools } from '@/components/panels/AuxiliaryTools';
import { CoordSystemPanel } from '@/components/panels/CoordSystemPanel';
import { InspectorPanel } from '@/components/panels/inspectors';

interface PanelSectionProps {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}

function PanelSection({ title, children, defaultOpen = true }: PanelSectionProps) {
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

export function RightPanel() {
  return (
    <div
      className="w-[280px] min-w-[280px] h-full flex flex-col border-l"
      style={{
        borderColor: COLORS.border,
        backgroundColor: COLORS.bg,
      }}
    >
      {/* 可滚动面板区域 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <PanelSection title="实体属性">
          <InspectorPanel />
        </PanelSection>
        <PanelSection title="参数设置">
          <ParameterPanel />
        </PanelSection>
        <PanelSection title="坐标系">
          <CoordSystemPanel />
        </PanelSection>
        <PanelSection title="辅助功能">
          <AuxiliaryTools />
        </PanelSection>
      </div>
    </div>
  );
}
