import type {
  Entity,
  EntityCategory,
  EntityId,
  EntityType,
  CoordinateTransform,
  HitTestResult,
  ParamSchema,
  Transform,
  Vec2,
} from '../types';

// ─── 实体注册信息 ───

export interface EntityRegistration {
  /** 实体类型标识 */
  type: EntityType;

  /** 实体类别 */
  category: EntityCategory;

  /** 显示名称（UI用），如 "物块"、"斜面" */
  label: string;

  /** 默认属性值（创建新实体时使用） */
  defaultProperties: Record<string, unknown>;

  /** 该实体类型的可调参数定义（驱动参数面板渲染） */
  paramSchemas: ParamSchema[];

  /**
   * 命中检测函数
   * 判断一个点（物理坐标）是否命中该类型的实体
   */
  hitTest: (
    entity: Entity,
    point: Vec2,
    transform: CoordinateTransform,
  ) => HitTestResult | null;

  /**
   * 工厂函数：创建该类型的新实体实例（Phase 2 搭建器使用）
   * 自动生成 id，填入默认属性
   */
  createEntity: (
    overrides?: Partial<{
      transform: Transform;
      properties: Record<string, unknown>;
      label: string;
    }>,
  ) => Entity;
}

// ─── EntityRegistry API ───

export interface IEntityRegistry {
  register(config: EntityRegistration): void;
  get(type: EntityType): EntityRegistration | undefined;
  getByCategory(category: EntityCategory): EntityRegistration[];
  getAll(): EntityRegistration[];
  has(type: EntityType): boolean;
}

// ─── EntityRegistry 实现 ───

let nextId = 1;

function generateEntityId(): EntityId {
  return `entity-${nextId++}`;
}

export function createEntityRegistry(): IEntityRegistry {
  const registrations = new Map<EntityType, EntityRegistration>();

  return {
    register(config: EntityRegistration): void {
      if (registrations.has(config.type)) {
        console.warn(
          `[EntityRegistry] 实体类型 "${config.type}" 已注册，跳过重复注册`,
        );
        return;
      }

      // 包装 createEntity 以自动生成 id
      const originalCreateEntity = config.createEntity;
      const wrappedConfig: EntityRegistration = {
        ...config,
        createEntity: (overrides) => {
          if (originalCreateEntity) {
            return originalCreateEntity(overrides);
          }
          // 默认工厂实现
          const entity: Entity = {
            id: generateEntityId(),
            type: config.type,
            category: config.category,
            transform: overrides?.transform ?? {
              position: { x: 0, y: 0 },
              rotation: 0,
            },
            properties: {
              ...config.defaultProperties,
              ...overrides?.properties,
            },
            label: overrides?.label ?? config.label,
          };
          return entity;
        },
      };

      registrations.set(config.type, wrappedConfig);
    },

    get(type: EntityType): EntityRegistration | undefined {
      return registrations.get(type);
    },

    getByCategory(category: EntityCategory): EntityRegistration[] {
      return Array.from(registrations.values()).filter(
        (r) => r.category === category,
      );
    },

    getAll(): EntityRegistration[] {
      return Array.from(registrations.values());
    },

    has(type: EntityType): boolean {
      return registrations.has(type);
    },
  };
}

/** 全局默认实例 */
export const entityRegistry = createEntityRegistry();
