import { compileExpression, evaluateAt, isParseError } from '@/engine/expressionEngine';
import { buildFunctionScope, getKnownFunctionNames } from '@/engine/compositionEngine';
import { buildTemplateExpr, getTemplate } from '@/engine/functionTemplates';
import { detectAndMergeCoefficients } from '@/engine/coefficientDetector';
import { useFunctionStore, type FunctionStoreSnapshot } from '@/editor/store/functionStore';
import { useInteractionStore, type M02InteractionSnapshot } from '@/editor/store/interactionStore';
import { useParamAnimationStore, type ParamAnimationStoreSnapshot } from '@/editor/store/paramAnimationStore';
import { useHistoryStore } from '@/editor/store/historyStore';
import { createId } from '@/lib/id';
import type { Command } from '@/editor/commands/types';
import type { EasingName } from '@/engine/animationEngine';
import {
  DEFAULT_TRANSFORM,
  FUNCTION_COLORS,
  type FunctionEntry,
  type FunctionParam,
  type PiecewiseSegment,
  type Transform,
  type ViewportState,
} from '@/types';

export interface BridgeOperationResult {
  ok: boolean;
  errors: string[];
  applied: number;
  rolledBack?: boolean;
}

type AiOperation = Record<string, unknown> & { type?: unknown };
type M02StateSnapshot = {
  function: FunctionStoreSnapshot;
  interaction: M02InteractionSnapshot;
  paramAnimation: ParamAnimationStoreSnapshot;
};

