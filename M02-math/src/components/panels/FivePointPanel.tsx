/**
 * FivePointPanel — M04 Phase 4
 *
 * Stepwise navigator for the Five-Point Method (五点作图法).
 * Controls the `fivePointStep` in m04FunctionStore (0 = hidden, 1-5 = progressive).
 *
 * For each step the panel shows:
 *  - Which point is being added (role + canonical phase)
 *  - The derivation formula in KaTeX
 *  - Computed coordinates (formatted as π-fractions)
 *
 * Layout:
 *  ┌─────────────────────────────────────────┐
 *  │ 五点作图法          第 2/5 步            │
 *  │─────────────────────────────────────────│
 *  │ KaTeX derivation for current step        │
 *  │  (x = π/6,  y = A+k = 2)               │
 *  │─────────────────────────────────────────│
 *  │  ● ● ○ ○ ○    [← 上一步] [下一步 →]   │
 *  │               [      重置      ]        │
 *  └─────────────────────────────────────────┘
 */

import { useMemo } from 'react';
import { useM04FunctionStore }  from '@/editor/store/m04FunctionStore';
import { computeFivePoints }    from '@/engine/fivePointEngine';
import { KaTeXRenderer }        from '@/components/KaTeXRenderer';
import { COLORS }               from '@/styles/colors';
import { btnHover }             from '@/styles/interactionStyles';
import type { FivePointStep }   from '@/types';

// ─── Role colours ────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  zero: '零点',
  max:  '最大值',
  min:  '最小值',
};

const ROLE_COLOR: Record<string, string> = {
  zero: COLORS.textPrimary,
  max:  COLORS.sinColor,
  min:  COLORS.asymptote,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FivePointPanel() {
  const fnType        = useM04FunctionStore((s) => s.fnType);
  const transform     = useM04FunctionStore((s) => s.transform);
  const step          = useM04FunctionStore((s) => s.fivePointStep);
  const setStep       = useM04FunctionStore((s) => s.setFivePointStep);

  const points = useMemo(
    () => computeFivePoints(transform, fnType),
    [transform, fnType],
  );

  const isTan     = fnType === 'tan';
  const maxStep   = points.length as FivePointStep;
  const canPrev   = step > 0;
  const canNext   = step < maxStep && !isTan;

  const currentPt = step > 0 ? points[step - 1] : null;

  function prev() {
    if (canPrev) setStep((step - 1) as FivePointStep);
  }
  function next() {
    if (canNext) setStep((step + 1) as FivePointStep);
  }
  function reset() {
    setStep(0);
  }

  // ── btn style helper ────────────────────────────────────────────────────
  function btnStyle(enabled: boolean, accent = false): React.CSSProperties {
    return {
      flex: 1,
      padding: '5px 0',
      fontSize: 11, fontWeight: 600,
      borderRadius: 8,
      border: `1px solid ${enabled ? (accent ? COLORS.primary : COLORS.textDisabled) : COLORS.border}`,
      background: enabled ? (accent ? `${COLORS.primary}22` : COLORS.surfaceLight) : 'transparent',
      color: enabled ? (accent ? COLORS.primary : COLORS.borderMuted) : COLORS.borderMuted,
      cursor: enabled ? 'pointer' : 'not-allowed',
    };
  }

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary }}>
          五点作图法
        </span>
        {!isTan && (
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: COLORS.textSecondary }}>
            {step === 0 ? '未开始' : `第 ${step}/${maxStep} 步`}
          </span>
        )}
      </div>

      {/* ── Tan notice ──────────────────────────────────────────────────── */}
      {isTan && (
        <p style={{ fontSize: 11, color: COLORS.textDisabled, marginBottom: 8 }}>
          五点法适用于 sin / cos，请切换函数类型
        </p>
      )}

      {/* ── Derivation display ──────────────────────────────────────────── */}
      {!isTan && (
        <div style={{
          minHeight: 52,
          padding: '6px 8px',
          background: COLORS.surface,
          borderRadius: 10,
          border: `1px solid ${currentPt ? ROLE_COLOR[currentPt.role] + '55' : COLORS.border}`,
          marginBottom: 10,
        }}>
          {step === 0 ? (
            <p style={{ fontSize: 11, color: COLORS.textDisabled, textAlign: 'center', marginTop: 8 }}>
              点击「下一步」开始逐步推导
            </p>
          ) : currentPt ? (
            <>
              <p style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
                color: ROLE_COLOR[currentPt.role], marginBottom: 4,
              }}>
                {ROLE_LABEL[currentPt.role]}  P{step}
              </p>
              <KaTeXRenderer
                latex={currentPt.derivationLatex}
                style={{ fontSize: 12 }}
              />
              <p style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 4 }}>
                坐标: ({currentPt.xLatex.replace(/\\[a-z]+{/g, '').replace(/}/g, '').replace(/\\/g, '')}, {currentPt.y.toFixed(2)})
              </p>
            </>
          ) : null}
        </div>
      )}

      {/* ── Progress dots ───────────────────────────────────────────────── */}
      {!isTan && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
          {Array.from({ length: maxStep }, (_, i) => {
            const idx    = i + 1;
            const filled = idx <= step;
            const color  = filled ? (points[i] ? ROLE_COLOR[points[i].role] : COLORS.primary) : COLORS.borderMuted;
            return (
              <button
                key={i}
                onClick={() => setStep(idx as FivePointStep)}
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: filled ? color : 'transparent',
                  border: `1.5px solid ${color}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                {...btnHover(filled ? color : `${color}33`, filled ? color : 'transparent')}
                title={`P${idx}: ${points[i] ? ROLE_LABEL[points[i].role] : ''}`}
              />
            );
          })}
        </div>
      )}

      {/* ── Navigation buttons ──────────────────────────────────────────── */}
      {!isTan && (
        <>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <button onClick={prev} disabled={!canPrev} style={btnStyle(canPrev)}
              {...(canPrev ? btnHover(COLORS.surfaceHover, COLORS.surfaceLight) : {})}
            >
              ← 上一步
            </button>
            <button onClick={next} disabled={!canNext} style={btnStyle(canNext, true)}
              {...(canNext ? btnHover(`${COLORS.primary}44`, `${COLORS.primary}22`) : {})}
            >
              下一步 →
            </button>
          </div>
          <button
            onClick={reset}
            style={{ ...btnStyle(step > 0), width: '100%', flex: 'none' }}
            {...(step > 0 ? btnHover(COLORS.surfaceHover, COLORS.surfaceLight) : {})}
          >
            重置
          </button>
        </>
      )}

    </div>
  );
}
