/**
 * eccentricityEngine.ts — e 0→2 演变引擎 (Phase 7)
 *
 * Functions:
 *   getEntityEccentricity  — read e from any ConicEntity type
 *   getEntityFixedC        — read the fixed focal half-distance c
 *   applyEccentricityToEntity — create a new entity of the correct conic type
 *   startEccentricityAnimation — RAF-driven animation (wraps animationEngine)
 *
 * Animation strategy:
 *   - Each frame: direct store update (no Command) for smooth preview
 *   - onComplete: one UpdateCurveParamCommand(initial, final) for Undo/Redo
 *   - cancel(): stops RAF + resets isAnimating; does NOT write a Command
 */

import { startAnimation, easeInOut } from '@/engine/animationEngine';
import { eccentricityToParams }       from '@/engine/conicAnalysis';
import { createEllipse }              from '@/editor/entities/ellipse';
import { createHyperbola }            from '@/editor/entities/hyperbola';
import { createParabola }             from '@/editor/entities/parabola';
import { createCircle }               from '@/editor/entities/circle';
import { useEntityStore }             from '@/editor/store/entityStore';
import { useAnimationStore }          from '@/editor/store/animationStore';
import { executeM03Command }          from '@/editor/commands/m03Execute';
import { UpdateCurveParamCommand }    from '@/editor/commands/UpdateCurveParamCommand';
import type { ConicEntity, BaseEntityMeta } from '@/types';
import { isConicEntity } from '@/types';

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** Return the eccentricity e of any ConicEntity. */
export function getEntityEccentricity(entity: ConicEntity): number {
  switch (entity.type) {
    case 'ellipse':   return entity.derived.e;
    case 'hyperbola': return entity.derived.e;
    case 'parabola':  return 1;
    case 'circle':    return 0;
  }
}

/**
 * Return the fixed focal half-distance c to use for eccentricity animation.
 *
 * | type      | c formula          |
 * |-----------|--------------------|
 * | ellipse   | derived.c = √(a²-b²) |
 * | hyperbola | derived.c = √(a²+b²) |
 * | parabola  | params.p / 2        |
 * | circle    | params.r (fallback; panel disables circle) |
 */
export function getEntityFixedC(entity: ConicEntity): number {
  switch (entity.type) {
    case 'ellipse':   return entity.derived.c;
    case 'hyperbola': return entity.derived.c;
    case 'parabola':  return entity.params.p / 2;
    case 'circle':    return entity.params.r;
  }
}

// ─── Apply eccentricity ───────────────────────────────────────────────────────

/**
 * Create a new ConicEntity of the correct type for eccentricity `e`,
 * preserving the original `id`, `color`, `label`, and `visible` fields.
 *
 * The conic type switches automatically at e=1 (parabola boundary):
 *   e < 1 → ellipse  |  e ≈ 1 → parabola  |  e > 1 → hyperbola
 */
export function applyEccentricityToEntity(
  id:      string,
  e:       number,
  fixedC:  number,
  cx:      number,
  cy:      number,
  color:   string,
  label:   string | undefined,
  visible: boolean,
): ConicEntity {
  const result = eccentricityToParams(e, fixedC);
  const meta: Partial<BaseEntityMeta> = { id, color, visible };
  if (label !== undefined) meta.label = label;

  switch (result.type) {
    case 'ellipse':
      return createEllipse({ a: result.a, b: result.b, cx, cy }, meta);
    case 'hyperbola':
      return createHyperbola({ a: result.a, b: result.b, cx, cy }, meta);
    case 'parabola':
      return createParabola({ p: result.p!, cx, cy }, meta);
    case 'circle':
      return createCircle({ r: result.a, cx, cy }, meta);
  }
}

// ─── Animation ────────────────────────────────────────────────────────────────

export interface EccentricityAnimationOptions {
  entityId:    string;
  fromE:       number;
  toE:         number;
  /** Fixed focal half-distance — preserved across all frames. */
  fixedC:      number;
  /** Animation duration in ms. Default: 2000. */
  duration?:   number;
  /** Called once when the animation ends (naturally or via cancel). */
  onComplete?: () => void;
}

/**
 * Start an eccentricity sweep animation.
 *
 * Returns a cancel function — call it to stop early.
 * A cancel does NOT write an Undo entry; only natural completion does.
 */
export function startEccentricityAnimation(
  options: EccentricityAnimationOptions,
): () => void {
  const { entityId, fromE, toE, fixedC, duration = 2000, onComplete } = options;

  // Capture the entity state before the animation begins.
  const rawEntity = useEntityStore.getState().entities.find(
    (en) => en.id === entityId,
  );
  if (!rawEntity || !isConicEntity(rawEntity)) return () => {};
  const initialEntity: ConicEntity = rawEntity;

  const { cx, cy } = initialEntity.params as { cx: number; cy: number };
  const { color, label, visible } = initialEntity;

  let finalEntity: ConicEntity = initialEntity;
  let stopped = false;

  useAnimationStore.getState().setIsAnimating(true);

  const cancelRaf = startAnimation({
    from:     fromE,
    to:       toE,
    duration,
    easing:   easeInOut,

    onFrame: (e) => {
      if (stopped) return;
      const updated = applyEccentricityToEntity(
        entityId, e, fixedC, cx, cy, color, label, visible,
      );
      finalEntity = updated;
      useEntityStore.getState().updateEntity(entityId, updated);
    },

    onComplete: () => {
      if (stopped) return;
      useAnimationStore.getState().setIsAnimating(false);
      // One Undo entry for the entire animation sweep
      executeM03Command(
        new UpdateCurveParamCommand(entityId, initialEntity, finalEntity),
      );
      onComplete?.();
    },
  });

  return () => {
    stopped = true;
    cancelRaf();
    useAnimationStore.getState().setIsAnimating(false);
    onComplete?.();
  };
}
