import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SliderParamSchema } from '@/core/types';

export function registerBlockEntity(): void {
  entityRegistry.register({
    type: 'block',
    category: 'object',
    label: '物块',

    defaultProperties: {
      mass: 1, // kg
      width: 0.5, // m
      height: 0.5, // m
    },

    paramSchemas: [
      {
        key: 'mass',
        label: '质量',
        type: 'slider',
        min: 0.1,
        max: 10,
        step: 0.1,
        default: 1,
        unit: 'kg',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 0.5;
      const height = (entity.properties.height as number) ?? 0.5;

      // block 底边中心在 transform.position，矩形向上延伸
      const rect: Rect = {
        x: position.x - width / 2,
        y: position.y,
        width,
        height,
      };

      if (pointInRect(point, rect)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(
            point.x - position.x,
            point.y - (position.y + height / 2),
          ),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `block-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'block',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          mass: 1,
          width: 0.5,
          height: 0.5,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '物块',
      };
      return entity;
    },
  });
}
