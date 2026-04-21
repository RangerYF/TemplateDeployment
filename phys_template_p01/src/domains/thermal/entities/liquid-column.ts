import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity } from '@/core/types';

export function registerLiquidColumnEntity(): void {
  entityRegistry.register({
    type: 'liquid-column',
    category: 'object',
    label: '液柱',

    defaultProperties: {
      length: 0.1,
      density: 13600,
      crossSection: 2e-4,
      positionOffset: 0,
      columnId: 'liquid-1',
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const length = (entity.properties.length as number) ?? 0.1;
      const cs = (entity.properties.crossSection as number) ?? 2e-4;
      const w = Math.sqrt(cs) * 10;
      const rect = {
        x: position.x - w / 2,
        y: position.y - length / 2,
        width: w,
        height: length,
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
      const id = `liquid-column-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'liquid-column',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          length: 0.1,
          density: 13600,
          crossSection: 2e-4,
          positionOffset: 0,
          columnId: 'liquid-1',
          ...overrides?.properties,
        },
        label: overrides?.label ?? '液柱',
      };
      return entity;
    },
  });
}
