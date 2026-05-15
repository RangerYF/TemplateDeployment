import type { MagneticFieldDirection } from '../types';
import {
  computeRectangularLoopFlux,
  resolveSignedFluxDensity,
} from './core';
import {
  P13_MODEL_KEYS,
  type P13HorizontalDirection,
  type P13LoopCurrentDirection,
  type P13UniformBFieldRegion,
} from './types';

const EPSILON = 1e-6;
const DEFAULT_TIME_STEP = 1 / 180;
const MIN_TIME_STEP = 1e-4;
const MIN_DURATION = 3.5;
const MAX_DURATION = 24;
const SETTLE_HOLD_SECONDS = 0.6;
const LOOP_TRAVEL_WIDTH = 1;
const LOOP_START_X = -1;
const LOOP_Y = -0.5;
const FIELD_X = 2;
const FIELD_Y = -2;
const FIELD_WIDTH = 4;
const FIELD_HEIGHT = 4;

const ANALYSIS_ACCENTS = {
  motion: '#2563EB',
  flux: '#0EA5E9',
  current: '#F97316',
  'ampere-force': '#DC2626',
} as const;

export const P13_BASE_LOOP_PRESET_ID = 'P02-EM004-emf-induction';
export const P13_BASE_LOOP_ANALYSIS_TOTAL_STEPS = 4;

export type P13BaseLoopFluxTrend = 'increase' | 'decrease' | 'steady';
export type P13BaseLoopPhase =
  | 'before-entry'
  | 'entering'
  | 'fully-inside'
  | 'leaving'
  | 'after-exit';

export interface P13BaseLoopParams {
  initialVelocity: number;
  mass: number;
  resistance: number;
  effectiveCutLength: number;
  magneticField: number;
  direction: MagneticFieldDirection;
}

export interface P13BaseLoopState {
  time: number;
  positionX: number;
  positionY: number;
  velocity: number;
  acceleration: number;
  kineticEnergy: number;
  frameDepth: number;
  effectiveCutLength: number;
  mass: number;
  resistance: number;
  magneticField: number;
  magneticFieldDirection: MagneticFieldDirection;
  signedFluxDensity: number;
  overlapArea: number;
  flux: number;
  emf: number;
  current: number;
  ampereForce: number;
  signedAmpereForce: number;
  phase: P13BaseLoopPhase;
  fluxTrend: P13BaseLoopFluxTrend;
  motionDirection: P13HorizontalDirection;
  currentDirection: P13LoopCurrentDirection;
  ampereForceDirection: P13HorizontalDirection;
}

export type P13BaseLoopAnalysisStepKey =
  | 'motion'
  | 'flux'
  | 'current'
  | 'ampere-force';

export interface P13BaseLoopAnalysisStep {
  key: P13BaseLoopAnalysisStepKey;
  title: string;
  directionLabel: string;
  description: string;
  accentColor: string;
}

export interface P13BaseLoopSummary {
  peakFluxMagnitude: number;
  peakEmfMagnitude: number;
  peakCurrentMagnitude: number;
  peakAmpereForceMagnitude: number;
  entryStartTime: number | null;
  fullyInsideTime: number | null;
  leaveStartTime: number | null;
  exitTime: number | null;
  stopTime: number | null;
  finalVelocity: number;
  dragTimeConstant: number;
  simplificationNote: string;
  adoptedConvention: string;
}

export interface P13BaseLoopSimulationResult {
  modelKey: typeof P13_MODEL_KEYS.rectangularLoopUniformBField;
  params: P13BaseLoopParams;
  duration: number;
  timeStep: number;
  samples: P13BaseLoopState[];
  summary: P13BaseLoopSummary;
}

