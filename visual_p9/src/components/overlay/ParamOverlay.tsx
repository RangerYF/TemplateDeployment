import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useActiveModel, useActiveParams, useSimulationStore } from '@/store/simulationStore';
import { formatValue, splitScientific, joinScientific } from '@/lib/utils/format';
import type { ParameterSpec } from '@/data/celestialData';

const inputCls =
  'rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white/90 outline-none focus:ring-1 focus:ring-white/30';

const glass = {
  background: 'rgba(5, 10, 24, 0.6)',
  backdropFilter: 'blur(20px) saturate(1.5)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 20,
} as const;

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDynamicRange(
  modelId: string,
  field: ParameterSpec,
  params: Record<string, number>,
): { dynamicMin: number; dynamicMax: number } {
  let dynamicMin = field.min;
  let dynamicMax = field.max;
  const gaps = { chase: 1e5, orbit: 1e5, ellipse: 1e6 };

  if (modelId === 'CEL-031' && field.key === 'outerRadiusM')
    dynamicMin = Math.max(field.min, (params.innerRadiusM ?? field.min) + gaps.chase);
  else if ((modelId === 'CEL-001' || modelId === 'CEL-011') && field.key === 'highOrbitRadiusM')
    dynamicMin = Math.max(field.min, (params.lowOrbitRadiusM ?? field.min) + gaps.orbit);
  else if (modelId === 'CEL-002' && field.key === 'apoapsisRadiusM')
    dynamicMin = Math.max(field.min, (params.periapsisRadiusM ?? field.min) + gaps.ellipse);

  if (modelId === 'CEL-031' && field.key === 'innerRadiusM')
    dynamicMax = Math.min(field.max, (params.outerRadiusM ?? field.max) - gaps.chase);
  else if ((modelId === 'CEL-001' || modelId === 'CEL-011') && field.key === 'lowOrbitRadiusM')
    dynamicMax = Math.min(field.max, (params.highOrbitRadiusM ?? field.max) - gaps.orbit);
  else if (modelId === 'CEL-002' && field.key === 'periapsisRadiusM')
    dynamicMax = Math.min(field.max, (params.apoapsisRadiusM ?? field.max) - gaps.ellipse);

  return { dynamicMin, dynamicMax };
}

const phaseLabels: Record<string, string> = {
  low: '第一次点火加速',
  transfer: '第二次点火入轨',
  high: '高轨减速降轨',
  transferDown: '低轨再点火入轨',
};

