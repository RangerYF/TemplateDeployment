import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity } from '@/core/types';

export function registerPistonEntity(): void {
  entityRegistry.register({
    type: 'piston',
    category: 'object',
    label: '活塞',

    defaultProperties: {
      mass: 1.0,
      crossSection: 2e-4,
      orientation: 'vertical',
      positionOffset: 0,
      width: 0.4,
      thickness: 0.08,
      pistonId: 'piston-1',
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const w = (entity.properties.width as number) ?? 0.4;
      const t = (entity.properties.thickness as number) ?? 0.08;
      const rect = {
        x: position.x - w / 2,
        y: position.y - t / 2,
        width: w,
        height: t,
      };
      if (pointInRect(point, rect)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(point.x - position.x, point.y - position.y),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `piston-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'piston',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          mass: 1.0,
          crossSection: 2e-4,
          orientation: 'vertical',
          positionOffset: 0,
          width: 0.4,
          thickness: 0.08,
          pistonId: 'piston-1',
          ...overrides?.properties,
        },
        label: overrides?.label ?? '活塞',
      };
      return entity;
    },
  });
}
