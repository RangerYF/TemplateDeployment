import type { HyperbolaEntity, HyperbolaParams, BaseEntityMeta } from '@/types';
import { ENTITY_COLORS } from '@/types';
import { computeHyperbolaDerived } from '@/engine/conicAnalysis';

export function createHyperbola(
  params:    HyperbolaParams,
  overrides?: Partial<BaseEntityMeta>,
): HyperbolaEntity {
  return {
    id:      crypto.randomUUID(),
    type:    'hyperbola',
    visible: true,
    color:   ENTITY_COLORS[0],
    label:   'H',
    ...overrides,
    params,
    derived: computeHyperbolaDerived(params),
  };
}

export function updateHyperbolaParams(
  entity: HyperbolaEntity,
  patch:  Partial<HyperbolaParams>,
): HyperbolaEntity {
  const params = { ...entity.params, ...patch };
  return { ...entity, params, derived: computeHyperbolaDerived(params) };
}
