// Simulation categories
export type SimulationCategory =
  | 'classical'
  | 'geometric'
  | 'statistics'
  | 'distribution'
  | 'regression';

export type SimulationType =
  | 'coinFlip'
  | 'diceRoll'
  | 'twoDiceSum'
  | 'ballDraw'
  | 'monteCarloPi'
  | 'meetingProblem'
  | 'buffonsNeedle'
  | 'histogram'
  | 'stemLeaf'
  | 'pieChart'
  | 'lineChart'
  | 'binomialDist'
  | 'normalDist'
  | 'hypergeometricDist'
  | 'linearRegression'
  | 'lawOfLargeNumbers'
  | 'tournamentMatch'
  | 'boxSwapBalls'
  | 'randomWalk1D'
  | 'randomWalk2D'
  | 'markovChain';

export interface SimulationReplayMetadata {
  mode: 'seeded';
  seed: string;
  engineVersion: string;
  trialCount: number;
  generatedAt: number;
}

// ─── DataSpec types ───

export type DataPrecision = 0 | 1 | 2;  // decimal places

export interface DataSpec {
  mode: 'preset' | 'manual';
  presetId: string;
  filterMin: number | null;
  filterMax: number | null;
  precision: DataPrecision;
  customText: string;  // comma/newline-separated numbers for manual mode
}

export const DEFAULT_DATA_SPEC: DataSpec = {
  mode: 'preset',
  presetId: 'DS-01',
  filterMin: null,
  filterMax: null,
  precision: 0,
  customText: '',
};

export interface RegressionDataSpec {
  mode: 'preset' | 'manual';
  presetId: string;
  xLabel: string;
  yLabel: string;
  customText: string;  // each row: x,y or x y
}

export const DEFAULT_REGRESSION_DATA_SPEC: RegressionDataSpec = {
  mode: 'preset',
  presetId: 'REG-01',
  xLabel: 'x',
  yLabel: 'y',
  customText: '',
};

// Params for each simulation
export interface CoinFlipParams { n: number; speed: number; }
export interface DiceRollParams { n: number; diceCount: number; event: 'all' | 'odd' | 'even' | 'gte'; gteValue: number; }
export interface TwoDiceSumParams { n: number; diceCount: number; }
export interface BallDrawParams {
  scenarioId: string;
  targetLabel: string;
  otherLabel: string;
  redCount: number;
  whiteCount: number;
  drawCount: number;
  replace: boolean;
  n: number;
}
export interface MonteCarloPiParams { n: number; speed: number; }
export interface MeetingProblemParams { T: number; t: number; n: number; }
export interface BuffonsNeedleParams { needleLength: number; lineSpacing: number; n: number; }
export interface HistogramParams {
  dataSpec: DataSpec;
  binCount: number;
  useCustomBinWidth: boolean;
  customBinWidth: number;
}
export interface StemLeafParams {
  dataSpec: DataSpec;
  splitStems: boolean;
}
export interface BinomialDistParams { n: number; p: number; showMode: 'bar' | 'line'; }
export interface HypergeometricDistParams { N: number; M: number; n: number; showCdf: boolean; }
export interface NormalDistParams { mu: number; sigma: number; showSigmaRegions: boolean; }
export type RegressionModelType =
  | 'linear'        // y = a + bx
  | 'exponential'   // y = a·e^(bx)
  | 'power'         // y = a·x^b
  | 'log'           // y = a + b·ln(x)
  | 'quadratic'     // y = ax² + bx + c
  | 'reciprocal';   // y = a + b/x

export interface LinearRegressionParams {
  datasetId: string;
  dataSpec: RegressionDataSpec;
  showResiduals: boolean;
  modelType: RegressionModelType;
  /** 是否启用"自动推荐最佳模型"（按 R² 选） */
  autoRecommend: boolean;
}
export interface LawOfLargeNumbersParams { scenario: 'coinFlip' | 'diceRoll' | 'ballDraw'; maxN: number; numCurves: number; }

export interface PieChartParams {
  dataSpec: DataSpec;
  binCount: number;
  sortByValue: boolean;
}

export interface LineChartParams {
  dataSpec: DataSpec;
  showTrend: boolean;
  showMarkers: boolean;
}

