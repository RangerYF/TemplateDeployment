import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { useSimulationStore } from '@/editor/store';
import type { RandomWalk1DParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: RandomWalk1DParams;
  hideN?: boolean;
}

export function RandomWalk1DInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const set = (p: Partial<RandomWalk1DParams>) => updateParams(simId, p as Partial<RandomWalk1DParams>);

  return (
    <div className="flex flex-col gap-4">
      {!hideN && <ScaleNSlider label="模拟次数 (n)" value={params.n} min={50} onChange={v => set({ n: v })} />}

      <div>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>步数</span>
          <EditableNumber value={params.steps} min={2} max={1000} step={1}
            onChange={v => set({ steps: v })} />
        </div>
        <Slider value={[params.steps]} min={2} max={500} step={1}
          onValueChange={([v]) => set({ steps: v })} />
      </div>

      <div>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>向右概率 p</span>
          <EditableNumber value={params.pRight} min={0} max={1} step={0.05}
            format={v => v.toFixed(2)}
            onChange={v => set({ pRight: v })} />
        </div>
        <Slider value={[params.pRight * 100]} min={0} max={100} step={5}
          onValueChange={([v]) => set({ pRight: v / 100 })} />
      </div>

      <div>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>展示路径数</span>
          <EditableNumber value={params.numPaths} min={1} max={6} step={1}
            onChange={v => set({ numPaths: v })} />
        </div>
        <Slider value={[params.numPaths]} min={1} max={6} step={1}
          onValueChange={([v]) => set({ numPaths: v })} />
      </div>

      <div className="p-2 rounded text-xs" style={{ backgroundColor: COLORS.primaryLight, color: COLORS.primary, fontSize: 12 }}>
        💡 终点分布与二项分布 B(n, p) 对照：E[X]=n·(2p-1)，σ=2√(n·p·(1-p))
      </div>
    </div>
  );
}
