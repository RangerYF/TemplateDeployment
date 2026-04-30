import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import type { Entity, SliderParamSchema } from '@/core/types';

export function registerBulbEntity(): void {
  entityRegistry.register({
    type: 'bulb',
    category: 'object',
    label: '灯泡',

    defaultProperties: {
      ratedVoltage: 3.8, // V（额定电压）
      ratedPower: 0.3, // W（额定功率）
      coldResistance: 2, // Ω（冷态电阻）
      radius: 0.3, // m（显示半径）
      voltage: 0, // V（求解器运行时更新）
      current: 0, // A（求解器运行时更新）
      hotResistance: 2, // Ω（热态电阻，求解器运行时计算）
      power: 0, // W（实际功率，求解器运行时更新）
      faultType: 'none', // 故障类型
    },

    paramSchemas: [
      {
        key: 'ratedVoltage',
        label: '额定电压',
        type: 'slider',
        min: 1,
        max: 12,
        step: 0.1,
        default: 3.8,
        unit: 'V',
      } satisfies SliderParamSchema,
      {
        key: 'ratedPower',
        label: '额定功率',
        type: 'slider',
        min: 0.1,
        max: 5,
        step: 0.1,
        default: 0.3,
        unit: 'W',
      } satisfies SliderParamSchema,
      {
        key: 'coldResistance',
        label: '冷态电阻',
        type: 'slider',
        min: 0.5,
        max: 20,
        step: 0.1,
        default: 2,
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
      const id = `bulb-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'bulb',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          ratedVoltage: 3.8,
          ratedPower: 0.3,
          coldResistance: 2,
          radius: 0.3,
          voltage: 0,
          current: 0,
          hotResistance: 2,
          power: 0,
          faultType: 'none',
          ...overrides?.properties,
        },
        label: overrides?.label ?? '灯泡',
      };
      return entity;
    },
  });
}
