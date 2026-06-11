import type { SceneConfig, SceneName } from './types';

export const sceneConfigs: Record<SceneName, SceneConfig> = {
  '气体分子微观模拟': {
    name: '气体分子微观模拟',
    tabLabel: '气体分子微观模拟',
    description: '容器内气体分子做无规则热运动，温度是分子平均动能的标志',
    modelId: 'THM-001',
    models: [
      { id: 'THM-001', label: '标准容器', paramOverrides: {} },
    ],
    presets: [],
    displayToggles: [
      { key: 'showVelocity', label: '速度箭头', default: false },
      { key: 'showDistribution', label: '速率分布', default: true },
    ],
    teaching: {
      coreValues: [
        { label: 'T', dynamicKey: 'temperature' },
        { label: '气体', staticValue: 'N₂' },
      ],
      insight: '温度升高 → 平均速率增大；体积减小 → 碰壁更频繁，压强增大',
      formulas: [
        '平均动能  Ek = 3/2 · kB·T',
        '均方根速率  vrms = √(3kBT/m)',
        'pV = nRT',
        '固定气体种类时  pV/(N·T) ≈ 常数',
      ],
      summary: '观察粒子速度颜色、碰壁闪光和速率分布曲线：微观碰撞累积成压强，温度改变整体速率统计。',
      bullets: [
        '温度描述大量分子的平均动能，不代表每个分子同速运动',
        '碰壁越频繁、越剧烈，宏观压强越大',
        '升温时速率分布整体右移并展宽',
        '用 pV/(N·T) 的稳定性连接动画、数值和状态方程',
      ],
    },
  },

  '三种气体实验': {
    name: '三种气体实验',
    tabLabel: '三种气体实验',
    description: '等温、等压、等容三种典型过程，验证理想气体状态方程',
    modelId: 'THM-010',
    models: [
      { id: 'THM-010', label: '等温过程', paramOverrides: { gasFocus: '等温过程', gasV: 2.0, gasT: 300 } },
      { id: 'THM-020', label: '等压过程', paramOverrides: { gasFocus: '等压过程', gasV: 2.0, gasT: 300 } },
      { id: 'THM-021', label: '等容过程', paramOverrides: { gasFocus: '等容过程', gasV: 2.0, gasT: 300 } },
      { id: 'THM-030', label: '三法对比', paramOverrides: { gasFocus: '三法对比', gasV: 2.0, gasT: 300 } },
    ],
    presets: [],
    displayToggles: [],
    teaching: {
      coreValues: [
        { label: 'pV=C', staticValue: '等温' },
        { label: 'V/T=C', staticValue: '等压' },
        { label: 'p/T=C', staticValue: '等容' },
      ],
      insight: '先找不变量：等温看 p-V，等压看 V-T，等容看 p-T',
      formulas: [
        'pV = C （等温过程）',
        'V/T = C （等压过程）',
        'p/T = C （等容过程）',
        'p₁V₁/T₁ = p₂V₂/T₂',
      ],
      summary: '三列实验台同屏比较三种特例：每列固定一个状态量，再观察另外两个量如何随图像移动。',
      bullets: [
        '等温：T 固定，p 与 V 成反比，p-V 图为双曲线',
        '等压：p 固定，V 与 T 成正比，V-T 图为直线',
        '等容：V 固定，p 与 T 成正比，p-T 图为直线',
        '三种过程都来自 pV = nRT',
      ],
    },
  },

  '液柱密封模型': {
    name: '液柱密封模型',
    tabLabel: '液柱密封模型',
    description: '玻璃管内液柱密封气体，通过温度变化观察气柱长度变化',
    modelId: 'THM-031',
    models: [
      { id: 'THM-031', label: '竖直↑', paramOverrides: { tubeOrientation: '竖直开口向上' } },
      { id: 'THM-032', label: '竖直↓', paramOverrides: { tubeOrientation: '竖直开口向下' } },
      { id: 'THM-033', label: '水平', paramOverrides: { tubeOrientation: '水平' } },
      { id: 'THM-034', label: '倾斜↑', paramOverrides: { tubeOrientation: '倾斜开口向上' } },
      { id: 'THM-035', label: '倾斜↓', paramOverrides: { tubeOrientation: '倾斜开口向下' } },
      { id: 'THM-036', label: 'U型管', paramOverrides: { tubeOrientation: 'U型管' } },
      { id: 'THM-037', label: '两端密封', paramOverrides: { tubeOrientation: '两端密封' } },
    ],
    presets: [],
    displayToggles: [],
    teaching: {
      coreValues: [
        { label: 'P₀', dynamicKey: 'lcPAtm' },
        { label: 'T₂', dynamicKey: 'lcT2' },
      ],
      insight: '先分析压强（力的平衡），再用气体状态方程求解',
      formulas: [
        'P₁V₁/T₁ = P₂V₂/T₂',
        '竖直↑: P = P₀ + ρgh',
        '竖直↓: P = P₀ - ρgh',
        '倾斜: h_eff = h·sinθ',
      ],
      summary: '液柱密封气体问题的核心：先通过受力分析确定气体压强，再利用状态方程列方程求解。管的方向决定了液柱对气体压强的贡献方式。',
      bullets: [
        '先分析压强（力的平衡），再用状态方程',
        '竖直向上: P = P₀ + h; 向下: P = P₀ - h',
        '倾斜管: 有效液柱高度 h·sinθ',
        'U型管: 两臂液面高度差 = 压强差',
        '两端密封: 需联立两段气体状态方程',
      ],
    },
  },

  '气缸/双活塞模型': {
    name: '气缸/双活塞模型',
    tabLabel: '气缸/活塞',
    description: '活塞可自由移动的气缸模型，分析加热后气体状态变化',
    modelId: 'THM-038',
    models: [
      { id: 'THM-038', label: '竖直单活塞', paramOverrides: { pcMode: '单活塞', cylinderOrientation: '竖直' } },
      { id: 'THM-039', label: '水平单活塞', paramOverrides: { pcMode: '单活塞', cylinderOrientation: '水平' } },
      { id: 'THM-040', label: '中间活塞', paramOverrides: { pcMode: '中间活塞', pcHeatPosition: '左' } },
    ],
    presets: [],
    displayToggles: [],
    teaching: {
      coreValues: [
        { label: 'P₀', dynamicKey: 'pcPAtm' },
        { label: 'm', dynamicKey: 'pcPistonMass' },
      ],
      insight: '单活塞：自由移动→等压；中间活塞：两段气体联立+压强平衡',
      formulas: [
        '单活塞竖直: P = P₀ + mg/S',
        '单活塞水平: P = P₀',
        '中间活塞: P左 = P右（压强平衡）',
        'L热 = 2L₁T₂/(T₁+T₂), L冷 = 2L₁T₁/(T₁+T₂)',
      ],
      summary: '单活塞自由移动时气体等压变化，竖直放置时活塞重力增大气压。中间活塞模型：一个自由活塞耦合两段气体，加热一侧推动活塞压缩另一侧，需联立两段状态方程并用压强平衡求解，是常考题型。',
      bullets: [
        '单活塞 → 等压过程，竖直时 P=P₀+mg/S',
        '中间活塞: 加热一侧→推活塞→压另一侧',
        '中间活塞核心: 压强平衡 P左=P右 + 总长守恒',
        '需联立两段气体状态方程求解',
      ],
    },
  },

  '布朗运动': {
    name: '布朗运动',
    tabLabel: '布朗运动',
    description: '花粉颗粒受大量分子不均匀撞击做无规则运动',
    modelId: 'THM-041',
    models: [
      { id: 'THM-041', label: '布朗运动', paramOverrides: {} },
    ],
    presets: [],
    displayToggles: [
      { key: 'showTrail', label: '运动轨迹', default: true },
    ],
    teaching: {
      coreValues: [
        { label: '颗粒', dynamicKey: 'brownRadius' },
        { label: 'T', dynamicKey: 'brownTemperature' },
      ],
      insight: '颗粒越小 → 运动越剧烈；温度越高 → 运动越剧烈',
      formulas: [
        '布朗运动 ≠ 分子运动',
        '<x²> = 2Dt',
        'D = kBT / (6πηr)',
      ],
      summary: '布朗运动是悬浮微粒受大量分子不均匀撞击产生的无规则运动，间接证明分子做无规则运动。不是分子运动本身。',
      bullets: [
        '布朗运动不是分子运动本身，是分子撞击的宏观表现',
        '颗粒越小，受力越不平衡，运动越不规则',
        '温度越高，分子越剧烈，布朗运动越明显',
        '折线连接等间隔采样点，并非真实连续轨迹',
      ],
    },
  },
};
