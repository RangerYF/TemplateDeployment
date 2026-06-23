import type { ParamSchema, ParamValues } from '@/core/types';
import { PanelErrorBoundary } from '@/shell/components/PanelErrorBoundary';
import { ParamPanel } from './ParamPanel';
import { DisplayControlsSection } from './DisplayControlsSection';
import { InfoPanel } from './InfoPanel';

export interface RightSidebarProps {
  schemas: ParamSchema[];
  values: ParamValues;
  onValueChange: (key: string, value: number | boolean | string) => void;
  presetId?: string;
}

const headingClass = 'mb-3 text-xs font-semibold uppercase tracking-wider';
const headingStyle = { color: 'var(--theme-text-muted)', letterSpacing: '0.06em' } as const;

/**
 * P09 风格右侧栏:把"参数设置"(原左栏)与"实时读数"(原右栏)合并为单列分区。
 * 各分区用 border-b + p-4 分隔、12px 大写 muted 小标题。
 */
export function RightSidebar({ schemas, values, onValueChange, presetId }: RightSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <section className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
        <h3 className={headingClass} style={headingStyle}>参数设置</h3>
        <PanelErrorBoundary title="参数面板" compact>
          <ParamPanel
            variant="sidebar"
            schemas={schemas}
            values={values}
            onValueChange={onValueChange}
            presetId={presetId}
          />
        </PanelErrorBoundary>
      </section>

      {presetId && (
        <section className="border-b p-4" style={{ borderColor: 'var(--theme-border)' }}>
          <PanelErrorBoundary title="显示设置" compact>
            <DisplayControlsSection presetId={presetId} />
          </PanelErrorBoundary>
        </section>
      )}

      <section className="p-4">
        <h3 className={headingClass} style={headingStyle}>实时读数</h3>
        <PanelErrorBoundary title="实时读数" compact>
          <InfoPanel variant="sidebar" presetId={presetId} />
        </PanelErrorBoundary>
      </section>
    </div>
  );
}
