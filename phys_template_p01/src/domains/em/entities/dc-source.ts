import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SliderParamSchema } from '@/core/types';

export function registerDCSourceEntity(): void {
  entityRegistry.register({
    type: 'dc-source',
    category: 'object',
    label: '直流电源',

    defaultProperties: {
      emf: 6, // V
      internalResistance: 1, // Ω
      width: 0.8, // m（渲染用）
      height: 0.5, // m（渲染用）
    },

    paramSchemas: [
      {
        key: 'emf',
        label: '电动势',
        type: 'slider',
        min: 1,
        max: 24,
        step: 0.1,
        default: 6,
        unit: 'V',
      } satisfies SliderParamSchema,
      {
        key: 'internalResistance',
        label: '内阻',
        type: 'slider',
        min: 0,
        max: 5,
        step: 0.1,
        default: 1,
        unit: 'Ω',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 0.8;
      const height = (entity.properties.height as number) ?? 0.5;

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
      const id = `dc-source-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'dc-source',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          emf: 6,
          internalResistance: 1,
          width: 0.8,
          height: 0.5,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '直流电源',
      };
      return entity;
    },
  });
}
