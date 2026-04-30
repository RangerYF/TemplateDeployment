import type {
  P13HorizontalDirection,
  P13LoopCurrentDirection,
  P13SingleRodAnalysisStep,
  P13SingleRodParams,
  P13SingleRodSimulationResult,
  P13SingleRodState,
  P13SingleRodVariant,
  P13VerticalDirection,
} from './types';
import { P13_MODEL_KEYS } from './types';
import {
  computeInducedCurrent,
  computeMotionalEmf,
  computeSeriesCircuitVoltage,
  microFaradToFarad,
  resolveSignedFluxDensity,
} from './core';

const EPSILON = 1e-6;
const DEFAULT_TIME_STEP = 1 / 120;
const MIN_RESISTIVE_DURATION = 2.4;
const MIN_SOURCE_DURATION = 2.4;
const MIN_CAPACITOR_DURATION = 0.0004;
const MAX_DURATION = 20;

const ANALYSIS_ACCENTS = {
  velocity: '#2563EB',
  emf: '#0EA5E9',
  current: '#F97316',
  'ampere-force': '#DC2626',
} as const;

export const P13_SINGLE_ROD_RESISTIVE_PRESET_ID = 'P13-EMI-011-single-rod-resistive';
export const P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID = 'P13-EMI-012-single-rod-with-source';
export const P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID = 'P13-EMI-013-single-rod-with-capacitor';

export const P13_SINGLE_ROD_ANALYSIS_TOTAL_STEPS = 4;

export type P13SingleRodParamKey =
  | 'magneticField'
  | 'railSpan'
  | 'mass'
  | 'rodResistance'
  | 'externalResistance'
  | 'initialVelocity'
  | 'frictionCoefficient'
  | 'sourceVoltage'
  | 'capacitanceMicroFarad';

interface P13SingleRodVariantMeta {
  variant: P13SingleRodVariant;
  code: string;
  title: string;
  shortTitle: string;
  presetId: string;
  modelKey:
    | typeof P13_MODEL_KEYS.singleRodResistive
    | typeof P13_MODEL_KEYS.singleRodWithSource
    | typeof P13_MODEL_KEYS.singleRodWithCapacitor;
  pageSubtitle: string;
  currentFormula: string;
  currentFormulaLabel: string;
  topologyTitle: string;
  terminalHeadline: string;
  adoptedConvention: string;
  visibleParamKeys: readonly P13SingleRodParamKey[];
}

export const P13_SINGLE_ROD_VARIANT_META: Record<
  P13SingleRodVariant,
  P13SingleRodVariantMeta
