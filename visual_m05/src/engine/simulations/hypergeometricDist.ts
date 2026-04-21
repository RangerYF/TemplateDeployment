/**
 * 超几何分布 Hypergeometric Distribution
 * X ~ H(N, M, n)
 * N: 总体数量, M: 总体中目标类型数量, n: 抽取数量
 * P(X=k) = C(M,k)*C(N-M,n-k) / C(N,n)
 */

export interface HypergeometricDistResult {
  N: number;  // 总体数量
  M: number;  // 目标类型数量
  n: number;  // 抽取数量
  pmfPoints: Array<{ k: number; prob: number }>;
  cdfPoints: Array<{ k: number; cumProb: number }>;
  mean: number;
  variance: number;
  stdDev: number;
  kMin: number;
  kMax: number;
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

export function computeHypergeometricDist(N: number, M: number, n: number): HypergeometricDistResult {
  // k ranges from max(0, n-(N-M)) to min(n, M)
  const kMin = Math.max(0, n - (N - M));
  const kMax = Math.min(n, M);
  const cnN = combination(N, n);

  const pmfPoints: Array<{ k: number; prob: number }> = [];
  const cdfPoints: Array<{ k: number; cumProb: number }> = [];
  let cumProb = 0;

  for (let k = kMin; k <= kMax; k++) {
    const prob = cnN > 0 ? (combination(M, k) * combination(N - M, n - k)) / cnN : 0;
    pmfPoints.push({ k, prob });
    cumProb += prob;
    cdfPoints.push({ k, cumProb: Math.min(1, cumProb) });
  }

  const mean = (N > 0) ? (n * M) / N : 0;
  const variance = (N > 1) ? (n * M * (N - M) * (N - n)) / (N * N * (N - 1)) : 0;

  return {
    N,
    M,
    n,
    pmfPoints,
    cdfPoints,
    mean,
    variance,
    stdDev: Math.sqrt(Math.max(0, variance)),
    kMin,
    kMax,
  };
}
