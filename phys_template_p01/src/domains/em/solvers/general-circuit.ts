import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult, Relation } from '@/core/types';
import {
  checkOverRange,
  findComponent,
  getEffectiveResistance,
  parallelResistance,
} from '../logic/circuit-solver-utils';

type CircuitPortSide = 'top' | 'bottom' | 'left' | 'right';
type RelationCurrentDirection = -1 | 0 | 1;

const CURRENT_EPSILON = 1e-6;
const CENTER_BASED_ENTITY_TYPES = new Set([
  'ammeter',
  'voltmeter',
  'galvanometer',
  'bulb',
  'motor',
]);

/**
 * 通用电路求解器（自由搭建模式兜底）
 *
 * 基于 relations 连线拓扑分析串并联结构：
 * 1. 从 relations 构建邻接图（节点 = 实体端口）
 * 2. 识别并联支路（两个元件共享同一对节点）
 * 3. 计算等效电阻（串联相加、并联公式）
 * 4. 求总电流，分配各支路电流和电压
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();
  const empty: PhysicsResult = { time: 0, forceAnalyses, motionStates };

  const source = findComponent(scene.entities, 'dc-source');
  if (!source) return empty;

  const emf = (source.properties.emf as number) ?? 6;
  const r = (source.properties.internalResistance as number) ?? 1;

  // ── 分类元件 ──
  const voltmeters: Entity[] = [];
  const circuitEntities: Entity[] = []; // 参与电路计算的非电源非电压表元件

  for (const entity of scene.entities.values()) {
    if (entity.type === 'dc-source') continue;
    if (entity.type === 'voltmeter') {
      voltmeters.push(entity);
      continue;
    }
    circuitEntities.push(entity);
  }

  // 开关断开检测
  for (const entity of circuitEntities) {
    if (entity.type === 'switch') {
      const closed = (entity.properties.closed as boolean) ?? true;
      if (!closed) {
        clearAllReadings(scene.entities, scene.relations);
        source.properties.totalCurrent = 0;
        source.properties.terminalVoltage = emf;
        source.properties.circuitType = 'general-circuit';
        for (const vm of voltmeters) {
          vm.properties.reading = emf;
          vm.properties.overRange = Math.abs(emf) > ((vm.properties.range as number) ?? 15);
        }
        return empty;
      }
    }
    if (entity.type === 'capacitor') {
      clearAllReadings(scene.entities, scene.relations);
      source.properties.totalCurrent = 0;
      source.properties.terminalVoltage = emf;
      source.properties.circuitType = 'general-circuit';
      return empty;
    }
  }

  // ── 基于 relations 分析并联 ──
  // 找出哪些元件共享同一对连接目标（即并联）
  const parallelGroups = findParallelGroups(scene.entities, scene.relations, voltmeters);

  // ── 计算总等效电阻 ──
  const processed = new Set<string>(); // 已处理的元件 id
  let R_external = 0;

  // 先处理并联组
  for (const group of parallelGroups) {
    let R_par = Infinity;
    for (const ent of group) {
      const Ri = getComponentResistance(ent);
      if (Ri <= 0) { R_par = 0; break; }
      R_par = R_par === Infinity ? Ri : parallelResistance(R_par, Ri);
      processed.add(ent.id);
    }
    R_external += R_par === Infinity ? 0 : R_par;
  }

  // 剩余未处理的元件 → 串联
  for (const entity of circuitEntities) {
    if (processed.has(entity.id)) continue;
    R_external += getComponentResistance(entity);
    processed.add(entity.id);
  }

  const R_total = r + R_external;

  // ── 求解总电流（保留符号，供导线箭头/方向判断使用） ──
  let motorBackEmf = 0;
  for (const entity of circuitEntities) {
    if (entity.type === 'motor') {
      motorBackEmf += (entity.properties.backEmf as number) ?? 0;
    }
  }
  const effectiveEmf = emf - motorBackEmf;
  const I_total = R_total > 0 ? effectiveEmf / R_total : 0;

  // ── 写入电源状态 ──
  source.properties.totalCurrent = I_total;
  source.properties.terminalVoltage = emf - I_total * r;
  source.properties.circuitType = 'general-circuit';

  // ── 写入各元件状态 ──
  // 并联组：各支路分流
  for (const group of parallelGroups) {
    // 并联组的总电压 = I_total × R_parallel
    let R_par = Infinity;
    for (const ent of group) {
      const Ri = getComponentResistance(ent);
      if (Ri <= 0) { R_par = 0; break; }
      R_par = R_par === Infinity ? Ri : parallelResistance(R_par, Ri);
    }
    const U_par = I_total * (R_par === Infinity ? 0 : R_par);

    for (const ent of group) {
      const Ri = getComponentResistance(ent);
      const I_branch = Ri > 0 ? U_par / Ri : 0;
      writeComponentState(ent, I_branch, U_par);
    }
  }

  // 串联元件：电流 = I_total
  for (const entity of circuitEntities) {
    if (parallelGroups.some((g) => g.some((e) => e.id === entity.id))) continue;
    writeComponentState(entity, I_total);
  }

  // ── 电压表 ──
  solveVoltmeters(voltmeters, circuitEntities, scene.relations, scene.entities, source, emf, r, I_total);
  updateConnectionCurrents({
    entities: scene.entities,
    relations: scene.relations,
    voltmeters,
    source,
    totalCurrent: I_total,
  });

  return empty;
};

// ─── 并联检测 ───

/**
 * 从 relations 中找出并联的元件组。
 * 并联的定义：两个元件的端口连接到同一对节点（即共享左右两个连接目标）。
 *
 * 简化模型：如果两个非电压表元件都连接到同一对其他元件，则它们并联。
 */
