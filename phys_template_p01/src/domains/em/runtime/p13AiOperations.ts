/**
 * P13 电磁感应 AI 操作处理器。
 *
 * P13 与 P04/P08 架构差异：每个 workbench 页面用 React useState 管理 params/playback/displayOptions，
 * 并通过 snapshotPageRegistry 注册了 snapshot adapter。AI 操作通过 loadPageSnapshots 注入部分 snapshot
 * 来更新当前 workbench；snapshot key 由当前 URL hash 解析得到。
 */
import { presetRegistry } from '@/core/registries/preset-registry';
import { loadPageSnapshots } from '@/snapshotPageRegistry';
import type { ApplyOperationsResult } from '@/templateBridge';

type AiOperation = Record<string, unknown> & { type?: string };

const PRESET_TO_SNAPSHOT_KEY: Record<string, string> = {
  'P02-EM004-emf-induction': 'p13-base-loop',
  'P13-EMI-001-lenz-magnet-coil': 'p13-lenz-magnet-coil',
  'P13-EMI-011-single-rod-resistive': 'p13-single-rod-resistive',
  'P13-EMI-012-single-rod-with-source': 'p13-single-rod-with-source',
  'P13-EMI-013-single-rod-with-capacitor': 'p13-single-rod-with-capacitor',
  'P13-EMI-021-double-rod-basic': 'p13-double-rod-basic',
  'P13-EMI-024-double-rod-driven': 'p13-double-rod-driven',
  'P13-EMI-031-vertical-rail-rod': 'p13-vertical-rail-rod',
};

