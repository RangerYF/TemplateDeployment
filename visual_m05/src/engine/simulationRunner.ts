import { createReplaySeed, createSeededRandom } from './random';
import {
  runCoinFlip,
  runDiceRoll,
  runNDiceSum,
  runBallDraw,
  runMonteCarloPi,
  runMeetingProblem,
  runBuffonsNeedle,
  computeHistogram,
  computeBinomialDist,
  computeHypergeometricDist,
  computeNormalDist,
  computeLinearRegression,
  runLawOfLargeNumbers,
  computeStemLeaf,
} from './simulations';
import {
  HISTOGRAM_DATASETS,
  REGRESSION_DATASETS,
  resolveData,
} from '../types/simulation';
import type {
  BallDrawParams,
  BinomialDistParams,
  BuffonsNeedleParams,
  CoinFlipParams,
  DiceRollParams,
  HistogramParams,
  HypergeometricDistParams,
  LawOfLargeNumbersParams,
  LinearRegressionParams,
  MeetingProblemParams,
  MonteCarloPiParams,
  NormalDistParams,
  SimulationParams,
  SimulationReplayMetadata,
  SimulationResult,
  SimulationType,
  StemLeafParams,
  TwoDiceSumParams,
} from '../types/simulation';

export const M05_SIM_ENGINE_VERSION = 'm05-sim-v1';

const REPLAYABLE_TYPES: SimulationType[] = [
  'coinFlip',
  'diceRoll',
  'twoDiceSum',
  'ballDraw',
  'monteCarloPi',
  'meetingProblem',
  'buffonsNeedle',
  'lawOfLargeNumbers',
];

export function isReplayableSimulation(type: SimulationType): boolean {
  return REPLAYABLE_TYPES.includes(type);
}

function getReplayTrialCount(type: SimulationType, params: SimulationParams): number {
  switch (type) {
    case 'coinFlip':
    case 'diceRoll':
    case 'twoDiceSum':
    case 'ballDraw':
    case 'monteCarloPi':
    case 'meetingProblem':
    case 'buffonsNeedle':
      return (params as { n: number }).n;
    case 'lawOfLargeNumbers':
      return (params as LawOfLargeNumbersParams).maxN;
    default:
      return 0;
  }
}

export function createSimulationReplay(
  type: SimulationType,
  params: SimulationParams,
  seed = createReplaySeed(),
): SimulationReplayMetadata | null {
  if (!isReplayableSimulation(type)) return null;

  return {
    mode: 'seeded',
    seed,
    engineVersion: M05_SIM_ENGINE_VERSION,
    trialCount: getReplayTrialCount(type, params),
    generatedAt: Date.now(),
  };
}

function buildSimulationData(
  type: SimulationType,
  params: SimulationParams,
  replay?: SimulationReplayMetadata | null,
): unknown {
  const rng = replay ? createSeededRandom(replay.seed) : undefined;

  switch (type) {
    case 'coinFlip': {
      const p = params as CoinFlipParams;
      return runCoinFlip(replay?.trialCount ?? p.n, rng);
    }
    case 'diceRoll': {
      const p = params as DiceRollParams;
      return runDiceRoll(replay?.trialCount ?? p.n, p.diceCount, p.event, p.gteValue, rng);
    }
    case 'twoDiceSum': {
      const p = params as TwoDiceSumParams;
      return runNDiceSum(replay?.trialCount ?? p.n, p.diceCount, rng);
    }
    case 'ballDraw': {
      const p = params as BallDrawParams;
      return runBallDraw(
        p.redCount,
        p.whiteCount,
        p.drawCount,
        p.replace,
        replay?.trialCount ?? p.n,
        rng,
      );
    }
    case 'monteCarloPi': {
      const p = params as MonteCarloPiParams;
      return runMonteCarloPi(replay?.trialCount ?? p.n, rng);
    }
    case 'meetingProblem': {
      const p = params as MeetingProblemParams;
      return runMeetingProblem(p.T, p.t, replay?.trialCount ?? p.n, rng);
    }
    case 'buffonsNeedle': {
      const p = params as BuffonsNeedleParams;
      return runBuffonsNeedle(p.needleLength, p.lineSpacing, replay?.trialCount ?? p.n, rng);
    }
    case 'histogram': {
      const p = params as HistogramParams;
      const resolvedData = resolveData(p.dataSpec);
      if (resolvedData.length < 2) {
        return { data: [], bins: [], mean: 0, median: 0, stdDev: 0, min: 0, max: 0, binWidth: 0, binCount: 0 };
      }
      let binCount = p.binCount;
      if (p.useCustomBinWidth && p.customBinWidth > 0) {
        const minVal = Math.min(...resolvedData);
        const maxVal = Math.max(...resolvedData);
        binCount = Math.max(1, Math.ceil((maxVal - minVal) / p.customBinWidth));
      }
      return computeHistogram(resolvedData, binCount);
    }
    case 'stemLeaf': {
      const p = params as StemLeafParams;
      const resolvedData = resolveData(p.dataSpec);
      return computeStemLeaf(resolvedData, p.dataSpec.precision, p.splitStems);
    }
    case 'binomialDist': {
      const p = params as BinomialDistParams;
      return computeBinomialDist(p.n, p.p);
    }
    case 'hypergeometricDist': {
      const p = params as HypergeometricDistParams;
      return computeHypergeometricDist(p.N, p.M, p.n);
    }
    case 'normalDist': {
      const p = params as NormalDistParams;
      return computeNormalDist(p.mu, p.sigma);
    }
    case 'linearRegression': {
      const p = params as LinearRegressionParams;
      const dataset = REGRESSION_DATASETS.find(d => d.id === p.datasetId) ?? REGRESSION_DATASETS[0];
      return computeLinearRegression(dataset.points);
    }
    case 'lawOfLargeNumbers': {
      const p = params as LawOfLargeNumbersParams;
      return runLawOfLargeNumbers(p.scenario, replay?.trialCount ?? p.maxN, p.numCurves, rng);
    }
  }
}

