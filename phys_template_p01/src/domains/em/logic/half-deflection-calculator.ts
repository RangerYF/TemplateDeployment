export type HalfDeflectionMode = 'ammeter' | 'voltmeter';

export interface HalfDeflectionCurvePoint {
  rheostatResistance: number;
  totalSeriesResistance: number;
  idealMeasuredResistance: number;
  realMeasuredResistance: number;
  idealErrorPercent: number;
  realErrorPercent: number;
}

export interface HalfDeflectionComputation {
  mode: HalfDeflectionMode;
  rheostatResistance: number;
  totalSeriesResistance: number;
  meterResistance: number;
  idealMeasuredResistance: number;
  realMeasuredResistance: number;
  idealErrorPercent: number;
  realErrorPercent: number;
  referenceReading: number;
  targetHalfReading: number;
  meterReading: number;
  totalCurrent: number;
  auxiliaryCurrent: number;
  idealHalfResistance: number;
  exactHalfResistance: number;
  currentHalfResistance: number;
  currentErrorPercent: number;
  isHalfDeflection: boolean;
}

export interface SourceHalfDeflectionComputation {
  emf: number;
  sourceInternalResistance: number;
  meterResistance: number;
  halfResistance: number;
  initialReading: number;
  targetHalfReading: number;
  meterReading: number;
  totalCurrent: number;
  shuntCurrent: number;
  branchVoltage: number;
  idealEstimatedResistance: number;
  exactHalfResistance: number;
  currentEstimatedResistance: number;
  approximationErrorPercent: number;
  currentErrorPercent: number;
  readingRatio: number;
  isHalfDeflection: boolean;
}

interface HalfDeflectionParams {
  emf: number;
  sourceInternalResistance: number;
  rheostatResistance: number;
  meterResistance: number;
  halfResistance: number;
}

interface SourceHalfDeflectionParams {
  emf: number;
  sourceInternalResistance: number;
  meterResistance: number;
  halfResistance: number;
}

const HALF_DEFLECTION_TOLERANCE_RATIO = 0.03;

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function getTolerance(targetReading: number): number {
  return Math.max(Math.abs(targetReading) * HALF_DEFLECTION_TOLERANCE_RATIO, 1e-6);
}

function safeRelativeError(measured: number, truth: number): number {
  if (!Number.isFinite(truth) || Math.abs(truth) < 1e-9) return 0;
  return ((measured - truth) / truth) * 100;
}

export function calculateSourceResistanceHalfDeflection(
  params: SourceHalfDeflectionParams,
  branchClosed: boolean,
): SourceHalfDeflectionComputation {
  const emf = Number.isFinite(params.emf) ? params.emf : 0;
  const sourceInternalResistance = clampNonNegative(params.sourceInternalResistance);
  const meterResistance = Math.max(clampNonNegative(params.meterResistance), 1e-9);
  const halfResistance = clampNonNegative(params.halfResistance);

  const initialReading = emf / Math.max(sourceInternalResistance + meterResistance, 1e-9);
  const targetHalfReading = initialReading / 2;
  const idealEstimatedResistance = sourceInternalResistance;
  const exactHalfResistance =
    (sourceInternalResistance * meterResistance) /
    Math.max(sourceInternalResistance + meterResistance, 1e-9);

  let meterReading = initialReading;
  let totalCurrent = initialReading;
  let shuntCurrent = 0;
  let branchVoltage = initialReading * meterResistance;

  if (branchClosed) {
    const parallelResistance =
      halfResistance <= 0
        ? 0
        : (meterResistance * halfResistance) / Math.max(meterResistance + halfResistance, 1e-9);
    totalCurrent = emf / Math.max(sourceInternalResistance + parallelResistance, 1e-9);
    branchVoltage = totalCurrent * parallelResistance;

    if (halfResistance <= 0) {
      meterReading = 0;
      shuntCurrent = totalCurrent;
    } else {
      meterReading = branchVoltage / meterResistance;
      shuntCurrent = branchVoltage / halfResistance;
    }
  }

  return {
    emf,
    sourceInternalResistance,
    meterResistance,
    halfResistance,
    initialReading,
    targetHalfReading,
    meterReading,
    totalCurrent,
    shuntCurrent,
    branchVoltage,
    idealEstimatedResistance,
    exactHalfResistance,
    currentEstimatedResistance: halfResistance,
    approximationErrorPercent: safeRelativeError(exactHalfResistance, sourceInternalResistance),
    currentErrorPercent: safeRelativeError(halfResistance, sourceInternalResistance),
    readingRatio: initialReading > 1e-9 ? meterReading / initialReading : 0,
    isHalfDeflection:
      branchClosed && Math.abs(meterReading - targetHalfReading) <= getTolerance(targetHalfReading),
  };
}