function findParallelGroups(
  entities: Map<string, Entity>,
  relations: Relation[],
  voltmeters: Entity[],
): Entity[][] {
  const vmIds = new Set(voltmeters.map((v) => v.id));

  // 为每个元件建立"邻居集合"（通过 connection 连接到的其他元件 id）
  const neighbors = new Map<string, Set<string>>();
  for (const rel of relations) {
    if (rel.type !== 'connection') continue;
    const a = rel.sourceEntityId;
    const b = rel.targetEntityId;
    if (vmIds.has(a) || vmIds.has(b)) continue; // 忽略电压表连线

    if (!neighbors.has(a)) neighbors.set(a, new Set());
    if (!neighbors.has(b)) neighbors.set(b, new Set());
    neighbors.get(a)!.add(b);
    neighbors.get(b)!.add(a);
  }

  // 找出共享完全相同邻居集的非电源元件 → 并联
  // 排除电源（电源不参与并联分组）
  const candidateIds = Array.from(neighbors.keys()).filter((id) => {
    const ent = entities.get(id);
    return ent && ent.type !== 'dc-source' && !vmIds.has(id);
  });

  // 按邻居集分组
  const groupMap = new Map<string, Entity[]>();
  for (const id of candidateIds) {
    const nb = neighbors.get(id);
    if (!nb || nb.size < 2) continue; // 并联至少需要连接到 2 个不同节点
    const key = Array.from(nb).sort().join(',');
    if (!groupMap.has(key)) groupMap.set(key, []);
    const ent = entities.get(id);
    if (ent) groupMap.get(key)!.push(ent);
  }

  // 只保留 ≥2 个元件的组（才构成并联）
  return Array.from(groupMap.values()).filter((g) => g.length >= 2);
}

// ─── 获取元件等效电阻 ───

function getComponentResistance(entity: Entity): number {
  const fault = entity.properties.faultType as string | undefined;
  if (fault === 'open') return Infinity;
  if (fault === 'short') return 0;

  switch (entity.type) {
    case 'fixed-resistor':
    case 'resistance-box':
    case 'slide-rheostat':
      return getEffectiveResistance(entity);
    case 'ammeter':
    case 'galvanometer':
      return (entity.properties.internalResistance as number) ?? 0;
    case 'motor':
      return (entity.properties.coilResistance as number) ?? 1;
    case 'bulb':
      return (entity.properties.coldResistance as number) ?? 2;
    case 'switch':
      return (entity.properties.closed as boolean) !== false ? 0 : Infinity;
    default:
      return 0;
  }
}

// ─── 写入元件运行状态 ───