> = {
  resistive: {
    variant: 'resistive',
    code: 'EMI-011',
    title: '单棒基础（纯电阻电路）',
    shortTitle: '单棒基础',
    presetId: P13_SINGLE_ROD_RESISTIVE_PRESET_ID,
    modelKey: P13_MODEL_KEYS.singleRodResistive,
    pageSubtitle:
      '纯电阻回路下，动生电动势直接驱动感应电流，安培力实时反作用到速度，形成 BLv → i → BIL → 速度衰减的完整闭环。',
    currentFormula: 'i = ε / (R + R棒)',
    currentFormulaLabel: 'i = ε / R总',
    topologyTitle: '纯电阻回路',
    terminalHeadline: '理论终态：v终 = 0，I终 = 0',
    adoptedConvention:
      '约定磁场垂直纸面向内，导体棒向右运动时动生电动势沿棒向上，因此感应电流取逆时针并产生向左的安培力。',
    visibleParamKeys: [
      'magneticField',
      'railSpan',
      'mass',
      'rodResistance',
      'externalResistance',
      'initialVelocity',
      'frictionCoefficient',
    ],
  },
  'with-source': {
    variant: 'with-source',
    code: 'EMI-012',
    title: '单棒 + 含电源',
    shortTitle: '单棒 + 电源',
    presetId: P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID,
    modelKey: P13_MODEL_KEYS.singleRodWithSource,
    pageSubtitle:
      '采用固定电源极性约定：电源在静止时驱动顺时针电流，使导体棒先向右受力；随着 BLv 增大，电流逐步减小并在 BLv = ε0 时进入匀速。',
    currentFormula: 'i = (ε - ε0) / (R + R棒)',
    currentFormulaLabel: 'i = (ε - ε0) / R总',
    topologyTitle: '含电源回路',
    terminalHeadline: '教材理想终态：BLv终 = ε0，I终 = 0',
    adoptedConvention:
      '固定约定电源正极接下导轨、负极接上导轨，因此静止时回路电流为顺时针，导体棒受到向右的安培力。',
    visibleParamKeys: [
      'magneticField',
      'railSpan',
      'mass',
      'rodResistance',
      'externalResistance',
      'initialVelocity',
      'sourceVoltage',
    ],
  },
  'with-capacitor': {
    variant: 'with-capacitor',
    code: 'EMI-013',
    title: '单棒 + 含电容',
    shortTitle: '单棒 + 电容',
    presetId: P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID,
    modelKey: P13_MODEL_KEYS.singleRodWithCapacitor,
    pageSubtitle:
      '电容接入后，动生电动势先给电容充电；随着 U电容 建立，回路电流和安培力同步衰减，终态满足 I终 = 0 与 U电容 = BLv终。',
    currentFormula: 'i = (ε - U电容) / (R + R棒)',
    currentFormulaLabel: 'i = (ε - U电容) / R总',
    topologyTitle: '含电容回路',
    terminalHeadline: '教材理想终态：I终 = 0，U电容 = BLv终',
    adoptedConvention:
      '固定约定电容上极板接上导轨、下极板接下导轨；棒向右运动时，上极板先被充正电，U电容 与动生电动势同向并逐步抵消电流。',
    visibleParamKeys: [
      'magneticField',
      'railSpan',
      'mass',
      'rodResistance',
      'externalResistance',
      'initialVelocity',
      'capacitanceMicroFarad',
    ],
  },
};

export const P13_SINGLE_ROD_PARAM_CONFIG = {
  magneticField: { label: '磁感应强度 B', min: 0.1, max: 5, step: 0.1, unit: 'T' },
  railSpan: { label: '导轨间距 L', min: 0.1, max: 2, step: 0.1, unit: 'm' },
  mass: { label: '导体棒质量 m', min: 0.01, max: 1, step: 0.01, unit: 'kg' },
  rodResistance: { label: '导体棒电阻 R棒', min: 0.1, max: 10, step: 0.1, unit: 'Ω' },
  externalResistance: { label: '外接电阻 R', min: 0.1, max: 20, step: 0.1, unit: 'Ω' },
  initialVelocity: { label: '初速度 v0', min: 0, max: 20, step: 0.1, unit: 'm/s' },
  frictionCoefficient: { label: '摩擦系数 μ', min: 0, max: 0.5, step: 0.01, unit: '' },
  sourceVoltage: { label: '电源电动势 ε0', min: 0, max: 20, step: 0.1, unit: 'V' },
  capacitanceMicroFarad: { label: '电容 C', min: 1, max: 1000, step: 1, unit: 'μF' },
} as const;

export const P13_SINGLE_ROD_DEFAULT_PARAMS_BY_VARIANT: Record<
  P13SingleRodVariant,
  P13SingleRodParams
