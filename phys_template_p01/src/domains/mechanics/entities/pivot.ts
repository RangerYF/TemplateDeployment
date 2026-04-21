import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import { worldToScreen } from '@/renderer/coordinate';
import type { Entity } from '@/core/types';

export function registerPivotEntity(): void {
  entityRegistry.register({
    type: 'pivot',
    category: 'constraint',
    label: '固定点',

    defaultProperties: {
      radius: 0.05, // m，纯视觉用
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      // 扩大点击范围（物理坐标 0.15m）
      if (pointInCircle(point, position, 0.15)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(point.x - position.x, point.y - position.y),
        };
      }
      return null;
    },

    drawOutline: (entity, ctx, ct) => {
      const pos = entity.transform.position;
      const screen = worldToScreen(pos, ct);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 10, 0, Math.PI * 2);
    },

    createEntity: (overrides) => {
      const id = `pivot-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'pivot',
        category: 'constraint',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          radius: 0.05,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '固定点',
      };
      return entity;
    },
  });
}