export type TournamentEventId =
  | 'champion_A'
  | 'champion_B'
  | 'champion_C'
  | 'A_wins_4_straight'
  | 'B_wins_4_straight'
  | 'games_eq_3'
  | 'games_eq_4'
  | 'games_eq_5'
  | 'games_eq_6'
  | 'games_eq_7'
  | 'games_le_5'
  | 'games_ge_5';

export interface TournamentMatchParams {
  pAB: number;     // 甲胜乙的概率（默认 0.5）
  pAC: number;     // 甲胜丙的概率
  pBC: number;     // 乙胜丙的概率
  n: number;
  trackedEvents: TournamentEventId[];
}

export interface BoxSwapBallsParams {
  initBlack: number;   // 每盒初始黑球数
  initRed: number;     // 每盒初始红球数
  operations: number;  // 操作次数 n
  n: number;           // 模拟轮数
}

export interface RandomWalk1DParams {
  steps: number;       // 每条路径步数
  pRight: number;      // 向右概率（0..1）
  numPaths: number;    // 展示路径条数
  n: number;           // 模拟次数（用于终点分布）
}

export interface RandomWalk2DParams {
  steps: number;
  numPaths: number;
  n: number;
}

export interface MarkovChainParams {
  states: string[];             // 状态名称（2-6 个）
  transition: number[][];       // N×N 转移矩阵，每行和应为 1
  initial: number[];            // 初始分布（长度 N，和为 1）
  steps: number;                // 演化步数
  n: number;                    // 模拟轮数
  showSteadyState: boolean;     // 是否显示理论稳态分布
}

/** 预置马尔可夫链场景 */
export interface MarkovChainPreset {
  id: string;
  name: string;
  description: string;
  states: string[];
  transition: number[][];
  initial: number[];
}

export const MARKOV_PRESETS: MarkovChainPreset[] = [
  {
    id: 'MC-WEATHER',
    name: '天气链（晴/阴/雨）',
    description: '经典三态天气链：今天晴明天大概率仍晴，雨天有一半概率持续',
    states: ['晴', '阴', '雨'],
    transition: [
      [0.7, 0.2, 0.1],
      [0.3, 0.4, 0.3],
      [0.2, 0.3, 0.5],
    ],
    initial: [1, 0, 0],
  },
  {
    id: 'MC-PASS-BALL',
    name: '三人传球（高考典型）',
    description: '甲乙丙三人传球，每次等概率传给其余两人之一',
    states: ['甲', '乙', '丙'],
    transition: [
      [0,   0.5, 0.5],
      [0.5, 0,   0.5],
      [0.5, 0.5, 0],
    ],
    initial: [1, 0, 0],
  },
  {
    id: 'MC-RAINY-MOOD',
    name: '心情链（开心/平静/烦躁）',
    description: '今天心情对明天心情有影响：开心-平静-烦躁三态转移',
    states: ['开心', '平静', '烦躁'],
    transition: [
      [0.6, 0.3, 0.1],
      [0.3, 0.5, 0.2],
      [0.2, 0.4, 0.4],
    ],
    initial: [0.4, 0.4, 0.2],
  },
  {
    id: 'MC-2STATE',
    name: '简单二态链',
    description: '只有两个状态的最简单马尔可夫链',
    states: ['A', 'B'],
    transition: [
      [0.8, 0.2],
      [0.5, 0.5],
    ],
    initial: [1, 0],
  },
];

// Union of all params
export type SimulationParams =
  | CoinFlipParams
  | DiceRollParams
  | TwoDiceSumParams
  | BallDrawParams
  | MonteCarloPiParams
  | MeetingProblemParams
  | BuffonsNeedleParams
  | HistogramParams
  | StemLeafParams
  | PieChartParams
  | LineChartParams
  | BinomialDistParams
  | HypergeometricDistParams
  | NormalDistParams
  | LinearRegressionParams
  | LawOfLargeNumbersParams
  | TournamentMatchParams
  | BoxSwapBallsParams
  | RandomWalk1DParams
  | RandomWalk2DParams
  | MarkovChainParams;

