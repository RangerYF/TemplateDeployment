import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInTriangle, pointOnLine } from '@/core/physics/geometry';
import { worldToScreen } from '@/renderer/coordinate';
import type { Entity } from '@/core/types';

export function registerSlopeEntity(): void {
  entityRegistry.register({
    type: 'slope',
    category: 'surface',
    label: '斜面',

    defaultProperties: {
      angle: 30, // 度
      length: 3, // m（沿斜面）
      friction: 0,
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const angleDeg = (entity.properties.angle as number) ?? 30;
      const length = (entity.properties.length as number) ?? 3;
      const angleRad = (angleDeg * Math.PI) / 180;

      const baseWidth = length * Math.cos(angleRad);
      const height = length * Math.sin(angleRad);

      // 三个顶点（与 slope-renderer 一致）：底左角(position)、底右角、顶角
      const bottomLeft = position;
      const bottomRight = { x: position.x + baseWidth, y: position.y };
      const topCorner = { x: position.x, y: position.y + height };

      // 检测三角形内部区域
      if (pointInTriangle(point, bottomLeft, bottomRight, topCorner)) {
        const centerX = (bottomLeft.x + bottomRight.x + topCorner.x) / 3;
        const centerY = (bottomLeft.y + bottomRight.y + topCorner.y) / 3;
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(point.x - centerX, point.y - centerY),
        };
      }

      // 边缘容差检测（三角形外但接近边线）
      const edgeThreshold = 0.1;
      if (
        pointOnLine(point, bottomLeft, topCorner, edgeThreshold) ||
        pointOnLine(point, bottomLeft, bottomRight, edgeThreshold) ||
        pointOnLine(point, bottomRight, topCorner, edgeThreshold)
      ) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: 0.5, // 边缘命中距离略大，三角形内部优先
        };
      }

      return null;
    },

    drawOutline: (entity, ctx, ct) => {
      const angleDeg = (entity.properties.angle as number) ?? 30;
      const length = (entity.properties.length as number) ?? 3;
      const angleRad = (angleDeg * Math.PI) / 180;
      const pos = entity.transform.position;
      const baseWidth = length * Math.cos(angleRad);
      const height = length * Math.sin(angleRad);

      const sBL = worldToScreen(pos, ct);
      const sBR = worldToScreen({ x: pos.x + baseWidth, y: pos.y }, ct);
      const sTC = worldToScreen({ x: pos.x, y: pos.y + height }, ct);

      ctx.beginPath();
      ctx.moveTo(sBL.x, sBL.y);
      ctx.lineTo(sBR.x, sBR.y);
      ctx.lineTo(sTC.x, sTC.y);
      ctx.closePath();
    },

    createEntity: (overrides) => {
      const id = `slope-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'slope',
        category: 'surface',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          angle: 30,
          length: 3,
          friction: 0,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '斜面',
      };
      return entity;
    },
  });
}