const MAX_FUNCTIONS = 8;
const MAX_HISTORY = 50;
const DEFAULT_LABELS = ['f(x)', 'g(x)', 'h(x)', 'p(x)', 'q(x)', 'r(x)', 's(x)', 't(x)'];
const FEATURE_KEYS = new Set([
  'showDerivative',
  'showTangent',
  'showFeaturePoints',
  'showGrid',
  'showAxisLabels',
] as const);
const EASING_NAMES = new Set<EasingName>(['linear', 'easeIn', 'easeInOut', 'easeOut', 'spring', 'bounce']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function cloneM02State(): M02StateSnapshot {
  return {
    function: structuredClone(useFunctionStore.getState().getSnapshot()),
    interaction: structuredClone(useInteractionStore.getState().getSnapshot()),
    paramAnimation: structuredClone(useParamAnimationStore.getState().getSnapshot()),
  };
}

function loadM02State(snapshot: M02StateSnapshot): void {
  useFunctionStore.getState().loadSnapshot(snapshot.function);
  useInteractionStore.getState().loadSnapshot(snapshot.interaction);
  useParamAnimationStore.getState().loadSnapshot(snapshot.paramAnimation);
}

function createSnapshotCommand(before: M02StateSnapshot, after: M02StateSnapshot): Command {
  return {
    type: 'aiPipeline',
    label: 'AI 函数图像搭建',
    execute() {
      loadM02State(after);
    },
    undo() {
      loadM02State(before);
    },
  };
}

function replacePipelineHistory(before: M02StateSnapshot, after: M02StateSnapshot, baseUndoStack: Command[]): void {
  const nextUndoStack = [
    ...baseUndoStack,
    createSnapshotCommand(before, after),
  ].slice(-MAX_HISTORY);

  useHistoryStore.setState({
    undoStack: nextUndoStack,
    redoStack: [],
    canUndo: nextUndoStack.length > 0,
    canRedo: false,
  });
}

function nextFunctionLabel(explicitLabel?: string | null): string {
  const existing = new Set(useFunctionStore.getState().functions.map((fn) => fn.label));
  if (explicitLabel && !existing.has(explicitLabel)) return explicitLabel;
  const label = DEFAULT_LABELS.find((item) => !existing.has(item));
  return label ?? `f${existing.size}(x)`;
}

function normalizeColor(value: unknown, fallback: string): string {
  const color = asString(value);
  if (!color) return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function ensureCapacity(extra = 1): void {
  if (useFunctionStore.getState().functions.length + extra > MAX_FUNCTIONS) {
    throw new Error(`函数数量已达上限 ${MAX_FUNCTIONS}`);
  }
}

function getFunctionByRef(operation: AiOperation): FunctionEntry {
  const functionId = asString(operation.functionId);
  const label = asString(operation.label) ?? asString(operation.fromLabel);
  const functions = useFunctionStore.getState().functions;
  const fn = functionId
    ? functions.find((item) => item.id === functionId)
    : label
      ? functions.find((item) => item.label === label)
      : functions.find((item) => item.id === useFunctionStore.getState().activeFunctionId);
  if (!fn) {
    throw new Error('未找到目标函数');
  }
  return fn;
}

function validTransformPatch(value: unknown): Partial<Transform> {
  if (!isRecord(value)) return {};
  const patch: Partial<Transform> = {};
  for (const key of ['a', 'b', 'h', 'k'] as const) {
    const next = asNumber(value[key]);
    if (next === null) continue;
    if (key === 'b' && next === 0) {
      throw new Error('transform.b 不能为 0');
    }
    patch[key] = next;
  }
  return patch;
}

function scopedCompile(exprStr: string, excludeId?: string) {
  const functions = useFunctionStore.getState().functions;
  const compiled = compileExpression(exprStr, getKnownFunctionNames(functions, excludeId));
  if (isParseError(compiled)) {
    throw new Error(`表达式无法解析：${compiled.error}`);
  }
  return compiled;
}

function paramScope(fn: FunctionEntry): Record<string, unknown> {
  return fn.templateId === null && fn.namedParams.length > 0
    ? Object.fromEntries(fn.namedParams.map((param) => [param.name, param.value]))
    : {};
}

function evaluateFunction(fn: FunctionEntry, mathX: number): number {
  if (fn.mode !== 'standard') {
    throw new Error('切线操作暂只支持标准函数');
  }
  const compiled = scopedCompile(fn.exprStr, fn.id);
  const allFunctions = useFunctionStore.getState().functions;
  const scope = {
    ...paramScope(fn),
    ...buildFunctionScope(allFunctions, fn.id),
  };
  const { a, b, h, k } = fn.transform;
  const xPrime = b * (mathX - h);
  const raw = evaluateAt(compiled, xPrime, scope);
  const y = Number.isFinite(raw) ? a * raw + k : NaN;
  if (!Number.isFinite(y)) {
    throw new Error(`函数在 x=${mathX} 处无有限函数值`);
  }
  return y;
}

function derivativeAt(fn: FunctionEntry, mathX: number): number {
  const delta = 1e-7;
  const yPlus = evaluateFunction(fn, mathX + delta);
  const yMinus = evaluateFunction(fn, mathX - delta);
  const slope = (yPlus - yMinus) / (2 * delta);
  if (!Number.isFinite(slope)) {
    throw new Error(`函数在 x=${mathX} 处无法计算切线斜率`);
  }
  return slope;
}

function createTemplateFunction(templateId: string, paramsValue: unknown): Pick<FunctionEntry, 'exprStr' | 'templateId' | 'namedParams'> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`不支持的函数模板：${templateId}`);
  }

  const paramsRecord = isRecord(paramsValue) ? paramsValue : {};
  const namedParams = template.defaultParams.map((param) => {
    const next = asNumber(paramsRecord[param.name]);
    return { ...param, value: next ?? param.value };
  });
  const exprStr = buildTemplateExpr(templateId, namedParams);
  if (!exprStr) {
    throw new Error(`无法生成模板函数表达式：${templateId}`);
  }
  scopedCompile(exprStr);
  return { exprStr, templateId, namedParams };
}

function createCustomFunction(expression: string): Pick<FunctionEntry, 'exprStr' | 'templateId' | 'namedParams'> {
  scopedCompile(expression);
  return {
    exprStr: expression,
    templateId: null,
    namedParams: detectAndMergeCoefficients(expression, []) ?? [],
  };
}

