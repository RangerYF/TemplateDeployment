import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import type { Entity, SliderParamSchema } from '@/core/types';

export function registerAmmeterEntity(): void {
  entityRegistry.register({
    type: 'ammeter',
    category: 'instrument',
    label: '电流表',

    defaultProperties: {
      range: 0.6, // A（量程）
      internalResistance: 0.2, // Ω
      radius: 0.3, // m（显示半径）
      reading: 0, // A（求解器运行时更新）
      overRange: false, // 求解器运行时更新
    },

    paramSchemas: [
      {
        key: 'range',
        label: '量程',
        type: 'slider',
        min: 0.6,
        max: 3,
        step: 2.4,
        default: 0.6,
        unit: 'A',
      } satisfies SliderParamSchema,
      {
        key: 'internalResistance',
        label: '内阻',
        type: 'slider',
        min: 0.01,
        max: 1,
        step: 0.01,
        default: 0.2,
        unit: 'Ω',
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
      const id = `ammeter-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'ammeter',
        category: 'instrument',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          range: 0.6,
          internalResistance: 0.2,
          radius: 0.3,
          reading: 0,
          overRange: false,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '电流表',
      };
      return entity;
    },
  });
}
