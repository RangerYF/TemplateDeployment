import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import type { Entity, InputParamSchema, SliderParamSchema } from '@/core/types';

export function registerPointChargeEntity(): void {
  entityRegistry.register({
    type: 'point-charge',
    category: 'object',
    label: '点电荷',

    defaultProperties: {
      charge: 1, // C（库仑力预设中单位为 μC，各求解器自行处理单位）
      mass: 1, // kg
      initialVelocity: { x: 0, y: 0 }, // m/s
      radius: 0.15, // m（显示半径）
    },

    paramSchemas: [
      {
        key: 'charge',
        label: '电荷量',
        type: 'slider',
        min: -10,
        max: 10,
        step: 0.1,
        default: 1,
        unit: 'C',
      } satisfies SliderParamSchema,
      {
        key: 'mass',
        label: '质量',
        type: 'input',
        min: 0.001,
        max: 100,
        default: 1,
        unit: 'kg',
        precision: 3,
      } satisfies InputParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const radius = (entity.properties.radius as number) ?? 0.15;

      if (pointInCircle(point, position, radius)) {
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
      const id = `point-charge-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'point-charge',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          charge: 1,
          mass: 1,
          initialVelocity: { x: 0, y: 0 },
          radius: 0.15,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '点电荷',
      };
      return entity;
    },
  });
}
