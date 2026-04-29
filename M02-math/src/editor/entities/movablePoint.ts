import type { MovablePointEntity, MovablePointParams, BaseEntityMeta } from '@/types';
import { ENTITY_COLORS } from '@/types';
import { createId } from '@/lib/id';

export function createMovablePoint(
  params: Omit<MovablePointParams, 'showTrajectory' | 'showProjections'>,
  overrides?: Partial<BaseEntityMeta>,
): MovablePointEntity {
  return {
    id: createId(),
    type: 'movable-point',
    visible: true,
    color: ENTITY_COLORS[3], // yellow
    ...overrides,
    params: { ...params, showTrajectory: false, showProjections: false },
  };
}

export function updateMovablePointParams(
  entity: MovablePointEntity,
  patch: Partial<MovablePointParams>,
): MovablePointEntity {
  return {
    ...entity,
    params: { ...entity.params, ...patch },
  };
}
