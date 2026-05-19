import type { RandomSource } from '../random';
import type { BoxSwapBallsParams } from '../../types/simulation';

export type BallColor = 'B' | 'R';

export interface BoxSnapshot {
  boxA: { black: number; red: number };
  boxB: { black: number; red: number };
  pickedFromA: BallColor;
  pickedFromB: BallColor;
}

export interface BoxSwapTrial {
  finalBlackInA: number;       // n 次操作后甲盒黑球数
  trajectory: number[];        // 长度 = operations + 1，含初值
  sampleSnapshots?: BoxSnapshot[];  // 仅第一次试验保留，用于教学
}

export interface BoxSwapBallsResult {
  trials: BoxSwapTrial[];
  // 甲盒黑球数 k 的最终频率（k = 0 .. 2*initBlack）
  distribution: number[];
  theoreticalProbBn?: number;  // 默认配置下 P(B_n) = P(甲盒黑球=initBlack) 的理论值
  meanBlackInA: number;
  runningFreqs: number[][];    // 每个 k 的运行频率随轮数变化
  initBlack: number;
  initRed: number;
  operations: number;
  sampleSnapshots: BoxSnapshot[];
  trajectoryMeans: number[];   // 每个操作步骤后的甲盒黑球均值（横轴 = 操作步骤）
}

function pickIndex(rng: RandomSource, total: number): number {
  return Math.floor(rng() * total);
}

function pickBall(box: { black: number; red: number }, rng: RandomSource): BallColor {
  const total = box.black + box.red;
  const idx = pickIndex(rng, total);
  return idx < box.black ? 'B' : 'R';
}

/** Simulate one full trial (operations swaps) and return final state */
export function simulateBoxSwapTrial(
  initBlack: number,
  initRed: number,
  operations: number,
  rng: RandomSource,
  recordSnapshots = false,
): BoxSwapTrial {
  let boxA = { black: initBlack, red: initRed };
  let boxB = { black: initBlack, red: initRed };
  const trajectory: number[] = [boxA.black];
  const snapshots: BoxSnapshot[] = [];

  for (let i = 0; i < operations; i++) {
    const pickA = pickBall(boxA, rng);
    const pickB = pickBall(boxB, rng);

    // 移除被取出的球，加入对方的球
    boxA = {
      black: boxA.black - (pickA === 'B' ? 1 : 0) + (pickB === 'B' ? 1 : 0),
      red: boxA.red - (pickA === 'R' ? 1 : 0) + (pickB === 'R' ? 1 : 0),
    };
    boxB = {
      black: boxB.black - (pickB === 'B' ? 1 : 0) + (pickA === 'B' ? 1 : 0),
      red: boxB.red - (pickB === 'R' ? 1 : 0) + (pickA === 'R' ? 1 : 0),
    };

    trajectory.push(boxA.black);
    if (recordSnapshots) {
      snapshots.push({
        boxA: { ...boxA },
        boxB: { ...boxB },
        pickedFromA: pickA,
        pickedFromB: pickB,
      });
    }
  }

  return {
    finalBlackInA: boxA.black,
    trajectory,
    sampleSnapshots: recordSnapshots ? snapshots : undefined,
  };
}

/** 当 initBlack=1, initRed=2 时返回 P(B_n) = 3/5 + (2/5)(-1/9)^n，否则 undefined */
function theoreticalBn(initBlack: number, initRed: number, operations: number): number | undefined {
  if (initBlack === 1 && initRed === 2) {
    return 3 / 5 + (2 / 5) * Math.pow(-1 / 9, operations);
  }
  return undefined;
}

export function runBoxSwapBalls(
  params: BoxSwapBallsParams,
  rng: RandomSource = Math.random,
): BoxSwapBallsResult {
  const { initBlack, initRed, operations, n } = params;
  const totalBlack = initBlack * 2;
  const maxK = totalBlack;  // 甲盒黑球最多 = 总黑球数
  const counts = new Array(maxK + 1).fill(0);
  const trials: BoxSwapTrial[] = [];
  const runningFreqs: number[][] = Array.from({ length: maxK + 1 }, () => []);
  const trajectorySums: number[] = new Array(operations + 1).fill(0);
  let sumFinalBlack = 0;
  let sampleSnapshots: BoxSnapshot[] = [];

  for (let i = 0; i < n; i++) {
    const recordSnapshots = i === 0;
    const trial = simulateBoxSwapTrial(initBlack, initRed, operations, rng, recordSnapshots);
    trials.push(trial);
    if (recordSnapshots && trial.sampleSnapshots) sampleSnapshots = trial.sampleSnapshots;

    const finalK = trial.finalBlackInA;
    if (finalK >= 0 && finalK <= maxK) counts[finalK]++;
    sumFinalBlack += finalK;

    for (let j = 0; j < trial.trajectory.length; j++) {
      trajectorySums[j] += trial.trajectory[j];
    }

    for (let k = 0; k <= maxK; k++) {
      runningFreqs[k].push(counts[k] / (i + 1));
    }
  }

  const total = Math.max(n, 1);
  const distribution = counts.map(c => c / total);
  const trajectoryMeans = trajectorySums.map(s => s / total);

  return {
    trials,
    distribution,
    theoreticalProbBn: theoreticalBn(initBlack, initRed, operations),
    meanBlackInA: sumFinalBlack / total,
    runningFreqs,
    initBlack,
    initRed,
    operations,
    sampleSnapshots,
    trajectoryMeans,
  };
}
