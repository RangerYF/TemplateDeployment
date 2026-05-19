import { resolveData } from '../../types/simulation';
import type { DataSpec } from '../../types/simulation';

export interface LinePoint {
  i: number;
  v: number;
}

export interface LineChartResult {
  points: LinePoint[];
  mean: number;
  min: number;
  max: number;
  trendSlope: number;
  trendIntercept: number;
  trendStart: LinePoint;
  trendEnd: LinePoint;
}

export function computeLineChart(spec: DataSpec): LineChartResult {
  const data = resolveData(spec);
  const n = data.length;
  const points: LinePoint[] = data.map((v, i) => ({ i, v }));

  if (n === 0) {
    return {
      points: [], mean: 0, min: 0, max: 0,
      trendSlope: 0, trendIntercept: 0,
      trendStart: { i: 0, v: 0 }, trendEnd: { i: 0, v: 0 },
    };
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const mean = data.reduce((s, v) => s + v, 0) / n;

  // Least squares trend line: y = slope * i + intercept
  let sumI = 0, sumV = 0, sumII = 0, sumIV = 0;
  for (let i = 0; i < n; i++) {
    sumI += i;
    sumV += data[i];
    sumII += i * i;
    sumIV += i * data[i];
  }
  const denom = n * sumII - sumI * sumI;
  const slope = denom === 0 ? 0 : (n * sumIV - sumI * sumV) / denom;
  const intercept = denom === 0 ? mean : (sumV - slope * sumI) / n;

  return {
    points,
    mean,
    min,
    max,
    trendSlope: slope,
    trendIntercept: intercept,
    trendStart: { i: 0, v: intercept },
    trendEnd: { i: n - 1, v: intercept + slope * (n - 1) },
  };
}
