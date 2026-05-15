import type {
  P13HorizontalDirection,
  P13LoopCurrentDirection,
  P13SingleRodAnalysisStep,
  P13VerticalDirection,
} from './types';
import { P13_MODEL_KEYS } from './types';
import {
  computeInducedCurrent,
  computeMotionalEmf,
  resolveSignedFluxDensity,
} from './core';

const EPSILON = 1e-6;
const DEFAULT_TIME_STEP = 1 / 120;
const MIN_DURATION = 2.8;
const MAX_DURATION = 20;

const ANALYSIS_ACCENTS = {
  velocity: '#2563EB',
  emf: '#0EA5E9',
  current: '#F97316',
  'ampere-force': '#DC2626',
} as const;

export const P13_VERTICAL_RAIL_ROD_PRESET_ID = 'P13-EMI-031-vertical-rail-rod';
export const P13_VERTICAL_RAIL_ANALYSIS_TOTAL_STEPS = 4;

export type P13VerticalRailRodParamKey =
  | 'magneticField'
  | 'railSpan'
  | 'mass'
  | 'rodResistance'
  | 'externalResistance';

export interface P13VerticalRailRodParams {
  magneticField: number;
  railSpan: number;
  mass: number;
  rodResistance: number;
  externalResistance: number;
  gravity: number;
}

export interface P13VerticalRailRodState {
  time: number;
  position: number;
  velocity: number;
  emf: number;
  current: number;
  ampereForce: number;
  signedAmpereForce: number;
  gravityForce: number;
  netForce: number;
  acceleration: number;
  kineticEnergy: number;
  totalResistance: number;
  timeConstant: number;
  terminalVelocity: number;
  terminalCurrent: number;
  motionDirection: P13VerticalDirection;
  emfDirection: P13HorizontalDirection;
  currentDirection: P13LoopCurrentDirection;
  ampereForceDirection: P13VerticalDirection;
}

export interface P13VerticalRailRodSummary {
  totalResistance: number;
  timeConstant: number;
  initialCurrent: number;
  theoreticalTerminalVelocity: number;
  theoreticalTerminalCurrent: number;
  terminalExplanation: string;
  adoptedConvention: string;
}

export interface P13VerticalRailRodSimulationResult {
  modelKey: typeof P13_MODEL_KEYS.verticalRailRod;
  params: P13VerticalRailRodParams;
  duration: number;
  timeStep: number;
  samples: P13VerticalRailRodState[];
  summary: P13VerticalRailRodSummary;
}

export const P13_VERTICAL_RAIL_ROD_META = {
  code: 'EMI-031',
  title: '竖直导轨单棒',
  shortTitle: '竖直导轨',
  presetId: P13_VERTICAL_RAIL_ROD_PRESET_ID,
  modelKey: P13_MODEL_KEYS.verticalRailRod,
  pageSubtitle:
    '导体棒自上而下沿竖直导轨下落，速度增大时依次建立 ε = BLv、i = BLv / (R + R棒) 与向上的安培力；系统最终在 mg = B²L²v终 / (R + R棒) 时转入匀速下落。',
  currentFormula: 'i = BLv / (R + R棒)',
  currentFormulaLabel: 'i = BLv / R总',
  topologyTitle: '竖直导轨理想闭合回路',
  terminalHeadline: '理论终态：mg = B²L²v终 / (R + R棒)',
  adoptedConvention:
    '约定磁场垂直纸面向内，竖直导轨固定，导体棒水平横跨两轨并从静止释放向下；按右手定则，棒内正电荷被推向右端，因此感应电流取顺时针，导体棒受向上的安培力。',
} as const;

export const P13_VERTICAL_RAIL_ROD_PARAM_CONFIG = {
  magneticField: { label: '磁感应强度 B', min: 0.1, max: 5, step: 0.1, unit: 'T' },
  railSpan: { label: '导轨间距 / 棒长 L', min: 0.1, max: 2, step: 0.1, unit: 'm' },
  mass: { label: '导体棒质量 m', min: 0.01, max: 1, step: 0.01, unit: 'kg' },
  rodResistance: { label: '导体棒电阻 R棒', min: 0.1, max: 10, step: 0.1, unit: 'Ω' },
  externalResistance: { label: '外接电阻 R', min: 0.1, max: 20, step: 0.1, unit: 'Ω' },
} as const;

