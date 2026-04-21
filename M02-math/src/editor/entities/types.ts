import type {
  ConicType, ConicEntity, BaseEntityMeta,
  EllipseParams, HyperbolaParams, ParabolaParams, CircleParams,
} from '@/types';
import { createEllipse,   updateEllipseParams   } from './ellipse';
import { createHyperbola, updateHyperbolaParams } from './hyperbola';
import { createParabola,  updateParabolaParams  } from './parabola';
import { createCircle,    updateCircleParams    } from './circle';

// ─── createEntity ─────────────────────────────────────────────────────────────

/**
 * Unified factory — dispatch to the conic-specific factory based on `type`.
 *
 * @example
 * ```typescript
 * // Browser console (Dev mode):
 * createEntity('ellipse',   { a: 5,  b: 3, cx: 0, cy: 0 })
 * createEntity('hyperbola', { a: 3,  b: 4, cx: 0, cy: 0 })
 * createEntity('parabola',  { p: 2,        cx: 0, cy: 0 })
 * createEntity('circle',    { r: 4,        cx: 0, cy: 0 })
 * ```
 */
export function createEntity(
  type:       ConicType,
  params:     EllipseParams | HyperbolaParams | ParabolaParams | CircleParams,
  overrides?: Partial<BaseEntityMeta>,
): ConicEntity {
  switch (type) {
    case 'ellipse':   return createEllipse  (params as EllipseParams,   overrides);
    case 'hyperbola': return createHyperbola(params as HyperbolaParams, overrides);
    case 'parabola':  return createParabola (params as ParabolaParams,  overrides);
    case 'circle':    return createCircle   (params as CircleParams,    overrides);
  }
}

// ─── updateEntityParams ───────────────────────────────────────────────────────

/**
 * Apply a partial parameter patch to any `ConicEntity`, recomputing derived
 * elements (foci, directrices, etc.) automatically.
 *
 * Used by Undo/Redo commands and slider commits.
 */
export function updateEntityParams(
  entity: ConicEntity,
  patch:  Partial<EllipseParams> | Partial<HyperbolaParams> | Partial<ParabolaParams> | Partial<CircleParams>,
): ConicEntity {
  switch (entity.type) {
    case 'ellipse':   return updateEllipseParams  (entity, patch as Partial<EllipseParams>);
    case 'hyperbola': return updateHyperbolaParams(entity, patch as Partial<HyperbolaParams>);
    case 'parabola':  return updateParabolaParams (entity, patch as Partial<ParabolaParams>);
    case 'circle':    return updateCircleParams   (entity, patch as Partial<CircleParams>);
  }
}
