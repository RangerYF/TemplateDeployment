import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInCircle } from '@/core/physics/geometry';
import type { Entity, InputParamSchema, SelectParamSchema, SliderParamSchema } from '@/core/types';

export function registerParticleEmitterEntity(): void {
  entityRegistry.register({
    type: 'particle-emitter',
    category: 'object',
    label: '粒子源',

    defaultProperties: {
      pattern: 'translation-circle',
      particleCount: 5,
      launchAngleDeg: 0,
      baseSpeed: 2,
      angleSpreadDeg: 60,
      speedSpread: 1.6,
      entrySpacing: 1.4,
      focusDistance: 4.2,
      focusSpread: 1.6,
      charge: 0.1,
      mass: 0.1,
      particleRadius: 0.11,
      showParticleLabels: false,
      radius: 0.28,
    },

    paramSchemas: [
      {
        key: 'pattern',
        label: '发射模式',
        type: 'select',
        options: [
          { value: 'translation-circle', label: '平移圆' },
          { value: 'rotation-circle', label: '旋转圆' },
          { value: 'scaling-circle', label: '放缩圆' },
          { value: 'focusing', label: '磁聚焦' },
          { value: 'divergence', label: '磁发散' },
        ],
        default: 'translation-circle',
      } satisfies SelectParamSchema,
      {
        key: 'particleCount',
        label: '粒子数',
        type: 'slider',
        min: 1,
        max: 12,
        step: 1,
        default: 5,
        unit: '个',
      } satisfies SliderParamSchema,
      {
        key: 'baseSpeed',
        label: '基准速度',
        type: 'input',
        default: 2,
        unit: 'm/s',
        precision: 2,
        min: 0,
      } satisfies InputParamSchema,
    ],

    hitTest: (entity, point) => {
      const radius = (entity.properties.radius as number) ?? 0.28;
      if (pointInCircle(point, entity.transform.position, radius)) {
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(
            point.x - entity.transform.position.x,
            point.y - entity.transform.position.y,
          ),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `particle-emitter-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'particle-emitter',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          pattern: 'translation-circle',
          particleCount: 5,
          launchAngleDeg: 0,
          baseSpeed: 2,
          angleSpreadDeg: 60,
          speedSpread: 1.6,
          entrySpacing: 1.4,
          focusDistance: 4.2,
          focusSpread: 1.6,
          charge: 0.1,
          mass: 0.1,
          particleRadius: 0.11,
          showParticleLabels: false,
          radius: 0.28,
          ...overrides?.properties,
        },
        label: overrides?.label ?? '粒子源',
      };
      return entity;
    },
  });
}
