import { getPresetById } from '@/data/presets';
import { useDemoEntityStore } from '@/editor/demo/demoEntityStore';
import { useDemoToolStore, type DemoToolSnapshot } from '@/editor/demo/demoToolStore';
import type { DemoBinding, DemoEntity, DemoOpKind, DemoPoint, DemoSnapshot, DemoVecOp, DemoVector } from '@/editor/demo/demoTypes';
import type { Command } from '@/editor/commands/types';
import { OPERATION_META, type OperationType, type Vec2D, type Vec3D } from '@/editor/entities/types';
import { useHistoryStore, useUIStore, useVectorStore } from '@/editor/store';
import type { UISnapshot } from '@/editor/store/uiStore';
import type { VectorSnapshot } from '@/editor/store/vectorStore';
import { cross2D } from '@/engine/vectorMath';

export interface M06BridgeOperationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  applied: number;
  rolledBack?: boolean;
}

type AiOperation = Record<string, unknown> & { type?: unknown };

type M06StateSnapshot = {
  vector: VectorSnapshot;
  ui: UISnapshot;
  demo: DemoSnapshot;
  demoTool: DemoToolSnapshot;
};

const MAX_HISTORY = 50;
const OPERATIONS = new Set<OperationType>(Object.keys(OPERATION_META) as OperationType[]);
const DEMO_OP_KINDS = new Set<DemoOpKind>(['add', 'subtract', 'dotProduct', 'scale']);

function cloneSerializable<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function finiteNumber(value: unknown, key: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${key} 必须是 ${min} 到 ${max} 之间的数字`);
  }
  return value;
}

function positiveInteger(value: unknown, key: string, min = 0, max = 100): number {
  const number = finiteNumber(value, key, min, max);
  if (!Number.isInteger(number)) throw new Error(`${key} 必须是整数`);
  return number;
}

function readOperationType(value: unknown): OperationType | null {
  return typeof value === 'string' && OPERATIONS.has(value as OperationType) ? value as OperationType : null;
}

function readVec2(value: unknown, key: string): Vec2D {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${key} 必须是 [x,y]`);
  return [finiteNumber(value[0], `${key}[0]`), finiteNumber(value[1], `${key}[1]`)];
}

function readVec3(value: unknown, key: string): Vec3D {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`${key} 必须是 [x,y,z]`);
  return [finiteNumber(value[0], `${key}[0]`), finiteNumber(value[1], `${key}[1]`), finiteNumber(value[2], `${key}[2]`)];
}

function asEndpoint(value: unknown): 'start' | 'end' {
  const endpoint = asString(value);
  if (endpoint !== 'start' && endpoint !== 'end') throw new Error('endpoint 必须是 start 或 end');
  return endpoint;
}

function entityById(id: string): DemoEntity {
  const entity = useDemoEntityStore.getState().entities[id];
  if (!entity) throw new Error(`找不到 demo 实体 ${id}`);
  return entity;
}

function demoPoint(id: string): DemoPoint {
  const entity = entityById(id);
  if (entity.type !== 'demoPoint') throw new Error(`${id} 不是 demo 端点`);
  return entity;
}

function cloneM06State(): M06StateSnapshot {
  return {
    vector: cloneSerializable(useVectorStore.getState().getSnapshot()),
    ui: cloneSerializable(useUIStore.getState().getSnapshot()),
    demo: cloneSerializable(useDemoEntityStore.getState().getSnapshot()),
    demoTool: cloneSerializable(useDemoToolStore.getState().getSnapshot()),
  };
}

function loadM06State(snapshot: M06StateSnapshot): void {
  useVectorStore.getState().loadSnapshot(cloneSerializable(snapshot.vector));
  useUIStore.getState().loadSnapshot(cloneSerializable(snapshot.ui));
  useDemoEntityStore.getState().loadSnapshot(cloneSerializable(snapshot.demo));
  useDemoToolStore.getState().loadSnapshot(cloneSerializable(snapshot.demoTool));
}

