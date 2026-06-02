/**
 * eccentricityEngine.ts — e 0→2 演变引擎 (Phase 7)
 *
 * Functions:
 *   getEntityEccentricity  — read e from any ConicEntity type
 *   getEntityFixedC        — read the fixed focal half-distance c
 *   applyEccentricityToEntity — create a new entity of the correct conic type
 *   startEccentricityAnimation — controllable RAF-driven animation
 *
 * Animation strategy:
 *   - Each frame: direct store update (no Command) for smooth preview
 *   - onComplete: one UpdateCurveParamCommand(initial, final) for Undo/Redo
 *   - cancel(): stops RAF + resets isAnimating; does NOT write a Command
 */

import {
  startMultiAnimationControlled,
  easeInOut,
} from '@/engine/animationEngine';
import { eccentricityToParams }       from '@/engine/conicAnalysis';
import { createEllipse }              from '@/editor/entities/ellipse';
import { createHyperbola }            from '@/editor/entities/hyperbola';
import { createParabola }             from '@/editor/entities/parabola';
import { createCircle }               from '@/editor/entities/circle';
import { useEntityStore }             from '@/editor/store/entityStore';
import { useAnimationStore }          from '@/editor/store/animationStore';
import { executeM03Command }          from '@/editor/commands/m03Execute';
import { UpdateCurveParamCommand }    from '@/editor/commands/UpdateCurveParamCommand';
import type {
  AnimationControl,
} from '@/engine/animationEngine';
import type {
  ConicAxisOrientation,
  ConicEntity,
  BaseEntityMeta,
} from '@/types';
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
 * | type      | c formula            |
 * |-----------|----------------------|
 * | ellipse   | derived.c = √(a²-b²) |
 * | hyperbola | derived.c = √(a²+b²) |
 * | parabola  | abs(params.p) / 2    |
 * | circle    | params.r             |
 */
export function getEntityFixedC(entity: ConicEntity): number {
  switch (entity.type) {
    case 'ellipse':   return entity.derived.c;
    case 'hyperbola': return entity.derived.c;
    case 'parabola':  return Math.abs(entity.params.p) / 2;
    case 'circle':    return entity.params.r;
  }
}

function getOrientation(entity: ConicEntity): ConicAxisOrientation {
  switch (entity.type) {
    case 'ellipse':
    case 'hyperbola':
    case 'parabola':
      return entity.params.orientation ?? 'h';
    case 'circle':
      return 'h';
  }
}

function getParabolaSign(entity: ConicEntity): 1 | -1 {
  return entity.type === 'parabola' && entity.params.p < 0 ? -1 : 1;
}

// ─── Apply eccentricity ───────────────────────────────────────────────────────

/**
 * Create a new ConicEntity of the correct type for eccentricity `e`,
 * preserving id, style, label, position, and axis orientation where applicable.
 *
 * The conic type switches automatically at e=1:
 *   e < 1 → ellipse  |  e ≈ 1 → parabola  |  e > 1 → hyperbola
 */
export function applyEccentricityToEntity(
  sourceEntity: ConicEntity,
  e: number,
  fixedC: number,
): ConicEntity {
  const result = eccentricityToParams(e, fixedC);
  const { id, color, label, visible } = sourceEntity;
  const { cx, cy } = sourceEntity.params as { cx: number; cy: number };
  const orientation = getOrientation(sourceEntity);
  const parabolaSign = getParabolaSign(sourceEntity);
  const meta: Partial<BaseEntityMeta> = { id, color, visible };

  if (label !== undefined) meta.label = label;

  switch (result.type) {
    case 'ellipse':
      return createEllipse({ a: result.a, b: result.b, cx, cy, orientation }, meta);
    case 'hyperbola':
      return createHyperbola({ a: result.a, b: result.b, cx, cy, orientation }, meta);
    case 'parabola':
      return createParabola({
        p: result.p! * parabolaSign,
        cx,
        cy,
        orientation,
      }, meta);
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

export interface EccentricityAnimationControl {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

/**
 * Start an eccentricity sweep animation.
 *
 * Returns pause/resume/cancel controls.
 * A cancel does NOT write an Undo entry; only natural completion does.
 */
export function startEccentricityAnimation(
  options: EccentricityAnimationOptions,
): EccentricityAnimationControl {
  const { entityId, fromE, toE, fixedC, duration = 2000, onComplete } = options;

  const rawEntity = useEntityStore.getState().entities.find(
    (en) => en.id === entityId,
  );
  if (!rawEntity || !isConicEntity(rawEntity)) {
    return {
      pause: () => {},
      resume: () => {},
      cancel: () => {},
    };
  }
  const initialEntity: ConicEntity = rawEntity;

  let finalEntity: ConicEntity = initialEntity;
  let stopped = false;

  useAnimationStore.getState().setIsAnimating(true);

  const control: AnimationControl = startMultiAnimationControlled(
    [
      {
        from: fromE,
        to: toE,
        onFrame: (e) => {
          if (stopped) return;
          const latest = useEntityStore.getState().entities.find((en) => en.id === entityId);
          if (!latest || !isConicEntity(latest)) return;
          const updated = applyEccentricityToEntity(latest, e, fixedC);
          finalEntity = updated;
          useEntityStore.getState().updateEntity(entityId, updated);
        },
      },
    ],
    easeInOut,
    duration,
    () => {
      if (stopped) return;
      useAnimationStore.getState().setIsAnimating(false);
      executeM03Command(
        new UpdateCurveParamCommand(entityId, initialEntity, finalEntity),
      );
      onComplete?.();
    },
  );

  return {
    pause() {
      if (stopped) return;
      control.pause();
      useAnimationStore.getState().setIsAnimating(false);
    },
    resume() {
      if (stopped) return;
      control.resume();
      useAnimationStore.getState().setIsAnimating(true);
    },
    cancel() {
      if (stopped) return;
      stopped = true;
      control.cancel();
      useAnimationStore.getState().setIsAnimating(false);
      onComplete?.();
    },
  };
}