function executeAddFunction(operation: AiOperation): void {
  ensureCapacity();

  const templateId = asString(operation.templateId);
  const expression = asString(operation.expression) ?? asString(operation.exprStr);
  const base = templateId
    ? createTemplateFunction(templateId, operation.params)
    : expression
      ? createCustomFunction(expression)
      : createCustomFunction('x');

  const count = useFunctionStore.getState().functions.length;
  const transform = { ...DEFAULT_TRANSFORM, ...validTransformPatch(operation.transform) };
  const entry: FunctionEntry = {
    id: createId(),
    label: nextFunctionLabel(asString(operation.label)),
    mode: 'standard',
    exprStr: base.exprStr,
    segments: [],
    color: normalizeColor(operation.color, FUNCTION_COLORS[count % FUNCTION_COLORS.length] ?? '#374151'),
    visible: asBoolean(operation.visible) ?? true,
    transform,
    templateId: base.templateId,
    namedParams: base.namedParams,
  };

  useFunctionStore.getState().addFunction(entry);
  useFunctionStore.getState().setActiveFunctionId(entry.id);
}

function mergeTemplateParams(fn: FunctionEntry, paramsValue: unknown): { namedParams: FunctionParam[]; exprStr: string } {
  if (!fn.templateId) {
    throw new Error('目标函数不是模板函数，不能通过 params 修改');
  }
  if (!isRecord(paramsValue)) {
    throw new Error('params 必须是对象');
  }
  const namedParams = fn.namedParams.map((param) => {
    const next = asNumber(paramsValue[param.name]);
    return next === null ? param : { ...param, value: next };
  });
  const exprStr = buildTemplateExpr(fn.templateId, namedParams);
  if (!exprStr) {
    throw new Error('模板函数表达式重建失败');
  }
  scopedCompile(exprStr, fn.id);
  return { namedParams, exprStr };
}

function executeUpdateFunction(operation: AiOperation): void {
  const fn = getFunctionByRef(operation);
  const patch: Partial<FunctionEntry> = {};

  const nextLabel = asString(operation.newLabel);
  if (nextLabel && nextLabel !== fn.label) {
    const duplicate = useFunctionStore.getState().functions.some((item) => item.id !== fn.id && item.label === nextLabel);
    if (duplicate) throw new Error(`函数标签已存在：${nextLabel}`);
    patch.label = nextLabel;
  }

  const expression = asString(operation.expression) ?? asString(operation.exprStr);
  if (expression) {
    scopedCompile(expression, fn.id);
    patch.exprStr = expression;
    patch.templateId = null;
    patch.namedParams = detectAndMergeCoefficients(expression, fn.namedParams) ?? [];
  }

  if (operation.params !== undefined) {
    const merged = mergeTemplateParams(fn, operation.params);
    patch.namedParams = merged.namedParams;
    patch.exprStr = merged.exprStr;
  }

  if (operation.transform !== undefined) {
    patch.transform = { ...fn.transform, ...validTransformPatch(operation.transform) };
  }

  const visible = asBoolean(operation.visible);
  if (visible !== null) patch.visible = visible;

  const color = asString(operation.color);
  if (color) patch.color = normalizeColor(color, fn.color);

  if (Object.keys(patch).length === 0) {
    throw new Error('updateFunction 没有可应用的修改');
  }

  useFunctionStore.getState().updateFunction(fn.id, patch);
  useFunctionStore.getState().setActiveFunctionId(fn.id);
}

function parseSegment(value: unknown): PiecewiseSegment {
  if (!isRecord(value)) {
    throw new Error('分段函数的 segment 必须是对象');
  }
  const expression = asString(value.expression) ?? asString(value.exprStr);
  if (!expression) {
    throw new Error('分段函数缺少 expression');
  }
  scopedCompile(expression);
  const xMin = value.xMin === null ? null : asNumber(value.xMin);
  const xMax = value.xMax === null ? null : asNumber(value.xMax);
  if (xMin !== null && xMax !== null && xMin >= xMax) {
    throw new Error('分段函数定义域要求 xMin < xMax');
  }
  return {
    id: createId(),
    exprStr: expression,
    domain: {
      xMin,
      xMax,
      xMinInclusive: asBoolean(value.xMinInclusive) ?? true,
      xMaxInclusive: asBoolean(value.xMaxInclusive) ?? false,
    },
  };
}

