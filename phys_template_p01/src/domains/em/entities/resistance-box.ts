import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SelectParamSchema, SliderParamSchema } from '@/core/types';

export function registerResistanceBoxEntity(): void {
  entityRegistry.register({
    type: 'resistance-box',
    category: 'object',
    label: '电阻箱',

    defaultProperties: {
      resistance: 0, // Ω（由四位旋钮组合，0~9999）
      width: 1.0, // m（渲染用）
      height: 0.5, // m（渲染用）
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
        min: 0,
        max: 9999,
        step: 1,
        default: 0,
        unit: 'Ω',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 1.0;
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
      const id = `resistance-box-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'resistance-box',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          resistance: 0,
          width: 1.0,
          height: 0.5,
          voltage: 0,
          current: 0,
          faultType: 'none',
          ...overrides?.properties,
        },
        label: overrides?.label ?? '电阻箱',
      };
      return entity;
    },
  });
}
