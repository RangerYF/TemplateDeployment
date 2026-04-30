import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import type { Entity, SliderParamSchema } from '@/core/types';

export function registerMotorEntity(): void {
  entityRegistry.register({
    type: 'motor',
    category: 'object',
    label: '电动机',

    defaultProperties: {
      backEmf: 2, // V（反电动势）
      coilResistance: 1, // Ω（线圈电阻）
      radius: 0.35, // m（显示半径）
      voltage: 0, // V（两端电压，求解器运行时更新）
      current: 0, // A（求解器运行时更新）
      electricPower: 0, // W（电功率 P_电=UI）
      heatPower: 0, // W（热功率 P_热=I²R）
      mechanicalPower: 0, // W（机械功率 P_机=P_电-P_热）
    },

    paramSchemas: [
      {
        key: 'backEmf',
        label: '反电动势',
        type: 'slider',
        min: 0,
        max: 12,
        step: 0.1,
        default: 2,
        unit: 'V',
      } satisfies SliderParamSchema,
      {
        key: 'coilResistance',
        label: '线圈电阻',
        type: 'slider',
        min: 0.1,
        max: 10,
        step: 0.1,
        default: 1,
        unit: 'Ω',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const radius = (entity.properties.radius as number) ?? 0.35;
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
      const id = `motor-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'motor',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          backEmf: 2,
          coilResistance: 1,
          radius: 0.35,
          voltage: 0,
          current: 0,
          electricPower: 0,
          heatPower: 0,
          mechanicalPower: 0,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '电动机',
      };
      return entity;
    },
  });
}
