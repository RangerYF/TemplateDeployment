/**
 * locusEngine.ts — Dynamic locus animation for conic definition demos.
 *
 * Computes a moving point P on a conic entity and drives the locus trace
 * animation (sum-of-distances, focus-directrix).
 */

import { startAnimation, linear } from '@/engine/animationEngine';
import { useEntityStore } from '@/editor/store/entityStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { useLocusStore } from '@/editor/store/locusStore';
import type { LocusPreset } from '@/editor/store/locusStore';
import type { ConicEntity } from '@/types';
import { isConicEntity } from '@/types';

// ─── Point on conic ──────────────────────────────────────────────────────────

/**
 * Compute a point on the conic for parameter t ∈ [0, 1].
 * Uses the same parametric conventions as parametricSampler.ts.
 */
export function pointOnConic(entity: ConicEntity, t: number): [number, number] {
  switch (entity.type) {
    case 'ellipse': {
      const { a, b, cx, cy } = entity.params;
      const theta = t * 2 * Math.PI;
      return [cx + a * Math.cos(theta), cy + b * Math.sin(theta)];
    }
    case 'circle': {
      const { r, cx, cy } = entity.params;
      const theta = t * 2 * Math.PI;
      return [cx + r * Math.cos(theta), cy + r * Math.sin(theta)];
    }
    case 'hyperbola': {
      // Right branch, t maps over sinh range [-3, 3]
      const { a, b, cx, cy } = entity.params;
      const tParam = (t - 0.5) * 6; // map [0,1] → [-3,3]
      return [cx + a * Math.cosh(tParam), cy + b * Math.sinh(tParam)];
    }
    case 'parabola': {
      const { p, cx, cy, orientation = 'h' } = entity.params;
      // Map t ∈ [0,1] → param range [-8, 8]
      const tParam = (t - 0.5) * 16;
      if (orientation === 'v') {
        return [cx + tParam, cy + (tParam * tParam) / (2 * p)];
      }
      return [cx + (tParam * tParam) / (2 * p), cy + tParam];
    }
  }
}

// ─── Locus animation ─────────────────────────────────────────────────────────

export interface LocusAnimationOptions {
  entityId: string;
  preset: LocusPreset;
  duration?: number;
  maxTracePoints?: number;
  onComplete?: () => void;
}

/**
 * Start a locus animation that moves point P around the conic.
 * Returns a cancel function.
 */
export function startLocusAnimation(options: LocusAnimationOptions): () => void {
  const {
    entityId,
    preset,
    duration = 4000,
    onComplete,
  } = options;

  const raw = useEntityStore.getState().entities.find((e) => e.id === entityId);
  if (!raw || !isConicEntity(raw)) return () => {};

  const store = useLocusStore.getState();
  store.setPreset(preset, entityId);
  store.setAnimating(true);

  useAnimationStore.getState().setIsAnimating(true);

  let stopped = false;
  let frameCount = 0;

  const cancelRaf = startAnimation({
    from: 0,
    to: 1,
    duration,
    easing: linear,

    onFrame: (t) => {
      if (stopped) return;

      // Re-read entity in case params changed during animation
      const current = useEntityStore.getState().entities.find((e) => e.id === entityId);
      if (!current || !isConicEntity(current)) return;

      const [x, y] = pointOnConic(current as ConicEntity, t);
      const pt = { x, y, t };

      const locus = useLocusStore.getState();
      locus.setCurrentPoint(pt);
      locus.pushTrace(pt);

      // Throttle render ticks: increment every 3 frames (~20fps redraw)
      frameCount++;
      if (frameCount % 3 === 0) {
        locus.incrementRenderTick();
      }
    },

    onComplete: () => {
      if (stopped) return;
      useAnimationStore.getState().setIsAnimating(false);
      const locus = useLocusStore.getState();
      locus.setAnimating(false);
      locus.setCurrentPoint(null);
      onComplete?.();
    },
  });

  return () => {
    stopped = true;
    cancelRaf();
    useAnimationStore.getState().setIsAnimating(false);
    const locus = useLocusStore.getState();
    locus.setAnimating(false);
    locus.setCurrentPoint(null);
    onComplete?.();
  };
}
