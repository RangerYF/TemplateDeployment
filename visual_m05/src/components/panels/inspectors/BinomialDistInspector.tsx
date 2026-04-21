import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import type { BinomialDistParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: BinomialDistParams;
}

export function BinomialDistInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const sim = useSimulationStore(s => s.simulations[simId]);

  const handleChange = (newParams: Partial<BinomialDistParams>) => {
    updateParams(simId, newParams as Partial<BinomialDistParams>);
    if (sim) {
      const merged = { ...sim.params, ...newParams };
      const cmd = new RunSimulationCommand(simId, 'binomialDist', merged);
      useHistoryStore.getState().execute(cmd);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>试验次数 n</span>
          <EditableNumber value={params.n} min={1} max={50} step={1}
            onChange={v => handleChange({ n: v })} />
        </div>
        <Slider
          value={[params.n]}
          min={1}
          max={50}
          step={1}
          onValueChange={([v]) => handleChange({ n: v })}
        />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>1</span><span>50</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>成功概率 p</span>
          <EditableNumber value={params.p} min={0.01} max={0.99} step={0.01}
            format={v => v.toFixed(2)} onChange={v => handleChange({ p: v })} />
        </div>
        <Slider
          value={[Math.round(params.p * 100)]}
          min={1}
          max={99}
          step={1}
          onValueChange={([v]) => handleChange({ p: v / 100 })}
        />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>0.01</span><span>0.99</span>
        </div>
      </div>

      <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.primaryLight }}>
        <span style={{ fontSize: 14, color: COLORS.primary }}>
          B({params.n}, {params.p.toFixed(2)}) — E(X) = {(params.n * params.p).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
