import { entityRegistry } from '@/core/registries/entity-registry';
import { pointInRect } from '@/core/physics/geometry';
import type { Entity, Rect, SelectParamSchema, SliderParamSchema } from '@/core/types';

export function registerSlideRheostatEntity(): void {
  entityRegistry.register({
    type: 'slide-rheostat',
    category: 'object',
    label: '滑动变阻器',

    defaultProperties: {
      maxResistance: 30, // Ω
      sliderRatio: 0.5, // 0~1
      width: 1.0, // m（渲染用）
      height: 0.5, // m（渲染用）
      voltage: 0, // V（求解器运行时更新）
      current: 0, // A（求解器运行时更新）
      faultType: 'none', // 故障类型：'none' | 'open' | 'short'
      connectionMode: 'variable', // 连接模式：'variable'(A+W) | 'divider'(A+W+B)
      ports: [
        { id: 'A', label: '固定端A', side: 'left' },
        { id: 'B', label: '固定端B', side: 'right' },
        { id: 'W', label: '滑片端', side: 'top' },
      ],
    },

    paramSchemas: [
      {
        key: 'faultType',
        label: '故障',
        type: 'select',
        options: [
          { value: 'none', label: '正常' },
          { value: 'open', label: '断路' },
          { value: 'short', label: '短路' },
        ],
        default: 'none',
      } satisfies SelectParamSchema,
      {
        key: 'connectionMode',
        label: '接法',
        type: 'select',
        options: [
          { value: 'variable', label: '限流接法' },
          { value: 'divider', label: '分压接法' },
        ],
        default: 'variable',
      } satisfies SelectParamSchema,
      {
        key: 'maxResistance',
        label: '最大阻值',
        type: 'slider',
        min: 1,
        max: 30,
        step: 1,
        default: 30,
        unit: 'Ω',
        inputMax: 9999,
      } satisfies SliderParamSchema,
      {
        key: 'sliderRatio',
        label: '滑片位置',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.5,
        unit: '',
      } satisfies SliderParamSchema,
    ],

    hitTest: (entity, point) => {
      const { position } = entity.transform;
      const width = (entity.properties.width as number) ?? 1.0;
      const height = (entity.properties.height as number) ?? 0.5;

      const rect: Rect = {
        x: position.x,
        y: position.y,
        width,
        height,
      };

      if (pointInRect(point, rect)) {
        const centerX = position.x + width / 2;
        const centerY = position.y + height / 2;
        return {
          entityId: entity.id,
          entityType: entity.type,
          hitPoint: point,
          distance: Math.hypot(point.x - centerX, point.y - centerY),
        };
      }
      return null;
    },

    createEntity: (overrides) => {
      const id = `slide-rheostat-${crypto.randomUUID().slice(0, 8)}`;
      const entity: Entity = {
        id,
        type: 'slide-rheostat',
        category: 'object',
        transform: overrides?.transform ?? { position: { x: 0, y: 0 }, rotation: 0 },
        properties: {
          maxResistance: 30,
          sliderRatio: 0.5,
          width: 1.0,
          height: 0.5,
          voltage: 0,
          current: 0,
          faultType: 'none',
          connectionMode: 'variable',
          ports: [
            { id: 'A', label: '固定端A', side: 'left' },
            { id: 'B', label: '固定端B', side: 'right' },
            { id: 'W', label: '滑片端', side: 'top' },
          ],
          ...overrides?.properties,
        },
        label: overrides?.label ?? '滑动变阻器',
      };
      return entity;
    },
  });
}
