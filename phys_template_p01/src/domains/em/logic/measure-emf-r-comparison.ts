export type MeasureEmfCompareMode = 'ideal' | 'inner' | 'outer';

export interface MeasureEmfCompareParams {
  emf: number;
  internalResistance: number;
  ammeterResistance: number;
  voltmeterResistance: number;
  maxResistance: number;
  sliderRatio: number;
  sampleCount?: number;
}

export interface MeasureEmfPoint {
  resistance: number;
  I: number;
  U: number;
}

export interface MeasureEmfFit {
  intercept: number;
  slope: number;
  emf: number;
  r: number;
}

export interface MeasureEmfSeriesResult {
  mode: MeasureEmfCompareMode;
  current: MeasureEmfPoint;
  samples: MeasureEmfPoint[];
  fit: MeasureEmfFit | null;
  emfErrorPercent: number;
  rErrorPercent: number;
}

export interface MeasureEmfCompareResult {
  currentResistance: number;
  ideal: MeasureEmfSeriesResult;
  inner: MeasureEmfSeriesResult;
  outer: MeasureEmfSeriesResult;
  bestForEmf: 'inner' | 'outer' | 'equal';
  bestForR: 'inner' | 'outer' | 'equal';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parallelResistance(a: number, b: number): number {
  const safeA = Math.max(a, 1e-6);
  const safeB = Math.max(b, 1e-6);
  return (safeA * safeB) / (safeA + safeB);
}

function buildResistanceSamples(maxResistance: number, sampleCount: number): number[] {
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

export function calculateMeasureEmfPoint(
  mode: MeasureEmfCompareMode,
  params: MeasureEmfCompareParams,
  resistance: number,
): MeasureEmfPoint {
  const emf = Math.max(params.emf, 0);
  const r = Math.max(params.internalResistance, 0);
  const rA = Math.max(params.ammeterResistance, 0);
  const rV = Math.max(params.voltmeterResistance, 1e-6);
  const load = Math.max(resistance, 1e-6);

  if (mode === 'ideal') {
    const I = emf / Math.max(r + load, 1e-6);
    const U = emf - I * r;
    return { resistance: load, I, U };
  }

  if (mode === 'inner') {
    const branchResistance = parallelResistance(load, rV);
    const I = emf / Math.max(r + rA + branchResistance, 1e-6);
    const U = I * branchResistance;
    return { resistance: load, I, U };
  }

  const mainBranchResistance = load + rA;
  const externalEquivalent = parallelResistance(mainBranchResistance, rV);
  const totalCurrent = emf / Math.max(r + externalEquivalent, 1e-6);
  const U = emf - totalCurrent * r;
  const I = U / Math.max(mainBranchResistance, 1e-6);
  return { resistance: load, I, U };
}

function fitLine(points: MeasureEmfPoint[]): MeasureEmfFit | null {
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

function buildSeries(
  mode: MeasureEmfCompareMode,
  params: MeasureEmfCompareParams,
  currentResistance: number,
  sampleResistances: number[],
): MeasureEmfSeriesResult {
  const current = calculateMeasureEmfPoint(mode, params, currentResistance);
  const samples = sampleResistances.map((resistance) =>
    calculateMeasureEmfPoint(mode, params, resistance),
  );
  const fit = fitLine(samples);
  const trueEmf = Math.max(params.emf, 1e-6);
  const trueR = Math.max(params.internalResistance, 1e-6);

  return {
    mode,
    current,
    samples,
    fit,
    emfErrorPercent: fit ? ((fit.emf - params.emf) / trueEmf) * 100 : 0,
    rErrorPercent: fit ? ((fit.r - params.internalResistance) / trueR) * 100 : 0,
  };
}

function compareError(a: number, b: number): 'inner' | 'outer' | 'equal' {
  const absA = Math.abs(a);
  const absB = Math.abs(b);

  if (Math.abs(absA - absB) < 1e-9) return 'equal';
  return absA < absB ? 'inner' : 'outer';
}

export function calculateMeasureEmfComparison(
  params: MeasureEmfCompareParams,
): MeasureEmfCompareResult {
  const currentResistance = Math.max(
    0.5,
    Math.max(params.maxResistance, 1) * clamp(params.sliderRatio, 0.01, 1),
  );
  const sampleResistances = buildResistanceSamples(
    Math.max(params.maxResistance, 1),
    params.sampleCount ?? 8,
  );

  const ideal = buildSeries('ideal', params, currentResistance, sampleResistances);
  const inner = buildSeries('inner', params, currentResistance, sampleResistances);
  const outer = buildSeries('outer', params, currentResistance, sampleResistances);

  return {
    currentResistance,
    ideal,
    inner,
    outer,
    bestForEmf: compareError(inner.emfErrorPercent, outer.emfErrorPercent),
    bestForR: compareError(inner.rErrorPercent, outer.rErrorPercent),
  };
}