// Simulation result data
export interface SimulationResult {
  type: SimulationType;
  data: unknown; // typed per simulation in engine
  stats: Record<string, number | string>;
  timestamp: number;
  replay?: SimulationReplayMetadata | null;
}

// Preset datasets
export interface PresetDataset {
  id: string;
  name: string;
  data: number[];
  description: string;
}

export interface RegressionDataset {
  id: string;
  name: string;
  xLabel: string;
  yLabel: string;
  points: Array<{ x: number; y: number }>;
  description: string;
}

export interface ResolvedRegressionData {
  sourceName: string;
  description: string;
  xLabel: string;
  yLabel: string;
  points: Array<{ x: number; y: number }>;
}

export interface BallDrawScenarioPreset {
  id: string;
  name: string;
  description: string;
  targetLabel: string;
  otherLabel: string;
  redCount: number;
  whiteCount: number;
  drawCount: number;
  replace: boolean;
}

// Simulation metadata
export interface SimulationMeta {
  type: SimulationType;
  category: SimulationCategory;
  label: string;
  description: string;
  defaultParams: SimulationParams;
}

// ─── Default Params ───

export const DEFAULT_PARAMS: Record<SimulationType, SimulationParams> = {
  coinFlip: { n: 100, speed: 2 } satisfies CoinFlipParams,
  diceRoll: { n: 100, diceCount: 1, event: 'all', gteValue: 5 } satisfies DiceRollParams,
  twoDiceSum: { n: 200, diceCount: 2 } satisfies TwoDiceSumParams,
  ballDraw: {
    scenarioId: 'BALL-01',
    targetLabel: '次品',
    otherLabel: '合格品',
    redCount: 4,
    whiteCount: 16,
    drawCount: 5,
    replace: false,
    n: 1000,
  } satisfies BallDrawParams,
  monteCarloPi: { n: 1000, speed: 2 } satisfies MonteCarloPiParams,
  meetingProblem: { T: 60, t: 15, n: 500 } satisfies MeetingProblemParams,
  buffonsNeedle: { needleLength: 1, lineSpacing: 2, n: 500 } satisfies BuffonsNeedleParams,
  histogram: {
    dataSpec: { mode: 'preset', presetId: 'DS-01', filterMin: null, filterMax: null, precision: 0, customText: '' },
    binCount: 8,
    useCustomBinWidth: false,
    customBinWidth: 5,
  } satisfies HistogramParams,
  stemLeaf: {
    dataSpec: { mode: 'preset', presetId: 'DS-01', filterMin: null, filterMax: null, precision: 0, customText: '' },
    splitStems: false,
  } satisfies StemLeafParams,
  binomialDist: { n: 10, p: 0.5, showMode: 'bar' } satisfies BinomialDistParams,
  hypergeometricDist: { N: 20, M: 8, n: 5, showCdf: false } satisfies HypergeometricDistParams,
  normalDist: { mu: 0, sigma: 1, showSigmaRegions: true } satisfies NormalDistParams,
  linearRegression: {
    datasetId: 'REG-01',
    dataSpec: { ...DEFAULT_REGRESSION_DATA_SPEC },
    showResiduals: false,
    modelType: 'linear',
    autoRecommend: false,
  } satisfies LinearRegressionParams,
  lawOfLargeNumbers: { scenario: 'coinFlip', maxN: 1000, numCurves: 3 } satisfies LawOfLargeNumbersParams,
  pieChart: {
    dataSpec: { mode: 'preset', presetId: 'DS-01', filterMin: null, filterMax: null, precision: 0, customText: '' },
    binCount: 5,
    sortByValue: false,
  } satisfies PieChartParams,
  lineChart: {
    dataSpec: { mode: 'preset', presetId: 'DS-04', filterMin: null, filterMax: null, precision: 0, customText: '' },
    showTrend: true,
    showMarkers: false,
  } satisfies LineChartParams,
  tournamentMatch: {
    pAB: 0.5,
    pAC: 0.5,
    pBC: 0.5,
    n: 1000,
    trackedEvents: ['champion_A', 'champion_B', 'champion_C', 'A_wins_4_straight', 'games_eq_5'],
  } satisfies TournamentMatchParams,
  boxSwapBalls: {
    initBlack: 1,
    initRed: 2,
    operations: 4,
    n: 1000,
  } satisfies BoxSwapBallsParams,
  randomWalk1D: {
    steps: 50,
    pRight: 0.5,
    numPaths: 5,
    n: 1000,
  } satisfies RandomWalk1DParams,
  randomWalk2D: {
    steps: 200,
    numPaths: 3,
    n: 500,
  } satisfies RandomWalk2DParams,
  markovChain: {
    states: ['晴', '阴', '雨'],
    transition: [
      [0.7, 0.2, 0.1],
      [0.3, 0.4, 0.3],
      [0.2, 0.3, 0.5],
    ],
    initial: [1, 0, 0],
    steps: 20,
    n: 500,
    showSteadyState: true,
  } satisfies MarkovChainParams,
};

