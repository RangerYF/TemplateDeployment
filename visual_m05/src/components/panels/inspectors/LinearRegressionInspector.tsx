import { COLORS } from '@/styles/tokens';
import { Switch } from '@/components/ui/switch';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import {
  DEFAULT_REGRESSION_DATA_SPEC,
  REGRESSION_DATASETS,
  regressionPointsToText,
  resolveRegressionData,
  syncCustomRegressionDataset,
} from '@/types/simulation';
import type { LinearRegressionParams, RegressionDataSpec, RegressionModelType } from '@/types/simulation';

const MODEL_OPTIONS: Array<{ value: RegressionModelType; label: string; hint: string }> = [
  { value: 'linear', label: '线性 y = a + bx', hint: '一次直线（最常用）' },
  { value: 'exponential', label: '指数 y = a·e^(bx)', hint: '要求 y > 0' },
  { value: 'power', label: '幂函数 y = a·x^b', hint: '要求 x > 0 且 y > 0' },
  { value: 'log', label: '对数 y = a + b·ln(x)', hint: '要求 x > 0' },
  { value: 'quadratic', label: '二次 y = ax² + bx + c', hint: '至少 3 个点' },
  { value: 'reciprocal', label: '倒数 y = a + b/x', hint: '要求 x ≠ 0' },
];

interface Props {
  simId: string;
  params: LinearRegressionParams;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  padding: '6px 8px',
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  backgroundColor: COLORS.bg,
  color: COLORS.text,
  boxSizing: 'border-box',
};

