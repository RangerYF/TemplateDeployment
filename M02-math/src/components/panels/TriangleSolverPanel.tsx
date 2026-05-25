/**
 * TriangleSolverPanel — M04 Phase 5
 *
 * Right-panel UI for the triangle solver.
 *
 * Layout:
 *  ┌────────────────────────────────────────┐
 *  │ 三角形解算                              │
 *  │ [SSS] [SAS] [ASA] [AAS] [SSA]          │
 *  │─────────────────────────────────────────│
 *  │ Dynamic inputs (mode-specific)          │
 *  │─────────────────────────────────────────│
 *  │           [  解 算  ]                   │
 *  │─────────────────────────────────────────│
 *  │ Result: triangle info / error           │
 *  └────────────────────────────────────────┘
 */

import { useEffect, useState } from 'react';
import { useTriangleSolverStore } from '@/editor/store/triangleSolverStore';
import { solveSolveMode }         from '@/engine/triangleSolver';
import { COLORS }                 from '@/styles/colors';
import { btnHover, focusRing }    from '@/styles/interactionStyles';
import type { SolveMode, Triangle } from '@/types';
import { KaTeXRenderer } from '@/components/KaTeXRenderer';
import { Switch } from '@/components/ui/switch';
import {
  parsePositiveMathInput,
  formatTeachingAngleDeg,
  formatExactWithApprox,
  toKatexInline,
} from '@/engine/triangleDisplay';

// ─── Mode definitions ─────────────────────────────────────────────────────────

type FieldDef = { key: string; label: string; hint: string; isAngle?: boolean };

const MODE_FIELDS: Record<SolveMode, FieldDef[]> = {
  SSS: [
    { key: 'a', label: 'a', hint: '边 a' },
    { key: 'b', label: 'b', hint: '边 b' },
    { key: 'c', label: 'c', hint: '边 c' },
  ],
  SAS: [
    { key: 'a', label: 'a', hint: '边 a' },
    { key: 'C', label: 'C', hint: '夹角 C（°）', isAngle: true },
    { key: 'b', label: 'b', hint: '边 b' },
  ],
  ASA: [
    { key: 'A', label: 'A', hint: '角 A（°）', isAngle: true },
    { key: 'c', label: 'c', hint: '夹边 c' },
    { key: 'B', label: 'B', hint: '角 B（°）', isAngle: true },
  ],
  AAS: [
    { key: 'A', label: 'A', hint: '角 A（°）', isAngle: true },
    { key: 'B', label: 'B', hint: '角 B（°）', isAngle: true },
    { key: 'a', label: 'a', hint: '边 a（A 对边）' },
  ],
  SSA: [
    { key: 'a', label: 'a', hint: '边 a（A 对边）' },
    { key: 'b', label: 'b', hint: '边 b' },
    { key: 'A', label: 'A', hint: '角 A（°）', isAngle: true },
  ],
};

const MODE_LABELS: Record<SolveMode, string> = {
  SSS: '三边已知',
  SAS: '两边及夹角已知',
  ASA: '两角及夹边已知',
  AAS: '两角及一边已知',
  SSA: '两边及一对角已知',
};
const R2D = 180 / Math.PI;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeTab({ mode, active, onClick }: { mode: SolveMode; active: boolean; onClick: () => void }) {
  return (
    <button
      title={MODE_LABELS[mode]}
      onClick={onClick}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = COLORS.surfaceHover; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      style={{
        flex: 1,
        padding: '4px 0',
        fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
        borderRadius: 8,
        border: `1px solid ${active ? COLORS.primary : COLORS.borderMuted}`,
        background: active ? `${COLORS.primary}22` : 'transparent',
        color: active ? COLORS.primary : COLORS.textSecondary,
        cursor: 'pointer',
      }}
    >
      {mode}
    </button>
  );
}

function FieldInput({
  def, value, onChange,
}: {
  def: FieldDef;
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(raw: string) {
    const n = parsePositiveMathInput(raw);
    if (n !== null) {
      onChange(n);
      setDraft(raw.trim());
      setError(null);
      return;
    }
    setDraft(String(value));
    setError(def.isAngle ? '请输入大于 0 的角度' : '请输入大于 0 的数值');
  }

  function adjustBy(delta: number) {
    const base = parsePositiveMathInput(draft) ?? value;
    const next = Math.max(0.1, Math.round((base + delta) * 10) / 10);
    onChange(next);
    setDraft(String(next));
    setError(null);
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 48, fontSize: 11, color: COLORS.neutral }}>{def.hint}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: COLORS.primary, minWidth: 12 }}>
          {def.label}
        </span>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>=</span>
        <input
          type="text"
          value={draft}
          inputMode="decimal"
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
          {...focusRing(
            COLORS.primary,
            COLORS.primaryFocusRing,
            error ? COLORS.errorBorder : COLORS.borderMuted,
            { onBlur: (e) => commit((e.target as HTMLInputElement).value) },
          )}
          style={{
            flex: 1,
            padding: '3px 6px',
            fontSize: 12, fontFamily: 'monospace',
            background: COLORS.surface,
            border: `1px solid ${error ? COLORS.errorBorder : COLORS.borderMuted}`,
            borderRadius: 8,
            color: error ? COLORS.errorDark : COLORS.textPrimary,
            outline: 'none',
            textAlign: 'right',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            type="button"
            onClick={() => adjustBy(0.1)}
            style={stepBtnStyle}
            title="增加 0.1"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => adjustBy(-0.1)}
            style={stepBtnStyle}
            title="减少 0.1"
          >
            ▼
          </button>
        </div>
        {def.isAngle && <span style={{ fontSize: 11, color: COLORS.textSecondary }}>°</span>}
      </div>
      </div>
      {error && (
        <div style={{ paddingLeft: 54, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: COLORS.errorDark }}>⚠ {error}</span>
        </div>
      )}
    </div>
  );
}

