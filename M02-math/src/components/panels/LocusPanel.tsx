/**
 * LocusPanel — Definition demo panel for M03.
 *
 * Provides preset buttons for:
 *   - "r₁+r₂ = 2a" (ellipse/hyperbola only)
 *   - "d(P,F) = e·d(P,L)" (all except circle)
 * Plus Play / Stop / Clear controls.
 */

import { useRef, useState, useEffect } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';
import { useActiveConic } from '@/hooks/useActiveEntity';
import { useLocusStore } from '@/editor/store/locusStore';
import { startLocusAnimation } from '@/engine/locusEngine';
import { COLORS } from '@/styles/colors';
import { btnHover } from '@/styles/interactionStyles';
import type { LocusPreset } from '@/editor/store/locusStore';

export function LocusPanel() {
  const entity = useActiveConic();
  const cancelRef = useRef<(() => void) | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<LocusPreset | null>(null);

  const locusIsAnimating = useLocusStore((s) => s.isAnimating);
  const hasTrace = useLocusStore((s) => s.tracePoints.length > 0);

  // Sync local state with store
  useEffect(() => {
    setIsAnimating(locusIsAnimating);
  }, [locusIsAnimating]);

  // Cleanup on entity change or unmount
  useEffect(() => {
    return () => {
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, [entity?.id]);

  useEffect(() => {
    return () => { cancelRef.current?.(); };
  }, []);

  if (!entity) {
    return (
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>
        <p style={{ fontSize: '11px', color: COLORS.textDisabled }}>请先选择曲线</p>
      </div>
    );
  }

  const isCircle = entity.type === 'circle';
  const canSumOfDist = entity.type === 'ellipse' || entity.type === 'hyperbola';
  const canFocusDir  = !isCircle;

  function handlePlay() {
    if (!entity || isAnimating || !selectedPreset) return;

    setIsAnimating(true);
    const cancel = startLocusAnimation({
      entityId: entity.id,
      preset: selectedPreset,
      duration: 4000,
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
  }

  function handleClear() {
    handleStop();
    useLocusStore.getState().clearTrace();
    setSelectedPreset(null);
  }

  function selectPreset(preset: LocusPreset) {
    if (isAnimating) return;
    setSelectedPreset(preset);
    useLocusStore.getState().clearTrace();
    useLocusStore.getState().setPreset(preset, entity!.id);
  }

  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}` }}>

      {/* Header */}
      <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, letterSpacing: '0.3px', display: 'block', marginBottom: 10 }}>
        定义演示
      </span>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          onClick={() => selectPreset('sum-of-distances')}
          disabled={!canSumOfDist || isAnimating}
          style={{
            flex: 1, padding: '5px 4px',
            borderRadius: 6, fontSize: '10px', fontWeight: 600,
            border: selectedPreset === 'sum-of-distances' ? `1.5px solid ${entity.color}` : `1px solid ${COLORS.borderMuted}`,
            background: selectedPreset === 'sum-of-distances' ? `${entity.color}18` : 'transparent',
            color: !canSumOfDist ? COLORS.neutral : selectedPreset === 'sum-of-distances' ? entity.color : COLORS.textDisabled,
            cursor: !canSumOfDist || isAnimating ? 'not-allowed' : 'pointer',
            opacity: !canSumOfDist ? 0.5 : 1,
          }}
          {...(canSumOfDist && !isAnimating ? btnHover(
            selectedPreset === 'sum-of-distances' ? `${entity.color}28` : COLORS.surfaceLight,
            selectedPreset === 'sum-of-distances' ? `${entity.color}18` : 'transparent',
          ) : {})}
        >
          r&#x2081;+r&#x2082; = 2a
        </button>

        <button
          onClick={() => selectPreset('focus-directrix')}
          disabled={!canFocusDir || isAnimating}
          style={{
            flex: 1, padding: '5px 4px',
            borderRadius: 6, fontSize: '10px', fontWeight: 600,
            border: selectedPreset === 'focus-directrix' ? `1.5px solid ${entity.color}` : `1px solid ${COLORS.borderMuted}`,
            background: selectedPreset === 'focus-directrix' ? `${entity.color}18` : 'transparent',
            color: !canFocusDir ? COLORS.neutral : selectedPreset === 'focus-directrix' ? entity.color : COLORS.textDisabled,
            cursor: !canFocusDir || isAnimating ? 'not-allowed' : 'pointer',
            opacity: !canFocusDir ? 0.5 : 1,
          }}
          {...(canFocusDir && !isAnimating ? btnHover(
            selectedPreset === 'focus-directrix' ? `${entity.color}28` : COLORS.surfaceLight,
            selectedPreset === 'focus-directrix' ? `${entity.color}18` : 'transparent',
          ) : {})}
        >
          d(P,F) = e&middot;d(P,L)
        </button>
      </div>

      {/* Play / Stop / Clear */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handlePlay}
          disabled={!selectedPreset || isAnimating}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '5px 0', borderRadius: 6,
            fontSize: '11px', fontWeight: 600,
            border: 'none',
            cursor: !selectedPreset || isAnimating ? 'not-allowed' : 'pointer',
            background: !selectedPreset || isAnimating ? COLORS.border : COLORS.primary,
            color: !selectedPreset || isAnimating ? COLORS.textDisabled : COLORS.textPrimary,
          }}
          {...(selectedPreset && !isAnimating ? btnHover(COLORS.primaryHover, COLORS.primary) : {})}
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

        <button
          onClick={handleClear}
          disabled={!hasTrace && !selectedPreset}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '5px 8px', borderRadius: 6,
            fontSize: '11px', fontWeight: 600,
            border: 'none',
            cursor: !hasTrace && !selectedPreset ? 'not-allowed' : 'pointer',
            background: !hasTrace && !selectedPreset ? COLORS.border : COLORS.surfaceLight,
            color: !hasTrace && !selectedPreset ? COLORS.neutral : COLORS.textDisabled,
          }}
          {...(hasTrace || selectedPreset ? btnHover(COLORS.borderMuted, COLORS.surfaceLight) : {})}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {isCircle && (
        <p style={{ fontSize: '10px', color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 }}>
          圆不支持定义演示
        </p>
      )}

    </div>
  );
}
