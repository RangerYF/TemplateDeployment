import { useFunctionStore } from '@/editor/store/functionStore';
import { Switch } from '@/components/ui/switch';
import { ViewportPanel } from '@/components/panels/ViewportPanel';
import { COLORS } from '@/styles/colors';

export function CanvasSettingsPanel() {
  const showGrid = useFunctionStore((s) => s.features.showGrid);
  const showAxisLabels = useFunctionStore((s) => s.features.showAxisLabels);
  const setFeature = useFunctionStore((s) => s.setFeature);

  return (
    <div>
      {/* Section heading */}
      <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary }}>
        画布设置
      </span>

      {/* Display toggles */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: COLORS.textSecondary }}>显示网格</span>
          <Switch checked={showGrid} onCheckedChange={(v) => setFeature('showGrid', v)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: COLORS.textSecondary }}>坐标刻度</span>
          <Switch checked={showAxisLabels} onCheckedChange={(v) => setFeature('showAxisLabels', v)} />
        </div>
      </div>

      {/* Divider */}
      <hr
        style={{
          border: 'none',
          borderTop: `1px solid ${COLORS.border}`,
          margin: '12px 0',
        }}
      />

      {/* Viewport range controls */}
      <ViewportPanel />
    </div>
  );
}
