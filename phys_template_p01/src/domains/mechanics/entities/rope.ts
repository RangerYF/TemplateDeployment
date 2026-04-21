import { entityRegistry } from '@/core/registries/entity-registry';
import { pointOnLine } from '@/core/physics/geometry';
import { worldToScreen } from '@/renderer/coordinate';
import type { Entity, Vec2 } from '@/core/types';

export function registerRopeEntity(): void {
  entityRegistry.register({
    type: 'rope',
    category: 'connector',
    label: '轻绳',

    defaultProperties: {
      length: 1.0, // m
      pivotEntityId: '', // 固定端实体ID（预设加载时填入）
      blockEntityId: '', // 自由端实体ID
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      // rope 的 hitTest 需要两端点位置
      // 从 transform.position 作为一端（预设中初始的固定端位置）
      // properties 中应有 endPos 或通过关联实体计算
      // 简化：使用 entity.properties 中缓存的端点
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
      const id = `rope-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'rope',
        category: 'connector',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          length: 1.0,
          pivotEntityId: '',
          blockEntityId: '',
          ...overrides?.properties,
        },
        label: overrides?.label ?? '轻绳',
      };
      return entity;
    },
  });
}
