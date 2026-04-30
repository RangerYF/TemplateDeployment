import { isPresetVisible } from '@/app-config';
import { presetRegistry } from '@/core/registries/preset-registry';
import type { PresetData } from '@/core/types';

export const P08_PRODUCT_CATEGORY = 'P-08';

interface P08ModuleConfig {
  key: 'electrostatic' | 'particle-electric' | 'magnetostatic' | 'particle-magnetic' | 'combined-field';
  title: string;
  summary: string;
  teachingUse: string;
  recommendedPresetId: string;
  pendingNote?: string;
  presetIds: string[];
}

export const P08_MODULES: readonly P08ModuleConfig[] = [
  {
    key: 'electrostatic',
    title: '静电场',
    summary: '单点电荷、双点电荷与平行板电容器，聚焦电场线、等势线、电势分布和两点电势差。',
    teachingUse: '建议先看“单点电荷场”，再切到“双点电荷场”和“平行板电容器”，把方向、等值线和整体电势高低变化串起来讲。',
    recommendedPresetId: 'P02-EMF001-point-charge-field',
    presetIds: [
      'P02-EMF001-point-charge-field',
      'P02-EMF002-two-charges-field',
      'P02-EMF003-parallel-plate-efield',
    ],
  },
  {
    key: 'particle-electric',
    title: '带电粒子在电场中',
    summary: '加速电场、电容器偏转模型与两段式电场，聚焦 qU = ΔEk、入口速度、偏转量和出口偏角。',
    teachingUse: '建议先看“加速电场”，再切到“两段式电场模型”把加速与偏转串起来，最后用“电容器偏转模型”做单段偏转对比。',
    recommendedPresetId: 'P02-EMF013-two-stage-efield',
    presetIds: [
      'P02-EMF013-two-stage-efield',
      'P02-EMF012-efield-deflection',
      'P02-EMF011-efield-acceleration',
    ],
  },
  {
    key: 'magnetostatic',
    title: '静磁场',
    summary: '长直导线、圆形电流、螺线管磁感线，以及导线在外磁场中的安培力方向演示。',
    teachingUse: '建议先看“长直导线磁场”，再切到“螺线管磁场”和“安培力方向演示”完成定则与受力方向串讲。',
    recommendedPresetId: 'P02-EMF021-wire-bfield',
    presetIds: [
      'P02-EMF021-wire-bfield',
      'P02-EMF022-circular-current-bfield',
      'P02-EMF023-solenoid-bfield',
      'P02-EMF024-ampere-force-wire-bfield',
    ],
  },
  {
    key: 'particle-magnetic',
    title: '带电粒子在磁场中',
    summary: '洛伦兹力圆周运动、直线/圆形/半圆边界、平移圆、旋转圆、放缩圆、双边界、磁聚焦与磁发散。',
    teachingUse: '建议先看“洛伦兹力圆周运动”，再进入边界模型，以及平移圆/旋转圆/放缩圆与磁聚焦/磁发散的成对对比。',
    recommendedPresetId: 'P02-EM003-cyclotron-motion',
    presetIds: [
      'P02-EM003-cyclotron-motion',
      'P02-EMF031-bfield-straight-boundary',
      'P02-EMF032-bfield-circular-boundary',
      'P02-EMF037-translation-circle',
      'P02-EMF038-rotation-circle',
      'P02-EMF039-scaling-circle',
      'P02-EMF034-bfield-dual-boundary',
      'P02-EMF035-bfield-semicircle',
      'P02-EMF033-magnetic-focusing',
      'P02-EMF036-magnetic-divergence',
    ],
  },
  {
    key: 'combined-field',
    title: '复合场',
    summary: '速度选择器、回旋加速器、电磁流量计，以及静电场 / 重力场圆周运动临界模型。',
    teachingUse: '建议先看“速度选择器”，再切到“回旋加速器”、“电磁流量计”和“静电场 / 重力场圆周运动临界”。',
    recommendedPresetId: 'P02-EMF041-velocity-selector',
    presetIds: [
      'P02-EMF041-velocity-selector',
      'P02-EMF042-cyclotron',
      'P02-EMF043-em-flowmeter',
      'P02-EMF044-electrogravity-circular-motion',
    ],
  },
] as const;

export type P08ModuleKey = typeof P08_MODULES[number]['key'];