const SNAPSHOT_KEYS: ReadonlySet<string> = new Set([
  'p13-base-loop',
  'p13-lenz-magnet-coil',
  'p13-single-rod-resistive',
  'p13-single-rod-with-source',
  'p13-single-rod-with-capacitor',
  'p13-double-rod-basic',
  'p13-double-rod-driven',
  'p13-vertical-rail-rod',
  'p13-builder',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asFiniteNumber(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} 必须是有限数字`);
  }
  return value;
}

function currentSnapshotKey(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace('#', '');
  const [rawPath = ''] = hash.split('?');

  if (rawPath === 'p13-builder') return 'p13-builder';
  if (rawPath.startsWith('preset/')) {
    const presetId = rawPath.slice(7);
    return PRESET_TO_SNAPSHOT_KEY[presetId] ?? null;
  }
  return null;
}

function injectPartialSnapshot(patch: Record<string, unknown>, snapshotKeyHint?: string): string {
  const key = snapshotKeyHint && SNAPSHOT_KEYS.has(snapshotKeyHint)
    ? snapshotKeyHint
    : currentSnapshotKey();
  if (!key) {
    throw new Error('无法确定当前 workbench：请先 loadPreset / openBuilder 切换到 P13 工作台再执行此操作');
  }
  loadPageSnapshots({ [key]: patch });
  return key;
}

function executeLoadPreset(operation: AiOperation): void {
  const presetId = asString(operation.presetId) ?? asString(operation.id);
  if (!presetId) throw new Error('loadPreset 缺少 presetId');
  const preset = presetRegistry.get(presetId);
  if (!preset) throw new Error(`未知预设 ${presetId}`);
  if (preset.category !== 'P-13' && preset.category !== 'P-02') {
    throw new Error(`预设 ${presetId} 不属于 P13（实际分类 ${preset.category}）`);
  }
  if (typeof window !== 'undefined') {
    window.location.hash = `preset/${presetId}?from=p13`;
  }
}

function executeOpenHome(): void {
  if (typeof window !== 'undefined') {
    window.location.hash = 'p13';
  }
}

function executeOpenBuilder(): void {
  if (typeof window !== 'undefined') {
    window.location.hash = 'p13-builder';
  }
}

function executeSetWorkbenchParams(operation: AiOperation): void {
  const params = operation.params;
  const stateFields = operation.state;
  if (!isRecord(params) && !isRecord(stateFields)) {
    throw new Error('setWorkbenchParams 缺少 params 或 state 对象');
  }
  const hint = asString(operation.workbench) ?? undefined;
  const patch: Record<string, unknown> = {};
  if (isRecord(params)) patch.params = params;
  if (isRecord(stateFields)) Object.assign(patch, stateFields);
  injectPartialSnapshot(patch, hint);
}

function executeSetPlaybackState(operation: AiOperation, warnings: string[]): void {
  const patch: Record<string, unknown> = {};
  const isPlaying = asBoolean(operation.isPlaying);
  if (isPlaying !== null) patch.isPlaying = isPlaying;
  if (operation.currentTime !== undefined) {
    patch.currentTime = asFiniteNumber(operation.currentTime, 'currentTime');
  }
  if (Object.keys(patch).length === 0) {
    warnings.push('setPlaybackState 未指定 isPlaying 或 currentTime');
    return;
  }
  const hint = asString(operation.workbench) ?? undefined;
  injectPartialSnapshot(patch, hint);
}

function executeSetAnalysisStep(operation: AiOperation): void {
  const step = asFiniteNumber(operation.step ?? operation.analysisStep, 'step');
  if (!Number.isInteger(step) || step < 0) {
    throw new Error('analysisStep 必须是非负整数');
  }
  const hint = asString(operation.workbench) ?? undefined;
  injectPartialSnapshot({ analysisStep: step }, hint);
}

function executeSetDisplayOptions(operation: AiOperation, warnings: string[]): void {
  const displayOptions: Record<string, boolean> = {};
  for (const key of ['showVectors', 'showLabels', 'showGrid', 'showAxes'] as const) {
    const value = asBoolean(operation[key]);
    if (value !== null) displayOptions[key] = value;
  }
  if (Object.keys(displayOptions).length === 0) {
    warnings.push('setDisplayOptions 未指定任何 P13 显示开关');
    return;
  }
  const hint = asString(operation.workbench) ?? undefined;
  injectPartialSnapshot({ displayOptions }, hint);
}

function executeSetCapacitorScenario(operation: AiOperation): void {
  const scenario = asString(operation.scenario) ?? asString(operation.capacitorScenario);
  if (scenario !== 'charge' && scenario !== 'discharge' && scenario !== 'external-force') {
    throw new Error('capacitorScenario 必须是 charge、discharge 或 external-force');
  }
  injectPartialSnapshot({ capacitorScenario: scenario }, 'p13-single-rod-with-capacitor');
}

function executePlay(): void {
  injectPartialSnapshot({ isPlaying: true });
}

function executePause(): void {
  injectPartialSnapshot({ isPlaying: false });
}

function executeReset(): void {
  injectPartialSnapshot({ currentTime: 0, isPlaying: false, analysisStep: 0 });
}

function executeOperation(operation: AiOperation, warnings: string[]): void {
  switch (operation.type) {
    case 'loadPreset':
      executeLoadPreset(operation);
      return;
    case 'openHome':
      executeOpenHome();
      return;
    case 'openBuilder':
      executeOpenBuilder();
      return;
    case 'setWorkbenchParams':
      executeSetWorkbenchParams(operation);
      return;
    case 'setPlaybackState':
      executeSetPlaybackState(operation, warnings);
      return;
    case 'setAnalysisStep':
      executeSetAnalysisStep(operation);
      return;
    case 'setDisplayOptions':
      executeSetDisplayOptions(operation, warnings);
      return;
    case 'setCapacitorScenario':
      executeSetCapacitorScenario(operation);
      return;
    case 'play':
      executePlay();
      return;
    case 'pause':
      executePause();
      return;
    case 'reset':
      executeReset();
      return;
    default:
      throw new Error(`P13 不支持 operation: ${String(operation.type)}`);
  }
}

export function applyP13AiOperations(input: unknown): ApplyOperationsResult {
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
