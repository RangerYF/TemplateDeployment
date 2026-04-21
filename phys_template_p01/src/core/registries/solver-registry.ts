import type {
  EntityType,
  IntegratorType,
  PhysicsResult,
  RelationType,
  SceneDefinition,
  SolveMode,
} from '../types';

// ─── SolverPattern ───

export interface SolverPattern {
  /** 需要的实体类型集合（场景中必须全部存在） */
  entityTypes: EntityType[];

  /** 需要的关系类型（场景中必须存在该类型的关系连接上述实体） */
  relationType: RelationType;

  /**
   * 可选：额外判定条件。用于区分同一 entityTypes+relationType 组合下的不同物理场景。
   */
  qualifier?: Record<string, string>;
}

// ─── SolverFunction 统一签名 ───

export type SolverFunction = (
  scene: SceneDefinition,
  time: number,
  dt: number,
  prevResult: PhysicsResult | null,
) => PhysicsResult;

/** 可选的批量预计算接口（解析解求解器可提供） */
export type SolverPrecompute = (
  scene: SceneDefinition,
  duration: number,
  sampleRate: number,
) => PhysicsResult[];

// ─── 事件检测器 ───

export interface EventDetector {
  eventType: string;
  detect: (
    scene: SceneDefinition,
    result: PhysicsResult,
    prevResult: PhysicsResult | null,
  ) => EventDetectionResult | null;
}

export interface EventDetectionResult {
  eventType: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

// ─── 求解器注册信息 ───

export interface SolverRegistration {
  /** 求解器唯一标识 */
  id: string;

  /** 显示名称（调试用） */
  label: string;

  /** 匹配模式 */
  pattern: SolverPattern;

  /** 求解模式 */
  solveMode: SolveMode;

  /** 数值积分模式下推荐的积分器 */
  integrator?: IntegratorType;

  /** 求解函数 */
  solve: SolverFunction;

  /** 解析解批量预计算函数 */
  precompute?: SolverPrecompute;

  /** 优先级（数值越小越优先），默认 100 */
  priority?: number;

  /** 事件检测函数列表 */
  eventDetectors?: EventDetector[];
}

// ─── SolverRegistry API ───

export interface ISolverRegistry {
  register(config: SolverRegistration): void;
  match(
    scene: SceneDefinition,
    qualifier?: Record<string, string>,
  ): SolverRegistration[];
  get(id: string): SolverRegistration | undefined;
  getAll(): SolverRegistration[];
}

// ─── 匹配算法 ───

function matchPattern(
  pattern: SolverPattern,
  scene: SceneDefinition,
  qualifier?: Record<string, string>,
): boolean {
  // 1. 检查 entityTypes：场景中是否包含所有 pattern 要求的实体类型
  const sceneEntityTypes = new Set(
    Array.from(scene.entities.values()).map((e) => e.type),
  );
  const allTypesPresent = pattern.entityTypes.every((t) =>
    sceneEntityTypes.has(t),
  );
  if (!allTypesPresent) return false;

  // 2. 检查 relationType
  if (pattern.relationType === 'none') {
    // 特殊值 'none' 匹配无关系场景
    if (scene.relations.length > 0) return false;
  } else {
    const hasRelation = scene.relations.some(
      (r) => r.type === pattern.relationType,
    );
    if (!hasRelation) return false;
  }

  // 3. 检查 qualifier（如果 pattern 有 qualifier）
  if (pattern.qualifier) {
    if (!qualifier) return false;
    for (const [key, value] of Object.entries(pattern.qualifier)) {
      if (qualifier[key] !== value) return false;
    }
  }

  return true;
}

// ─── SolverRegistry 实现 ───

export function createSolverRegistry(): ISolverRegistry {
  const registrations = new Map<string, SolverRegistration>();

  return {
    register(config: SolverRegistration): void {
      if (registrations.has(config.id)) {
        console.warn(
          `[SolverRegistry] 求解器 "${config.id}" 已注册，跳过重复注册`,
        );
        return;
      }
      registrations.set(config.id, {
        ...config,
        priority: config.priority ?? 100,
      });
    },

    match(
      scene: SceneDefinition,
      qualifier?: Record<string, string>,
    ): SolverRegistration[] {
      return Array.from(registrations.values())
        .filter((reg) => matchPattern(reg.pattern, scene, qualifier))
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    },

    get(id: string): SolverRegistration | undefined {
      return registrations.get(id);
    },

    getAll(): SolverRegistration[] {
      return Array.from(registrations.values());
    },
  };
}

/** 全局默认实例 */
export const solverRegistry = createSolverRegistry();
