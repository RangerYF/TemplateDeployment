import type { RandomSource } from '../random';
import type { RandomWalk1DParams, RandomWalk2DParams } from '../../types/simulation';

// ─── 1D 随机游走 ─────────────────────────────────────────────

export interface RandomWalk1DPath {
  positions: number[];  // 长度 = steps + 1，含起点 0
}

export interface RandomWalk1DResult {
  paths: RandomWalk1DPath[];           // 全部模拟路径（用于终点分布）
  samplePaths: RandomWalk1DPath[];     // 展示路径（最多 numPaths 条）
  endPositions: number[];              // 每条路径的终点位置
  endDistribution: Map<number, number>; // 终点位置频率分布
  meanEnd: number;
  stdEnd: number;
  steps: number;
  pRight: number;
  expectedEnd: number;                 // 理论期望 = steps * (2p - 1)
  expectedStd: number;                 // 理论标准差 = 2*sqrt(steps*p*(1-p))
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) result = (result * (n - i)) / (i + 1);
  return result;
}

/** 1D 简单随机游走：每步 +1 (概率 p) / -1 (概率 1-p) */
export function runRandomWalk1D(params: RandomWalk1DParams, rng: RandomSource = Math.random): RandomWalk1DResult {
  const { steps, pRight, numPaths, n } = params;
  const paths: RandomWalk1DPath[] = [];
  const samplePaths: RandomWalk1DPath[] = [];
  const endPositions: number[] = [];
  let sumEnd = 0;
  let sumEndSq = 0;

  for (let trial = 0; trial < n; trial++) {
    const positions: number[] = [0];
    let pos = 0;
    for (let s = 0; s < steps; s++) {
      pos += rng() < pRight ? 1 : -1;
      positions.push(pos);
    }
    paths.push({ positions });
    if (trial < numPaths) samplePaths.push({ positions });
    endPositions.push(pos);
    sumEnd += pos;
    sumEndSq += pos * pos;
  }

  const distMap = new Map<number, number>();
  for (const end of endPositions) {
    distMap.set(end, (distMap.get(end) ?? 0) + 1);
  }
  const endDistribution = new Map<number, number>();
  for (const [pos, count] of distMap) endDistribution.set(pos, count / n);

  const meanEnd = sumEnd / n;
  const variance = sumEndSq / n - meanEnd * meanEnd;
  const stdEnd = Math.sqrt(Math.max(variance, 0));

  const expectedEnd = steps * (2 * pRight - 1);
  const expectedStd = 2 * Math.sqrt(steps * pRight * (1 - pRight));

  return {
    paths,
    samplePaths,
    endPositions,
    endDistribution,
    meanEnd,
    stdEnd,
    steps,
    pRight,
    expectedEnd,
    expectedStd,
  };
}

/** 计算 1D 随机游走 n 步后位置 k 的理论概率（二项分布） */
export function theoreticalRW1DProb(steps: number, pRight: number, k: number): number {
  // k = (右移次数) - (左移次数)；右移次数 = (steps + k) / 2
  if ((steps + k) % 2 !== 0) return 0;
  const r = (steps + k) / 2;
  if (r < 0 || r > steps) return 0;
  return comb(steps, r) * Math.pow(pRight, r) * Math.pow(1 - pRight, steps - r);
}

// ─── 2D 随机游走 ─────────────────────────────────────────────

export interface RandomWalk2DPath {
  positions: Array<{ x: number; y: number }>;  // 长度 = steps + 1
}

export interface RandomWalk2DResult {
  samplePaths: RandomWalk2DPath[];
  endDistances: number[];                   // 每条路径的终点距离 (sqrt(x²+y²))
  meanEndDist: number;
  expectedEndDist: number;                  // 理论 √(πn/2) for symmetric walk
  steps: number;
  n: number;
  /** 所有路径的 x/y 范围，用于 viewBox */
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
}

/** 2D 简单对称随机游走：每步随机选 4 个方向之一（每方向 1/4 概率） */
export function runRandomWalk2D(params: RandomWalk2DParams, rng: RandomSource = Math.random): RandomWalk2DResult {
  const { steps, numPaths, n } = params;
  const samplePaths: RandomWalk2DPath[] = [];
  const endDistances: number[] = [];
  let xMin = 0, xMax = 0, yMin = 0, yMax = 0;
  let sumDist = 0;

  for (let trial = 0; trial < n; trial++) {
    const positions: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
    let x = 0, y = 0;
    for (let s = 0; s < steps; s++) {
      const dir = Math.floor(rng() * 4);
      if (dir === 0) x++;
      else if (dir === 1) x--;
      else if (dir === 2) y++;
      else y--;
      positions.push({ x, y });
      if (trial < numPaths) {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
    if (trial < numPaths) samplePaths.push({ positions });
    const dist = Math.sqrt(x * x + y * y);
    endDistances.push(dist);
    sumDist += dist;
  }

  const meanEndDist = sumDist / n;
  // 对称 2D 随机游走 n 步后 E[√(x²+y²)] ≈ √(πn/2) （大 n 渐近）
  const expectedEndDist = Math.sqrt((Math.PI * steps) / 2);

  return {
    samplePaths,
    endDistances,
    meanEndDist,
    expectedEndDist,
    steps,
    n,
    bounds: { xMin, xMax, yMin, yMax },
  };
}