function TriangleInfo({ triangle, color }: { triangle: Triangle; color: string }) {
  const rows = [
    ['a', formatExactWithApprox(triangle.a)],
    ['b', formatExactWithApprox(triangle.b)],
    ['c', formatExactWithApprox(triangle.c)],
    ['A', formatTeachingAngleDeg(triangle.A * R2D)],
    ['B', formatTeachingAngleDeg(triangle.B * R2D)],
    ['C', formatTeachingAngleDeg(triangle.C * R2D)],
    ['面积 S', formatExactWithApprox(triangle.area)],
    ['周长 L', formatExactWithApprox(triangle.perimeter)],
    ['外接圆 R', formatExactWithApprox(triangle.circumradius)],
    ['内切圆 r', formatExactWithApprox(triangle.inradius)],
  ];

  return (
    <div style={{
      padding: '6px 8px',
      background: COLORS.surface,
      borderRadius: 6,
      border: `1px solid ${color}44`,
      marginTop: 6,
    }}>
      {rows.map(([k, v]) => (
        <div
          key={k}
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}
        >
          <span style={{ fontSize: 10, color: COLORS.textSecondary, fontFamily: 'monospace' }}>{k}</span>
          <span style={{ fontSize: 10, color, fontFamily: 'monospace', fontWeight: 600 }}>
            {v.includes('√') || v.includes('/') ? (
              <KaTeXRenderer
                latex={v
                  .split('≈')
                  .map((part) => toKatexInline(part.trim().replace('°', '')) + (part.trim().endsWith('°') ? '^\\circ' : ''))
                  .join('\\;\\approx\\;')}
              />
            ) : v}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TriangleSolverPanel() {
  const mode = useTriangleSolverStore((s) => s.mode);
  const inputs = useTriangleSolverStore((s) => s.inputs);
  const setMode = useTriangleSolverStore((s) => s.setMode);
  const setInput = useTriangleSolverStore((s) => s.setInput);
  const setResult = useTriangleSolverStore((s) => s.setResult);
  const result = useTriangleSolverStore((s) => s.result);
  const canvasMode = useTriangleSolverStore((s) => s.canvasMode);
  const setCanvasMode = useTriangleSolverStore((s) => s.setCanvasMode);
  const auxiliaryOptions = useTriangleSolverStore((s) => s.auxiliaryOptions);
  const setAuxiliaryOption = useTriangleSolverStore((s) => s.setAuxiliaryOption);
  const rangeDemo = useTriangleSolverStore((s) => s.rangeDemo);
  const setRangeDemo = useTriangleSolverStore((s) => s.setRangeDemo);

  function handleSolve() {
    const r = solveSolveMode(mode, inputs);
    setResult(r);
  }

  const fields = MODE_FIELDS[mode];

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>
          三角形解算
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button
          onClick={() => setCanvasMode('solve')}
          style={modeTabStyle(canvasMode === 'solve')}
        >
          解算结果
        </button>
        <button
          onClick={() => setCanvasMode('range-demo')}
          style={modeTabStyle(canvasMode === 'range-demo')}
        >
          范围演示
        </button>
      </div>

      {canvasMode === 'range-demo' && (
        <div style={{ marginBottom: 14, padding: '10px 10px 8px', borderRadius: 10, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}` }}>
          <p style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 8 }}>
            用一个已知边和一个已知角，观察第三个顶点可能落在怎样的范围上。
          </p>
          <FieldInput def={{ key: 'sideLength', label: '边', hint: '已知边长' }} value={rangeDemo.sideLength} onChange={(v) => setRangeDemo({ sideLength: v })} />
          <FieldInput def={{ key: 'angleDeg', label: '角', hint: '已知角（°）', isAngle: true }} value={rangeDemo.angleDeg} onChange={(v) => setRangeDemo({ angleDeg: v })} />
          <FieldInput def={{ key: 'sampleRatio', label: '位', hint: '顶点位置比例' }} value={rangeDemo.sampleRatio} onChange={(v) => setRangeDemo({ sampleRatio: Math.max(0.1, Math.min(0.9, v)) })} />
          <p style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>
            浅绿色一簇三角形表示满足条件的可能图像范围；“位”用于选择其中一个示意位置。
          </p>
        </div>
      )}

      {/* ── Mode tabs ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {(['SSS', 'SAS', 'ASA', 'AAS', 'SSA'] as SolveMode[]).map((m) => (
          <ModeTab key={m} mode={m} active={mode === m} onClick={() => setMode(m)} />
        ))}
      </div>

      {/* ── Mode hint ────────────────────────────────────────────────── */}
      <p style={{ fontSize: 10, color: COLORS.textDisabled, marginBottom: 8 }}>
        {mode === 'SSA'
          ? `${mode} · ${MODE_LABELS[mode]}，可能有 0 / 1 / 2 个解`
          : `${mode} · ${MODE_LABELS[mode]}，通常为唯一解`}
      </p>

      {/* ── Inputs ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 10 }}>
        {fields.map((def) => (
          <FieldInput
            key={def.key}
            def={def}
            value={inputs[def.key] ?? 1}
            onChange={(v) => setInput(def.key, v)}
          />
        ))}
      </div>

      <div style={{ marginBottom: 12, padding: '10px 10px 8px', borderRadius: 10, background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}` }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 6 }}>
          辅助线
        </p>
        {[
          ['showMedians', '中线'],
          ['showAngleBisectors', '角平分线'],
          ['showAltitudes', '高线'],
          ['showPerpBisectors', '中垂线'],
          ['showCentroid', '重心'],
          ['showCircumcenter', '外心'],
        ].map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ fontSize: 12, color: auxiliaryOptions[key as keyof typeof auxiliaryOptions] ? COLORS.textPrimary : COLORS.textSecondary }}>
              {label}
            </span>
            <Switch
              checked={auxiliaryOptions[key as keyof typeof auxiliaryOptions]}
              onCheckedChange={(v) => setAuxiliaryOption(key as keyof typeof auxiliaryOptions, v)}
            />
          </div>
        ))}
      </div>

      {/* ── Solve button ─────────────────────────────────────────────── */}
      <button
        onClick={handleSolve}
        {...btnHover(`${COLORS.primary}44`, `${COLORS.primary}22`)}
        style={{
          width: '100%',
          padding: '6px 0',
          fontSize: 12, fontWeight: 700,
          borderRadius: 9999,
          border: `1px solid ${COLORS.primary}`,
          background: `${COLORS.primary}22`,
          color: COLORS.primary,
          cursor: 'pointer',
          marginBottom: 10,
        }}
      >
        解 算
      </button>

      {/* ── Result ───────────────────────────────────────────────────── */}
      {result && !result.valid && (
        <div style={{
          padding: '6px 8px',
          background: COLORS.surface,
          borderRadius: 6,
          border: `1px solid ${COLORS.error}44`,
        }}>
          <span style={{ fontSize: 11, color: COLORS.error }}>⚠ {result.reason}</span>
        </div>
      )}

      {result?.valid && result.case === 'unique' && (
        <>
          <p style={{ fontSize: 10, color: COLORS.primary, marginBottom: 2, fontWeight: 700 }}>
            唯一解
          </p>
          <TriangleInfo triangle={result.triangle} color={COLORS.primary} />
        </>
      )}

      {result?.valid && result.case === 'two-solutions' && (
        <>
          <p style={{ fontSize: 10, color: COLORS.textPrimary, marginBottom: 2, fontWeight: 700 }}>
            两解（SSA 二义性）
          </p>
          <p style={{ fontSize: 10, color: COLORS.triangleSolution1, marginBottom: 0, fontWeight: 600 }}>
            解 1
          </p>
          <TriangleInfo triangle={result.triangle1} color={COLORS.triangleSolution1} />
          <p style={{ fontSize: 10, color: COLORS.triangleSolution2, marginTop: 8, marginBottom: 0, fontWeight: 600 }}>
            解 2
          </p>
          <TriangleInfo triangle={result.triangle2} color={COLORS.triangleSolution2} />
        </>
      )}

    </div>
  );
}

const stepBtnStyle: React.CSSProperties = {
  width: 18,
  height: 14,
  padding: 0,
  borderRadius: 4,
  border: `1px solid ${COLORS.borderMuted}`,
  background: COLORS.surface,
  color: COLORS.textSecondary,
  cursor: 'pointer',
  fontSize: 9,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function modeTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '5px 0',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 9999,
    border: `1px solid ${active ? COLORS.primary : COLORS.borderMuted}`,
    background: active ? `${COLORS.primary}22` : 'transparent',
    color: active ? COLORS.primary : COLORS.textSecondary,
    cursor: active ? 'default' : 'pointer',
  };
}
