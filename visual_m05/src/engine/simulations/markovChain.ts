import type { RandomSource } from '../random';
import type { MarkovChainParams } from '../../types/simulation';

export interface MarkovChainResult {
  states: string[];
  /** 转移矩阵副本（供渲染器展示） */
  transition: number[][];
  /** 初始分布副本 */
  initial: number[];
  steps: number;
  /** 每步状态分布演化（实际模拟，n 次路径平均） — 长度 (steps+1) × N */
  distribution: number[][];
  /** 终点状态计数（绝对频数） */
  finalCounts: number[];
  /** 终点状态频率分布 */
  finalDistribution: number[];
  /** 理论稳态分布（迭代到收敛） */
  steadyState: number[] | null;
  /** 矩阵是否有效 */
  valid: boolean;
  invalidReason?: string;
  /** 样本路径（前 5 条用于教学） */
  samplePaths: number[][];
  /** 是否能收敛到唯一稳态（不可约 + 非周期） */
  hasUniqueSteady: boolean;
}

const STEADY_ITERATIONS = 200;
const STEADY_TOL = 1e-10;
const MAX_SAMPLE_PATHS = 5;

/** 校验：每行和应为 1（允许小误差），所有项 >= 0 */
function validateMatrix(matrix: number[][], states: string[]): string | null {
  const N = states.length;
  if (matrix.length !== N) return `转移矩阵行数（${matrix.length}）与状态数（${N}）不一致`;
  for (let i = 0; i < N; i++) {
    if (matrix[i].length !== N) return `第 ${i + 1} 行长度不等于状态数`;
    let sum = 0;
    for (const v of matrix[i]) {
      if (!Number.isFinite(v) || v < -1e-9) return `第 ${i + 1} 行包含负数或非数字`;
      sum += v;
    }
    if (Math.abs(sum - 1) > 1e-6) return `第 ${i + 1} 行 ${states[i]} 出发的转移概率和 = ${sum.toFixed(4)}，应为 1`;
  }
  return null;
}

function validateDistribution(dist: number[], N: number, name: string): string | null {
  if (dist.length !== N) return `${name}向量长度（${dist.length}）与状态数（${N}）不一致`;
  let sum = 0;
  for (const v of dist) {
    if (!Number.isFinite(v) || v < -1e-9) return `${name}包含负数或非数字`;
    sum += v;
  }
  if (Math.abs(sum - 1) > 1e-6) return `${name}各分量和 = ${sum.toFixed(4)}，应为 1`;
  return null;
}

/** 按累积概率分布采样一个索引 */
function sampleDist(dist: number[], rng: RandomSource): number {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i];
    if (r < acc) return i;
  }
  return dist.length - 1;
}

/** 迭代法计算稳态分布：从均匀分布出发反复左乘转移矩阵 */
function computeSteadyState(matrix: number[][]): { steady: number[]; converged: boolean } {
  const N = matrix.length;
  let dist = new Array(N).fill(1 / N);
  let converged = false;
  for (let iter = 0; iter < STEADY_ITERATIONS; iter++) {
    const next = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        next[j] += dist[i] * matrix[i][j];
      }
    }
    // 检查收敛
    let maxDiff = 0;
    for (let i = 0; i < N; i++) maxDiff = Math.max(maxDiff, Math.abs(next[i] - dist[i]));
    dist = next;
    if (maxDiff < STEADY_TOL) {
      converged = true;
      break;
    }
  }
  return { steady: dist, converged };
}

export function runMarkovChain(params: MarkovChainParams, rng: RandomSource = Math.random): MarkovChainResult {
  const { states, transition, initial, steps, n } = params;
  const N = states.length;

  // 校验
  const matErr = validateMatrix(transition, states);
  if (matErr) {
    return {
      states, transition, initial, steps,
      distribution: [],
      finalCounts: [],
      finalDistribution: [],
      steadyState: null,
      valid: false,
      invalidReason: matErr,
      samplePaths: [],
      hasUniqueSteady: false,
    };
  }
  const initErr = validateDistribution(initial, N, '初始分布');
  if (initErr) {
    return {
      states, transition, initial, steps,
      distribution: [],
      finalCounts: [],
      finalDistribution: [],
      steadyState: null,
      valid: false,
      invalidReason: initErr,
      samplePaths: [],
      hasUniqueSteady: false,
    };
  }

  // 模拟 n 条路径
  // distribution[t][i] = 第 t 步状态为 i 的路径数（最后除以 n 得频率）
  const counts: number[][] = Array.from({ length: steps + 1 }, () => new Array(N).fill(0));
  const samplePaths: number[][] = [];

  for (let trial = 0; trial < n; trial++) {
    let state = sampleDist(initial, rng);
    counts[0][state]++;
    const path: number[] = trial < MAX_SAMPLE_PATHS ? [state] : [];
    for (let t = 1; t <= steps; t++) {
      state = sampleDist(transition[state], rng);
      counts[t][state]++;
      if (trial < MAX_SAMPLE_PATHS) path.push(state);
    }
    if (trial < MAX_SAMPLE_PATHS) samplePaths.push(path);
  }

  // 归一化
  const distribution = counts.map(row => row.map(c => c / n));
  const finalCounts = counts[steps].slice();
  const finalDistribution = distribution[steps].slice();

  // 理论稳态
  const { steady, converged } = computeSteadyState(transition);

  return {
    states, transition, initial, steps,
    distribution,
    finalCounts,
    finalDistribution,
    steadyState: steady,
    valid: true,
    samplePaths,
    hasUniqueSteady: converged,
  };
}
