import { useAnimationStore, useHistoryStore, useSimulationStore, useUIStore } from '@/editor/store';
import type { AnimationStoreSnapshot } from '@/editor/store/animationStore';
import type { Command } from '@/editor/commands/types';
import type { SimulationSnapshot } from '@/editor/store/simulationStore';
import type { UIStoreSnapshot } from '@/editor/store/uiStore';
import { createSimulationReplay, runSimulationWithParams } from '@/engine/simulationRunner';
import { buildPartialResult, getTrialDisplay, isAnimatable, runOneTrial, type AnimatableType } from '@/engine/singleStep';
import {
  DEFAULT_DATA_SPEC,
  DEFAULT_PARAMS,
  HISTOGRAM_DATASETS,
  REGRESSION_DATASETS,
  SIMULATION_LIST,
  type BinomialDistParams,
  type DataPrecision,
  type DataSpec,
  type HistogramParams,
  type HypergeometricDistParams,
  type LinearRegressionParams,
  type NormalDistParams,
  type SimulationParams,
  type SimulationType,
  type StemLeafParams,
} from '@/types/simulation';

export interface M05BridgeOperationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  applied: number;
  rolledBack?: boolean;
}

type AiOperation = Record<string, unknown> & { type?: unknown };

type M05StateSnapshot = {
  simulation: SimulationSnapshot;
  ui: UIStoreSnapshot;
  animation: AnimationStoreSnapshot;
};

const MAX_HISTORY = 50;
const SIM_TYPES = new Set<SimulationType>(SIMULATION_LIST.map((item) => item.type));
const CATEGORY_BY_TYPE = new Map(SIMULATION_LIST.map((item) => [item.type, item.category]));
const HISTOGRAM_DATASET_IDS = new Set(HISTOGRAM_DATASETS.map((item) => item.id));
const REGRESSION_DATASET_IDS = new Set(REGRESSION_DATASETS.map((item) => item.id));

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

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readSimulationType(value: unknown): SimulationType | null {
  return typeof value === 'string' && SIM_TYPES.has(value as SimulationType) ? value as SimulationType : null;
}

function cloneM05State(): M05StateSnapshot {
  return {
    simulation: cloneSerializable(useSimulationStore.getState().getSnapshot()),
    ui: cloneSerializable(useUIStore.getState().getSnapshot()),
    animation: cloneSerializable(useAnimationStore.getState().getSnapshot()),
  };
}

function loadM05State(snapshot: M05StateSnapshot): void {
  useSimulationStore.getState().loadSnapshot(cloneSerializable(snapshot.simulation));
  useUIStore.getState().loadSnapshot(cloneSerializable(snapshot.ui));
  useAnimationStore.getState().loadSnapshot(cloneSerializable(snapshot.animation));
}

function createSnapshotCommand(before: M05StateSnapshot, after: M05StateSnapshot): Command {
  return {
    type: 'aiPipeline',
    label: 'AI 概率统计搭建',
    execute() {
      loadM05State(after);
    },
    undo() {
      loadM05State(before);
    },
  };
}

