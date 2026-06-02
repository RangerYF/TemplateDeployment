/**
 * UnitCirclePanel — M04 Phase 2
 *
 * Layout:
 *  ┌─────────────────────────────┐
 *  │ 单位圆   [吸附 ●]           │  ← header + snap toggle
 *  │ θ = π/3  (60.0°)           │  ← angle display
 *  ├──────┬──────┬──────┐        │
 *  │ sin  │ cos  │ tan  │        │  ← value grid
 *  │ √3/2 │ 1/2  │  √3  │        │
 *  └──────┴──────┴──────┘        │
 *  │ 函数: [sin] [cos] [tan]     │  ← fnType toggle (Phase 2)
 *  │ 显示: [√] 投影  [√] 弧      │  ← display toggles
 *  └─────────────────────────────┘
 *
 * Phase 1: plain-text trig values.
 * Phase 3: upgrade value cells to KaTeX renderer.
 */

import { useUnitCircleStore }   from '@/editor/store/unitCircleStore';
import { useM04FunctionStore }  from '@/editor/store/m04FunctionStore';
import { approximateValues, lookupAngle, normalizeAngle } from '@/engine/exactValueEngine';
import { formatPiLabel }        from '@/engine/piAxisEngine';
import { KaTeXRenderer }        from '@/components/KaTeXRenderer';
import { COLORS }               from '@/styles/colors';
import { btnHover }             from '@/styles/interactionStyles';
import { Switch }               from '@/components/ui/switch';
import type { ExactValue } from '@/types';


// ─── Value cell ───────────────────────────────────────────────────────────────

function ValueCell({
  label, value, color, isSnapped, isActive,
}: {
  label:    string;
  value:    ExactValue;
  color:    string;
  isSnapped: boolean;
  isActive:  boolean;
}) {
  const isUndef = !isFinite(value.decimal);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      padding: '6px 4px',
      background: isActive ? COLORS.primaryLight : COLORS.surfaceAlt,
      borderRadius: 10,
      border: `1px solid ${isActive ? `${COLORS.primary}33` : isSnapped ? COLORS.canvasBorder : COLORS.border}`,
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: 600, letterSpacing: '0.5px' }}>
        {label}
      </span>
      {isUndef ? (
        <span style={{ fontSize: 11, color: COLORS.error }}>不存在</span>
      ) : isSnapped && value.isExact ? (
        <KaTeXRenderer
          latex={value.latex}
          style={{ fontSize: 11, color: isActive ? color : COLORS.neutral, fontWeight: isActive ? 700 : 400 }}
        />
      ) : (
        <span style={{
          fontSize: 12,
          fontFamily: 'monospace',
          color: isActive ? color : COLORS.neutral,
          fontWeight: isActive ? 700 : 400,
        }}>
          {value.decimal.toFixed(4)}
        </span>
      )}
    </div>
  );
}


// ─── Component ────────────────────────────────────────────────────────────────

