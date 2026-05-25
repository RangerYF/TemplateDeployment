/**
 * OpticalPanel — Conic optical property demonstration.
 *
 * Controls:
 *   - Enable/disable light beam mode
 *   - Ray count slider (4-16)
 *   - Play/Stop photon animation
 *
 * Supports:
 *   - Ellipse: F₁ → P → F₂ reflection
 *   - Hyperbola: 指向一焦点的光线反射后，其反向延长线经过另一焦点
 *   - Parabola: F → P → reflected rays parallel to the symmetry axis
 *   - Disabled for circle
 *
 * Real-time: rays recompute automatically when entity params change
 * (e.g., eccentricity slider, focus drag).
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Square, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useActiveConic } from '@/hooks/useActiveEntity';
import { useOpticalStore } from '@/editor/store/opticalStore';
import { computeOpticalRays, startPhotonAnimation } from '@/engine/opticalEngine';
import { COLORS } from '@/styles/colors';
import { btnHover } from '@/styles/interactionStyles';
import type { OpticalRay } from '@/engine/opticalEngine';

export function OpticalPanel() {
  const entity = useActiveConic();
  const enabled     = useOpticalStore((s) => s.enabled);
  const rayCount    = useOpticalStore((s) => s.rayCount);
  const isAnimating = useOpticalStore((s) => s.isAnimating);

  const cancelRef = useRef<(() => void) | null>(null);
  const [rays, setRays] = useState<OpticalRay[]>([]);

  const supportsOptical = entity?.type === 'ellipse' || entity?.type === 'hyperbola' || entity?.type === 'parabola';

  // Recompute rays when entity or rayCount changes
  useEffect(() => {
    if (!entity || !enabled || !supportsOptical) {
      setRays([]);
      return;
    }
    const computed = computeOpticalRays(entity, rayCount);
    setRays(computed ?? []);
  }, [entity, rayCount, enabled, supportsOptical]);

  // Cancel animation on entity change or unmount
  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, [entity?.id]);

  useEffect(() => {
    return () => { cancelRef.current?.(); };
  }, []);

  const handleToggle = useCallback(() => {
    const next = !enabled;
    useOpticalStore.getState().setEnabled(next);
    if (!next) {
      cancelRef.current?.();
      cancelRef.current = null;
    }
  }, [enabled]);

  const handlePlay = useCallback(() => {
    if (isAnimating || rays.length === 0) return;
    const cancel = startPhotonAnimation(rays, 3000);
    cancelRef.current = cancel;
  }, [isAnimating, rays]);

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);

  const handleRayCountChange = useCallback(([v]: number[]) => {
    useOpticalStore.getState().setRayCount(v);
  }, []);

  if (!entity) {
    return (
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>
        <p style={{ fontSize: '11px', color: COLORS.textDisabled }}>请先选择曲线</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* Header + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, letterSpacing: '0.3px' }}>
          光学性质
        </span>
        <button
          onClick={handleToggle}
          disabled={!supportsOptical}
          title={enabled ? '关闭反射演示' : '开启反射演示'}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '3px 8px', borderRadius: 4,
            fontSize: '10px', fontWeight: 600,
            border: enabled ? `1px solid ${COLORS.warning}` : `1px solid ${COLORS.borderMuted}`,
            background: enabled ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
            color: !supportsOptical ? COLORS.neutral : enabled ? COLORS.warning : COLORS.textDisabled,
            cursor: !supportsOptical ? 'not-allowed' : 'pointer',
            opacity: !supportsOptical ? 0.5 : 1,
          }}
          {...(supportsOptical ? btnHover(
            enabled ? 'rgba(251, 191, 36, 0.25)' : COLORS.surfaceLight,
            enabled ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
          ) : {})}
        >
          <Zap size={10} />
          {enabled ? '开启中' : '未开启'}
        </button>
      </div>

      {!supportsOptical && (
        <p style={{ fontSize: '10px', color: COLORS.textSecondary, marginBottom: 6 }}>
          {entity.type === 'circle' ? '圆不适用光学反射演示' : '双曲线暂不支持'}
        </p>
      )}

      {/* Description */}
      {supportsOptical && enabled && (
        <p style={{ fontSize: '10px', color: COLORS.textSecondary, marginBottom: 8 }}>
          {entity.type === 'ellipse'
            ? '椭圆反射: 从焦点 F₁ 出发的光线经反射后汇聚于 F₂'
            : entity.type === 'hyperbola'
              ? '双曲线反射: 从左右两个焦点发出的光线经反射后，反射线的反向延长线经过另一焦点'
              : '抛物线反射: 从焦点 F 发出的光线经反射后平行于对称轴'
          }
        </p>
      )}

      {entity.type === 'hyperbola' && supportsOptical && enabled && (
        <p style={{ fontSize: '10px', color: COLORS.infoBlueDark, marginBottom: 8 }}>
          蓝色辅助虚线用于强调“两焦点外角平分”对应的反射关系
        </p>
      )}

      {/* Ray count slider */}
      {supportsOptical && enabled && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '10px', color: COLORS.textSecondary }}>光线数量</span>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: COLORS.neutral }}>{rayCount}</span>
          </div>
          <Slider
            value={[rayCount]}
            min={4}
            max={16}
            step={1}
            disabled={isAnimating}
            onValueChange={handleRayCountChange}
          />
        </div>
      )}

      {/* Play / Stop */}
      {supportsOptical && enabled && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handlePlay}
            disabled={isAnimating || rays.length === 0}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '5px 0', borderRadius: 6,
              fontSize: '11px', fontWeight: 600,
              border: 'none',
              cursor: isAnimating || rays.length === 0 ? 'not-allowed' : 'pointer',
              background: isAnimating || rays.length === 0 ? COLORS.border : COLORS.warning,
              color: isAnimating || rays.length === 0 ? COLORS.textDisabled : COLORS.textPrimary,
            }}
            {...(!isAnimating && rays.length > 0 ? btnHover('#E5A500', COLORS.warning) : {})}
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
              padding: '5px 0', borderRadius: 6,
              fontSize: '11px', fontWeight: 600,
              border: 'none',
              cursor: !isAnimating ? 'not-allowed' : 'pointer',
              background: !isAnimating ? COLORS.border : COLORS.error,
              color: !isAnimating ? COLORS.textDisabled : COLORS.white,
            }}
            {...(isAnimating ? btnHover(COLORS.errorDark, COLORS.error) : {})}
          >
            <Square size={11} />
            停止
          </button>
        </div>
      )}

    </div>
  );
}
