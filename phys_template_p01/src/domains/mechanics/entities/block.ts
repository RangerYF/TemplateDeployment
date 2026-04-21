import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect, pointInRotatedRect } from '@/core/physics/geometry';
import { worldToScreen } from '@/renderer/coordinate';
import type { Entity, Rect, SliderParamSchema } from '@/core/types';

export function registerBlockEntity(): void {
  entityRegistry.register({
    type: 'block',
    category: 'object',
    label: '物块',

    defaultProperties: {
      mass: 1, // kg
      width: 0.5, // m
      height: 0.5, // m
    },

    paramSchemas: [
      {
        key: 'mass',
        label: '质量',
        type: 'slider',
        min: 0.1,
        max: 10,
        step: 0.1,
        default: 1,
        unit: 'kg',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const rotation = entity.transform.rotation ?? 0;
      const width = (entity.properties.width as number) ?? 0.5;
      const height = (entity.properties.height as number) ?? 0.5;

      if (Math.abs(rotation) < 1e-6) {
        // 无旋转：轴对齐矩形检测
        const rect: Rect = {
          x: position.x - width / 2,
          y: position.y,
          width,
          height,
        };
        if (pointInRect(point, rect)) {
          return {
            entityId: entity.id,
            entityType: entity.type,
            hitPoint: point,
            distance: Math.hypot(
              point.x - position.x,
              point.y - (position.y + height / 2),
            ),
          };
        }
      } else {
        // 有旋转：物块中心 = 底边中心 + 旋转后的半高向量
        const center = {
          x: position.x + (-Math.sin(rotation)) * (height / 2),
          y: position.y + Math.cos(rotation) * (height / 2),
        };
        if (pointInRotatedRect(point, center, width / 2, height / 2, rotation)) {
          return {
            entityId: entity.id,
            entityType: entity.type,
            hitPoint: point,
            distance: Math.hypot(point.x - center.x, point.y - center.y),
          };
        }
      }
      return null;
    },

    drawOutline: (entity, ctx, ct) => {
      const width = (entity.properties.width as number) ?? 0.5;
      const height = (entity.properties.height as number) ?? 0.5;
      const rotation = entity.transform.rotation ?? 0;
      const pos = entity.transform.position;
      const center = {
        x: pos.x + (-Math.sin(rotation)) * (height / 2),
        y: pos.y + Math.cos(rotation) * (height / 2),
      };
      const sc = worldToScreen(center, ct);
      const halfW = (width * ct.scale) / 2;
      const halfH = (height * ct.scale) / 2;

      ctx.translate(sc.x, sc.y);
      ctx.rotate(-rotation);
      ctx.beginPath();
      ctx.rect(-halfW, -halfH, halfW * 2, halfH * 2);
    },

    createEntity: (overrides) => {
      const id = `block-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'block',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          mass: 1,
          width: 0.5,
          height: 0.5,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '物块',
      };
      return entity;
    },
  });
}
