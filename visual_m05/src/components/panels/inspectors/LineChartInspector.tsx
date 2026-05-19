import { COLORS } from '@/styles/tokens';
import { DataSourceEditor } from '@/components/ui/data-source-editor';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import type { LineChartParams, DataSpec } from '@/types/simulation';

interface Props {
  simId: string;
  params: LineChartParams;
}

export function LineChartInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const sim = useSimulationStore(s => s.simulations[simId]);

  const handleChange = (newParams: Partial<LineChartParams>) => {
    updateParams(simId, newParams as Partial<LineChartParams>);
    if (sim) {
      const merged = { ...sim.params, ...newParams } as LineChartParams;
      const cmd = new RunSimulationCommand(simId, 'lineChart', merged);
      useHistoryStore.getState().execute(cmd);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DataSourceEditor spec={params.dataSpec} onChange={(dataSpec: DataSpec) => handleChange({ dataSpec })} />

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>显示线性趋势线</span>
        <input
          type="checkbox"
          checked={params.showTrend}
          onChange={e => handleChange({ showTrend: e.target.checked })}
          style={{ width: 16, height: 16, accentColor: COLORS.primary }}
        />
      </label>

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>显示数据点</span>
        <input
          type="checkbox"
          checked={params.showMarkers}
          onChange={e => handleChange({ showMarkers: e.target.checked })}
          style={{ width: 16, height: 16, accentColor: COLORS.primary }}
        />
      </label>
    </div>
  );
}