// ─── Simulation List ───

export const SIMULATION_LIST: SimulationMeta[] = [
  {
    type: 'coinFlip',
    category: 'classical',
    label: '抛硬币',
    description: '模拟抛硬币实验，验证正面朝上的概率趋近于 1/2，直观展示频率与概率的关系。',
    defaultParams: DEFAULT_PARAMS.coinFlip,
  },
  {
    type: 'diceRoll',
    category: 'classical',
    label: '掷骰子',
    description: '模拟掷骰子实验，观察各面出现频率趋近于 1/6，探索古典概型。',
    defaultParams: DEFAULT_PARAMS.diceRoll,
  },
  {
    type: 'twoDiceSum',
    category: 'classical',
    label: '两骰子点数和',
    description: '掷两个骰子，统计点数之和的分布，观察其三角形概率分布特征。',
    defaultParams: DEFAULT_PARAMS.twoDiceSum,
  },
  {
    type: 'ballDraw',
    category: 'classical',
    label: '摸球问题',
    description: '从含红球和白球的袋中摸球，比较有放回与无放回抽样的概率分布差异。',
    defaultParams: DEFAULT_PARAMS.ballDraw,
  },
  {
    type: 'monteCarloPi',
    category: 'geometric',
    label: '蒙特卡洛求π',
    description: '用随机投点法估算圆周率 π，展示几何概型与蒙特卡洛方法的应用。',
    defaultParams: DEFAULT_PARAMS.monteCarloPi,
  },
  {
    type: 'meetingProblem',
    category: 'geometric',
    label: '约会问题',
    description: '两人各自在时间段 [0,T] 内随机到达，等待 t 分钟，模拟相遇概率的几何解法。',
    defaultParams: DEFAULT_PARAMS.meetingProblem,
  },
  {
    type: 'buffonsNeedle',
    category: 'geometric',
    label: '布丰投针',
    description: '投掷针落到平行线组上，用交叉概率估算 π，经典几何概率问题。',
    defaultParams: DEFAULT_PARAMS.buffonsNeedle,
  },
  {
    type: 'histogram',
    category: 'statistics',
    label: '频率直方图',
    description: '对预设数据集绘制频率直方图，分析数据分布形态、均值和标准差。',
    defaultParams: DEFAULT_PARAMS.histogram,
  },
  {
    type: 'stemLeaf',
    category: 'statistics',
    label: '茎叶图',
    description: '用茎叶图展示数据分布，保留原始数据的同时直观呈现数据的集中趋势和离散程度。',
    defaultParams: DEFAULT_PARAMS.stemLeaf,
  },
  {
    type: 'binomialDist',
    category: 'distribution',
    label: '二项分布',
    description: '可视化二项分布 B(n,p) 的概率质量函数，展示参数变化对分布形状的影响。',
    defaultParams: DEFAULT_PARAMS.binomialDist,
  },
  {
    type: 'hypergeometricDist',
    category: 'distribution',
    label: '超几何分布',
    description: '不放回抽样的概率分布 H(N,M,n)，展示 PMF 与 CDF，计算均值和方差。',
    defaultParams: DEFAULT_PARAMS.hypergeometricDist,
  },
  {
    type: 'normalDist',
    category: 'distribution',
    label: '正态分布',
    description: '展示正态分布 N(μ,σ²) 的概率密度函数及 68-95-99.7 法则的σ区间。',
    defaultParams: DEFAULT_PARAMS.normalDist,
  },
  {
    type: 'linearRegression',
    category: 'regression',
    label: '线性回归',
    description: '对预设或教师自定义的二维数据做一元线性回归，自动计算回归方程并分析线性相关强弱。',
    defaultParams: DEFAULT_PARAMS.linearRegression,
  },
  {
    type: 'pieChart',
    category: 'statistics',
    label: '扇形统计图',
    description: '将连续数据按区间分组（或按类别）后绘制扇形统计图，直观比较各区间占总体的比例。',
    defaultParams: DEFAULT_PARAMS.pieChart,
  },
  {
    type: 'lineChart',
    category: 'statistics',
    label: '折线统计图',
    description: '以折线展示数据随次序的变化趋势，可叠加均值参考线与最小二乘趋势线。',
    defaultParams: DEFAULT_PARAMS.lineChart,
  },
  {
    type: 'tournamentMatch',
    category: 'classical',
    label: '三人羽毛球赛',
    description: '模拟"累计负两场被淘汰、负者下场轮空"的三人轮空赛制（2020新高考Ⅰ卷题型），可自定义胜率并跟踪自选事件。',
    defaultParams: DEFAULT_PARAMS.tournamentMatch,
  },
  {
    type: 'boxSwapBalls',
    category: 'classical',
    label: '双盒互换球',
    description: '甲乙两盒各装若干黑球与红球，每次从两盒各取一球互换。统计 n 次操作后甲盒黑球数的分布。',
    defaultParams: DEFAULT_PARAMS.boxSwapBalls,
  },
  {
    type: 'randomWalk1D',
    category: 'geometric',
    label: '一维随机游走',
    description: '每步以概率 p 向右、1-p 向左走一步。观察 n 步后位置的分布与二项分布的对照关系。',
    defaultParams: DEFAULT_PARAMS.randomWalk1D,
  },
  {
    type: 'randomWalk2D',
    category: 'geometric',
    label: '二维随机游走',
    description: '每步等概率向上/下/左/右走一步。观察终点距离的渐近行为，对照 √(πn/2) 期望。',
    defaultParams: DEFAULT_PARAMS.randomWalk2D,
  },
  {
    type: 'markovChain',
    category: 'geometric',
    label: '通用马尔可夫链',
    description: '自定义状态空间 + 转移矩阵 + 初始分布，模拟链的演化并对照理论稳态分布。覆盖天气链、传球链等所有高考题型。',
    defaultParams: DEFAULT_PARAMS.markovChain,
  },
];