export function LinearRegressionInspector({ simId, params }: Props) {
  const updateParams = useSimulationStore(s => s.updateParams);

  const isManual = params.dataSpec.mode === 'manual' || params.datasetId === 'REG-CUSTOM';
  const resolved = resolveRegressionData(
    isManual
      ? { ...params.dataSpec, mode: 'manual' }
      : { ...params.dataSpec, mode: 'preset', presetId: params.datasetId || params.dataSpec.presetId },
  );

  const updateRegression = (next: LinearRegressionParams) => {
    if (next.dataSpec.mode === 'manual' || next.datasetId === 'REG-CUSTOM') {
      syncCustomRegressionDataset(next.dataSpec);
      const manualResolved = resolveRegressionData({ ...next.dataSpec, mode: 'manual' });
      const distinctX = new Set(manualResolved.points.map(point => point.x)).size;
      updateParams(simId, next as never);
      if (manualResolved.points.length < 2 || distinctX < 2) {
        useSimulationStore.getState().resetResult(simId);
        return;
      }
      const cmd = new RunSimulationCommand(simId, 'linearRegression', next);
      useHistoryStore.getState().execute(cmd);
      return;
    }
    updateParams(simId, next as never);
    const cmd = new RunSimulationCommand(simId, 'linearRegression', next);
    useHistoryStore.getState().execute(cmd);
  };

  const switchMode = (mode: RegressionDataSpec['mode']) => {
    if (mode === 'manual') {
      const preset = REGRESSION_DATASETS.find(dataset => dataset.id === params.datasetId) ?? REGRESSION_DATASETS[0];
      const nextDataSpec: RegressionDataSpec = params.dataSpec.mode === 'manual'
        ? params.dataSpec
        : {
          ...DEFAULT_REGRESSION_DATA_SPEC,
          mode: 'manual',
          presetId: preset.id,
          xLabel: preset.xLabel,
          yLabel: preset.yLabel,
          customText: regressionPointsToText(preset.points),
        };

      updateRegression({
        ...params,
        datasetId: 'REG-CUSTOM',
        dataSpec: nextDataSpec,
      });
      return;
    }

    const presetId = params.datasetId !== 'REG-CUSTOM' ? params.datasetId : (params.dataSpec.presetId || 'REG-01');
    updateRegression({
      ...params,
      datasetId: presetId,
      dataSpec: {
        ...params.dataSpec,
        mode: 'preset',
        presetId,
      },
    });
  };

  const currentModel = MODEL_OPTIONS.find(m => m.value === (params.modelType ?? 'linear'));

  return (
    <div className="flex flex-col gap-4">
      {/* 回归模型类型选择 (v0.4 反馈 #10) */}
      <div>
        <div className="mb-1.5" style={{ fontSize: 14, color: COLORS.textSecondary }}>
          回归模型
          {params.autoRecommend && <span style={{ color: COLORS.primary, marginLeft: 6, fontSize: 12 }}>· 自动推荐已开启</span>}
        </div>
        <select
          value={params.modelType ?? 'linear'}
          onChange={e => updateRegression({ ...params, modelType: e.target.value as RegressionModelType })}
          disabled={params.autoRecommend}
          style={{ ...inputStyle, opacity: params.autoRecommend ? 0.5 : 1 }}
        >
          {MODEL_OPTIONS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {currentModel && (
          <div className="mt-1" style={{ fontSize: 12, color: COLORS.textMuted }}>{currentModel.hint}</div>
        )}
      </div>

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>自动推荐最佳模型</span>
        <Switch
          checked={params.autoRecommend ?? false}
          onCheckedChange={v => updateRegression({ ...params, autoRecommend: v })}
        />
      </label>

      {/* 模式切换：预设数据集 / 教师输入 */}
      <div>
        <div className="mb-1.5" style={{ fontSize: 14, color: COLORS.textSecondary }}>数据来源</div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
          {(['preset', 'manual'] as const).map(mode => {
            const selected = (mode === 'manual') === isManual;
            return (
              <button
                key={mode}
                onClick={() => switchMode(mode)}
                className="flex-1 py-1.5 font-medium transition-colors"
                style={{
                  backgroundColor: selected ? COLORS.primary : 'transparent',
                  color: selected ? COLORS.white : COLORS.textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {mode === 'preset' ? '预设数据集' : '教师输入'}
              </button>
            );
          })}
        </div>
      </div>

      {/* 预设数据集选择 */}
      {!isManual && (
        <div>
          <div className="mb-1.5" style={{ fontSize: 14, color: COLORS.textSecondary }}>预设数据集</div>
          <select
            value={params.datasetId}
            onChange={event => updateRegression({
              ...params,
              datasetId: event.target.value,
              dataSpec: {
                ...params.dataSpec,
                mode: 'preset',
                presetId: event.target.value,
              },
            })}
            style={inputStyle}
          >
            {REGRESSION_DATASETS.filter(dataset => dataset.id !== 'REG-CUSTOM').map(dataset => (
              <option key={dataset.id} value={dataset.id}>{dataset.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 教师输入：X/Y 轴标签 + 二维数据 textarea */}
      {isManual && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1" style={{ fontSize: 13, color: COLORS.textSecondary }}>X 轴名称</div>
              <input
                value={params.dataSpec.xLabel}
                onChange={event => updateRegression({
                  ...params,
                  datasetId: 'REG-CUSTOM',
                  dataSpec: { ...params.dataSpec, mode: 'manual', xLabel: event.target.value },
                })}
                style={inputStyle}
              />
            </div>
            <div>
              <div className="mb-1" style={{ fontSize: 13, color: COLORS.textSecondary }}>Y 轴名称</div>
              <input
                value={params.dataSpec.yLabel}
                onChange={event => updateRegression({
                  ...params,
                  datasetId: 'REG-CUSTOM',
                  dataSpec: { ...params.dataSpec, mode: 'manual', yLabel: event.target.value },
                })}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <div className="mb-1" style={{ fontSize: 13, color: COLORS.textSecondary }}>二维数据（每行一组 x,y）</div>
            <textarea
              value={params.dataSpec.customText}
              onChange={event => updateRegression({
                ...params,
                datasetId: 'REG-CUSTOM',
                dataSpec: { ...params.dataSpec, mode: 'manual', customText: event.target.value },
              })}
              placeholder={'例如：\n2, 30\n4, 50\n5, 58'}
              rows={6}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'monospace',
              }}
            />
          </div>
        </>
      )}

      {/* 当前数据预览 */}
      <div className="p-2 rounded-lg" style={{ backgroundColor: COLORS.bgMuted }}>
        <div style={{ fontSize: 13, color: COLORS.textSecondary }}>当前数据</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
          {resolved.sourceName}，{resolved.xLabel} / {resolved.yLabel}，共 {resolved.points.length} 个点
        </div>
        {isManual && (
          <div style={{ fontSize: 12, color: COLORS.textTertiary, marginTop: 6, lineHeight: 1.6 }}>
            需要至少 2 个点且 x 取值不能完全相同，系统才会生成回归直线。
          </div>
        )}
      </div>

      {/* 显示残差开关 */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>显示残差</span>
        <Switch
          checked={params.showResiduals}
          onCheckedChange={v => updateRegression({ ...params, showResiduals: v })}
        />
      </div>
    </div>
  );
}
