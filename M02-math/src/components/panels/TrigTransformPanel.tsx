/**
 * TrigTransformPanel — M04 Phase 3
 *
 * Controls for the trig-function transform  y = A · fn(ω·x + φ) + k
 *
 * Interaction pattern (same as M02 TransformPanel / M03 ConicParamPanel):
 *  - Slider drag  : live store update, NO Command written  (via useParamSlider)
 *  - Slider release: one UpdateTransformCommand → Undo/Redo entry
 *
 * φ slider uses usePiSlider so the readout shows "π/4" instead of "0.785".
 *
 * Layout:
 *  ┌──────────────────────────────────────────┐
 *  │ 变换实验室                                │ ← header
 *  │ y = 2sin(3x + π/4) + 1  (KaTeX)         │ ← live formula
 *  ├──────────────────────────────────────────┤
 *  │ 函数: [sin▣] [cos ] [tan ]              │ ← fnType toggle
 *  ├──────────────────────────────────────────┤
 *  │ A   ────●─────────  2.0                  │ ← amplitude
 *  │ ω   ────────●─────  3.0                  │ ← angular freq
 *  │ φ   ──────●───────  π/4                  │ ← phase (π labels)
 *  │ k   ────●─────────  1.0                  │ ← vertical shift
 *  ├──────────────────────────────────────────┤
 *  │ [✓] 参考曲线 y = sin(x)                   │ ← reference toggle
 *  └──────────────────────────────────────────┘
 */

import { useEffect, useState }       from 'react';
import { useParamSlider }            from '@/hooks/useParamSlider';
import { usePiSlider }               from '@/hooks/usePiSlider';
import { useM04FunctionStore }       from '@/editor/store/m04FunctionStore';
import { executeM03Command }         from '@/editor/commands/m03Execute';
import { UpdateTransformCommand }    from '@/editor/commands/UpdateTransformCommand';
import { buildTransformLatex }       from '@/engine/transformLatex';
import { KaTeXRenderer }            from '@/components/KaTeXRenderer';
import { UniversalSlider }            from '@/components/shared/UniversalSlider';
import { COLORS }                    from '@/styles/colors';
import { btnHover }                  from '@/styles/interactionStyles';
import { Switch }                    from '@/components/ui/switch';
import type { FnType, TrigTransform, ViewportState } from '@/types';

// ─── Colours ─────────────────────────────────────────────────────────────────

const FN_COLOR: Record<FnType, string> = {
  sin: COLORS.sinColor,
  cos: COLORS.cosColor,
  tan: COLORS.tanColor,
};

// ─── Store read helpers (stale-closure-safe) ─────────────────────────────────

function getTransform(): TrigTransform {
  return useM04FunctionStore.getState().transform;
}

function getParam(key: keyof TrigTransform): number {
  return useM04FunctionStore.getState().transform[key];
}

function liveSet(key: keyof TrigTransform, value: number): void {
  useM04FunctionStore.getState().setTransform({ [key]: value });
}

function commitTransform(before: TrigTransform, after: TrigTransform): void {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  executeM03Command(new UpdateTransformCommand(before, after));
}

function fmtViewportValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// ─── SliderRow (delegates to UniversalSlider) ────────────────────────────────

interface SliderRowProps {
  label:        string;
  value:        number;
  displayValue: string;
  min:          number;
  max:          number;
  step:         number;
  color:        string;
  onChange:     (vals: number[]) => void;
  onCommit:     (vals: number[]) => void;
}

function SliderRow({
  label, value, displayValue, min, max, step, color, onChange, onCommit,
}: SliderRowProps) {
  return (
    <UniversalSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      displayValue={displayValue}
      color={color}
      onChange={(v) => onChange([v])}
      onCommit={(v) => onCommit([v])}
    />
  );
}

// ─── FnTab ────────────────────────────────────────────────────────────────────

