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
import { approximateValues }    from '@/engine/exactValueEngine';
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


  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>
          单位圆
        </span>
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 600,
            background: snapEnabled ? 'rgba(50,213,131,0.12)' : COLORS.surfaceLight,
            color:      snapEnabled ? COLORS.primary : COLORS.textSecondary,
            border:     `1px solid ${snapEnabled ? COLORS.primary : COLORS.borderMuted}`,
            borderRadius: 9999,
            cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          {...btnHover(
            snapEnabled ? 'rgba(50,213,131,0.20)' : COLORS.border,
            snapEnabled ? 'rgba(50,213,131,0.12)' : COLORS.surfaceLight,
          )}
        >
          <span style={{ fontSize: 8 }}>{snapEnabled ? '●' : '○'}</span>
          吸附
        </button>
      </div>

      {/* ── Angle display ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 10px',
        background: COLORS.surfaceAlt,
        borderRadius: 10,
        border: `1px solid ${isSnapped ? COLORS.primary : COLORS.border}`,
        transition: 'border-color 0.15s',
      }}>
        <span style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: 600 }}>θ = </span>
        <span style={{
          fontSize: 13,
          fontFamily: 'monospace',
          color: isSnapped ? COLORS.primary : COLORS.textPrimary,
          fontWeight: isSnapped ? 700 : 400,
        }}>
          {anglePi}
        </span>
        <span style={{ fontSize: 11, color: COLORS.textSecondary, marginLeft: 6 }}>
          ({angleDeg})
        </span>
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
