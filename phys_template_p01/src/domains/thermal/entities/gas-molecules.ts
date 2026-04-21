import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity } from '@/core/types';

export function registerGasMoleculesEntity(): void {
  entityRegistry.register({
    type: 'gas-molecules',
    category: 'object',
    label: '气体分子',

    defaultProperties: {
      count: 200,
      temperature: 300,
      molecularMass: 4.65e-26, // N₂ 分子质量
      positions: [],
      velocities: [],
      speedHistogram: [],
      histogramBins: [],
      containerWidth: 4,
      containerHeight: 3,
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const w = (entity.properties.containerWidth as number) ?? 4;
      const h = (entity.properties.containerHeight as number) ?? 3;
      const rect = {
        x: position.x - w / 2,
        y: position.y - h / 2,
        width: w,
        height: h,
      };
      if (pointInRect(point, rect)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(point.x - position.x, point.y - position.y),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `gas-molecules-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'gas-molecules',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          count: 200,
          temperature: 300,
          molecularMass: 4.65e-26,
          positions: [],
          velocities: [],
          speedHistogram: [],
          histogramBins: [],
          containerWidth: 4,
          containerHeight: 3,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '气体分子',
      };
      return entity;
    },
  });
}
