import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SliderParamSchema } from '@/core/types';

export function registerSolenoidEntity(): void {
  entityRegistry.register({
    type: 'solenoid',
    category: 'field',
    label: '螺线管',

    defaultProperties: {
      current: 2, // A
      currentDirectionMode: 'rightward',
      turns: 500,
      length: 3, // m
      width: 3,
      height: 1.2,
    },

    paramSchemas: [
      {
        key: 'current',
        label: '电流',
        type: 'slider',
        min: 0.5,
        max: 10,
        step: 0.5,
        default: 2,
        unit: 'A',
      } satisfies SliderParamSchema,
      {
        key: 'turns',
        label: '匝数',
        type: 'slider',
        min: 50,
        max: 2000,
        step: 50,
        default: 500,
        unit: '匝',
      } satisfies SliderParamSchema,
      {
        key: 'length',
        label: '螺线管长度',
        type: 'slider',
        min: 1,
        max: 6,
        step: 0.5,
        default: 3,
        unit: 'm',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 3;
      const height = (entity.properties.height as number) ?? 1.2;

      // position 为左下角
      const rect: Rect = { x: position.x, y: position.y, width, height };

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
      const id = `solenoid-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'solenoid',
        category: 'field',
        transform: overrides?.transform ?? { position: { x: -1.5, y: -0.6 }, rotation: 0 },
        properties: {
          current: 2,
          currentDirectionMode: 'rightward',
          turns: 500,
          length: 3,
          width: 3,
          height: 1.2,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '螺线管',
      };
      return entity;
    },
  });
}
