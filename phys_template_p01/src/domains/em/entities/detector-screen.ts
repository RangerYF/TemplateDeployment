import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SliderParamSchema } from '@/core/types';
import { DETECTOR_SCREEN_TYPE } from '../logic/detector-screen';

export function registerDetectorScreenEntity(): void {
  entityRegistry.register({
    type: DETECTOR_SCREEN_TYPE,
    category: 'instrument',
    label: '接收屏',

    defaultProperties: {
      width: 0.18,
      height: 3.6,
    },

    paramSchemas: [
      {
        key: 'width',
        label: '屏宽',
        type: 'slider',
        min: 0.1,
        max: 1,
        step: 0.05,
        default: 0.18,
        unit: 'm',
        precision: 2,
      } satisfies SliderParamSchema,
      {
        key: 'height',
        label: '屏高',
        type: 'slider',
        min: 1,
        max: 8,
        step: 0.2,
        default: 3.6,
        unit: 'm',
        precision: 1,
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = Math.max((entity.properties.width as number) ?? 0.18, 0.02);
      const height = Math.max((entity.properties.height as number) ?? 3.6, 0.1);

      const rect: Rect = {
        x: position.x,
        y: position.y,
        width,
        height,
      };

      if (!pointInRect(point, rect)) return null;

      const centerX = position.x + width / 2;
      const centerY = position.y + height / 2;
      return {
        entityId: entity.id,
        entityType: entity.type,
        hitPoint: point,
        distance: Math.hypot(point.x - centerX, point.y - centerY),
      };
    },

    createEntity: (overrides) => {
      const id = `detector-screen-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: DETECTOR_SCREEN_TYPE,
        category: 'instrument',
        transform: overrides?.transform ?? { position: { x: 6.5, y: -1.8 }, rotation: 0 },
        properties: {
          width: 0.18,
          height: 3.6,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '接收屏',
      };
      return entity;
    },
  });
}
