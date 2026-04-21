export interface HistogramBin {
  start: number;
  end: number;
  count: number;
  freq: number; // frequency density = count/(n*binWidth)
}

export interface HistogramResult {
  data: number[];
  bins: HistogramBin[];
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  binWidth: number;
  binCount: number;
}

export function computeHistogram(data: number[], binCount: number): HistogramResult {
  const n = data.length;
  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const binWidth = (max - min) / binCount;

  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * binWidth,
    end: min + (i + 1) * binWidth,
    count: 0,
    freq: 0,
  }));

  for (const v of data) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  }

  for (const bin of bins) {
    bin.freq = bin.count / (n * binWidth);
  }

  const mean = data.reduce((s, v) => s + v, 0) / n;
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
  const variance = data.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return { data, bins, mean, median, stdDev, min, max, binWidth, binCount };
}
