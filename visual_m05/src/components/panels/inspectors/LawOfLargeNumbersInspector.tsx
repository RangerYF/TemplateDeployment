import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { Select } from '@/components/ui/select';
import { useSimulationStore } from '@/editor/store';
import type { LawOfLargeNumbersParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: LawOfLargeNumbersParams;
}

export function LawOfLargeNumbersInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5" style={{ fontSize: 14, color: COLORS.textSecondary }}>场景</div>
        <Select
          value={params.scenario}
          onChange={e => updateParams(simId, { scenario: e.target.value as LawOfLargeNumbersParams['scenario'] } as Partial<LawOfLargeNumbersParams>)}
          options={[
            { value: 'coinFlip', label: '抛硬币（p=0.5）' },
            { value: 'diceRoll', label: '掷骰子点1（p=1/6）' },
            { value: 'ballDraw', label: '摸球（p=3/8）' },
          ]}
        />
      </div>

      <ScaleNSlider label="最大试验次数" value={params.maxN} min={100}
        onChange={v => updateParams(simId, { maxN: v } as Partial<LawOfLargeNumbersParams>)} />

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>曲线数量</span>
          <EditableNumber value={params.numCurves} min={1} max={5} step={1}
            onChange={v => updateParams(simId, { numCurves: v } as Partial<LawOfLargeNumbersParams>)} />
        </div>
        <Slider
          value={[params.numCurves]}
          min={1}
          max={5}
          step={1}
          onValueChange={([v]) => updateParams(simId, { numCurves: v } as Partial<LawOfLargeNumbersParams>)}
        />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>1</span><span>5</span>
        </div>
      </div>
    </div>
  );
}
