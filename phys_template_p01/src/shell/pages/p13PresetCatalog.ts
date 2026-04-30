import { isPresetVisible } from '@/app-config';
import { presetRegistry } from '@/core/registries/preset-registry';
import type { PresetData } from '@/core/types';
import { P13_LENZ_MAGNET_COIL_PRESET_ID } from '@/domains/em/p13/lenz-magnet-coil';
import {
  P13_SINGLE_ROD_RESISTIVE_PRESET_ID,
  P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID,
  P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID,
} from '@/domains/em/p13/single-rod';
import { P13_DOUBLE_ROD_BASIC_PRESET_ID } from '@/domains/em/p13/double-rod';
import { P13_MODEL_KEYS, type P13ModelKey } from '@/domains/em/p13/types';

export const P13_PRODUCT_CATEGORY = 'P-13';

export type P13ModelFamily =
  | 'motional-cut'
  | 'flux-change'
  | 'single-rod'
  | 'double-rod'
  | 'vertical-rail'
  | 'builder';

export interface P13ModelCardConfig {
  key: P13ModelKey;
  family: P13ModelFamily;
  code: string;
  title: string;
  summary: string;
  teachingUse: string;
  phaseNote: string;
  status: 'available' | 'planned';
  presetId?: string;
}

export interface P13ModelCard extends P13ModelCardConfig {
  preset?: PresetData;
}

export interface P13ProductTrack {
  key: P13ModelFamily;
  title: string;
  summary: string;
  note: string;
  models: P13ModelCard[];
}

const TRACK_META: Record<
  P13ModelFamily,
  Pick<P13ProductTrack, 'title' | 'summary' | 'note'>
> = {
  'motional-cut': {
    title: '线圈切割磁场（动生）',
    summary: '承接基础磁通量、感应电动势与安培力的最小闭环。',
    note: '当前保留 P13-BASE-001 作为可运行基线。',
  },
  'flux-change': {
    title: '磁通量变化（感生）',
    summary: '聚焦楞次定律的方向判断和逐步教学。',
    note: '当前开放 EMI-001。',
  },
  'single-rod': {
    title: '单棒模型',
    summary: '统一承接纯电阻、含电源、含电容三支模型的共用界面与终态分析。',
    note: 'Phase 4 已补齐 EMI-011~013。',
  },
  'double-rod': {
    title: '双棒模型',
    summary: '先开放双棒无摩擦基础模型，再逐步补齐含摩擦与含电容分支。',
    note: '本轮开放 EMI-021，EMI-022/023 仍保持占位。',
  },
  'vertical-rail': {
    title: '竖直导轨',
    summary: '后续承接重力与安培力平衡的终态分析。',
    note: '当前只保留结构位。',
  },
  builder: {
    title: '自由组装',
    summary: '后续为更复杂的电磁感应拓扑预留 builder 入口。',
    note: '本轮不提前实现 builder。',
  },
};