export function UnitCirclePanel() {
  const angleRad      = useUnitCircleStore((s) => s.angleRad);
  const isSnapped     = useUnitCircleStore((s) => s.isSnapped);
  const snappedValues = useUnitCircleStore((s) => s.snappedValues);
  const snapEnabled   = useUnitCircleStore((s) => s.snapEnabled);
  const setSnapEnabled = useUnitCircleStore((s) => s.setSnapEnabled);

  const showProjections   = useUnitCircleStore((s) => s.showProjections);
  const showAngleArc      = useUnitCircleStore((s) => s.showAngleArc);
  const showLabels        = useUnitCircleStore((s) => s.showLabels);
  const showQuadrantHints = useUnitCircleStore((s) => s.showQuadrantHints);
  const setDisplayOption  = useUnitCircleStore((s) => s.setDisplayOption);

  const fnType = useM04FunctionStore((s) => s.fnType);

  // Use exact values when snapped, otherwise approximate
  const values = snappedValues ?? approximateValues(angleRad);

  const anglePi  = formatPiLabel(angleRad);
  const angleDeg = `${(angleRad * 180 / Math.PI).toFixed(1)}°`;

  type DisplayKey = 'showProjections' | 'showAngleArc' | 'showLabels' | 'showQuadrantHints';

  const DISPLAY_OPTS: Array<[DisplayKey, string]> = [
    ['showProjections',   '投影线'],
    ['showAngleArc',      '角度弧'],
    ['showLabels',        '标签'],
    ['showQuadrantHints', '象限提示'],
  ];

  const optVals: Record<DisplayKey, boolean> = {
    showProjections, showAngleArc, showLabels, showQuadrantHints,
  };

  const handleSnapToggle = () => {
    const next = !snapEnabled;
    setSnapEnabled(next);

    const currentAngle = useUnitCircleStore.getState().angleRad;
    if (next) {
      const { snapped, snappedAngle, values } = lookupAngle(currentAngle);
      useUnitCircleStore.getState().setAngle(snappedAngle, snapped, values);
    } else {
      useUnitCircleStore.getState().setAngle(normalizeAngle(currentAngle), false, null);
    }
  };


  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
          单位圆
        </span>
        <button
          onClick={handleSnapToggle}
          title="拖动时吸附到常用特殊角"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            fontSize: 13,
            fontWeight: 800,
            background: snapEnabled ? COLORS.snapAccentLight : COLORS.surfaceLight,
            color:      snapEnabled ? COLORS.snapAccent : COLORS.textSecondary,
            border:     `2px solid ${snapEnabled ? COLORS.snapAccent : COLORS.borderMuted}`,
            borderRadius: 9999,
            cursor: 'pointer',
            boxShadow: snapEnabled ? `0 0 0 3px rgba(109,40,217,0.14)` : 'none',
            transition: 'background 0.12s, box-shadow 0.12s, border-color 0.12s',
          }}
          {...btnHover(
            snapEnabled ? '#DDD6FE' : COLORS.border,
            snapEnabled ? COLORS.snapAccentLight : COLORS.surfaceLight,
          )}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>{snapEnabled ? '●' : '○'}</span>
          特殊角吸附
        </button>
      </div>

      {/* ── Angle display ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 12px',
        background: isSnapped ? COLORS.snapAccentLight : COLORS.surfaceAlt,
        borderRadius: 10,
        border: `2px solid ${isSnapped ? COLORS.snapAccent : COLORS.border}`,
        boxShadow: isSnapped ? `0 0 0 3px rgba(109,40,217,0.10)` : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
      }}>
        <span style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 700 }}>θ = </span>
        <span style={{
          fontSize: 16,
          fontFamily: 'monospace',
          color: isSnapped ? COLORS.snapAccent : COLORS.textPrimary,
          fontWeight: isSnapped ? 800 : 500,
        }}>
          {anglePi}
        </span>
        <span style={{ fontSize: 12, color: COLORS.textSecondary, marginLeft: 8, fontWeight: 600 }}>
          ({angleDeg})
        </span>
        {snapEnabled && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 800,
              color: COLORS.snapAccent,
            }}
          >
            {isSnapped ? '已吸附' : '吸附开启'}
          </span>
        )}
      </div>

      {/* ── Trig value grid ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4 }}>
        <ValueCell
          label="sin θ" value={values.sin} color={COLORS.sinColor}
          isSnapped={isSnapped} isActive={fnType === 'sin'}
        />
        <ValueCell
          label="cos θ" value={values.cos} color={COLORS.cosColor}
          isSnapped={isSnapped} isActive={fnType === 'cos'}
        />
        <ValueCell
          label="tan θ" value={values.tan} color={COLORS.tanColor}
          isSnapped={isSnapped} isActive={fnType === 'tan'}
        />
      </div>

      {/* ── Display options ─────────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: COLORS.textSecondary,
          marginBottom: 8,
        }}>
          显示
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {DISPLAY_OPTS.map(([key, label]) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 0',
            }}>
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: optVals[key] ? COLORS.textPrimary : COLORS.textSecondary,
                transition: 'color 120ms',
              }}>
                {label}
              </span>
              <Switch
                checked={optVals[key]}
                onCheckedChange={(v) => setDisplayOption(key, v)}
              />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