function createSnapshotCommand(before: M06StateSnapshot, after: M06StateSnapshot): Command {
  return {
    type: 'aiPipeline',
    label: 'AI 向量演示搭建',
    execute() {
      loadM06State(after);
    },
    undo() {
      loadM06State(before);
    },
  };
}

function replacePipelineHistory(before: M06StateSnapshot, after: M06StateSnapshot, baseUndoStack: Command[]): void {
  const nextUndoStack = [
    ...baseUndoStack,
    createSnapshotCommand(before, after),
  ].slice(-MAX_HISTORY);

  useHistoryStore.setState({
    undoStack: nextUndoStack,
    redoStack: [],
    canUndo: nextUndoStack.length > 0,
    canRedo: false,
  });
}

function executeSetOperation(operation: AiOperation): void {
  const op = readOperationType(operation.operation) ?? readOperationType(operation.operationType) ?? readOperationType(operation.mode);
  if (!op) throw new Error('setOperation 缺少合法 operation');
  useVectorStore.getState().setOperation(op);
}

function executeLoadVectorPreset(operation: AiOperation): void {
  const presetId = asString(operation.presetId) ?? asString(operation.id);
  if (!presetId) throw new Error('loadVectorPreset 缺少 presetId');
  const preset = getPresetById(presetId);
  if (!preset) throw new Error(`未知向量预设 ${presetId}`);
  useVectorStore.getState().loadPreset(preset);
}

function executeLoadTeachingScenario(operation: AiOperation): void {
  const scenarioId = asString(operation.scenarioId) ?? asString(operation.presetId);
  if (!scenarioId) throw new Error('loadTeachingScenario 缺少 scenarioId');
  const scenarioToPreset: Record<string, string> = {
    'vector-basic-elements': 'VEC-001-A',
    'coordinate-345': 'VEC-002-A',
    'parallelogram-rule': 'VEC-011-B',
    'triangle-chain': 'VEC-012-A',
    'subtraction-common-origin': 'VEC-021-A',
    'scalar-negative': 'VEC-031-C',
    'dot-perpendicular': 'VEC-041-A',
    'dot-projection': 'VEC-041-G',
    'polarization-identity': 'VEC-041-F',
    'basis-decomposition': 'VEC-051-C',
    'space-vector-dot': 'VEC-061-B',
    'cross-product-area': 'VEC-062-C',
    'cube-diagonal': 'VEC-071-A',
    'pyramid-normal': 'VEC-071-B',
  };
  const presetId = scenarioToPreset[scenarioId];
  if (!presetId) throw new Error(`未知教学场景 ${scenarioId}`);
  executeLoadVectorPreset({ type: 'loadVectorPreset', presetId });
  if (scenarioId === 'dot-projection') {
    useVectorStore.setState({ showProjection: true, showAngleArc: true });
  }
  if (scenarioId === 'polarization-identity') {
    useVectorStore.setState({ showPolarization: true });
  }
}

function executeSetVector2D(operation: AiOperation): void {
  const target = asString(operation.target) ?? asString(operation.vectorKey);
  const value = readVec2(operation.value ?? operation.vec ?? operation.vector, 'value');
  const store = useVectorStore.getState();
  switch (target) {
    case 'a':
    case 'vecA':
      store.setVecA(value);
      return;
    case 'b':
    case 'vecB':
      store.setVecB(value);
      return;
    case 'decompTarget':
    case 'target':
      store.setDecompTarget(value);
      return;
    case 'basis1':
    case 'e1':
      store.setBasis1(value);
      return;
    case 'basis2':
    case 'e2':
      store.setBasis2(value);
      return;
    case 'chain': {
      const index = positiveInteger(operation.index, 'index', 0, 50);
      while (useVectorStore.getState().chainVecs.length <= index) {
        useVectorStore.getState().addChainVec();
      }
      useVectorStore.getState().setChainVec(index, value);
      return;
    }
    default:
      throw new Error('setVector2D target 必须是 vecA、vecB、decompTarget、basis1、basis2 或 chain');
  }
}

