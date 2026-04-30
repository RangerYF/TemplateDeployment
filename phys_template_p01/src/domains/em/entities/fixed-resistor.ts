import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SelectParamSchema, SliderParamSchema } from '@/core/types';

export function registerFixedResistorEntity(): void {
  entityRegistry.register({
    type: 'fixed-resistor',
    category: 'object',
    label: '定值电阻',

    defaultProperties: {
      resistance: 10, // Ω
      width: 0.8, // m（渲染用）
      height: 0.4, // m（渲染用）
      voltage: 0, // V（求解器运行时更新）
      current: 0, // A（求解器运行时更新）
      faultType: 'none', // 故障类型：'none' | 'open' | 'short'
    },

    paramSchemas: [
      {
        key: 'faultType',
        label: '故障',
        type: 'select',
        options: [
          { value: 'none', label: '正常' },
          { value: 'open', label: '断路' },
          { value: 'short', label: '短路' },
        ],
        default: 'none',
      } satisfies SelectParamSchema,
      {
        key: 'resistance',
        label: '电阻',
        type: 'slider',
        min: 0.001,
        max: 20,
        step: 0.001,
        default: 10,
        unit: 'Ω',
        inputMax: 999999,
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 0.8;
      const height = (entity.properties.height as number) ?? 0.4;

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
      const id = `fixed-resistor-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'fixed-resistor',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          resistance: 10,
          width: 0.8,
          height: 0.4,
          voltage: 0,
          current: 0,
          faultType: 'none',
          ...overrides?.properties,
        },
        label: overrides?.label ?? '定值电阻',
      };
      return entity;
    },
  });
}
