/**
 * P04 电路实验台 AI 操作处理器。
 *
 * 小联通过 templateBridge.applyOperations 调用这里定义的原子操作来精确控制 P04 模板。
 * 当前支持的 operations：loadPreset、setParam、setParams、selectEntity。
 */
import { simulator } from '@/core/engine/simulator';
import { presetRegistry } from '@/core/registries/preset-registry';
import type { ParamValues } from '@/core/types';
import { useSimulationStore } from '@/store';
import type { ApplyOperationsResult } from '@/templateBridge';

type AiOperation = Record<string, unknown> & { type?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asParamValue(value: unknown, key: string): ParamValues[string] {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  throw new Error(`参数 ${key} 的值必须是数字、布尔或字符串`);
}

function getParamKeys(): Set<string> {
  const state = useSimulationStore.getState().simulationState;
  const keys = new Set<string>();
  for (const group of state.scene.paramGroups) {
    for (const param of group.params) {
      keys.add(param.key);
    }
  }
  return keys;
}

function getEntityIds(): Set<string> {
  const state = useSimulationStore.getState().simulationState;
  return new Set(state.scene.entities.keys());
}

function executeLoadPreset(operation: AiOperation): void {
  const presetId = asString(operation.presetId) ?? asString(operation.id);
  if (!presetId) throw new Error('loadPreset 缺少 presetId');
  const preset = presetRegistry.get(presetId);
  if (!preset) throw new Error(`未知预设 ${presetId}`);
  if (preset.category !== 'P-04') {
    throw new Error(`预设 ${presetId} 不属于 P04（实际分类 ${preset.category}）`);
  }
  // 通过修改 hash 触发 App 的路由切换 + 预设加载 useEffect
  if (typeof window !== 'undefined') {
    window.location.hash = presetId;
  }
}

function executeSetParam(operation: AiOperation, warnings: string[]): void {
  const key = asString(operation.key) ?? asString(operation.paramKey);
  if (!key) throw new Error('setParam 缺少 key');
  const validKeys = getParamKeys();
  if (!validKeys.has(key)) {
    warnings.push(`参数 ${key} 不在当前预设的参数列表中，已跳过`);
    return;
  }
  const value = asParamValue(operation.value, key);
  useSimulationStore.getState().updateParam(key, value);
  simulator.updateParam(key, value);
}

function executeSetParams(operation: AiOperation, warnings: string[]): void {
  const values = operation.values;
  if (!isRecord(values)) throw new Error('setParams 缺少 values 对象');
  const validKeys = getParamKeys();
  for (const [key, rawValue] of Object.entries(values)) {
    if (!validKeys.has(key)) {
      warnings.push(`参数 ${key} 不在当前预设的参数列表中，已跳过`);
      continue;
    }
    const value = asParamValue(rawValue, key);
    useSimulationStore.getState().updateParam(key, value);
    simulator.updateParam(key, value);
  }
}

function executeSelectEntity(operation: AiOperation, warnings: string[]): void {
  const entityId = operation.entityId === null ? null : asString(operation.entityId) ?? asString(operation.id);
  if (entityId === null) {
    useSimulationStore.getState().selectEntity(null);
    return;
  }
  if (!entityId) throw new Error('selectEntity 缺少 entityId');
  const validIds = getEntityIds();
  if (!validIds.has(entityId)) {
    warnings.push(`实体 ${entityId} 不在当前场景中，已跳过`);
    return;
  }
  useSimulationStore.getState().selectEntity(entityId);
}

function executeOperation(operation: AiOperation, warnings: string[]): void {
  switch (operation.type) {
    case 'loadPreset':
      executeLoadPreset(operation);
      return;
    case 'setParam':
      executeSetParam(operation, warnings);
      return;
    case 'setParams':
      executeSetParams(operation, warnings);
      return;
    case 'selectEntity':
      executeSelectEntity(operation, warnings);
      return;
    default:
      throw new Error(`P04 不支持 operation: ${String(operation.type)}`);
  }
}

export function applyP04AiOperations(input: unknown): ApplyOperationsResult {
  const operations = Array.isArray(input)
    ? (input as AiOperation[])
    : isRecord(input) && Array.isArray(input.operations)
      ? (input.operations as AiOperation[])
      : [];
  const warnings: string[] = [];
  if (operations.length === 0) {
    return { ok: false, errors: ['operations 必须是非空数组'], warnings, applied: 0 };
  }

  let applied = 0;
  try {
    for (let index = 0; index < operations.length; index += 1) {
      const operation = operations[index];
      if (!isRecord(operation) || !asString(operation.type)) {
        throw new Error(`第 ${index + 1} 个 operation 缺少 type`);
      }
      executeOperation(operation, warnings);
      applied += 1;
    }
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
      applied,
    };
  }

  return {
    ok: true,
    errors: [],
    warnings,
    applied,
  };
}