function executeSetVector3D(operation: AiOperation): void {
  const target = asString(operation.target) ?? asString(operation.vectorKey);
  const value = readVec3(operation.value ?? operation.vec ?? operation.vector, 'value');
  const store = useVectorStore.getState();
  if (target === 'a3' || target === 'vecA3') {
    store.setVecA3(value);
    return;
  }
  if (target === 'b3' || target === 'vecB3') {
    store.setVecB3(value);
    return;
  }
  throw new Error('setVector3D target 必须是 vecA3 或 vecB3');
}

function executeSetChainVectors(operation: AiOperation): void {
  if (!Array.isArray(operation.vectors)) throw new Error('setChainVectors 缺少 vectors');
  const vectors = operation.vectors.map((item, index) => readVec2(item, `vectors[${index}]`));
  useVectorStore.setState({ chainVecs: vectors, activePresetId: null });
}

function executeSetScalar(operation: AiOperation): void {
  const scalar = finiteNumber(operation.k ?? operation.scalarK ?? operation.value, 'scalarK');
  useVectorStore.getState().setScalarK(scalar);
}

function executeSetDotProductDemo(operation: AiOperation): void {
  useVectorStore.getState().setOperation('dotProduct');
  if (operation.vecA ?? operation.a) useVectorStore.getState().setVecA(readVec2(operation.vecA ?? operation.a, 'vecA'));
  if (operation.vecB ?? operation.b) useVectorStore.getState().setVecB(readVec2(operation.vecB ?? operation.b, 'vecB'));
  useVectorStore.setState({
    showAngleArc: asBoolean(operation.showAngleArc) ?? true,
    showProjection: asBoolean(operation.showProjection) ?? false,
    showPolarization: asBoolean(operation.showPolarization) ?? false,
  });
}

function executeSetDecompositionDemo(operation: AiOperation): void {
  useVectorStore.getState().setOperation('decomposition');
  useVectorStore.getState().setDecompTarget(readVec2(operation.decompTarget ?? operation.target, 'decompTarget'));
  useVectorStore.getState().setBasis1(readVec2(operation.basis1 ?? operation.e1, 'basis1'));
  useVectorStore.getState().setBasis2(readVec2(operation.basis2 ?? operation.e2, 'basis2'));
  useVectorStore.setState({
    showDecompParallel: asBoolean(operation.showDecompParallel) ?? true,
  });
}

function executeSetCrossProductDemo(operation: AiOperation): void {
  useVectorStore.getState().setOperation('crossProduct');
  if (operation.vecA3 ?? operation.a3 ?? operation.a) {
    useVectorStore.getState().setVecA3(readVec3(operation.vecA3 ?? operation.a3 ?? operation.a, 'vecA3'));
  }
  if (operation.vecB3 ?? operation.b3 ?? operation.b) {
    useVectorStore.getState().setVecB3(readVec3(operation.vecB3 ?? operation.b3 ?? operation.b, 'vecB3'));
  }
  useVectorStore.setState({
    show3DGrid: asBoolean(operation.show3DGrid) ?? useVectorStore.getState().show3DGrid,
    showPerspective: asBoolean(operation.showPerspective) ?? useVectorStore.getState().showPerspective,
  });
}

function executeSetTriangleChainDemo(operation: AiOperation): void {
  if (!Array.isArray(operation.vectors) || operation.vectors.length < 2) {
    throw new Error('setTriangleChainDemo 至少需要两个二维向量');
  }
  const vectors = operation.vectors.map((item, index) => readVec2(item, `vectors[${index}]`));
  useVectorStore.getState().setOperation('triangle');
  useVectorStore.getState().setVecA(vectors[0]);
  useVectorStore.getState().setVecB(vectors[1]);
  useVectorStore.setState({ chainVecs: vectors.slice(2), activePresetId: null });
}

