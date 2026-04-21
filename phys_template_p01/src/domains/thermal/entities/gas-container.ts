import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity } from '@/core/types';

export function registerGasContainerEntity(): void {
  entityRegistry.register({
    type: 'gas-container',
    category: 'surface',
    label: '气体容器',

    defaultProperties: {
      containerType: 'sealed-tube',
      width: 0.4,
      height: 2.0,
      openEnd: 'top',
      inclineAngle: 0,
      leftArmHeight: 2.0,
      rightArmHeight: 2.0,
      innerDiameter: 0.4,
    },

    paramSchemas: [],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const w = (entity.properties.width as number) ?? 0.4;
      const h = (entity.properties.height as number) ?? 2.0;
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
      const id = `gas-container-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'gas-container',
        category: 'surface',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          containerType: 'sealed-tube',
          width: 0.4,
          height: 2.0,
          openEnd: 'top',
          inclineAngle: 0,
          leftArmHeight: 2.0,
          rightArmHeight: 2.0,
          innerDiameter: 0.4,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '气体容器',
      };
      return entity;
    },
  });
}
