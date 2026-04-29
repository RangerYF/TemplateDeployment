import { useHistoryStore } from '@/editor/store/historyStore';
import { useM04UiStore, type M04UiStoreSnapshot } from '@/editor/store/m04UiStore';
import {
  DEFAULT_UNIT_CIRCLE_VIEWPORT,
  useUnitCircleStore,
  type UnitCircleStoreSnapshot,
} from '@/editor/store/unitCircleStore';
import {
  DEFAULT_M04_FUNCTION_VIEWPORT,
  DEFAULT_TRIG_TRANSFORM,
  useM04FunctionStore,
  type M04FunctionStoreSnapshot,
} from '@/editor/store/m04FunctionStore';
import {
  TRIANGLE_MODE_DEFAULTS,
  useTriangleSolverStore,
  type TriangleSolverStoreSnapshot,
} from '@/editor/store/triangleSolverStore';
import { DEFAULT_TRIG_VIEWPORT, useTrigStore, type TrigStoreSnapshot } from '@/editor/store/trigStore';
import { lookupAngle, normalizeAngle } from '@/engine/exactValueEngine';
import { solveSolveMode } from '@/engine/triangleSolver';
import type { Command } from '@/editor/commands/types';
import type { FivePointStep, FnType, SolveMode, TrigTransform, ViewportState } from '@/types';

export interface M04BridgeOperationResult {
  ok: boolean;
  errors: string[];
  applied: number;
  rolledBack?: boolean;
}

type AiOperation = Record<string, unknown> & { type?: unknown };

type M04StateSnapshot = {
  ui: M04UiStoreSnapshot;
  unitCircle: UnitCircleStoreSnapshot;
  functionGraph: M04FunctionStoreSnapshot;
  triangleSolver: TriangleSolverStoreSnapshot;
  trig: TrigStoreSnapshot;
};

