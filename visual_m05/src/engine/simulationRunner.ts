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
  computePieChart,
  computeLineChart,
  runTournamentMatch,
  runBoxSwapBalls,
  runRandomWalk1D,
  runRandomWalk2D,
  runMarkovChain,
} from './simulations';
import {
  DEFAULT_REGRESSION_DATA_SPEC,
  HISTOGRAM_DATASETS,
  getBallDrawDistributionName,
  getBallDrawScenario,
  resolveData,
  resolveRegressionData,
  syncCustomRegressionDataset,
} from '../types/simulation';
import type {
  BallDrawParams,
  BinomialDistParams,
  BoxSwapBallsParams,
  RandomWalk1DParams,
  RandomWalk2DParams,
  MarkovChainParams,
  BuffonsNeedleParams,
  CoinFlipParams,
  DiceRollParams,
  HistogramParams,
  HypergeometricDistParams,
  LawOfLargeNumbersParams,
  LinearRegressionParams,
  RegressionModelType,
  LineChartParams,
  MeetingProblemParams,
  MonteCarloPiParams,
  NormalDistParams,
  PieChartParams,
  SimulationParams,
  SimulationReplayMetadata,
  SimulationResult,
  SimulationType,
  StemLeafParams,
  TournamentMatchParams,
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

function getEffectiveRegressionData(params: LinearRegressionParams) {
  const baseSpec = params.dataSpec ?? {
    ...DEFAULT_REGRESSION_DATA_SPEC,
    presetId: params.datasetId || DEFAULT_REGRESSION_DATA_SPEC.presetId,
  };
  const useManual = baseSpec.mode === 'manual' || params.datasetId === 'REG-CUSTOM';
  const effectiveSpec = useManual
    ? { ...baseSpec, mode: 'manual' as const }
    : { ...baseSpec, mode: 'preset' as const, presetId: params.datasetId || baseSpec.presetId };

  if (useManual) {
    syncCustomRegressionDataset(effectiveSpec);
  }

  return resolveRegressionData(effectiveSpec);
}

function getRegressionTrendLabel(b: number): string {
  if (b > 0) return '正相关';
  if (b < 0) return '负相关';
  return '变化趋势不明显';
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
      const dataset = getEffectiveRegressionData(p);
      return computeLinearRegression(dataset.points, p.modelType ?? 'linear', p.autoRecommend ?? false);
    }
    case 'lawOfLargeNumbers': {
      const p = params as LawOfLargeNumbersParams;
      return runLawOfLargeNumbers(p.scenario, replay?.trialCount ?? p.maxN, p.numCurves, rng);
    }
    case 'pieChart': {
      const p = params as PieChartParams;
      return computePieChart(p.dataSpec, p.binCount, p.sortByValue);
    }
    case 'lineChart': {
      const p = params as LineChartParams;
      return computeLineChart(p.dataSpec);
    }
    case 'tournamentMatch': {
      const p = params as TournamentMatchParams;
      return runTournamentMatch(p, rng);
    }
    case 'boxSwapBalls': {
      const p = params as BoxSwapBallsParams;
      return runBoxSwapBalls(p, rng);
    }
    case 'randomWalk1D': {
      const p = params as RandomWalk1DParams;
      return runRandomWalk1D(p, rng);
    }
    case 'randomWalk2D': {
      const p = params as RandomWalk2DParams;
      return runRandomWalk2D(p, rng);
    }
    case 'markovChain': {
      const p = params as MarkovChainParams;
      return runMarkovChain(p, rng);
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
      const result = data as import('./simulations').BallDrawResult;
      const scenario = getBallDrawScenario(p.scenarioId);
      stats['试验次数'] = p.n;
      stats['课堂场景'] = scenario?.name ?? '教师自定义场景';
      stats['目标对象'] = p.targetLabel;
      stats[`${p.targetLabel}总数`] = p.redCount;
      stats[`${p.otherLabel}总数`] = p.whiteCount;
      stats['每次取球'] = p.drawCount;
      stats['取球方式'] = p.replace ? '有放回' : '无放回';
      stats['模型判断'] = getBallDrawDistributionName(p.replace);
      stats['单次目标概率 p'] = (result.successProb ?? (p.redCount / (p.redCount + p.whiteCount))).toFixed(4);
      stats['k 取值范围'] = `${result.minPossible ?? 0} ~ ${result.maxPossible}`;
      stats['理论均值 E(X)'] = (result.expectedValue ?? (p.drawCount * p.redCount / (p.redCount + p.whiteCount))).toFixed(4);
      if (typeof result.variance === 'number') {
        stats['理论方差 D(X)'] = result.variance.toFixed(4);
      }
      if (scenario?.description) {
        stats['教学说明'] = scenario.description;
      }
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
      const p = params as LinearRegressionParams;
      const dataset = getEffectiveRegressionData(p);
      const pointCount = dataset.points.length;
      const xValues = dataset.points.map(point => point.x);
      const hasXVariance = xValues.length >= 2 && new Set(xValues).size > 1;
      stats['数据源'] = dataset.sourceName;
      stats['数据点数'] = pointCount;
      if (pointCount < 2) {
        stats['模型判断'] = '至少需要 2 个数据点才能做回归';
        break;
      }
      if (!hasXVariance) {
        stats['模型判断'] = 'x 数据没有变化，无法确定有效回归方程';
        break;
      }
      if (result.invalidReason) {
        stats['模型判断'] = result.invalidReason;
        break;
      }
      const MODEL_NAMES: Record<RegressionModelType, string> = {
        linear: '线性 y = a + bx',
        exponential: '指数 y = a·e^(bx)',
        power: '幂函数 y = a·x^b',
        log: '对数 y = a + b·ln(x)',
        quadratic: '二次 y = ax² + bx + c',
        reciprocal: '倒数 y = a + b/x',
      };
      const rmse = result.residuals.length > 0
        ? Math.sqrt(result.residuals.reduce((sum, item) => sum + item.residual ** 2, 0) / result.residuals.length)
        : 0;
      stats['模型类型'] = MODEL_NAMES[result.modelType];
      stats['回归方程'] = result.equation;
      if (result.linearizedEquation) {
        stats['线性化方程'] = result.linearizedEquation;
      }
      stats['决定系数 R²'] = result.r2.toFixed(4);
      if (result.modelType === 'linear') {
        stats['相关系数 r'] = result.r.toFixed(4);
      } else if (result.linearizedEquation) {
        stats['线性化后 r'] = result.r.toFixed(4);
      }
      stats['均方根误差 RMSE'] = rmse.toFixed(4);
      // 自动推荐结果
      if (p.autoRecommend && result.bestModelType) {
        stats['自动推荐最佳模型'] = MODEL_NAMES[result.bestModelType];
      } else if (result.modelComparison && result.modelComparison.length > 0) {
        const better = result.modelComparison
          .filter(m => m.valid && m.r2 > result.r2 + 0.02)
          .sort((a, b) => b.r2 - a.r2)[0];
        if (better) {
          stats['更优模型建议'] = `${MODEL_NAMES[better.modelType]}（R²=${better.r2.toFixed(4)}）`;
        }
      }
      stats['趋势判断'] = result.modelType === 'linear' ? getRegressionTrendLabel(result.b) : '—';
      stats['拟合强度'] = result.r2 >= 0.9 ? '拟合极好' : result.r2 >= 0.75 ? '拟合较好' : result.r2 >= 0.5 ? '拟合一般' : '拟合较差';
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
    case 'pieChart': {
      const result = data as ReturnType<typeof computePieChart>;
      stats['数据总数'] = result.total;
      stats['分组数'] = result.binCount;
      stats['均值'] = result.mean.toFixed(2);
      stats['范围'] = `[${result.min.toFixed(1)}, ${result.max.toFixed(1)}]`;
      const top = [...result.slices].sort((a, b) => b.count - a.count)[0];
      if (top) stats['占比最高分组'] = `${top.label} (${(top.freq * 100).toFixed(1)}%)`;
      break;
    }
    case 'lineChart': {
      const result = data as ReturnType<typeof computeLineChart>;
      stats['数据点数'] = result.points.length;
      stats['均值'] = result.mean.toFixed(2);
      stats['最小值'] = result.min.toFixed(2);
      stats['最大值'] = result.max.toFixed(2);
      stats['趋势斜率'] = result.trendSlope.toFixed(4);
      stats['趋势'] = result.trendSlope > 0.01 ? '上升趋势' : result.trendSlope < -0.01 ? '下降趋势' : '趋势平稳';
      break;
    }
    case 'tournamentMatch': {
      const p = params as TournamentMatchParams;
      const result = data as import('./simulations').TournamentMatchResult;
      stats['模拟次数'] = p.n;
      stats['甲胜乙概率'] = p.pAB.toFixed(2);
      stats['甲胜丙概率'] = p.pAC.toFixed(2);
      stats['乙胜丙概率'] = p.pBC.toFixed(2);
      stats['平均场数'] = result.meanGames.toFixed(2);
      stats['甲冠军频率'] = result.championDistribution.A.toFixed(4);
      stats['乙冠军频率'] = result.championDistribution.B.toFixed(4);
      stats['丙冠军频率'] = result.championDistribution.C.toFixed(4);
      for (const ev of result.events) {
        const theory = ev.theoreticalProb !== undefined ? `（理论 ${ev.theoreticalProb.toFixed(4)}）` : '';
        stats[ev.label] = `${ev.freq.toFixed(4)}${theory}`;
      }
      break;
    }
    case 'boxSwapBalls': {
      const p = params as BoxSwapBallsParams;
      const result = data as import('./simulations').BoxSwapBallsResult;
      stats['模拟轮数'] = p.n;
      stats['初始黑/红 (每盒)'] = `${p.initBlack} 黑 + ${p.initRed} 红`;
      stats['操作次数 n'] = p.operations;
      stats['甲盒黑球均值'] = result.meanBlackInA.toFixed(4);
      for (let k = 0; k <= 2 * p.initBlack; k++) {
        stats[`甲盒含 ${k} 个黑球频率`] = result.distribution[k].toFixed(4);
      }
      if (result.theoreticalProbBn !== undefined) {
        stats['P(Bₙ) 理论'] = result.theoreticalProbBn.toFixed(4);
        stats['公式'] = 'P(Bₙ) = 3/5 + (2/5)·(-1/9)ⁿ';
      }
      break;
    }
    case 'randomWalk1D': {
      const p = params as RandomWalk1DParams;
      const result = data as import('./simulations').RandomWalk1DResult;
      stats['步数'] = p.steps;
      stats['向右概率 p'] = p.pRight.toFixed(3);
      stats['模拟次数'] = p.n;
      stats['终点均值（模拟）'] = result.meanEnd.toFixed(3);
      stats['终点期望（理论）'] = result.expectedEnd.toFixed(3);
      stats['终点标准差（模拟）'] = result.stdEnd.toFixed(3);
      stats['终点标准差（理论）'] = result.expectedStd.toFixed(3);
      break;
    }
    case 'randomWalk2D': {
      const p = params as RandomWalk2DParams;
      const result = data as import('./simulations').RandomWalk2DResult;
      stats['步数'] = p.steps;
      stats['模拟次数'] = p.n;
      stats['终点距离均值（模拟）'] = result.meanEndDist.toFixed(3);
      stats['终点距离期望 √(πn/2)'] = result.expectedEndDist.toFixed(3);
      break;
    }
    case 'markovChain': {
      const p = params as MarkovChainParams;
      const result = data as import('./simulations').MarkovChainResult;
      stats['状态数'] = p.states.length;
      stats['模拟轮数'] = p.n;
      stats['演化步数'] = p.steps;
      if (!result.valid) {
        stats['模型判断'] = result.invalidReason ?? '参数无效';
        break;
      }
      // 终点频率（每个状态）
      for (let i = 0; i < p.states.length; i++) {
        stats[`P(终点=${p.states[i]})`] = result.finalDistribution[i].toFixed(4);
      }
      // 理论稳态
      if (result.steadyState) {
        const steadyText = p.states.map((s, i) => `${s}=${(result.steadyState![i] * 100).toFixed(2)}%`).join('，');
        stats['理论稳态分布'] = steadyText;
      }
      stats['稳态收敛'] = result.hasUniqueSteady ? '已收敛（迭代）' : '未充分收敛';
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
