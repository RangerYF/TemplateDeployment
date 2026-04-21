import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SelectParamSchema, SliderParamSchema } from '@/core/types';

export function registerUniformBFieldEntity(): void {
  entityRegistry.register({
    type: 'uniform-bfield',
    category: 'field',
    label: '匀强磁场',

    defaultProperties: {
      magnitude: 0.5, // T
      direction: 'into', // 'into' | 'out'
      width: 3, // m
      height: 2, // m
    },

    paramSchemas: [
      {
        key: 'magnitude',
        label: '磁感应强度',
        type: 'slider',
        min: 0.01,
        max: 2,
        step: 0.01,
        default: 0.5,
        unit: 'T',
      } satisfies SliderParamSchema,
      {
        key: 'direction',
        label: '磁场方向',
        type: 'select',
        options: [
          { value: 'into', label: '垂直纸面向内 \u00d7' },
          { value: 'out', label: '垂直纸面向外 \u00b7' },
        ],
        default: 'into',
      } satisfies SelectParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 3;
      const height = (entity.properties.height as number) ?? 2;

      // 场区域：position 为区域左下角（物理坐标系 Y 向上）
      const rect: Rect = {
        x: position.x,
        y: position.y,
        width,
        height,
      };

      if (pointInRect(point, rect)) {
        const centerX = position.x + width / 2;
        const centerY = position.y + height / 2;
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(point.x - centerX, point.y - centerY),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `uniform-bfield-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'uniform-bfield',
        category: 'field',
        transform: overrides?.transform ?? { position: { x: -1.5, y: -1 }, rotation: 0 },
        properties: {
          magnitude: 0.5,
          direction: 'into',
          width: 3,
          height: 2,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '匀强磁场',
      };
      return entity;
    },
  });
}
