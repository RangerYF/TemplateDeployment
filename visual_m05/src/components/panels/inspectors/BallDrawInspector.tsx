import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { Switch } from '@/components/ui/switch';
import { COLORS } from '@/styles/tokens';
import { useSimulationStore } from '@/editor/store';
import type { BallDrawParams } from '@/types/simulation';

interface Props { simId: string; params: BallDrawParams; hideN?: boolean; }

export function BallDrawInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const maxDraw = params.redCount + params.whiteCount;

  return (
    <div className="flex flex-col gap-4">
      {!hideN && (
        <ScaleNSlider label="模拟次数 (n)" value={params.n} min={100}
          onChange={v => updateParams(simId, { n: v } as Partial<BallDrawParams>)} />
      )}
      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>红球数量</span>
          <EditableNumber value={params.redCount} min={1} max={50} step={1} color={COLORS.error}
            onChange={v => {
              const newMax = v + params.whiteCount;
              updateParams(simId, { redCount: v, drawCount: Math.min(params.drawCount, newMax) } as Partial<BallDrawParams>);
            }} />
        </div>
        <Slider value={[params.redCount]} min={1} max={50} step={1}
          onValueChange={([v]) => {
            const newMax = v + params.whiteCount;
            updateParams(simId, { redCount: v, drawCount: Math.min(params.drawCount, newMax) } as Partial<BallDrawParams>);
          }} />
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>白球数量</span>
          <EditableNumber value={params.whiteCount} min={1} max={50} step={1} color={COLORS.textSecondary}
            onChange={v => {
              const newMax = params.redCount + v;
              updateParams(simId, { whiteCount: v, drawCount: Math.min(params.drawCount, newMax) } as Partial<BallDrawParams>);
            }} />
        </div>
        <Slider value={[params.whiteCount]} min={1} max={50} step={1}
          onValueChange={([v]) => {
            const newMax = params.redCount + v;
            updateParams(simId, { whiteCount: v, drawCount: Math.min(params.drawCount, newMax) } as Partial<BallDrawParams>);
          }} />
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>每次取球数</span>
          <EditableNumber value={params.drawCount} min={1} max={maxDraw} step={1}
            onChange={v => updateParams(simId, { drawCount: v } as Partial<BallDrawParams>)} />
        </div>
        <Slider value={[params.drawCount]} min={1} max={maxDraw} step={1}
          onValueChange={([v]) => updateParams(simId, { drawCount: v } as Partial<BallDrawParams>)} />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>1</span><span>{maxDraw}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>有放回取球</span>
        <Switch checked={params.replace}
          onCheckedChange={v => updateParams(simId, { replace: v } as Partial<BallDrawParams>)} />
      </div>

      <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.bgMuted }}>
        <span style={{ fontSize: 14, color: COLORS.textMuted }}>
          袋中共 {params.redCount + params.whiteCount} 个球，取 {params.drawCount} 个
          ({params.replace ? '有放回' : '无放回'})
        </span>
      </div>
    </div>
  );
}
