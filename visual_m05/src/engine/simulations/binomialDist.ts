export interface BinomialDistResult {
  n: number;
  p: number;
  pmfPoints: Array<{ k: number; prob: number }>;
  mean: number;
  variance: number;
  stdDev: number;
}

function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) {
    result = result * (n - i) / (i + 1);
  }
  return result;
}

export function computeBinomialDist(n: number, p: number): BinomialDistResult {
  const pmfPoints: Array<{ k: number; prob: number }> = [];

  for (let k = 0; k <= n; k++) {
    const prob = combination(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    pmfPoints.push({ k, prob });
  }

  return {
    n,
    p,
    pmfPoints,
    mean: n * p,
    variance: n * p * (1 - p),
    stdDev: Math.sqrt(n * p * (1 - p)),
  };
}