function executeSetDisplayOptions(operation: AiOperation): void {
  const vectorPatch: Partial<VectorSnapshot> = {};
  const uiPatch: Partial<UISnapshot> = {};
  const vectorKeys = [
    'showGrid',
    'showAngleArc',
    'showProjection',
    'showDecompParallel',
    'showPerspective',
    'show3DGrid',
    'showPolarization',
  ] as const;
  const uiKeys = ['showTeachingPoints', 'showCoordLabels', 'scenarioPanelOpen', 'paramPanelOpen'] as const;

  vectorKeys.forEach((key) => {
    const value = asBoolean(operation[key]);
    if (value !== null) vectorPatch[key] = value;
  });
  uiKeys.forEach((key) => {
    const value = asBoolean(operation[key]);
    if (value !== null) uiPatch[key] = value;
  });
  if (Object.keys(vectorPatch).length === 0 && Object.keys(uiPatch).length === 0) {
    throw new Error('setDisplayOptions 至少需要一个显示项');
  }
  if (Object.keys(vectorPatch).length > 0) useVectorStore.setState(vectorPatch);
  if (Object.keys(uiPatch).length > 0) useUIStore.setState(uiPatch);
}

function executeSetFormatOptions(operation: AiOperation): void {
  const patch: Partial<VectorSnapshot> = {};
  const angleUnit = asString(operation.angleUnit);
  if (angleUnit) {
    if (angleUnit !== 'deg' && angleUnit !== 'rad') throw new Error('angleUnit 必须是 deg 或 rad');
    patch.angleUnit = angleUnit;
  }
  if (operation.decimalPlaces !== undefined) {
    patch.decimalPlaces = positiveInteger(operation.decimalPlaces, 'decimalPlaces', 0, 6);
  }
  const surdMode = asBoolean(operation.surdMode);
  if (surdMode !== null) patch.surdMode = surdMode;
  if (Object.keys(patch).length === 0) throw new Error('setFormatOptions 至少需要一个格式项');
  useVectorStore.setState(patch);
}

function executeSetUnitCircleAngle(operation: AiOperation): void {
  let rad = finiteNumber(operation.angleRad ?? operation.rad ?? 0, 'angleRad');
  if (operation.angleDeg !== undefined) {
    rad = finiteNumber(operation.angleDeg, 'angleDeg') * Math.PI / 180;
  }
  if (operation.piMultiple !== undefined || operation.anglePiMultiple !== undefined) {
    rad = finiteNumber(operation.piMultiple ?? operation.anglePiMultiple, 'piMultiple') * Math.PI;
  }
  const playing = asBoolean(operation.playing);
  useVectorStore.setState({
    unitCircleAngle: rad,
    unitCirclePlaying: playing ?? useVectorStore.getState().unitCirclePlaying,
  });
}

function executePlayParallelogramAnimation(): void {
  useVectorStore.getState().playParallelogramAnim();
}

function executeClearDemoStage(): void {
  useDemoEntityStore.getState().loadSnapshot({ entities: {}, bindings: [], nextId: 1 });
  useDemoToolStore.getState().loadSnapshot();
  useVectorStore.getState().setOperation('demoStage');
}

function executeAddDemoVector(operation: AiOperation): void {
  const start = readVec2(operation.start ?? operation.startPoint ?? [0, 0], 'start');
  const end = readVec2(operation.end ?? operation.endPoint ?? operation.value, 'end');
  const store = useDemoEntityStore.getState();
  const startId = store.nextEntityId();
  const endId = store.nextEntityId();
  const vecId = asString(operation.id) ?? store.nextEntityId();
  const label = asString(operation.label) ?? `v${Object.values(store.entities).filter((item) => item.type === 'demoVector').length + 1}`;
  const color = asString(operation.color) ?? '#2196F3';
  store.addEntity({ id: startId, type: 'demoPoint', x: start[0], y: start[1], label: '' });
  store.addEntity({ id: endId, type: 'demoPoint', x: end[0], y: end[1], label: '' });
  store.addEntity({
    id: vecId,
    type: 'demoVector',
    startId,
    endId,
    label,
    color,
    showLabel: asBoolean(operation.showLabel) ?? true,
  });
  useVectorStore.getState().setOperation('demoStage');
}