function writeComponentState(entity: Entity, I: number, overrideU?: number): void {
  const R = getComponentResistance(entity);
  const U = overrideU ?? (isFinite(R) ? I * R : 0);

  switch (entity.type) {
    case 'fixed-resistor':
    case 'resistance-box':
    case 'slide-rheostat':
      entity.properties.voltage = U;
      entity.properties.current = I;
      break;

    case 'ammeter':
      checkOverRange(entity, I, (entity.properties.range as number) ?? 0.6);
      entity.properties.current = I;
      entity.properties.voltage = U;
      break;

    case 'galvanometer':
      entity.properties.reading = I * 1e6;
      entity.properties.overRange = Math.abs(I * 1e6) > ((entity.properties.range as number) ?? 500);
      entity.properties.current = I;
      entity.properties.voltage = U;
      break;

    case 'motor': {
      const backEmf = (entity.properties.backEmf as number) ?? 0;
      const Rcoil = (entity.properties.coilResistance as number) ?? 1;
      const U_motor = backEmf + I * Rcoil;
      entity.properties.voltage = U_motor;
      entity.properties.current = I;
      entity.properties.electricPower = U_motor * I;
      entity.properties.heatPower = I * I * Rcoil;
      entity.properties.mechanicalPower = backEmf * I;
      break;
    }

    case 'bulb': {
      entity.properties.hotResistance = R;
      entity.properties.voltage = U;
      entity.properties.current = I;
      entity.properties.power = I * U;
      break;
    }

    case 'switch':
      break;

    default:
      if ('voltage' in entity.properties) entity.properties.voltage = U;
      if ('current' in entity.properties) entity.properties.current = I;
      break;
  }
}

// ─── 电压表求解 ───

function solveVoltmeters(
  voltmeters: Entity[],
  _circuitEntities: Entity[],
  relations: Relation[],
  allEntities: Map<string, Entity>,
  _source: Entity,
  emf: number,
  r: number,
  I_total: number,
): void {
  for (const vm of voltmeters) {
    const connections: Array<{ entityId: string }> = [];
    for (const rel of relations) {
      if (rel.type !== 'connection') continue;
      if (rel.sourceEntityId === vm.id) connections.push({ entityId: rel.targetEntityId });
      if (rel.targetEntityId === vm.id) connections.push({ entityId: rel.sourceEntityId });
    }

    if (connections.length < 2) {
      checkOverRange(vm, 0, (vm.properties.range as number) ?? 15);
      continue;
    }

    const uniqueIds = new Set(connections.map((c) => c.entityId));

    if (uniqueIds.size === 1) {
      // 方式A：两端连同一元件
      const target = allEntities.get(connections[0]!.entityId);
      if (target) {
        if (target.type === 'dc-source') {
          checkOverRange(vm, emf - I_total * r, (vm.properties.range as number) ?? 15);
        } else {
          const U = (target.properties.voltage as number) ?? 0;
          checkOverRange(vm, U, (vm.properties.range as number) ?? 15);
        }
      } else {
        checkOverRange(vm, 0, (vm.properties.range as number) ?? 15);
      }
    } else {
      // 方式B：两端连不同元件
      const connectedEntities = Array.from(uniqueIds)
        .map((id) => allEntities.get(id))
        .filter((e): e is Entity => e !== undefined && e.type !== 'voltmeter');

      const hasSource = connectedEntities.some((e) => e.type === 'dc-source');

      if (hasSource) {
        checkOverRange(vm, emf - I_total * r, (vm.properties.range as number) ?? 15);
      } else {
        // 累加连接的元件之间的电压
        let U = 0;
        for (const ent of connectedEntities) {
          U += (ent.properties.voltage as number) ?? 0;
        }
        checkOverRange(vm, U, (vm.properties.range as number) ?? 15);
      }
    }
  }
}

// ─── 清零所有仪表和元件 ───

function clearAllReadings(entities: Map<string, Entity>, relations: Relation[]): void {
  for (const entity of entities.values()) {
    if (entity.type === 'ammeter' || entity.type === 'voltmeter' || entity.type === 'galvanometer') {
      entity.properties.reading = 0;
      entity.properties.overRange = false;
    }
    if ('voltage' in entity.properties) entity.properties.voltage = 0;
    if ('current' in entity.properties) entity.properties.current = 0;
    if ('power' in entity.properties) entity.properties.power = 0;
    if ('electricPower' in entity.properties) entity.properties.electricPower = 0;
    if ('heatPower' in entity.properties) entity.properties.heatPower = 0;
    if ('mechanicalPower' in entity.properties) entity.properties.mechanicalPower = 0;
  }

  clearConnectionCurrents(relations);
}

function clearConnectionCurrents(relations: Relation[]): void {
  for (const relation of relations) {
    if (relation.type !== 'connection') continue;
    relation.properties.currentMagnitude = 0;
    relation.properties.currentDirection = 0;
  }
}