export const P13_VERTICAL_RAIL_ROD_DEFAULT_PARAMS: P13VerticalRailRodParams = {
  magneticField: 0.5,
  railSpan: 0.5,
  mass: 0.1,
  rodResistance: 1,
  externalResistance: 2,
  gravity: 9.8,
};

export const P13_VERTICAL_RAIL_HORIZONTAL_DIRECTION_LABELS: Record<
  P13HorizontalDirection,
  string
> = {
  left: '沿棒向左',
  right: '沿棒向右',
  none: '无明确方向',
};

export const P13_VERTICAL_RAIL_VERTICAL_DIRECTION_LABELS: Record<
  P13VerticalDirection,
  string
> = {
  up: '向上',
  down: '向下',
  none: '静止',
};

export const P13_VERTICAL_RAIL_CURRENT_DIRECTION_LABELS: Record<
  P13LoopCurrentDirection,
  string
> = {
  clockwise: '顺时针',
  counterclockwise: '逆时针',
  none: '无感应电流',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function computeTotalResistance(params: P13VerticalRailRodParams): number {
  return params.rodResistance + params.externalResistance;
}

function computeCoupling(params: P13VerticalRailRodParams): number {
  const totalResistance = computeTotalResistance(params);
  if (totalResistance <= EPSILON) return 0;
  const bAbs = Math.abs(params.magneticField);
  return (bAbs * bAbs * params.railSpan * params.railSpan) / totalResistance;
}

function computeTimeConstant(params: P13VerticalRailRodParams): number {
  const coupling = computeCoupling(params);
  return coupling > EPSILON ? params.mass / coupling : Number.POSITIVE_INFINITY;
}

function resolveMotionDirection(value: number): P13VerticalDirection {
  if (Math.abs(value) <= EPSILON) return 'none';
  return value > 0 ? 'down' : 'up';
}

function resolveEmfDirection(value: number): P13HorizontalDirection {
  if (Math.abs(value) <= EPSILON) return 'none';
  return value > 0 ? 'right' : 'left';
}

function resolveCurrentDirection(value: number): P13LoopCurrentDirection {
  if (Math.abs(value) <= EPSILON) return 'none';
  return value > 0 ? 'clockwise' : 'counterclockwise';
}

function resolveAmpereForceDirection(value: number): P13VerticalDirection {
  if (Math.abs(value) <= EPSILON) return 'none';
  return value < 0 ? 'up' : 'down';
}

function buildVerticalRailRodState(
  params: P13VerticalRailRodParams,
  time: number,
): P13VerticalRailRodState {
  const totalResistance = computeTotalResistance(params);
  const gravityForce = params.mass * params.gravity;
  const timeConstant = computeTimeConstant(params);
  const signedFluxDensity = resolveSignedFluxDensity(params.magneticField, 'into');
  const coupling = computeCoupling(params);

  let position = 0;
  let velocity = 0;

  if (coupling <= EPSILON) {
    velocity = params.gravity * time;
    position = 0.5 * params.gravity * time * time;
  } else {
    const terminalVelocity = gravityForce / coupling;
    const decay = Math.exp(-time / timeConstant);
    velocity = terminalVelocity * (1 - decay);
    position = terminalVelocity * (time - (timeConstant * (1 - decay)));
  }

  const emf = computeMotionalEmf({
    signedFluxDensity,
    effectiveCutLength: params.railSpan,
    velocity,
  });
  const current = computeInducedCurrent({
    emf,
    resistance: totalResistance,
  });
  const signedAmpereForce = current * params.railSpan * signedFluxDensity;
  const ampereForce = Math.abs(signedAmpereForce);
  const netForce = gravityForce + signedAmpereForce;
  const acceleration = netForce / params.mass;
  const bAbs = Math.abs(params.magneticField);
  const terminalVelocity =
    coupling > EPSILON ? gravityForce / coupling : Number.POSITIVE_INFINITY;
  const terminalCurrent =
    bAbs * params.railSpan > EPSILON ? gravityForce / (bAbs * params.railSpan) : 0;

  return {
    time,
    position,
    velocity,
    emf,
    current,
    ampereForce,
    signedAmpereForce,
    gravityForce,
    netForce,
    acceleration,
    kineticEnergy: 0.5 * params.mass * velocity * velocity,
    totalResistance,
    timeConstant,
    terminalVelocity,
    terminalCurrent,
    motionDirection: resolveMotionDirection(velocity),
    emfDirection: resolveEmfDirection(emf),
    currentDirection: resolveCurrentDirection(current),
    ampereForceDirection: resolveAmpereForceDirection(signedAmpereForce),
  };
}

function estimateSimulationDuration(timeConstant: number): number {
  if (!Number.isFinite(timeConstant)) return 6;
  return clamp(Math.max(MIN_DURATION, timeConstant * 5.5), MIN_DURATION, MAX_DURATION);
}

function chooseTimeStep(duration: number, timeConstant: number): number {
  const durationStep = duration / 650;
  const tauStep = Number.isFinite(timeConstant) ? timeConstant / 120 : DEFAULT_TIME_STEP;
  return clamp(Math.min(DEFAULT_TIME_STEP, durationStep, tauStep), 1e-4, 1 / 30);
}

function computeSummary(
  params: P13VerticalRailRodParams,
): P13VerticalRailRodSummary {
  const totalResistance = computeTotalResistance(params);
  const bAbs = Math.abs(params.magneticField);
  const coupling = computeCoupling(params);
  const gravityForce = params.mass * params.gravity;
  const theoreticalTerminalVelocity =
    coupling > EPSILON ? gravityForce / coupling : Number.POSITIVE_INFINITY;
  const theoreticalTerminalCurrent =
    bAbs * params.railSpan > EPSILON ? gravityForce / (bAbs * params.railSpan) : 0;

  return {
    totalResistance,
    timeConstant: computeTimeConstant(params),
    initialCurrent: 0,
    theoreticalTerminalVelocity,
    theoreticalTerminalCurrent,
    terminalExplanation:
      '导体棒从静止释放后，起初只有重力向下，速度随之增大；速度越大，ε = BLv、i = BLv / (R + R棒) 和向上的安培力也越大。直到 mg 与 F安 相等时，合力为 0，导体棒以终态速度继续匀速下落，终态电流固定为 i终 = mg / (BL)。',
    adoptedConvention: P13_VERTICAL_RAIL_ROD_META.adoptedConvention,
  };
}

export function normalizeVerticalRailRodParams(
  input?: Partial<P13VerticalRailRodParams>,
): P13VerticalRailRodParams {
  const fallback = P13_VERTICAL_RAIL_ROD_DEFAULT_PARAMS;
  return {
    magneticField: clamp(
      readFiniteNumber(input?.magneticField, fallback.magneticField),
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.magneticField.min,
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.magneticField.max,
    ),
    railSpan: clamp(
      readFiniteNumber(input?.railSpan, fallback.railSpan),
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.railSpan.min,
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.railSpan.max,
    ),
    mass: clamp(
      readFiniteNumber(input?.mass, fallback.mass),
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.mass.min,
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.mass.max,
    ),
    rodResistance: clamp(
      readFiniteNumber(input?.rodResistance, fallback.rodResistance),
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.rodResistance.min,
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.rodResistance.max,
    ),
    externalResistance: clamp(
      readFiniteNumber(input?.externalResistance, fallback.externalResistance),
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.externalResistance.min,
      P13_VERTICAL_RAIL_ROD_PARAM_CONFIG.externalResistance.max,
    ),
    gravity: Math.max(0, readFiniteNumber(input?.gravity, fallback.gravity)),
  };
}

export function simulateVerticalRailRodModel(
  input?: Partial<P13VerticalRailRodParams>,
): P13VerticalRailRodSimulationResult {
  const params = normalizeVerticalRailRodParams(input);
  const timeConstant = computeTimeConstant(params);
  const duration = estimateSimulationDuration(timeConstant);
  const timeStep = chooseTimeStep(duration, timeConstant);
  const samples: P13VerticalRailRodState[] = [];

  for (let time = 0; time <= duration + (timeStep * 0.5); time += timeStep) {
    const clampedTime = Math.min(time, duration);
    samples.push(buildVerticalRailRodState(params, clampedTime));
    if (clampedTime >= duration) break;
  }

  const finalSample = samples[samples.length - 1];
  return {
    modelKey: P13_MODEL_KEYS.verticalRailRod,
    params,
    duration: finalSample?.time ?? duration,
    timeStep,
    samples,
    summary: computeSummary(params),
  };
}

export function sampleVerticalRailRodStateAtTime(
  result: P13VerticalRailRodSimulationResult,
  time: number,
): P13VerticalRailRodState {
  const clampedTime = clamp(time, 0, result.duration);
  return buildVerticalRailRodState(result.params, clampedTime);
}

export function buildVerticalRailAnalysisSteps(
  result: P13VerticalRailRodSimulationResult,
  state: P13VerticalRailRodState,
): P13SingleRodAnalysisStep[] {
  void result;
  const motionLabel = P13_VERTICAL_RAIL_VERTICAL_DIRECTION_LABELS[state.motionDirection];
  const emfLabel = P13_VERTICAL_RAIL_HORIZONTAL_DIRECTION_LABELS[state.emfDirection];
  const currentLabel = P13_VERTICAL_RAIL_CURRENT_DIRECTION_LABELS[state.currentDirection];
  const moving = state.motionDirection !== 'none';
  const energized = state.currentDirection !== 'none';
  const forceLabel = energized
    ? P13_VERTICAL_RAIL_VERTICAL_DIRECTION_LABELS[state.ampereForceDirection]
    : '无明确方向';

  return [
    {
      key: 'velocity',
      title: '运动方向',
      directionLabel: motionLabel,
      description: moving
        ? `导体棒当前沿竖直导轨${motionLabel}，正在切割磁感线。速度越大，随后建立的动生电动势与感应电流也越大。`
        : '导体棒刚从静止释放，瞬时速度近似为 0；但只要继续下落，后续三个量都会立即建立。',
      accentColor: ANALYSIS_ACCENTS.velocity,
    },
    {
      key: 'emf',
      title: '感应电动势方向',
      directionLabel: emfLabel,
      description: moving
        ? `磁场固定垂直纸面向内，导体棒向下运动时，按右手定则，棒内正电荷被推向右端，所以感应电动势${emfLabel}，并满足 ε = BLv。`
        : '因为刚释放时 v≈0，所以 ε 也接近 0；一旦开始下落，电动势就会沿棒向右建立。',
      accentColor: ANALYSIS_ACCENTS.emf,
    },
    {
      key: 'current',
      title: '电流方向',
      directionLabel: currentLabel,
      description: energized
        ? `回路总电阻为 R + R棒，因此 ${P13_VERTICAL_RAIL_ROD_META.currentFormula}。当前电流沿${currentLabel}方向闭合，并通过上支路外接电阻返回。`
        : '起始时刻因为 ε≈0，所以回路电流也近似为 0；随着下落速度增加，顺时针电流随之建立。',
      accentColor: ANALYSIS_ACCENTS.current,
    },
    {
      key: 'ampere-force',
      title: '安培力方向',
      directionLabel: forceLabel,
      description: energized
        ? `导体棒内电流与磁场作用产生安培力，F安 = BIL。当前安培力${forceLabel}，始终阻碍导体棒继续下落，并逐步把系统拉向 mg = F安 的终态平衡。`
        : '起始时刻没有稳定电流，所以安培力也近似为 0；随后它会向上建立，用来阻碍导体棒下落。',
      accentColor: ANALYSIS_ACCENTS['ampere-force'],
    },
  ];
}
