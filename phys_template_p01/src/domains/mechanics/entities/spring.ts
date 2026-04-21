import { entityRegistry } from '@/core/registries/entity-registry';
import { pointOnLine } from '@/core/physics/geometry';
import { worldToScreen } from '@/renderer/coordinate';
import type { Entity, Vec2 } from '@/core/types';

export function registerSpringEntity(): void {
  entityRegistry.register({
    type: 'spring',
    category: 'connector',
    label: '弹簧',

    defaultProperties: {
      stiffness: 100, // N/m
      naturalLength: 1.0, // m
      pivotEntityId: '', // 固定端（pivot↔block 模式）
      blockEntityId: '', // 自由端（pivot↔block 模式）
      entityAId: '', // A端（block↔block 模式）
      entityBId: '', // B端（block↔block 模式）
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const startPos = entity.transform.position;
      const endPos = entity.properties._endPos as Vec2 | undefined;
      if (!endPos) return null;

      if (pointOnLine(point, startPos, endPos, 0.08)) {
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
      const id = `spring-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'spring',
        category: 'connector',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          stiffness: 100,
          naturalLength: 1.0,
          pivotEntityId: '',
          blockEntityId: '',
          entityAId: '',
          entityBId: '',
          ...overrides?.properties,
        },
        label: overrides?.label ?? '弹簧',
      };
      return entity;
    },
  });
}