export const P13_BASE_LOOP_META = {
  code: 'P13-BASE-001',
  title: '矩形线框穿过匀强磁场',
  shortTitle: '基础动生',
  presetId: P13_BASE_LOOP_PRESET_ID,
  modelKey: P13_MODEL_KEYS.rectangularLoopUniformBField,
  pageSubtitle:
    '改为真实动力学口径：线框以初速度进入匀强磁场后，只要仍在切割磁感线，就会经历 Φ → ε → I → F安 → 减速 的闭环；若动能耗尽，线框会停在磁场边界附近。',
  topologyTitle: '矩形线框 + 匀强磁场',
  terminalHeadline: '真实动力学：仅在线框切割磁感线时满足 m·dv/dt = -B²L²v / R',
  simplificationNote:
    '忽略自感、空气阻力、摩擦、磁场边缘效应与辐射效应；磁场区域固定不动，线框尺寸固定不变，安培力只按理想平动模型作用在水平方向。',
  adoptedConvention:
    '约定线框从左向右进入固定匀强磁场；磁场向内记负、向外记正，感应电流取逆时针为正。进入时若磁通量绝对值增大，则安培力必阻碍原运动；完全进入或完全离开后，ε 与 I 回到 0。',
} as const;

export const P13_BASE_LOOP_PARAM_CONFIG = {
  initialVelocity: { label: '初速度 v0', min: 0, max: 20, step: 0.1, unit: 'm/s' },
  mass: { label: '线框质量 m', min: 0.01, max: 2, step: 0.01, unit: 'kg' },
  resistance: { label: '线框电阻 R', min: 0.5, max: 10, step: 0.1, unit: 'Ω' },
  effectiveCutLength: { label: '切割边长 L', min: 0.5, max: 3, step: 0.1, unit: 'm' },
  magneticField: { label: '磁感应强度 B', min: 0, max: 5, step: 0.1, unit: 'T' },
} as const;

export const P13_BASE_LOOP_DEFAULT_PARAMS: P13BaseLoopParams = {
  initialVelocity: 6,
  mass: 0.2,
  resistance: 2,
  effectiveCutLength: 1,
  magneticField: 1,
  direction: 'into',
};

export const P13_BASE_LOOP_CURRENT_DIRECTION_LABELS: Record<
  P13LoopCurrentDirection,
  string
> = {
  clockwise: '顺时针',
  counterclockwise: '逆时针',
  none: '无感应电流',
};

export const P13_BASE_LOOP_FLUX_TREND_LABELS: Record<P13BaseLoopFluxTrend, string> = {
  increase: '增大',
  decrease: '减小',
  steady: '保持不变',
};