function updateConnectionCurrents(params: {
  entities: Map<string, Entity>;
  relations: Relation[];
  voltmeters: Entity[];
  source: Entity;
  totalCurrent: number;
}): void {
  clearConnectionCurrents(params.relations);

  if (!Number.isFinite(params.totalCurrent) || Math.abs(params.totalCurrent) <= CURRENT_EPSILON) {
    return;
  }

  const voltmeterIds = new Set(params.voltmeters.map((entity) => entity.id));
  const activeRelations = params.relations.filter((relation) => (
    relation.type === 'connection' &&
    !voltmeterIds.has(relation.sourceEntityId) &&
    !voltmeterIds.has(relation.targetEntityId)
  ));

  if (activeRelations.length === 0) return;

  const orientation = getSourcePolarityOrientation(params.source);
  const sourceRelationInfos = activeRelations
    .filter((relation) =>
      relation.sourceEntityId === params.source.id || relation.targetEntityId === params.source.id,
    )
    .map((relation) => {
      const neighborId = relation.sourceEntityId === params.source.id
        ? relation.targetEntityId
        : relation.sourceEntityId;
      const neighbor = params.entities.get(neighborId);
      const side = getRelationPortSide(relation, params.source.id);
      const bias = neighbor
        ? getNeighborOrientationBias(params.source, neighbor, orientation)
        : { positive: 0, negative: 0 };

      return {
        relation,
        neighborId,
        positiveScore: getSourcePortScore(side, 'positive', orientation) + bias.positive,
        negativeScore: getSourcePortScore(side, 'negative', orientation) + bias.negative,
      };
    });

  if (sourceRelationInfos.length === 0) return;

  const relationSide = new Map<string, RelationCurrentDirection>();
  for (const info of sourceRelationInfos) {
    relationSide.set(
      info.relation.id,
      info.positiveScore > info.negativeScore
        ? 1
        : info.negativeScore > info.positiveScore
          ? -1
          : 0,
    );
  }

  if (!Array.from(relationSide.values()).some((value) => value === 1)) {
    const bestPositive = [...sourceRelationInfos]
      .sort((left, right) => right.positiveScore - left.positiveScore)[0];
    if (bestPositive) relationSide.set(bestPositive.relation.id, 1);
  }

  if (!Array.from(relationSide.values()).some((value) => value === -1)) {
    const bestNegative = [...sourceRelationInfos]
      .filter((info) => relationSide.get(info.relation.id) !== 1)
      .sort((left, right) => right.negativeScore - left.negativeScore)[0];
    if (bestNegative) relationSide.set(bestNegative.relation.id, -1);
  }

  const positiveNeighborIds = sourceRelationInfos
    .filter((info) => relationSide.get(info.relation.id) === 1)
    .map((info) => info.neighborId);
  const negativeNeighborIds = sourceRelationInfos
    .filter((info) => relationSide.get(info.relation.id) === -1)
    .map((info) => info.neighborId);

  const positiveDistances = buildEntityDistances(
    activeRelations,
    params.source.id,
    positiveNeighborIds,
  );
  const negativeDistances = buildEntityDistances(
    activeRelations,
    params.source.id,
    negativeNeighborIds,
  );

  for (const relation of activeRelations) {
    const magnitude = resolveRelationCurrentMagnitude(
      relation,
      params.entities,
      params.source.id,
      params.totalCurrent,
    );
    if (magnitude <= CURRENT_EPSILON) continue;

    let direction = resolveRelationCurrentDirection({
      relation,
      relationSide,
      sourceId: params.source.id,
      positiveDistances,
      negativeDistances,
      entities: params.entities,
    });

    if (params.totalCurrent < 0) {
      direction = invertDirection(direction);
    }

    relation.properties.currentMagnitude = magnitude;
    relation.properties.currentDirection = direction;
  }
}

function getSourcePolarityOrientation(source: Entity): 'horizontal' | 'vertical' {
  const circuitType = source.properties.circuitType as string | undefined;
  return circuitType === 'ohmmeter' || circuitType === 'multi-range-ohmmeter'
    ? 'vertical'
    : 'horizontal';
}

