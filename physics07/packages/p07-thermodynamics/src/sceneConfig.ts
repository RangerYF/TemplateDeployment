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
    presets: [
      { label: '室温氮气', params: { temperature: 300, numParticles: 100, containerW: 200, containerH: 200 } },
      { label: '高温快速', params: { temperature: 800, numParticles: 200, containerW: 200, containerH: 200 } },
      { label: '低温缓慢', params: { temperature: 150, numParticles: 50, containerW: 200, containerH: 200 } },
      { label: '高密度', params: { temperature: 300, numParticles: 400, containerW: 150, containerH: 150 } },
      { label: '低密度', params: { temperature: 300, numParticles: 30, containerW: 350, containerH: 350 } },
    ],
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
      { id: 'THM-010', label: '等温过程', paramOverrides: { gasFocus: '等温过程', gasP: 100, gasV: 0.8, gasT: 300 } },
      { id: 'THM-020', label: '等压过程', paramOverrides: { gasFocus: '等压过程', gasP: 100, gasV: 2.0, gasT: 600 } },
      { id: 'THM-021', label: '等容过程', paramOverrides: { gasFocus: '等容过程', gasP: 100, gasV: 2.0, gasT: 600 } },
      { id: 'THM-030', label: '三法对比', paramOverrides: { gasFocus: '三法对比', gasP: 180, gasV: 4.0, gasT: 450 } },
    ],
    presets: [
      { label: '基准状态', params: { gasFocus: '三法对比', gasP: 100, gasV: 2.0, gasT: 300 } },
      { label: '观察等温压缩', params: { gasFocus: '等温过程', gasP: 100, gasV: 0.8, gasT: 300 } },
      { label: '观察等压升温', params: { gasFocus: '等压过程', gasP: 100, gasV: 2.0, gasT: 600 } },
      { label: '观察等容升温', params: { gasFocus: '等容过程', gasP: 100, gasV: 2.0, gasT: 600 } },
      { label: '三法对比', params: { gasFocus: '三法对比', gasP: 180, gasV: 4.0, gasT: 450 } },
    ],
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
    presets: [
      { label: '标准竖直', params: { tubeOrientation: '竖直开口向上', lcL1: 20, lcH: 10, lcT1: 300, lcT2: 400 } },
      { label: '大温差', params: { tubeOrientation: '竖直开口向上', lcL1: 20, lcH: 10, lcT1: 200, lcT2: 500 } },
      { label: '短气柱', params: { tubeOrientation: '竖直开口向上', lcL1: 8, lcH: 15, lcT1: 300, lcT2: 450 } },
      { label: '倾斜30°', params: { tubeOrientation: '倾斜开口向上', lcL1: 20, lcH: 10, lcT1: 300, lcT2: 400, lcAngle: 30 } },
      { label: 'U型管', params: { tubeOrientation: 'U型管', lcL1: 20, lcH: 10, lcT1: 300, lcT2: 400 } },
      { label: '两端密封', params: { tubeOrientation: '两端密封', lcL1: 20, lcH: 10, lcT1: 300, lcT2: 400 } },
    ],
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
      { id: 'THM-040', label: '双活塞', paramOverrides: { pcMode: '双活塞' } },
    ],
    presets: [
      { label: '标准竖直', params: { pcMode: '单活塞', cylinderOrientation: '竖直', pcPistonMass: 1.0, pcArea: 10, pcT1: 300, pcT2: 450 } },
      { label: '重活塞', params: { pcMode: '单活塞', cylinderOrientation: '竖直', pcPistonMass: 5.0, pcArea: 10, pcT1: 300, pcT2: 450 } },
      { label: '水平标准', params: { pcMode: '单活塞', cylinderOrientation: '水平', pcPistonMass: 1.0, pcArea: 10, pcT1: 300, pcT2: 450 } },
      { label: '大面积', params: { pcMode: '单活塞', cylinderOrientation: '竖直', pcPistonMass: 1.0, pcArea: 40, pcT1: 300, pcT2: 450 } },
      { label: '双活塞对称', params: { pcMode: '双活塞', pcPistonMassLeft: 1.0, pcPistonMassRight: 1.0, pcArea: 10, pcT1: 300, pcT2: 450, pcHeatPosition: '左' } },
      { label: '双活塞不对称', params: { pcMode: '双活塞', pcPistonMassLeft: 2.0, pcPistonMassRight: 1.0, pcArea: 10, pcT1: 300, pcT2: 450, pcHeatPosition: '左' } },
    ],
    displayToggles: [],
    teaching: {
      coreValues: [
        { label: 'P₀', dynamicKey: 'pcPAtm' },
        { label: 'm', dynamicKey: 'pcPistonMass' },
      ],
      insight: '活塞可自由移动 → 等压过程；竖直时活塞重力影响气体压强',
      formulas: [
        '竖直: P = P₀ + mg/S',
        '水平: P = P₀',
        'V₁/T₁ = V₂/T₂ （等压）',
        'L₂ = L₁ · T₂/T₁',
      ],
      summary: '活塞可自由移动意味着气体压强恒定（等压过程）。竖直放置时，活塞重力会增加气体压强；水平放置时，活塞重力不影响。双活塞模型需要分析两侧压强平衡。',
      bullets: [
        '活塞可自由移动 → 等压过程',
        '竖直: 活塞重力影响气体压强 P = P₀+mg/S',
        '水平: P = P₀，重力不影响',
        '双活塞: 两侧压强平衡是求解关键',
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
    presets: [
      { label: '标准花粉', params: { brownRadius: 1.0, brownTemperature: 300, brownNumParticles: 200 } },
      { label: '大颗粒', params: { brownRadius: 5.0, brownTemperature: 300, brownNumParticles: 200 } },
      { label: '小颗粒', params: { brownRadius: 0.3, brownTemperature: 300, brownNumParticles: 200 } },
      { label: '高温剧烈', params: { brownRadius: 1.0, brownTemperature: 500, brownNumParticles: 300 } },
      { label: '低温缓慢', params: { brownRadius: 1.0, brownTemperature: 200, brownNumParticles: 100 } },
    ],
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
