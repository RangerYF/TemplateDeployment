import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import type { Entity, SliderParamSchema } from '@/core/types';

export function registerGalvanometerEntity(): void {
  entityRegistry.register({
    type: 'galvanometer',
    category: 'instrument',
    label: '灵敏电流计',

    defaultProperties: {
      sensitivity: 50, // μA/格
      internalResistance: 100, // Ω
      radius: 0.3, // m（显示半径）
      reading: 0, // μA（求解器运行时更新，可正可负）
      overRange: false,
      range: 500, // μA（满偏电流，用于超量程检测）
    },

    paramSchemas: [
      {
        key: 'internalResistance',
        label: '内阻',
        type: 'slider',
        min: 10,
        max: 500,
        step: 1,
        default: 100,
        unit: 'Ω',
      } satisfies SliderParamSchema,
      {
        key: 'range',
        label: '满偏电流',
        type: 'slider',
        min: 50,
        max: 1000,
        step: 10,
        default: 500,
        unit: 'μA',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const radius = (entity.properties.radius as number) ?? 0.3;
      const center = { x: position.x, y: position.y };

      if (pointInCircle(point, center, radius)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(point.x - center.x, point.y - center.y),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `galvanometer-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'galvanometer',
        category: 'instrument',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          sensitivity: 50,
          internalResistance: 100,
          radius: 0.3,
          reading: 0,
          overRange: false,
          range: 500,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '灵敏电流计',
      };
      return entity;
    },
  });
}