const P13_MODEL_CATALOG: readonly P13ModelCardConfig[] = [
  {
    key: P13_MODEL_KEYS.rectangularLoopUniformBField,
    family: 'motional-cut',
    code: 'P13-BASE-001',
    title: '矩形线框穿过匀强磁场',
    summary: '保留当前可运行样例，用于承接磁通量、感应电动势、感应电流和安培力标注的基础链路。',
    teachingUse: '适合讲“进入磁场 / 离开磁场时磁通量变化引起感应电流”的最小演示。',
    phaseNote: 'Phase 1 已接入新核心层，行为仍保持匀速 + 安培力仅标注。',
    status: 'available',
    presetId: 'P02-EM004-emf-induction',
  },
  {
    key: P13_MODEL_KEYS.lenzMagnetCoil,
    family: 'flux-change',
    code: 'EMI-001',
    title: '磁棒-线圈楞次定律',
    summary: '面向 N/S 极插入与拔出的方向判断，按“原磁通量 → 变化 → 感应电流 → 感应磁场 → 安培力”完整展开楞次定律链路。',
    teachingUse: '适合课堂对比四种情况，并用逐步分析交互带学生一层层判断方向。',
    phaseNote: 'Phase 2 已开放离散教学模型，暂不做终态动力学与图表系统。',
    status: 'available',
    presetId: P13_LENZ_MAGNET_COIL_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.singleRodResistive,
    family: 'single-rod',
    code: 'EMI-011',
    title: '单棒基础（纯电阻）',
    summary: '单棒在匀强磁场中切割磁感线，实时联动 ε、i、F安、v-t 与 i-t，并支持四步分析受力。',
    teachingUse: '适合串讲“BLv → 电流 → 安培力 → 速度衰减”的完整闭环。',
    phaseNote: 'Phase 3 已开放统一壳层与真实力-电-运动耦合。',
    status: 'available',
    presetId: P13_SINGLE_ROD_RESISTIVE_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.singleRodWithSource,
    family: 'single-rod',
    code: 'EMI-012',
    title: '单棒 + 含电源',
    summary: '固定电源极性约定下，展示外加电源如何改变电流方向、安培力和终态速度。',
    teachingUse: '适合讲解 v终 = ε0 / (BL) 与“电源驱动匀速”的课堂口径。',
    phaseNote: 'Phase 4 已开放，和 EMI-011 共用单棒壳层与图表系统。',
    status: 'available',
    presetId: P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.singleRodWithCapacitor,
    family: 'single-rod',
    code: 'EMI-013',
    title: '单棒 + 含电容',
    summary: '展示电容充电、电流衰减到 0，以及 U电容 = BLv终 的终态建立过程。',
    teachingUse: '适合讲解“含电容时 I终 = 0，速度与电容电压共同收口”的题型。',
    phaseNote: 'Phase 4 已开放，和 EMI-011 / EMI-012 共用单棒壳层与交互结构。',
    status: 'available',
    presetId: P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.doubleRod,
    family: 'double-rod',
    code: 'EMI-021',
    title: '双棒基础（无摩擦）',
    summary: '两棒在同一闭合回路中通过 ε = BL(v1-v2) 与回路电流耦合，安培力等大反向并推动系统走向共速。',
    teachingUse: '适合串讲“相对速度 → 电动势 → 电流 → 两棒受力 → 动量守恒终态”。',
    phaseNote: 'Phase 5 首支双棒模型，复用统一壳层并新增 v1-t / v2-t / i-t 三图联动。',
    status: 'available',
    presetId: P13_DOUBLE_ROD_BASIC_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.doubleRod,
    family: 'double-rod',
    code: 'EMI-022~023',
    title: '双棒扩展分支',
    summary: '保留含摩擦与含电容两支后续模型位，暂不在本轮实现。',
    teachingUse: '后续用于综合题的终态约束对比。',
    phaseNote: '本轮只实现 EMI-021，EMI-022/023 保持占位。',
    status: 'planned',
  },
  {
    key: P13_MODEL_KEYS.verticalRailRod,
    family: 'vertical-rail',
    code: 'EMI-031',
    title: '竖直导轨单棒',
    summary: '预留重力与安培力平衡的终态分析入口。',
    teachingUse: '后续用于“终态速度 / 终态电流”专题分析。',
    phaseNote: 'Phase 4 以后再接入，当前只保留产品位。',
    status: 'planned',
  },
  {
    key: P13_MODEL_KEYS.freeAssembly,
    family: 'builder',
    code: 'P13-BUILDER',
    title: '自由组装入口',
    summary: '预留与其他模块协同的电磁感应自由组装入口。',
    teachingUse: '后续用于复杂拓扑、题目复刻和开放探究。',
    phaseNote: '本轮不实现，避免提前进入 builder 范围。',
    status: 'planned',
  },
] as const;

export const P13_PRESET_IDS: Set<string> = new Set(
  P13_MODEL_CATALOG.flatMap((model) => (model.presetId ? [model.presetId] : [])),
);

function resolveModelCard(model: P13ModelCardConfig): P13ModelCard | null {
  if (!model.presetId) return { ...model };
  const preset = presetRegistry.get(model.presetId);
  if (!preset || !isPresetVisible(preset)) return null;
  return { ...model, preset };
}

export function getP13AvailableModels(): P13ModelCard[] {
  return P13_MODEL_CATALOG.flatMap((model) => {
    if (model.status !== 'available') return [];
    const resolved = resolveModelCard(model);
    return resolved ? [resolved] : [];
  });
}

export function getP13PlannedModels(): P13ModelCard[] {
  return P13_MODEL_CATALOG.flatMap((model) => {
    if (model.status !== 'planned') return [];
    const resolved = resolveModelCard(model);
    return resolved ? [resolved] : [];
  });
}

export function getP13ProductTracks(): P13ProductTrack[] {
  return (Object.keys(TRACK_META) as P13ModelFamily[]).map((key) => ({
    key,
    ...TRACK_META[key],
    models: P13_MODEL_CATALOG
      .filter((model) => model.family === key)
      .flatMap((model) => {
        const resolved = resolveModelCard(model);
        return resolved ? [resolved] : [];
      }),
  }));
}
