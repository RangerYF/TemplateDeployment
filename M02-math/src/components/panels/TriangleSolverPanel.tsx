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

import { useState } from 'react';
import { useTriangleSolverStore } from '@/editor/store/triangleSolverStore';
import { solveSolveMode }         from '@/engine/triangleSolver';
import { COLORS }                 from '@/styles/colors';
import { btnHover, focusRing }    from '@/styles/interactionStyles';
import type { SolveMode, Triangle } from '@/types';

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

const R2D = 180 / Math.PI;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeTab({ mode, active, onClick }: { mode: SolveMode; active: boolean; onClick: () => void }) {
  return (
    <button
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

  function commit(raw: string) {
    const n = parseFloat(raw);
    if (isFinite(n) && n > 0) { onChange(n); setDraft(String(n)); }
    else setDraft(String(value));
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ width: 48, fontSize: 11, color: COLORS.neutral }}>{def.hint}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: COLORS.primary, minWidth: 12 }}>
          {def.label}
        </span>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>=</span>
        <input
          type="number"
          value={draft}
          step={def.isAngle ? 1 : 0.5}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
          {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.borderMuted, { onBlur: (e) => commit((e.target as HTMLInputElement).value) })}
          style={{
            flex: 1,
            padding: '3px 6px',
            fontSize: 12, fontFamily: 'monospace',
            background: COLORS.surface,
            border: `1px solid ${COLORS.borderMuted}`,
            borderRadius: 8,
            color: COLORS.textPrimary,
            outline: 'none',
            textAlign: 'right',
          }}
        />
        {def.isAngle && <span style={{ fontSize: 11, color: COLORS.textSecondary }}>°</span>}
      </div>
    </div>
  );
}

function TriangleInfo({ triangle, color }: { triangle: Triangle; color: string }) {
  const rows = [
    ['a', triangle.a.toFixed(4)],
    ['b', triangle.b.toFixed(4)],
    ['c', triangle.c.toFixed(4)],
    ['A', `${(triangle.A * R2D).toFixed(2)}°`],
    ['B', `${(triangle.B * R2D).toFixed(2)}°`],
    ['C', `${(triangle.C * R2D).toFixed(2)}°`],
    ['面积 S', triangle.area.toFixed(4)],
    ['周长 L', triangle.perimeter.toFixed(4)],
    ['外接圆 R', triangle.circumradius.toFixed(4)],
    ['内切圆 r', triangle.inradius.toFixed(4)],
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
          <span style={{ fontSize: 10, color, fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
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

      {/* ── Mode tabs ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {(['SSS', 'SAS', 'ASA', 'AAS', 'SSA'] as SolveMode[]).map((m) => (
          <ModeTab key={m} mode={m} active={mode === m} onClick={() => setMode(m)} />
        ))}
      </div>

      {/* ── Mode hint ────────────────────────────────────────────────── */}
      <p style={{ fontSize: 10, color: COLORS.textDisabled, marginBottom: 8 }}>
        {mode === 'SSA' ? 'SSA 可能有 0 / 1 / 2 个解' : `${mode} — 唯一解`}
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
