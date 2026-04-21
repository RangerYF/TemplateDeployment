import { COLORS } from '@/styles/tokens';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import { REGRESSION_DATASETS } from '@/types/simulation';
import type { LinearRegressionParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: LinearRegressionParams;
}

export function LinearRegressionInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const sim = useSimulationStore(s => s.simulations[simId]);

  const handleChange = (newParams: Partial<LinearRegressionParams>) => {
    updateParams(simId, newParams as Partial<LinearRegressionParams>);
    if (sim) {
      const merged = { ...sim.params, ...newParams };
      const cmd = new RunSimulationCommand(simId, 'linearRegression', merged);
      useHistoryStore.getState().execute(cmd);
    }
  };

  const currentDataset = REGRESSION_DATASETS.find(d => d.id === params.datasetId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5" style={{ fontSize: 14, color: COLORS.textSecondary }}>数据集</div>
        <Select
          value={params.datasetId}
          onChange={e => handleChange({ datasetId: e.target.value })}
          options={REGRESSION_DATASETS.map(d => ({ value: d.id, label: d.name }))}
        />
        {currentDataset && (
          <div className="mt-1" style={{ fontSize: 14, color: COLORS.textMuted }}>
            {currentDataset.description} — {currentDataset.points.length} 个数据点
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>显示残差</span>
        <Switch
          checked={params.showResiduals}
          onCheckedChange={v => handleChange({ showResiduals: v })}
        />
      </div>
    </div>
  );
}