const MAX_HISTORY = 50;
const FN_TYPES = new Set<FnType>(['sin', 'cos', 'tan']);
const SOLVE_MODES = new Set<SolveMode>(['SSS', 'SAS', 'ASA', 'AAS', 'SSA']);
const UNIT_CIRCLE_DISPLAY_KEYS = new Set([
  'showProjections',
  'showAngleArc',
  'showLabels',
  'showQuadrantHints',
] as const);
const REQUIRED_TRIANGLE_INPUTS: Record<SolveMode, string[]> = {
  SSS: ['a', 'b', 'c'],
  SAS: ['a', 'C', 'b'],
  ASA: ['A', 'c', 'B'],
  AAS: ['A', 'B', 'a'],
  SSA: ['a', 'b', 'A'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function cloneM04State(): M04StateSnapshot {
  return {
    ui: structuredClone(useM04UiStore.getState().getSnapshot()),
    unitCircle: structuredClone(useUnitCircleStore.getState().getSnapshot()),
    functionGraph: structuredClone(useM04FunctionStore.getState().getSnapshot()),
    triangleSolver: structuredClone(useTriangleSolverStore.getState().getSnapshot()),
    trig: structuredClone(useTrigStore.getState().getSnapshot()),
  };
}

function loadM04State(snapshot: M04StateSnapshot): void {
  useM04UiStore.getState().loadSnapshot(snapshot.ui);
  useM04FunctionStore.getState().loadSnapshot(snapshot.functionGraph);
  useTrigStore.getState().loadSnapshot(snapshot.trig);
  useTriangleSolverStore.getState().loadSnapshot(snapshot.triangleSolver);
  useUnitCircleStore.getState().loadSnapshot(snapshot.unitCircle);
}

function createSnapshotCommand(before: M04StateSnapshot, after: M04StateSnapshot): Command {
  return {
    type: 'aiPipeline',
    label: 'AI 三角函数搭建',
    execute() {
      loadM04State(after);
    },
    undo() {
      loadM04State(before);
    },
  };
}

function replacePipelineHistory(before: M04StateSnapshot, after: M04StateSnapshot, baseUndoStack: Command[]): void {
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

function readViewport(operation: AiOperation): ViewportState {
  const viewport = {
    xMin: asNumber(operation.xMin) ?? NaN,
    xMax: asNumber(operation.xMax) ?? NaN,
    yMin: asNumber(operation.yMin) ?? NaN,
    yMax: asNumber(operation.yMax) ?? NaN,
  };
  if (!Number.isFinite(viewport.xMin) || !Number.isFinite(viewport.xMax) || viewport.xMin >= viewport.xMax) {
    throw new Error('setViewport 要求 xMin < xMax');
  }
  if (!Number.isFinite(viewport.yMin) || !Number.isFinite(viewport.yMax) || viewport.yMin >= viewport.yMax) {
    throw new Error('setViewport 要求 yMin < yMax');
  }
  return viewport;
}

function readAngleRad(operation: AiOperation): number {
  const angleRad = asNumber(operation.angleRad);
  if (angleRad !== null) return angleRad;

  const angleDeg = asNumber(operation.angleDeg);
  if (angleDeg !== null) return angleDeg * Math.PI / 180;

  const piMultiple = asNumber(operation.piMultiple) ?? asNumber(operation.anglePiMultiple);
  if (piMultiple !== null) return piMultiple * Math.PI;

  throw new Error('缺少角度字段 angleRad、angleDeg 或 piMultiple');
}

function executeSetAppMode(operation: AiOperation): void {
  const mode = asString(operation.mode) ?? asString(operation.appMode);
  if (mode !== 'trig' && mode !== 'triangle') {
    throw new Error('setAppMode mode 必须是 trig 或 triangle');
  }
  useM04UiStore.getState().setAppMode(mode);
}

function executeSetUnitCircleAngle(operation: AiOperation): void {
  const rad = readAngleRad(operation);
  const snap = asBoolean(operation.snap);
  const shouldSnap = snap ?? useUnitCircleStore.getState().snapEnabled;
  if (shouldSnap) {
    const result = lookupAngle(rad);
    useUnitCircleStore.getState().setAngle(result.snappedAngle, result.snapped, result.values);
  } else {
    useUnitCircleStore.getState().setAngle(normalizeAngle(rad), false, null);
  }
}

function executeSetUnitCircleDisplay(operation: AiOperation): void {
  let changed = false;
  for (const key of UNIT_CIRCLE_DISPLAY_KEYS) {
    const value = asBoolean(operation[key]);
    if (value !== null) {
      useUnitCircleStore.getState().setDisplayOption(key, value);
      changed = true;
    }
  }
  const snapEnabled = asBoolean(operation.snapEnabled);
  if (snapEnabled !== null) {
    useUnitCircleStore.getState().setSnapEnabled(snapEnabled);
    changed = true;
  }
  if (!changed) throw new Error('setUnitCircleDisplay 没有可应用的显示设置');
}

function executeSetTrigFunction(operation: AiOperation): void {
  const fnType = asString(operation.fnType) ?? asString(operation.functionType);
  if (!FN_TYPES.has(fnType as FnType)) {
    throw new Error('setTrigFunction fnType 必须是 sin、cos 或 tan');
  }
  useM04FunctionStore.getState().setFnType(fnType as FnType);
}

function executeSetTrigTransform(operation: AiOperation): void {
  const source = isRecord(operation.transform) ? operation.transform : operation;
  const patch: Partial<TrigTransform> = {};
  for (const key of ['A', 'omega', 'k'] as const) {
    const value = asNumber(source[key]);
    if (value !== null) patch[key] = value;
  }

  const phiRad = asNumber(source.phi);
  const phiDeg = asNumber(source.phiDeg);
  const phiPiMultiple = asNumber(source.phiPiMultiple) ?? asNumber(source.piMultiple);
  if (phiRad !== null) patch.phi = phiRad;
  else if (phiDeg !== null) patch.phi = phiDeg * Math.PI / 180;
  else if (phiPiMultiple !== null) patch.phi = phiPiMultiple * Math.PI;

  if (Object.keys(patch).length === 0) throw new Error('setTrigTransform 没有可应用的参数');
  if (patch.omega !== undefined && Math.abs(patch.omega) < 1e-9) {
    throw new Error('omega 不能为 0');
  }
  useM04FunctionStore.getState().setTransform(patch);
}

function executeSetFunctionGraphOptions(operation: AiOperation): void {
  let changed = false;
  const showReference = asBoolean(operation.showReference);
  if (showReference !== null) {
    useM04FunctionStore.getState().setShowReference(showReference);
    changed = true;
  }
  const clearHistory = asBoolean(operation.clearHistory);
  if (clearHistory === true) {
    useM04FunctionStore.getState().clearHistory();
    changed = true;
  }
  const traceX = asNumber(operation.traceX);
  if (traceX !== null) {
    useM04FunctionStore.getState().setTraceX(traceX);
    changed = true;
  }
  if (!changed) throw new Error('setFunctionGraphOptions 没有可应用的设置');
}

function executeSetViewport(operation: AiOperation): void {
  const target = asString(operation.target) ?? 'functionGraph';
  const viewport = readViewport(operation);
  if (target === 'unitCircle') {
    useUnitCircleStore.getState().setViewport(viewport);
    return;
  }
  if (target === 'functionGraph') {
    useM04FunctionStore.getState().setViewport(viewport);
    return;
  }
  if (target === 'trigA') {
    useTrigStore.getState().setViewportA(viewport);
    return;
  }
  if (target === 'trigB') {
    useTrigStore.getState().setViewportB(viewport);
    return;
  }
  throw new Error('setViewport target 必须是 unitCircle、functionGraph、trigA 或 trigB');
}

function executeResetViewport(operation: AiOperation): void {
  const target = asString(operation.target) ?? 'all';
  if (target === 'unitCircle' || target === 'all') {
    useUnitCircleStore.getState().setViewport({ ...DEFAULT_UNIT_CIRCLE_VIEWPORT });
  }
  if (target === 'functionGraph' || target === 'all') {
    useM04FunctionStore.getState().setViewport({ ...DEFAULT_M04_FUNCTION_VIEWPORT });
  }
  if (target === 'trigA' || target === 'all') {
    useTrigStore.getState().setViewportA({ ...DEFAULT_TRIG_VIEWPORT });
  }
  if (target === 'trigB' || target === 'all') {
    useTrigStore.getState().setViewportB({ ...DEFAULT_TRIG_VIEWPORT });
  }
  if (!['unitCircle', 'functionGraph', 'trigA', 'trigB', 'all'].includes(target)) {
    throw new Error('resetViewport target 必须是 unitCircle、functionGraph、trigA、trigB 或 all');
  }
}

function executeSetFivePointStep(operation: AiOperation): void {
  const value = asNumber(operation.step);
  if (value === null) throw new Error('setFivePointStep 缺少 step');
  const step = Math.round(value);
  if (step < 0 || step > 5) throw new Error('fivePointStep 必须在 0 到 5 之间');
  useM04FunctionStore.getState().setFivePointStep(step as FivePointStep);
}

function executeSetAuxiliaryAngleDemo(operation: AiOperation): void {
  let changed = false;
  const enabled = asBoolean(operation.enabled) ?? asBoolean(operation.showAuxiliary);
  if (enabled !== null) {
    useM04FunctionStore.getState().setShowAuxiliary(enabled);
    changed = true;
  }
  const a = asNumber(operation.a) ?? asNumber(operation.A);
  if (a !== null) {
    useM04FunctionStore.getState().setAuxiliaryA(a);
    changed = true;
  }
  const b = asNumber(operation.b) ?? asNumber(operation.B);
  if (b !== null) {
    useM04FunctionStore.getState().setAuxiliaryB(b);
    changed = true;
  }
  const showC1 = asBoolean(operation.showC1) ?? asBoolean(operation.auxShowC1);
  if (showC1 !== null) {
    useM04FunctionStore.getState().setAuxShowC1(showC1);
    changed = true;
  }
  const showC2 = asBoolean(operation.showC2) ?? asBoolean(operation.auxShowC2);
  if (showC2 !== null) {
    useM04FunctionStore.getState().setAuxShowC2(showC2);
    changed = true;
  }
  const showCR = asBoolean(operation.showCR) ?? asBoolean(operation.auxShowCR);
  if (showCR !== null) {
    useM04FunctionStore.getState().setAuxShowCR(showCR);
    changed = true;
  }
  if (!changed) throw new Error('setAuxiliaryAngleDemo 没有可应用的设置');
}

function executeSetTriangleSolver(operation: AiOperation): void {
  const mode = asString(operation.mode);
  if (!SOLVE_MODES.has(mode as SolveMode)) {
    throw new Error('setTriangleSolver mode 必须是 SSS、SAS、ASA、AAS 或 SSA');
  }
  const solveMode = mode as SolveMode;
  const inputSource = isRecord(operation.inputs) ? operation.inputs : operation;
  const inputs = { ...TRIANGLE_MODE_DEFAULTS[solveMode] };
  for (const key of REQUIRED_TRIANGLE_INPUTS[solveMode]) {
    const value = asNumber(inputSource[key]);
    if (value === null || value <= 0) {
      throw new Error(`setTriangleSolver 缺少正数输入 ${key}`);
    }
    inputs[key] = value;
  }

  const store = useTriangleSolverStore.getState();
  store.setMode(solveMode);
  store.setInputs(inputs);
  if (asBoolean(operation.solve) !== false) {
    store.setResult(solveSolveMode(solveMode, inputs));
  }
  useM04UiStore.getState().setAppMode('triangle');
}

function setUnitCircleAngleRad(rad: number, snap = true): void {
  if (snap) {
    const result = lookupAngle(rad);
    useUnitCircleStore.getState().setAngle(result.snappedAngle, result.snapped, result.values);
  } else {
    useUnitCircleStore.getState().setAngle(normalizeAngle(rad), false, null);
  }
}

function solveTrianglePreset(mode: SolveMode, inputs: Record<string, number>): void {
  const store = useTriangleSolverStore.getState();
  store.setMode(mode);
  store.setInputs(inputs);
  store.setResult(solveSolveMode(mode, inputs));
}

function resetTrigScene(): void {
  useM04UiStore.getState().setAppMode('trig');
  useM04FunctionStore.getState().setFnType('sin');
  useM04FunctionStore.getState().setTransform({ ...DEFAULT_TRIG_TRANSFORM });
  useM04FunctionStore.getState().setShowReference(true);
  useM04FunctionStore.getState().clearHistory();
  useM04FunctionStore.getState().setFivePointStep(0);
  useM04FunctionStore.getState().setShowAuxiliary(false);
  useUnitCircleStore.getState().setSnapEnabled(true);
  useUnitCircleStore.getState().setDisplayOption('showProjections', true);
  useUnitCircleStore.getState().setDisplayOption('showAngleArc', true);
  useUnitCircleStore.getState().setDisplayOption('showLabels', true);
  useUnitCircleStore.getState().setDisplayOption('showQuadrantHints', false);
  executeResetViewport({ type: 'resetViewport', target: 'all' });
}

function executeLoadTrigPresetScene(operation: AiOperation): void {
  const presetId = asString(operation.presetId);
  if (!presetId) throw new Error('loadTrigPresetScene 缺少 presetId');

  resetTrigScene();

  switch (presetId) {
    case 'standard-sine':
      setUnitCircleAngleRad(Math.PI / 6);
      return;
    case 'phase-shift':
      useM04FunctionStore.getState().setTransform({ phi: Math.PI / 4 });
      setUnitCircleAngleRad(Math.PI / 4);
      return;
    case 'amplitude-frequency':
      useM04FunctionStore.getState().setTransform({ A: 2, omega: 2 });
      setUnitCircleAngleRad(Math.PI / 3);
      return;
    case 'unit-circle-special-angle':
      useM04FunctionStore.getState().setFnType('cos');
      useUnitCircleStore.getState().setDisplayOption('showQuadrantHints', true);
      setUnitCircleAngleRad(2 * Math.PI / 3);
      return;
    case 'five-point-sine':
      useM04FunctionStore.getState().setFivePointStep(5);
      setUnitCircleAngleRad(Math.PI / 2);
      return;
    case 'auxiliary-angle':
      useM04FunctionStore.getState().setShowAuxiliary(true);
      useM04FunctionStore.getState().setAuxiliaryA(3);
      useM04FunctionStore.getState().setAuxiliaryB(4);
      useM04FunctionStore.getState().setAuxShowC1(true);
      useM04FunctionStore.getState().setAuxShowC2(true);
      useM04FunctionStore.getState().setAuxShowCR(true);
      setUnitCircleAngleRad(Math.PI / 4);
      return;
    case 'triangle-345':
      useM04UiStore.getState().setAppMode('triangle');
      executeResetViewport({ type: 'resetViewport', target: 'all' });
      solveTrianglePreset('SSS', { a: 3, b: 4, c: 5 });
      return;
    default:
      throw new Error('不支持的 M04 presetId');
  }
}

function executeOperation(operation: AiOperation): void {
  switch (operation.type) {
    case 'setAppMode':
      executeSetAppMode(operation);
      return;
    case 'setUnitCircleAngle':
      executeSetUnitCircleAngle(operation);
      return;
    case 'setUnitCircleDisplay':
      executeSetUnitCircleDisplay(operation);
      return;
    case 'setTrigFunction':
      executeSetTrigFunction(operation);
      return;
    case 'setTrigTransform':
      executeSetTrigTransform(operation);
      return;
    case 'setFunctionGraphOptions':
      executeSetFunctionGraphOptions(operation);
      return;
    case 'setViewport':
      executeSetViewport(operation);
      return;
    case 'resetViewport':
      executeResetViewport(operation);
      return;
    case 'setFivePointStep':
      executeSetFivePointStep(operation);
      return;
    case 'setAuxiliaryAngleDemo':
      executeSetAuxiliaryAngleDemo(operation);
      return;
    case 'setTriangleSolver':
      executeSetTriangleSolver(operation);
      return;
    case 'loadTrigPresetScene':
      executeLoadTrigPresetScene(operation);
      return;
    default:
      throw new Error(`不支持的 M04 operation: ${String(operation.type)}`);
  }
}

export async function applyM04AiOperations(input: unknown): Promise<M04BridgeOperationResult> {
  if (!Array.isArray(input)) {
    return { ok: false, errors: ['operations 必须是数组'], applied: 0 };
  }

  const before = cloneM04State();
  const baseUndoStack = [...useHistoryStore.getState().undoStack];
  const errors: string[] = [];
  let applied = 0;

  try {
    for (const operation of input) {
      if (!isRecord(operation) || typeof operation.type !== 'string') {
        throw new Error('operation 必须包含 type');
      }
      executeOperation(operation as AiOperation);
      applied += 1;
    }
    if (applied > 0) {
      replacePipelineHistory(before, cloneM04State(), baseUndoStack);
    }
    return { ok: true, errors: [], applied };
  } catch (error) {
    loadM04State(before);
    useHistoryStore.setState({
      undoStack: baseUndoStack,
      redoStack: [],
      canUndo: baseUndoStack.length > 0,
      canRedo: false,
    });
    errors.push(error instanceof Error ? error.message : 'M04 operation 执行失败');
    return { ok: false, errors, applied, rolledBack: true };
  }
}
