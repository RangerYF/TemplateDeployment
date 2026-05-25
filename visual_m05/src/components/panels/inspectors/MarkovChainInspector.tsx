import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { ScaleNSlider } from '@/components/ui/scale-n-slider';
import { Switch } from '@/components/ui/switch';
import { useSimulationStore } from '@/editor/store';
import { MARKOV_PRESETS } from '@/types/simulation';
import type { MarkovChainParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: MarkovChainParams;
  hideN?: boolean;
}

const MAX_STATES = 6;
const MIN_STATES = 2;

export function MarkovChainInspector({ simId, params, hideN }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const set = (p: Partial<MarkovChainParams>) => updateParams(simId, p as Partial<MarkovChainParams>);

  const N = params.states.length;

  // 加/删状态
  const addState = () => {
    if (N >= MAX_STATES) return;
    // 新状态名 S(N+1)
    const newName = `S${N + 1}`;
    const newStates = [...params.states, newName];
    // 扩展矩阵：旧矩阵补一列（新状态接收的概率初始 0），新增一行（新状态出发，自循环 1）
    const newTransition = params.transition.map(row => [...row, 0]);
    const newRow = new Array(N + 1).fill(0);
    newRow[N] = 1;  // 新状态默认自循环
    newTransition.push(newRow);
    const newInitial = [...params.initial, 0];
    set({ states: newStates, transition: newTransition, initial: newInitial });
  };
  const removeState = (idx: number) => {
    if (N <= MIN_STATES) return;
    const newStates = params.states.filter((_, i) => i !== idx);
    const newTransition = params.transition
      .filter((_, i) => i !== idx)
      .map(row => row.filter((_, j) => j !== idx));
    // 归一化每行（删除后行和可能 < 1）
    for (const row of newTransition) {
      const sum = row.reduce((s, v) => s + v, 0);
      if (sum > 0) {
        for (let j = 0; j < row.length; j++) row[j] = row[j] / sum;
      } else {
        // 全 0 → 默认自循环到第一个状态
        row[0] = 1;
      }
    }
    const newInitial = params.initial.filter((_, i) => i !== idx);
    const initSum = newInitial.reduce((s, v) => s + v, 0);
    if (initSum > 0) for (let i = 0; i < newInitial.length; i++) newInitial[i] /= initSum;
    else newInitial[0] = 1;
    set({ states: newStates, transition: newTransition, initial: newInitial });
  };

  const setStateName = (idx: number, name: string) => {
    const newStates = [...params.states];
    newStates[idx] = name || `S${idx + 1}`;
    set({ states: newStates });
  };

  const setTransitionCell = (i: number, j: number, value: number) => {
    const v = Math.max(0, Math.min(1, value));
    const newTransition = params.transition.map(r => [...r]);
    newTransition[i][j] = v;
    set({ transition: newTransition });
  };

  const setInitial = (i: number, value: number) => {
    const v = Math.max(0, Math.min(1, value));
    const newInitial = [...params.initial];
    newInitial[i] = v;
    set({ initial: newInitial });
  };

  const normalizeRow = (i: number) => {
    const row = params.transition[i];
    const sum = row.reduce((s, v) => s + v, 0);
    if (sum <= 0) return;
    const newTransition = params.transition.map(r => [...r]);
    newTransition[i] = row.map(v => v / sum);
    set({ transition: newTransition });
  };

  const normalizeInitial = () => {
    const sum = params.initial.reduce((s, v) => s + v, 0);
    if (sum <= 0) return;
    const newInitial = params.initial.map(v => v / sum);
    set({ initial: newInitial });
  };

  // 加载预设
  const loadPreset = (presetId: string) => {
    const preset = MARKOV_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    set({
      states: [...preset.states],
      transition: preset.transition.map(r => [...r]),
      initial: [...preset.initial],
    });
  };

  // 每行和（用于校验提示）
  const rowSums = params.transition.map(r => r.reduce((s, v) => s + v, 0));
  const initialSum = params.initial.reduce((s, v) => s + v, 0);
  const allRowsValid = rowSums.every(s => Math.abs(s - 1) <= 1e-3);
  const initialValid = Math.abs(initialSum - 1) <= 1e-3;

  return (
    <div className="flex flex-col gap-4">
      {!hideN && <ScaleNSlider label="模拟轮数 (n)" value={params.n} min={50} onChange={v => set({ n: v })} />}

      <div>
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>演化步数</span>
          <EditableNumber value={params.steps} min={2} max={200} step={1}
            onChange={v => set({ steps: v })} />
        </div>
        <Slider value={[params.steps]} min={2} max={100} step={1}
          onValueChange={([v]) => set({ steps: v })} />
      </div>

      {/* 预设 */}
      <div>
        <div className="mb-1" style={{ fontSize: 13, color: COLORS.textSecondary }}>预设场景</div>
        <select
          onChange={e => { if (e.target.value) loadPreset(e.target.value); }}
          value=""
          style={{
            width: '100%', fontSize: 13, padding: '6px 8px',
            border: `1px solid ${COLORS.border}`, borderRadius: 6,
            backgroundColor: COLORS.bg, color: COLORS.text,
          }}
        >
          <option value="">选择预设...</option>
          {MARKOV_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* 状态列表 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>状态（{N} 个）</span>
          <div className="flex gap-1">
            <button onClick={addState} disabled={N >= MAX_STATES}
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg,
                cursor: N >= MAX_STATES ? 'not-allowed' : 'pointer', opacity: N >= MAX_STATES ? 0.5 : 1,
              }}>+ 加</button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {params.states.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={s} onChange={e => setStateName(i, e.target.value)}
                style={{
                  flex: 1, fontSize: 12, padding: '4px 6px',
                  border: `1px solid ${COLORS.border}`, borderRadius: 4,
                  backgroundColor: COLORS.bg, color: COLORS.text,
                }} />
              <button onClick={() => removeState(i)} disabled={N <= MIN_STATES}
                style={{
                  fontSize: 11, padding: '2px 6px', borderRadius: 4,
                  border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg,
                  cursor: N <= MIN_STATES ? 'not-allowed' : 'pointer',
                  color: COLORS.error, opacity: N <= MIN_STATES ? 0.3 : 1,
                }}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* 转移矩阵 */}
      <div>
        <div className="mb-1.5" style={{ fontSize: 14, color: COLORS.textSecondary }}>
          转移矩阵 P{!allRowsValid && <span style={{ color: COLORS.error, marginLeft: 6, fontSize: 11 }}>·行和需为 1</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ padding: '2px 4px', color: COLORS.textMuted }}>↓\→</th>
                {params.states.map((s, j) => (
                  <th key={j} style={{ padding: '2px 4px', color: COLORS.text, fontWeight: 600, minWidth: 44 }}>{s}</th>
                ))}
                <th style={{ padding: '2px 4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {params.states.map((s, i) => (
                <tr key={i}>
                  <td style={{ padding: '2px 4px', color: COLORS.text, fontWeight: 600 }}>{s}</td>
                  {params.states.map((_, j) => (
                    <td key={j} style={{ padding: '1px' }}>
                      <input
                        type="number" step="0.05" min="0" max="1"
                        value={params.transition[i][j].toFixed(2)}
                        onChange={e => setTransitionCell(i, j, parseFloat(e.target.value) || 0)}
                        style={{
                          width: 42, fontSize: 11, padding: '2px 3px', textAlign: 'center',
                          border: `1px solid ${COLORS.border}`, borderRadius: 3,
                          backgroundColor: i === j ? COLORS.primaryLight : COLORS.bg,
                          color: COLORS.text,
                        }} />
                    </td>
                  ))}
                  <td style={{ padding: '1px 4px', fontSize: 10, color: Math.abs(rowSums[i] - 1) <= 1e-3 ? COLORS.primary : COLORS.error }}>
                    Σ={rowSums[i].toFixed(2)}
                    <button onClick={() => normalizeRow(i)}
                      title="归一化此行"
                      style={{
                        marginLeft: 4, padding: '0 4px', borderRadius: 3, fontSize: 9,
                        border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg,
                        cursor: 'pointer', color: COLORS.primary,
                      }}>1</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 初始分布 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>
            初始分布{!initialValid && <span style={{ color: COLORS.error, marginLeft: 6, fontSize: 11 }}>·和需为 1</span>}
          </span>
          <button onClick={normalizeInitial}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              border: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg,
              cursor: 'pointer', color: COLORS.primary,
            }}>归一化</button>
        </div>
        <div className="flex flex-col gap-1">
          {params.states.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: COLORS.text, width: 50 }}>{s}</span>
              <input type="number" step="0.05" min="0" max="1"
                value={params.initial[i].toFixed(2)}
                onChange={e => setInitial(i, parseFloat(e.target.value) || 0)}
                style={{
                  width: 64, fontSize: 11, padding: '2px 4px', textAlign: 'center',
                  border: `1px solid ${COLORS.border}`, borderRadius: 3,
                  backgroundColor: COLORS.bg, color: COLORS.text,
                }} />
              <span style={{ fontSize: 10, color: COLORS.textMuted }}>
                {(params.initial[i] * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>Σ = {initialSum.toFixed(3)}</div>
      </div>

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>显示理论稳态分布</span>
        <Switch
          checked={params.showSteadyState}
          onCheckedChange={v => set({ showSteadyState: v })}
        />
      </label>

      <div className="p-2 rounded text-xs" style={{ backgroundColor: COLORS.primaryLight, color: COLORS.primary, fontSize: 12 }}>
        💡 稳态分布 π 满足 πP = π；当链不可约且非周期时唯一存在
      </div>
    </div>
  );
}
