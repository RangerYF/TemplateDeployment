/**
 * MovablePointAnimPanel — shown when a MovablePointEntity is selected.
 *
 * Visual design aligned with design_guid SYXMA tokens.
 * Card-like sections, pill buttons, refined controls.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Square, SkipForward, SkipBack, Trash2 } from 'lucide-react';
import { useEntityStore } from '@/editor/store/entityStore';
import { useMovablePointStore } from '@/editor/store/movablePointStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { updateMovablePointParams } from '@/editor/entities/movablePoint';
import { UpdateMovablePointCommand } from '@/editor/commands/UpdateMovablePointCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { resolvePointOnEntity, getEntityTRange } from '@/engine/curveParameterization';
import { Viewport } from '@/canvas/Viewport';
import { startAnimation, EASING_MAP, EASING_LABELS } from '@/engine/animationEngine';
import { COLORS } from '@/styles/colors';
import { btnHover } from '@/styles/interactionStyles';
import type { EasingName } from '@/engine/animationEngine';
import type { MovablePointEntity, AnyEntity } from '@/types';

const STEP_DELTA = 0.01;

function getConstraint(point: MovablePointEntity, entities: AnyEntity[]): AnyEntity | undefined {
  return entities.find((e) => e.id === point.params.constraintEntityId);
}

function makeViewport(vp: { xMin: number; xMax: number; yMin: number; yMax: number }): Viewport {
  return new Viewport(vp.xMin, vp.xMax, vp.yMin, vp.yMax, 800, 600);
}

const TYPE_LABELS: Record<string, string> = {
  ellipse: '椭圆', hyperbola: '双曲线', parabola: '抛物线', circle: '圆',
  line: '直线', 'implicit-curve': '自定义曲线',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function MovablePointAnimPanel() {
  const allEntities = useEntityStore((s) => s.entities);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);
  const viewport = useEntityStore((s) => s.viewport);

  const point = allEntities.find(
    (e) => e.id === activeEntityId && e.type === 'movable-point',
  ) as MovablePointEntity | undefined;

  const [duration, setDuration] = useState(3000);
  const [easing, setEasing] = useState<EasingName>('easeInOut');
  const [loop, setLoop] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const beforeRef = useRef<MovablePointEntity | null>(null);

  // Auto-clear trajectory when constraint params change
  const prevConstraintRef = useRef<string | null>(null);
  useEffect(() => {
    if (!point) return;
    const constraint = getConstraint(point, allEntities);
    const key = constraint ? JSON.stringify(constraint.params) : null;
    if (prevConstraintRef.current !== null && key !== prevConstraintRef.current) {
      useMovablePointStore.getState().clearTrajectory(point.id);
    }
    prevConstraintRef.current = key;
  }, [point, allEntities]);

  const handlePlay = useCallback(() => {
    if (!point) return;
    const constraint = getConstraint(point, useEntityStore.getState().entities);
    if (!constraint) return;

    const vp = makeViewport(viewport);
    const [tMin, tMax] = getEntityTRange(constraint, vp);

    beforeRef.current = { ...point, params: { ...point.params } };
    setIsPlaying(true);
    useAnimationStore.getState().setIsAnimating(true);

    const animate = (from: number, to: number, onDone: () => void) => {
      return startAnimation({
        from, to, duration,
        easing: EASING_MAP[easing],
        onFrame: (t) => {
          const store = useEntityStore.getState();
          const cp = store.entities.find(
            (e): e is MovablePointEntity => e.id === point.id && e.type === 'movable-point',
          );
          if (!cp) return;
          const resolved = resolvePointOnEntity(constraint, t, cp.params.branch);
          if (!resolved) return;
          store.updateEntity(point.id, updateMovablePointParams(cp, {
            t, mathX: resolved.mathX, mathY: resolved.mathY,
          }));
          if (cp.params.showTrajectory) {
            useMovablePointStore.getState().pushTracePoint(point.id, resolved.mathX, resolved.mathY);
          }
        },
        onComplete: onDone,
      });
    };

    let direction: 'forward' | 'backward' = 'forward';
    const runOnce = () => {
      const from = direction === 'forward' ? tMin : tMax;
      const to = direction === 'forward' ? tMax : tMin;
      cancelRef.current = animate(from, to, () => {
        if (loop) {
          direction = direction === 'forward' ? 'backward' : 'forward';
          runOnce();
        } else {
          finishAnimation();
        }
      });
    };

    const finishAnimation = () => {
      setIsPlaying(false);
      useAnimationStore.getState().setIsAnimating(false);
      const store = useEntityStore.getState();
      const afterEntity = store.entities.find(
        (e): e is MovablePointEntity => e.id === point.id && e.type === 'movable-point',
      );
      if (afterEntity && beforeRef.current) {
        executeM03Command(new UpdateMovablePointCommand(point.id, beforeRef.current, afterEntity));
      }
      beforeRef.current = null;
    };
    runOnce();
  }, [point, duration, easing, loop, viewport]);

  const handleStop = useCallback(() => {
    if (cancelRef.current) { cancelRef.current(); cancelRef.current = null; }
    setIsPlaying(false);
    useAnimationStore.getState().setIsAnimating(false);
    beforeRef.current = null;
  }, []);

  const handleStep = useCallback((delta: number) => {
    if (!point || isPlaying) return;
    const store = useEntityStore.getState();
    const constraint = getConstraint(point, store.entities);
    if (!constraint) return;
    const vp = makeViewport(viewport);
    const [tMin, tMax] = getEntityTRange(constraint, vp);
    const newT = Math.max(tMin, Math.min(tMax, point.params.t + delta));
    const resolved = resolvePointOnEntity(constraint, newT, point.params.branch);
    if (!resolved) return;
    const before = { ...point, params: { ...point.params } };
    const updated = updateMovablePointParams(point, { t: newT, mathX: resolved.mathX, mathY: resolved.mathY });
    store.updateEntity(point.id, updated);
    executeM03Command(new UpdateMovablePointCommand(point.id, before, updated));
    if (point.params.showTrajectory) {
      useMovablePointStore.getState().pushTracePoint(point.id, resolved.mathX, resolved.mathY);
    }
  }, [point, isPlaying, viewport]);

  const handleToggle = useCallback((key: 'showTrajectory' | 'showProjections') => {
    if (!point) return;
    const next = !point.params[key];
    useEntityStore.getState().updateEntity(point.id, updateMovablePointParams(point, { [key]: next }));
    if (key === 'showTrajectory' && !next) {
      useMovablePointStore.getState().clearTrajectory(point.id);
    }
  }, [point]);

  if (!point) return null;

  const constraint = getConstraint(point, allEntities);
  const constraintLabel = constraint ? (TYPE_LABELS[constraint.type] ?? constraint.type) : '(已删除)';

  return (
    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Coordinate card ─────────────────────────────────────────────── */}
      <div style={{
        padding: '14px', borderRadius: '14px',
        background: COLORS.primaryLight,
        border: `1px solid ${COLORS.primary}18`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: constraint ? point.color : COLORS.neutral,
          }} />
          <span style={{ fontSize: '11px', color: COLORS.textSecondary, fontWeight: 500 }}>
            {constraintLabel}
          </span>
        </div>
        <p style={{
          fontSize: '15px', fontFamily: "'SF Mono','Fira Code','Menlo',monospace",
          fontWeight: 700, color: COLORS.primary, margin: 0,
          letterSpacing: '-0.01em', lineHeight: 1.4,
        }}>
          P({point.params.mathX.toFixed(4)}, {point.params.mathY.toFixed(4)})
        </p>
        <p style={{
          fontSize: '11px', fontFamily: "'SF Mono',monospace",
          color: COLORS.neutral, margin: '4px 0 0',
        }}>
          t = {point.params.t.toFixed(4)}
        </p>
      </div>

      {/* ── Step controls ────────────────────────────────────────────────── */}
      <Section label="帧进控制">
        <div style={{ display: 'flex', gap: '4px' }}>
          <StepBtn disabled={isPlaying} onClick={() => handleStep(-STEP_DELTA * 10)}>
            <SkipBack size={11} />
            0.1
          </StepBtn>
          <StepBtn disabled={isPlaying} onClick={() => handleStep(-STEP_DELTA)}>
            0.01
          </StepBtn>
          <StepBtn disabled={isPlaying} onClick={() => handleStep(STEP_DELTA)} forward>
            0.01
          </StepBtn>
          <StepBtn disabled={isPlaying} onClick={() => handleStep(STEP_DELTA * 10)} forward>
            0.1
            <SkipForward size={11} />
          </StepBtn>
        </div>
      </Section>

      {/* ── Animation controls ───────────────────────────────────────────── */}
      <Section label="自动播放">
        {/* Duration */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: COLORS.textSecondary }}>时长</span>
            <span style={{
              fontSize: '12px', fontFamily: "'SF Mono',monospace", color: COLORS.textPrimary,
              fontWeight: 600,
            }}>{(duration / 1000).toFixed(1)}s</span>
          </div>
          <input
            type="range" min={1000} max={10000} step={500}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: '100%', accentColor: COLORS.primary }}
          />
        </div>

        {/* Easing */}
        <div style={{ marginBottom: '10px' }}>
          <span style={{
            fontSize: '12px', fontWeight: 500, color: COLORS.textSecondary,
            display: 'block', marginBottom: '4px',
          }}>
            速度曲线
          </span>
          <select
            value={easing}
            onChange={(e) => setEasing(e.target.value as EasingName)}
            style={{
              width: '100%', padding: '8px 12px',
              fontSize: '13px', fontWeight: 500, borderRadius: '14px',
              border: `1px solid ${COLORS.border}`, outline: 'none',
              background: COLORS.surface, color: COLORS.textPrimary,
              fontFamily: "'Inter','PingFang SC',system-ui,sans-serif",
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = COLORS.primary;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${COLORS.primaryFocusRing}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = COLORS.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {Object.entries(EASING_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Loop */}
        <ToggleRow checked={loop} onChange={(v) => setLoop(v)} label="循环往复" />

        {/* Play/Stop */}
        <button
          onClick={isPlaying ? handleStop : handlePlay}
          disabled={!constraint}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: '9px', fontSize: '12px', fontWeight: 600,
            borderRadius: '9999px', border: 'none', cursor: 'pointer',
            background: isPlaying ? COLORS.error : COLORS.primary,
            color: COLORS.white,
            opacity: constraint ? 1 : 0.4,
            boxShadow: isPlaying ? '0 2px 8px rgba(239,68,68,0.3)' : `0 2px 8px ${COLORS.primaryFocusRing}`,
            transition: 'all 150ms',
            marginTop: '4px',
          }}
          {...(constraint ? btnHover(
            isPlaying ? COLORS.errorDark : COLORS.primaryHover,
            isPlaying ? COLORS.error : COLORS.primary,
          ) : {})}
        >
          {isPlaying ? <><Square size={13} /> 停止</> : <><Play size={13} /> 播放</>}
        </button>
      </Section>

      {/* ── Display options ──────────────────────────────────────────────── */}
      <Section label="显示选项">
        <ToggleRow
          checked={point.params.showProjections}
          onChange={() => handleToggle('showProjections')}
          label="坐标轴投影"
        />
        <ToggleRow
          checked={point.params.showTrajectory}
          onChange={() => handleToggle('showTrajectory')}
          label="显示轨迹"
        />
        {point.params.showTrajectory && (
          <button
            onClick={() => useMovablePointStore.getState().clearTrajectory(point.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '5px', padding: '6px', marginTop: '6px',
              fontSize: '11px', fontWeight: 600, color: COLORS.error,
              background: COLORS.errorLight, border: `1px solid ${COLORS.error}22`,
              borderRadius: '8px', cursor: 'pointer',
              transition: 'background 120ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.errorBg; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.errorLight; }}
          >
            <Trash2 size={12} />
            清除轨迹
          </button>
        )}
      </Section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: '14px',
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    }}>
      <p style={{
        fontSize: '10px', fontWeight: 700, color: COLORS.neutral,
        textTransform: 'uppercase', letterSpacing: '0.8px',
        marginBottom: '10px',
        fontFamily: "'Inter','PingFang SC',system-ui,sans-serif",
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function StepBtn({
  disabled, onClick, forward, children,
}: {
  disabled: boolean; onClick: () => void; forward?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '2px', padding: '7px 2px', fontSize: '11px', fontWeight: 600,
        borderRadius: '8px',
        fontFamily: "'SF Mono',monospace",
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${COLORS.border}`,
        background: disabled ? COLORS.surfaceAlt : COLORS.surface,
        color: disabled ? COLORS.neutral : (forward ? COLORS.primary : COLORS.textSecondary),
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = COLORS.surfaceLight; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = disabled ? COLORS.surfaceAlt : COLORS.surface; }}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  checked, onChange, label,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: '13px', fontWeight: 500, color: COLORS.textSecondary,
      padding: '5px 0', cursor: 'pointer',
      fontFamily: "'Inter','PingFang SC',system-ui,sans-serif",
    }}>
      <span>{label}</span>
      {/* SYXMA Switch: h-6 w-11 (24px × 44px) */}
      <div
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        style={{
          width: 44, height: 24, borderRadius: '9999px',
          background: checked ? COLORS.primary : COLORS.surfaceAlt,
          position: 'relative', cursor: 'pointer',
          transition: 'all 0.12s',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: COLORS.white,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          position: 'absolute', top: 2,
          left: checked ? 22 : 2,
          transition: 'left 0.12s',
        }} />
      </div>
    </label>
  );
}
