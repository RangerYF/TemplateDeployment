/**
 * EccentricityPanel — Phase 7
 *
 * Controls:
 *   - e slider (0.01 → 2.0) for manual eccentricity adjustment
 *   - ▶ Play button: animates e from 0.1 → 1.9 over 2 s
 *   - ■ Stop button: cancels the running animation
 *
 * Behaviour:
 *   - Dragging the slider: direct store update (no Command) — live preview
 *   - Releasing slider:    one UpdateCurveParamCommand for Undo/Redo
 *   - Play animation end:  one UpdateCurveParamCommand for Undo/Redo
 *   - Stop pressed:        animation stops, NO Undo entry
 *   - Disabled for circle entities (e is always 0)
 */

import { useRef, useState, useEffect } from 'react';
import { Play, Square } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useActiveConic } from '@/hooks/useActiveEntity';
import { useEntityStore }  from '@/editor/store/entityStore';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { UpdateCurveParamCommand } from '@/editor/commands/UpdateCurveParamCommand';
import {
  getEntityEccentricity,
  getEntityFixedC,
  applyEccentricityToEntity,
  startEccentricityAnimation,
} from '@/engine/eccentricityEngine';
import { COLORS } from '@/styles/colors';
import { btnHover } from '@/styles/interactionStyles';
import type { ConicEntity } from '@/types';
import { isConicEntity } from '@/types';

// ─── Type label ───────────────────────────────────────────────────────────────

function eccentricityTypeLabel(e: number): string {
  if (e < 1 - 1e-6) return '椭圆';
  if (Math.abs(e - 1) < 1e-6) return '抛物线';
  return '双曲线';
}

// ─── Zone bar ─────────────────────────────────────────────────────────────────

/** Visual bar showing ellipse / parabola / hyperbola zones with current e marker. */
export function EccentricityZoneBar({
  e,
  color,
}: {
  e:     number;
  color: string;
}) {
  const pct = Math.min(Math.max(e / 2, 0), 1) * 100;

  return (
    <div style={{ position: 'relative', height: 6, borderRadius: 3, overflow: 'visible', marginBottom: 4 }}>
      {/* Track background */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 3,
        background: COLORS.border,
      }} />
      {/* Ellipse zone: e 0→1, occupies left 50% */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: '50%', borderRadius: '3px 0 0 3px',
        background: 'rgba(96,165,250,0.18)',
      }} />
      {/* Hyperbola zone: e 1→2, occupies right 50% */}
      <div style={{
        position: 'absolute', left: '50%', top: 0, bottom: 0,
        width: '50%', borderRadius: '0 3px 3px 0',
        background: 'rgba(244,114,182,0.18)',
      }} />
      {/* Parabola marker at e=1 (50%) */}
      <div style={{
        position: 'absolute', left: '50%', top: -2, bottom: -2,
        width: 1, background: 'rgba(251,191,36,0.6)',
        transform: 'translateX(-50%)',
      }} />
      {/* Current e marker */}
      <div style={{
        position: 'absolute', left: `${pct}%`, top: -3, bottom: -3,
        width: 2, borderRadius: 1,
        background: color,
        transform: 'translateX(-50%)',
        transition: 'left 0.05s linear',
      }} />
    </div>
  );
}

// ─── EccentricityPanel ────────────────────────────────────────────────────────

