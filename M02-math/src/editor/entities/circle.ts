import type { CircleEntity, CircleParams, BaseEntityMeta } from '@/types';
import { ENTITY_COLORS } from '@/types';
import { computeCircleDerived } from '@/engine/conicAnalysis';
import { createId } from '@/lib/id';

export function createCircle(
  params:    CircleParams,
  overrides?: Partial<BaseEntityMeta>,
): CircleEntity {
  return {
    id:      createId(),
    type:    'circle',
    visible: true,
    color:   ENTITY_COLORS[0],
    label:   'C',
    ...overrides,
    params,
    derived: computeCircleDerived(params),
  };
}

export function updateCircleParams(
  entity: CircleEntity,
  patch:  Partial<CircleParams>,
): CircleEntity {
  const params = { ...entity.params, ...patch };
  return { ...entity, params, derived: computeCircleDerived(params) };
}
