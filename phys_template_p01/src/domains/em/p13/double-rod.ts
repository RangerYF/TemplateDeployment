import type {
  P13DoubleRodAnalysisStep,
  P13DoubleRodParams,
  P13DoubleRodSimulationResult,
  P13DoubleRodState,
  P13DoubleRodVariant,
  P13HorizontalDirection,
  P13LoopCurrentDirection,
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
const MIN_DURATION = 0.8;
const MAX_DURATION = 40;

const ANALYSIS_ACCENTS = {
  'relative-motion': '#2563EB',
  emf: '#0EA5E9',
  current: '#F97316',
  'ampere-force': '#DC2626',
} as const;

export const P13_DOUBLE_ROD_BASIC_PRESET_ID = 'P13-EMI-021-double-rod-basic';
export const P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS = 4;

export type P13DoubleRodParamKey =
  | 'magneticField'
  | 'railSpan'
  | 'mass1'
  | 'mass2'
  | 'rod1Resistance'
  | 'rod2Resistance'
  | 'initialVelocity1'
  | 'initialVelocity2';

interface P13DoubleRodVariantMeta {
  variant: P13DoubleRodVariant;
  code: string;
  title: string;
  shortTitle: string;
  presetId: string;
  modelKey: typeof P13_MODEL_KEYS.doubleRod;
  pageSubtitle: string;
  currentFormula: string;
  topologyTitle: string;
  terminalHeadline: string;
  adoptedConvention: string;
  visibleParamKeys: readonly P13DoubleRodParamKey[];
}

export const P13_DOUBLE_ROD_VARIANT_META: Record<
  P13DoubleRodVariant,
  P13DoubleRodVariantMeta
> = {
  'basic-frictionless': {
    variant: 'basic-frictionless',
    code: 'EMI-021',
    title: '双棒基础（无摩擦）',
    shortTitle: '双棒基础',
    presetId: P13_DOUBLE_ROD_BASIC_PRESET_ID,
    modelKey: P13_MODEL_KEYS.doubleRod,
    pageSubtitle:
      '两根导体棒在同一匀强磁场回路中耦合：相对速度决定动生电动势，回路电流通过大小相等方向相反的安培力把两棒速度拉向共同终态。',
    currentFormula: 'i = BL(v1 - v2) / (R1 + R2)',
    topologyTitle: '双棒无摩擦闭合回路',
    terminalHeadline: '理论终态：两棒共速，电流衰减到 0',
    adoptedConvention:
      '约定磁场垂直纸面向内，棒1位于回路右侧、棒2位于左侧；当 v1 > v2 时，ε = BL(v1 - v2) > 0，回路电流取逆时针，棒1受力向左、棒2受力向右。',
    visibleParamKeys: [
      'magneticField',
      'railSpan',
      'mass1',
      'mass2',
      'rod1Resistance',
      'rod2Resistance',
      'initialVelocity1',
      'initialVelocity2',
    ],
  },
};

export const P13_DOUBLE_ROD_PARAM_CONFIG = {
  magneticField: { label: '磁感应强度 B', min: 0.1, max: 5, step: 0.1, unit: 'T' },
  railSpan: { label: '导轨间距 L', min: 0.1, max: 2, step: 0.1, unit: 'm' },
  mass1: { label: '棒1质量 m1', min: 0.01, max: 1, step: 0.01, unit: 'kg' },
  mass2: { label: '棒2质量 m2', min: 0.01, max: 1, step: 0.01, unit: 'kg' },
  rod1Resistance: { label: '棒1电阻 R1', min: 0.1, max: 20, step: 0.1, unit: 'Ω' },
  rod2Resistance: { label: '棒2电阻 R2', min: 0.1, max: 20, step: 0.1, unit: 'Ω' },
  initialVelocity1: { label: '棒1初速度 v1_0', min: -20, max: 20, step: 0.1, unit: 'm/s' },
  initialVelocity2: { label: '棒2初速度 v2_0', min: -20, max: 20, step: 0.1, unit: 'm/s' },
} as const;

export const P13_DOUBLE_ROD_DEFAULT_PARAMS: P13DoubleRodParams = {
  variant: 'basic-frictionless',
  magneticField: 0.8,
  magneticFieldDirection: 'into',
  railSpan: 0.5,
  mass1: 0.12,
  mass2: 0.08,
  rod1Resistance: 1.2,
  rod2Resistance: 1.8,
  initialVelocity1: 6,
  initialVelocity2: 1,
  initialSeparation: 1.2,
};

export const P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS: Record<
  P13HorizontalDirection,
  string
> = {
  left: '向左',
  right: '向右',
  none: '无相对运动',
};

export const P13_DOUBLE_ROD_VERTICAL_DIRECTION_LABELS: Record<P13VerticalDirection, string> = {
  up: '沿棒向上',
  down: '沿棒向下',
  none: '无明确方向',
};

export const P13_DOUBLE_ROD_CURRENT_DIRECTION_LABELS: Record<
  P13LoopCurrentDirection,
  string
> = {
  clockwise: '顺时针',
  counterclockwise: '逆时针',
  none: '无感应电流',
};

export function getDoubleRodVariantMeta(
  variant: P13DoubleRodVariant,
): P13DoubleRodVariantMeta {
  return P13_DOUBLE_ROD_VARIANT_META[variant];
}

export function getDoubleRodVariantByPresetId(
  presetId: string,
): P13DoubleRodVariant | null {
  if (presetId === P13_DOUBLE_ROD_BASIC_PRESET_ID) return 'basic-frictionless';
  return null;
}

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

function resolveVerticalDirection(value: number): P13VerticalDirection {
  if (Math.abs(value) <= EPSILON) return 'none';
  return value > 0 ? 'up' : 'down';
}

function resolveLoopCurrentDirection(value: number): P13LoopCurrentDirection {
  if (Math.abs(value) <= EPSILON) return 'none';
  return value > 0 ? 'counterclockwise' : 'clockwise';
}

function computeTotalResistance(params: P13DoubleRodParams): number {
  return params.rod1Resistance + params.rod2Resistance;
}

function computeDecayRate(params: P13DoubleRodParams): number {
  const totalResistance = computeTotalResistance(params);
  if (totalResistance <= EPSILON) return 0;
  const bAbs = Math.abs(params.magneticField);
  const coupling = (bAbs * bAbs * params.railSpan * params.railSpan) / totalResistance;
  if (coupling <= EPSILON) return 0;
  return coupling * ((1 / params.mass1) + (1 / params.mass2));
}

function computeTimeConstant(params: P13DoubleRodParams): number {
  const decayRate = computeDecayRate(params);
  return decayRate > EPSILON ? 1 / decayRate : Number.POSITIVE_INFINITY;
}

function computeTerminalVelocity(params: P13DoubleRodParams): number {
  const momentum = (params.mass1 * params.initialVelocity1) + (params.mass2 * params.initialVelocity2);
  return momentum / (params.mass1 + params.mass2);
}

function computeRelativeVelocityIntegral(
  initialRelativeVelocity: number,
  decayRate: number,
  time: number,
): number {
  if (decayRate <= EPSILON) {
    return initialRelativeVelocity * time;
  }
  return (initialRelativeVelocity / decayRate) * (1 - Math.exp(-decayRate * time));
}

function buildStateFromInstantaneous(base: {
  params: P13DoubleRodParams;
  time: number;
  position1: number;
  position2: number;
  velocity1: number;
  velocity2: number;
}): P13DoubleRodState {
  const { params, time, position1, position2, velocity1, velocity2 } = base;
  const separation = position1 - position2;
  const relativeVelocity = velocity1 - velocity2;
  const totalResistance = computeTotalResistance(params);
  const signedFluxDensity = resolveSignedFluxDensity(
    params.magneticField,
    params.magneticFieldDirection,
  );
  const emf = computeMotionalEmf({
    signedFluxDensity,
    effectiveCutLength: params.railSpan,
    velocity: relativeVelocity,
  });
  const current = computeInducedCurrent({
    emf,
    resistance: totalResistance,
  });
  const ampereForceOnRod1 = current * params.railSpan * signedFluxDensity;
  const ampereForceOnRod2 = -ampereForceOnRod1;
  const acceleration1 = ampereForceOnRod1 / params.mass1;
  const acceleration2 = ampereForceOnRod2 / params.mass2;
  const momentum = (params.mass1 * velocity1) + (params.mass2 * velocity2);
  const kineticEnergy = (0.5 * params.mass1 * velocity1 * velocity1) + (0.5 * params.mass2 * velocity2 * velocity2);

  return {
    time,
    position1,
    position2,
    velocity1,
    velocity2,
    relativeVelocity,
    separation,
    emf,
    current,
    totalResistance,
    ampereForceOnRod1,
    ampereForceOnRod2,
    acceleration1,
    acceleration2,
    momentum,
    kineticEnergy,
    motionDirection1: resolveHorizontalDirection(velocity1),
    motionDirection2: resolveHorizontalDirection(velocity2),
    relativeMotionDirection: resolveHorizontalDirection(relativeVelocity),
    emfDirection: resolveVerticalDirection(emf),
    currentDirection: resolveLoopCurrentDirection(current),
    ampereForceDirectionOnRod1: resolveHorizontalDirection(ampereForceOnRod1),
    ampereForceDirectionOnRod2: resolveHorizontalDirection(ampereForceOnRod2),
  };
}

function buildDoubleRodState(base: {
  params: P13DoubleRodParams;
  time: number;
  terminalVelocity: number;
  initialRelativeVelocity: number;
  decayRate: number;
}): P13DoubleRodState {
  const { params, time, terminalVelocity, initialRelativeVelocity, decayRate } = base;
  const totalMass = params.mass1 + params.mass2;
  const relativeVelocity = decayRate <= EPSILON
    ? initialRelativeVelocity
    : initialRelativeVelocity * Math.exp(-decayRate * time);
  const relativeIntegral = computeRelativeVelocityIntegral(
    initialRelativeVelocity,
    decayRate,
    time,
  );

  const velocity1 = terminalVelocity + ((params.mass2 / totalMass) * relativeVelocity);
  const velocity2 = terminalVelocity - ((params.mass1 / totalMass) * relativeVelocity);
  const position1 =
    params.initialSeparation +
    (terminalVelocity * time) +
    ((params.mass2 / totalMass) * relativeIntegral);
  const position2 = (terminalVelocity * time) - ((params.mass1 / totalMass) * relativeIntegral);

  return buildStateFromInstantaneous({
    params,
    time,
    position1,
    position2,
    velocity1,
    velocity2,
  });
}

function estimateSimulationDuration(timeConstant: number): number {
  if (!Number.isFinite(timeConstant)) return 6;
  return clamp(Math.max(MIN_DURATION, timeConstant * 7), MIN_DURATION, MAX_DURATION);
}

function chooseTimeStep(duration: number, timeConstant: number): number {
  const durationStep = duration / 700;
  const tauStep = Number.isFinite(timeConstant) ? timeConstant / 120 : DEFAULT_TIME_STEP;
  return clamp(
    Math.min(DEFAULT_TIME_STEP, durationStep, tauStep),
    1e-4,
    1 / 30,
  );
}

function computeSummary(params: P13DoubleRodParams): P13DoubleRodSimulationResult['summary'] {
  const meta = getDoubleRodVariantMeta(params.variant);
  const totalResistance = computeTotalResistance(params);
  const signedFluxDensity = resolveSignedFluxDensity(
    params.magneticField,
    params.magneticFieldDirection,
  );
  const initialRelativeVelocity = params.initialVelocity1 - params.initialVelocity2;
  const initialCurrent = computeInducedCurrent({
    emf: computeMotionalEmf({
      signedFluxDensity,
      effectiveCutLength: params.railSpan,
      velocity: initialRelativeVelocity,
    }),
    resistance: totalResistance,
  });
  return {
    totalResistance,
    timeConstant: computeTimeConstant(params),
    initialCurrent,
    initialMomentum:
      (params.mass1 * params.initialVelocity1) + (params.mass2 * params.initialVelocity2),
    theoreticalTerminalVelocity: computeTerminalVelocity(params),
    theoreticalTerminalCurrent: 0,
    terminalExplanation:
      '双棒回路中，安培力始终等大反向并只消耗相对运动；系统总动量守恒，长期后两棒速度收敛到同一共速 v_terminal = (m1v1_0 + m2v2_0) / (m1 + m2)。当相对速度降为 0 时，ε 与 i 都衰减到 0。',
    adoptedConvention: meta.adoptedConvention,
  };
}

export function normalizeDoubleRodParams(
  variant: P13DoubleRodVariant,
  input?: Partial<P13DoubleRodParams>,
): P13DoubleRodParams {
  const fallback = P13_DOUBLE_ROD_DEFAULT_PARAMS;
  return {
    variant,
    magneticField: clamp(
      readFiniteNumber(input?.magneticField, fallback.magneticField),
      P13_DOUBLE_ROD_PARAM_CONFIG.magneticField.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.magneticField.max,
    ),
    magneticFieldDirection:
      input?.magneticFieldDirection === 'out' ? 'out' : fallback.magneticFieldDirection,
    railSpan: clamp(
      readFiniteNumber(input?.railSpan, fallback.railSpan),
      P13_DOUBLE_ROD_PARAM_CONFIG.railSpan.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.railSpan.max,
    ),
    mass1: clamp(
      readFiniteNumber(input?.mass1, fallback.mass1),
      P13_DOUBLE_ROD_PARAM_CONFIG.mass1.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.mass1.max,
    ),
    mass2: clamp(
      readFiniteNumber(input?.mass2, fallback.mass2),
      P13_DOUBLE_ROD_PARAM_CONFIG.mass2.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.mass2.max,
    ),
    rod1Resistance: clamp(
      readFiniteNumber(input?.rod1Resistance, fallback.rod1Resistance),
      P13_DOUBLE_ROD_PARAM_CONFIG.rod1Resistance.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.rod1Resistance.max,
    ),
    rod2Resistance: clamp(
      readFiniteNumber(input?.rod2Resistance, fallback.rod2Resistance),
      P13_DOUBLE_ROD_PARAM_CONFIG.rod2Resistance.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.rod2Resistance.max,
    ),
    initialVelocity1: clamp(
      readFiniteNumber(input?.initialVelocity1, fallback.initialVelocity1),
      P13_DOUBLE_ROD_PARAM_CONFIG.initialVelocity1.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.initialVelocity1.max,
    ),
    initialVelocity2: clamp(
      readFiniteNumber(input?.initialVelocity2, fallback.initialVelocity2),
      P13_DOUBLE_ROD_PARAM_CONFIG.initialVelocity2.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.initialVelocity2.max,
    ),
    initialSeparation: Math.max(
      0.2,
      readFiniteNumber(input?.initialSeparation, fallback.initialSeparation),
    ),
  };
}

export function simulateDoubleRodModel(
  variant: P13DoubleRodVariant,
  input?: Partial<P13DoubleRodParams>,
): P13DoubleRodSimulationResult {
  const params = normalizeDoubleRodParams(variant, input);
  const initialRelativeVelocity = params.initialVelocity1 - params.initialVelocity2;
  const terminalVelocity = computeTerminalVelocity(params);
  const decayRate = computeDecayRate(params);
  const timeConstant = computeTimeConstant(params);
  const duration = estimateSimulationDuration(timeConstant);
  const timeStep = chooseTimeStep(duration, timeConstant);

  const samples: P13DoubleRodState[] = [];
  for (let time = 0; time <= duration + (timeStep * 0.5); time += timeStep) {
    const clampedTime = Math.min(time, duration);
    samples.push(
      buildDoubleRodState({
        params,
        time: clampedTime,
        terminalVelocity,
        initialRelativeVelocity,
        decayRate,
      }),
    );
    if (clampedTime >= duration) break;
  }

  const finalSample = samples[samples.length - 1];
  return {
    modelKey: P13_MODEL_KEYS.doubleRod,
    variant,
    params,
    duration: finalSample?.time ?? duration,
    timeStep,
    samples,
    summary: computeSummary(params),
  };
}

export function sampleDoubleRodStateAtTime(
  result: P13DoubleRodSimulationResult,
  time: number,
): P13DoubleRodState {
  const clampedTime = clamp(time, 0, result.duration);
  const { samples } = result;
  if (samples.length === 0) {
    return buildDoubleRodState({
      params: result.params,
      time: clampedTime,
      terminalVelocity: computeTerminalVelocity(result.params),
      initialRelativeVelocity: result.params.initialVelocity1 - result.params.initialVelocity2,
      decayRate: computeDecayRate(result.params),
    });
  }
  if (clampedTime <= samples[0]!.time) return samples[0]!;
  const lastSample = samples[samples.length - 1]!;
  if (clampedTime >= lastSample.time) return lastSample;

  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid]!.time < clampedTime) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const right = samples[lo]!;
  const left = samples[Math.max(0, lo - 1)]!;
  const span = right.time - left.time;
  if (span <= EPSILON) return right;
  const ratio = (clampedTime - left.time) / span;
  const position1 = left.position1 + ((right.position1 - left.position1) * ratio);
  const position2 = left.position2 + ((right.position2 - left.position2) * ratio);
  const velocity1 = left.velocity1 + ((right.velocity1 - left.velocity1) * ratio);
  const velocity2 = left.velocity2 + ((right.velocity2 - left.velocity2) * ratio);

  return buildStateFromInstantaneous({
    params: result.params,
    time: clampedTime,
    position1,
    position2,
    velocity1,
    velocity2,
  });
}

