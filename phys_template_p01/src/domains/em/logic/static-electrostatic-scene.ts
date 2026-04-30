import type { Entity } from '@/core/types';
import { getPointChargeRole } from './point-charge-role';

const STATIC_ELECTROSTATIC_ENTITY_TYPES = new Set(['point-charge', 'uniform-efield']);

export function isStaticElectrostaticScene(
  entities: Iterable<Entity>,
  duration?: number,
): boolean {
  if (duration != null && duration !== 0) return false;

  let hasElectrostaticEntity = false;

  for (const entity of entities) {
    if (entity.type === 'point-charge' && getPointChargeRole(entity) === 'particle') {
      return false;
    }
    if (!STATIC_ELECTROSTATIC_ENTITY_TYPES.has(entity.type)) return false;
    hasElectrostaticEntity = true;
  }

  return hasElectrostaticEntity;
}
