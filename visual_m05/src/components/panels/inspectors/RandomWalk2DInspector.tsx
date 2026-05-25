import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { useSimulationStore } from '@/editor/store';
import type { RandomWalk2DParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: RandomWalk2DParams;
  hideN?: boolean;
}

export function RandomWalk2DInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const set = (p: Partial<RandomWalk2DParams>) => updateParams(simId, p as Partial<RandomWalk2DParams>);

  return (
    <div className="flex flex-col gap-4">
      {!hideN && <ScaleNSlider label="模拟次数 (n)" value={params.n} min={50} onChange={v => set({ n: v })} />}

      <div>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>步数</span>
          <EditableNumber value={params.steps} min={10} max={2000} step={10}
            onChange={v => set({ steps: v })} />
        </div>
        <Slider value={[params.steps]} min={10} max={1000} step={10}
          onValueChange={([v]) => set({ steps: v })} />
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
        💡 二维对称随机游走的终点距离均值 E[√(x²+y²)] ≈ √(πn/2)，可见模拟值收敛于理论值。
      </div>
    </div>
  );
}
