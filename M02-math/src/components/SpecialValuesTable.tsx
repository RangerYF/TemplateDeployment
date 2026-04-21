/**
 * SpecialValuesTable — M04 Phase 6
 *
 * Full KaTeX reference table for all 24 standard angles.
 *
 * Layout (scrollable):
 *  ┌──────┬──────────┬──────────┬──────────┐
 *  │  θ   │  sin θ   │  cos θ   │  tan θ   │
 *  ├──────┼──────────┼──────────┼──────────┤
 *  │  0   │    0     │    1     │    0     │
 *  │ π/12 │ (√6-√2)… │ (√6+√2)… │  2-√3   │
 *  │ π/6  │  1/2     │  √3/2    │  √3/3   │
 *  │ …    │  …       │  …       │  …      │
 *  └──────┴──────────┴──────────┴──────────┘
 *
 * Clicking any cell in a row animates the unit circle to that angle (200ms ease-out).
 * The row matching the current snapped angle is highlighted.
 */

import { useRef }              from 'react';
import { EXACT_VALUE_TABLE, lookupAngle } from '@/engine/exactValueEngine';
import { useUnitCircleStore }  from '@/editor/store/unitCircleStore';
import { KaTeXRenderer }       from '@/components/KaTeXRenderer';
import { startAnimation, easeOut } from '@/engine/rafAnimation';
import { COLORS }              from '@/styles/colors';
import { normalizeAngle }      from '@/engine/exactValueEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const COL_COLORS = {
  angle: COLORS.neutral,
  sin:   COLORS.sinColor,
  cos:   COLORS.cosColor,
  tan:   COLORS.tanColor,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SpecialValuesTable() {
  const angleRad   = useUnitCircleStore((s) => s.angleRad);
  const isSnapped  = useUnitCircleStore((s) => s.isSnapped);
  const cancelRef  = useRef<(() => void) | null>(null);

  // Determine which table row is currently active
  const normAngle   = normalizeAngle(angleRad);
  const activeIndex = isSnapped
    ? EXACT_VALUE_TABLE.findIndex((e) => Math.abs(e.angleDecimal - normAngle) < 1e-6)
    : -1;

  function handleCellClick(angleDecimal: number) {
    // Cancel any in-progress animation
    cancelRef.current?.();

    const currentAngle = useUnitCircleStore.getState().angleRad;

    cancelRef.current = startAnimation({
      from:     currentAngle,
      to:       angleDecimal,
      duration: 200,
      easing:   easeOut,
      onUpdate: (rad) => {
        const { snapped, snappedAngle, values } = lookupAngle(rad);
        useUnitCircleStore.getState().setAngle(snappedAngle, snapped, values);
      },
    });
  }

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 8 }}>
        特殊值速查表
      </p>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div style={{
        overflowY: 'auto',
        maxHeight: 340,
        borderRadius: 10,
        border: `1px solid ${COLORS.border}`,
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          tableLayout: 'fixed',
        }}>
          {/* ── Column header ─────────────────────────────────────────── */}
          <thead>
            <tr style={{ background: COLORS.surfaceLight, position: 'sticky', top: 0, zIndex: 1 }}>
              {(['θ', 'sin θ', 'cos θ', 'tan θ'] as const).map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: '5px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: i === 0 ? COL_COLORS.angle
                         : i === 1 ? COL_COLORS.sin
                         : i === 2 ? COL_COLORS.cos
                         : COL_COLORS.tan,
                    textAlign: 'center',
                    borderBottom: `1px solid ${COLORS.borderMuted}`,
                    letterSpacing: '0.3px',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Rows ──────────────────────────────────────────────────── */}
          <tbody>
            {EXACT_VALUE_TABLE.map((entry, idx) => {
              const isActive  = idx === activeIndex;
              const isUndef   = !isFinite(entry.tan.decimal);
              const rowBg     = isActive ? `${COLORS.primary}18` : idx % 2 === 0 ? COLORS.white : COLORS.surfaceAlt;

              function cellStyle(color: string): React.CSSProperties {
                return {
                  padding: '4px 3px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${COLORS.surfaceLight}`,
                  color: isActive ? color : COLORS.textSecondary,
                  transition: 'background 0.1s',
                };
              }

              return (
                <tr
                  key={idx}
                  style={{
                    background: rowBg,
                    outline: isActive ? `1px solid ${COLORS.primary}44` : 'none',
                  }}
                >
                  {/* θ cell */}
                  <td
                    onClick={() => handleCellClick(entry.angleDecimal)}
                    style={{
                      ...cellStyle(COL_COLORS.angle),
                      fontWeight: isActive ? 700 : 400,
                    }}
                  >
                    <KaTeXRenderer latex={entry.angleFraction} />
                  </td>

                  {/* sin cell */}
                  <td
                    onClick={() => handleCellClick(entry.angleDecimal)}
                    style={cellStyle(COL_COLORS.sin)}
                  >
                    <KaTeXRenderer latex={entry.sin.latex} />
                  </td>

                  {/* cos cell */}
                  <td
                    onClick={() => handleCellClick(entry.angleDecimal)}
                    style={cellStyle(COL_COLORS.cos)}
                  >
                    <KaTeXRenderer latex={entry.cos.latex} />
                  </td>

                  {/* tan cell */}
                  <td
                    onClick={() => handleCellClick(entry.angleDecimal)}
                    style={{
                      ...cellStyle(isUndef ? COLORS.error : COL_COLORS.tan),
                    }}
                  >
                    <KaTeXRenderer latex={entry.tan.latex} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 9, color: COLORS.textDisabled, marginTop: 6 }}>
        点击任意格跳转到对应角度（200ms 动画）
      </p>
    </div>
  );
}
