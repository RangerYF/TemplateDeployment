import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { Switch } from '@/components/ui/switch';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import type { NormalDistParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: NormalDistParams;
}

export function NormalDistInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const sim = useSimulationStore(s => s.simulations[simId]);

  const handleChange = (newParams: Partial<NormalDistParams>) => {
    updateParams(simId, newParams as Partial<NormalDistParams>);
    if (sim) {
      const merged = { ...sim.params, ...newParams };
      const cmd = new RunSimulationCommand(simId, 'normalDist', merged);
      useHistoryStore.getState().execute(cmd);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>均值 μ</span>
          <EditableNumber value={params.mu} min={-10} max={10} step={0.5}
            onChange={v => handleChange({ mu: v })} />
        </div>
        <Slider
          value={[params.mu + 10]}
          min={0}
          max={20}
          step={0.5}
          onValueChange={([v]) => handleChange({ mu: v - 10 })}
        />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>-10</span><span>10</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>标准差 σ</span>
          <EditableNumber value={params.sigma} min={0.1} max={5.0} step={0.1}
            format={v => v.toFixed(1)} onChange={v => handleChange({ sigma: v })} />
        </div>
        <Slider
          value={[params.sigma * 10]}
          min={1}
          max={50}
          step={1}
          onValueChange={([v]) => handleChange({ sigma: v / 10 })}
        />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>0.1</span><span>5.0</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>显示σ区间</span>
        <Switch
          checked={params.showSigmaRegions}
          onCheckedChange={v => handleChange({ showSigmaRegions: v })}
        />
      </div>
    </div>
  );
}