function FnTab({
  type, active, onClick,
}: {
  type: FnType; active: boolean; onClick: () => void;
}) {
  const color = FN_COLOR[type];
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '4px 0',
        fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
        borderRadius: 8,
        border:      `1px solid ${active ? color : COLORS.borderMuted}`,
        background:  active ? `${color}22` : 'transparent',
        color:       active ? color : COLORS.textSecondary,
        cursor:      'pointer',
        transition:  'all 0.15s',
      }}
      {...(active ? {} : btnHover(COLORS.surfaceHover))}
    >
      {type}
    </button>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TrigTransformPanel() {
  const fnType        = useM04FunctionStore((s) => s.fnType);
  const transform     = useM04FunctionStore((s) => s.transform);
  const viewport      = useM04FunctionStore((s) => s.viewport);
  const showReference = useM04FunctionStore((s) => s.showReference);
  const setFnType     = useM04FunctionStore((s) => s.setFnType);
  const setShowRef    = useM04FunctionStore((s) => s.setShowReference);
  const setViewport   = useM04FunctionStore((s) => s.setViewport);

  const fnColor = FN_COLOR[fnType];
  const [viewportDraft, setViewportDraft] = useState({
    xMin: fmtViewportValue(viewport.xMin),
    xMax: fmtViewportValue(viewport.xMax),
    yMin: fmtViewportValue(viewport.yMin),
    yMax: fmtViewportValue(viewport.yMax),
  });
  const [viewportError, setViewportError] = useState<string | null>(null);

  useEffect(() => {
    setViewportDraft({
      xMin: fmtViewportValue(viewport.xMin),
      xMax: fmtViewportValue(viewport.xMax),
      yMin: fmtViewportValue(viewport.yMin),
      yMax: fmtViewportValue(viewport.yMax),
    });
    setViewportError(null);
  }, [viewport]);

  // ── Sliders (Rules of Hooks: all unconditional) ───────────────────────────

  const aSlider = useParamSlider<number>({
    getValue:     () => getParam('A'),
    onLiveUpdate: (v) => liveSet('A', v),
    onCommit:     (before, after) => {
      const t = getTransform();
      commitTransform({ ...t, A: before }, { ...t, A: after });
    },
  });

  const omegaSlider = useParamSlider<number>({
    getValue:     () => getParam('omega'),
    onLiveUpdate: (v) => liveSet('omega', v),
    onCommit:     (before, after) => {
      const t = getTransform();
      commitTransform({ ...t, omega: before }, { ...t, omega: after });
    },
  });

  const phiSlider = usePiSlider({
    getValue:     () => getParam('phi'),
    onLiveUpdate: (v) => liveSet('phi', v),
    onCommit:     (before, after) => {
      const t = getTransform();
      commitTransform({ ...t, phi: before }, { ...t, phi: after });
    },
  });

  const kSlider = useParamSlider<number>({
    getValue:     () => getParam('k'),
    onLiveUpdate: (v) => liveSet('k', v),
    onCommit:     (before, after) => {
      const t = getTransform();
      commitTransform({ ...t, k: before }, { ...t, k: after });
    },
  });

  // ── Live formula ──────────────────────────────────────────────────────────
  const formulaLatex = buildTransformLatex(
    transform.A, transform.omega, transform.phi, transform.k, fnType,
  );

  // ── Ref label for checkbox ────────────────────────────────────────────────
  const refLabel = `参考曲线 y = ${fnType}(x)`;

  const commitViewport = (patch?: Partial<ViewportState>) => {
    const next: ViewportState = { ...viewport, ...patch };
    if (!(next.xMin < next.xMax) || !(next.yMin < next.yMax)) {
      setViewportError('坐标范围要求最小值小于最大值');
      return;
    }
    setViewport(next);
    setViewportError(null);
  };

  const handleViewportCommit = () => {
    const xMin = parseFloat(viewportDraft.xMin);
    const xMax = parseFloat(viewportDraft.xMax);
    const yMin = parseFloat(viewportDraft.yMin);
    const yMax = parseFloat(viewportDraft.yMax);
    if ([xMin, xMax, yMin, yMax].some((v) => Number.isNaN(v))) {
      setViewportError('坐标范围请输入数字');
      return;
    }
    commitViewport({ xMin, xMax, yMin, yMax });
  };

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* ── Header + live formula ─────────────────────────────────────────── */}
      <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 6 }}>
        三角函数变换
      </p>
      <p style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>
        A 控制振幅，ω 控制周期，φ 控制相位，k 控制上下平移
      </p>

      <div style={{
        padding: '7px 10px',
        background: COLORS.surface,
        borderRadius: 10,
        border: `1px solid ${fnColor}44`,
        marginBottom: 12,
        overflowX: 'auto',
      }}>
        <KaTeXRenderer
          latex={formulaLatex}
          style={{ fontSize: 13, color: fnColor }}
        />
      </div>

      {/* ── Function type ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['sin', 'cos', 'tan'] as FnType[]).map((t) => (
          <FnTab key={t} type={t} active={fnType === t} onClick={() => setFnType(t)} />
        ))}
      </div>

      {/* ── Sliders ───────────────────────────────────────────────────────── */}
      <SliderRow
        label="A" value={transform.A}
        displayValue={Number.isInteger(transform.A) ? String(transform.A) : transform.A.toFixed(1)}
        min={-5} max={5} step={0.1}
        color={fnColor}
        onChange={([v]) => aSlider.handleChange(v)}
        onCommit={([v]) => aSlider.handleCommit(v)}
      />
      <SliderRow
        label="ω" value={transform.omega}
        displayValue={Number.isInteger(transform.omega) ? String(transform.omega) : transform.omega.toFixed(1)}
        min={0.1} max={5} step={0.1}
        color={fnColor}
        onChange={([v]) => omegaSlider.handleChange(v)}
        onCommit={([v]) => omegaSlider.handleCommit(v)}
      />
      <SliderRow
        label="φ" value={phiSlider.numericValue}
        displayValue={phiSlider.valueLabel}
        min={-Math.PI} max={Math.PI} step={phiSlider.step}
        color={COLORS.angleArc}
        onChange={phiSlider.handleChange}
        onCommit={phiSlider.handleCommit}
      />
      <SliderRow
        label="k" value={transform.k}
        displayValue={Number.isInteger(transform.k) ? String(transform.k) : transform.k.toFixed(1)}
        min={-5} max={5} step={0.1}
        color={fnColor}
        onChange={([v]) => kSlider.handleChange(v)}
        onCommit={([v]) => kSlider.handleCommit(v)}
      />

      <div style={{
        borderTop: `1px solid ${COLORS.border}`,
        marginTop: 8,
        paddingTop: 8,
        marginBottom: 6,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary, marginBottom: 6 }}>
          坐标范围
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: COLORS.surfaceAlt }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textSecondary, marginBottom: 4 }}>
              横轴 x
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="number"
                value={viewportDraft.xMin}
                onChange={(e) => { setViewportDraft((draft) => ({ ...draft, xMin: e.target.value })); setViewportError(null); }}
                onBlur={handleViewportCommit}
                style={rangeInputStyle}
              />
              <span style={{ fontSize: 10, color: COLORS.textSecondary }}>~</span>
              <input
                type="number"
                value={viewportDraft.xMax}
                onChange={(e) => { setViewportDraft((draft) => ({ ...draft, xMax: e.target.value })); setViewportError(null); }}
                onBlur={handleViewportCommit}
                style={rangeInputStyle}
              />
            </div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: 8, background: COLORS.surfaceAlt }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textSecondary, marginBottom: 4 }}>
              纵轴 y
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="number"
                value={viewportDraft.yMin}
                onChange={(e) => { setViewportDraft((draft) => ({ ...draft, yMin: e.target.value })); setViewportError(null); }}
                onBlur={handleViewportCommit}
                style={rangeInputStyle}
              />
              <span style={{ fontSize: 10, color: COLORS.textSecondary }}>~</span>
              <input
                type="number"
                value={viewportDraft.yMax}
                onChange={(e) => { setViewportDraft((draft) => ({ ...draft, yMax: e.target.value })); setViewportError(null); }}
                onBlur={handleViewportCommit}
                style={rangeInputStyle}
              />
            </div>
          </div>
        </div>
        {viewportError && (
          <div style={{ marginTop: 6, fontSize: 10, color: COLORS.errorDark }}>
            {viewportError}
          </div>
        )}
      </div>

      {/* ── Period & phase readout ────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
        padding: '6px 0', marginBottom: 4,
        borderTop: `1px solid ${COLORS.border}`, marginTop: 2,
      }}>
        <div>
          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>周期 T</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: fnColor, marginLeft: 4 }}>
            {transform.omega === 1 ? '2π' : `2π/${transform.omega.toFixed(1)}`}
            {' ≈ '}
            {(2 * Math.PI / transform.omega).toFixed(2)}
          </span>
        </div>
        <div>
          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>相移</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: COLORS.angleArc, marginLeft: 4 }}>
            {transform.phi === 0 ? '0' : (transform.phi > 0 ? '← ' : '→ ') + Math.abs(transform.phi / transform.omega).toFixed(2)}
          </span>
        </div>
      </div>

      {/* ── Reference curve toggle ────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, marginTop: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 0',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 500,
            color: showReference ? COLORS.textPrimary : COLORS.textSecondary,
          }}>
            {refLabel}
          </span>
          <Switch checked={showReference} onCheckedChange={setShowRef} />
        </div>
      </div>

    </div>
  );
}

const rangeInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  padding: '3px 4px',
  fontSize: 11,
  fontFamily: 'monospace',
  color: COLORS.textPrimary,
  background: COLORS.surface,
  border: `1px solid ${COLORS.borderMuted}`,
  borderRadius: 6,
  textAlign: 'right',
  outline: 'none',
};
