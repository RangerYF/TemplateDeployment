import { resolveData } from '../../types/simulation';
import type { DataSpec } from '../../types/simulation';

export interface PieSlice {
  label: string;
  count: number;
  freq: number;
  startAngle: number;
  endAngle: number;
  color: string;
}

export interface PieChartResult {
  slices: PieSlice[];
  total: number;
  mean: number;
  min: number;
  max: number;
  binCount: number;
}

const PIE_COLORS = [
  '#00C06B', '#1890FF', '#FAAD14', '#FF4D4F', '#722ED1',
  '#13C2C2', '#EB2F96', '#52C41A', '#FA8C16', '#2F54EB',
];

export function computePieChart(spec: DataSpec, binCount: number, sortByValue = false): PieChartResult {
  const data = resolveData(spec);
  const n = data.length;
  if (n === 0) {
    return { slices: [], total: 0, mean: 0, min: 0, max: 0, binCount };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const mean = data.reduce((s, v) => s + v, 0) / n;

  const safeBinCount = Math.max(2, Math.min(10, binCount));
  const binWidth = max === min ? 1 : (max - min) / safeBinCount;

  const buckets = Array.from({ length: safeBinCount }, (_, i) => {
    const start = min + i * binWidth;
    const end = i === safeBinCount - 1 ? max : min + (i + 1) * binWidth;
    return { start, end, count: 0 };
  });

  for (const v of data) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= safeBinCount) idx = safeBinCount - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count++;
  }

  let ordered = buckets.map((b, i) => ({ ...b, originalIdx: i }));
  if (sortByValue) {
    ordered = [...ordered].sort((a, b) => b.count - a.count);
  }

  const slices: PieSlice[] = [];
  let cum = 0;
  for (const b of ordered) {
    const freq = n > 0 ? b.count / n : 0;
    const startAngle = cum * 2 * Math.PI;
    cum += freq;
    const endAngle = cum * 2 * Math.PI;
    slices.push({
      label: `[${b.start.toFixed(1)}, ${b.end.toFixed(1)}${b.originalIdx === safeBinCount - 1 ? ']' : ')'}`,
      count: b.count,
      freq,
      startAngle,
      endAngle,
      color: PIE_COLORS[b.originalIdx % PIE_COLORS.length],
    });
  }

  return { slices, total: n, mean, min, max, binCount: safeBinCount };
}