function getSourcePortScore(
  side: CircuitPortSide | undefined,
  polarity: 'positive' | 'negative',
  orientation: 'horizontal' | 'vertical',
): number {
  if (!side) return 0;

  if (orientation === 'vertical') {
    const positiveScores: Record<CircuitPortSide, number> = {
      top: 4,
      right: 2,
      left: 2,
      bottom: 1,
    };
    const negativeScores: Record<CircuitPortSide, number> = {
      bottom: 4,
      left: 2,
      right: 2,
      top: 1,
    };
    return polarity === 'positive' ? positiveScores[side] : negativeScores[side];
  }

  const positiveScores: Record<CircuitPortSide, number> = {
    right: 4,
    top: 2,
    bottom: 2,
    left: 1,
  };
  const negativeScores: Record<CircuitPortSide, number> = {
    left: 4,
    bottom: 2,
    top: 2,
    right: 1,
  };
  return polarity === 'positive' ? positiveScores[side] : negativeScores[side];
}

function getRelationPortSide(
  relation: Relation,
  entityId: string,
): CircuitPortSide | undefined {
  if (relation.sourceEntityId === entityId) {
    return relation.properties.sourcePort as CircuitPortSide | undefined;
  }
  if (relation.targetEntityId === entityId) {
    return relation.properties.targetPort as CircuitPortSide | undefined;
  }
  return undefined;
}

function getEntityCenter(entity: Entity): { x: number; y: number } {
  const position = entity.transform.position;
  const radius = entity.properties.radius as number | undefined;
  const width = (entity.properties.width as number | undefined) ?? (radius ? radius * 2 : 0.5);
  const height = (entity.properties.height as number | undefined) ?? width;

  if (radius !== undefined || CENTER_BASED_ENTITY_TYPES.has(entity.type)) {
    return { x: position.x, y: position.y };
  }

  return {
    x: position.x + width / 2,
    y: position.y + height / 2,
  };
}

function getNeighborOrientationBias(
  source: Entity,
  neighbor: Entity,
  orientation: 'horizontal' | 'vertical',
): { positive: number; negative: number } {
  const sourceCenter = getEntityCenter(source);
  const neighborCenter = getEntityCenter(neighbor);

  if (orientation === 'horizontal') {
    const deltaX = neighborCenter.x - sourceCenter.x;
    if (Math.abs(deltaX) <= CURRENT_EPSILON) return { positive: 0, negative: 0 };
    return deltaX > 0
      ? { positive: 3, negative: 0 }
      : { positive: 0, negative: 3 };
  }

  const deltaY = neighborCenter.y - sourceCenter.y;
  if (Math.abs(deltaY) <= CURRENT_EPSILON) return { positive: 0, negative: 0 };
  // 物理坐标系中 y 轴向上，因此邻居位于上方（deltaY > 0）时应更接近上端正极。
  return deltaY > 0
    ? { positive: 3, negative: 0 }
    : { positive: 0, negative: 3 };
}

function buildEntityDistances(
  relations: Relation[],
  sourceEntityId: string,
  seedEntityIds: string[],
): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();

  for (const relation of relations) {
    if (relation.sourceEntityId === sourceEntityId || relation.targetEntityId === sourceEntityId) {
      continue;
    }

    if (!adjacency.has(relation.sourceEntityId)) adjacency.set(relation.sourceEntityId, new Set());
    if (!adjacency.has(relation.targetEntityId)) adjacency.set(relation.targetEntityId, new Set());
    adjacency.get(relation.sourceEntityId)!.add(relation.targetEntityId);
    adjacency.get(relation.targetEntityId)!.add(relation.sourceEntityId);
  }

  const distances = new Map<string, number>();
  const queue: string[] = [];

  for (const entityId of seedEntityIds) {
    if (entityId === sourceEntityId || distances.has(entityId)) continue;
    distances.set(entityId, 0);
    queue.push(entityId);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const baseDistance = distances.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (distances.has(next)) continue;
      distances.set(next, baseDistance + 1);
      queue.push(next);
    }
  }

  return distances;
}