function executeAddPiecewiseFunction(operation: AiOperation): void {
  ensureCapacity();
  if (!Array.isArray(operation.segments) || operation.segments.length === 0) {
    throw new Error('addPiecewiseFunction 缺少 segments');
  }
  const segments = operation.segments.map(parseSegment);
  const count = useFunctionStore.getState().functions.length;
  const entry: FunctionEntry = {
    id: createId(),
    label: nextFunctionLabel(asString(operation.label)),
    mode: 'piecewise',
    exprStr: segments[0]?.exprStr ?? 'x',
    segments,
    color: normalizeColor(operation.color, FUNCTION_COLORS[count % FUNCTION_COLORS.length] ?? '#374151'),
    visible: true,
    transform: { ...DEFAULT_TRANSFORM },
    templateId: null,
    namedParams: [],
  };
  useFunctionStore.getState().addFunction(entry);
  useFunctionStore.getState().setActiveFunctionId(entry.id);
}

function executeSetViewport(operation: AiOperation): void {
  const viewport: ViewportState = {
    xMin: asNumber(operation.xMin) ?? NaN,
    xMax: asNumber(operation.xMax) ?? NaN,
    yMin: asNumber(operation.yMin) ?? NaN,
    yMax: asNumber(operation.yMax) ?? NaN,
  };
  if (!Number.isFinite(viewport.xMin) || !Number.isFinite(viewport.xMax) || viewport.xMin >= viewport.xMax) {
    throw new Error('setViewport 要求 xMin < xMax');
  }
  if (!Number.isFinite(viewport.yMin) || !Number.isFinite(viewport.yMax) || viewport.yMin >= viewport.yMax) {
    throw new Error('setViewport 要求 yMin < yMax');
  }
  useFunctionStore.getState().setViewport(viewport);
}

function executeSetFeatureFlags(operation: AiOperation): void {
  let changed = false;
  for (const key of FEATURE_KEYS) {
    const value = asBoolean(operation[key]);
    if (value !== null) {
      useFunctionStore.getState().setFeature(key, value);
      changed = true;
    }
  }
  if (!changed) {
    throw new Error('setFeatureFlags 没有可应用的显示设置');
  }
}

function executeSetActiveFunction(operation: AiOperation): void {
  const fn = getFunctionByRef(operation);
  useFunctionStore.getState().setActiveFunctionId(fn.id);
}

function executeSetTangentAtX(operation: AiOperation): void {
  const fn = getFunctionByRef(operation);
  const x = asNumber(operation.x);
  if (x === null) {
    throw new Error('setTangentAtX 缺少 x');
  }
  const y = evaluateFunction(fn, x);
  const slope = derivativeAt(fn, x);
  useFunctionStore.getState().setActiveFunctionId(fn.id);
  useFunctionStore.getState().setFeature('showTangent', true);
  useFunctionStore.getState().setTangentPoint(x, y, slope);
}

function executeAddTangentFunction(operation: AiOperation): void {
  ensureCapacity();
  const fn = getFunctionByRef(operation);
  const x = asNumber(operation.x);
  if (x === null) {
    throw new Error('addTangentFunction 缺少 x');
  }
  const y = evaluateFunction(fn, x);
  const slope = derivativeAt(fn, x);
  const count = useFunctionStore.getState().functions.length;
  const expression = `(${slope})*(x - (${x})) + (${y})`;
  scopedCompile(expression);
  const entry: FunctionEntry = {
    id: createId(),
    label: nextFunctionLabel(asString(operation.tangentLabel) ?? asString(operation.newLabel)),
    mode: 'standard',
    exprStr: expression,
    segments: [],
    color: normalizeColor(operation.color, FUNCTION_COLORS[count % FUNCTION_COLORS.length] ?? '#374151'),
    visible: true,
    transform: { ...DEFAULT_TRANSFORM },
    templateId: null,
    namedParams: [],
  };
  useFunctionStore.getState().addFunction(entry);
  useFunctionStore.getState().setActiveFunctionId(entry.id);
}

