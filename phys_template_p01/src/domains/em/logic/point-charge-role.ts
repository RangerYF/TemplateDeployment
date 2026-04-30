import type { Entity } from '@/core/types';

export type PointChargeRole = 'source' | 'particle';

export function getPointChargeRole(entity: Entity): PointChargeRole | undefined {
  if (entity.type !== 'point-charge') return undefined;
  const role = entity.properties.pointChargeRole as PointChargeRole | undefined;
  return role === 'source' || role === 'particle' ? role : undefined;
}

export function isSourcePointCharge(entity: Entity): boolean {
  return entity.type === 'point-charge' && getPointChargeRole(entity) !== 'particle';
}

export function isDynamicPointCharge(entity: Entity): boolean {
  return entity.type === 'point-charge'
    && getPointChargeRole(entity) !== 'source'
    && entity.properties.particleActive !== false;
}

export function isInactiveDynamicPointCharge(entity: Entity): boolean {
  return entity.type === 'point-charge'
    && getPointChargeRole(entity) !== 'source'
    && entity.properties.particleActive === false;
}
