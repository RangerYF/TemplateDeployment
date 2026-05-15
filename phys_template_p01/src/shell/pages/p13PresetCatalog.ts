import { isPresetVisible } from '@/app-config';
import { presetRegistry } from '@/core/registries/preset-registry';
import type { PresetData } from '@/core/types';
import { P13_BASE_LOOP_PRESET_ID } from '@/domains/em/p13/base-loop';
import { P13_LENZ_MAGNET_COIL_PRESET_ID } from '@/domains/em/p13/lenz-magnet-coil';
import {
  P13_SINGLE_ROD_RESISTIVE_PRESET_ID,
  P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID,
  P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID,
} from '@/domains/em/p13/single-rod';
import {
  P13_DOUBLE_ROD_BASIC_PRESET_ID,
  P13_DOUBLE_ROD_DRIVEN_PRESET_ID,
} from '@/domains/em/p13/double-rod';
import { P13_VERTICAL_RAIL_ROD_PRESET_ID } from '@/domains/em/p13/vertical-rail-rod';
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
  supportNote: string;
  status: 'available' | 'planned';
  presetId?: string;
  route?: 'p13-builder';
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
    note: '覆盖纯电阻、含电源、含电容三支课堂高频结构。',
  },
  'double-rod': {
    title: '双棒模型',
    summary: '统一覆盖双棒无摩擦与双棒 + 恒外力两支课堂主模型，保持同一 workbench 和结果口径。',
    note: '当前只保留双棒基础与双棒恒外力两支前台模型。',
  },
  'vertical-rail': {
    title: '竖直导轨',
    summary: '承接重力、动生电动势与安培力之间的动态平衡，并直接落到终态速度和终态电流。',
    note: '可直接演示终态建立与速度收敛过程。',
  },
  builder: {
    title: '自由组装',
    summary: '当前开放模板化 builder MVP，用统一入口承接单棒、双棒和竖直导轨的高频课堂结构。',
    note: '当前 builder 只支持模板化半自由组装，不支持任意拓扑拖拽。',
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
    supportNote: '保持基础动生样例口径：匀速穿场，安培力只做标注。',
    status: 'available',
    presetId: P13_BASE_LOOP_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.lenzMagnetCoil,
    family: 'flux-change',
    code: 'EMI-001',
    title: '磁棒-线圈楞次定律',
    summary: '面向 N/S 极插入与拔出的方向判断，按“原磁通量 → 变化 → 感应电流 → 感应磁场 → 安培力”完整展开楞次定律链路。',
    teachingUse: '适合课堂对比四种情况，并用逐步分析交互带学生一层层判断方向。',
    supportNote: '当前聚焦方向判断和逐步分析，不扩展到终态动力学。',
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
    supportNote: '提供完整的力-电-运动耦合演示。',
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
    supportNote: '与单棒基础共用同一套壳层与图表系统。',
    status: 'available',
    presetId: P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.singleRodWithCapacitor,
    family: 'single-rod',
    code: 'EMI-013',
    title: '单棒 + 含电容',
    summary: '统一承接单棒 + 电容的三种课堂情形：充电式、放电式和恒外力式，并展示 Uc、i、v 的全过程变化。',
    teachingUse: '适合讲解“含电容时 I终 = 0”与“恒外力下 Uc / i 如何建立”这两类容易混淆的题型。',
    supportNote: '与单棒基础、电源支路共用同一套交互结构；恒外力式会在页面内明确标注为教学简化。',
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
    supportNote: '复用统一壳层，并提供 v1-t / v2-t / i-t 图联动。',
    status: 'available',
    presetId: P13_DOUBLE_ROD_BASIC_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.doubleRod,
    family: 'double-rod',
    code: 'EMI-024',
    title: '双棒 + 恒外力',
    summary: '在双棒基础回路中给棒1持续施加恒定外力，展示外力如何通过感应电流与安培力把运动逐步传给棒2，长期后进入“同加速度 + 稳定速度差”的课堂口径。',
    teachingUse: '适合讲解双棒中“一个棒受恒外力”这类高频综合题，强调外力、安培力和两棒速度变化的因果顺序。',
    supportNote: '继续沿用双棒统一壳层与双速度同图、i-t 图和结果区。',
    status: 'available',
    presetId: P13_DOUBLE_ROD_DRIVEN_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.verticalRailRod,
    family: 'vertical-rail',
    code: 'EMI-031',
    title: '竖直导轨单棒',
    summary: '导体棒从静止释放后向下加速，随着 ε、i 和向上的安培力建立，系统最终收敛到 mg = B²L²v终 / (R + R棒) 的匀速终态。',
    teachingUse: '适合讲解“速度上升为何不会无限增大”以及 v终、i终 的课堂结论。',
    supportNote: '复用统一壳层，并提供终态速度 / 终态电流结果区。',
    status: 'available',
    presetId: P13_VERTICAL_RAIL_ROD_PRESET_ID,
  },
  {
    key: P13_MODEL_KEYS.freeAssembly,
    family: 'builder',
    code: 'P13-BUILDER',
    title: '自由组装入口',
    summary: '当前开放模板化 builder MVP，可在一个受控入口里选择单棒、双棒和竖直导轨的高频课堂结构。',
    teachingUse: '适合从“标准模板”进入，再逐步切到更复杂的课堂题型，不直接进入任意拓扑复杂度。',
    supportNote: '当前 builder 采用模板化半自由组装，不支持任意拖拽组网。',
    status: 'available',
    route: 'p13-builder',
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
