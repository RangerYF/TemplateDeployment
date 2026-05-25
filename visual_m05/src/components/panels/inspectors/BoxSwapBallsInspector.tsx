import { COLORS } from '@/styles/tokens';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { useSimulationStore } from '@/editor/store';
import type { BoxSwapBallsParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: BoxSwapBallsParams;
  hideN?: boolean;
}

export function BoxSwapBallsInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const set = (p: Partial<BoxSwapBallsParams>) => updateParams(simId, p as Partial<BoxSwapBallsParams>);

  return (
    <div className="flex flex-col gap-4">
      {!hideN && <ScaleNSlider label="模拟轮数 (n)" value={params.n} min={10} onChange={v => set({ n: v })} />}

      <div>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>每盒初始黑球数</span>
          <EditableNumber value={params.initBlack} min={1} max={5} step={1}
            onChange={v => set({ initBlack: v })} />
        </div>
        <Slider value={[params.initBlack]} min={1} max={5} step={1}
          onValueChange={([v]) => set({ initBlack: v })} />
      </div>

      <div>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>每盒初始红球数</span>
          <EditableNumber value={params.initRed} min={1} max={8} step={1}
            onChange={v => set({ initRed: v })} />
        </div>
        <Slider value={[params.initRed]} min={1} max={8} step={1}
          onValueChange={([v]) => set({ initRed: v })} />
      </div>

      <div>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>操作次数</span>
          <EditableNumber value={params.operations} min={1} max={30} step={1}
            onChange={v => set({ operations: v })} />
        </div>
        <Slider value={[params.operations]} min={1} max={30} step={1}
          onValueChange={([v]) => set({ operations: v })} />
      </div>

      {params.initBlack === 1 && params.initRed === 2 && (
        <div className="p-2 rounded text-xs"
          style={{ backgroundColor: COLORS.primaryLight, color: COLORS.primary, fontSize: 12 }}>
          💡 当前为 1黑+2红 默认配置，可对照理论公式 P(Bₙ) = 3/5 + (2/5)·(-1/9)ⁿ。
        </div>
      )}
    </div>
  );
}