export const P13_BASE_LOOP_PHASE_LABELS: Record<P13BaseLoopPhase, string> = {
  'before-entry': '线框在磁场外',
  entering: '线框正在进入磁场',
  'fully-inside': '线框完全在磁场内',
  leaving: '线框正在离开磁场',
  'after-exit': '线框已完全离开磁场',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function resolveHorizontalDirection(value: number): P13HorizontalDirection {
  if (Math.abs(value) <= EPSILON) return 'none';
  return value > 0 ? 'right' : 'left';
}

function resolveLoopCurrentDirection(value: number): P13LoopCurrentDirection {
  if (Math.abs(value) <= EPSILON) return 'none';
  return value > 0 ? 'counterclockwise' : 'clockwise';
}

function resolveFluxTrendFromRate(fluxRate: number): P13BaseLoopFluxTrend {
  if (Math.abs(fluxRate) <= EPSILON) return 'steady';
  return fluxRate > 0 ? 'increase' : 'decrease';
}

function computeTotalResistance(params: P13BaseLoopParams): number {
  return Math.max(EPSILON, params.resistance);
}

function computeDragTimeConstant(params: P13BaseLoopParams): number {
  const bAbs = Math.abs(params.magneticField);
  const denominator = bAbs * bAbs * params.effectiveCutLength * params.effectiveCutLength;
  if (denominator <= EPSILON) return Number.POSITIVE_INFINITY;
  return (params.mass * computeTotalResistance(params)) / denominator;
}

function getFieldRegion(params: P13BaseLoopParams): P13UniformBFieldRegion {
  return {
    position: { x: FIELD_X, y: FIELD_Y },
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    magnitude: params.magneticField,
    direction: params.direction,
  };
}

function getPhase(positionX: number): P13BaseLoopPhase {
  const loopLeft = positionX;
  const loopRight = positionX + LOOP_TRAVEL_WIDTH;
  const fieldLeft = FIELD_X;
  const fieldRight = FIELD_X + FIELD_WIDTH;

  if (loopRight <= fieldLeft) return 'before-entry';
  if (loopLeft < fieldLeft) return 'entering';
  if (loopRight <= fieldRight) return 'fully-inside';
  if (loopLeft < fieldRight) return 'leaving';
  return 'after-exit';
}

function computeFluxRate(
  phase: P13BaseLoopPhase,
  signedFluxDensity: number,
  velocity: number,
  effectiveCutLength: number,
): number {
  if (Math.abs(velocity) <= EPSILON || Math.abs(signedFluxDensity) <= EPSILON) {
    return 0;
  }
  if (phase === 'entering') {
    return signedFluxDensity * effectiveCutLength * velocity;
  }
  if (phase === 'leaving') {
    return -signedFluxDensity * effectiveCutLength * velocity;
  }
  return 0;
}

function buildState(
  params: P13BaseLoopParams,
  time: number,
  positionX: number,
  velocity: number,
): P13BaseLoopState {
  const signedFluxDensity = resolveSignedFluxDensity(params.magneticField, params.direction);
  const phase = getPhase(positionX);
  const fluxSample = computeRectangularLoopFlux(
    {
      position: { x: positionX, y: LOOP_Y },
      width: LOOP_TRAVEL_WIDTH,
      height: params.effectiveCutLength,
    },
    [getFieldRegion(params)],
  );
  const fluxRate = computeFluxRate(
    phase,
    signedFluxDensity,
    velocity,
    params.effectiveCutLength,
  );
  const emf = -fluxRate;
  const current = emf / computeTotalResistance(params);
  const ampereForceMagnitude =
    phase === 'entering' || phase === 'leaving'
      ? Math.abs(params.magneticField) * Math.abs(current) * params.effectiveCutLength
      : 0;
  const signedAmpereForce =
    Math.abs(velocity) <= EPSILON
      ? 0
      : -Math.sign(velocity) * ampereForceMagnitude;
  const acceleration = params.mass > EPSILON ? signedAmpereForce / params.mass : 0;

  return {
    time,
    positionX,
    positionY: LOOP_Y,
    velocity,
    acceleration,
    kineticEnergy: 0.5 * params.mass * velocity * velocity,
    frameDepth: LOOP_TRAVEL_WIDTH,
    effectiveCutLength: params.effectiveCutLength,
    mass: params.mass,
    resistance: params.resistance,
    magneticField: params.magneticField,
    magneticFieldDirection: params.direction,
    signedFluxDensity,
    overlapArea: fluxSample.overlapArea,
    flux: fluxSample.flux,
    emf,
    current,
    ampereForce: ampereForceMagnitude,
    signedAmpereForce,
    phase,
    fluxTrend: resolveFluxTrendFromRate(fluxRate),
    motionDirection: resolveHorizontalDirection(velocity),
    currentDirection: resolveLoopCurrentDirection(current),
    ampereForceDirection: resolveHorizontalDirection(signedAmpereForce),
  };
}

function estimateSimulationDuration(params: P13BaseLoopParams, dragTimeConstant: number): number {
  const totalDistance = (FIELD_X + FIELD_WIDTH) - LOOP_START_X;
  const freeTraversalEstimate = params.initialVelocity > EPSILON
    ? totalDistance / params.initialVelocity
    : MIN_DURATION;
  const dampingEstimate = Number.isFinite(dragTimeConstant) ? dragTimeConstant * 10 : 0;

  return clamp(
    Math.max(MIN_DURATION, freeTraversalEstimate * 1.4, dampingEstimate),
    MIN_DURATION,
    MAX_DURATION,
  );
}

function chooseTimeStep(
  params: P13BaseLoopParams,
  duration: number,
  dragTimeConstant: number,
): number {
  const durationStep = duration / 900;
  const tauStep = Number.isFinite(dragTimeConstant)
    ? dragTimeConstant / 120
    : DEFAULT_TIME_STEP;
  const travelStep = params.initialVelocity > EPSILON
    ? Math.min(DEFAULT_TIME_STEP, Math.max(1 / 600, 0.01 / params.initialVelocity))
    : DEFAULT_TIME_STEP;

  return clamp(
    Math.min(DEFAULT_TIME_STEP, durationStep, tauStep, travelStep),
    MIN_TIME_STEP,
    1 / 30,
  );
}

function findFirstPhaseTime(
  samples: readonly P13BaseLoopState[],
  phase: P13BaseLoopPhase,
): number | null {
  const match = samples.find((sample) => sample.phase === phase);
  return match ? match.time : null;
}

function computeSummary(samples: P13BaseLoopState[]): P13BaseLoopSummary {
  const peakFluxMagnitude = samples.reduce((max, sample) => Math.max(max, Math.abs(sample.flux)), 0);
  const peakEmfMagnitude = samples.reduce((max, sample) => Math.max(max, Math.abs(sample.emf)), 0);
  const peakCurrentMagnitude = samples.reduce((max, sample) => Math.max(max, Math.abs(sample.current)), 0);
  const peakAmpereForceMagnitude = samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample.ampereForce)),
    0,
  );
  const stopSample = samples.find(
    (sample, index) => index > 0 && Math.abs(sample.velocity) <= EPSILON,
  );
  const finalSample = samples[samples.length - 1]!;

  return {
    peakFluxMagnitude,
    peakEmfMagnitude,
    peakCurrentMagnitude,
    peakAmpereForceMagnitude,
    entryStartTime: findFirstPhaseTime(samples, 'entering'),
    fullyInsideTime: findFirstPhaseTime(samples, 'fully-inside'),
    leaveStartTime: findFirstPhaseTime(samples, 'leaving'),
    exitTime: findFirstPhaseTime(samples, 'after-exit'),
    stopTime: stopSample?.time ?? null,
    finalVelocity: finalSample.velocity,
    dragTimeConstant: computeDragTimeConstant({
      initialVelocity: finalSample.velocity,
      mass: finalSample.mass,
      resistance: finalSample.resistance,
      effectiveCutLength: finalSample.effectiveCutLength,
      magneticField: finalSample.magneticField,
      direction: finalSample.magneticFieldDirection,
    }),
    simplificationNote: P13_BASE_LOOP_META.simplificationNote,
    adoptedConvention: P13_BASE_LOOP_META.adoptedConvention,
  };
}

