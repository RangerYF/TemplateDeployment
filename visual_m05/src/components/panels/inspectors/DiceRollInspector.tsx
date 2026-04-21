import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { COLORS } from '@/styles/tokens';
import { useSimulationStore } from '@/editor/store';
import type { DiceRollParams } from '@/types/simulation';

interface Props { simId: string; params: DiceRollParams; hideN?: boolean; }

const EVENT_OPTIONS = [
  { value: 'all', label: '所有点数' },
  { value: 'odd', label: '奇数点' },
  { value: 'even', label: '偶数点' },
  { value: 'gte', label: '≥ n 点' },
] as const;

export function DiceRollInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const set = (p: Partial<DiceRollParams>) => updateParams(simId, p as Partial<DiceRollParams>);

  return (
    <div className="flex flex-col gap-4">
      {!hideN && (
        <ScaleNSlider label="投掷轮数 (n)" value={params.n} min={10} onChange={v => set({ n: v })} />
      )}

      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>骰子数量</span>
          <EditableNumber value={params.diceCount} min={1} max={10} step={1}
            format={v => `${v} 个`} onChange={v => set({ diceCount: v })} />
        </div>
        <Slider value={[params.diceCount]} min={1} max={10} step={1}
          onValueChange={([v]) => set({ diceCount: v })} />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>1</span><span>10</span>
        </div>
        {!hideN && (
          <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>
            总观测次数 = {params.n} × {params.diceCount} = {(params.n * params.diceCount).toLocaleString()}
          </div>
        )}
      </div>

      {/* Event filter */}
      <div>
        <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>统计事件</div>
        <div className="flex flex-col gap-1">
          {EVENT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set({ event: opt.value })}
              className="flex items-center gap-2 px-2 py-1 rounded text-left"
              style={{
                backgroundColor: params.event === opt.value ? COLORS.primaryLight : 'transparent',
                border: `1px solid ${params.event === opt.value ? COLORS.primary : COLORS.border}`,
                color: params.event === opt.value ? COLORS.primary : COLORS.textSecondary,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: params.event === opt.value ? COLORS.primary : COLORS.border,
                flexShrink: 0,
              }} />
              {opt.label}
            </button>
          ))}
        </div>
        {params.event === 'gte' && (
          <div className="flex justify-between mt-2 mb-1">
            <span style={{ fontSize: 14, color: COLORS.textSecondary }}>最小点数</span>
            <EditableNumber value={params.gteValue} min={1} max={6} step={1}
              format={v => `${v} 点`} onChange={v => set({ gteValue: v })} />
          </div>
        )}
      </div>
    </div>
  );
}
