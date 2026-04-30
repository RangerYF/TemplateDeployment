import { entityRegistry } from '@/core/registries/entity-registry';
import { pointOnLine } from '@/core/physics/geometry';
import type { Entity } from '@/core/types';

export function registerSurfaceEntity(): void {
  entityRegistry.register({
    type: 'surface',
    category: 'surface',
    label: '水平面',

    defaultProperties: {
      length: 6, // m
      friction: 0, // 动摩擦因数
    },

    paramSchemas: [], // 水平面无用户可调参数

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const length = (entity.properties.length as number) ?? 6;

      const from = position;
      const to = { x: position.x + length, y: position.y };

      // 阈值 0.1m（物理坐标），约束点击容差
      if (pointOnLine(point, from, to, 0.1)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.abs(point.y - position.y),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `surface-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'surface',
        category: 'surface',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          length: 6,
          friction: 0,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '水平面',
      };
      return entity;
    },
  });
}
