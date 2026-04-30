import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SelectParamSchema } from '@/core/types';

export function registerRangeSwitchEntity(): void {
  entityRegistry.register({
    type: 'range-switch',
    category: 'object',
    label: '量程选择开关',

    defaultProperties: {
      ranges: [
        { label: '×1', resistance: 10 },
        { label: '×10', resistance: 100 },
        { label: '×100', resistance: 1000 },
        { label: '×1k', resistance: 10000 },
        { label: '×10k', resistance: 100000 },
      ],
      selectedIndex: 2, // 默认 ×100
      width: 1.2,
      height: 2.5,
      activeResistance: 1000, // 求解器运行时更新
      voltage: 0,
      current: 0,
    },

    paramSchemas: [
      {
        key: 'selectedIndex',
        label: '量程档位',
        type: 'select',
        options: [
          { value: '0', label: '×1 (10Ω)' },
          { value: '1', label: '×10 (100Ω)' },
          { value: '2', label: '×100 (1kΩ)' },
          { value: '3', label: '×1k (10kΩ)' },
          { value: '4', label: '×10k (100kΩ)' },
        ],
        default: '2',
      } satisfies SelectParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 1.2;
      const height = (entity.properties.height as number) ?? 2.5;

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
      const id = `range-switch-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'range-switch',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          ranges: [
            { label: '×1', resistance: 10 },
            { label: '×10', resistance: 100 },
            { label: '×100', resistance: 1000 },
            { label: '×1k', resistance: 10000 },
            { label: '×10k', resistance: 100000 },
          ],
          selectedIndex: 2,
          width: 1.2,
          height: 2.5,
          activeResistance: 1000,
          voltage: 0,
          current: 0,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '量程选择开关',
      };
      return entity;
    },
  });
}
