import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import type { Entity, SliderParamSchema } from '@/core/types';

export function registerVoltmeterEntity(): void {
  entityRegistry.register({
    type: 'voltmeter',
    category: 'instrument',
    label: '电压表',

    defaultProperties: {
      range: 3, // V（量程）
      internalResistance: 3000, // Ω
      radius: 0.3, // m（显示半径）
      reading: 0, // V（求解器运行时更新）
      overRange: false, // 求解器运行时更新
    },

    paramSchemas: [
      {
        key: 'range',
        label: '量程',
        type: 'slider',
        min: 3,
        max: 15,
        step: 12,
        default: 3,
        unit: 'V',
      } satisfies SliderParamSchema,
      {
        key: 'internalResistance',
        label: '内阻',
        type: 'slider',
        min: 1000,
        max: 30000,
        step: 100,
        default: 3000,
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
      const id = `voltmeter-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'voltmeter',
        category: 'instrument',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          range: 3,
          internalResistance: 3000,
          radius: 0.3,
          reading: 0,
          overRange: false,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '电压表',
      };
      return entity;
    },
  });
}
