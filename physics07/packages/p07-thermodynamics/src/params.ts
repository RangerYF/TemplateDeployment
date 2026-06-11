import { defineParams } from '@physics/core';
import type { SceneName } from './types';

export const paramDefs = defineParams([
  // --- Gas Particles ---
  { key: 'temperature', label: '温度 T', unit: 'K', min: 100, max: 1000, step: 10, default: 300,
    scenes: ['气体分子微观模拟'] },
  { key: 'numParticles', label: '分子数量 N', unit: '个', min: 20, max: 500, step: 10, default: 100,
    scenes: ['气体分子微观模拟'] },
  { key: 'containerW', label: '容器宽度', unit: 'px', min: 100, max: 400, step: 10, default: 200,
    scenes: ['气体分子微观模拟'] },
  { key: 'containerH', label: '容器高度', unit: 'px', min: 100, max: 400, step: 10, default: 200,
    scenes: ['气体分子微观模拟'] },
  { key: 'showVelocity', label: '显示速度箭头', type: 'checkbox', default: false,
    scenes: ['气体分子微观模拟'] },
  { key: 'showDistribution', label: '显示速率分布', type: 'checkbox', default: true,
    scenes: ['气体分子微观模拟'] },

  // --- Gas Laws ---
  { key: 'gasFocus', label: '观察模式', type: 'select', default: '三法对比',
    options: ['等温过程', '等压过程', '等容过程', '三法对比'],
    scenes: ['三种气体实验'] },
  { key: 'gasT', label: '温度 T', unit: 'K', min: 100, max: 1000, step: 10, default: 300,
    scenes: ['三种气体实验'] },
  { key: 'gasV', label: '体积 V', unit: 'L', min: 0.5, max: 12, step: 0.5, default: 2.0,
    scenes: ['三种气体实验'] },
  { key: 'gasP', label: '压强 P', unit: 'kPa', min: 10, max: 1000, step: 10, default: 100,
    scenes: ['三种气体实验'] },

  // --- Liquid Column ---
  { key: 'tubeOrientation', label: '管方向', type: 'select', default: '竖直开口向上',
    options: ['竖直开口向上', '竖直开口向下', '水平', '倾斜开口向上', '倾斜开口向下', 'U型管', '两端密封'],
    scenes: ['液柱密封模型'] },
  { key: 'lcT1', label: '初始温度 T₁', unit: 'K', min: 200, max: 400, step: 1, default: 300,
    scenes: ['液柱密封模型'] },
  { key: 'lcT2', label: '末温度 T₂', unit: 'K', min: 200, max: 600, step: 1, default: 400,
    scenes: ['液柱密封模型'] },
  { key: 'lcL1', label: '气柱长 L₁', unit: 'cm', min: 5, max: 50, step: 1, default: 20,
    scenes: ['液柱密封模型'] },
  { key: 'lcH', label: '液柱长 h', unit: 'cm', min: 2, max: 30, step: 1, default: 10,
    scenes: ['液柱密封模型'] },
  { key: 'lcAngle', label: '倾角 θ', unit: '°', min: 0, max: 90, step: 1, default: 30,
    scenes: ['液柱密封模型'] },
  { key: 'lcArea', label: '截面积 S', unit: 'cm²', min: 0.5, max: 5.0, step: 0.1, default: 1.0,
    scenes: ['液柱密封模型'] },
  { key: 'lcPAtm', label: '大气压 P₀', unit: 'cmHg', min: 70, max: 80, step: 1, default: 76,
    scenes: ['液柱密封模型'] },

  // --- Piston-Cylinder ---
  { key: 'pcMode', label: '模型类型', type: 'select', default: '单活塞',
    options: ['单活塞', '中间活塞'],
    scenes: ['气缸/双活塞模型'] },
  { key: 'cylinderOrientation', label: '气缸方向', type: 'select', default: '竖直',
    options: ['竖直', '水平'],
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcT1', label: '初始温度 T₁', unit: 'K', min: 200, max: 400, step: 1, default: 300,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcT2', label: '末温度 T₂', unit: 'K', min: 200, max: 600, step: 1, default: 450,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcPistonMass', label: '活塞质量 m', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 1.0,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcHeatPosition', label: '加热位置', type: 'select', default: '左',
    options: ['左', '右', '两侧'],
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcArea', label: '截面积 S', unit: 'cm²', min: 1, max: 50, step: 1, default: 10,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcL1', label: '初始气柱长 L', unit: 'cm', min: 5, max: 50, step: 1, default: 20,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcPAtm', label: '大气压 P₀', unit: 'kPa', min: 50, max: 200, step: 1, default: 101,
    scenes: ['气缸/双活塞模型'] },

  // --- Brownian ---
  { key: 'brownTemperature', label: '温度 T', unit: 'K', min: 200, max: 500, step: 10, default: 300,
    scenes: ['布朗运动'] },
  { key: 'brownNumParticles', label: '气体分子数', unit: '个', min: 50, max: 500, step: 10, default: 200,
    scenes: ['布朗运动'] },
  { key: 'brownRadius', label: '颗粒半径', unit: 'μm', min: 0.1, max: 10, step: 0.1, default: 1.0,
    scenes: ['布朗运动'] },
  { key: 'trailInterval', label: '轨迹记录间隔', unit: 's', min: 0.1, max: 2.0, step: 0.1, default: 0.5,
    scenes: ['布朗运动'] },
]);

export const sceneParamMap: Record<string, string[]> = {
  // 显示选项 (showVelocity/showDistribution) 由 sceneConfig.displayToggles 的开关统一承载，
  // 不再在参数区重复出现复选框。
  '气体分子微观模拟': ['temperature', 'numParticles', 'containerW', 'containerH'],
  '三种气体实验': ['gasT', 'gasV'],
  '液柱密封模型': ['lcT1', 'lcT2', 'lcL1', 'lcH', 'lcAngle', 'lcPAtm'],
  '气缸/双活塞模型': ['pcT1', 'pcT2', 'pcPistonMass', 'pcHeatPosition', 'pcArea', 'pcL1', 'pcPAtm'],
  '布朗运动': ['brownTemperature', 'brownNumParticles', 'brownRadius', 'trailInterval'],
};

export const sceneNames: SceneName[] = [
  '气体分子微观模拟',
  '三种气体实验',
  '液柱密封模型',
  '气缸/双活塞模型',
  '布朗运动',
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function isTiltedLiquidColumn(orientation: string): boolean {
  return orientation.startsWith('倾斜');
}

export function isNegativePressureLiquidColumn(orientation: string): boolean {
  return orientation === '竖直开口向下' || orientation === '倾斜开口向下';
}
