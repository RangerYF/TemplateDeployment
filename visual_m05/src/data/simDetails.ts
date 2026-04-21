/**
 * Detailed educational descriptions for each simulation type.
 * Extracted from InspectorPanel for shared use across Canvas + Inspector.
 */
import type { SimulationType } from '@/types/simulation';

export const SIM_DETAILS: Record<SimulationType, { title: string; detail: string; realWorld?: string }> = {
  coinFlip: {
    title: '抛硬币实验',
    detail: '通过大量重复抛硬币，观察正面朝上的频率如何趋近理论概率 1/2。这是理解"频率与概率关系"的最经典实验。',
    realWorld: '生活应用：体育比赛中用抛硬币决定先后手，其公平性正是基于 P(正面)=0.5。',
  },
  diceRoll: {
    title: '掷骰子实验',
    detail: '标准六面骰子每个面的理论概率为 1/6 ≈ 0.1667。可选择统计事件（奇数点、偶数点、≥n点）来验证事件概率的计算。',
    realWorld: '生活应用：桌游掷骰子、彩票中奖概率计算都涉及古典概型。',
  },
  twoDiceSum: {
    title: '骰子点数之和',
    detail: '两个骰子点数之和的分布呈三角形：和为7的概率最高(6/36)，和为2或12的概率最低(1/36)。随骰子数增加，分布趋近正态。',
    realWorld: '生活应用：大富翁等桌游中两颗骰子的点数和规则，不同点数和出现概率不同。',
  },
  ballDraw: {
    title: '摸球实验',
    detail: '从袋中取球的概率模型。无放回抽样服从超几何分布 H(N,M,n)，有放回抽样服从二项分布 B(n,p)。对比两种方式的频率分布差异。',
    realWorld: '生活应用：质量抽检（从一批产品中随机抽取检验）、彩票摇号。',
  },
  monteCarloPi: {
    title: '蒙特卡洛估算 π',
    detail: '在正方形内随机投点，圆内点数与总点数之比趋近 π/4。因此 π ≈ 4×(圆内点数/总点数)。这是几何概型的经典应用。',
    realWorld: '蒙特卡洛方法广泛应用于金融风险评估、物理模拟、人工智能等领域。',
  },
  meetingProblem: {
    title: '约会相遇问题',
    detail: '甲乙各自在 [0,T] 内随机到达，等待 t 分钟后离开。相遇条件 |x-y|≤t 对应正方形中带状区域。理论概率 P = 1-(1-t/T)²。',
    realWorld: '生活应用：两人约好在某时间段内碰面，但不确定对方何时到达，这就是约会问题的原型。',
  },
  buffonsNeedle: {
    title: '布丰投针实验',
    detail: '将长度为 l 的针随机投到间距为 d 的平行线上，穿越概率为 P=2l/(πd)。因此可用 π ≈ 2l/(P·d) 来估算圆周率。',
    realWorld: '历史上最早的蒙特卡洛方法之一（1777年），展示了概率论与几何学之间的深刻联系。',
  },
  histogram: {
    title: '频率分布直方图',
    detail: '将数据分成若干区间，纵轴为频率/组距，直方图面积之和=1。通过调整组数可观察数据分布形态（正态、偏态、双峰等）。',
  },
  stemLeaf: {
    title: '茎叶图',
    detail: '保留原始数据的统计图表。茎代表高位数字，叶代表低位数字。可快速识别中位数、众数和数据集中趋势。',
  },
  binomialDist: {
    title: '二项分布 B(n,p)',
    detail: 'n次独立伯努利试验中成功次数X的概率分布。期望 E(X)=np，方差 D(X)=np(1-p)。当 n 较大时趋近正态分布。',
    realWorld: '生活应用：产品合格率检测、投篮命中次数、考试选择题全靠猜的正确数。',
  },
  normalDist: {
    title: '正态分布 N(μ,σ²)',
    detail: '自然界最常见的概率分布。68-95-99.7法则：约68.27%的数据落在μ±σ内，95.45%在μ±2σ内，99.73%在μ±3σ内。',
    realWorld: '生活应用：身高、体重、考试成绩等大量自然和社会现象近似服从正态分布。',
  },
  hypergeometricDist: {
    title: '超几何分布 H(N,M,n)',
    detail: '总体N个中有M个目标物，不放回抽取n个，抽中k个目标物的概率。与二项分布的区别在于不放回。E(X)=nM/N。',
  },
  linearRegression: {
    title: '线性回归分析',
    detail: '用最小二乘法拟合散点数据的最佳直线 ŷ=bx+a。回归直线一定过样本中心点(x̄,ȳ)。相关系数 r 衡量线性相关程度。',
    realWorld: '生活应用：广告投入与销售额的关系预测、气温与冰淇淋销量的关联分析。',
  },
  lawOfLargeNumbers: {
    title: '大数定律演示',
    detail: '随着试验次数n增加，事件的频率逐渐稳定地趋近其概率。这是概率论最基本的定理之一，也是"用频率估计概率"的理论基础。',
    realWorld: '生活应用：保险公司根据大数定律来设定保费——大量保单的赔付频率趋近于理论概率。',
  },
};

/** Parameter meaning descriptions for the inspector panel */
export const PARAM_DESCRIPTIONS: Record<SimulationType, string[]> = {
  coinFlip: [
    'n — 投掷硬币的总次数',
  ],
  diceRoll: [
    'n — 投掷轮数',
    '骰子数量 — 每轮投掷几个骰子',
    '统计事件 — 要统计的目标事件（奇数点/偶数点/≥n点）',
  ],
  twoDiceSum: [
    'n — 投掷轮数',
    '骰子数量 — 每轮投掷几个骰子，观察点数之和',
  ],
  ballDraw: [
    'n — 抽取轮数',
    '红球数量 — 袋中红球个数',
    '白球数量 — 袋中白球个数',
    '每次取球 — 每轮取出的球数',
    '放回方式 — 有放回(二项分布)或无放回(超几何分布)',
  ],
  monteCarloPi: [
    'n — 投点总数',
    '点越多估算越精确，但计算越慢',
  ],
  meetingProblem: [
    'T — 约定时间区间长度（分钟）',
    't — 每人到达后等待时长（分钟）',
    'n — 模拟次数',
  ],
  buffonsNeedle: [
    'n — 投针次数',
    '针长 l — 针的长度',
    '线距 d — 平行线间距',
  ],
  histogram: [
    '数据来源 — 预设数据集或自定义数据',
    '组数 — 直方图分组数量',
  ],
  stemLeaf: [
    '数据来源 — 预设数据集或自定义数据',
  ],
  binomialDist: [
    'n — 试验次数',
    'p — 单次成功概率',
    '显示CDF — 是否叠加累积分布曲线',
  ],
  normalDist: [
    'μ — 均值（分布中心位置）',
    'σ — 标准差（分布宽窄程度）',
    '显示σ区域 — 是否标注1σ/2σ/3σ范围',
  ],
  hypergeometricDist: [
    'N — 总体数量',
    'M — 目标物数量',
    'n — 抽取数量',
    '显示CDF — 是否叠加累积分布曲线',
  ],
  linearRegression: [
    '数据集 — 选择预设数据集',
    '显示残差 — 是否绘制残差线段',
  ],
  lawOfLargeNumbers: [
    '场景 — 选择概率模型（抛硬币/掷骰子等）',
    'n — 最大试验次数',
  ],
};
