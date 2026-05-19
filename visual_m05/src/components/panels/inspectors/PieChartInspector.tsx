import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { DataSourceEditor } from '@/components/ui/data-source-editor';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import type { PieChartParams, DataSpec } from '@/types/simulation';

interface Props {
  simId: string;
  params: PieChartParams;
}

export function PieChartInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const sim = useSimulationStore(s => s.simulations[simId]);

  const handleChange = (newParams: Partial<PieChartParams>) => {
    updateParams(simId, newParams as Partial<PieChartParams>);
    if (sim) {
      const merged = { ...sim.params, ...newParams } as PieChartParams;
      const cmd = new RunSimulationCommand(simId, 'pieChart', merged);
      useHistoryStore.getState().execute(cmd);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DataSourceEditor spec={params.dataSpec} onChange={(dataSpec: DataSpec) => handleChange({ dataSpec })} />

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>分组数</span>
          <EditableNumber value={params.binCount} min={2} max={10} step={1}
            onChange={v => handleChange({ binCount: v })} />
        </div>
        <Slider value={[params.binCount]} min={2} max={10} step={1}
          onValueChange={([v]) => handleChange({ binCount: v })} />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>2</span><span>10</span>
        </div>
      </div>

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>按频数降序排列</span>
        <input
          type="checkbox"
          checked={params.sortByValue}
          onChange={e => handleChange({ sortByValue: e.target.checked })}
          style={{ width: 16, height: 16, accentColor: COLORS.primary }}
        />
      </label>
    </div>
  );
}
