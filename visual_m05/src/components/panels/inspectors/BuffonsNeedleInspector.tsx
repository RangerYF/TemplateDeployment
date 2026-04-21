import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { useSimulationStore } from '@/editor/store';
import type { BuffonsNeedleParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: BuffonsNeedleParams;
}

export function BuffonsNeedleInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const actualL = Math.min(params.needleLength, params.lineSpacing);
  const theoreticalProb = (2 * actualL) / (Math.PI * params.lineSpacing);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>针的长度 l</span>
          <EditableNumber value={params.needleLength} min={0.1} max={params.lineSpacing} step={0.1}
            format={v => v.toFixed(1)}
            onChange={v => updateParams(simId, { needleLength: v } as Partial<BuffonsNeedleParams>)} />
        </div>
        <Slider
          value={[params.needleLength * 10]}
          min={1}
          max={params.lineSpacing * 10}
          step={1}
          onValueChange={([v]) => updateParams(simId, { needleLength: v / 10 } as Partial<BuffonsNeedleParams>)}
        />
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>线间距 d</span>
          <EditableNumber value={params.lineSpacing} min={1.0} max={5.0} step={0.5}
            format={v => v.toFixed(1)}
            onChange={v => updateParams(simId, { lineSpacing: v } as Partial<BuffonsNeedleParams>)} />
        </div>
        <Slider
          value={[params.lineSpacing * 10]}
          min={10}
          max={50}
          step={5}
          onValueChange={([v]) => updateParams(simId, { lineSpacing: v / 10 } as Partial<BuffonsNeedleParams>)}
        />
      </div>

      <ScaleNSlider label="投针次数 (n)" value={params.n} min={100}
        onChange={v => updateParams(simId, { n: v } as Partial<BuffonsNeedleParams>)} />

      <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.infoLight }}>
        <span style={{ fontSize: 14, color: COLORS.info }}>
          理论穿越概率: 2l/(πd) = {theoreticalProb.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
