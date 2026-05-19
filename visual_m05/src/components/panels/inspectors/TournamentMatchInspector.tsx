import { COLORS } from '@/styles/tokens';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { useSimulationStore } from '@/editor/store';
import { TOURNAMENT_EVENTS } from '@/engine/simulations/tournamentMatch';
import type { TournamentMatchParams, TournamentEventId } from '@/types/simulation';

interface Props {
  simId: string;
  params: TournamentMatchParams;
  hideN?: boolean;
}

export function TournamentMatchInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const set = (p: Partial<TournamentMatchParams>) => updateParams(simId, p as Partial<TournamentMatchParams>);

  const toggleEvent = (id: TournamentEventId) => {
    const current = new Set(params.trackedEvents);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    set({ trackedEvents: Array.from(current) });
  };

  return (
    <div className="flex flex-col gap-4">
      {!hideN && <ScaleNSlider label="模拟轮数 (n)" value={params.n} min={10} onChange={v => set({ n: v })} />}

      {/* 胜率三参数 */}
      <div>
        <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 6 }}>
          胜率设置（每场比赛中前者胜后者的概率）
        </div>
        {([
          ['pAB', '甲胜乙概率'],
          ['pAC', '甲胜丙概率'],
          ['pBC', '乙胜丙概率'],
        ] as const).map(([key, label]) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{label}</span>
              <EditableNumber value={params[key]} min={0} max={1} step={0.05}
                onChange={v => set({ [key]: v } as Partial<TournamentMatchParams>)} />
            </div>
            <Slider value={[params[key] * 100]} min={0} max={100} step={5}
              onValueChange={([v]) => set({ [key]: v / 100 } as Partial<TournamentMatchParams>)} />
          </div>
        ))}
        <button
          onClick={() => set({ pAB: 0.5, pAC: 0.5, pBC: 0.5 })}
          className="text-xs underline mt-1"
          style={{ color: COLORS.primary, alignSelf: 'flex-start', fontSize: 12 }}
        >
          恢复为公平赛（0.5 / 0.5 / 0.5）
        </button>
      </div>

      {/* 事件多选 */}
      <div>
        <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 6 }}>
          追踪事件（勾选要统计的事件）
        </div>
        <div className="flex flex-col gap-1.5">
          {TOURNAMENT_EVENTS.map(ev => {
            const checked = params.trackedEvents.includes(ev.id);
            return (
              <label key={ev.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleEvent(ev.id)}
                  style={{ width: 14, height: 14, accentColor: COLORS.primary }}
                />
                <span style={{ fontSize: 13, color: COLORS.text }}>{ev.label}</span>
                {ev.theoreticalProb !== undefined && (
                  <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 4 }}>
                    (理论 {(ev.theoreticalProb * 100).toFixed(2)}%)
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
