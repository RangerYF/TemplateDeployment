import type { LineEntity, LineParams, FunctionParam, BaseEntityMeta } from '@/types';
import { ENTITY_COLORS } from '@/types';

export function createLine(
  params?:   Partial<LineParams>,
  overrides?: Partial<BaseEntityMeta>,
): LineEntity {
  const defaultParams: LineParams = {
    k: 1, b: 0, vertical: false, x: 0,
  };
  return {
    id:      crypto.randomUUID(),
    type:    'line',
    visible: true,
    color:   ENTITY_COLORS[0],
    ...overrides,
    params: { ...defaultParams, ...params },
  };
}

/** Update numeric params, preserving equationStr and namedParams. */
export function updateLineParams(
  entity: LineEntity,
  patch:  Partial<LineParams>,
): LineEntity {
  return {
    ...entity,
    params: { ...entity.params, ...patch },
  };
}

/** Update named params and resolved numeric params together. */
export function updateLineNamedParams(
  entity: LineEntity,
  namedParams: FunctionParam[],
  resolvedParams: LineParams,
): LineEntity {
  return {
    ...entity,
    namedParams,
    params: resolvedParams,
  };
}

/** Clear symbolic equation fields (when user overrides with manual sliders). */
export function clearLineEquation(entity: LineEntity): LineEntity {
  return {
    ...entity,
    equationStr: null,
    namedParams: undefined,
  };
}