function findDemoVectorId(value: unknown): string {
  const key = asString(value);
  if (!key) throw new Error('缺少 demo 向量引用');
  const entities = useDemoEntityStore.getState().entities;
  if (entities[key]?.type === 'demoVector') return key;
  const matches = Object.values(entities).filter((item): item is DemoVector => item.type === 'demoVector' && item.label === key);
  if (matches.length === 0) throw new Error(`找不到 demo 向量 ${key}`);
  if (matches.length > 1) throw new Error(`demo 向量标签 ${key} 不唯一，请使用 id`);
  return matches[0].id;
}

function getVectorEndpointPointId(vector: DemoVector, endpoint: 'start' | 'end'): string {
  return endpoint === 'start' ? vector.startId : vector.endId;
}

function executeAddDemoVectorOperation(operation: AiOperation): void {
  const kind = asString(operation.kind) as DemoOpKind | null;
  if (!kind || !DEMO_OP_KINDS.has(kind)) throw new Error('kind 必须是 add、subtract、dotProduct 或 scale');
  const store = useDemoEntityStore.getState();
  const op: DemoVecOp = {
    id: asString(operation.id) ?? store.nextEntityId(),
    type: 'demoVecOp',
    kind,
    vec1Id: findDemoVectorId(operation.vec1Id ?? operation.vector1 ?? operation.label1),
  };
  if (kind === 'scale') {
    op.scalarK = finiteNumber(operation.scalarK ?? operation.k ?? 2, 'scalarK');
  } else {
    op.vec2Id = findDemoVectorId(operation.vec2Id ?? operation.vector2 ?? operation.label2);
  }
  if (operation.origin) {
    const origin = readVec2(operation.origin, 'origin');
    op.originX = origin[0];
    op.originY = origin[1];
  }
  store.addEntity(op);
  useVectorStore.getState().setOperation('demoStage');
}

function executeScaleDemoVector(operation: AiOperation): void {
  const vectorId = findDemoVectorId(operation.vecId ?? operation.id ?? operation.label);
  const k = finiteNumber(operation.k ?? operation.scalarK ?? operation.scale ?? 2, 'k');
  const store = useDemoEntityStore.getState();
  const vector = entityById(vectorId);
  if (vector.type !== 'demoVector') throw new Error(`${vectorId} 不是 demo 向量`);
  const start = demoPoint(vector.startId);
  const end = demoPoint(vector.endId);
  store.updateEntity(vector.endId, {
    x: start.x + (end.x - start.x) * k,
    y: start.y + (end.y - start.y) * k,
  });
  if (operation.newLabel || operation.labelAfter) {
    store.updateEntity(vectorId, { label: asString(operation.newLabel) ?? asString(operation.labelAfter) ?? vector.label });
  }
  useVectorStore.getState().setOperation('demoStage');
}

function executeUpdateDemoVector(operation: AiOperation): void {
  const vectorId = findDemoVectorId(operation.vecId ?? operation.id ?? operation.label);
  const store = useDemoEntityStore.getState();
  const vector = entityById(vectorId);
  if (vector.type !== 'demoVector') throw new Error(`${vectorId} 不是 demo 向量`);
  const patch: Partial<DemoVector> = {};
  const color = asString(operation.color);
  if (color) patch.color = color;
  const label = asString(operation.newLabel) ?? asString(operation.renameTo);
  if (label) patch.label = label;
  const showLabel = asBoolean(operation.showLabel);
  if (showLabel !== null) patch.showLabel = showLabel;
  const constraint = asString(operation.constraint);
  if (constraint) {
    if (constraint !== 'free' && constraint !== 'fixedStart' && constraint !== 'fixedEnd') {
      throw new Error('constraint 必须是 free、fixedStart 或 fixedEnd');
    }
    patch.constraint = constraint;
    patch.constraintLength = constraint === 'free'
      ? undefined
      : finiteNumber(operation.constraintLength ?? operation.length ?? vector.constraintLength ?? 1, 'constraintLength', 0.0001);
  }
  if (Object.keys(patch).length > 0) store.updateEntity(vectorId, patch);
  if (operation.start ?? operation.startPoint) {
    const point = readVec2(operation.start ?? operation.startPoint, 'start');
    store.updateEntity(vector.startId, { x: point[0], y: point[1] });
  }
  if (operation.end ?? operation.endPoint ?? operation.value) {
    const point = readVec2(operation.end ?? operation.endPoint ?? operation.value, 'end');
    store.updateEntity(vector.endId, { x: point[0], y: point[1] });
  }
  useVectorStore.getState().setOperation('demoStage');
}

