import { FUNCTION_TEMPLATES } from '@/engine/functionTemplates';
import { useFunctionStore } from '@/editor/store/functionStore';
import { useInteractionStore } from '@/editor/store/interactionStore';
import type { FunctionEntry } from '@/types';

type AiFunction = {
  id: string;
  label: string;
  mode: FunctionEntry['mode'];
  exprStr: string;
  templateId: string | null;
  visible: boolean;
  color: string;
  transform: FunctionEntry['transform'];
  namedParams: Array<{ name: string; label: string; value: number }>;
  segmentCount: number;
};

export type M02AiContext = {
  templateKey: 'm02';
  activeSkill: 'm02';
  summary: string;
  functions: AiFunction[];
  activeFunctionId: string | null;
  activeFunctionLabel: string | null;
  availableFunctionLabels: string[];
  viewport: ReturnType<ReturnType<typeof useFunctionStore.getState>['getSnapshot']>['viewport'];
  features: {
    showDerivative: boolean;
    showTangent: boolean;
    tangentX: number | null;
    showFeaturePoints: boolean;
    showGrid: boolean;
    showAxisLabels: boolean;
  };
  pinned: {
    pointCount: number;
    intersectionCount: number;
  };
  supportedTemplateIds: string[];
  limits: {
    maxFunctions: number;
  };
  constraints: string[];
};

const MAX_FUNCTIONS = 8;

function describeFunction(fn: FunctionEntry): AiFunction {
  return {
    id: fn.id,
    label: fn.label,
    mode: fn.mode,
    exprStr: fn.exprStr,
    templateId: fn.templateId,
    visible: fn.visible,
    color: fn.color,
    transform: { ...fn.transform },
    namedParams: fn.namedParams.map((param) => ({
      name: param.name,
      label: param.label,
      value: param.value,
    })),
    segmentCount: fn.segments.length,
  };
}

export function buildM02AiContext(): M02AiContext {
  const functionState = useFunctionStore.getState();
  const interactionState = useInteractionStore.getState();
  const functions = functionState.functions.map(describeFunction);
  const activeFunction = functionState.functions.find((fn) => fn.id === functionState.activeFunctionId) ?? null;
  const availableFunctionLabels = functions.map((fn) => fn.label);

  return {
    templateKey: 'm02',
    activeSkill: 'm02',
    summary: availableFunctionLabels.length
      ? `当前有 ${availableFunctionLabels.length} 个函数：${availableFunctionLabels.join('、')}。`
      : '当前没有函数图像。',
    functions,
    activeFunctionId: functionState.activeFunctionId,
    activeFunctionLabel: activeFunction?.label ?? null,
    availableFunctionLabels,
    viewport: { ...functionState.viewport },
    features: {
      showDerivative: functionState.features.showDerivative,
      showTangent: functionState.features.showTangent,
      tangentX: functionState.features.tangentX,
      showFeaturePoints: functionState.features.showFeaturePoints,
      showGrid: functionState.features.showGrid,
      showAxisLabels: functionState.features.showAxisLabels,
    },
    pinned: {
      pointCount: interactionState.pinnedPoints.length,
      intersectionCount: interactionState.pinnedIntersections.length,
    },
    supportedTemplateIds: FUNCTION_TEMPLATES.map((template) => template.id),
    limits: {
      maxFunctions: MAX_FUNCTIONS,
    },
    constraints: [
      '引用已有函数时必须使用 availableFunctionLabels 或 function id；函数不存在或有歧义时返回 warnings，不要输出依赖该函数的 operation。',
      '新增或修改表达式必须使用 M02 支持的数学表达式，变量为 x，函数值和导数由 M02 计算。',
      '切线只需要给出目标函数和 x 坐标，不要手写切线斜率或切点 y 值。',
      '当前最多支持 8 个函数；达到上限时不要继续新增函数。',
      'pinned points 和 pinned intersections 已可被 snapshot 保存，但第一阶段 AI 不主动创建这些标记。',
    ],
  };
}