function executeSetFunctionStyle(operation: AiOperation): void {
  const fn = getFunctionByRef(operation);
  const patch: Partial<FunctionEntry> = {};
  const color = asString(operation.color);
  if (color) patch.color = normalizeColor(color, fn.color);
  const visible = asBoolean(operation.visible);
  if (visible !== null) patch.visible = visible;
  const label = asString(operation.newLabel);
  if (label && label !== fn.label) {
    const duplicate = useFunctionStore.getState().functions.some((item) => item.id !== fn.id && item.label === label);
    if (duplicate) throw new Error(`函数标签已存在：${label}`);
    patch.label = label;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error('setFunctionStyle 没有可应用的样式修改');
  }
  useFunctionStore.getState().updateFunction(fn.id, patch);
}

function validAnimationKey(fn: FunctionEntry, key: string): boolean {
  if (key.startsWith('transform.')) {
    return ['transform.a', 'transform.b', 'transform.h', 'transform.k'].includes(key);
  }
  if (key.startsWith('named.')) {
    const name = key.slice('named.'.length);
    return fn.namedParams.some((param) => param.name === name);
  }
  return false;
}

function executeSetParamAnimation(operation: AiOperation): void {
  const fn = getFunctionByRef(operation);
  if (!Array.isArray(operation.params)) {
    throw new Error('setParamAnimation 缺少 params');
  }
  const params = operation.params.map((item) => {
    if (!isRecord(item)) throw new Error('动画参数必须是对象');
    const key = asString(item.key);
    const from = asNumber(item.from);
    const to = asNumber(item.to);
    if (!key || from === null || to === null) {
      throw new Error('动画参数缺少 key/from/to');
    }
    if (!validAnimationKey(fn, key)) {
      throw new Error(`动画参数 key 不存在：${key}`);
    }
    return {
      key,
      label: asString(item.label) ?? key,
      enabled: asBoolean(item.enabled) ?? true,
      from,
      to,
    };
  });
  const duration = asNumber(operation.duration);
  const easing = asString(operation.easing);

  useParamAnimationStore.getState().setParams(params);
  if (duration !== null) {
    useParamAnimationStore.getState().setDuration(Math.max(100, duration));
  }
  if (easing && EASING_NAMES.has(easing as EasingName)) {
    useParamAnimationStore.getState().setEasing(easing as EasingName);
  }
  const loop = asBoolean(operation.loop);
  if (loop !== null) {
    useParamAnimationStore.getState().setLoop(loop);
  }
  useParamAnimationStore.getState().setRecordEnabled(false);
  useParamAnimationStore.getState().setPlayState('idle');
  useFunctionStore.getState().setActiveFunctionId(fn.id);
}

export async function applyAiOperations(operations: unknown): Promise<BridgeOperationResult> {
  const items = Array.isArray(operations) ? operations : [];
  const errors: string[] = [];
  let applied = 0;
  const before = cloneM02State();
  const historyBefore = useHistoryStore.getState();

  for (const item of items) {
    if (!isRecord(item)) {
      errors.push('操作必须是对象');
      loadM02State(before);
      useHistoryStore.setState(historyBefore);
      return { ok: false, errors, applied, rolledBack: true };
    }

    try {
      switch ((item as AiOperation).type) {
        case 'addFunction':
          executeAddFunction(item);
          break;
        case 'updateFunction':
          executeUpdateFunction(item);
          break;
        case 'addPiecewiseFunction':
          executeAddPiecewiseFunction(item);
          break;
        case 'setViewport':
          executeSetViewport(item);
          break;
        case 'setFeatureFlags':
          executeSetFeatureFlags(item);
          break;
        case 'setActiveFunction':
          executeSetActiveFunction(item);
          break;
        case 'setTangentAtX':
          executeSetTangentAtX(item);
          break;
        case 'addTangentFunction':
          executeAddTangentFunction(item);
          break;
        case 'setFunctionStyle':
          executeSetFunctionStyle(item);
          break;
        case 'setParamAnimation':
          executeSetParamAnimation(item);
          break;
        default:
          throw new Error(`暂不支持的操作类型：${String((item as AiOperation).type || '')}`);
      }
      applied += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '操作执行失败');
      loadM02State(before);
      useHistoryStore.setState(historyBefore);
      return { ok: false, errors, applied, rolledBack: true };
    }
  }

  if (applied > 0) {
    replacePipelineHistory(before, cloneM02State(), historyBefore.undoStack);
  }

  return {
    ok: errors.length === 0,
    errors,
    applied,
  };
}