function executeDeleteDemoEntity(operation: AiOperation): void {
  const id = asString(operation.id) ?? asString(operation.entityId) ?? asString(operation.vecId);
  if (!id) throw new Error('deleteDemoEntity 缺少 id');
  const store = useDemoEntityStore.getState();
  const entity = entityById(id);
  if (entity.type === 'demoVector') {
    const startId = entity.startId;
    const endId = entity.endId;
    Object.values(store.entities)
      .filter((item): item is DemoVecOp => item.type === 'demoVecOp' && (item.vec1Id === id || item.vec2Id === id))
      .forEach((op) => store.removeEntity(op.id));
    store.bindings
      .filter((binding) => [startId, endId].includes(binding.pointA) || [startId, endId].includes(binding.pointB))
      .forEach((binding) => store.removeBinding(binding.id));
    store.removeEntity(id);
    store.removeEntity(startId);
    store.removeEntity(endId);
    return;
  }
  if (entity.type === 'demoVecOp') {
    Object.values(store.entities)
      .filter((item): item is DemoVecOp => item.type === 'demoVecOp' && (item.vec1Id === id || item.vec2Id === id))
      .forEach((op) => store.removeEntity(op.id));
  }
  store.removeEntity(id);
}

function executeBindDemoEndpoints(operation: AiOperation): void {
  const vectorAId = findDemoVectorId(operation.vec1Id ?? operation.vector1 ?? operation.label1);
  const vectorBId = findDemoVectorId(operation.vec2Id ?? operation.vector2 ?? operation.label2);
  const endpointA = asEndpoint(operation.endpoint1 ?? operation.endpointA ?? 'end');
  const endpointB = asEndpoint(operation.endpoint2 ?? operation.endpointB ?? 'start');
  const store = useDemoEntityStore.getState();
  const vectorA = entityById(vectorAId);
  const vectorB = entityById(vectorBId);
  if (vectorA.type !== 'demoVector' || vectorB.type !== 'demoVector') throw new Error('bindDemoEndpoints 只能绑定 demo 向量端点');
  const pointAId = getVectorEndpointPointId(vectorA, endpointA);
  const pointBId = getVectorEndpointPointId(vectorB, endpointB);
  const pointA = demoPoint(pointAId);
  const binding: DemoBinding = {
    id: asString(operation.id) ?? store.nextEntityId(),
    pointA: pointAId,
    pointB: pointBId,
  };
  store.updateEntity(pointBId, { x: pointA.x, y: pointA.y });
  store.addBinding(binding);
  useVectorStore.getState().setOperation('demoStage');
}

function executeUnbindDemoEndpoint(operation: AiOperation): void {
  const bindingId = asString(operation.bindingId) ?? asString(operation.id);
  const store = useDemoEntityStore.getState();
  if (bindingId) {
    store.removeBinding(bindingId);
    return;
  }
  const vectorId = findDemoVectorId(operation.vecId ?? operation.vector ?? operation.label);
  const entity = entityById(vectorId);
  if (entity.type !== 'demoVector') throw new Error(`${vectorId} 不是 demo 向量`);
  const endpoint = asEndpoint(operation.endpoint ?? 'end');
  const pointId = getVectorEndpointPointId(entity, endpoint);
  store.bindings
    .filter((binding) => binding.pointA === pointId || binding.pointB === pointId)
    .forEach((binding) => store.removeBinding(binding.id));
}

