/**
 * AnimationHUD — Semi-transparent overlay in the canvas corner showing
 * real-time parameter values during animation playback.
 *
 * Only visible when an animation is actively running.
 */

import { useFunctionStore } from '@/editor/store/functionStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { useParamAnimationStore } from '@/editor/store/paramAnimationStore';
import { buildReadableExpr } from '@/engine/functionTemplates';
import type { Transform } from '@/types';
import { COLORS } from '@/styles/colors';

export function AnimationHUD() {
  const isAnimating = useAnimationStore((s) => s.isAnyAnimating);
  const playState   = useParamAnimationStore((s) => s.playState);
  const params      = useParamAnimationStore((s) => s.params);

  const activeFn = useFunctionStore((s) =>
    s.functions.find((f) => f.id === s.activeFunctionId) ?? null,
  );

  // Only show when animation is actively playing/paused
  if (!isAnimating && playState === 'idle') return null;
  if (!activeFn) return null;

  const enabledParams = params.filter((p) => p.enabled);
  if (enabledParams.length === 0) return null;

  // Read current live values from the function
  const liveValues: { label: string; value: number }[] = enabledParams.map((p) => {
    let value = 0;
    if (p.key.startsWith('transform.')) {
      const tk = p.key.split('.')[1] as keyof Transform;
      value = activeFn.transform[tk];
    } else if (p.key.startsWith('named.')) {
      const name = p.key.split('.')[1];
      const np = activeFn.namedParams.find((np) => np.name === name);
      value = np?.value ?? 0;
    }
    return { label: p.label, value };
  });

  return (
    <div style={containerStyle}>
      {/* Function name + expression */}
      <div style={headerStyle}>
        <span style={labelBadgeStyle}>{activeFn.label}</span>
        <span style={exprStyle}>
          y = {buildReadableExpr(activeFn.exprStr)}
        </span>
      </div>

      {/* Animated parameter values */}
      <div style={paramsContainerStyle}>
        {liveValues.map(({ label, value }) => (
          <div key={label} style={paramRowStyle}>
            <span style={paramNameStyle}>{label}</span>
            <span style={paramEqStyle}>=</span>
            <span style={paramValueStyle}>{value.toFixed(3)}</span>
          </div>
        ))}
      </div>

      {/* Play state indicator */}
      {playState === 'paused' && (
        <div style={pausedStyle}>⏸ 已暂停</div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  left: 10,
  zIndex: 20,
  minWidth: 160,
  padding: '8px 12px',
  background: 'rgba(17, 24, 39, 0.82)',
  backdropFilter: 'blur(8px)',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  pointerEvents: 'none',
  fontFamily: 'monospace',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '6px',
};

const labelBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: COLORS.primary,
  background: COLORS.primaryFocusRing,
  padding: '1px 5px',
  borderRadius: '4px',
  flexShrink: 0,
};

const exprStyle: React.CSSProperties = {
  fontSize: '11px',
  color: COLORS.borderMuted,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const paramsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const paramRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '4px',
};

const paramNameStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: COLORS.primary,
  minWidth: '16px',
};

const paramEqStyle: React.CSSProperties = {
  fontSize: '12px',
  color: COLORS.textSecondary,
};

const paramValueStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: COLORS.canvasText,
  fontVariantNumeric: 'tabular-nums',
};

const pausedStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#FBBF24',
  marginTop: '4px',
};