export function normalizeBaseLoopParams(
  overrides?: Partial<P13BaseLoopParams>,
): P13BaseLoopParams {
  return {
    initialVelocity: clamp(
      readFiniteNumber(overrides?.initialVelocity, P13_BASE_LOOP_DEFAULT_PARAMS.initialVelocity),
      P13_BASE_LOOP_PARAM_CONFIG.initialVelocity.min,
      P13_BASE_LOOP_PARAM_CONFIG.initialVelocity.max,
    ),
    mass: clamp(
      readFiniteNumber(overrides?.mass, P13_BASE_LOOP_DEFAULT_PARAMS.mass),
      P13_BASE_LOOP_PARAM_CONFIG.mass.min,
      P13_BASE_LOOP_PARAM_CONFIG.mass.max,
    ),
    resistance: clamp(
      readFiniteNumber(overrides?.resistance, P13_BASE_LOOP_DEFAULT_PARAMS.resistance),
      P13_BASE_LOOP_PARAM_CONFIG.resistance.min,
      P13_BASE_LOOP_PARAM_CONFIG.resistance.max,
    ),
    effectiveCutLength: clamp(
      readFiniteNumber(overrides?.effectiveCutLength, P13_BASE_LOOP_DEFAULT_PARAMS.effectiveCutLength),
      P13_BASE_LOOP_PARAM_CONFIG.effectiveCutLength.min,
      P13_BASE_LOOP_PARAM_CONFIG.effectiveCutLength.max,
    ),
    magneticField: clamp(
      readFiniteNumber(overrides?.magneticField, P13_BASE_LOOP_DEFAULT_PARAMS.magneticField),
      P13_BASE_LOOP_PARAM_CONFIG.magneticField.min,
      P13_BASE_LOOP_PARAM_CONFIG.magneticField.max,
    ),
    direction: overrides?.direction === 'out' ? 'out' : 'into',
  };
}