export function buildDoubleRodAnalysisSteps(
  result: P13DoubleRodSimulationResult,
  state: P13DoubleRodState,
): P13DoubleRodAnalysisStep[] {
  void result;
  const motionLabel = P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.relativeMotionDirection];
  const emfLabel = P13_DOUBLE_ROD_VERTICAL_DIRECTION_LABELS[state.emfDirection];
  const currentLabel = P13_DOUBLE_ROD_CURRENT_DIRECTION_LABELS[state.currentDirection];
  const force1Label = P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirectionOnRod1];
  const force2Label = P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirectionOnRod2];
  const hasRelativeMotion = state.relativeMotionDirection !== 'none';
  const hasCurrent = state.currentDirection !== 'none';
  const forceLabel = hasCurrent ? `棒1${force1Label}，棒2${force2Label}` : '无明确方向';

  return [
    {
      key: 'relative-motion',
      title: '两棒相对运动',
      directionLabel: motionLabel,
      description: hasRelativeMotion
        ? `当前 v1 = ${state.velocity1.toFixed(3)} m/s，v2 = ${state.velocity2.toFixed(3)} m/s，所以相对速度 v1 - v2 = ${state.relativeVelocity.toFixed(3)} m/s（${motionLabel}）。`
        : '当前两棒速度几乎相等，已经接近“共速”状态，相对运动趋近于 0。',
      accentColor: ANALYSIS_ACCENTS['relative-motion'],
    },
    {
      key: 'emf',
      title: '感应电动势方向',
      directionLabel: emfLabel,
      description: hasRelativeMotion
        ? `按课堂口径 ε = BL(v1 - v2)，当前 ε = ${state.emf.toFixed(3)} V，因此电动势方向为${emfLabel}。`
        : '相对速度趋近 0 时，ε = BL(v1 - v2) 也趋近 0，不再有稳定方向。',
      accentColor: ANALYSIS_ACCENTS.emf,
    },
    {
      key: 'current',
      title: '回路电流方向',
      directionLabel: currentLabel,
      description: hasCurrent
        ? `总电阻 R总 = R1 + R2 = ${state.totalResistance.toFixed(3)} Ω，按 i = ε / R总 得到 i = ${state.current.toFixed(3)} A，回路电流为${currentLabel}。`
        : '当前 ε≈0，因此回路电流也衰减到接近 0。',
      accentColor: ANALYSIS_ACCENTS.current,
    },
    {
      key: 'ampere-force',
      title: '两棒安培力方向',
      directionLabel: forceLabel,
      description: hasCurrent
        ? `两棒受安培力大小相等、方向相反：F1 = ${state.ampereForceOnRod1.toFixed(3)} N，F2 = ${state.ampereForceOnRod2.toFixed(3)} N。它们共同抑制相对运动并推动系统向共速收敛。`
        : '无稳定电流时，安培力也随之消失；此后两棒保持相同速度匀速前进。',
      accentColor: ANALYSIS_ACCENTS['ampere-force'],
    },
  ];
}