export function EccentricityPanel() {
  const entity = useActiveConic();

  // Drag state: captures fixedC + initial entity at the first slider tick
  const dragRef   = useRef<{ c: number; initial: ConicEntity } | null>(null);
  // Animation cancel function
  const cancelRef = useRef<(() => void) | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Cancel animation when the active entity changes
  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, [entity?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  if (!entity) {
    return (
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>
        <p style={{ fontSize: '11px', color: COLORS.textDisabled }}>请先选择曲线</p>
      </div>
    );
  }

  const isCircle = entity.type === 'circle';
  const currentE = getEntityEccentricity(entity);

  // ── Circle → Ellipse conversion ─────────────────────────────────────────────
  // When the active entity is a circle, allow the teacher to convert it to an
  // equivalent ellipse (same size, e = 0.3) so the eccentricity sweep can begin.
  //   a = r   (preserve visual size as semi-major axis)
  //   e₀ = 0.3  →  c = r·0.3,  b = r·√(1 − 0.09) ≈ 0.954·r

  function handleConvertCircle() {
    if (!entity || entity.type !== 'circle') return;
    const r      = entity.params.r;
    const E0     = 0.3;
    const fixedC = r * E0;                         // c = a·e₀
    const ellipseEntity = applyEccentricityToEntity(
      entity.id, E0, fixedC,
      entity.params.cx, entity.params.cy,
      entity.color, entity.label, entity.visible,
    );
    useEntityStore.getState().updateEntity(entity.id, ellipseEntity);
    executeM03Command(new UpdateCurveParamCommand(entity.id, entity, ellipseEntity));
  }

  // ── Slider handlers ─────────────────────────────────────────────────────────

  function handleChange([eVal]: number[]) {
    if (!entity || isAnimating) return;
    const store = useEntityStore.getState();
    const raw   = store.entities.find((en) => en.id === entity.id);
    if (!raw || !isConicEntity(raw)) return;
    const live: ConicEntity = raw;

    const snap = dragRef.current ?? { c: getEntityFixedC(live), initial: live };
    dragRef.current = snap;
    const { c } = snap;
    const { cx, cy } = live.params as { cx: number; cy: number };

    const updated = applyEccentricityToEntity(
      live.id, eVal, c, cx, cy, live.color, live.label, live.visible,
    );
    store.updateEntity(live.id, updated);
  }

  function handleCommit([eVal]: number[]) {
    if (!dragRef.current) return;
    const { c, initial } = dragRef.current;
    dragRef.current = null;

    if (Math.abs(eVal - getEntityEccentricity(initial)) < 1e-9) return;

    const { cx, cy } = initial.params;
    const finalEntity = applyEccentricityToEntity(
      initial.id, eVal, c, cx, cy, initial.color, initial.label, initial.visible,
    );
    // Ensure store has the committed state, then record command
    useEntityStore.getState().updateEntity(initial.id, finalEntity);
    executeM03Command(
      new UpdateCurveParamCommand(initial.id, initial, finalEntity),
    );
  }

  // ── Play / Stop ─────────────────────────────────────────────────────────────

  function handlePlay() {
    if (!entity || isAnimating || isCircle) return;
    const store  = useEntityStore.getState();
    const raw    = store.entities.find((en) => en.id === entity.id);
    if (!raw || !isConicEntity(raw)) return;
    const live: ConicEntity = raw;
    const fixedC = getEntityFixedC(live);

    setIsAnimating(true);
    const cancel = startEccentricityAnimation({
      entityId:   live.id,
      fromE:      0.01,
      toE:        2.0,
      fixedC,
      duration:   3000,
      onComplete: () => {
        setIsAnimating(false);
        cancelRef.current = null;
      },
    });
    cancelRef.current = cancel;
  }

  function handleStop() {
    cancelRef.current?.();
    cancelRef.current = null;
    // isAnimating is reset by onComplete inside the cancel function
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const disabled = isCircle || isAnimating;

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '0.3px' }}>
          离心率演变
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 600,
          color: isCircle ? COLORS.textDisabled : entity.color,
          fontFamily: 'monospace',
        }}>
          {isCircle ? '圆 (e = 0)' : `${eccentricityTypeLabel(currentE)}  e = ${currentE.toFixed(4)}`}
        </span>
      </div>

      {/* b/a ratio — shown for ellipses to illustrate "flatness" during animation */}
      {entity.type === 'ellipse' && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 8, padding: '3px 6px',
          background: 'rgba(50,213,131,0.06)', borderRadius: 4,
          border: '1px solid rgba(50,213,131,0.20)',
        }}>
          <span style={{ fontSize: '10px', color: COLORS.textDisabled }}>扁率  b/a</span>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: entity.color, fontWeight: 600 }}>
            {(entity.params.b / entity.params.a).toFixed(6)}
          </span>
        </div>
      )}

      {/* Zone bar */}
      <EccentricityZoneBar e={currentE} color={isCircle ? COLORS.textDisabled : entity.color} />

      {/* Zone labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '9px', color: 'rgba(96,165,250,0.7)' }}>椭圆 (e&lt;1)</span>
        <span style={{ fontSize: '9px', color: 'rgba(251,191,36,0.7)' }}>e=1</span>
        <span style={{ fontSize: '9px', color: 'rgba(244,114,182,0.7)' }}>双曲线 (e&gt;1)</span>
      </div>

      {/* Slider */}
      <div style={{ marginBottom: 10 }}>
        <Slider
          value={[isCircle ? 0 : currentE]}
          min={0.01}
          max={2.0}
          step={0.01}
          disabled={disabled}
          onValueChange={handleChange}
          onValueCommit={handleCommit}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: '9px', color: COLORS.textDisabled }}>0.01</span>
          <span style={{ fontSize: '9px', color: COLORS.textDisabled }}>2.00</span>
        </div>
      </div>

      {/* Play / Stop buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handlePlay}
          disabled={isCircle || isAnimating}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '5px 0',
            borderRadius: 6,
            fontSize: '11px', fontWeight: 600,
            border: 'none', cursor: isCircle || isAnimating ? 'not-allowed' : 'pointer',
            background: isCircle || isAnimating ? COLORS.border : COLORS.primary,
            color:      isCircle || isAnimating ? COLORS.textDisabled : COLORS.textPrimary,
            transition: 'background 0.15s',
          }}
          {...(!(isCircle || isAnimating) ? btnHover(COLORS.primaryHover, COLORS.primary) : {})}
        >
          <Play size={11} />
          播放
        </button>

        <button
          onClick={handleStop}
          disabled={!isAnimating}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '5px 0',
            borderRadius: 6,
            fontSize: '11px', fontWeight: 600,
            border: 'none', cursor: !isAnimating ? 'not-allowed' : 'pointer',
            background: !isAnimating ? COLORS.border : COLORS.error,
            color:      !isAnimating ? COLORS.textDisabled : COLORS.white,
            transition: 'background 0.15s',
          }}
          {...(isAnimating ? btnHover(COLORS.errorDark, COLORS.error) : {})}
        >
          <Square size={11} />
          停止
        </button>
      </div>

      {isCircle && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: '10px', color: COLORS.textSecondary, textAlign: 'center', marginBottom: 6 }}>
            圆的离心率恒为 0。点击下方按钮转换为椭圆以开始演示。
          </p>
          <button
            onClick={handleConvertCircle}
            style={{
              width: '100%', padding: '5px 0',
              fontSize: '11px', fontWeight: 600, borderRadius: 6,
              border: `1px solid ${COLORS.primary}`, background: 'rgba(50,213,131,0.12)',
              color: '#065F46', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            {...btnHover('rgba(50,213,131,0.22)', 'rgba(50,213,131,0.12)')}
          >
            转换为椭圆 (e = 0.30) →
          </button>
        </div>
      )}

    </div>
  );
}
