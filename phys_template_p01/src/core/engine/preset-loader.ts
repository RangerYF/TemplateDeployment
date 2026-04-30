import type {
  Entity,
  EntityId,
  EventActionMapping,
  ParamGroup,
  ParamSchema,
  PresetData,
  Relation,
  SceneDefinition,
  SolveMode,
  ValidationResult,
  ViewportType,
} from '../types';
import {
  entityRegistry,
  solverRegistry,
  type SolverRegistration,
} from '../registries';

// ─── ref → EntityId 映射 ───

let nextRelationId = 1;

function generateRelationId(): string {
  return `relation-${nextRelationId++}`;
}

// ─── 替换 paramGroups 中的 ref 为真实 EntityId ───

function replaceRefsInParamGroups(
  paramGroups: ParamGroup[],
  refToIdMap: Map<string, EntityId>,
): ParamGroup[] {
  return paramGroups.map((group) => ({
    ...group,
    params: group.params.map((param) => {
      if (param.targetEntityId && refToIdMap.has(param.targetEntityId)) {
        return {
          ...param,
          targetEntityId: refToIdMap.get(param.targetEntityId)!,
        } as ParamSchema;
      }
      return param;
    }),
  }));
}

// ─── 替换 eventActions 中的 ref 为真实 EntityId ───

function replaceRefsInEventActions(
  eventActions: EventActionMapping[],
  refToIdMap: Map<string, EntityId>,
): EventActionMapping[] {
  return eventActions.map((ea) => {
    if (ea.entityId && refToIdMap.has(ea.entityId)) {
      return { ...ea, entityId: refToIdMap.get(ea.entityId)! };
    }
    return ea;
  });
}

// ─── PresetLoader ───

export interface PresetLoadResult {
  scene: SceneDefinition;
  solver: SolverRegistration;
  solveMode: SolveMode;
  duration: number;
  defaultViewport: ViewportType;
  supportedViewports: ViewportType[];
  eventActions: EventActionMapping[];
}

/**
 * 校验预设数据的完整性和合法性
 */
export function validatePreset(preset: PresetData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 校验 version
  if (!preset.version) {
    warnings.push('缺少 version 字段，假定为 "1.0"');
  }

  // 校验 entities
  if (!preset.entities || preset.entities.length === 0) {
    warnings.push('entities 列表为空');
  }

  const refSet = new Set<string>();
  for (const entityDef of preset.entities) {
    // 检查 ref 唯一性
    if (refSet.has(entityDef.ref)) {
      errors.push(`实体 ref "${entityDef.ref}" 重复`);
    }
    refSet.add(entityDef.ref);

    // 检查实体类型是否已注册
    if (!entityRegistry.has(entityDef.type)) {
      errors.push(
        `实体类型 "${entityDef.type}" 未在 EntityRegistry 中注册（ref: "${entityDef.ref}"）`,
      );
    }
  }

  // 校验 relations 中的 ref 引用
  for (const relDef of preset.relations) {
    if (!refSet.has(relDef.sourceRef)) {
      errors.push(
        `关系 sourceRef "${relDef.sourceRef}" 在 entities 中不存在`,
      );
    }
    if (!refSet.has(relDef.targetRef)) {
      errors.push(
        `关系 targetRef "${relDef.targetRef}" 在 entities 中不存在`,
      );
    }
  }

  // 校验 paramGroups 中的 targetEntityId 引用
  for (const group of preset.paramGroups) {
    for (const param of group.params) {
      if (param.targetEntityId && !refSet.has(param.targetEntityId)) {
        errors.push(
          `参数 "${param.key}" 的 targetEntityId "${param.targetEntityId}" 在 entities 中不存在`,
        );
      }
    }
  }

  // 校验 defaultViewport 在 supportedViewports 中
  if (!preset.supportedViewports.includes(preset.defaultViewport)) {
    errors.push(
      `defaultViewport "${preset.defaultViewport}" 不在 supportedViewports 中`,
    );
  }

  // 校验 paramValues 覆盖 paramGroups 中每个 param 的 key
  const declaredKeys = new Set<string>();
  for (const group of preset.paramGroups) {
    for (const param of group.params) {
      declaredKeys.add(param.key);
    }
  }
  for (const key of declaredKeys) {
    if (!(key in preset.paramValues)) {
      warnings.push(
        `参数 "${key}" 在 paramGroups 中声明但 paramValues 中无对应值`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 加载预设，构造 SceneDefinition 并匹配求解器
 */
export function loadPreset(preset: PresetData): PresetLoadResult {
  // ① 校验
  const validation = validatePreset(preset);
  if (!validation.valid) {
    throw new Error(
      `预设加载失败 [${preset.id}]: ${validation.errors.join('; ')}`,
    );
  }
  if (validation.warnings.length > 0) {
    for (const w of validation.warnings) {
      console.warn(`[PresetLoader] ${preset.id}: ${w}`);
    }
  }

  // ② 创建实体实例，构建 ref → EntityId 映射
  const refToIdMap = new Map<string, EntityId>();
  const entities = new Map<EntityId, Entity>();

  for (const def of preset.entities) {
    const registration = entityRegistry.get(def.type);
    if (!registration) {
      throw new Error(
        `实体类型 "${def.type}" 未注册（ref: "${def.ref}"）`,
      );
    }

    const entity = registration.createEntity({
      transform: def.transform,
      properties: def.properties,
      label: def.label,
    });

    entities.set(entity.id, entity);
    refToIdMap.set(def.ref, entity.id);
  }

  // ③ 创建关系实例
  const relations: Relation[] = preset.relations.map((relDef) => ({
    id: generateRelationId(),
    type: relDef.type,
    sourceEntityId: refToIdMap.get(relDef.sourceRef)!,
    targetEntityId: refToIdMap.get(relDef.targetRef)!,
    properties: { ...relDef.properties },
  }));

  // ④ 构造参数组（替换 ref 为真实 entityId）
  const paramGroups = replaceRefsInParamGroups(
    preset.paramGroups,
    refToIdMap,
  );

  // ⑤ 组装 SceneDefinition
  const scene: SceneDefinition = {
    entities,
    relations,
    paramGroups,
    paramValues: { ...preset.paramValues },
  };

  // ⑥ 匹配求解器
  const solvers = solverRegistry.match(scene, preset.solverQualifier);
  if (solvers.length === 0) {
    // 阶段5骨架：没有注册求解器时给出警告而非报错
    console.warn(
      `[PresetLoader] 预设 "${preset.id}" 未匹配到求解器，将使用空求解器骨架`,
    );
  }

  const activeSolver = solvers[0] ?? createStubSolver();

  // ⑦ 替换 eventActions 中的 ref
  const eventActions = replaceRefsInEventActions(
    preset.eventActions ?? [],
    refToIdMap,
  );

  return {
    scene,
    solver: activeSolver,
    solveMode: preset.solveMode,
    duration: preset.duration,
    defaultViewport: preset.defaultViewport,
    supportedViewports: preset.supportedViewports,
    eventActions,
  };
}

/**
 * 创建一个空的占位求解器（阶段5骨架用，无实体域注册时兜底）
 */
function createStubSolver(): SolverRegistration {
  return {
    id: '__stub__',
    label: '占位求解器',
    pattern: { entityTypes: [], relationType: 'none' },
    solveMode: 'analytical',
    solve: (_scene, time) => ({
      time,
      forceAnalyses: new Map(),
      motionStates: new Map(),
    }),
  };
}
