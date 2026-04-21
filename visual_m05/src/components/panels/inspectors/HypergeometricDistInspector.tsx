import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import type { HypergeometricDistParams } from '@/types/simulation';

interface Props {
  simId: string;
  params: HypergeometricDistParams;
}

export function HypergeometricDistInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const sim = useSimulationStore(s => s.simulations[simId]);

  const handleChange = (newParams: Partial<HypergeometricDistParams>) => {
    const merged = { ...params, ...newParams };
    // Clamp M <= N, n <= N
    if (merged.M > merged.N) merged.M = merged.N;
    if (merged.n > merged.N) merged.n = merged.N;
    updateParams(simId, merged);
    if (sim) {
      const cmd = new RunSimulationCommand(simId, 'hypergeometricDist', merged);
      useHistoryStore.getState().execute(cmd);
    }
  };

  const kMin = Math.max(0, params.n - (params.N - params.M));
  const kMax = Math.min(params.n, params.M);
  const mean = params.N > 0 ? (params.n * params.M) / params.N : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* N */}
      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>总体数量 N</span>
          <EditableNumber value={params.N} min={2} max={200} step={1}
            onChange={v => handleChange({ N: v })} />
        </div>
        <Slider value={[params.N]} min={2} max={200} step={1}
          onValueChange={([v]) => handleChange({ N: v })} />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>2</span><span>200</span>
        </div>
      </div>

      {/* M */}
      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>目标类型数 M</span>
          <EditableNumber value={params.M} min={0} max={params.N} step={1}
            onChange={v => handleChange({ M: v })} />
        </div>
        <Slider value={[params.M]} min={0} max={params.N} step={1}
          onValueChange={([v]) => handleChange({ M: v })} />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>0</span><span>{params.N}</span>
        </div>
      </div>

      {/* n */}
      <div>
        <div className="flex justify-between mb-1.5">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>抽取数量 n</span>
          <EditableNumber value={params.n} min={1} max={params.N} step={1}
            onChange={v => handleChange({ n: v })} />
        </div>
        <Slider value={[params.n]} min={1} max={params.N} step={1}
          onValueChange={([v]) => handleChange({ n: v })} />
        <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
          <span>1</span><span>{params.N}</span>
        </div>
      </div>

      {/* CDF toggle */}
      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg"
        style={{ backgroundColor: COLORS.bgMuted, fontSize: 14 }}>
        <span style={{ color: COLORS.textSecondary }}>显示累积分布 CDF</span>
        <button
          onClick={() => handleChange({ showCdf: !params.showCdf })}
          style={{
            padding: '2px 10px',
            borderRadius: 999,
            border: 'none',
            backgroundColor: params.showCdf ? COLORS.primary : COLORS.border,
            color: params.showCdf ? COLORS.white : COLORS.textMuted,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {params.showCdf ? '开' : '关'}
        </button>
      </div>

      {/* Info */}
      <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.primaryLight }}>
        <div style={{ fontSize: 14, color: COLORS.primary, lineHeight: 1.7 }}>
          <div>H(N={params.N}, M={params.M}, n={params.n})</div>
          <div>k ∈ [{kMin}, {kMax}]  E(X) = {mean.toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}