export function simulateBaseLoopModel(
  paramsInput?: Partial<P13BaseLoopParams>,
): P13BaseLoopSimulationResult {
  const params = normalizeBaseLoopParams(paramsInput);
  const dragTimeConstant = computeDragTimeConstant(params);
  const estimatedDuration = estimateSimulationDuration(params, dragTimeConstant);
  const timeStep = chooseTimeStep(params, estimatedDuration, dragTimeConstant);
  const samples: P13BaseLoopState[] = [];

  let time = 0;
  let positionX = LOOP_START_X;
  let velocity = params.initialVelocity;
  let settleDeadline: number | null = null;

  samples.push(buildState(params, time, positionX, velocity));

  while (time < estimatedDuration - timeStep * 0.5) {
    const currentState = buildState(params, time, positionX, velocity);
    const dt = Math.min(timeStep, estimatedDuration - time);

    let nextVelocity = velocity + (currentState.acceleration * dt);
    if (Math.abs(nextVelocity) <= 1e-5) {
      nextVelocity = 0;
    }
    if (nextVelocity < 0) {
      nextVelocity = 0;
    }

    const nextPositionX = positionX + ((velocity + nextVelocity) * 0.5 * dt);
    const nextTime = Math.min(estimatedDuration, time + dt);
    const nextState = buildState(params, nextTime, nextPositionX, nextVelocity);

    samples.push(nextState);

    time = nextTime;
    positionX = nextPositionX;
    velocity = nextVelocity;

    if (settleDeadline === null) {
      if (nextState.phase === 'after-exit') {
        settleDeadline = Math.min(estimatedDuration, time + SETTLE_HOLD_SECONDS);
      } else if (Math.abs(nextState.velocity) <= EPSILON) {
        settleDeadline = Math.min(estimatedDuration, time + SETTLE_HOLD_SECONDS);
      }
    }

    if (settleDeadline !== null && time >= settleDeadline - EPSILON) {
      break;
    }
  }

  const duration = samples[samples.length - 1]?.time ?? 0;

  return {
    modelKey: P13_MODEL_KEYS.rectangularLoopUniformBField,
    params,
    duration,
    timeStep,
    samples,
    summary: computeSummary(samples),
  };
}

export function sampleBaseLoopStateAtTime(
  result: P13BaseLoopSimulationResult,
  time: number,
): P13BaseLoopState {
  const clampedTime = clamp(time, 0, result.duration);
  const approximateIndex = clamp(
    Math.floor(clampedTime / Math.max(result.timeStep, MIN_TIME_STEP)),
    0,
    result.samples.length - 1,
  );
  const current = result.samples[approximateIndex];
  const next = result.samples[approximateIndex + 1];
  if (!current || !next) {
    return result.samples[result.samples.length - 1]!;
  }
  return Math.abs(next.time - clampedTime) < Math.abs(clampedTime - current.time)
    ? next
    : current;
}

function formatSignedFluxText(
  direction: MagneticFieldDirection,
  trend: P13BaseLoopFluxTrend,
  velocity: number,
): string {
  if (Math.abs(velocity) <= EPSILON || trend === 'steady') {
    return '当前没有切割磁感线，重叠面积保持不变，因此磁通量 Φ 不再变化。';
  }

  if (direction === 'into') {
    return trend === 'decrease'
      ? '当前线框进入向内磁场区域，且速度仍向右，因此重叠面积继续增大；按“向内为负”记号，Φ 的数值继续减小。'
      : '当前线框离开向内磁场区域，且速度仍向右，因此重叠面积继续减小；按“向内为负”记号，Φ 的数值继续增大。';
  }

  return trend === 'increase'
    ? '当前线框进入向外磁场区域，且速度仍向右，因此重叠面积继续增大，Φ 的数值继续增大。'
    : '当前线框离开向外磁场区域，且速度仍向右，因此重叠面积继续减小，Φ 的数值继续减小。';
}

