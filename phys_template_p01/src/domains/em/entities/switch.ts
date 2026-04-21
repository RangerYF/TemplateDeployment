import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, ToggleParamSchema } from '@/core/types';

export function registerSwitchEntity(): void {
  entityRegistry.register({
    type: 'switch',
    category: 'object',
    label: '开关',

    defaultProperties: {
      closed: true, // 默认闭合
      width: 0.6, // m（渲染用）
      height: 0.3, // m（渲染用）
    },

    paramSchemas: [
      {
        key: 'closed',
        label: '开关状态',
        type: 'toggle',
        default: true,
        labelOn: '闭合',
        labelOff: '断开',
      } satisfies ToggleParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 0.6;
      const height = (entity.properties.height as number) ?? 0.3;

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
      const id = `switch-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'switch',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          closed: true,
          width: 0.6,
          height: 0.3,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '开关',
      };
      return entity;
    },
  });
}
