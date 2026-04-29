import { useAnimationStore, useSimulationStore, useUIStore } from '@/editor/store';
import {
  HISTOGRAM_DATASETS,
  REGRESSION_DATASETS,
  SIMULATION_LIST,
  type SimulationType,
} from '@/types/simulation';
import type { SimulationEntity } from '@/editor/entities/types';

type AiSimulationSummary = {
  id: string;
  type: SimulationType;
  label: string;
  category: string;
  params: SimulationEntity['params'];
  hasResult: boolean;
  stats?: Record<string, number | string>;
  visible: boolean;
};

export type M05AiContext = {
  templateKey: 'm05';
  summary: string;
  activeSimulation: AiSimulationSummary | null;
  existingSimulations: AiSimulationSummary[];
  availableSimulationTypes: Array<{
    type: SimulationType;
    label: string;
    category: string;
    description: string;
    defaultParams: unknown;
  }>;
  datasets: {
    histogram: Array<{ id: string; name: string; description: string; size: number }>;
    regression: Array<{ id: string; name: string; xLabel: string; yLabel: string; description: string; size: number }>;
  };
  ui: {
    activeCategory: string;
    showResultPanel: boolean;
    animationSpeed: number;
  };
  animation: {
    mode: string;
    status: string;
    speed: number;
    singleTrialCount: number;
  };
  resultInterpretationHints: string[];
  constraints: string[];
};

const META_BY_TYPE = new Map(SIMULATION_LIST.map((item) => [item.type, item]));

function summarizeSimulation(sim: SimulationEntity): AiSimulationSummary {
  const meta = META_BY_TYPE.get(sim.type);
  const item: AiSimulationSummary = {
    id: sim.id,
    type: sim.type,
    label: meta?.label ?? sim.type,
    category: meta?.category ?? 'classical',
    params: sim.params,
    hasResult: Boolean(sim.result),
    visible: sim.visible,
  };

  if (sim.result?.stats) {
    item.stats = sim.result.stats;
  }
  return item;
}

function buildResultHints(sim: SimulationEntity | undefined): string[] {
  if (!sim?.result) return [];
  const stats = sim.result.stats;
  switch (sim.type) {
    case 'coinFlip':
      return [
        '可比较正面频率与理论概率 0.5000 的差距，并说明试验次数越大频率通常越稳定。',
        '不要把一次模拟结果解释为必然规律，应强调随机波动。',
      ];
    case 'diceRoll':
      return [
        '可比较各面频率与理论概率 1/6 的接近程度。',
        '如果设置了统计事件，可解释事件频率和事件理论概率的关系。',
      ];
    case 'twoDiceSum':
      return [
        '点数和分布应呈中间高、两端低；两颗骰子时 7 的理论概率最高。',
        '可用样本频率与理论形状的差异说明随机误差。',
      ];
    case 'monteCarloPi':
    case 'buffonsNeedle':
      return [
        '可围绕 π 估计值、真实 π 和误差解释几何概率模型。',
        '强调样本量增加通常能降低估计波动，但单次结果仍受随机性影响。',
      ];
    case 'meetingProblem':
      return [
        '可解释模拟概率与理论概率的接近程度，并联系几何区域面积模型。',
      ];
    case 'histogram':
    case 'stemLeaf':
      return [
        `可结合均值、中位数、标准差和极差描述数据集中趋势与离散程度。当前统计项：${Object.keys(stats).join('、')}。`,
        '不要凭图像以外的信息判断因果关系。',
      ];
    case 'binomialDist':
      return [
        '可说明 n 和 p 如何影响二项分布的中心、离散程度和偏态。',
        '当 n 较大且 p 不极端时，可引出正态近似。'
      ];
    case 'hypergeometricDist':
      return [
        '可强调不放回抽样导致每次抽取概率发生变化，这是它与二项分布的核心差别。',
      ];
    case 'normalDist':
      return [
        '可解释 μ 决定中心位置、σ 决定分布宽窄。',
        '开启 σ 区域时，可说明 68-95-99.7 法则。'
      ];
    case 'linearRegression':
      return [
        '可解释回归方程、相关系数 r 和决定系数 r² 的含义。',
        '如果散点呈明显非线性，应提示线性模型可能只是近似。'
      ];
    case 'lawOfLargeNumbers':
      return [
        '可解释随着试验次数增加，频率曲线逐渐靠近理论概率。',
        '多条曲线初期波动不同，但长期趋势应更稳定。'
      ];
  }
  return [];
}

export function buildM05AiContext(): M05AiContext {
  const simulationState = useSimulationStore.getState();
  const uiState = useUIStore.getState();
  const animationState = useAnimationStore.getState();
  const existingSimulations = Object.values(simulationState.simulations).map(summarizeSimulation);
  const activeSimulation = simulationState.activeSimId
    ? existingSimulations.find((item) => item.id === simulationState.activeSimId) ?? null
    : null;

  return {
    templateKey: 'm05',
    summary: activeSimulation
      ? `当前是${activeSimulation.label}，参数为 ${JSON.stringify(activeSimulation.params)}，${activeSimulation.hasResult ? '已有模拟结果' : '尚未运行模拟'}。`
      : '当前没有激活的概率统计模拟。',
    activeSimulation,
    existingSimulations,
    availableSimulationTypes: SIMULATION_LIST.map((item) => ({
      type: item.type,
      label: item.label,
      category: item.category,
      description: item.description,
      defaultParams: item.defaultParams,
    })),
    datasets: {
      histogram: HISTOGRAM_DATASETS.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        size: item.data.length,
      })),
      regression: REGRESSION_DATASETS.map((item) => ({
        id: item.id,
        name: item.name,
        xLabel: item.xLabel,
        yLabel: item.yLabel,
        description: item.description,
        size: item.points.length,
      })),
    },
    ui: {
      activeCategory: uiState.activeCategory,
      showResultPanel: uiState.showResultPanel,
      animationSpeed: uiState.animationSpeed,
    },
    animation: {
      mode: animationState.mode,
      status: animationState.status,
      speed: animationState.speed,
      singleTrialCount: animationState.singleTrials.length,
    },
    resultInterpretationHints: buildResultHints(
      simulationState.activeSimId ? simulationState.simulations[simulationState.activeSimId] : undefined,
    ),
    constraints: [
      'AI 只能输出 operations、patch、explanation、warnings，不要输出 envelope。',
      '不要手写模拟结果、随机样本、轨迹点或统计表；结果必须由 M05 模拟引擎计算。',
      '修改参数前必须确认目标 simulation type；不同模拟类型的参数字段不可混用。',
      '正态分布 sigma 必须大于 0；概率 p 必须在 0 到 1 之间。',
      '超几何分布必须满足 M <= N 且 n <= N。',
      '直方图和茎叶图的数据源优先使用 datasets.histogram 中的 presetId；手动数据必须是数字列表。',
      '线性回归数据集必须来自 datasets.regression。',
    ],
  };
}
