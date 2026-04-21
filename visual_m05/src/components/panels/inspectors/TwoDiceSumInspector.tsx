import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { COLORS } from '@/styles/tokens';
import { useSimulationStore } from '@/editor/store';
import type { TwoDiceSumParams } from '@/types/simulation';

interface Props { simId: string; params: TwoDiceSumParams; hideN?: boolean; }

export function TwoDiceSumInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const set = (p: Partial<TwoDiceSumParams>) => updateParams(simId, p as Partial<TwoDiceSumParams>);
  const minSum = params.diceCount;
  const maxSum = params.diceCount * 6;

  return (
    <div className="flex flex-col gap-4">
      {!hideN && (
        <ScaleNSlider label="投掷轮数 (n)" value={params.n} min={20} onChange={v => set({ n: v })} />
      )}

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>骰子数量</span>
          <EditableNumber value={params.diceCount} min={2} max={10} step={1}
            format={v => `${v} 个`} onChange={v => set({ diceCount: v })} />
        </div>
        <Slider value={[params.diceCount]} min={2} max={10} step={1}
          onValueChange={([v]) => set({ diceCount: v })} />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>2</span><span>10</span>
        </div>
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>
          点数和范围：{minSum} ~ {maxSum}（共 {maxSum - minSum + 1} 种）
        </div>
      </div>
    </div>
  );
}
