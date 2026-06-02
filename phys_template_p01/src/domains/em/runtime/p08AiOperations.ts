/**
 * P08 电磁场可视化 AI 操作处理器。
 *
 * 相比 P04，P08 暴露的能力更丰富：导航、视角切换、显示选项、测量探针、
 * 螺线管/圆形电流教学工作台、播放控制。所有可见状态都通过原子 operation 暴露给小联。
 */
import { simulator } from '@/core/engine/simulator';
import { presetRegistry } from '@/core/registries/preset-registry';
import type { FieldLineDensity, InfoDensity, ParamValues, Vec2, ViewportType } from '@/core/types';
import { useSimulationStore } from '@/store';
import type {
  LoopCompassProbe,
  SolenoidCompassProbe,
  SolenoidDisplayMode,
  SolenoidViewMode,
} from '@/store/simulation-store';
import type { ApplyOperationsResult } from '@/templateBridge';

type AiOperation = Record<string, unknown> & { type?: string };

const VIEWPORT_TYPES: ReadonlySet<ViewportType> = new Set<ViewportType>([
  'force',
  'motion',
  'energy',
  'momentum',
  'field',
  'circuit',
]);

const INFO_DENSITIES: ReadonlySet<InfoDensity> = new Set<InfoDensity>(['compact', 'standard', 'detailed']);
const FIELD_LINE_DENSITIES: ReadonlySet<FieldLineDensity> = new Set<FieldLineDensity>(['sparse', 'standard', 'dense']);
const SOLENOID_DISPLAY_MODES: ReadonlySet<SolenoidDisplayMode> = new Set<SolenoidDisplayMode>(['textbook', 'particles', 'volume']);
const SOLENOID_VIEW_MODES: ReadonlySet<SolenoidViewMode> = new Set<SolenoidViewMode>(['front', 'side', 'section', 'orbit']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asNumber(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} 必须是有限数字`);
  }
  return value;
}

function asParamValue(value: unknown, key: string): ParamValues[string] {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  throw new Error(`参数 ${key} 的值必须是数字、布尔或字符串`);
}

function asVec2(value: unknown, key: string): Vec2 {
  if (Array.isArray(value) && value.length === 2) {
    return { x: asNumber(value[0], `${key}.x`), y: asNumber(value[1], `${key}.y`) };
  }
  if (isRecord(value) && 'x' in value && 'y' in value) {
    return { x: asNumber(value.x, `${key}.x`), y: asNumber(value.y, `${key}.y`) };
  }
  throw new Error(`${key} 必须是 [x,y] 或 {x,y}`);
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
  if (preset.category !== 'P-08') {
    throw new Error(`预设 ${presetId} 不属于 P08（实际分类 ${preset.category}）`);
  }
  if (typeof window !== 'undefined') {
    const moduleParam = asString(operation.module);
    const params = new URLSearchParams({ from: 'p08' });
    if (moduleParam) params.set('module', moduleParam);
    window.location.hash = `preset/${presetId}?${params.toString()}`;
  }
}

function executeOpenModule(operation: AiOperation): void {
  const moduleParam = asString(operation.module) ?? asString(operation.moduleKey);
  if (typeof window !== 'undefined') {
    if (moduleParam) {
      window.location.hash = `p08?module=${moduleParam}`;
    } else {
      window.location.hash = 'p08';
    }
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
  if (!getEntityIds().has(entityId)) {
    warnings.push(`实体 ${entityId} 不在当前场景中，已跳过`);
    return;
  }
  useSimulationStore.getState().selectEntity(entityId);
}

function executeSwitchPrimaryViewport(operation: AiOperation): void {
  const viewport = asString(operation.viewport) ?? asString(operation.primary);
  if (!viewport || !VIEWPORT_TYPES.has(viewport as ViewportType)) {
    throw new Error('switchPrimaryViewport 缺少合法 viewport（force/motion/energy/momentum/field/circuit）');
  }
  useSimulationStore.getState().switchPrimaryViewport(viewport as ViewportType);
}

function executeToggleOverlayViewport(operation: AiOperation): void {
  const viewport = asString(operation.viewport) ?? asString(operation.overlay);
  if (!viewport || !VIEWPORT_TYPES.has(viewport as ViewportType)) {
    throw new Error('toggleOverlayViewport 缺少合法 viewport');
  }
  useSimulationStore.getState().toggleOverlayViewport(viewport as ViewportType);
}

function executeSetDisplayOptions(operation: AiOperation, warnings: string[]): void {
  const store = useSimulationStore.getState();
  let touched = false;

  const showFieldLines = asBoolean(operation.showFieldLines);
  if (showFieldLines !== null && showFieldLines !== store.showFieldLines) {
    store.toggleFieldLines();
    touched = true;
  }

  const showEquipotentialLines = asBoolean(operation.showEquipotentialLines);
  if (showEquipotentialLines !== null && showEquipotentialLines !== store.showEquipotentialLines) {
    store.toggleEquipotentialLines();
    touched = true;
  }

  const showPotentialMap = asBoolean(operation.showPotentialMap);
  if (showPotentialMap !== null && showPotentialMap !== store.showPotentialMap) {
    store.togglePotentialMap();
    touched = true;
  }

  const showPotentialSurface3D = asBoolean(operation.showPotentialSurface3D);
  if (showPotentialSurface3D !== null && showPotentialSurface3D !== store.showPotentialSurface3D) {
    store.togglePotentialSurface3D();
    touched = true;
  }

  const showTrajectory = asBoolean(operation.showTrajectory);
  if (showTrajectory !== null && showTrajectory !== store.showTrajectory) {
    store.toggleTrajectory();
    touched = true;
  }

  const fieldLineDensity = asString(operation.fieldLineDensity);
  if (fieldLineDensity) {
    if (!FIELD_LINE_DENSITIES.has(fieldLineDensity as FieldLineDensity)) {
      throw new Error('fieldLineDensity 必须是 sparse/standard/dense');
    }
    store.setFieldLineDensity(fieldLineDensity as FieldLineDensity);
    touched = true;
  }

  const infoDensity = asString(operation.infoDensity);
  if (infoDensity) {
    if (!INFO_DENSITIES.has(infoDensity as InfoDensity)) {
      throw new Error('infoDensity 必须是 compact/standard/detailed');
    }
    store.setInfoDensity(infoDensity as InfoDensity);
    touched = true;
  }

  if (!touched) {
    warnings.push('setDisplayOptions 未指定任何可识别的开关项');
  }
}

function executeSetPotentialProbe(operation: AiOperation): void {
  const probe = asString(operation.probe);
  if (probe !== 'A' && probe !== 'B') {
    throw new Error('setPotentialProbe 缺少合法 probe（A 或 B）');
  }
  const rawPoint = operation.point ?? operation.position;
  const point = rawPoint === null ? null : asVec2(rawPoint, 'point');
  useSimulationStore.getState().setPotentialProbe(probe, point);
}

function executeClearPotentialProbes(): void {
  useSimulationStore.getState().clearPotentialProbes();
}

function executeSetSolenoidTeaching(operation: AiOperation, warnings: string[]): void {
  const store = useSimulationStore.getState();
  let touched = false;

  const displayMode = asString(operation.displayMode);
  if (displayMode) {
    if (!SOLENOID_DISPLAY_MODES.has(displayMode as SolenoidDisplayMode)) {
      throw new Error('solenoid displayMode 必须是 textbook/particles/volume');
    }
    store.setSolenoidDisplayMode(displayMode as SolenoidDisplayMode);
    touched = true;
  }

  const viewMode = asString(operation.viewMode);
  if (viewMode) {
    if (!SOLENOID_VIEW_MODES.has(viewMode as SolenoidViewMode)) {
      throw new Error('solenoid viewMode 必须是 front/side/section/orbit');
    }
    store.setSolenoidViewMode(viewMode as SolenoidViewMode);
    touched = true;
  }

  const camera = operation.camera;
  if (isRecord(camera)) {
    const patch: Partial<Pick<SolenoidCompassProbe, never>> & {
      orbitYawDeg?: number;
      orbitPitchDeg?: number;
      orbitDistance?: number;
    } = {};
    if (camera.orbitYawDeg !== undefined) patch.orbitYawDeg = asNumber(camera.orbitYawDeg, 'camera.orbitYawDeg');
    if (camera.orbitPitchDeg !== undefined) patch.orbitPitchDeg = asNumber(camera.orbitPitchDeg, 'camera.orbitPitchDeg');
    if (camera.orbitDistance !== undefined) patch.orbitDistance = asNumber(camera.orbitDistance, 'camera.orbitDistance');
    if (Object.keys(patch).length > 0) {
      store.setSolenoidOrbitCamera(patch);
      touched = true;
    }
  }

  const reset = asBoolean(operation.reset);
  if (reset) {
    store.resetSolenoidTeaching();
    touched = true;
  }

  if (!touched) {
    warnings.push('setSolenoidTeaching 未指定任何字段');
  }
}

function executeAddSolenoidCompass(operation: AiOperation): void {
  const x = asNumber(operation.x ?? 0, 'x');
  const y = asNumber(operation.y ?? 0, 'y');
  const z = asNumber(operation.z ?? 0, 'z');
  const id = asString(operation.id) ?? undefined;
  useSimulationStore.getState().addSolenoidCompass({ x, y, z, id });
}

function executeMoveSolenoidCompass(operation: AiOperation): void {
  const id = asString(operation.id);
  if (!id) throw new Error('moveSolenoidCompass 缺少 id');
  const x = asNumber(operation.x, 'x');
  const y = asNumber(operation.y, 'y');
  const z = asNumber(operation.z, 'z');
  useSimulationStore.getState().moveSolenoidCompass(id, { x, y, z });
}

function executeAddLoopCompass(operation: AiOperation): void {
  const x = asNumber(operation.x ?? 0, 'x');
  const y = asNumber(operation.y ?? 0, 'y');
  const z = asNumber(operation.z ?? 0, 'z');
  const id = asString(operation.id) ?? undefined;
  useSimulationStore.getState().addLoopCompass({ x, y, z, id });
}

function executeMoveLoopCompass(operation: AiOperation): void {
  const id = asString(operation.id);
  if (!id) throw new Error('moveLoopCompass 缺少 id');
  const x = asNumber(operation.x, 'x');
  const y = asNumber(operation.y, 'y');
  const z = asNumber(operation.z, 'z');
  useSimulationStore.getState().moveLoopCompass(id, { x, y, z });
}

function executeResetLoopTeaching(): void {
  useSimulationStore.getState().resetLoopTeaching();
}

function executeSetElectrostaticSurface3D(operation: AiOperation, warnings: string[]): void {
  const patch: { yawDeg?: number; pitchDeg?: number; zoom?: number } = {};
  if (operation.yawDeg !== undefined) patch.yawDeg = asNumber(operation.yawDeg, 'yawDeg');
  if (operation.pitchDeg !== undefined) patch.pitchDeg = asNumber(operation.pitchDeg, 'pitchDeg');
  if (operation.zoom !== undefined) patch.zoom = asNumber(operation.zoom, 'zoom');
  if (Object.keys(patch).length === 0) {
    warnings.push('setElectrostaticSurface3D 未指定相机字段');
    return;
  }
  useSimulationStore.getState().setElectrostaticSurface3D(patch);
}

function executeResetElectrostaticSurface3D(): void {
  useSimulationStore.getState().resetElectrostaticSurface3D();
}

function executePlay(): void {
  simulator.play();
}

function executePause(): void {
  simulator.pause();
}

function executeReset(): void {
  simulator.reset();
}

function executeOperation(operation: AiOperation, warnings: string[]): void {
  switch (operation.type) {
    case 'loadPreset':
      executeLoadPreset(operation);
      return;
    case 'openModule':
      executeOpenModule(operation);
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
    case 'switchPrimaryViewport':
      executeSwitchPrimaryViewport(operation);
      return;
    case 'toggleOverlayViewport':
      executeToggleOverlayViewport(operation);
      return;
    case 'setDisplayOptions':
      executeSetDisplayOptions(operation, warnings);
      return;
    case 'setPotentialProbe':
      executeSetPotentialProbe(operation);
      return;
    case 'clearPotentialProbes':
      executeClearPotentialProbes();
      return;
    case 'setSolenoidTeaching':
      executeSetSolenoidTeaching(operation, warnings);
      return;
    case 'addSolenoidCompass':
      executeAddSolenoidCompass(operation);
      return;
    case 'moveSolenoidCompass':
      executeMoveSolenoidCompass(operation);
      return;
    case 'addLoopCompass':
      executeAddLoopCompass(operation);
      return;
    case 'moveLoopCompass':
      executeMoveLoopCompass(operation);
      return;
    case 'resetLoopTeaching':
      executeResetLoopTeaching();
      return;
    case 'setElectrostaticSurface3D':
      executeSetElectrostaticSurface3D(operation, warnings);
      return;
    case 'resetElectrostaticSurface3D':
      executeResetElectrostaticSurface3D();
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
      throw new Error(`P08 不支持 operation: ${String(operation.type)}`);
  }
}

export function applyP08AiOperations(input: unknown): ApplyOperationsResult {
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

// 避免 lint 警告：保留类型导入。
export type { LoopCompassProbe };
