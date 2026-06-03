import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useActiveModel, useActiveParams, useSimulationStore } from '@/store/simulationStore';
import { formatValue, joinScientific, parseNumericInput, splitScientific } from '@/lib/utils/format';
import type { ParameterSpec } from '@/data/celestialData';

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDraft(value: number): string {
  return String(Number.isInteger(value) ? value : Number(value.toPrecision(5)));
}

function BlurInput({
  value,
  min,
  max,
  step,
  onCommit,
  className,
  style,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (next: number) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [draft, setDraft] = useState(() => formatDraft(value));

  const commit = useCallback(() => {
    const parsed = parseNumericInput(draft, value);
    const clamped = clampValue(parsed, min, max);
    onCommit(clamped);
    setDraft(formatDraft(clamped));
  }, [draft, value, min, max, onCommit]);

  return (
    <Input
      className={className}
      style={style}
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
    />
  );
}

function ScientificInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (next: number) => void;
}) {
  const initParts = splitScientific(value);
  const [coeffDraft, setCoeffDraft] = useState(() => String(initParts.coefficient));
  const [expDraft, setExpDraft] = useState(() => String(initParts.exponent));

  const commitCoeff = useCallback(() => {
    const coeff = parseNumericInput(coeffDraft, initParts.coefficient);
    const raw = joinScientific(coeff, Number(expDraft));
    const clamped = clampValue(raw, min, max);
    onCommit(clamped);
    const updated = splitScientific(clamped);
    setCoeffDraft(String(updated.coefficient));
    setExpDraft(String(updated.exponent));
  }, [coeffDraft, expDraft, min, max, onCommit, initParts.coefficient]);

  const commitExp = useCallback(() => {
    const exp = parseNumericInput(expDraft, initParts.exponent);
    const raw = joinScientific(Number(coeffDraft), exp);
    const clamped = clampValue(raw, min, max);
    onCommit(clamped);
    const updated = splitScientific(clamped);
    setCoeffDraft(String(updated.coefficient));
    setExpDraft(String(updated.exponent));
  }, [coeffDraft, expDraft, min, max, onCommit, initParts.exponent]);

  const inputStyle = { background: 'var(--theme-surface-hover)' };

  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-7 w-[68px] px-2 py-0 text-xs"
        style={inputStyle}
        type="number"
        value={coeffDraft}
        step={0.01}
        onChange={(e) => setCoeffDraft(e.target.value)}
        onBlur={commitCoeff}
        onKeyDown={(e) => { if (e.key === 'Enter') commitCoeff(); }}
      />
      <span className="shrink-0 text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>×10^</span>
      <Input
        className="h-7 w-[52px] px-2 py-0 text-center text-xs"
        style={inputStyle}
        type="number"
        value={expDraft}
        step={1}
        onChange={(e) => setExpDraft(e.target.value)}
        onBlur={commitExp}
        onKeyDown={(e) => { if (e.key === 'Enter') commitExp(); }}
      />
    </div>
  );
}

function getDynamicRange(
  modelId: string,
  field: ParameterSpec,
  params: Record<string, number>,
  gaps: { chase: number; orbit: number; ellipse: number },
): { dynamicMin: number; dynamicMax: number } {
  let dynamicMin = field.min;
  let dynamicMax = field.max;

  if (modelId === 'CEL-031' && field.key === 'outerRadiusM') {
    dynamicMin = Math.max(field.min, (params.innerRadiusM ?? field.min) + gaps.chase);
  } else if ((modelId === 'CEL-001' || modelId === 'CEL-011') && field.key === 'highOrbitRadiusM') {
    dynamicMin = Math.max(field.min, (params.lowOrbitRadiusM ?? field.min) + gaps.orbit);
  } else if (modelId === 'CEL-002' && field.key === 'apoapsisRadiusM') {
    dynamicMin = Math.max(field.min, (params.periapsisRadiusM ?? field.min) + gaps.ellipse);
  }

  if (modelId === 'CEL-031' && field.key === 'innerRadiusM') {
    dynamicMax = Math.min(field.max, (params.outerRadiusM ?? field.max) - gaps.chase);
  } else if ((modelId === 'CEL-001' || modelId === 'CEL-011') && field.key === 'lowOrbitRadiusM') {
    dynamicMax = Math.min(field.max, (params.highOrbitRadiusM ?? field.max) - gaps.orbit);
  } else if (modelId === 'CEL-002' && field.key === 'periapsisRadiusM') {
    dynamicMax = Math.min(field.max, (params.apoapsisRadiusM ?? field.max) - gaps.ellipse);
  }

  return { dynamicMin, dynamicMax };
}

const CONSTRAINT_HINTS: Record<string, Record<string, string>> = {
  'CEL-031': { innerRadiusM: '已限制：内轨半径必须小于外轨半径。' },
  'CEL-001': { lowOrbitRadiusM: '已限制：低轨半径高于地球大气层，并小于同步/高轨半径。' },
  'CEL-002': { periapsisRadiusM: '已限制：近地点半径高于地球大气层，并小于远地点半径。' },
  'CEL-011': { lowOrbitRadiusM: '已限制：低轨半径必须大于地球半径，并小于高轨半径。' },
};

const GAPS = { chase: 1e5, orbit: 1e5, ellipse: 1e6 };

export function ParameterPanel() {
  const model = useActiveModel();
  const params = useActiveParams();
  const setParam = useSimulationStore((state) => state.setParam);
  const resetActiveParams = useSimulationStore((state) => state.resetActiveParams);

  return (
    <div className="space-y-3">
      {model.params.map((field) => {
        const value = params[field.key] ?? field.defaultValue;
        const scientific = field.displayScale === 'scientific';
        const { dynamicMin, dynamicMax } = getDynamicRange(model.id, field, params, GAPS);
        const clampedValue = clampValue(value, dynamicMin, dynamicMax);
        const isFixedValue = dynamicMin >= dynamicMax;
        const hint = CONSTRAINT_HINTS[model.id]?.[field.key];

        return (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {field.label}
              </Label>
              <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                {formatValue(value, field.unit, scientific)}
              </span>
            </div>
            {isFixedValue ? (
              <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-surface-hover)', color: 'var(--theme-text-muted)' }}>
                固定参数：{formatValue(clampedValue, field.unit, scientific)}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Slider
                  value={[clampedValue]}
                  min={dynamicMin}
                  max={dynamicMax}
                  step={field.step}
                  onValueChange={([next]) => setParam(field.key, next)}
                />
                {scientific ? (
                  <ScientificInput
                    key={clampedValue}
                    value={clampedValue}
                    min={dynamicMin}
                    max={dynamicMax}
                    onCommit={(next) => setParam(field.key, next)}
                  />
                ) : (
                  <BlurInput
                    key={clampedValue}
                    value={clampedValue}
                    min={dynamicMin}
                    max={dynamicMax}
                    step={field.step}
                    onCommit={(next) => setParam(field.key, next)}
                    className="h-7 w-full px-2 py-0 text-xs"
                    style={{ background: 'var(--theme-surface-hover)' }}
                  />
                )}
              </div>
            )}
            {hint && (
              <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>{hint}</p>
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
