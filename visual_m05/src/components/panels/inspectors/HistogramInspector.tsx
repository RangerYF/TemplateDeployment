import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { DataSourceEditor } from '@/components/ui/data-source-editor';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import { resolveData } from '@/types/simulation';
import type { HistogramParams, DataSpec } from '@/types/simulation';

interface Props {
  simId: string;
  params: HistogramParams;
}

export function HistogramInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);
  const sim = useSimulationStore(s => s.simulations[simId]);

  const handleChange = (newParams: Partial<HistogramParams>) => {
    updateParams(simId, newParams as Partial<HistogramParams>);
    if (sim) {
      const merged = { ...sim.params, ...newParams } as HistogramParams;
      const cmd = new RunSimulationCommand(simId, 'histogram', merged);
      useHistoryStore.getState().execute(cmd);
    }
  };

  const handleDataSpecChange = (dataSpec: DataSpec) => {
    // Auto-compute √n as default binCount when data source changes
    const newData = resolveData(dataSpec);
    const autoCount = Math.max(2, Math.min(30, Math.round(Math.sqrt(newData.length))));
    handleChange({ dataSpec, binCount: autoCount });
  };

  // For custom bin width mode: compute approximate bin count from width
  const data = resolveData(params.dataSpec);
  const dataMin = data.length > 0 ? Math.min(...data) : 0;
  const dataMax = data.length > 0 ? Math.max(...data) : 100;
  const computedBinCount = params.useCustomBinWidth && params.customBinWidth > 0
    ? Math.max(1, Math.ceil((dataMax - dataMin) / params.customBinWidth))
    : params.binCount;

  return (
    <div className="flex flex-col gap-4">
      <DataSourceEditor spec={params.dataSpec} onChange={handleDataSpecChange} />

      {/* Bin mode toggle */}
      <div>
        <div style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 }}>分组方式</div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}`, fontSize: 14 }}>
          {([false, true] as const).map(useWidth => (
            <button key={String(useWidth)}
              onClick={() => handleChange({ useCustomBinWidth: useWidth })}
              className="flex-1 py-1.5 font-medium transition-colors"
              style={{
                backgroundColor: params.useCustomBinWidth === useWidth ? COLORS.primary : 'transparent',
                color: params.useCustomBinWidth === useWidth ? COLORS.white : COLORS.textSecondary,
                border: 'none', cursor: 'pointer',
              }}>
              {useWidth ? '按组距' : '按组数'}
            </button>
          ))}
        </div>
      </div>

      {!params.useCustomBinWidth ? (
        <div>
          <div className="flex justify-between mb-1.5">
            <span style={{ fontSize: 14, color: COLORS.textSecondary }}>分组数 (bins)</span>
            <EditableNumber value={params.binCount} min={2} max={30} step={1}
              onChange={v => handleChange({ binCount: v })} />
          </div>
          <Slider value={[params.binCount]} min={2} max={30} step={1}
            onValueChange={([v]) => handleChange({ binCount: v })} />
          <div className="flex justify-between mt-1" style={{ fontSize: 14, color: COLORS.textTertiary }}>
            <span>2</span><span>30</span>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between mb-1.5">
            <span style={{ fontSize: 14, color: COLORS.textSecondary }}>组距</span>
            <EditableNumber value={params.customBinWidth} min={0.1} max={1000} step={0.5}
              onChange={v => handleChange({ customBinWidth: v })} />
          </div>
          <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 2 }}>
            → 约 {computedBinCount} 组
          </div>
        </div>
      )}
    </div>
  );
}
