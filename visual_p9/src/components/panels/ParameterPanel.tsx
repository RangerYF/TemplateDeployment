import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useActiveModel, useActiveParams, useSimulationStore } from '@/store/simulationStore';
import { COLORS } from '@/styles/tokens';
import { formatValue, parseNumericInput } from '@/lib/utils/format';

export function ParameterPanel() {
  const model = useActiveModel();
  const params = useActiveParams();
  const setParam = useSimulationStore((state) => state.setParam);
  const resetActiveParams = useSimulationStore((state) => state.resetActiveParams);
  const chaseRadiusGapM = 1e5;

  return (
    <div className="space-y-3">
      {model.params.map((field) => {
        const value = params[field.key] ?? field.defaultValue;
        const scientific = field.displayScale === 'scientific';
        const dynamicMin = model.id === 'CEL-031' && field.key === 'outerRadiusM'
          ? Math.max(field.min, (params.innerRadiusM ?? field.min) + chaseRadiusGapM)
          : field.min;
        const dynamicMax = model.id === 'CEL-031' && field.key === 'innerRadiusM'
          ? Math.min(field.max, (params.outerRadiusM ?? field.max) - chaseRadiusGapM)
          : field.max;
        const clampedValue = Math.min(dynamicMax, Math.max(dynamicMin, value));
        const isFixedValue = dynamicMin >= dynamicMax;

        return (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs" style={{ color: COLORS.textMuted }}>
                {field.label}
              </Label>
              <span className="text-[11px]" style={{ color: COLORS.textPlaceholder }}>
                {formatValue(value, field.unit, scientific)}
              </span>
            </div>
            {isFixedValue ? (
              <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: COLORS.border, background: COLORS.bgMuted, color: COLORS.textMuted }}>
                固定参数：{formatValue(clampedValue, field.unit, scientific)}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Slider
                    value={[clampedValue]}
                    min={dynamicMin}
                    max={dynamicMax}
                    step={field.step}
                    onValueChange={([next]) => setParam(field.key, next)}
                  />
                </div>
                <Input
                  className="h-7 w-[82px] px-2 py-0 text-xs"
                  type="number"
                  value={Number.isInteger(clampedValue) ? clampedValue : Number(clampedValue.toPrecision(5))}
                  min={dynamicMin}
                  max={dynamicMax}
                  step={field.step}
                  onChange={(event) => {
                    const next = parseNumericInput(event.target.value, clampedValue);
                    setParam(field.key, Math.min(dynamicMax, Math.max(dynamicMin, next)));
                  }}
                />
              </div>
            )}
            {model.id === 'CEL-031' && field.key === 'innerRadiusM' && (
              <p className="text-[11px]" style={{ color: COLORS.textPlaceholder }}>
                已限制：内轨半径必须小于外轨半径。
              </p>
            )}
          </div>
        );
      })}

      <Button variant="secondary" size="sm" className="w-full" onClick={resetActiveParams}>
        重置 · 恢复默认参数
      </Button>
    </div>
  );
}