// ─── Simulation Groups ───

export interface SimulationGroup {
  label: string;
  category: SimulationCategory;
  types: SimulationType[];
}

export const SIMULATION_GROUPS: SimulationGroup[] = [
  {
    label: '古典概型',
    category: 'classical',
    types: ['coinFlip', 'diceRoll', 'twoDiceSum', 'ballDraw', 'tournamentMatch', 'boxSwapBalls'],
  },
  {
    label: '几何概型',
    category: 'geometric',
    types: ['monteCarloPi', 'meetingProblem', 'buffonsNeedle', 'randomWalk1D', 'randomWalk2D', 'markovChain'],
  },
  {
    label: '统计',
    category: 'statistics',
    types: ['histogram', 'stemLeaf', 'pieChart', 'lineChart'],
  },
  {
    label: '概率分布',
    category: 'distribution',
    types: ['binomialDist', 'hypergeometricDist', 'normalDist'],
  },
  {
    label: '回归分析',
    category: 'regression',
    types: ['linearRegression'],
  },
];

// ─── Preset Datasets ───

export const HISTOGRAM_DATASETS: PresetDataset[] = [
  {
    id: 'DS-01',
    name: '某班数学成绩（50人）',
    data: [72,85,68,91,76,83,88,65,79,82,74,90,77,86,70,93,81,67,84,78,89,73,94,80,75,87,69,92,76,83,71,88,66,95,79,84,73,90,77,86,68,93,82,75,89,71,85,78,83,80],
    description: '近似正态分布',
  },
  {
    id: 'DS-02',
    name: '某校身高数据（100人）',
    data: [165,168,172,175,170,162,178,171,169,174,167,173,176,163,180,170,168,172,166,174,171,169,175,167,173,170,168,172,176,164,179,171,169,173,168,175,170,172,167,174,171,169,176,165,180,173,170,168,172,174,166,171,169,175,170,172,168,174,167,173,170,169,176,165,178,171,168,172,174,170,167,173,171,169,175,170,172,168,174,166,173,170,169,176,165,179,171,168,172,174,170,167,173,170,169,175,170,172,168,174],
    description: '正态分布',
  },
  {
    id: 'DS-03',
    name: '某次考试成绩（200人）',
    data: [55,62,68,72,75,78,80,82,84,85,86,87,88,89,90,91,92,93,94,95,56,63,69,73,76,79,81,83,85,86,87,88,89,90,91,92,93,94,95,96,57,64,70,74,77,80,82,84,86,87,88,89,90,91,92,93,94,95,96,97,58,65,71,75,78,81,83,85,87,88,89,90,91,92,93,94,95,96,97,98,59,66,72,76,79,82,84,86,88,89,90,91,92,93,94,95,96,97,98,99,60,67,73,77,80,83,85,87,89,90,91,92,93,94,95,96,97,98,99,100,61,68,74,78,81,84,86,88,90,91,92,93,94,95,96,97,98,99,100,62,69,75,79,82,85,87,89,91,92,93,94,95,96,97,98,99,100,63,70,76,80,83,86,88,90,92,93,94,95,96,97,98,99,100,64,71,77,81,84,87,89,91,93,94,95,96,97,98,99,100,65,72,78,82,85,88,90,92,94,95,96,97,98,99,100,66,73,79,83,86],
    description: '左偏分布',
  },
  {
    id: 'DS-04',
    name: '某城市日均气温（365天）',
    data: [3,4,5,4,6,5,7,6,5,4,6,7,5,6,8,7,6,8,9,7,8,9,8,10,9,8,10,9,7,8,9,10,11,12,11,13,12,14,13,12,14,15,13,14,16,15,14,16,15,17,16,15,17,18,17,16,18,19,18,17,19,21,20,19,21,22,21,20,22,23,22,21,23,24,23,22,24,25,24,23,25,26,25,24,26,27,26,25,27,28,27,26,28,29,28,27,29,30,29,28,30,31,30,29,31,32,31,30,32,33,32,31,33,34,33,32,34,35,34,33,34,35,34,33,35,36,35,34,35,36,35,34,36,35,34,35,36,35,34,33,35,34,33,34,33,32,33,32,31,32,31,30,31,30,29,30,29,28,29,28,27,28,27,26,27,26,25,26,25,24,25,24,23,24,23,22,24,23,22,21,23,22,21,20,22,21,20,19,21,20,19,18,20,19,18,17,19,18,17,16,18,17,16,15,17,16,15,14,16,15,14,13,15,14,13,12,14,13,12,11,13,12,11,10,12,11,10,9,11,10,9,8,10,9,8,7,9,8,7,6,8,7,6,5,7,6,5,4,6,5,4,3,5,4,3,2,4,5,4,3,5,6,5,4,6],
    description: '双峰分布（冬低夏高）',
  },
  {
    id: 'DS-05',
    name: '城市居民月收入（100人）',
    data: [2800,3000,3100,3200,3300,3400,3500,3500,3600,3700,3800,3900,4000,4000,4100,4200,4300,4400,4500,4500,4600,4700,4800,4900,5000,5000,5100,5200,5300,5400,5500,5500,5600,5700,5800,5900,6000,6000,6100,6200,6300,6500,6700,6800,7000,7200,7500,7800,8000,8200,8500,8800,9000,9200,9500,9800,10000,10500,11000,11500,12000,12500,13000,13500,14000,15000,16000,17000,18000,19000,20000,21000,22000,24000,25000,27000,30000,32000,35000,38000,3200,4100,4800,5500,6300,7200,5000,4500,6000,5800,4200,5100,7500,9000,11000,3800,4400,6500,8000,13000],
    description: '右偏分布（多数集中在3000-8000，少数高收入）',
  },
];

