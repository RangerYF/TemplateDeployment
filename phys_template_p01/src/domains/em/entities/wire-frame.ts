import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SliderParamSchema } from '@/core/types';

export function registerWireFrameEntity(): void {
  entityRegistry.register({
    type: 'wire-frame',
    category: 'object',
    label: '矩形线框',

    defaultProperties: {
      width: 1, // m
      height: 0.8, // m
      resistance: 2, // Ω
      initialVelocity: { x: 1, y: 0 }, // m/s
      emf: 0, // V（求解器运行时更新）
      current: 0, // A（求解器运行时更新）
      flux: 0, // Wb（求解器运行时更新）
    },

    paramSchemas: [
      {
        key: 'width',
        label: '线框宽度',
        type: 'slider',
        min: 0.2,
        max: 3,
        step: 0.1,
        default: 1,
        unit: 'm',
      } satisfies SliderParamSchema,
      {
        key: 'height',
        label: '线框高度',
        type: 'slider',
        min: 0.2,
        max: 3,
        step: 0.1,
        default: 0.8,
        unit: 'm',
      } satisfies SliderParamSchema,
      {
        key: 'resistance',
        label: '电阻',
        type: 'slider',
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 2,
        unit: 'Ω',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 1;
      const height = (entity.properties.height as number) ?? 0.8;

      // position 为线框左下角
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
      const id = `wire-frame-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'wire-frame',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          width: 1,
          height: 0.8,
          resistance: 2,
          initialVelocity: { x: 1, y: 0 },
          emf: 0,
          current: 0,
          flux: 0,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '矩形线框',
      };
      return entity;
    },
  });
}
