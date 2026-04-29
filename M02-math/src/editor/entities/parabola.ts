import type { ParabolaEntity, ParabolaParams, BaseEntityMeta } from '@/types';
import { ENTITY_COLORS } from '@/types';
import { computeParabolaDerived } from '@/engine/conicAnalysis';
import { createId } from '@/lib/id';

export function createParabola(
  params:    ParabolaParams,
  overrides?: Partial<BaseEntityMeta>,
): ParabolaEntity {
  return {
    id:      createId(),
    type:    'parabola',
    visible: true,
    color:   ENTITY_COLORS[0],
    label:   'P',
    ...overrides,
    params,
    derived: computeParabolaDerived(params),
  };
}

export function updateParabolaParams(
  entity: ParabolaEntity,
  patch:  Partial<ParabolaParams>,
): ParabolaEntity {
  const params = { ...entity.params, ...patch };
  return { ...entity, params, derived: computeParabolaDerived(params) };
}
