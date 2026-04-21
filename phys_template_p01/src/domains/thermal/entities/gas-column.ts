import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity } from '@/core/types';

export function registerGasColumnEntity(): void {
  entityRegistry.register({
    type: 'gas-column',
    category: 'object',
    label: '气柱',

    defaultProperties: {
      pressure: 101325,
      volume: 1e-4,
      temperature: 300,
      length: 0.5,
      crossSection: 2e-4,
      chartType: 'p-V',
      chartData: [],
      initialPressure: 101325,
      initialVolume: 1e-4,
      initialTemperature: 300,
      columnId: 'gas-1',
      positionOffset: 0,
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const length = (entity.properties.length as number) ?? 0.5;
      const cs = (entity.properties.crossSection as number) ?? 2e-4;
      const w = Math.sqrt(cs) * 10; // approximate visual width
      const rect = {
        x: position.x - w / 2,
        y: position.y - length / 2,
        width: w,
        height: length,
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
      const id = `gas-column-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'gas-column',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          pressure: 101325,
          volume: 1e-4,
          temperature: 300,
          length: 0.5,
          crossSection: 2e-4,
          chartType: 'p-V',
          chartData: [],
          initialPressure: 101325,
          initialVolume: 1e-4,
          initialTemperature: 300,
          columnId: 'gas-1',
          positionOffset: 0,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '气柱',
      };
      return entity;
    },
  });
}
