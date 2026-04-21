import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { useSimulationStore } from '@/editor/store';
import type { MeetingProblemParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: MeetingProblemParams;
}

export function MeetingProblemInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>约定时间段 T (分钟)</span>
          <EditableNumber value={params.T} min={10} max={120} step={5}
            onChange={v => {
              const newT = Math.min(params.t, v - 1);
              updateParams(simId, { T: v, t: newT } as Partial<MeetingProblemParams>);
            }} />
        </div>
        <Slider
          value={[params.T]}
          min={10}
          max={120}
          step={5}
          onValueChange={([v]) => {
            const newT = Math.min(params.t, v - 1);
            updateParams(simId, { T: v, t: newT } as Partial<MeetingProblemParams>);
          }}
        />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>10</span><span>120</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>等待时间 t (分钟)</span>
          <EditableNumber value={params.t} min={1} max={params.T - 1} step={1}
            onChange={v => updateParams(simId, { t: v } as Partial<MeetingProblemParams>)} />
        </div>
        <Slider
          value={[params.t]}
          min={1}
          max={params.T - 1}
          step={1}
          onValueChange={([v]) => updateParams(simId, { t: v } as Partial<MeetingProblemParams>)}
        />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>1</span><span>{params.T - 1}</span>
        </div>
      </div>

      <ScaleNSlider label="模拟次数 (n)" value={params.n} min={100}
        onChange={v => updateParams(simId, { n: v } as Partial<MeetingProblemParams>)} />

      <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.infoLight }}>
        <span style={{ fontSize: 14, color: COLORS.info }}>
          理论概率: {(1 - (1 - params.t / params.T) ** 2).toFixed(4)}
        </span>
      </div>
    </div>
  );
}
