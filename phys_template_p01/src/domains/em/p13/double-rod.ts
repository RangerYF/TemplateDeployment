import type {
  P13DoubleRodAnalysisStep,
  P13DoubleRodFinalOutcome,
  P13DoubleRodFirstStopRod,
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
const FRICTION_MIN_DURATION = 1.2;
const FRICTION_MAX_DURATION = 240;
const CAPACITOR_MAX_DURATION = 60;
const STOP_VELOCITY_EPS = 1e-4;
const COMMON_SPEED_EPS = 1e-3;
const CURRENT_SETTLE_EPS = 1e-5;
const ROOT_TIME_EPS = 1e-7;
const ROOT_ITERATIONS = 48;
const GRAVITY = 9.8;

const ANALYSIS_ACCENTS = {
  'relative-motion': '#2563EB',
  emf: '#0EA5E9',
  current: '#F97316',
  'ampere-force': '#DC2626',
} as const;

export const P13_DOUBLE_ROD_BASIC_PRESET_ID = 'P13-EMI-021-double-rod-basic';
export const P13_DOUBLE_ROD_FRICTION_PRESET_ID = 'P13-EMI-022-double-rod-friction';
export const P13_DOUBLE_ROD_CAPACITOR_PRESET_ID = 'P13-EMI-023-double-rod-capacitor';
export const P13_DOUBLE_ROD_DRIVEN_PRESET_ID = 'P13-EMI-024-double-rod-driven';
export const P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS = 4;

export type P13DoubleRodParamKey =
  | 'magneticField'
  | 'railSpan'
  | 'mass1'
  | 'mass2'
  | 'rod1Resistance'
  | 'rod2Resistance'
  | 'initialVelocity1'
  | 'initialVelocity2'
  | 'externalForce1'
  | 'capacitance'
  | 'initialCapacitorVoltage'
  | 'frictionCoefficient1'
  | 'frictionCoefficient2';

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

interface DoubleRodInstantaneousState {
  time: number;
  position1: number;
  position2: number;
  velocity1: number;
  velocity2: number;
}

interface DoubleRodPhaseEvaluator {
  evaluateAt: (elapsed: number) => DoubleRodInstantaneousState;
  relativeVelocityAt: (elapsed: number) => number;
  velocity1At: (elapsed: number) => number;
  velocity2At: (elapsed: number) => number;
}

interface DoubleRodAdvanceStep {
  state: P13DoubleRodState;
  emittedSamples: P13DoubleRodState[];
  stopEvent: {
    rod: P13DoubleRodFirstStopRod;
    time: number;
  } | null;
  commonSpeedTime: number | null;
}

interface DoubleRodFrictionEvents {
  firstStopRod: P13DoubleRodFirstStopRod;
  firstStopTime: number | null;
  commonSpeedTime: number | null;
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
  'with-friction': {
    variant: 'with-friction',
    code: 'EMI-022',
    title: '双棒 + 摩擦',
    shortTitle: '双棒 + 摩擦',
    presetId: P13_DOUBLE_ROD_FRICTION_PRESET_ID,
    modelKey: P13_MODEL_KEYS.doubleRod,
    pageSubtitle:
      '在 EMI-021 的双棒耦合基础上，为两棒分别加入动摩擦：相对速度仍决定 ε 与 i，但终态还要比较两棒安培力与各自摩擦，可能出现先停棒、共速后再减速或最终双棒都停下。',
    currentFormula: 'i = BL(v1 - v2) / (R1 + R2)',
    topologyTitle: '双棒 + 动摩擦闭合回路',
    terminalHeadline: '终态由安培力耦合与两棒动摩擦共同决定',
    adoptedConvention:
      '沿用 EMI-021 约定：磁场垂直纸面向内，棒1在右、棒2在左，ε = BL(v1 - v2)，i = ε / (R1 + R2)，F1 = -F2 = BIL；同时两棒还分别受 f1 = μ1m1g、f2 = μ2m2g，方向始终阻碍各自运动。',
    visibleParamKeys: [
      'magneticField',
      'railSpan',
      'mass1',
      'mass2',
      'rod1Resistance',
      'rod2Resistance',
      'initialVelocity1',
      'initialVelocity2',
      'frictionCoefficient1',
      'frictionCoefficient2',
    ],
  },
  'with-capacitor': {
    variant: 'with-capacitor',
    code: 'EMI-023',
    title: '双棒 + 电容',
    shortTitle: '双棒 + 电容',
    presetId: P13_DOUBLE_ROD_CAPACITOR_PRESET_ID,
    modelKey: P13_MODEL_KEYS.doubleRod,
    pageSubtitle:
      '在双棒耦合回路中串入理想电容：相对速度先建立动生电动势，再由电容电压 Uc 逐步抵消回路驱动电压，最终满足 I → 0，但两棒未必共速。',
    currentFormula: 'i = (BL(v1 - v2) - Uc) / (R1 + R2)',
    topologyTitle: '双棒 + 理想电容闭合回路',
    terminalHeadline: '终态满足 I → 0，且 Uc = BL(v1 - v2)_final',
    adoptedConvention:
      '沿用 EMI-021 约定：磁场垂直纸面向内，棒1在右、棒2在左，ε = BL(v1 - v2)。回路中串联理想电容 C，并把 Uc 记作沿回路正方向的电压降，因此 i = [BL(v1 - v2) - Uc] / (R1 + R2)，F1 = -F2 = BIL，且 dUc/dt = i / C。',
    visibleParamKeys: [
      'magneticField',
      'railSpan',
      'mass1',
      'mass2',
      'rod1Resistance',
      'rod2Resistance',
      'initialVelocity1',
      'initialVelocity2',
      'capacitance',
      'initialCapacitorVoltage',
    ],
  },
  'with-external-force': {
    variant: 'with-external-force',
    code: 'EMI-024',
    title: '双棒 + 恒外力',
    shortTitle: '双棒 + 恒外力',
    presetId: P13_DOUBLE_ROD_DRIVEN_PRESET_ID,
    modelKey: P13_MODEL_KEYS.doubleRod,
    pageSubtitle:
      '在双棒耦合回路中，给棒1施加恒定外力：外力持续推动系统前进，安培力则不断把棒1的“超前速度”传给棒2，长期后两棒进入同加速度、固定速度差的课堂口径。',
    currentFormula: 'i = BL(v1 - v2) / (R1 + R2)',
    topologyTitle: '双棒 + 棒1受恒外力',
    terminalHeadline: '长期口径：两棒同加速度前进，且保留稳定速度差',
    adoptedConvention:
      '沿用 EMI-021 约定：磁场垂直纸面向内，棒1在右、棒2在左，ε = BL(v1 - v2)，i = ε / (R1 + R2)，F1 = -F2 = BIL。另在棒1上持续施加向右恒力 F外，用来驱动整个系统共同加速。',
    visibleParamKeys: [
      'magneticField',
      'railSpan',
      'mass1',
      'mass2',
      'rod1Resistance',
      'rod2Resistance',
      'initialVelocity1',
      'initialVelocity2',
      'externalForce1',
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
  externalForce1: { label: '棒1外力 F外', min: 0, max: 20, step: 0.1, unit: 'N' },
  capacitance: { label: '电容 C', min: 0.05, max: 5, step: 0.05, unit: 'F' },
  initialCapacitorVoltage: { label: '初始电容电压 Uc_0', min: -20, max: 20, step: 0.1, unit: 'V' },
  frictionCoefficient1: { label: '棒1摩擦系数 μ1', min: 0, max: 0.5, step: 0.01, unit: '' },
  frictionCoefficient2: { label: '棒2摩擦系数 μ2', min: 0, max: 0.5, step: 0.01, unit: '' },
} as const;

export const P13_DOUBLE_ROD_DEFAULT_PARAMS_BY_VARIANT: Record<
  P13DoubleRodVariant,
  P13DoubleRodParams
> = {
  'basic-frictionless': {
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
    frictionCoefficient1: 0,
    frictionCoefficient2: 0,
    externalForce1: 0,
    capacitance: 0.6,
    initialCapacitorVoltage: 0,
    initialSeparation: 1.2,
  },
  'with-friction': {
    variant: 'with-friction',
    magneticField: 0.8,
    magneticFieldDirection: 'into',
    railSpan: 0.5,
    mass1: 0.12,
    mass2: 0.08,
    rod1Resistance: 1.2,
    rod2Resistance: 1.8,
    initialVelocity1: 6,
    initialVelocity2: 1,
    frictionCoefficient1: 0.08,
    frictionCoefficient2: 0.08,
    externalForce1: 0,
    capacitance: 0.6,
    initialCapacitorVoltage: 0,
    initialSeparation: 1.2,
  },
  'with-capacitor': {
    variant: 'with-capacitor',
    magneticField: 0.8,
    magneticFieldDirection: 'into',
    railSpan: 0.5,
    mass1: 0.12,
    mass2: 0.08,
    rod1Resistance: 1.2,
    rod2Resistance: 1.8,
    initialVelocity1: 6,
    initialVelocity2: 1,
    frictionCoefficient1: 0,
    frictionCoefficient2: 0,
    externalForce1: 0,
    capacitance: 0.6,
    initialCapacitorVoltage: 0,
    initialSeparation: 1.2,
  },
  'with-external-force': {
    variant: 'with-external-force',
    magneticField: 0.8,
    magneticFieldDirection: 'into',
    railSpan: 0.5,
    mass1: 0.12,
    mass2: 0.08,
    rod1Resistance: 1.2,
    rod2Resistance: 1.8,
    initialVelocity1: 0,
    initialVelocity2: 0,
    frictionCoefficient1: 0,
    frictionCoefficient2: 0,
    externalForce1: 1.2,
    capacitance: 0.6,
    initialCapacitorVoltage: 0,
    initialSeparation: 1.2,
  },
};

export const P13_DOUBLE_ROD_DEFAULT_PARAMS: P13DoubleRodParams =
  P13_DOUBLE_ROD_DEFAULT_PARAMS_BY_VARIANT['basic-frictionless'];

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
  if (presetId === P13_DOUBLE_ROD_FRICTION_PRESET_ID) return 'with-friction';
  if (presetId === P13_DOUBLE_ROD_CAPACITOR_PRESET_ID) return 'with-capacitor';
  if (presetId === P13_DOUBLE_ROD_DRIVEN_PRESET_ID) return 'with-external-force';
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

function computeExternalForceOnRod1(params: P13DoubleRodParams): number {
  return params.variant === 'with-external-force' ? params.externalForce1 : 0;
}

function computeCouplingCoefficient(params: P13DoubleRodParams): number {
  const totalResistance = computeTotalResistance(params);
  if (totalResistance <= EPSILON) return 0;
  const bAbs = Math.abs(params.magneticField);
  return (bAbs * bAbs * params.railSpan * params.railSpan) / totalResistance;
}

function computeMotionalCoefficient(params: P13DoubleRodParams): number {
  return -resolveSignedFluxDensity(
    params.magneticField,
    params.magneticFieldDirection,
  ) * params.railSpan;
}

function computeDecayRate(params: P13DoubleRodParams): number {
  const coupling = computeCouplingCoefficient(params);
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

function computeAmpereForcePair(
  params: P13DoubleRodParams,
  velocity1: number,
  velocity2: number,
  capacitorVoltage = 0,
): {
  force1: number;
  force2: number;
  emf: number;
  netCircuitVoltage: number;
  current: number;
  totalResistance: number;
} {
  const totalResistance = computeTotalResistance(params);
  const signedFluxDensity = resolveSignedFluxDensity(
    params.magneticField,
    params.magneticFieldDirection,
  );
  const relativeVelocity = velocity1 - velocity2;
  const emf = computeMotionalEmf({
    signedFluxDensity,
    effectiveCutLength: params.railSpan,
    velocity: relativeVelocity,
  });
  const netCircuitVoltage =
    params.variant === 'with-capacitor'
      ? emf - capacitorVoltage
      : emf;
  const current = computeInducedCurrent({
    emf: netCircuitVoltage,
    resistance: totalResistance,
  });
  const force1 = current * params.railSpan * signedFluxDensity;
  return {
    force1,
    force2: -force1,
    emf,
    netCircuitVoltage,
    current,
    totalResistance,
  };
}

function computeRodFrictionForce(
  params: P13DoubleRodParams,
  velocity: number,
  mass: number,
  coefficient: number,
): number {
  if (params.variant !== 'with-friction') return 0;
  if (coefficient <= EPSILON) return 0;
  if (Math.abs(velocity) <= STOP_VELOCITY_EPS) return 0;
  return -(coefficient * mass * GRAVITY * Math.sign(velocity));
}

function buildStateFromInstantaneous(base: {
  params: P13DoubleRodParams;
  time: number;
  position1: number;
  position2: number;
  velocity1: number;
  velocity2: number;
  capacitorVoltage?: number;
}): P13DoubleRodState {
  const {
    params,
    time,
    position1,
    position2,
    velocity1: rawVelocity1,
    velocity2: rawVelocity2,
    capacitorVoltage: rawCapacitorVoltage,
  } = base;
  const velocity1 = Math.abs(rawVelocity1) <= EPSILON ? 0 : rawVelocity1;
  const velocity2 = Math.abs(rawVelocity2) <= EPSILON ? 0 : rawVelocity2;
  const capacitorVoltage =
    params.variant === 'with-capacitor' && Math.abs(rawCapacitorVoltage ?? 0) > EPSILON
      ? (rawCapacitorVoltage ?? 0)
      : 0;
  const separation = position1 - position2;
  const relativeVelocity = velocity1 - velocity2;
  const {
    force1,
    force2,
    emf,
    netCircuitVoltage,
    current,
    totalResistance,
  } = computeAmpereForcePair(
    params,
    velocity1,
    velocity2,
    capacitorVoltage,
  );
  const frictionForceOnRod1 = computeRodFrictionForce(
    params,
    velocity1,
    params.mass1,
    params.frictionCoefficient1,
  );
  const frictionForceOnRod2 = computeRodFrictionForce(
    params,
    velocity2,
    params.mass2,
    params.frictionCoefficient2,
  );
  const externalForceOnRod1 = computeExternalForceOnRod1(params);
  const externalForceOnRod2 = 0;
  const netForceOnRod1 = force1 + frictionForceOnRod1 + externalForceOnRod1;
  const netForceOnRod2 = force2 + frictionForceOnRod2;
  const acceleration1 = netForceOnRod1 / params.mass1;
  const acceleration2 = netForceOnRod2 / params.mass2;
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
    netCircuitVoltage,
    current,
    totalResistance,
    capacitorVoltage,
    capacitorCharge:
      params.variant === 'with-capacitor'
        ? params.capacitance * capacitorVoltage
        : 0,
    ampereForceOnRod1: force1,
    ampereForceOnRod2: force2,
    frictionForceOnRod1,
    frictionForceOnRod2,
    externalForceOnRod1,
    externalForceOnRod2,
    netForceOnRod1,
    netForceOnRod2,
    acceleration1,
    acceleration2,
    momentum,
    kineticEnergy,
    motionDirection1: resolveHorizontalDirection(velocity1),
    motionDirection2: resolveHorizontalDirection(velocity2),
    relativeMotionDirection: resolveHorizontalDirection(relativeVelocity),
    emfDirection: resolveVerticalDirection(emf),
    currentDirection: resolveLoopCurrentDirection(current),
    ampereForceDirectionOnRod1: resolveHorizontalDirection(force1),
    ampereForceDirectionOnRod2: resolveHorizontalDirection(force2),
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

function computeCapacitorDecayRate(params: P13DoubleRodParams): number {
  const totalResistance = computeTotalResistance(params);
  if (totalResistance <= EPSILON || params.capacitance <= EPSILON) return 0;
  const coupling = computeCouplingCoefficient(params);
  return (
    (
      coupling * ((1 / params.mass1) + (1 / params.mass2))
    ) + (1 / (params.capacitance * totalResistance))
  );
}

function computeCapacitorTimeConstant(params: P13DoubleRodParams): number {
  const decayRate = computeCapacitorDecayRate(params);
  return decayRate > EPSILON ? 1 / decayRate : Number.POSITIVE_INFINITY;
}

function computeCapacitorFinalRelativeVelocity(params: P13DoubleRodParams): number {
  const relativeVelocity0 = params.initialVelocity1 - params.initialVelocity2;
  const motionalCoefficient = computeMotionalCoefficient(params);
  const massFactor = (1 / params.mass1) + (1 / params.mass2);
  const numerator =
    relativeVelocity0 +
    (motionalCoefficient * params.capacitance * massFactor * params.initialCapacitorVoltage);
  const denominator =
    1 +
    (
      motionalCoefficient *
      motionalCoefficient *
      params.capacitance *
      massFactor
    );
  if (Math.abs(denominator) <= EPSILON) return relativeVelocity0;
  return numerator / denominator;
}

function buildCapacitorState(
  params: P13DoubleRodParams,
  time: number,
): P13DoubleRodState {
  const totalMass = params.mass1 + params.mass2;
  const terminalVelocity = computeTerminalVelocity(params);
  const initialRelativeVelocity = params.initialVelocity1 - params.initialVelocity2;
  const finalRelativeVelocity = computeCapacitorFinalRelativeVelocity(params);
  const decayRate = computeCapacitorDecayRate(params);
  const decayFactor = decayRate <= EPSILON ? 1 : Math.exp(-decayRate * time);
  const relativeVelocity =
    decayRate <= EPSILON
      ? initialRelativeVelocity
      : finalRelativeVelocity + ((initialRelativeVelocity - finalRelativeVelocity) * decayFactor);
  const relativeIntegral =
    decayRate <= EPSILON
      ? initialRelativeVelocity * time
      : (
        (finalRelativeVelocity * time) +
        (
          (initialRelativeVelocity - finalRelativeVelocity) *
          (1 - decayFactor) /
          decayRate
        )
      );
  const capacitorVoltage =
    decayRate <= EPSILON
      ? params.initialCapacitorVoltage
      : computeMotionalCoefficient(params) * finalRelativeVelocity +
        (
          params.initialCapacitorVoltage -
          (computeMotionalCoefficient(params) * finalRelativeVelocity)
        ) *
          decayFactor;
  const position1 =
    params.initialSeparation +
    (terminalVelocity * time) +
    ((params.mass2 / totalMass) * relativeIntegral);
  const position2 =
    (terminalVelocity * time) -
    ((params.mass1 / totalMass) * relativeIntegral);
  const velocity1 = terminalVelocity + ((params.mass2 / totalMass) * relativeVelocity);
  const velocity2 = terminalVelocity - ((params.mass1 / totalMass) * relativeVelocity);

  return buildStateFromInstantaneous({
    params,
    time,
    position1,
    position2,
    velocity1,
    velocity2,
    capacitorVoltage,
  });
}

function estimateSimulationDuration(timeConstant: number): number {
  if (!Number.isFinite(timeConstant)) return 6;
  return clamp(Math.max(MIN_DURATION, timeConstant * 7), MIN_DURATION, MAX_DURATION);
}

function estimateCapacitorSimulationDuration(timeConstant: number): number {
  if (!Number.isFinite(timeConstant)) return 6;
  return clamp(Math.max(MIN_DURATION, timeConstant * 8), MIN_DURATION, CAPACITOR_MAX_DURATION);
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

function chooseCapacitorTimeStep(duration: number, timeConstant: number): number {
  const durationStep = duration / 900;
  const tauStep = Number.isFinite(timeConstant) ? timeConstant / 160 : DEFAULT_TIME_STEP;
  return clamp(
    Math.min(DEFAULT_TIME_STEP, durationStep, tauStep),
    1e-4,
    1 / 30,
  );
}

function findCapacitorCommonSpeedTime(
  params: P13DoubleRodParams,
  duration: number,
): number | null {
  const initialRelativeVelocity = params.initialVelocity1 - params.initialVelocity2;
  if (Math.abs(initialRelativeVelocity) <= COMMON_SPEED_EPS) {
    return 0;
  }

  const finalRelativeVelocity = computeCapacitorFinalRelativeVelocity(params);
  if (Math.abs(finalRelativeVelocity) > COMMON_SPEED_EPS) {
    if (initialRelativeVelocity > COMMON_SPEED_EPS && finalRelativeVelocity > COMMON_SPEED_EPS) {
      return null;
    }
    if (initialRelativeVelocity < -COMMON_SPEED_EPS && finalRelativeVelocity < -COMMON_SPEED_EPS) {
      return null;
    }
  }

  const decayRate = computeCapacitorDecayRate(params);
  if (decayRate <= EPSILON) return null;
  const crossesZero =
    initialRelativeVelocity * finalRelativeVelocity < 0 ||
    Math.abs(finalRelativeVelocity) <= COMMON_SPEED_EPS;
  const target = crossesZero ? 0 : Math.sign(initialRelativeVelocity) * COMMON_SPEED_EPS;
  const denominator = initialRelativeVelocity - finalRelativeVelocity;
  if (Math.abs(denominator) <= EPSILON) return null;
  const ratio = (target - finalRelativeVelocity) / denominator;
  if (ratio < 0 || ratio > 1) return null;
  const time = -Math.log(Math.max(ratio, 1e-12)) / decayRate;
  return time <= duration + ROOT_TIME_EPS ? clamp(time, 0, duration) : null;
}

function pushSample(
  samples: P13DoubleRodState[],
  sample: P13DoubleRodState,
): void {
  const last = samples[samples.length - 1];
  if (!last) {
    samples.push(sample);
    return;
  }

  if (Math.abs(last.time - sample.time) <= ROOT_TIME_EPS * 10) {
    samples[samples.length - 1] = sample;
    return;
  }

  samples.push(sample);
}

function estimateFrictionSimulationDuration(params: P13DoubleRodParams): number {
  if (params.variant === 'with-external-force') {
    const timeConstant = computeTimeConstant(params);
    const commonAcceleration = computeExternalForceOnRod1(params) / (params.mass1 + params.mass2);
    const velocityScale = Math.max(
      Math.abs(params.initialVelocity1),
      Math.abs(params.initialVelocity2),
      1,
    );
    const accelerationWindow = commonAcceleration > EPSILON
      ? velocityScale / commonAcceleration
      : 0;
    return clamp(
      Math.max(4, timeConstant * 6.5, accelerationWindow * 1.4),
      4,
      18,
    );
  }
  const timeConstant = computeTimeConstant(params);
  const electromagneticWindow = Number.isFinite(timeConstant)
    ? Math.max(FRICTION_MIN_DURATION, timeConstant * 8)
    : 6;
  const positiveMus = [
    params.frictionCoefficient1,
    params.frictionCoefficient2,
  ].filter((value) => value > EPSILON);

  if (positiveMus.length === 0) {
    return clamp(electromagneticWindow, FRICTION_MIN_DURATION, FRICTION_MAX_DURATION);
  }

  const minPositiveMu = Math.min(...positiveMus);
  const speedScale = Math.max(
    Math.abs(params.initialVelocity1),
    Math.abs(params.initialVelocity2),
    Math.abs(computeTerminalVelocity(params)),
    1,
  );
  const frictionWindow = speedScale / (GRAVITY * minPositiveMu);
  return clamp(
    Math.max(FRICTION_MIN_DURATION, electromagneticWindow, frictionWindow * 1.25),
    FRICTION_MIN_DURATION,
    FRICTION_MAX_DURATION,
  );
}

function chooseFrictionTimeStep(duration: number): number {
  return clamp(duration / 1800, 1e-4, 0.08);
}

function resolveDynamicMotionSign(velocity: number, driveAcceleration: number): -1 | 0 | 1 {
  if (Math.abs(velocity) > STOP_VELOCITY_EPS) {
    return velocity > 0 ? 1 : -1;
  }
  if (Math.abs(driveAcceleration) <= EPSILON) {
    return 0;
  }
  return driveAcceleration > 0 ? 1 : -1;
}

function createFrictionPhaseEvaluator(
  params: P13DoubleRodParams,
  state: P13DoubleRodState,
  sign1: -1 | 0 | 1,
  sign2: -1 | 0 | 1,
): DoubleRodPhaseEvaluator {
  const totalMass = params.mass1 + params.mass2;
  const coupling = computeCouplingCoefficient(params);
  const alpha = coupling * ((1 / params.mass1) + (1 / params.mass2));
  const frictionAcceleration1 = params.frictionCoefficient1 * GRAVITY * sign1;
  const frictionAcceleration2 = params.frictionCoefficient2 * GRAVITY * sign2;
  const externalForceOnRod1 = computeExternalForceOnRod1(params);
  const externalAcceleration1 = externalForceOnRod1 / params.mass1;
  const delta = frictionAcceleration1 - frictionAcceleration2 - externalAcceleration1;
  const gamma =
    (params.mass1 * frictionAcceleration1) +
    (params.mass2 * frictionAcceleration2) -
    externalForceOnRod1;
  const initialMomentum = (params.mass1 * state.velocity1) + (params.mass2 * state.velocity2);
  const initialRelativeVelocity = state.velocity1 - state.velocity2;
  const shift = alpha > EPSILON ? delta / alpha : 0;

  const relativeVelocityAt = (elapsed: number) => {
    if (alpha <= EPSILON) {
      return initialRelativeVelocity - (delta * elapsed);
    }
    return (initialRelativeVelocity + shift) * Math.exp(-alpha * elapsed) - shift;
  };

  const momentumAt = (elapsed: number) => initialMomentum - (gamma * elapsed);

  const relativeVelocityIntegralAt = (elapsed: number) => {
    if (alpha <= EPSILON) {
      return (initialRelativeVelocity * elapsed) - (0.5 * delta * elapsed * elapsed);
    }
    return ((initialRelativeVelocity + shift) * (1 - Math.exp(-alpha * elapsed)) / alpha) - (shift * elapsed);
  };

  const evaluateAt = (elapsed: number): DoubleRodInstantaneousState => {
    const relativeVelocity = relativeVelocityAt(elapsed);
    const momentum = momentumAt(elapsed);
    const velocity1 = (momentum + (params.mass2 * relativeVelocity)) / totalMass;
    const velocity2 = (momentum - (params.mass1 * relativeVelocity)) / totalMass;
    const centerDisplacement =
      ((initialMomentum / totalMass) * elapsed) -
      ((gamma / totalMass) * 0.5 * elapsed * elapsed);
    const relativeDisplacement = relativeVelocityIntegralAt(elapsed);

    return {
      time: state.time + elapsed,
      position1: state.position1 + centerDisplacement + ((params.mass2 / totalMass) * relativeDisplacement),
      position2: state.position2 + centerDisplacement - ((params.mass1 / totalMass) * relativeDisplacement),
      velocity1,
      velocity2,
    };
  };

  return {
    evaluateAt,
    relativeVelocityAt,
    velocity1At: (elapsed: number) => evaluateAt(elapsed).velocity1,
    velocity2At: (elapsed: number) => evaluateAt(elapsed).velocity2,
  };
}

function solveZeroCrossing(
  evaluate: (elapsed: number) => number,
  left: number,
  right: number,
): number {
  let lo = left;
  let hi = right;
  let fLo = evaluate(lo);
  let fHi = evaluate(hi);

  if (Math.abs(fLo) <= EPSILON) return lo;
  if (Math.abs(fHi) <= EPSILON) return hi;

  for (let index = 0; index < ROOT_ITERATIONS; index += 1) {
    const mid = (lo + hi) * 0.5;
    const fMid = evaluate(mid);
    if (Math.abs(fMid) <= EPSILON || (hi - lo) <= ROOT_TIME_EPS) {
      return mid;
    }
    if ((fLo > 0 && fMid > 0) || (fLo < 0 && fMid < 0)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
      fHi = fMid;
    }
  }

  return Math.abs(fLo) < Math.abs(fHi) ? lo : hi;
}

function advanceFrictionState(
  params: P13DoubleRodParams,
  startState: P13DoubleRodState,
  dt: number,
): DoubleRodAdvanceStep {
  let remaining = dt;
  let state = startState;
  const emittedSamples: P13DoubleRodState[] = [];
  let firstStopEvent: DoubleRodAdvanceStep['stopEvent'] = null;
  let commonSpeedTime: number | null =
    Math.abs(startState.relativeVelocity) <= COMMON_SPEED_EPS ? startState.time : null;

  while (remaining > ROOT_TIME_EPS) {
    const driveForces = computeAmpereForcePair(params, state.velocity1, state.velocity2);
    const sign1 = resolveDynamicMotionSign(
      state.velocity1,
      (driveForces.force1 + computeExternalForceOnRod1(params)) / params.mass1,
    );
    const sign2 = resolveDynamicMotionSign(state.velocity2, driveForces.force2 / params.mass2);

    if (
      computeExternalForceOnRod1(params) <= EPSILON &&
      sign1 === 0 &&
      sign2 === 0 &&
      Math.abs(state.current) <= CURRENT_SETTLE_EPS
    ) {
      state = buildStateFromInstantaneous({
        params,
        time: state.time + remaining,
        position1: state.position1,
        position2: state.position2,
        velocity1: 0,
        velocity2: 0,
      });
      pushSample(emittedSamples, state);
      break;
    }

    const evaluator = createFrictionPhaseEvaluator(params, state, sign1, sign2);
    const provisional = evaluator.evaluateAt(remaining);
    const provisionalState = buildStateFromInstantaneous({
      params,
      ...provisional,
    });

    const stopCandidates: Array<{ rod: 'rod1' | 'rod2'; elapsed: number }> = [];
    let commonSpeedElapsed: number | null = null;

    if (commonSpeedTime == null) {
      if (state.relativeVelocity * provisionalState.relativeVelocity < 0) {
        commonSpeedElapsed = solveZeroCrossing(
          evaluator.relativeVelocityAt,
          0,
          remaining,
        );
      } else if (Math.abs(provisionalState.relativeVelocity) <= COMMON_SPEED_EPS) {
        commonSpeedElapsed = remaining;
      }
    }

    if (
      sign1 !== 0 &&
      (state.velocity1 * sign1) > STOP_VELOCITY_EPS &&
      (provisionalState.velocity1 * sign1) <= 0
    ) {
      stopCandidates.push({
        rod: 'rod1',
        elapsed: solveZeroCrossing(evaluator.velocity1At, 0, remaining),
      });
    }

    if (
      sign2 !== 0 &&
      (state.velocity2 * sign2) > STOP_VELOCITY_EPS &&
      (provisionalState.velocity2 * sign2) <= 0
    ) {
      stopCandidates.push({
        rod: 'rod2',
        elapsed: solveZeroCrossing(evaluator.velocity2At, 0, remaining),
      });
    }

    const candidateTimes = [
      ...(commonSpeedElapsed == null ? [] : [commonSpeedElapsed]),
      ...stopCandidates.map((candidate) => candidate.elapsed),
    ];

    if (candidateTimes.length === 0) {
      state = provisionalState;
      pushSample(emittedSamples, state);
      break;
    }

    const earliestElapsed = Math.min(...candidateTimes);
    const simultaneous = stopCandidates.filter(
      (candidate) => Math.abs(candidate.elapsed - earliestElapsed) <= ROOT_TIME_EPS * 10,
    );
    const includesCommonSpeed =
      commonSpeedElapsed != null &&
      Math.abs(commonSpeedElapsed - earliestElapsed) <= ROOT_TIME_EPS * 10;
    const eventInstant = evaluator.evaluateAt(earliestElapsed);
    const eventMomentum =
      (params.mass1 * eventInstant.velocity1) + (params.mass2 * eventInstant.velocity2);
    const commonVelocity = eventMomentum / (params.mass1 + params.mass2);

    state = buildStateFromInstantaneous({
      params,
      time: eventInstant.time,
      position1: eventInstant.position1,
      position2: eventInstant.position2,
      velocity1: simultaneous.some((candidate) => candidate.rod === 'rod1')
        ? 0
        : includesCommonSpeed
          ? commonVelocity
          : eventInstant.velocity1,
      velocity2: simultaneous.some((candidate) => candidate.rod === 'rod2')
        ? 0
        : includesCommonSpeed
          ? commonVelocity
          : eventInstant.velocity2,
    });
    pushSample(emittedSamples, state);

    if (firstStopEvent == null && simultaneous.length > 0) {
      firstStopEvent = {
        rod:
          simultaneous.length === 2
            ? 'simultaneous'
            : simultaneous[0]!.rod,
        time: state.time,
      };
    }

    if (commonSpeedTime == null && includesCommonSpeed) {
      commonSpeedTime = state.time;
    }

    remaining -= earliestElapsed;
    if (remaining <= ROOT_TIME_EPS) {
      break;
    }
  }

  return {
    state,
    emittedSamples,
    stopEvent: firstStopEvent,
    commonSpeedTime,
  };
}

function hasAnyFriction(params: P13DoubleRodParams): boolean {
  return (
    (params.variant === 'with-friction' || params.variant === 'with-external-force') &&
    (
      params.frictionCoefficient1 > EPSILON ||
      params.frictionCoefficient2 > EPSILON
    )
  );
}

function isFrictionSimulationSettled(
  params: P13DoubleRodParams,
  state: P13DoubleRodState,
): boolean {
  if (params.variant === 'with-external-force') {
    return false;
  }
  if (!hasAnyFriction(params)) {
    return (
      Math.abs(state.relativeVelocity) <= COMMON_SPEED_EPS &&
      Math.abs(state.current) <= CURRENT_SETTLE_EPS
    );
  }

  return (
    Math.abs(state.velocity1) <= STOP_VELOCITY_EPS &&
    Math.abs(state.velocity2) <= STOP_VELOCITY_EPS &&
    Math.abs(state.current) <= CURRENT_SETTLE_EPS
  );
}

function computeBasicSummary(
  params: P13DoubleRodParams,
): P13DoubleRodSimulationResult['summary'] {
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
  const terminalVelocity = computeTerminalVelocity(params);

  return {
    totalResistance,
    timeConstant: computeTimeConstant(params),
    initialCurrent,
    initialMomentum:
      (params.mass1 * params.initialVelocity1) + (params.mass2 * params.initialVelocity2),
    theoreticalTerminalVelocity: terminalVelocity,
    theoreticalTerminalCurrent: 0,
    finalVelocity1: terminalVelocity,
    finalVelocity2: terminalVelocity,
    finalCurrent: 0,
    finalCapacitorVoltage: 0,
    firstStopRod: 'none',
    firstStopTime: null,
    enteredCommonSpeed: true,
    commonSpeedTime: null,
    finalOutcome: 'common-speed-glide',
    terminalExplanation:
      '双棒回路中，安培力始终等大反向并只消耗相对运动；系统总动量守恒，长期后两棒速度收敛到同一共速 v_terminal = (m1v1_0 + m2v2_0) / (m1 + m2)。当相对速度降为 0 时，ε 与 i 都衰减到 0。',
    simplificationNote:
      'EMI-021 采用课堂解析解：忽略摩擦、自感与接触电阻变化，只保留 ε = BL(v1-v2)、i = ε/(R1+R2) 与 F1 = -F2 = BIL 的耦合。',
    adoptedConvention: meta.adoptedConvention,
  };
}

function resolveFrictionFinalOutcome(
  params: P13DoubleRodParams,
  finalState: P13DoubleRodState,
  events: DoubleRodFrictionEvents,
): P13DoubleRodFinalOutcome {
  const bothStopped =
    Math.abs(finalState.velocity1) <= STOP_VELOCITY_EPS &&
    Math.abs(finalState.velocity2) <= STOP_VELOCITY_EPS;
  const commonSpeedReached = events.commonSpeedTime != null;
  const noFriction = !hasAnyFriction(params);

  if (bothStopped && commonSpeedReached) return 'common-speed-then-stop';
  if (bothStopped && events.firstStopRod !== 'none') return 'single-rod-stop-then-stop';
  if (bothStopped) return 'both-stopped';
  if (
    noFriction &&
    Math.abs(finalState.relativeVelocity) <= COMMON_SPEED_EPS &&
    Math.abs(finalState.current) <= CURRENT_SETTLE_EPS
  ) {
    return 'common-speed-glide';
  }
  return 'observation-window-end';
}

function buildFrictionTerminalExplanation(
  events: DoubleRodFrictionEvents,
  outcome: P13DoubleRodFinalOutcome,
): string {
  const firstStopText =
    events.firstStopRod === 'rod1'
      ? '棒1先减到 0'
      : events.firstStopRod === 'rod2'
        ? '棒2先减到 0'
        : events.firstStopRod === 'simultaneous'
          ? '两棒在同一阶段同时减到 0'
          : '两棒都没有在相对运动阶段先停下';
  const commonSpeedText = events.commonSpeedTime == null
    ? '本组参数下没有进入明显的共速阶段。'
    : `系统在 t≈${events.commonSpeedTime.toFixed(3)} s 时进入 v1≈v2、i≈0 的共速阶段。`;

  switch (outcome) {
    case 'common-speed-then-stop':
      return `${commonSpeedText} 随后回路电流几乎消失，两棒主要受各自动摩擦继续减速，最终都停下。${firstStopText}。`;
    case 'single-rod-stop-then-stop':
      return `${firstStopText}。在此之后另一根棒仍可能带着回路电流继续运动，并通过安培力重新分配速度；但总机械能持续被摩擦耗散，所以最终两棒都停下。`;
    case 'both-stopped':
      return '两棒都在摩擦耗散下停下，终态满足 v1 = v2 = 0、ε = 0、i = 0。';
    case 'common-speed-glide':
      return '当前参数下两棒没有摩擦，系统退化为 EMI-021：相对速度衰减后进入共速滑行，电流最终衰减到 0。';
    case 'observation-window-end':
    default:
      return `${commonSpeedText} 当前观测窗末端仍存在可见运动或极小残余速度差；课堂终态仍由“安培力先抑制相对运动，摩擦继续耗散机械能”决定。`;
  }
}

function computeFrictionSummary(
  params: P13DoubleRodParams,
  samples: readonly P13DoubleRodState[],
  events: DoubleRodFrictionEvents,
): P13DoubleRodSimulationResult['summary'] {
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
  const finalState = samples[samples.length - 1] ?? buildStateFromInstantaneous({
    params,
    time: 0,
    position1: params.initialSeparation,
    position2: 0,
    velocity1: params.initialVelocity1,
    velocity2: params.initialVelocity2,
  });
  const noFriction = !hasAnyFriction(params);
  const outcome = resolveFrictionFinalOutcome(params, finalState, events);

  return {
    totalResistance,
    timeConstant: computeTimeConstant(params),
    initialCurrent,
    initialMomentum:
      (params.mass1 * params.initialVelocity1) + (params.mass2 * params.initialVelocity2),
    theoreticalTerminalVelocity: noFriction ? computeTerminalVelocity(params) : 0,
    theoreticalTerminalCurrent: 0,
    finalVelocity1: finalState.velocity1,
    finalVelocity2: finalState.velocity2,
    finalCurrent: finalState.current,
    finalCapacitorVoltage: 0,
    firstStopRod: events.firstStopRod,
    firstStopTime: events.firstStopTime,
    enteredCommonSpeed: events.commonSpeedTime != null,
    commonSpeedTime: events.commonSpeedTime,
    finalOutcome: outcome,
    terminalExplanation: buildFrictionTerminalExplanation(events, outcome),
    simplificationNote:
      'EMI-022 采用课堂理想化双棒 + 动摩擦模型：磁场匀强、导轨理想、忽略自感和接触电阻变化；求解时按速度符号分段推进，棒速过零时视为阶段切换点。',
    adoptedConvention: meta.adoptedConvention,
  };
}

function buildCapacitorTerminalExplanation(
  finalState: P13DoubleRodState,
  commonSpeedTime: number | null,
): string {
  const finalRelativeVelocity = finalState.relativeVelocity;
  if (Math.abs(finalRelativeVelocity) <= COMMON_SPEED_EPS) {
    return '当前参数下，电容最终没有保留明显电压，系统收敛到 v1 ≈ v2、I ≈ 0 的近共速终态；此时 Uc 与 ε 都接近 0。';
  }

  if (commonSpeedTime != null) {
    return `系统在 t≈${commonSpeedTime.toFixed(3)} s 时一度进入 v1≈v2、I≈0 的共速附近；随后由于电容储存的电能继续参与回路调整，最终仍满足 I→0，但保留 Δv_final ≈ ${finalRelativeVelocity.toFixed(3)} m/s，且 Uc_final = BL·Δv_final。`;
  }

  return `电容逐步充电，使回路净驱动电压 ε - Uc 衰减到 0；因此虽然最终 I→0，但系统仍保留 Δv_final ≈ ${finalRelativeVelocity.toFixed(3)} m/s。终态不是“必须共速”，而是满足 Uc_final = BL(v1 - v2)_final。`;
}

function computeCapacitorSummary(
  params: P13DoubleRodParams,
  samples: readonly P13DoubleRodState[],
  commonSpeedTime: number | null,
): P13DoubleRodSimulationResult['summary'] {
  const meta = getDoubleRodVariantMeta(params.variant);
  const totalResistance = computeTotalResistance(params);
  const motionalCoefficient = computeMotionalCoefficient(params);
  const initialRelativeVelocity = params.initialVelocity1 - params.initialVelocity2;
  const finalRelativeVelocity = computeCapacitorFinalRelativeVelocity(params);
  const finalState = samples[samples.length - 1] ?? buildCapacitorState(params, 0);
  const finalCapacitorVoltage = motionalCoefficient * finalRelativeVelocity;
  const finalOutcome =
    Math.abs(finalRelativeVelocity) <= COMMON_SPEED_EPS
      ? 'current-zero-common-speed'
      : 'current-zero-separated-drift';

  return {
    totalResistance,
    timeConstant: computeCapacitorTimeConstant(params),
    initialCurrent: (motionalCoefficient * initialRelativeVelocity - params.initialCapacitorVoltage) / totalResistance,
    initialMomentum:
      (params.mass1 * params.initialVelocity1) + (params.mass2 * params.initialVelocity2),
    theoreticalTerminalVelocity: computeTerminalVelocity(params),
    theoreticalTerminalCurrent: 0,
    finalVelocity1:
      computeTerminalVelocity(params) +
      (((params.mass2 / (params.mass1 + params.mass2)) * finalRelativeVelocity)),
    finalVelocity2:
      computeTerminalVelocity(params) -
      (((params.mass1 / (params.mass1 + params.mass2)) * finalRelativeVelocity)),
    finalCurrent: 0,
    finalCapacitorVoltage,
    firstStopRod: 'none',
    firstStopTime: null,
    enteredCommonSpeed: commonSpeedTime != null,
    commonSpeedTime,
    finalOutcome,
    terminalExplanation: buildCapacitorTerminalExplanation(finalState, commonSpeedTime),
    simplificationNote:
      'EMI-023 采用课堂理想化“双棒 + 理想电容”模型：忽略摩擦、自感与接触电阻变化，只保留 ε = BL(v1-v2)、i = [BL(v1-v2)-Uc] / (R1+R2)、F1 = -F2 = BIL 与 dUc/dt = i / C 的耦合。',
    adoptedConvention: meta.adoptedConvention,
  };
}

export function normalizeDoubleRodParams(
  variant: P13DoubleRodVariant,
  input?: Partial<P13DoubleRodParams>,
): P13DoubleRodParams {
  const fallback = P13_DOUBLE_ROD_DEFAULT_PARAMS_BY_VARIANT[variant];
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
    externalForce1: clamp(
      readFiniteNumber(input?.externalForce1, fallback.externalForce1),
      P13_DOUBLE_ROD_PARAM_CONFIG.externalForce1.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.externalForce1.max,
    ),
    capacitance: clamp(
      readFiniteNumber(input?.capacitance, fallback.capacitance),
      P13_DOUBLE_ROD_PARAM_CONFIG.capacitance.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.capacitance.max,
    ),
    initialCapacitorVoltage: clamp(
      readFiniteNumber(input?.initialCapacitorVoltage, fallback.initialCapacitorVoltage),
      P13_DOUBLE_ROD_PARAM_CONFIG.initialCapacitorVoltage.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.initialCapacitorVoltage.max,
    ),
    frictionCoefficient1: clamp(
      readFiniteNumber(input?.frictionCoefficient1, fallback.frictionCoefficient1),
      P13_DOUBLE_ROD_PARAM_CONFIG.frictionCoefficient1.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.frictionCoefficient1.max,
    ),
    frictionCoefficient2: clamp(
      readFiniteNumber(input?.frictionCoefficient2, fallback.frictionCoefficient2),
      P13_DOUBLE_ROD_PARAM_CONFIG.frictionCoefficient2.min,
      P13_DOUBLE_ROD_PARAM_CONFIG.frictionCoefficient2.max,
    ),
    initialSeparation: Math.max(
      0.2,
      readFiniteNumber(input?.initialSeparation, fallback.initialSeparation),
    ),
  };
}

function simulateFrictionVariant(
  params: P13DoubleRodParams,
): P13DoubleRodSimulationResult {
  const durationCap = estimateFrictionSimulationDuration(params);
  const timeStep = chooseFrictionTimeStep(durationCap);
  const initialState = buildStateFromInstantaneous({
    params,
    time: 0,
    position1: params.initialSeparation,
    position2: 0,
    velocity1: params.initialVelocity1,
    velocity2: params.initialVelocity2,
  });

  const samples: P13DoubleRodState[] = [initialState];
  const events: DoubleRodFrictionEvents = {
    firstStopRod: 'none',
    firstStopTime: null,
    commonSpeedTime:
      Math.abs(initialState.relativeVelocity) <= COMMON_SPEED_EPS
        ? 0
        : null,
  };

  let state = initialState;
  while (state.time < durationCap - ROOT_TIME_EPS) {
    const step = Math.min(timeStep, durationCap - state.time);
    const advanced = advanceFrictionState(params, state, step);
    state = advanced.state;
    advanced.emittedSamples.forEach((sample) => pushSample(samples, sample));

    if (events.firstStopRod === 'none' && advanced.stopEvent) {
      events.firstStopRod = advanced.stopEvent.rod;
      events.firstStopTime = advanced.stopEvent.time;
    }

    if (events.commonSpeedTime == null && advanced.commonSpeedTime != null) {
      events.commonSpeedTime = advanced.commonSpeedTime;
    }

    if (isFrictionSimulationSettled(params, state)) {
      break;
    }
  }

  return {
    modelKey: P13_MODEL_KEYS.doubleRod,
    variant: params.variant,
    params,
    duration: state.time,
    timeStep,
    samples,
    summary: computeFrictionSummary(params, samples, events),
  };
}

function computeDrivenSummary(
  params: P13DoubleRodParams,
  samples: readonly P13DoubleRodState[],
): P13DoubleRodSimulationResult['summary'] {
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
  const finalState = samples[samples.length - 1] ?? buildStateFromInstantaneous({
    params,
    time: 0,
    position1: params.initialSeparation,
    position2: 0,
    velocity1: params.initialVelocity1,
    velocity2: params.initialVelocity2,
  });
  const alpha = computeDecayRate(params);
  const externalAcceleration1 = computeExternalForceOnRod1(params) / params.mass1;
  const theoreticalRelativeVelocity = alpha > EPSILON ? externalAcceleration1 / alpha : 0;
  const theoreticalCommonAcceleration =
    computeExternalForceOnRod1(params) / (params.mass1 + params.mass2);
  const theoreticalCurrent = computeInducedCurrent({
    emf: computeMotionalEmf({
      signedFluxDensity,
      effectiveCutLength: params.railSpan,
      velocity: theoreticalRelativeVelocity,
    }),
    resistance: totalResistance,
  });

  return {
    totalResistance,
    timeConstant: computeTimeConstant(params),
    initialCurrent,
    initialMomentum:
      (params.mass1 * params.initialVelocity1) + (params.mass2 * params.initialVelocity2),
    theoreticalTerminalVelocity: 0,
    theoreticalTerminalCurrent: theoreticalCurrent,
    finalVelocity1: finalState.velocity1,
    finalVelocity2: finalState.velocity2,
    finalCurrent: finalState.current,
    finalCapacitorVoltage: 0,
    firstStopRod: 'none',
    firstStopTime: null,
    enteredCommonSpeed: false,
    commonSpeedTime: null,
    finalOutcome: 'driven-common-acceleration',
    theoreticalRelativeVelocity,
    theoreticalCommonAcceleration,
    terminalExplanation:
      '棒1持续受恒外力推动，系统总动量不再守恒；安培力不断把棒1的“超前速度”传给棒2。经过暂态后，两棒会进入“同加速度前进、但保留稳定速度差”的课堂口径，此时回路中仍有稳定感应电流。',
    simplificationNote:
      'EMI-024 采用课堂理想化“双棒 + 棒1受恒外力”模型：忽略摩擦、自感与接触电阻变化，只保留恒外力、动生电动势、电流与两棒安培力耦合。',
    adoptedConvention: meta.adoptedConvention,
  };
}

function simulateDrivenVariant(
  params: P13DoubleRodParams,
): P13DoubleRodSimulationResult {
  const durationCap = estimateFrictionSimulationDuration(params);
  const timeStep = chooseFrictionTimeStep(durationCap);
  const initialState = buildStateFromInstantaneous({
    params,
    time: 0,
    position1: params.initialSeparation,
    position2: 0,
    velocity1: params.initialVelocity1,
    velocity2: params.initialVelocity2,
  });

  const samples: P13DoubleRodState[] = [initialState];
  let state = initialState;
  while (state.time < durationCap - ROOT_TIME_EPS) {
    const step = Math.min(timeStep, durationCap - state.time);
    const advanced = advanceFrictionState(params, state, step);
    state = advanced.state;
    advanced.emittedSamples.forEach((sample) => pushSample(samples, sample));
  }

  return {
    modelKey: P13_MODEL_KEYS.doubleRod,
    variant: params.variant,
    params,
    duration: state.time,
    timeStep,
    samples,
    summary: computeDrivenSummary(params, samples),
  };
}

function simulateCapacitorVariant(
  params: P13DoubleRodParams,
): P13DoubleRodSimulationResult {
  const timeConstant = computeCapacitorTimeConstant(params);
  const duration = estimateCapacitorSimulationDuration(timeConstant);
  const timeStep = chooseCapacitorTimeStep(duration, timeConstant);
  const commonSpeedTime = findCapacitorCommonSpeedTime(params, duration);
  const samples: P13DoubleRodState[] = [];

  const extraTimes = commonSpeedTime == null ? [] : [commonSpeedTime];
  for (let time = 0; time <= duration + (timeStep * 0.5); time += timeStep) {
    const clampedTime = Math.min(time, duration);
    pushSample(samples, buildCapacitorState(params, clampedTime));
    extraTimes.forEach((eventTime) => {
      if (
        eventTime > clampedTime + ROOT_TIME_EPS &&
        eventTime < Math.min(duration, clampedTime + timeStep) - ROOT_TIME_EPS
      ) {
        pushSample(samples, buildCapacitorState(params, eventTime));
      }
    });
    if (clampedTime >= duration) break;
  }

  const finalSample = samples[samples.length - 1] ?? buildCapacitorState(params, duration);
  return {
    modelKey: P13_MODEL_KEYS.doubleRod,
    variant: params.variant,
    params,
    duration: finalSample.time,
    timeStep,
    samples,
    summary: computeCapacitorSummary(params, samples, commonSpeedTime),
  };
}

export function simulateDoubleRodModel(
  variant: P13DoubleRodVariant,
  input?: Partial<P13DoubleRodParams>,
): P13DoubleRodSimulationResult {
  const params = normalizeDoubleRodParams(variant, input);

  if (variant === 'with-friction') {
    return simulateFrictionVariant(params);
  }

  if (variant === 'with-external-force') {
    return simulateDrivenVariant(params);
  }

  if (variant === 'with-capacitor') {
    return simulateCapacitorVariant(params);
  }

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
    summary: computeBasicSummary(params),
  };
}

export function sampleDoubleRodStateAtTime(
  result: P13DoubleRodSimulationResult,
  time: number,
): P13DoubleRodState {
  const clampedTime = clamp(time, 0, result.duration);
  if (result.variant === 'basic-frictionless') {
    return buildDoubleRodState({
      params: result.params,
      time: clampedTime,
      terminalVelocity: computeTerminalVelocity(result.params),
      initialRelativeVelocity: result.params.initialVelocity1 - result.params.initialVelocity2,
      decayRate: computeDecayRate(result.params),
    });
  }
  if (result.variant === 'with-capacitor') {
    return buildCapacitorState(result.params, clampedTime);
  }

  const { samples } = result;
  if (samples.length === 0) {
    return buildStateFromInstantaneous({
      params: result.params,
      time: clampedTime,
      position1: result.params.initialSeparation,
      position2: 0,
      velocity1: result.params.initialVelocity1,
      velocity2: result.params.initialVelocity2,
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
  const motionLabel = P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.relativeMotionDirection];
  const emfLabel = P13_DOUBLE_ROD_VERTICAL_DIRECTION_LABELS[state.emfDirection];
  const currentLabel = P13_DOUBLE_ROD_CURRENT_DIRECTION_LABELS[state.currentDirection];
  const force1Label = P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirectionOnRod1];
  const force2Label = P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirectionOnRod2];
  const hasRelativeMotion = state.relativeMotionDirection !== 'none';
  const hasCurrent = state.currentDirection !== 'none';
  const forceLabel = hasCurrent ? `棒1${force1Label}，棒2${force2Label}` : '无明确方向';
  const withFriction = result.variant === 'with-friction';
  const withCapacitor = result.variant === 'with-capacitor';
  const withExternalForce = result.variant === 'with-external-force';
  const frictionTail = withFriction
    ? ` 同时还要叠加各自阻碍运动的摩擦力：f1 = ${Math.abs(state.frictionForceOnRod1).toFixed(3)} N，f2 = ${Math.abs(state.frictionForceOnRod2).toFixed(3)} N。`
    : '';

  return [
    {
      key: 'relative-motion',
      title: '两棒相对运动',
      directionLabel: motionLabel,
      description: hasRelativeMotion
        ? `当前 v1 = ${state.velocity1.toFixed(3)} m/s，v2 = ${state.velocity2.toFixed(3)} m/s，所以相对速度 v1 - v2 = ${state.relativeVelocity.toFixed(3)} m/s（${motionLabel}）。`
        : withExternalForce
          ? '当前两棒已经进入接近“同加速度前进”的阶段，速度差变化很慢，相对运动主要表现为稳定速度差而不是继续向 0 收敛。'
        : withFriction
          ? '当前两棒速度已经非常接近，回路中的相对运动几乎消失，系统处在“共速或双停”附近。'
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
        ? withCapacitor
          ? `总电阻 R总 = R1 + R2 = ${state.totalResistance.toFixed(3)} Ω，当前 ε = ${state.emf.toFixed(3)} V、Uc = ${state.capacitorVoltage.toFixed(3)} V，所以净驱动电压 ε - Uc = ${state.netCircuitVoltage.toFixed(3)} V，按 i = (ε - Uc) / R总 得到 i = ${state.current.toFixed(3)} A，回路电流为${currentLabel}。`
          : `总电阻 R总 = R1 + R2 = ${state.totalResistance.toFixed(3)} Ω，按 i = ε / R总 得到 i = ${state.current.toFixed(3)} A，回路电流为${currentLabel}。`
        : withExternalForce
          ? '当前速度差已经很小，动生电动势和回路电流都接近稳定值；只要棒1外力仍在，系统就会维持一段非零电流来把外力传给棒2。'
        : withCapacitor
          ? '当前 ε 与 Uc 已基本平衡，因此回路净驱动电压接近 0，电流也衰减到接近 0。'
          : '当前 ε≈0，因此回路电流也衰减到接近 0。',
      accentColor: ANALYSIS_ACCENTS.current,
    },
    {
      key: 'ampere-force',
      title: '两棒安培力方向',
      directionLabel: forceLabel,
      description: hasCurrent
        ? withExternalForce
          ? `两棒受安培力大小相等、方向相反：F1 = ${state.ampereForceOnRod1.toFixed(3)} N，F2 = ${state.ampereForceOnRod2.toFixed(3)} N。与此同时，棒1还额外受恒外力 F外 = ${state.externalForceOnRod1.toFixed(3)} N 向右推动，所以安培力会持续把这股驱动传给棒2，并把系统带入同加速度前进。`
          : `两棒受安培力大小相等、方向相反：F1 = ${state.ampereForceOnRod1.toFixed(3)} N，F2 = ${state.ampereForceOnRod2.toFixed(3)} N。它们共同抑制相对运动并推动系统向共速收敛。${frictionTail}`.trim()
        : withFriction
          ? '无稳定电流时，安培力暂时消失；此后若两棒仍在滑动，主要由各自摩擦继续减速。若两棒摩擦不同，后续还可能再次出现极小相对速度。'
          : withCapacitor
            ? '当 ε 与 Uc 平衡后，回路电流衰减到接近 0，安培力也随之消失；此时系统是否共速，要由动量守恒与电容最终电压共同决定，并不强制 v1 = v2。'
          : withExternalForce
            ? '若速度差已经稳定，棒1外力与安培力会进入新的动态平衡：安培力不再把相对速度继续压到 0，而是维持一个稳定速度差，让两棒保持同加速度前进。'
            : '无稳定电流时，安培力也随之消失；此后两棒保持相同速度匀速前进。',
      accentColor: ANALYSIS_ACCENTS['ampere-force'],
    },
  ];
}
