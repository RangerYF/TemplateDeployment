import { entityRegistry } from '@/core/registries/entity-registry';
import { pointOnLine } from '@/core/physics/geometry';
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

      // 斜边：从底左角（position）到顶角
      const topCorner = { x: position.x, y: position.y + height };

      // 底右角
      const bottomRight = { x: position.x + baseWidth, y: position.y };

      // 检测斜边（用户最可能点击斜边）
      if (pointOnLine(point, position, topCorner, 0.15)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: 0,
        };
      }

      // 也检测底边
      if (pointOnLine(point, position, bottomRight, 0.1)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.abs(point.y - position.y),
        };
      }

      return null;
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