export function buildBaseLoopAnalysisSteps(
  result: P13BaseLoopSimulationResult,
  state: P13BaseLoopState,
): P13BaseLoopAnalysisStep[] {
  const fieldLabel = state.magneticFieldDirection === 'into' ? '垂直纸面向内 ×' : '垂直纸面向外 ·';
  const currentLabel = P13_BASE_LOOP_CURRENT_DIRECTION_LABELS[state.currentDirection];
  const fluxLabel = P13_BASE_LOOP_FLUX_TREND_LABELS[state.fluxTrend];
  const phaseLabel = P13_BASE_LOOP_PHASE_LABELS[state.phase];
  const ampereDirectionLabel =
    state.ampereForceDirection === 'none'
      ? '无安培力'
      : state.ampereForceDirection === 'left'
        ? '向左'
        : '向右';
  const motionLabel =
    state.motionDirection === 'none'
      ? '已停下'
      : state.motionDirection === 'right'
        ? '向右'
        : '向左';

  return [
    {
      key: 'motion',
      title: '线框运动状态',
      directionLabel: motionLabel,
      description:
        state.motionDirection === 'none'
          ? `当前线框速度已经衰减到 0，停在 x = ${state.positionX.toFixed(3)} m 附近。因为此时不再切割磁感线，安培力也随之消失。`
          : `线框以初速度 v0 = ${result.params.initialVelocity.toFixed(2)} m/s 进入磁场，当前速度为 v = ${state.velocity.toFixed(3)} m/s，加速度 a = ${state.acceleration.toFixed(3)} m/s²。只要还在切割磁感线，安培力就会继续让它减速。`,
      accentColor: ANALYSIS_ACCENTS.motion,
    },
    {
      key: 'flux',
      title: '磁通量变化',
      directionLabel: state.phase === 'before-entry' || state.phase === 'after-exit'
        ? 'Φ = 0'
        : `${phaseLabel}，Φ${fluxLabel}`,
      description:
        state.phase === 'before-entry' || state.phase === 'after-exit'
          ? `当前线框与磁场区域没有重叠，磁场方向为 ${fieldLabel}，所以磁通量 Φ = 0。`
          : state.phase === 'fully-inside'
            ? `当前线框完全位于磁场区域内，磁场方向为 ${fieldLabel}，重叠面积固定，因此 Φ 保持不变。`
            : formatSignedFluxText(result.params.direction, state.fluxTrend, state.velocity),
      accentColor: ANALYSIS_ACCENTS.flux,
    },
    {
      key: 'current',
      title: '感应电流方向',
      directionLabel: currentLabel,
      description:
        state.currentDirection === 'none'
          ? '当前 dΦ/dt = 0，因此 ε = 0，回路中没有稳定感应电流。'
          : `由 ε = -dΦ/dt、I = ε / R 可得当前 ε = ${state.emf.toFixed(3)} V，I = ${state.current.toFixed(3)} A，因此线框中的感应电流方向为${currentLabel}。`,
      accentColor: ANALYSIS_ACCENTS.current,
    },
    {
      key: 'ampere-force',
      title: '安培力与减速',
      directionLabel: ampereDirectionLabel,
      description:
        state.ampereForceDirection === 'none'
          ? '当前没有稳定电流，因此安培力近似为 0，线框此刻只会保持原有速度或静止。'
          : `当前安培力大小 F安 = ${state.ampereForce.toFixed(3)} N，方向为${ampereDirectionLabel}。它直接反作用到线框质量 m = ${state.mass.toFixed(2)} kg 上，因此此刻满足 a = F安 / m = ${state.acceleration.toFixed(3)} m/s²，方向始终阻碍原运动。`,
      accentColor: ANALYSIS_ACCENTS['ampere-force'],
    },
  ];
}
