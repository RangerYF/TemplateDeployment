import type { EllipseEntity, EllipseParams, BaseEntityMeta } from '@/types';
import { ENTITY_COLORS } from '@/types';
import { computeEllipseDerived } from '@/engine/conicAnalysis';

export function createEllipse(
  params:    EllipseParams,
  overrides?: Partial<BaseEntityMeta>,
): EllipseEntity {
  return {
    id:      crypto.randomUUID(),
    type:    'ellipse',
    visible: true,
    color:   ENTITY_COLORS[0],
    label:   'E',
    ...overrides,
    params,
    derived: computeEllipseDerived(params),
  };
}

export function updateEllipseParams(
  entity: EllipseEntity,
  patch:  Partial<EllipseParams>,
): EllipseEntity {
  const params = { ...entity.params, ...patch };
  return { ...entity, params, derived: computeEllipseDerived(params) };
}