export function calculateAmmeterHalfDeflection(
  params: HalfDeflectionParams,
  branchClosed: boolean,
): HalfDeflectionComputation {
  const emf = Number.isFinite(params.emf) ? params.emf : 0;
  const rheostatResistance = clampNonNegative(params.rheostatResistance);
  const sourceInternalResistance = clampNonNegative(params.sourceInternalResistance);
  const meterResistance = Math.max(clampNonNegative(params.meterResistance), 1e-9);
  const halfResistance = clampNonNegative(params.halfResistance);
  const totalSeriesResistance = rheostatResistance + sourceInternalResistance;

  const referenceReading = emf / Math.max(totalSeriesResistance + meterResistance, 1e-9);
  const targetHalfReading = referenceReading / 2;
  const idealHalfResistance = meterResistance;
  const exactHalfResistance =
    (meterResistance * totalSeriesResistance) /
    Math.max(totalSeriesResistance + meterResistance, 1e-9);

  let meterReading = referenceReading;
  let totalCurrent = referenceReading;
  let auxiliaryCurrent = 0;

  if (branchClosed) {
    const parallelResistance =
      halfResistance <= 0
        ? 0
        : (meterResistance * halfResistance) / (meterResistance + halfResistance);
    const loopResistance = totalSeriesResistance + parallelResistance;
    totalCurrent = emf / Math.max(loopResistance, 1e-9);

    if (halfResistance <= 0) {
      meterReading = 0;
      auxiliaryCurrent = totalCurrent;
    } else {
      const branchVoltage = totalCurrent * parallelResistance;
      meterReading = branchVoltage / meterResistance;
      auxiliaryCurrent = branchVoltage / halfResistance;
    }
  }

  return {
    mode: 'ammeter',
    rheostatResistance,
    totalSeriesResistance,
    meterResistance,
    idealMeasuredResistance: idealHalfResistance,
    realMeasuredResistance: exactHalfResistance,
    idealErrorPercent: 0,
    realErrorPercent: safeRelativeError(exactHalfResistance, meterResistance),
    referenceReading,
    targetHalfReading,
    meterReading,
    totalCurrent,
    auxiliaryCurrent,
    idealHalfResistance,
    exactHalfResistance,
    currentHalfResistance: halfResistance,
    currentErrorPercent: safeRelativeError(halfResistance, meterResistance),
    isHalfDeflection:
      branchClosed && Math.abs(meterReading - targetHalfReading) <= getTolerance(targetHalfReading),
  };
}

export function calculateVoltmeterHalfDeflection(
  params: HalfDeflectionParams,
  bypassClosed: boolean,
): HalfDeflectionComputation {
  const emf = Number.isFinite(params.emf) ? params.emf : 0;
  const rheostatResistance = clampNonNegative(params.rheostatResistance);
  const sourceInternalResistance = clampNonNegative(params.sourceInternalResistance);
  const meterResistance = Math.max(clampNonNegative(params.meterResistance), 1e-9);
  const halfResistance = clampNonNegative(params.halfResistance);
  const totalSeriesResistance = rheostatResistance + sourceInternalResistance;

  const baselineLoopResistance = totalSeriesResistance + meterResistance;
  const baselineCurrent = emf / Math.max(baselineLoopResistance, 1e-9);
  const referenceReading = baselineCurrent * meterResistance;
  const targetHalfReading = referenceReading / 2;
  const idealHalfResistance = meterResistance;
  const exactHalfResistance = totalSeriesResistance + meterResistance;

  let totalCurrent = baselineCurrent;
  let meterReading = referenceReading;

  if (!bypassClosed) {
    const loopResistance = totalSeriesResistance + meterResistance + halfResistance;
    totalCurrent = emf / Math.max(loopResistance, 1e-9);
    meterReading = totalCurrent * meterResistance;
  }

  return {
    mode: 'voltmeter',
    rheostatResistance,
    totalSeriesResistance,
    meterResistance,
    idealMeasuredResistance: idealHalfResistance,
    realMeasuredResistance: exactHalfResistance,
    idealErrorPercent: 0,
    realErrorPercent: safeRelativeError(exactHalfResistance, meterResistance),
    referenceReading,
    targetHalfReading,
    meterReading,
    totalCurrent,
    auxiliaryCurrent: totalCurrent,
    idealHalfResistance,
    exactHalfResistance,
    currentHalfResistance: halfResistance,
    currentErrorPercent: safeRelativeError(halfResistance, meterResistance),
    isHalfDeflection:
      !bypassClosed && Math.abs(meterReading - targetHalfReading) <= getTolerance(targetHalfReading),
  };
}

export function buildHalfDeflectionCurve(
  mode: HalfDeflectionMode,
  params: Omit<HalfDeflectionParams, 'halfResistance'>,
  pointCount = 41,
): HalfDeflectionCurvePoint[] {
  const maxRheostatResistance = clampNonNegative(params.rheostatResistance);
  const samples = Math.max(2, Math.round(pointCount));
  const points: HalfDeflectionCurvePoint[] = [];

  for (let index = 0; index < samples; index += 1) {
    const t = index / (samples - 1);
    const rheostatResistance = maxRheostatResistance * t;
    const totalSeriesResistance =
      rheostatResistance + clampNonNegative(params.sourceInternalResistance);
    const meterResistance = Math.max(clampNonNegative(params.meterResistance), 1e-9);

    const realMeasuredResistance =
      mode === 'ammeter'
        ? (meterResistance * totalSeriesResistance) /
          Math.max(totalSeriesResistance + meterResistance, 1e-9)
        : meterResistance + totalSeriesResistance;

    points.push({
      rheostatResistance,
      totalSeriesResistance,
      idealMeasuredResistance: meterResistance,
      realMeasuredResistance,
      idealErrorPercent: 0,
      realErrorPercent: safeRelativeError(realMeasuredResistance, meterResistance),
    });
  }

  return points;
}

export function isHalfDeflectionCircuitType(circuitType: string | undefined): boolean {
  return circuitType === 'half-deflection-ammeter' || circuitType === 'half-deflection-voltmeter';
}

export function getHalfDeflectionModeLabel(mode: HalfDeflectionMode): string {
  return mode === 'ammeter' ? '电流表半偏' : '电压表半偏';
}

export function getHalfDeflectionAssumption(mode: HalfDeflectionMode): string {
  return mode === 'ammeter' ? '理想条件：干路电流近似不变' : '理想条件：分压近似不变';
}