function resolveRelationCurrentMagnitude(
  relation: Relation,
  entities: Map<string, Entity>,
  sourceId: string,
  totalCurrent: number,
): number {
  const sourceEntity = entities.get(relation.sourceEntityId);
  const targetEntity = entities.get(relation.targetEntityId);

  if (!sourceEntity || !targetEntity) return Math.abs(totalCurrent);

  const sourceMagnitude = readEntityCurrentMagnitude(sourceEntity);
  const targetMagnitude = readEntityCurrentMagnitude(targetEntity);

  if (relation.sourceEntityId === sourceId) {
    return targetMagnitude ?? Math.abs(totalCurrent);
  }
  if (relation.targetEntityId === sourceId) {
    return sourceMagnitude ?? Math.abs(totalCurrent);
  }
  if (sourceMagnitude != null && targetMagnitude != null) {
    return Math.min(sourceMagnitude, targetMagnitude);
  }

  return sourceMagnitude ?? targetMagnitude ?? Math.abs(totalCurrent);
}

function readEntityCurrentMagnitude(entity: Entity): number | null {
  const value = entity.properties.current as number | undefined;
  if (value === undefined || !Number.isFinite(value)) return null;
  return Math.abs(value);
}

function resolveRelationCurrentDirection(params: {
  relation: Relation;
  relationSide: Map<string, RelationCurrentDirection>;
  sourceId: string;
  positiveDistances: Map<string, number>;
  negativeDistances: Map<string, number>;
  entities: Map<string, Entity>;
}): RelationCurrentDirection {
  const touchesSource =
    params.relation.sourceEntityId === params.sourceId ||
    params.relation.targetEntityId === params.sourceId;

  if (touchesSource) {
    const side = params.relationSide.get(params.relation.id) ?? 0;
    const sourceIsStart = params.relation.sourceEntityId === params.sourceId;
    if (side === 1) return sourceIsStart ? 1 : -1;
    if (side === -1) return sourceIsStart ? -1 : 1;
  }

  const sourceScore = getEntityFlowScore(
    params.relation.sourceEntityId,
    params.positiveDistances,
    params.negativeDistances,
  );
  const targetScore = getEntityFlowScore(
    params.relation.targetEntityId,
    params.positiveDistances,
    params.negativeDistances,
  );

  if (
    sourceScore !== null &&
    targetScore !== null &&
    Math.abs(sourceScore - targetScore) > CURRENT_EPSILON
  ) {
    return sourceScore < targetScore ? 1 : -1;
  }

  const sourcePositive = params.positiveDistances.get(params.relation.sourceEntityId);
  const targetPositive = params.positiveDistances.get(params.relation.targetEntityId);
  if (
    sourcePositive != null &&
    targetPositive != null &&
    sourcePositive !== targetPositive
  ) {
    return sourcePositive < targetPositive ? 1 : -1;
  }

  const sourceNegative = params.negativeDistances.get(params.relation.sourceEntityId);
  const targetNegative = params.negativeDistances.get(params.relation.targetEntityId);
  if (
    sourceNegative != null &&
    targetNegative != null &&
    sourceNegative !== targetNegative
  ) {
    return sourceNegative > targetNegative ? 1 : -1;
  }

  const sourceEntity = params.entities.get(params.relation.sourceEntityId);
  const targetEntity = params.entities.get(params.relation.targetEntityId);
  if (sourceEntity && targetEntity) {
    const sourceCenter = getEntityCenter(sourceEntity);
    const targetCenter = getEntityCenter(targetEntity);
    const deltaX = targetCenter.x - sourceCenter.x;
    const deltaY = targetCenter.y - sourceCenter.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY) && Math.abs(deltaX) > CURRENT_EPSILON) {
      return deltaX > 0 ? 1 : -1;
    }
    if (Math.abs(deltaY) > CURRENT_EPSILON) {
      return deltaY < 0 ? 1 : -1;
    }
  }

  return 1;
}

function getEntityFlowScore(
  entityId: string,
  positiveDistances: Map<string, number>,
  negativeDistances: Map<string, number>,
): number | null {
  const positive = positiveDistances.get(entityId);
  const negative = negativeDistances.get(entityId);

  if (positive != null && negative != null) {
    return positive - negative;
  }
  if (positive != null) return positive;
  if (negative != null) return -negative;
  return null;
}

function invertDirection(direction: RelationCurrentDirection): RelationCurrentDirection {
  return direction === 1 ? -1 : direction === -1 ? 1 : 0;
}

export function registerGeneralCircuitSolver(): void {
  solverRegistry.register({
    id: 'em-general-circuit',
    label: '通用电路（自由搭建）',
    pattern: {
      entityTypes: ['dc-source'],
      relationType: 'connection',
      qualifier: { circuit: 'general-circuit' },
    },
    solveMode: 'analytical',
    priority: 999,
    solve: solver,
  });
}