function buildSimulationStats(type: SimulationType, params: SimulationParams, data: unknown): Record<string, number | string> {
  const stats: Record<string, number | string> = {};

  switch (type) {
    case 'coinFlip': {
      const p = params as CoinFlipParams;
      const result = data as import('./simulations').CoinFlipResult;
      stats['投掷次数'] = p.n;
      stats['正面次数'] = result.headsCount;
      stats['反面次数'] = result.tailsCount;
      stats['正面频率'] = result.headsFreq.toFixed(4);
      stats['理论概率'] = '0.5000';
      break;
    }
    case 'diceRoll': {
      const p = params as DiceRollParams;
      const result = data as import('./simulations').DiceRollResult;
      stats['投掷轮数'] = p.n;
      stats['骰子数量'] = p.diceCount;
      stats['总观测次数'] = result.totalObs;
      for (let i = 0; i < 6; i++) {
        stats[`面${i + 1}频率`] = result.frequencies[i].toFixed(4);
      }
      stats['理论概率'] = (1 / 6).toFixed(4);
      if (p.event !== 'all') {
        stats['事件频率'] = result.eventCount > 0 ? (result.eventCount / p.n).toFixed(4) : '0';
        stats['事件理论概率'] = result.eventProb.toFixed(4);
      }
      break;
    }
    case 'twoDiceSum': {
      const p = params as TwoDiceSumParams;
      const result = data as import('./simulations').NDiceSumResult;
      stats['投掷轮数'] = p.n;
      stats['骰子数量'] = p.diceCount;
      stats['点数和范围'] = `${result.minSum} ~ ${result.maxSum}`;
      const maxIdx = result.frequencies.indexOf(Math.max(...result.frequencies));
      stats['最高频率点数和'] = result.minSum + maxIdx;
      break;
    }
    case 'ballDraw': {
      const p = params as BallDrawParams;
      stats['试验次数'] = p.n;
      stats['红球总数'] = p.redCount;
      stats['白球总数'] = p.whiteCount;
      stats['每次取球'] = p.drawCount;
      stats['取球方式'] = p.replace ? '有放回' : '无放回';
      break;
    }
    case 'monteCarloPi': {
      const p = params as MonteCarloPiParams;
      const result = data as import('./simulations').MonteCarloPiResult;
      stats['投点总数'] = p.n;
      stats['圆内点数'] = result.insideCount;
      stats['π估计值'] = result.piEstimate.toFixed(6);
      stats['真实π值'] = Math.PI.toFixed(6);
      stats['误差'] = Math.abs(result.piEstimate - Math.PI).toFixed(6);
      break;
    }
    case 'meetingProblem': {
      const p = params as MeetingProblemParams;
      const result = data as import('./simulations').MeetingProblemResult;
      stats['模拟次数'] = p.n;
      stats['相遇次数'] = result.metCount;
      stats['模拟概率'] = result.meetFreq.toFixed(4);
      stats['理论概率'] = result.theoreticalProb.toFixed(4);
      break;
    }
    case 'buffonsNeedle': {
      const p = params as BuffonsNeedleParams;
      const result = data as import('./simulations').BuffonsNeedleResult;
      stats['投针总数'] = p.n;
      stats['穿越次数'] = result.crossCount;
      stats['π估计值'] = result.piEstimate > 0 ? result.piEstimate.toFixed(6) : 'N/A';
      stats['理论概率'] = result.theoreticalProb.toFixed(4);
      break;
    }
    case 'histogram': {
      const p = params as HistogramParams;
      const result = data as ReturnType<typeof computeHistogram>;
      const sourceName = p.dataSpec.mode === 'manual'
        ? '自定义数据'
        : (HISTOGRAM_DATASETS.find(d => d.id === p.dataSpec.presetId)?.name ?? '数据集');
      stats['数据集'] = sourceName;
      stats['数据量'] = result.data.length;
      stats['均值'] = result.mean.toFixed(2);
      stats['中位数'] = result.median.toFixed(2);
      stats['标准差'] = result.stdDev.toFixed(2);
      stats['最小值'] = result.min;
      stats['最大值'] = result.max;
      break;
    }
    case 'stemLeaf': {
      const result = data as ReturnType<typeof computeStemLeaf>;
      stats['数据量'] = result.n;
      stats['均值'] = result.mean.toFixed(2);
      stats['中位数'] = result.median.toFixed(result.precision === 0 ? 1 : result.precision + 1);
      stats['最小值'] = result.min;
      stats['最大值'] = result.max;
      stats['极差'] = result.range.toFixed(result.precision);
      break;
    }
    case 'binomialDist': {
      const p = params as BinomialDistParams;
      const result = data as ReturnType<typeof computeBinomialDist>;
      stats['n'] = p.n;
      stats['p'] = p.p;
      stats['期望 E(X)'] = result.mean.toFixed(4);
      stats['方差 D(X)'] = result.variance.toFixed(4);
      stats['标准差 σ'] = result.stdDev.toFixed(4);
      break;
    }
    case 'hypergeometricDist': {
      const p = params as HypergeometricDistParams;
      const result = data as ReturnType<typeof computeHypergeometricDist>;
      stats['总体 N'] = p.N;
      stats['目标数 M'] = p.M;
      stats['抽取数 n'] = p.n;
      stats['期望 E(X)'] = result.mean.toFixed(4);
      stats['方差 D(X)'] = result.variance.toFixed(4);
      stats['标准差 σ'] = result.stdDev.toFixed(4);
      stats['k 范围'] = `${result.kMin} ~ ${result.kMax}`;
      break;
    }
    case 'normalDist': {
      const p = params as NormalDistParams;
      const result = data as ReturnType<typeof computeNormalDist>;
      stats['均值 μ'] = p.mu;
      stats['标准差 σ'] = p.sigma;
      stats['μ±σ (68.27%)'] = `[${result.sigma1Range[0].toFixed(2)}, ${result.sigma1Range[1].toFixed(2)}]`;
      stats['μ±2σ (95.45%)'] = `[${result.sigma2Range[0].toFixed(2)}, ${result.sigma2Range[1].toFixed(2)}]`;
      stats['μ±3σ (99.73%)'] = `[${result.sigma3Range[0].toFixed(2)}, ${result.sigma3Range[1].toFixed(2)}]`;
      break;
    }
    case 'linearRegression': {
      const result = data as ReturnType<typeof computeLinearRegression>;
      const sign = result.b >= 0 ? '+' : '';
      stats['回归方程'] = `ŷ = ${result.b.toFixed(4)}x ${sign}${result.a.toFixed(4)}`;
      stats['相关系数 r'] = result.r.toFixed(4);
      stats['决定系数 r²'] = (result.r ** 2).toFixed(4);
      stats['斜率 b'] = result.b.toFixed(4);
      stats['截距 a'] = result.a.toFixed(4);
      break;
    }
    case 'lawOfLargeNumbers': {
      const p = params as LawOfLargeNumbersParams;
      const result = data as import('./simulations').LawOfLargeNumbersResult;
      stats['最大试验次数'] = p.maxN;
      stats['曲线数量'] = p.numCurves;
      stats['理论概率'] = result.theoreticalProb.toFixed(4);
      const scenarioNames: Record<string, string> = {
        coinFlip: '抛硬币(正面)',
        diceRoll: '掷骰子(点1)',
        ballDraw: '摸球(3红/8总)',
      };
      stats['场景'] = scenarioNames[p.scenario] ?? p.scenario;
      break;
    }
  }

  return stats;
}

export function runSimulationWithParams(
  type: SimulationType,
  params: SimulationParams,
  replay: SimulationReplayMetadata | null = createSimulationReplay(type, params),
): SimulationResult {
  const data = buildSimulationData(type, params, replay);
  const stats = buildSimulationStats(type, params, data);
  return {
    type,
    data,
    stats,
    timestamp: Date.now(),
    replay,
  };
}

export function rebuildSimulationResultFromReplay(
  type: SimulationType,
  params: SimulationParams,
  replay: SimulationReplayMetadata,
  timestamp?: number,
): SimulationResult {
  const result = runSimulationWithParams(type, params, replay);
  return {
    ...result,
    timestamp: timestamp ?? result.timestamp,
  };
}