function replacePipelineHistory(before: M05StateSnapshot, after: M05StateSnapshot, baseUndoStack: Command[]): void {
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

function activeSimulationId(): string {
  const state = useSimulationStore.getState();
  if (!state.activeSimId) throw new Error('当前没有激活的模拟');
  return state.activeSimId;
}

function getTargetSimulationId(operation: AiOperation): string {
  const simId = asString(operation.simId) ?? asString(operation.entityId);
  if (simId) {
    if (!useSimulationStore.getState().simulations[simId]) {
      throw new Error(`找不到模拟 ${simId}`);
    }
    return simId;
  }
  return activeSimulationId();
}

function getTargetSimulation(operation: AiOperation) {
  const simId = getTargetSimulationId(operation);
  const sim = useSimulationStore.getState().simulations[simId];
  if (!sim) throw new Error(`找不到模拟 ${simId}`);
  return sim;
}

function setActiveCategoryForType(type: SimulationType): void {
  const category = CATEGORY_BY_TYPE.get(type);
  if (category) useUIStore.getState().setActiveCategory(category);
}

function ensureSimulation(type: SimulationType, params?: SimulationParams): string {
  const store = useSimulationStore.getState();
  const existing = Object.values(store.simulations).find((sim) => sim.type === type);
  if (existing) {
    store.setActiveSimId(existing.id);
    if (params) store.updateParams(existing.id, params);
    setActiveCategoryForType(type);
    return existing.id;
  }

  const sim = store.createSimulation(type, params ?? cloneSerializable(DEFAULT_PARAMS[type]));
  setActiveCategoryForType(type);
  return sim.id;
}

function positiveInteger(value: unknown, key: string, min = 1, max = 100000): number {
  const number = asNumber(value);
  if (number === null || !Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${key} 必须是 ${min} 到 ${max} 之间的整数`);
  }
  return number;
}

function finiteNumber(value: unknown, key: string, min = -Infinity, max = Infinity): number {
  const number = asNumber(value);
  if (number === null || number < min || number > max) {
    throw new Error(`${key} 必须是 ${min} 到 ${max} 之间的数字`);
  }
  return number;
}

function probability(value: unknown, key: string): number {
  return finiteNumber(value, key, 0, 1);
}

function normalizeDataSpec(base: DataSpec, patch: unknown): DataSpec {
  if (!isRecord(patch)) throw new Error('dataSpec 必须是对象');
  const next: DataSpec = { ...base };
  const mode = asString(patch.mode);
  if (mode) {
    if (mode !== 'preset' && mode !== 'manual') throw new Error('dataSpec.mode 必须是 preset 或 manual');
    next.mode = mode;
  }
  const presetId = asString(patch.presetId);
  if (presetId) {
    if (!HISTOGRAM_DATASET_IDS.has(presetId)) throw new Error(`未知数据集 ${presetId}`);
    next.presetId = presetId;
  }
  if ('filterMin' in patch) {
    next.filterMin = patch.filterMin === null ? null : finiteNumber(patch.filterMin, 'filterMin');
  }
  if ('filterMax' in patch) {
    next.filterMax = patch.filterMax === null ? null : finiteNumber(patch.filterMax, 'filterMax');
  }
  if (next.filterMin !== null && next.filterMax !== null && next.filterMin > next.filterMax) {
    throw new Error('filterMin 不能大于 filterMax');
  }
  if ('precision' in patch) {
    const precision = positiveInteger(patch.precision, 'precision', 0, 2);
    next.precision = precision as DataPrecision;
  }
  if ('customText' in patch) {
    const text = asString(patch.customText);
    if (!text) throw new Error('customText 不能为空');
    const values = text.split(/[,\s\n]+/).map((item) => Number(item)).filter((item) => Number.isFinite(item));
    if (values.length < 2) throw new Error('手动数据至少需要 2 个数字');
    next.customText = text;
  }
  return next;
}

function mergeParams(type: SimulationType, current: SimulationParams | undefined, patch: Record<string, unknown>): SimulationParams {
  const base = cloneSerializable(current ?? DEFAULT_PARAMS[type]) as unknown as Record<string, unknown>;
  const next = { ...base, ...patch };

  switch (type) {
    case 'coinFlip':
      return {
        n: positiveInteger(next.n, 'n'),
        speed: finiteNumber(next.speed, 'speed', 1, 4),
      };
    case 'diceRoll': {
      const event = asString(next.event) ?? 'all';
      if (!['all', 'odd', 'even', 'gte'].includes(event)) throw new Error('event 必须是 all、odd、even 或 gte');
      return {
        n: positiveInteger(next.n, 'n'),
        diceCount: positiveInteger(next.diceCount, 'diceCount', 1, 6),
        event: event as 'all' | 'odd' | 'even' | 'gte',
        gteValue: positiveInteger(next.gteValue, 'gteValue', 1, 6),
      };
    }
    case 'twoDiceSum':
      return {
        n: positiveInteger(next.n, 'n'),
        diceCount: positiveInteger(next.diceCount, 'diceCount', 2, 6),
      };
    case 'ballDraw': {
      const redCount = positiveInteger(next.redCount, 'redCount', 1, 1000);
      const whiteCount = positiveInteger(next.whiteCount, 'whiteCount', 1, 1000);
      const drawCount = positiveInteger(next.drawCount, 'drawCount', 1, redCount + whiteCount);
      return {
        redCount,
        whiteCount,
        drawCount,
        replace: Boolean(next.replace),
        n: positiveInteger(next.n, 'n'),
      };
    }
    case 'monteCarloPi':
      return {
        n: positiveInteger(next.n, 'n'),
        speed: finiteNumber(next.speed, 'speed', 1, 4),
      };
    case 'meetingProblem': {
      const T = finiteNumber(next.T, 'T', 1);
      const t = finiteNumber(next.t, 't', 0, T);
      return { T, t, n: positiveInteger(next.n, 'n') };
    }
    case 'buffonsNeedle': {
      const lineSpacing = finiteNumber(next.lineSpacing, 'lineSpacing', 0.01);
      return {
        needleLength: finiteNumber(next.needleLength, 'needleLength', 0.01, lineSpacing),
        lineSpacing,
        n: positiveInteger(next.n, 'n'),
      };
    }
    case 'histogram': {
      const currentSpec = (base.dataSpec as DataSpec | undefined) ?? DEFAULT_DATA_SPEC;
      const dataSpec = 'dataSpec' in patch ? normalizeDataSpec(currentSpec, patch.dataSpec) : currentSpec;
      return {
        dataSpec,
        binCount: positiveInteger(next.binCount, 'binCount', 1, 50),
        useCustomBinWidth: Boolean(next.useCustomBinWidth),
        customBinWidth: finiteNumber(next.customBinWidth, 'customBinWidth', 0.01),
      } satisfies HistogramParams;
    }
    case 'stemLeaf': {
      const currentSpec = (base.dataSpec as DataSpec | undefined) ?? DEFAULT_DATA_SPEC;
      const dataSpec = 'dataSpec' in patch ? normalizeDataSpec(currentSpec, patch.dataSpec) : currentSpec;
      return {
        dataSpec,
        splitStems: Boolean(next.splitStems),
      } satisfies StemLeafParams;
    }
    case 'binomialDist': {
      const showMode = asString(next.showMode) ?? 'bar';
      if (showMode !== 'bar' && showMode !== 'line') throw new Error('showMode 必须是 bar 或 line');
      return {
        n: positiveInteger(next.n, 'n', 1, 200),
        p: probability(next.p, 'p'),
        showMode,
      } satisfies BinomialDistParams;
    }
    case 'hypergeometricDist': {
      const N = positiveInteger(next.N, 'N', 1, 100000);
      const M = positiveInteger(next.M, 'M', 0, N);
      const n = positiveInteger(next.n, 'n', 0, N);
      return { N, M, n, showCdf: Boolean(next.showCdf) } satisfies HypergeometricDistParams;
    }
    case 'normalDist':
      return {
        mu: finiteNumber(next.mu, 'mu'),
        sigma: finiteNumber(next.sigma, 'sigma', 0.0001),
        showSigmaRegions: Boolean(next.showSigmaRegions),
      } satisfies NormalDistParams;
    case 'linearRegression': {
      const datasetId = asString(next.datasetId);
      if (!datasetId || !REGRESSION_DATASET_IDS.has(datasetId)) throw new Error(`未知回归数据集 ${datasetId ?? ''}`);
      return {
        datasetId,
        showResiduals: Boolean(next.showResiduals),
      } satisfies LinearRegressionParams;
    }
    case 'lawOfLargeNumbers': {
      const scenario = asString(next.scenario) ?? 'coinFlip';
      if (!['coinFlip', 'diceRoll', 'ballDraw'].includes(scenario)) {
        throw new Error('scenario 必须是 coinFlip、diceRoll 或 ballDraw');
      }
      return {
        scenario: scenario as 'coinFlip' | 'diceRoll' | 'ballDraw',
        maxN: positiveInteger(next.maxN, 'maxN'),
        numCurves: positiveInteger(next.numCurves, 'numCurves', 1, 20),
      };
    }
  }
}

function readParamsPatch(operation: AiOperation): Record<string, unknown> {
  if (isRecord(operation.params)) return operation.params;
  const { type: _type, simId: _simId, entityId: _entityId, simulationType: _simulationType, run: _run, ...rest } = operation;
  void _type;
  void _simId;
  void _entityId;
  void _simulationType;
  void _run;
  return rest;
}

function executeSetSimulationType(operation: AiOperation): void {
  const type = readSimulationType(operation.simulationType) ?? readSimulationType(operation.simType) ?? readSimulationType(operation.targetType);
  if (!type) throw new Error('setSimulationType 缺少合法 simulationType');
  const rawParams = isRecord(operation.params) ? operation.params : undefined;
  const params = rawParams ? mergeParams(type, undefined, rawParams) : undefined;
  const simId = ensureSimulation(type, params);
  if (operation.run === true) {
    executeRunSimulation({ type: 'runSimulation', simId });
  }
}

function executeUpdateSimulationParams(operation: AiOperation): void {
  const sim = getTargetSimulation(operation);
  const patch = readParamsPatch(operation);
  const params = mergeParams(sim.type, sim.params, patch);
  useSimulationStore.getState().updateParams(sim.id, params);
  useSimulationStore.getState().resetResult(sim.id);
}

function executeSetDataSource(operation: AiOperation): void {
  const sim = getTargetSimulation(operation);
  if (sim.type !== 'histogram' && sim.type !== 'stemLeaf') {
    throw new Error('setDataSource 只适用于 histogram 或 stemLeaf');
  }
  const currentParams = sim.params as HistogramParams | StemLeafParams;
  const dataSpec = normalizeDataSpec(currentParams.dataSpec, operation);
  useSimulationStore.getState().updateParams(sim.id, { dataSpec } as Partial<SimulationParams>);
  useSimulationStore.getState().resetResult(sim.id);
}

function executeRunSimulation(operation: AiOperation): void {
  const sim = getTargetSimulation(operation);
  const seed = asString(operation.seed);
  const replay = seed ? createSimulationReplay(sim.type, sim.params, seed) : undefined;
  const result = runSimulationWithParams(sim.type, sim.params, replay);
  useSimulationStore.getState().setResult(sim.id, result);
  if (operation.autoStartAnimation === true) {
    maybeStartAnimation(sim.id);
  }
}

function executeResetSimulationResult(operation: AiOperation): void {
  const simId = getTargetSimulationId(operation);
  if (useAnimationStore.getState().animSimId === simId) {
    useAnimationStore.getState().stopAnimation();
  }
  useSimulationStore.getState().resetResult(simId);
}

function executeSetAnimationMode(operation: AiOperation): void {
  const mode = asString(operation.mode);
  if (mode !== 'single' && mode !== 'multi') throw new Error('setAnimationMode mode 必须是 single 或 multi');
  useAnimationStore.getState().stopAnimation();
  useAnimationStore.getState().resetSingle();
  useAnimationStore.getState().setMode(mode);
}

function executeSetAnimationSpeed(operation: AiOperation): void {
  const speed = positiveInteger(operation.speed, 'speed', 1, 5);
  useAnimationStore.getState().setSpeed(speed);
  useUIStore.getState().setAnimationSpeed(speed);
}

function executeSetResultPanelVisible(operation: AiOperation): void {
  const visible = asBoolean(operation.visible) ?? asBoolean(operation.show);
  if (visible === null) throw new Error('setResultPanelVisible 缺少 visible');
  useUIStore.getState().setShowResultPanel(visible);
}

function executeRunSingleStep(operation: AiOperation): void {
  const sim = getTargetSimulation(operation);
  if (!isAnimatable(sim.type)) throw new Error('runSingleStep 只适用于古典单步模拟');
  const count = operation.count === undefined ? 1 : positiveInteger(operation.count, 'count', 1, 100);
  const animationStore = useAnimationStore.getState();
  animationStore.setMode('single');
  animationStore.initSingle(sim.id, sim.type);
  let trials = [...animationStore.singleTrials];
  let display = animationStore.singleLastDisplay;
  for (let i = 0; i < count; i += 1) {
    const trial = runOneTrial(sim.type as AnimatableType, sim.params);
    display = getTrialDisplay(sim.type as AnimatableType, trial);
    trials = [...trials, trial];
  }
  useAnimationStore.setState({
    singleSimId: sim.id,
    singleType: sim.type,
    singleTrials: trials,
    singleLastDisplay: display,
    singleAnimating: false,
    singleAnimResult: null,
  });
  useSimulationStore.getState().setResult(sim.id, buildPartialResult(sim.type as AnimatableType, sim.params, trials));
}

function maybeStartAnimation(simId: string): void {
  const sim = useSimulationStore.getState().simulations[simId];
  const data = sim?.result?.data;
  if (!data || typeof data !== 'object') return;
  const record = data as Record<string, unknown>;
  const total =
    Array.isArray(record.points) ? record.points.length :
    Array.isArray(record.needles) ? record.needles.length :
    Array.isArray(record.trials) ? record.trials.length :
    null;
  if (total && total > 0) {
    useAnimationStore.getState().startAnimation(simId, total);
  }
}

function executeLoadPresetExperiment(operation: AiOperation): void {
  const presetId = asString(operation.presetId);
  if (!presetId) throw new Error('loadPresetExperiment 缺少 presetId');

  switch (presetId) {
    case 'coin-fairness': {
      const simId = ensureSimulation('coinFlip', mergeParams('coinFlip', undefined, { n: 200, speed: 2 }));
      executeRunSimulation({ type: 'runSimulation', simId, autoStartAnimation: true });
      return;
    }
    case 'dice-even-event': {
      const simId = ensureSimulation('diceRoll', mergeParams('diceRoll', undefined, { n: 300, diceCount: 1, event: 'even', gteValue: 5 }));
      executeRunSimulation({ type: 'runSimulation', simId, autoStartAnimation: true });
      return;
    }
    case 'two-dice-sum': {
      const simId = ensureSimulation('twoDiceSum', mergeParams('twoDiceSum', undefined, { n: 500, diceCount: 2 }));
      executeRunSimulation({ type: 'runSimulation', simId, autoStartAnimation: true });
      return;
    }
    case 'monte-carlo-pi': {
      const simId = ensureSimulation('monteCarloPi', mergeParams('monteCarloPi', undefined, { n: 1500, speed: 2 }));
      executeRunSimulation({ type: 'runSimulation', simId, autoStartAnimation: true });
      return;
    }
    case 'normal-standard': {
      const simId = ensureSimulation('normalDist', mergeParams('normalDist', undefined, { mu: 0, sigma: 1, showSigmaRegions: true }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'binomial-fair-coin': {
      const simId = ensureSimulation('binomialDist', mergeParams('binomialDist', undefined, { n: 10, p: 0.5, showMode: 'bar' }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'histogram-scores': {
      const simId = ensureSimulation('histogram', mergeParams('histogram', undefined, {
        dataSpec: { mode: 'preset', presetId: 'DS-01' },
        binCount: 8,
        useCustomBinWidth: false,
        customBinWidth: 5,
      }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'linear-regression-sales': {
      const simId = ensureSimulation('linearRegression', mergeParams('linearRegression', undefined, { datasetId: 'REG-01', showResiduals: true }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'law-large-numbers-coin': {
      const simId = ensureSimulation('lawOfLargeNumbers', mergeParams('lawOfLargeNumbers', undefined, { scenario: 'coinFlip', maxN: 1000, numCurves: 3 }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    default:
      throw new Error(`未知预设实验 ${presetId}`);
  }
}

function executeLoadTeachingScenario(operation: AiOperation): void {
  const scenarioId = asString(operation.scenarioId) ?? asString(operation.presetId);
  if (!scenarioId) throw new Error('loadTeachingScenario 缺少 scenarioId');

  switch (scenarioId) {
    case 'law-large-numbers-frequency': {
      const simId = ensureSimulation('lawOfLargeNumbers', mergeParams('lawOfLargeNumbers', undefined, {
        scenario: 'coinFlip',
        maxN: 2000,
        numCurves: 5,
      }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'binomial-normal-approx': {
      const simId = ensureSimulation('binomialDist', mergeParams('binomialDist', undefined, {
        n: 50,
        p: 0.5,
        showMode: 'bar',
      }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'normal-sigma-rule': {
      const simId = ensureSimulation('normalDist', mergeParams('normalDist', undefined, {
        mu: 0,
        sigma: 1,
        showSigmaRegions: true,
      }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'sampling-without-replacement': {
      const simId = ensureSimulation('hypergeometricDist', mergeParams('hypergeometricDist', undefined, {
        N: 30,
        M: 10,
        n: 6,
        showCdf: true,
      }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'histogram-skewed-income': {
      const simId = ensureSimulation('histogram', mergeParams('histogram', undefined, {
        dataSpec: { mode: 'preset', presetId: 'DS-05' },
        binCount: 10,
        useCustomBinWidth: false,
        customBinWidth: 1000,
      }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'regression-nonlinear-caution': {
      const simId = ensureSimulation('linearRegression', mergeParams('linearRegression', undefined, {
        datasetId: 'REG-04',
        showResiduals: true,
      }));
      executeRunSimulation({ type: 'runSimulation', simId });
      return;
    }
    case 'geometric-meeting-problem': {
      const simId = ensureSimulation('meetingProblem', mergeParams('meetingProblem', undefined, {
        T: 60,
        t: 15,
        n: 800,
      }));
      executeRunSimulation({ type: 'runSimulation', simId, autoStartAnimation: true });
      return;
    }
    case 'buffon-pi-estimation': {
      const simId = ensureSimulation('buffonsNeedle', mergeParams('buffonsNeedle', undefined, {
        needleLength: 1,
        lineSpacing: 2,
        n: 1000,
      }));
      executeRunSimulation({ type: 'runSimulation', simId, autoStartAnimation: true });
      return;
    }
    default:
      throw new Error(`未知教学场景 ${scenarioId}`);
  }
}

function executeOperation(operation: AiOperation): void {
  switch (operation.type) {
    case 'setSimulationType':
      executeSetSimulationType(operation);
      return;
    case 'updateSimulationParams':
      executeUpdateSimulationParams(operation);
      return;
    case 'setDataSource':
      executeSetDataSource(operation);
      return;
    case 'runSimulation':
      executeRunSimulation(operation);
      return;
    case 'resetSimulationResult':
      executeResetSimulationResult(operation);
      return;
    case 'setAnimationMode':
      executeSetAnimationMode(operation);
      return;
    case 'setAnimationSpeed':
      executeSetAnimationSpeed(operation);
      return;
    case 'setResultPanelVisible':
      executeSetResultPanelVisible(operation);
      return;
    case 'runSingleStep':
      executeRunSingleStep(operation);
      return;
    case 'loadPresetExperiment':
      executeLoadPresetExperiment(operation);
      return;
    case 'loadTeachingScenario':
      executeLoadTeachingScenario(operation);
      return;
    default:
      throw new Error(`M05 不支持 operation: ${String(operation.type)}`);
  }
}

export function applyM05AiOperations(input: unknown): M05BridgeOperationResult {
  const operations = Array.isArray(input)
    ? input as AiOperation[]
    : isRecord(input) && Array.isArray(input.operations)
      ? input.operations as AiOperation[]
      : [];
  const warnings: string[] = [];
  if (operations.length === 0) {
    return { ok: false, errors: ['operations 必须是非空数组'], warnings, applied: 0 };
  }

  const before = cloneM05State();
  const historyState = useHistoryStore.getState();
  const baseUndoStack = [...historyState.undoStack];
  const baseRedoStack = [...historyState.redoStack];

  try {
    operations.forEach((operation, index) => {
      if (!isRecord(operation) || !asString(operation.type)) {
        throw new Error(`第 ${index + 1} 个 operation 缺少 type`);
      }
      executeOperation(operation);
    });
  } catch (error) {
    loadM05State(before);
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

  const after = cloneM05State();
  replacePipelineHistory(before, after, baseUndoStack);
  return {
    ok: true,
    errors: [],
    warnings,
    applied: operations.length,
  };
}
