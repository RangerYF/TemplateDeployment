import type { ImplicitCurveEntity, ImplicitCurveParams, FunctionParam, BaseEntityMeta } from '@/types';
import { ENTITY_COLORS } from '@/types';
import { createId } from '@/lib/id';

export function createImplicitCurve(
  exprStr: string,
  namedParams: FunctionParam[],
  overrides?: Partial<BaseEntityMeta>,
): ImplicitCurveEntity {
  return {
    id: createId(),
    type: 'implicit-curve',
    visible: true,
    color: ENTITY_COLORS[0],
    ...overrides,
    params: { exprStr, namedParams },
  };
}

export function updateImplicitCurveParams(
  entity: ImplicitCurveEntity,
  patch: Partial<ImplicitCurveParams>,
): ImplicitCurveEntity {
  return {
    ...entity,
    params: { ...entity.params, ...patch },
  };
}
