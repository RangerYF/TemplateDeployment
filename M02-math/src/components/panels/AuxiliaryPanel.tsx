/**
 * AuxiliaryPanel — M04 Phase 4
 *
 * Controls for the Auxiliary Angle Synthesis demo (辅助角合成).
 * Lets the user input coefficients a and b, then displays:
 *   a·sin x + b·cos x  =  R·sin(x + φ)
 *
 * Canvas (FunctionGraphCanvas) shows 3 overlaid curves when `showAuxiliary` is on:
 *   ─ ─ ─  a·sin x         (blue dashed)
 *   ─ ─ ─  b·cos x         (amber dashed)
 *   ─────  R·sin(x + φ)    (green solid)
 *
 * Layout:
 *  ┌──────────────────────────────────────────┐
 *  │ 辅助角合成   [ON/OFF]                     │
 *  │──────────────────────────────────────────│
 *  │  a = [____]   b = [____]                 │
 *  │──────────────────────────────────────────│
 *  │  a sin x + b cos x = √2 sin(x + π/4)    │ ← KaTeX
 *  │──────────────────────────────────────────│
 *  │  [■] a·sin x (蓝)                        │
 *  │  [■] b·cos x (橙)                        │
 *  │  [■] R·sin(x+φ) (绿)                     │
 *  └──────────────────────────────────────────┘
 */

import { useState } from 'react';
import { useM04FunctionStore }      from '@/editor/store/m04FunctionStore';
import { synthesizeAuxiliaryAngle } from '@/engine/auxiliaryAngleEngine';
import { KaTeXRenderer }            from '@/components/KaTeXRenderer';
import { COLORS }                   from '@/styles/colors';
import { btnHover, focusRing }      from '@/styles/interactionStyles';
import { Switch }                   from '@/components/ui/switch';

// ─── Curve legend entry ───────────────────────────────────────────────────────

function CurveLegend({
  color, dash, label, checked, onChange,
}: {
  color:    string;
  dash:     boolean;
  label:    string;
  checked:  boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 0', marginBottom: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block', width: 20, height: 2,
          background: dash ? 'transparent' : color,
          borderTop: dash ? `2px dashed ${color}` : 'none',
        }} />
        <span style={{ fontSize: 13, fontWeight: 500, color }}>{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── Number input ─────────────────────────────────────────────────────────────

function CoeffInput({
  label, value, onChange,
}: {
  label:    string;
  value:    number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  function commit(raw: string) {
    const n = parseFloat(raw);
    if (isFinite(n) && n !== 0) { onChange(n); setDraft(String(n)); }
    else setDraft(String(value));
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: COLORS.primary, minWidth: 16 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: COLORS.textSecondary }}>=</span>
      <input
        type="number"
        value={draft}
        step={0.5}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit(draft)}
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
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        {...focusRing(COLORS.primary, COLORS.primaryFocusRing, COLORS.borderMuted, { onBlur: (e) => commit((e.target as HTMLInputElement).value) })}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AuxiliaryPanel() {
  const showAuxiliary = useM04FunctionStore((s) => s.showAuxiliary);
  const auxiliaryA    = useM04FunctionStore((s) => s.auxiliaryA);
  const auxiliaryB    = useM04FunctionStore((s) => s.auxiliaryB);
  const auxShowC1     = useM04FunctionStore((s) => s.auxShowC1);
  const auxShowC2     = useM04FunctionStore((s) => s.auxShowC2);
  const auxShowCR     = useM04FunctionStore((s) => s.auxShowCR);

  const setShowAuxiliary = useM04FunctionStore((s) => s.setShowAuxiliary);
  const setAuxiliaryA    = useM04FunctionStore((s) => s.setAuxiliaryA);
  const setAuxiliaryB    = useM04FunctionStore((s) => s.setAuxiliaryB);
  const setAuxShowC1     = useM04FunctionStore((s) => s.setAuxShowC1);
  const setAuxShowC2     = useM04FunctionStore((s) => s.setAuxShowC2);
  const setAuxShowCR     = useM04FunctionStore((s) => s.setAuxShowCR);

  const result = synthesizeAuxiliaryAngle(auxiliaryA, auxiliaryB);

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* ── Header + toggle ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>
          辅助角合成
        </span>
        <button
          onClick={() => setShowAuxiliary(!showAuxiliary)}
          style={{
            padding: '3px 10px',
            fontSize: 11, fontWeight: 600,
            borderRadius: 9999,
            border: `1px solid ${showAuxiliary ? COLORS.primary : COLORS.borderMuted}`,
            background: showAuxiliary ? `${COLORS.primary}22` : COLORS.surfaceLight,
            color: showAuxiliary ? COLORS.primary : COLORS.textSecondary,
            cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          {...btnHover(
            showAuxiliary ? `${COLORS.primary}33` : COLORS.border,
            showAuxiliary ? `${COLORS.primary}22` : COLORS.surfaceLight,
          )}
        >
          {showAuxiliary ? '演示中 ●' : '开始演示'}
        </button>
      </div>

      {/* ── Coefficient inputs ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <CoeffInput label="a" value={auxiliaryA} onChange={setAuxiliaryA} />
        <CoeffInput label="b" value={auxiliaryB} onChange={setAuxiliaryB} />
      </div>

      {/* ── Synthesized formula ─────────────────────────────────────────── */}
      <div style={{
        padding: '6px 8px',
        background: COLORS.surface,
        borderRadius: 10,
        border: `1px solid ${COLORS.primary}44`,
        marginBottom: 10,
        overflowX: 'auto',
      }}>
        <KaTeXRenderer
          latex={result.formulaLatex}
          style={{ fontSize: 12, color: COLORS.primary }}
        />
      </div>

      {/* ── Curve visibility legend ─────────────────────────────────────── */}
      {showAuxiliary && (
        <div>
          <CurveLegend
            color={COLORS.auxiliaryCurve1} dash
            label={`${auxiliaryA}·sin x`}
            checked={auxShowC1} onChange={setAuxShowC1}
          />
          <CurveLegend
            color={COLORS.auxiliaryCurve2} dash
            label={`${auxiliaryB}·cos x`}
            checked={auxShowC2} onChange={setAuxShowC2}
          />
          <CurveLegend
            color={COLORS.primary} dash={false}
            label={`${result.RLatex}·sin(x+${result.phiLatex.replace(/\\[a-z]+{[^}]+}/g, 'φ').replace(/\\/g, '')})`}
            checked={auxShowCR} onChange={setAuxShowCR}
          />
        </div>
      )}

    </div>
  );
}