function InlineEditor({
  value,
  min,
  max,
  scientific,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  scientific: boolean;
  onCommit: (v: number) => void;
}) {
  const parts = splitScientific(value);
  const [coeff, setCoeff] = useState(String(parts.coefficient));
  const [exp, setExp] = useState(String(parts.exponent));
  const [plain, setPlain] = useState(String(value));

  const doCommit = () => {
    if (scientific) {
      const c = Number(coeff);
      const e = Number(exp);
      if (Number.isFinite(c) && Number.isFinite(e))
        onCommit(clampValue(joinScientific(c, e), min, max));
    } else {
      const p = Number(plain);
      if (Number.isFinite(p)) onCommit(clampValue(p, min, max));
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { doCommit(); }
  };

  if (scientific) {
    return (
      <div
        className="flex items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={coeff}
          onChange={(e) => setCoeff(e.target.value)}
          onKeyDown={onKey}
          className={`${inputCls} w-[48px] text-right`}
        />
        <span className="text-[10px] text-white/40">e</span>
        <input
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          onKeyDown={onKey}
          className={`${inputCls} w-[32px] text-center`}
        />
        <button
          className="ml-0.5 rounded bg-white/15 px-1.5 py-0.5 text-[10px] text-white/70 hover:bg-white/25"
          onClick={(e) => { e.stopPropagation(); doCommit(); }}
        >
          ✓
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={plain}
        onChange={(e) => setPlain(e.target.value)}
        onKeyDown={onKey}
        className={`${inputCls} w-[70px] text-right`}
      />
      <button
        className="ml-0.5 rounded bg-white/15 px-1.5 py-0.5 text-[10px] text-white/70 hover:bg-white/25"
        onClick={(e) => { e.stopPropagation(); doCommit(); }}
      >
        ✓
      </button>
    </div>
  );
}

export function ParamOverlay() {
  const [open, setOpen] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const model = useActiveModel();
  const params = useActiveParams();
  const {
    speedMultiplier,
    setSpeedMultiplier,
    showVectors,
    setShowVectors,
    showAreaSectors,
    setShowAreaSectors,
    currentModelId,
    hohmannPhase,
    fireHohmann,
    setParam,
    resetActiveParams,
  } = useSimulationStore();

  return (
    <div
      className="absolute right-4 top-4 z-10 overflow-hidden transition-all duration-300"
      style={{
        ...glass,
        width: 'min(280px, calc(100vw - 32px))',
        maxHeight: open ? '80vh' : 44,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen(!open)}
      >
        <span className="text-xs font-semibold text-white/90">实验参数</span>
        <span
          className="text-sm text-white/40 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : '' }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: 'calc(80vh - 44px)' }}>
          {/* Speed */}
          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] text-white/50">速度</span>
              <span className="text-[11px] font-semibold text-white/80">
                {speedMultiplier.toFixed(1)}x
              </span>
            </div>
            <Slider
              value={[speedMultiplier]}
              onValueChange={([v]) => setSpeedMultiplier(v)}
              min={0.2}
              max={20}
              step={0.2}
            />
          </div>

          {/* Toggles */}
          <div className="mb-3 space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-[11px] text-white/50">矢量箭头</span>
              <Switch checked={showVectors} onCheckedChange={setShowVectors} />
            </label>
            {currentModelId === 'CEL-002' && (
              <label className="flex items-center justify-between">
                <span className="text-[11px] text-white/50">面积扇形</span>
                <Switch checked={showAreaSectors} onCheckedChange={setShowAreaSectors} />
              </label>
            )}
          </div>

          <div className="mb-3 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Params */}
          <div className="space-y-3">
            {model.params.map((field) => {
              const value = params[field.key] ?? field.defaultValue;
              const scientific = field.displayScale === 'scientific';
              const { dynamicMin, dynamicMax } = getDynamicRange(model.id, field, params);
              const clamped = clampValue(value, dynamicMin, dynamicMax);
              if (dynamicMin >= dynamicMax) return null;

              const isEditing = editingKey === field.key;

              return (
                <div key={field.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] text-white/50">{field.label}</span>
                    {isEditing ? (
                      <InlineEditor
                        value={clamped}
                        min={dynamicMin}
                        max={dynamicMax}
                        scientific={scientific}
                        onCommit={(next) => {
                          setParam(field.key, next);
                          setEditingKey(null);
                        }}
                      />
                    ) : (
                      <span
                        className="cursor-text rounded px-1 py-0.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white/90"
                        onClick={() => setEditingKey(field.key)}
                      >
                        {formatValue(clamped, field.unit, scientific)}
                      </span>
                    )}
                  </div>
                  <Slider
                    value={[clamped]}
                    min={dynamicMin}
                    max={dynamicMax}
                    step={field.step}
                    onValueChange={([next]) => setParam(field.key, next)}
                  />
                </div>
              );
            })}
          </div>

          {currentModelId === 'CEL-011' && (
            <Button variant="danger" size="sm" className="mt-3 w-full" onClick={fireHohmann}>
              {phaseLabels[hohmannPhase] || '点火'}
            </Button>
          )}

          <button
            className="mt-3 w-full rounded-lg py-1.5 text-[11px] text-white/40 transition-colors hover:text-white/70"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            onClick={resetActiveParams}
          >
            重置参数
          </button>
        </div>
      )}
    </div>
  );
}