> = {
  resistive: {
    variant: 'resistive',
    magneticField: 0.5,
    magneticFieldDirection: 'into',
    railSpan: 0.5,
    mass: 0.1,
    rodResistance: 1,
    externalResistance: 2,
    initialVelocity: 5,
    frictionCoefficient: 0,
    gravity: 9.8,
    sourceVoltage: 0,
    capacitanceMicroFarad: 100,
    initialCapacitorVoltage: 0,
  },
  'with-source': {
    variant: 'with-source',
    magneticField: 0.5,
    magneticFieldDirection: 'into',
    railSpan: 0.5,
    mass: 0.1,
    rodResistance: 1,
    externalResistance: 2,
    initialVelocity: 0,
    frictionCoefficient: 0,
    gravity: 9.8,
    sourceVoltage: 3,
    capacitanceMicroFarad: 100,
    initialCapacitorVoltage: 0,
  },
  'with-capacitor': {
    variant: 'with-capacitor',
    magneticField: 0.5,
    magneticFieldDirection: 'into',
    railSpan: 0.5,
    mass: 0.1,
    rodResistance: 1,
    externalResistance: 2,
    initialVelocity: 5,
    frictionCoefficient: 0,
    gravity: 9.8,
    sourceVoltage: 0,
    capacitanceMicroFarad: 100,
    initialCapacitorVoltage: 0,
  },
};

export const P13_HORIZONTAL_DIRECTION_LABELS: Record<P13HorizontalDirection, string> = {
  left: '向左',
  right: '向右',
  none: '静止',
};

export const P13_VERTICAL_DIRECTION_LABELS: Record<P13VerticalDirection, string> = {
  up: '沿棒向上',
  down: '沿棒向下',
  none: '无明确方向',
};

export const P13_LOOP_CURRENT_DIRECTION_LABELS: Record<P13LoopCurrentDirection, string> = {
  clockwise: '顺时针',
  counterclockwise: '逆时针',
  none: '无感应电流',
};

export function getSingleRodVariantMeta(
  variant: P13SingleRodVariant,
): P13SingleRodVariantMeta {
  return P13_SINGLE_ROD_VARIANT_META[variant];
}

