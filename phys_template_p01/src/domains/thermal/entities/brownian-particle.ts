import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import type { Entity } from '@/core/types';

export function registerBrownianParticleEntity(): void {
  entityRegistry.register({
    type: 'brownian-particle',
    category: 'object',
    label: '布朗运动粒子',

    defaultProperties: {
      radius: 0.15,
      temperature: 300,
      trajectory: [],
      liquidMoleculeCount: 100,
      liquidPositions: [],
      liquidVelocities: [],
      containerWidth: 4,
      containerHeight: 3,
      currentX: 0,
      currentY: 0,
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const r = (entity.properties.radius as number) ?? 0.15;
      const cx = position.x + ((entity.properties.currentX as number) ?? 0);
      const cy = position.y + ((entity.properties.currentY as number) ?? 0);
      if (pointInCircle(point, { x: cx, y: cy }, r)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(point.x - cx, point.y - cy),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `brownian-particle-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'brownian-particle',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          radius: 0.15,
          temperature: 300,
          trajectory: [],
          liquidMoleculeCount: 100,
          liquidPositions: [],
          liquidVelocities: [],
          containerWidth: 4,
          containerHeight: 3,
          currentX: 0,
          currentY: 0,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '布朗运动粒子',
      };
      return entity;
    },
  });
}
