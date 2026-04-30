import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SliderParamSchema, SelectParamSchema } from '@/core/types';

export function registerCurrentWireEntity(): void {
  entityRegistry.register({
    type: 'current-wire',
    category: 'field',
    label: '载流导线',

    defaultProperties: {
      current: 5, // A
      length: 4, // m
      wireDirection: { x: 0, y: 1 },
      currentDirectionMode: 'up',
      wireShape: 'straight',
      loopRadius: 1,
      width: 0.1,
      height: 4,
    },

    paramSchemas: [
      {
        key: 'current',
        label: '电流',
        type: 'slider',
        min: 0.5,
        max: 20,
        step: 0.5,
        default: 5,
        unit: 'A',
      } satisfies SliderParamSchema,
      {
        key: 'wireShape',
        label: '导线形状',
        type: 'select',
        options: [
          { value: 'straight', label: '直导线' },
          { value: 'loop', label: '圆形线圈' },
        ],
        default: 'straight',
      } satisfies SelectParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const wireShape = (entity.properties.wireShape as string) ?? 'straight';

      if (wireShape === 'loop') {
        const loopRadius = (entity.properties.loopRadius as number) ?? 1;
        // Loop: position is center, hit area is bounding square
        const rect: Rect = {
          x: position.x - loopRadius,
          y: position.y - loopRadius,
          width: loopRadius * 2,
          height: loopRadius * 2,
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
      }

      // Straight wire: position is bottom-left of bounding rect
      const width = (entity.properties.width as number) ?? 0.1;
      const height = (entity.properties.height as number) ?? 4;
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
      const id = `current-wire-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'current-wire',
        category: 'field',
        transform: overrides?.transform ?? { position: { x: 0, y: -2 }, rotation: 0 },
        properties: {
          current: 5,
          length: 4,
          wireDirection: { x: 0, y: 1 },
          currentDirectionMode: 'up',
          wireShape: 'straight',
          loopRadius: 1,
          width: 0.1,
          height: 4,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '载流导线',
      };
      return entity;
    },
  });
}