function validateStateAfterOperation(operation: AiOperation, warnings: string[]): void {
  if (operation.type === 'setVector2D' || operation.type === 'loadVectorPreset' || operation.type === 'loadTeachingScenario') {
    const state = useVectorStore.getState();
    if (state.operation === 'decomposition' && Math.abs(cross2D(state.basis1, state.basis2)) < 1e-10) {
      warnings.push('当前 basis1 与 basis2 共线，无法唯一分解目标向量。');
    }
  }
}

function executeOperation(operation: AiOperation): void {
  switch (operation.type) {
    case 'setOperation':
      executeSetOperation(operation);
      return;
    case 'loadVectorPreset':
    case 'loadPreset':
      executeLoadVectorPreset(operation);
      return;
    case 'loadTeachingScenario':
      executeLoadTeachingScenario(operation);
      return;
    case 'setVector2D':
      executeSetVector2D(operation);
      return;
    case 'setVector3D':
      executeSetVector3D(operation);
      return;
    case 'setChainVectors':
      executeSetChainVectors(operation);
      return;
    case 'setScalar':
    case 'setScalarK':
      executeSetScalar(operation);
      return;
    case 'setDotProductDemo':
      executeSetDotProductDemo(operation);
      return;
    case 'setDecompositionDemo':
      executeSetDecompositionDemo(operation);
      return;
    case 'setCrossProductDemo':
      executeSetCrossProductDemo(operation);
      return;
    case 'setTriangleChainDemo':
      executeSetTriangleChainDemo(operation);
      return;
    case 'setDisplayOptions':
      executeSetDisplayOptions(operation);
      return;
    case 'setFormatOptions':
      executeSetFormatOptions(operation);
      return;
    case 'setUnitCircleAngle':
      executeSetUnitCircleAngle(operation);
      return;
    case 'playParallelogramAnimation':
      executePlayParallelogramAnimation();
      return;
    case 'clearDemoStage':
      executeClearDemoStage();
      return;
    case 'addDemoVector':
      executeAddDemoVector(operation);
      return;
    case 'addDemoVectorOperation':
      executeAddDemoVectorOperation(operation);
      return;
    case 'scaleDemoVector':
      executeScaleDemoVector(operation);
      return;
    case 'updateDemoVector':
      executeUpdateDemoVector(operation);
      return;
    case 'deleteDemoEntity':
    case 'deleteDemoVector':
    case 'deleteDemoVectorOperation':
      executeDeleteDemoEntity(operation);
      return;
    case 'bindDemoEndpoints':
      executeBindDemoEndpoints(operation);
      return;
    case 'unbindDemoEndpoint':
      executeUnbindDemoEndpoint(operation);
      return;
    default:
      throw new Error(`M06 不支持 operation: ${String(operation.type)}`);
  }
}

export function applyM06AiOperations(input: unknown): M06BridgeOperationResult {
  const operations = Array.isArray(input)
    ? input as AiOperation[]
    : isRecord(input) && Array.isArray(input.operations)
      ? input.operations as AiOperation[]
      : [];
  const warnings: string[] = [];
  if (operations.length === 0) {
    return { ok: false, errors: ['operations 必须是非空数组'], warnings, applied: 0 };
  }

  const before = cloneM06State();
  const historyState = useHistoryStore.getState();
  const baseUndoStack = [...historyState.undoStack];
  const baseRedoStack = [...historyState.redoStack];

  try {
    operations.forEach((operation, index) => {
      if (!isRecord(operation) || !asString(operation.type)) {
        throw new Error(`第 ${index + 1} 个 operation 缺少 type`);
      }
      executeOperation(operation);
      validateStateAfterOperation(operation, warnings);
    });
  } catch (error) {
    loadM06State(before);
    useHistoryStore.setState({
      undoStack: baseUndoStack,
      redoStack: baseRedoStack,
      canUndo: baseUndoStack.length > 0,
      canRedo: baseRedoStack.length > 0,
    });
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
      applied: 0,
      rolledBack: true,
    };
  }

  const after = cloneM06State();
  replacePipelineHistory(before, after, baseUndoStack);
  return {
    ok: true,
    errors: [],
    warnings,
    applied: operations.length,
  };
}