export function getSingleRodVariantByPresetId(
  presetId: string,
): P13SingleRodVariant | null {
  if (presetId === P13_SINGLE_ROD_RESISTIVE_PRESET_ID) return 'resistive';
  if (presetId === P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID) return 'with-source';
  if (presetId === P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID) return 'with-capacitor';
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

function computeTotalResistance(params: P13SingleRodParams): number {
  return params.rodResistance + params.externalResistance;
}

function getSourceContribution(params: P13SingleRodParams): number {
  return params.variant === 'with-source' ? -params.sourceVoltage : 0;
}

function getCapacitanceFarad(params: P13SingleRodParams): number {
  return params.variant === 'with-capacitor'
    ? microFaradToFarad(params.capacitanceMicroFarad)
    : 0;
}

function computeTimeConstant(params: P13SingleRodParams): number {
  const totalResistance = computeTotalResistance(params);
  const b2l2 = params.magneticField * params.magneticField * params.railSpan * params.railSpan;
  if (params.variant === 'with-capacitor') {
    const capacitance = getCapacitanceFarad(params);
    if (totalResistance <= EPSILON || capacitance <= EPSILON) {
      return Number.POSITIVE_INFINITY;
    }
    const decayRate = (b2l2 / (params.mass * totalResistance)) + (1 / (totalResistance * capacitance));
    return decayRate > EPSILON ? 1 / decayRate : Number.POSITIVE_INFINITY;
  }
  if (totalResistance <= EPSILON || b2l2 <= EPSILON) {
    return Number.POSITIVE_INFINITY;
  }
  return (params.mass * totalResistance) / b2l2;
}

function buildSingleRodState(base: {
  params: P13SingleRodParams;
  time: number;
  position: number;
  velocity: number;
  capacitorVoltage: number;
}): P13SingleRodState {
  const { params, time, position, velocity, capacitorVoltage } = base;
  const totalResistance = computeTotalResistance(params);
  const timeConstant = computeTimeConstant(params);
  const dampingRatio = Number.isFinite(timeConstant) && timeConstant > EPSILON
    ? 1 / timeConstant
    : 0;
  const signedFluxDensity = resolveSignedFluxDensity(
    params.magneticField,
    params.magneticFieldDirection,
  );
  const emf = computeMotionalEmf({
    signedFluxDensity,
    effectiveCutLength: params.railSpan,
    velocity,
  });
  const netCircuitVoltage = computeSeriesCircuitVoltage([
    emf,
    getSourceContribution(params),
    params.variant === 'with-capacitor' ? -capacitorVoltage : 0,
  ]);
  const current = computeInducedCurrent({
    emf: netCircuitVoltage,
    resistance: totalResistance,
  });
  const ampereForce = Math.abs(current) <= EPSILON
    ? 0
    : current * params.railSpan * signedFluxDensity;
  const frictionForce = Math.abs(velocity) <= EPSILON
    ? 0
    : -Math.sign(velocity) * params.frictionCoefficient * params.mass * params.gravity;
  const netForce = ampereForce + frictionForce;
  const acceleration = netForce / params.mass;
  const capacitanceFarad = getCapacitanceFarad(params);

  return {
    time,
    position,
    velocity,
    emf,
    netCircuitVoltage,
    current,
    ampereForce,
    frictionForce,
    netForce,
    acceleration,
    kineticEnergy: 0.5 * params.mass * velocity * velocity,
    sourceVoltage: params.variant === 'with-source' ? params.sourceVoltage : 0,
    capacitorVoltage,
    capacitorCharge: capacitanceFarad * capacitorVoltage,
    totalResistance,
    timeConstant,
    dampingRatio,
    motionDirection: resolveHorizontalDirection(velocity),
    emfDirection: resolveVerticalDirection(emf),
    currentDirection: resolveLoopCurrentDirection(current),
    ampereForceDirection: resolveHorizontalDirection(ampereForce),
  };
}

function estimateSimulationDuration(params: P13SingleRodParams, timeConstant: number): number {
  const mechanicalStopEstimate = params.frictionCoefficient > EPSILON
    ? Math.abs(params.initialVelocity) / Math.max(EPSILON, params.frictionCoefficient * params.gravity)
    : 0;
  const capacitance = getCapacitanceFarad(params);
  const rcTime = computeTotalResistance(params) * capacitance;

  if (params.variant === 'with-capacitor') {
    return clamp(
      Math.max(MIN_CAPACITOR_DURATION, timeConstant * 8, rcTime * 8, mechanicalStopEstimate * 1.2),
      MIN_CAPACITOR_DURATION,
      0.12,
    );
  }

  return clamp(
    Math.max(
      params.variant === 'with-source' ? MIN_SOURCE_DURATION : MIN_RESISTIVE_DURATION,
      timeConstant * 4.8,
      mechanicalStopEstimate * 1.3,
    ),
    params.variant === 'with-source' ? MIN_SOURCE_DURATION : MIN_RESISTIVE_DURATION,
    MAX_DURATION,
  );
}

function chooseTimeStep(params: P13SingleRodParams, duration: number, timeConstant: number): number {
  const durationStep = duration / 600;
  const tauStep = Number.isFinite(timeConstant) ? timeConstant / 90 : DEFAULT_TIME_STEP;
  const capacitance = getCapacitanceFarad(params);
  const rcStep = capacitance > EPSILON
    ? (computeTotalResistance(params) * capacitance) / 120
    : DEFAULT_TIME_STEP;
  return clamp(
    Math.min(DEFAULT_TIME_STEP, durationStep, tauStep, rcStep),
    params.variant === 'with-capacitor' ? 1e-7 : 1 / 240,
    1 / 30,
  );
}

function simulateResistiveAnalytical(
  params: P13SingleRodParams,
  duration: number,
  timeStep: number,
  timeConstant: number,
): P13SingleRodState[] {
  const dampingRatio = timeConstant > EPSILON ? 1 / timeConstant : 0;
  const samples: P13SingleRodState[] = [];
  for (let time = 0; time <= duration + timeStep * 0.5; time += timeStep) {
    const clampedTime = Math.min(time, duration);
    const decay = Math.exp(-dampingRatio * clampedTime);
    const velocity = params.initialVelocity * decay;
    const position = dampingRatio > EPSILON
      ? (params.initialVelocity / dampingRatio) * (1 - decay)
      : params.initialVelocity * clampedTime;
    samples.push(
      buildSingleRodState({
        params,
        time: clampedTime,
        position,
        velocity,
        capacitorVoltage: 0,
      }),
    );
    if (clampedTime >= duration) break;
  }
  return samples;
}

function simulateNumerical(
  params: P13SingleRodParams,
  duration: number,
  timeStep: number,
): {
  samples: P13SingleRodState[];
  stopTime: number | null;
} {
  const samples: P13SingleRodState[] = [];
  const capacitanceFarad = getCapacitanceFarad(params);
  let time = 0;
  let position = 0;
  let velocity = params.initialVelocity;
  let capacitorVoltage = params.variant === 'with-capacitor'
    ? params.initialCapacitorVoltage
    : 0;
  let stopTime: number | null = Math.abs(velocity) <= EPSILON ? 0 : null;

  samples.push(
    buildSingleRodState({
      params,
      time,
      position,
      velocity,
      capacitorVoltage,
    }),
  );

  while (time < duration - timeStep * 0.5) {
    const currentState = buildSingleRodState({
      params,
      time,
      position,
      velocity,
      capacitorVoltage,
    });

    let nextVelocity = velocity + currentState.acceleration * timeStep;
    if (Math.abs(nextVelocity) <= 1e-5) {
      nextVelocity = 0;
    }
    if (Math.abs(velocity) > EPSILON && Math.sign(velocity) !== Math.sign(nextVelocity)) {
      nextVelocity = 0;
    }

    const nextPosition = position + ((velocity + nextVelocity) * 0.5 * timeStep);
    const nextCapacitorVoltage = capacitanceFarad > EPSILON
      ? capacitorVoltage + ((currentState.current / capacitanceFarad) * timeStep)
      : 0;

    time = Math.min(duration, time + timeStep);
    position = nextPosition;
    velocity = nextVelocity;
    capacitorVoltage = nextCapacitorVoltage;

    const nextState = buildSingleRodState({
      params,
      time,
      position,
      velocity,
      capacitorVoltage,
    });
    samples.push(nextState);

    if (stopTime === null && Math.abs(nextVelocity) <= EPSILON) {
      stopTime = time;
    }
    if (
      params.variant !== 'with-capacitor' &&
      stopTime !== null &&
      time >= Math.min(duration, stopTime + 0.35)
    ) {
      break;
    }
  }

  return { samples, stopTime };
}

function computeTheoreticalSummary(params: P13SingleRodParams): Pick<
  P13SingleRodSimulationResult['summary'],
  | 'theoreticalTerminalVelocity'
  | 'theoreticalTerminalCurrent'
  | 'theoreticalTerminalCapacitorVoltage'
  | 'terminalExplanation'
  | 'adoptedConvention'
> {
  const meta = getSingleRodVariantMeta(params.variant);
  const bAbs = Math.abs(params.magneticField);
  const bl = bAbs * params.railSpan;

  if (params.variant === 'with-source') {
    const terminalVelocity = bl > EPSILON ? params.sourceVoltage / bl : 0;
    return {
      theoreticalTerminalVelocity: terminalVelocity,
      theoreticalTerminalCurrent: 0,
      theoreticalTerminalCapacitorVoltage: 0,
      terminalExplanation:
        '固定极性下，电源先驱动顺时针电流并让导体棒向右加速；当 BLv 增大到与 ε0 相等时，回路总电压差为 0，电流与安培力都消失，导体棒转入匀速。',
      adoptedConvention: meta.adoptedConvention,
    };
  }

  if (params.variant === 'with-capacitor') {
    const capacitance = getCapacitanceFarad(params);
    const denominator = params.mass + (capacitance * bl * bl);
    const terminalVelocity = denominator > EPSILON
      ? (params.mass * params.initialVelocity) / denominator
      : 0;
    const terminalCapacitorVoltage = bl * terminalVelocity;
    return {
      theoreticalTerminalVelocity: terminalVelocity,
      theoreticalTerminalCurrent: 0,
      theoreticalTerminalCapacitorVoltage: terminalCapacitorVoltage,
      terminalExplanation:
        '电容起初被动生电动势充电，U电容 逐渐建立并抵消回路中的电压差；终态满足 i = 0，因此 U电容 = BLv终。无摩擦时剩余速度转为匀速保留。',
      adoptedConvention: meta.adoptedConvention,
    };
  }

  return {
    theoreticalTerminalVelocity: 0,
    theoreticalTerminalCurrent: 0,
    theoreticalTerminalCapacitorVoltage: 0,
    terminalExplanation:
      params.frictionCoefficient <= EPSILON
        ? '纯电阻回路里没有外加电源维持运动，动生电流与安培力只会不断耗散机械能，所以速度和电流一起衰减到 0。'
        : '纯电阻回路中，安培力与摩擦力共同耗散机械能，导体棒最终停止，回路电流也回到 0。',
    adoptedConvention: meta.adoptedConvention,
  };
}

export function normalizeSingleRodParams(
  variant: P13SingleRodVariant,
  input?: Partial<P13SingleRodParams>,
): P13SingleRodParams {
  const fallback = P13_SINGLE_ROD_DEFAULT_PARAMS_BY_VARIANT[variant];
  return {
    variant,
    magneticField: clamp(
      readFiniteNumber(input?.magneticField, fallback.magneticField),
      P13_SINGLE_ROD_PARAM_CONFIG.magneticField.min,
      P13_SINGLE_ROD_PARAM_CONFIG.magneticField.max,
    ),
    magneticFieldDirection:
      input?.magneticFieldDirection === 'out' ? 'out' : fallback.magneticFieldDirection,
    railSpan: clamp(
      readFiniteNumber(input?.railSpan, fallback.railSpan),
      P13_SINGLE_ROD_PARAM_CONFIG.railSpan.min,
      P13_SINGLE_ROD_PARAM_CONFIG.railSpan.max,
    ),
    mass: clamp(
      readFiniteNumber(input?.mass, fallback.mass),
      P13_SINGLE_ROD_PARAM_CONFIG.mass.min,
      P13_SINGLE_ROD_PARAM_CONFIG.mass.max,
    ),
    rodResistance: clamp(
      readFiniteNumber(input?.rodResistance, fallback.rodResistance),
      P13_SINGLE_ROD_PARAM_CONFIG.rodResistance.min,
      P13_SINGLE_ROD_PARAM_CONFIG.rodResistance.max,
    ),
    externalResistance: clamp(
      readFiniteNumber(input?.externalResistance, fallback.externalResistance),
      P13_SINGLE_ROD_PARAM_CONFIG.externalResistance.min,
      P13_SINGLE_ROD_PARAM_CONFIG.externalResistance.max,
    ),
    initialVelocity: clamp(
      readFiniteNumber(input?.initialVelocity, fallback.initialVelocity),
      P13_SINGLE_ROD_PARAM_CONFIG.initialVelocity.min,
      P13_SINGLE_ROD_PARAM_CONFIG.initialVelocity.max,
    ),
    frictionCoefficient: clamp(
      readFiniteNumber(input?.frictionCoefficient, fallback.frictionCoefficient),
      P13_SINGLE_ROD_PARAM_CONFIG.frictionCoefficient.min,
      P13_SINGLE_ROD_PARAM_CONFIG.frictionCoefficient.max,
    ),
    gravity: Math.max(0, readFiniteNumber(input?.gravity, fallback.gravity)),
    sourceVoltage: clamp(
      readFiniteNumber(input?.sourceVoltage, fallback.sourceVoltage),
      P13_SINGLE_ROD_PARAM_CONFIG.sourceVoltage.min,
      P13_SINGLE_ROD_PARAM_CONFIG.sourceVoltage.max,
    ),
    capacitanceMicroFarad: clamp(
      readFiniteNumber(input?.capacitanceMicroFarad, fallback.capacitanceMicroFarad),
      P13_SINGLE_ROD_PARAM_CONFIG.capacitanceMicroFarad.min,
      P13_SINGLE_ROD_PARAM_CONFIG.capacitanceMicroFarad.max,
    ),
    initialCapacitorVoltage: Math.max(
      0,
      readFiniteNumber(input?.initialCapacitorVoltage, fallback.initialCapacitorVoltage),
    ),
  };
}

export function simulateSingleRodModel(
  variant: P13SingleRodVariant,
  input?: Partial<P13SingleRodParams>,
): P13SingleRodSimulationResult {
  const params = normalizeSingleRodParams(variant, input);
  const timeConstant = computeTimeConstant(params);
  const duration = estimateSimulationDuration(params, timeConstant);
  const timeStep = chooseTimeStep(params, duration, timeConstant);
  const useAnalytical =
    variant === 'resistive' && params.frictionCoefficient <= EPSILON;
  const numericalRun = useAnalytical ? null : simulateNumerical(params, duration, timeStep);
  const samples = useAnalytical
    ? simulateResistiveAnalytical(params, duration, timeStep, timeConstant)
    : (numericalRun?.samples ?? []);
  const finalSample = samples[samples.length - 1];
  const firstSample = samples[0];
  const meta = getSingleRodVariantMeta(variant);
  const theoretical = computeTheoreticalSummary(params);
  const asymptoticDisplacement =
    variant === 'resistive' &&
    params.frictionCoefficient <= EPSILON &&
    Number.isFinite(timeConstant)
      ? params.initialVelocity * timeConstant
      : null;

  return {
    modelKey: meta.modelKey,
    variant,
    params,
    duration: finalSample?.time ?? duration,
    timeStep,
    samples,
    summary: {
      totalResistance: computeTotalResistance(params),
      timeConstant,
      initialCurrent: firstSample?.current ?? 0,
      theoreticalTerminalVelocity: theoretical.theoreticalTerminalVelocity,
      theoreticalTerminalCurrent: theoretical.theoreticalTerminalCurrent,
      theoreticalTerminalCapacitorVoltage: theoretical.theoreticalTerminalCapacitorVoltage,
      asymptoticDisplacement,
      stopTime: useAnalytical ? null : numericalRun?.stopTime ?? null,
      terminalExplanation: theoretical.terminalExplanation,
      adoptedConvention: theoretical.adoptedConvention,
    },
  };
}

export function sampleSingleRodStateAtTime(
  result: P13SingleRodSimulationResult,
  time: number,
): P13SingleRodState {
  const clampedTime = clamp(time, 0, result.duration);
  const { samples } = result;
  if (samples.length === 0) {
    return buildSingleRodState({
      params: result.params,
      time: clampedTime,
      position: 0,
      velocity: 0,
      capacitorVoltage: result.params.initialCapacitorVoltage,
    });
  }
  if (clampedTime <= samples[0]!.time) {
    return samples[0]!;
  }
  const lastSample = samples[samples.length - 1]!;
  if (clampedTime >= lastSample.time) {
    return lastSample;
  }

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
  if (span <= EPSILON) {
    return right;
  }

  const ratio = (clampedTime - left.time) / span;
  const position = left.position + ((right.position - left.position) * ratio);
  const velocity = left.velocity + ((right.velocity - left.velocity) * ratio);
  const capacitorVoltage = left.capacitorVoltage + ((right.capacitorVoltage - left.capacitorVoltage) * ratio);

  return buildSingleRodState({
    params: result.params,
    time: clampedTime,
    position,
    velocity,
    capacitorVoltage,
  });
}

export function buildSingleRodAnalysisSteps(
  result: P13SingleRodSimulationResult,
  state: P13SingleRodState,
): P13SingleRodAnalysisStep[] {
  const motionLabel = P13_HORIZONTAL_DIRECTION_LABELS[state.motionDirection];
  const emfLabel = P13_VERTICAL_DIRECTION_LABELS[state.emfDirection];
  const currentLabel = P13_LOOP_CURRENT_DIRECTION_LABELS[state.currentDirection];
  const moving = state.motionDirection !== 'none';
  const energized = state.currentDirection !== 'none';
  const forceLabel = energized
    ? P13_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirection]
    : '无明确方向';
  const formulaMeta = getSingleRodVariantMeta(result.variant);

  const currentDescription =
    result.variant === 'with-source'
      ? energized
        ? `固定电源极性下，回路总驱动电压为 ε - ε0 = ${state.netCircuitVoltage.toFixed(3)} V，所以 ${formulaMeta.currentFormula}。当前电流沿${currentLabel}方向闭合。`
        : '当 BLv 恰好增大到与 ε0 相等时，回路电压差为 0，电流随之减到 0。'
      : result.variant === 'with-capacitor'
        ? energized
          ? `电容当前电压 U电容 = ${state.capacitorVoltage.toFixed(3)} V，会抵消部分动生电动势，所以 ${formulaMeta.currentFormula}。当前电流沿${currentLabel}方向闭合。`
          : '当 U电容 增大到与 BLv 相等时，回路电压差为 0，所以电流衰减到 0。'
        : energized
          ? `回路总电阻固定为 R + R棒，所以 ${formulaMeta.currentFormula}。当前电流沿${currentLabel}方向闭合。`
          : '电流由动生电动势直接驱动；当 ε≈0 时，回路电流也随之趋近于 0。';

  const forceDescription =
    result.variant === 'with-source'
      ? energized
        ? `当前安培力${forceLabel}。若 BLv < ε0，则电源占优并继续推动导体棒；若 BLv > ε0，则动生电动势占优并把导体棒制动回终态速度。`
        : '当电流减到 0 时，安培力也同时归零，导体棒保持此刻速度继续匀速运动。'
      : result.variant === 'with-capacitor'
        ? energized
          ? `当前安培力${forceLabel}。随着电容继续充电，回路电流与安培力都会一起减弱，最终满足 i = 0。`
          : '当前没有稳定电流，所以安培力也减到 0；终态只剩已经建立好的 U电容 与剩余匀速。'
        : energized
          ? `导体棒内电流与磁场作用产生安培力，F安 = BIL。当前安培力${forceLabel}，始终阻碍导体棒继续原来的运动。`
          : '没有稳定电流时，安培力也趋近于 0；这正对应终态下速度和电流一起衰减。';

  return [
    {
      key: 'velocity',
      title: '速度方向',
      directionLabel: motionLabel,
      description: moving
        ? `导体棒当前沿导轨${motionLabel}运动，切割磁感线的方向由速度直接决定。`
        : '导体棒此刻速度约为 0，已经接近静止，后续感应效应也会同步消失。',
      accentColor: ANALYSIS_ACCENTS.velocity,
    },
    {
      key: 'emf',
      title: 'EMF 方向',
      directionLabel: emfLabel,
      description: moving
        ? `磁场固定垂直纸面向内，按右手定则，棒内正电荷被推向${emfLabel}，因此动生电动势仍满足 ε = BLv。`
        : '因为 ε = BLv，而此刻 v≈0，所以动生电动势本身趋近于 0，不再有稳定方向。',
      accentColor: ANALYSIS_ACCENTS.emf,
    },
    {
      key: 'current',
      title: '电流方向',
      directionLabel: currentLabel,
      description: currentDescription,
      accentColor: ANALYSIS_ACCENTS.current,
    },
    {
      key: 'ampere-force',
      title: '安培力方向',
      directionLabel: forceLabel,
      description: forceDescription,
      accentColor: ANALYSIS_ACCENTS['ampere-force'],
    },
  ];
}
