import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SliderParamSchema, ToggleParamSchema } from '@/core/types';

export function registerUniformEFieldEntity(): void {
  entityRegistry.register({
    type: 'uniform-efield',
    category: 'field',
    label: '匀强电场',

    defaultProperties: {
      magnitude: 1000, // V/m
      direction: { x: 0, y: -1 }, // 默认向下
      width: 3, // m
      height: 2, // m
      showPlates: false,
    },

    paramSchemas: [
      {
        key: 'magnitude',
        label: '电场强度',
        type: 'slider',
        min: 100,
        max: 10000,
        step: 100,
        default: 1000,
        unit: 'V/m',
      } satisfies SliderParamSchema,
      {
        key: 'showPlates',
        label: '显示极板',
        type: 'toggle',
        default: false,
        labelOn: '显示',
        labelOff: '隐藏',
      } satisfies ToggleParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 3;
      const height = (entity.properties.height as number) ?? 2;

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
      const id = `uniform-efield-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'uniform-efield',
        category: 'field',
        transform: overrides?.transform ?? { position: { x: -1.5, y: -1 }, rotation: 0 },
        properties: {
          magnitude: 1000,
          direction: { x: 0, y: -1 },
          width: 3,
          height: 2,
          showPlates: false,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '匀强电场',
      };
      return entity;
    },
  });
}