// ─── resolveData ───

export function resolveData(spec: DataSpec): number[] {
  let raw: number[];
  if (spec.mode === 'preset') {
    const ds = HISTOGRAM_DATASETS.find(d => d.id === spec.presetId);
    raw = ds ? [...ds.data] : [];
  } else {
    raw = spec.customText.split(/[,\s\n]+/).map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
  }
  if (spec.filterMin !== null) raw = raw.filter(v => v >= (spec.filterMin as number));
  if (spec.filterMax !== null) raw = raw.filter(v => v <= (spec.filterMax as number));
  const factor = Math.pow(10, spec.precision);
  return raw.map(v => Math.round(v * factor) / factor);
}

export const REGRESSION_DATASETS: RegressionDataset[] = [
  {
    id: 'REG-01',
    name: '广告投入 vs 销售额',
    xLabel: '广告投入(万元)',
    yLabel: '销售额(万元)',
    points: [{x:2,y:30},{x:4,y:50},{x:5,y:58},{x:6,y:65},{x:8,y:78},{x:10,y:95},{x:12,y:110},{x:14,y:128},{x:16,y:142},{x:20,y:175}],
    description: '强正相关(r≈0.95)',
  },
  {
    id: 'REG-02',
    name: '气温 vs 冰淇淋销量',
    xLabel: '气温(°C)',
    yLabel: '销量(份)',
    points: [{x:15,y:120},{x:18,y:145},{x:20,y:168},{x:22,y:190},{x:25,y:215},{x:27,y:242},{x:28,y:255},{x:30,y:278},{x:32,y:295},{x:33,y:305},{x:35,y:322},{x:38,y:348}],
    description: '中等正相关(r≈0.75)',
  },
  {
    id: 'REG-03',
    name: '学习时间 vs 考试成绩',
    xLabel: '学习时间(h/天)',
    yLabel: '成绩(分)',
    points: [{x:1,y:45},{x:2,y:55},{x:2.5,y:60},{x:3,y:65},{x:3.5,y:72},{x:4,y:78},{x:4.5,y:82},{x:5,y:86},{x:5.5,y:90},{x:6,y:92},{x:6.5,y:95},{x:7,y:97},{x:7.5,y:98},{x:8,y:99},{x:8.5,y:100}],
    description: '正相关(r≈0.85)',
  },
  {
    id: 'REG-04',
    name: '汽车速度 vs 刹车距离',
    xLabel: '速度(km/h)',
    yLabel: '刹车距离(m)',
    points: [{x:20,y:7},{x:30,y:13},{x:40,y:20},{x:50,y:28},{x:60,y:38},{x:70,y:50},{x:80,y:62},{x:90,y:78},{x:100,y:96},{x:120,y:130}],
    description: '非线性正相关（二次曲线）',
  },
  {
    id: 'REG-05',
    name: '身高 vs 体重',
    xLabel: '身高(cm)',
    yLabel: '体重(kg)',
    points: [{x:155,y:45},{x:158,y:48},{x:160,y:52},{x:162,y:54},{x:165,y:57},{x:167,y:60},{x:168,y:62},{x:170,y:65},{x:172,y:68},{x:173,y:70},{x:175,y:72},{x:177,y:75},{x:178,y:78},{x:180,y:80},{x:182,y:83},{x:183,y:86},{x:185,y:89},{x:187,y:92},{x:188,y:95},{x:190,y:98}],
    description: '正相关(r≈0.80)',
  },
  {
    id: 'REG-CUSTOM',
    name: '教师自定义数据',
    xLabel: 'x',
    yLabel: 'y',
    points: [],
    description: '教师在增强面板中输入的二维数据点',
  },
];

