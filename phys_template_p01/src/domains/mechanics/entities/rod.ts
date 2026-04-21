import { entityRegistry } from '@/core/registries/entity-registry';
import { pointOnLine } from '@/core/physics/geometry';
import { worldToScreen } from '@/renderer/coordinate';
import type { Entity, Vec2 } from '@/core/types';

export function registerRodEntity(): void {
  entityRegistry.register({
    type: 'rod',
    category: 'connector',
    label: '轻杆',

    defaultProperties: {
      length: 1.0, // m
      pivotEntityId: '',
      blockEntityId: '',
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const startPos = entity.transform.position;
      const endPos = entity.properties._endPos as Vec2 | undefined;
      if (!endPos) return null;

      if (pointOnLine(point, startPos, endPos, 0.1)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: 0,
        };
      }
      return null;
    },

    drawOutline: (entity, ctx, ct) => {
      const startPos = entity.transform.position;
      const endPos = entity.properties._endPos as Vec2 | undefined;
      if (!endPos) return;

      const s1 = worldToScreen(startPos, ct);
      const s2 = worldToScreen(endPos, ct);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
    },

    createEntity: (overrides) => {
      const id = `rod-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'rod',
        category: 'connector',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          length: 1.0,
          pivotEntityId: '',
          blockEntityId: '',
          ...overrides?.properties,
        },
        label: overrides?.label ?? '轻杆',
      };
      return entity;
    },
  });
}
