export type MeasureEmfMode = 'variable' | 'divider';

export interface MeasureEmfCompareParams {
  emf: number;
  internalResistance: number;
  ammeterResistance: number;
  voltmeterResistance: number;
  maxResistance: number;
  sliderRatio: number;
  loadResistance: number;
  sampleCount?: number;
}

export interface MeasureEmfWorkingState {
  totalCurrent: number;
  measuredCurrent: number;
  measuredVoltage: number;
  terminalVoltage: number;
  outputVoltage: number;
  outputCurrent: number;
  sliderRatio?: number;
  externalBranchResistance?: number;
  upperResistance?: number;
  lowerResistance?: number;
  lowerEquivalentResistance?: number;
}

export interface MeasureEmfPoint {
  resistance: number;
  I: number;
  U: number;
  state: MeasureEmfWorkingState;
}

export interface MeasureEmfFit {
  intercept: number;
  slope: number;
  emf: number;
  r: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parallelResistanceMany(resistances: number[]): number {
  let reciprocalSum = 0;

  for (const resistance of resistances) {
    if (!Number.isFinite(resistance)) continue;
    if (resistance <= 0) return 0;
    reciprocalSum += 1 / resistance;
  }

  return reciprocalSum > 0 ? 1 / reciprocalSum : Infinity;
}

export function buildMeasureEmfResistanceSamples(maxResistance: number, sampleCount: number): number[] {
  const count = Math.max(2, Math.round(sampleCount));
  const upper = Math.max(maxResistance, 1);
  const lower = Math.max(upper * 0.08, 0.5);
  const result: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    result.push(lower + (upper - lower) * t);
  }

  return result;
}

export function buildMeasureEmfSliderSamples(sampleCount: number): number[] {
  const count = Math.max(2, Math.round(sampleCount));
  const lower = 0.08;
  const upper = 0.95;
  const result: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    result.push(lower + (upper - lower) * t);
  }

  return result;
}

export function resolveMeasureEmfSeriesResistance(params: Pick<MeasureEmfCompareParams, 'maxResistance' | 'sliderRatio'>): number {
  return Math.max(
    0.5,
    Math.max(params.maxResistance, 1) * clamp(params.sliderRatio, 0.01, 1),
  );
}

export function resolveMeasureEmfDividerSegments(
  params: Pick<MeasureEmfCompareParams, 'maxResistance' | 'sliderRatio'>,
): {
  totalResistance: number;
  sliderRatio: number;
  upperResistance: number;
  lowerResistance: number;
} {
  const totalResistance = Math.max(params.maxResistance, 1);
  const sliderRatio = clamp(params.sliderRatio, 0.01, 0.99);

  return {
    totalResistance,
    sliderRatio,
    upperResistance: totalResistance * (1 - sliderRatio),
    lowerResistance: totalResistance * sliderRatio,
  };
}

export function calculateMeasureEmfPoint(
  mode: MeasureEmfMode,
  params: MeasureEmfCompareParams,
  controlValue: number,
): MeasureEmfPoint {
  const emf = Math.max(params.emf, 0);
  const r = Math.max(params.internalResistance, 0);
  const rA = Math.max(params.ammeterResistance, 0);
  const rV = Math.max(params.voltmeterResistance, 1e-6);

  if (mode === 'divider') {
    const sliderRatio = clamp(controlValue, 0.01, 0.99);
    const rheostatResistance = Math.max(params.maxResistance, 1e-6);
    const R_upper = rheostatResistance * (1 - sliderRatio);
    const R_lower = rheostatResistance * sliderRatio;
    const R_loadExternal = Math.max(params.loadResistance, 1e-6);
    const R_lowerEq = parallelResistanceMany([R_lower, R_loadExternal]);
    const R_externalBranch = rA + R_upper + R_lowerEq;
    const R_parallel = parallelResistanceMany([R_externalBranch, rV]);
    const R_total = R_parallel + r;

    const totalCurrent = emf / Math.max(R_total, 1e-6);
    const terminalVoltage = emf - totalCurrent * r;
    const measuredCurrent = terminalVoltage / Math.max(R_externalBranch, 1e-6);
    const outputVoltage = measuredCurrent * R_lowerEq;
    const outputCurrent = outputVoltage / Math.max(R_loadExternal, 1e-6);

    return {
      resistance: rheostatResistance,
      I: measuredCurrent,
      U: terminalVoltage,
      state: {
        sliderRatio,
        totalCurrent,
        measuredCurrent,
        measuredVoltage: terminalVoltage,
        terminalVoltage,
        outputVoltage,
        outputCurrent,
        externalBranchResistance: R_externalBranch,
        upperResistance: R_upper,
        lowerResistance: R_lower,
        lowerEquivalentResistance: R_lowerEq,
      },
    };
  }

  const rheostatResistance = Math.max(controlValue, 1e-6);
  const R_main = rA + rheostatResistance;
  const R_parallel = parallelResistanceMany([R_main, rV]);
  const R_total = R_parallel + r;
  const totalCurrent = emf / Math.max(R_total, 1e-6);
  const terminalVoltage = emf - totalCurrent * r;
  const measuredCurrent = terminalVoltage / Math.max(R_main, 1e-6);

  return {
    resistance: rheostatResistance,
    I: measuredCurrent,
    U: terminalVoltage,
    state: {
      sliderRatio: clamp(params.sliderRatio, 0.01, 1),
      totalCurrent,
      measuredCurrent,
      measuredVoltage: terminalVoltage,
      terminalVoltage,
      outputVoltage: terminalVoltage,
      outputCurrent: measuredCurrent,
      externalBranchResistance: R_main,
    },
  };
}

export function fitMeasureEmfPoints(points: MeasureEmfPoint[]): MeasureEmfFit | null {
  if (points.length < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of points) {
    sumX += point.I;
    sumY += point.U;
    sumXY += point.I * point.U;
    sumXX += point.I * point.I;
  }

  const n = points.length;
  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return {
    intercept,
    slope,
    emf: intercept,
    r: -slope,
  };
}