export interface P08ModuleSection {
  key: P08ModuleKey;
  title: string;
  summary: string;
  teachingUse: string;
  recommendedPresetId: string;
  recommendedPresetName?: string;
  pendingNote?: string;
  presets: PresetData[];
}

export const P08_PRESET_IDS: Set<string> = new Set(
  P08_MODULES.flatMap((module) => module.presetIds),
);

const P08_SCENE_TEACHING_USES: Record<string, string> = {
  'P02-EMF001-point-charge-field': '库仑定律、场强与电势的空间分布。',
  'P02-EMF002-two-charges-field': '电偶极子、同号电荷与不等量异号构型对比。',
  'P02-EMF003-parallel-plate-efield': '匀强电场近似、边缘效应与板间电势差。',
  'P02-EMF011-efield-acceleration': '电场力做功、动能定理与加速电场。',
  'P02-EMF012-efield-deflection': '类平抛轨迹、偏转量、出口偏角与接收屏落点。',
  'P02-EMF013-two-stage-efield': '先由加速电场给出入口速度，再在偏转电场中比较偏移量、出口偏角与接收屏落点。',
  'P02-EMF021-wire-bfield': '安培定则以及 B 与 r 的反比关系。',
  'P02-EMF022-circular-current-bfield': '环形电流中心磁场大小规律。',
  'P02-EMF023-solenoid-bfield': 'B ≈ μ0nI 与内部近似匀强磁场。',
  'P02-EMF024-ampere-force-wire-bfield': '左手定则与 F = BIL 的方向判断。',
  'P02-EM003-cyclotron-motion': 'r = mv / (|q|B)、T = 2πm / (|q|B)。',
  'P02-EMF031-bfield-straight-boundary': '入射角、偏转角与出射对称关系。',
  'P02-EMF032-bfield-circular-boundary': '轨迹圆与磁场区域圆的几何关系。',
  'P02-EMF037-translation-circle': '同速度、不同入射点下的等半径平移圆轨迹族。',
  'P02-EMF038-rotation-circle': '同一点、不同入射角下的等半径旋转圆轨迹族。',
  'P02-EMF039-scaling-circle': '同一点、同方向下的多半径放缩圆轨迹族。',
  'P02-EMF034-bfield-dual-boundary': '分段磁场中的 S 形偏转与几何拼接。',
  'P02-EMF035-bfield-semicircle': '半圆边界题型中的出射角与回旋半径。',
  'P02-EMF033-magnetic-focusing': '以基准会聚轨道半径定义磁场圆，观察同源粒子在圆内汇聚到同一焦点。',
  'P02-EMF036-magnetic-divergence': '以 baseSpeed 参考粒子的回旋半径定义磁场圆，比对不同速度粒子的圆弧发散。',
  'P02-EMF041-velocity-selector': '电场力与磁场力反向平衡时，粒子按 v = E / B 直线通过。',
  'P02-EMF042-cyclotron': '回旋周期、加速半径与交变电场配合。',
  'P02-EMF043-em-flowmeter': 'E = vB 与 U = BvL 的流速测量。',
  'P02-EMF044-electrogravity-circular-motion': '把带电小球看作绳拴小球，比较完整圆周、临界过顶与松绳后斜抛。',
};

export function getP08SceneTeachingUse(presetId: string): string {
  return P08_SCENE_TEACHING_USES[presetId] ?? '用于课堂演示当前场景的关键规律。';
}

export function getP08ModuleSections(): P08ModuleSection[] {
  return P08_MODULES.map((module) => ({
    key: module.key,
    title: module.title,
    summary: module.summary,
    teachingUse: module.teachingUse,
    recommendedPresetId: module.recommendedPresetId,
    recommendedPresetName: presetRegistry.get(module.recommendedPresetId)?.name,
    pendingNote: module.pendingNote,
    presets: module.presetIds.flatMap((presetId) => {
      const preset = presetRegistry.get(presetId);
      return preset && isPresetVisible(preset) ? [preset] : [];
    }),
  }));
}

export function getP08ModuleKeyByPresetId(presetId: string): P08ModuleKey | undefined {
  return P08_MODULES.find((module) => module.presetIds.includes(presetId))?.key;
}

export function isP08ModuleKey(value: string | null | undefined): value is P08ModuleKey {
  return P08_MODULES.some((module) => module.key === value);
}
