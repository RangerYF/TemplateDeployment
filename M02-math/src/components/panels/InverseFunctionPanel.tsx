import { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { useFunctionStore } from '@/editor/store/functionStore';
import { UpdateFunctionParamCommand } from '@/editor/commands/UpdateFunctionParamCommand';
import { editorInstance } from '@/editor/core/Editor';
import { analyzeInverseFunction } from '@/engine/inverseFunction';
import { COLORS } from '@/styles/colors';

export function InverseFunctionPanel() {
  const activeFunction = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId) ?? null,
  );
  const functions = useFunctionStore((s) => s.functions);
  const viewport = useFunctionStore((s) => s.viewport);

  const analysis = useMemo(() => {
    if (!activeFunction) return null;
    return analyzeInverseFunction(activeFunction, functions, viewport, 800, 600, 500);
  }, [activeFunction, functions, viewport]);

  if (!activeFunction || activeFunction.mode !== 'standard') return null;

  const commitPatch = (
    patch: Partial<typeof activeFunction>,
    label: string,
  ) => {
    editorInstance?.execute(
      new UpdateFunctionParamCommand(
        activeFunction.id,
        {
          inverseDisplay: { ...activeFunction.inverseDisplay },
        },
        patch,
        label,
      ),
    );
  };

  const setInverseOption = (key: 'showMirrorLine' | 'showInverseCurve', value: boolean) => {
    commitPatch(
      {
        inverseDisplay: {
          ...activeFunction.inverseDisplay,
          [key]: value,
        },
      },
      key === 'showMirrorLine' ? '切换 y=x 参考线' : '切换反函数图像',
    );
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, margin: '0 0 8px' }}>
        反函数
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: COLORS.textSecondary }}>显示 y = x</span>
          <Switch
            checked={activeFunction.inverseDisplay.showMirrorLine}
            onCheckedChange={(v) => setInverseOption('showMirrorLine', v)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: COLORS.textSecondary }}>显示反函数图像</span>
          <Switch
            checked={activeFunction.inverseDisplay.showInverseCurve}
            onCheckedChange={(v) => setInverseOption('showInverseCurve', v)}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: '10px',
          borderRadius: '12px',
          padding: '10px 12px',
          background: analysis?.isApproximatelyInjective ? COLORS.primaryLight : COLORS.warningLight,
          border: `1px solid ${analysis?.isApproximatelyInjective ? COLORS.primary : COLORS.warning}`,
        }}
      >
        <p
          style={{
            margin: '0 0 4px',
            fontSize: '11px',
            fontWeight: 700,
            color: analysis?.isApproximatelyInjective ? COLORS.primaryHover : COLORS.warning,
          }}
        >
          {analysis?.isApproximatelyInjective ? '当前可视范围内可视为反函数' : '当前可视范围内不构成严格反函数'}
        </p>
        <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, color: COLORS.textDark }}>
          {analysis?.message ?? '请选择标准函数后查看'}
        </p>
      </div>
    </div>
  );
}
