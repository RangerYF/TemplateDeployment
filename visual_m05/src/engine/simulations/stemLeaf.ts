import type { DataPrecision } from '@/types/simulation';

export interface StemLeafRow {
  stem: string;
  leaves: number[];
  subLabel?: 'L' | 'H';
}

export interface StemLeafResult {
  rows: StemLeafRow[];
  data: number[];
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  n: number;
  precision: DataPrecision;
  keyExample: string;  // e.g., "7|2 表示 72" or "7|2 表示 7.2"
}

export function computeStemLeaf(data: number[], precision: DataPrecision, splitStems: boolean): StemLeafResult {
  if (data.length === 0) {
    return { rows: [], data: [], mean: 0, median: 0, min: 0, max: 0, range: 0, n: 0, precision, keyExample: '' };
  }

  // Scale all values to integers for stem-leaf processing
  const scale = Math.pow(10, precision);
  const intData = data.map(v => Math.round(v * scale));

  const sorted = [...intData].sort((a, b) => a - b);
  const stemMap = new Map<number, number[]>();

  for (const iv of sorted) {
    const stem = Math.floor(iv / 10);
    const leaf = ((iv % 10) + 10) % 10; // handle negatives
    if (!stemMap.has(stem)) stemMap.set(stem, []);
    stemMap.get(stem)!.push(leaf);
  }

  const stemKeys = [...stemMap.keys()].sort((a, b) => a - b);

  function formatStem(stemIndex: number): string {
    if (precision === 0) return String(stemIndex);
    if (precision === 1) return String(stemIndex);
    return (stemIndex / 10).toFixed(1);
  }

  let rows: StemLeafRow[];
  if (!splitStems) {
    rows = stemKeys.map(s => ({
      stem: formatStem(s),
      leaves: [...(stemMap.get(s) ?? [])].sort((a, b) => a - b),
    }));
  } else {
    rows = [];
    for (const s of stemKeys) {
      const all = [...(stemMap.get(s) ?? [])].sort((a, b) => a - b);
      rows.push({ stem: formatStem(s), leaves: all.filter(l => l <= 4), subLabel: 'L' });
      rows.push({ stem: formatStem(s), leaves: all.filter(l => l >= 5), subLabel: 'H' });
    }
  }

  // Stats on original data
  const origSorted = [...data].sort((a, b) => a - b);
  const n = data.length;
  const mean = data.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (origSorted[n / 2 - 1] + origSorted[n / 2]) / 2 : origSorted[Math.floor(n / 2)];
  const min = origSorted[0];
  const max = origSorted[n - 1];

  // Key example
  const exampleStem = stemKeys[Math.floor(stemKeys.length / 2)];
  const exampleLeaf = (stemMap.get(exampleStem) ?? [0])[0];
  const exampleIntVal = exampleStem * 10 + exampleLeaf;
  const exampleOrigVal = exampleIntVal / scale;
  const keyExample = `${formatStem(exampleStem)} | ${exampleLeaf} 表示 ${precision === 0 ? exampleOrigVal.toFixed(0) : exampleOrigVal.toFixed(precision)}`;

  return { rows, data, mean, median, min, max, range: max - min, n, precision, keyExample };
}