function parseRegressionLine(line: string): { x: number; y: number } | null {
  const values = line
    .split(/[,\s，；;|]+/)
    .map(segment => Number.parseFloat(segment.trim()))
    .filter(value => Number.isFinite(value));

  if (values.length < 2) return null;
  return { x: values[0], y: values[1] };
}

export function parseRegressionPoints(text: string): Array<{ x: number; y: number }> {
  const normalized = text.trim();
  if (!normalized) return [];

  const lines = normalized
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines
      .map(parseRegressionLine)
      .filter((pair): pair is { x: number; y: number } => pair !== null);
  }

  const values = normalized
    .split(/[,\s，；;|]+/)
    .map(segment => Number.parseFloat(segment.trim()))
    .filter(value => Number.isFinite(value));

  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    points.push({ x: values[index], y: values[index + 1] });
  }
  return points;
}

export function regressionPointsToText(points: Array<{ x: number; y: number }>): string {
  return points.map(point => `${point.x}, ${point.y}`).join('\n');
}

function sanitizeRegressionLabel(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function resolveRegressionData(spec: RegressionDataSpec): ResolvedRegressionData {
  if (spec.mode === 'preset') {
    const preset = REGRESSION_DATASETS.find(dataset => dataset.id === spec.presetId) ?? REGRESSION_DATASETS[0];
    return {
      sourceName: preset.name,
      description: preset.description,
      xLabel: preset.xLabel,
      yLabel: preset.yLabel,
      points: preset.points.map(point => ({ ...point })),
    };
  }

  return {
    sourceName: '教师自定义数据',
    description: '手动输入的二维散点数据',
    xLabel: sanitizeRegressionLabel(spec.xLabel, 'x'),
    yLabel: sanitizeRegressionLabel(spec.yLabel, 'y'),
    points: parseRegressionPoints(spec.customText),
  };
}

export function syncCustomRegressionDataset(spec: RegressionDataSpec): void {
  const custom = REGRESSION_DATASETS.find(dataset => dataset.id === 'REG-CUSTOM');
  if (!custom) return;

  const resolved = resolveRegressionData({ ...spec, mode: 'manual' });
  custom.xLabel = resolved.xLabel;
  custom.yLabel = resolved.yLabel;
  custom.points = resolved.points.map(point => ({ ...point }));
  custom.description = `教师自定义数据（${resolved.points.length} 个点）`;
}

export const BALL_DRAW_SCENARIOS: BallDrawScenarioPreset[] = [
  {
    id: 'BALL-01',
    name: '质检抽样',
    description: '从 20 件产品中随机抽取 5 件检查，其中 4 件次品。适合讲无放回抽样与超几何分布。',
    targetLabel: '次品',
    otherLabel: '合格品',
    redCount: 4,
    whiteCount: 16,
    drawCount: 5,
    replace: false,
  },
  {
    id: 'BALL-02',
    name: '班级抽签',
    description: '12 张签中有 3 张中奖签，一次抽 2 张且不放回。适合讲组合计数与超几何分布。',
    targetLabel: '中奖签',
    otherLabel: '普通签',
    redCount: 3,
    whiteCount: 9,
    drawCount: 2,
    replace: false,
  },
  {
    id: 'BALL-03',
    name: '复位抽奖',
    description: '袋中 10 个球里有 2 个中奖球，每次摸出后放回，连续摸 5 次。适合讲独立重复试验与二项分布。',
    targetLabel: '中奖球',
    otherLabel: '普通球',
    redCount: 2,
    whiteCount: 8,
    drawCount: 5,
    replace: true,
  },
  {
    id: 'BALL-04',
    name: '课堂示范球袋',
    description: '教师自定义红白球参数的通用球袋场景，便于现场替换为班级数据。',
    targetLabel: '红球',
    otherLabel: '白球',
    redCount: 3,
    whiteCount: 5,
    drawCount: 2,
    replace: false,
  },
];

export function getBallDrawScenario(id: string): BallDrawScenarioPreset | undefined {
  return BALL_DRAW_SCENARIOS.find(scenario => scenario.id === id);
}

export function applyBallDrawScenario(params: BallDrawParams, scenarioId: string): BallDrawParams {
  const scenario = getBallDrawScenario(scenarioId);
  if (!scenario) return params;

  return {
    ...params,
    scenarioId: scenario.id,
    targetLabel: scenario.targetLabel,
    otherLabel: scenario.otherLabel,
    redCount: scenario.redCount,
    whiteCount: scenario.whiteCount,
    drawCount: scenario.drawCount,
    replace: scenario.replace,
  };
}

export function getBallDrawDistributionName(replace: boolean): string {
  return replace ? '二项分布 B(n, p)' : '超几何分布 H(N, M, n)';
}
