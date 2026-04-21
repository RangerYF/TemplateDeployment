import type { RandomSource } from '../random';

export type TwoDiceSumResult = NDiceSumResult;

export interface NDiceSumResult {
  trials: number[];
  /** 观测频率，索引 i 对应 sum = minSum + i */
  frequencies: number[];
  /** 理论概率，与 frequencies 等长 */
  theoreticalProbs: number[];
  diceCount: number;
  minSum: number;
  maxSum: number;
}

/**
 * 用动态规划计算 diceCount 个骰子点数和的理论概率分布
 * 返回长度 = maxSum - minSum + 1 的数组，索引 i 对应 sum = minSum + i
 */
export function computeTheoreticalProbs(diceCount: number): number[] {
  // dp[s] = 恰好得到点数和 s 的概率
  let dp: number[] = new Array(diceCount * 6 + 1).fill(0);
  for (let face = 1; face <= 6; face++) dp[face] = 1 / 6;

  for (let d = 1; d < diceCount; d++) {
    const next: number[] = new Array(diceCount * 6 + 1).fill(0);
    for (let s = d; s <= d * 6; s++) {
      if (dp[s] === 0) continue;
      for (let face = 1; face <= 6; face++) {
        if (s + face <= diceCount * 6) {
          next[s + face] += dp[s] / 6;
        }
      }
    }
    dp = next;
  }

  const minSum = diceCount;
  const maxSum = diceCount * 6;
  return dp.slice(minSum, maxSum + 1);
}

export function runNDiceSum(n: number, diceCount: number, rng: RandomSource = Math.random): NDiceSumResult {
  const minSum = diceCount;
  const maxSum = diceCount * 6;
  const range = maxSum - minSum + 1;
  const counts = new Array(range).fill(0);
  const trials: number[] = [];

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let d = 0; d < diceCount; d++) {
      sum += Math.floor(rng() * 6) + 1;
    }
    trials.push(sum);
    counts[sum - minSum]++;
  }

  return {
    trials,
    frequencies: counts.map(c => c / n),
    theoreticalProbs: computeTheoreticalProbs(diceCount),
    diceCount,
    minSum,
    maxSum,
  };
}

// 保留旧名称兼容（两骰子场景）
export function runTwoDiceSum(n: number): NDiceSumResult {
  return runNDiceSum(n, 2);
}
