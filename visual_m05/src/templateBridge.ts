import { initApp } from './editor/init';
import { useAnimationStore, useHistoryStore, useSimulationStore, useUIStore } from './editor/store';
import type { SimulationEntity } from './editor/entities/types';
import type { AnimationStoreSnapshot } from './editor/store/animationStore';
import type { SimulationSnapshot } from './editor/store/simulationStore';
import type { UIStoreSnapshot } from './editor/store/uiStore';
import type { SimulationReplayMetadata, SimulationResult } from './types/simulation';
import { rebuildSimulationResultFromReplay } from './engine/simulationRunner';
import { buildM05AiContext, type M05AiContext } from './runtime/aiContext';
import { applyM05AiOperations, type M05BridgeOperationResult } from './runtime/aiOperations';

const TEMPLATE_KEY = 'm05';
const RUNTIME_KEY = 'visual-m05';
const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 2;
let currentSnapshotCreatedAt: string | null = null;

interface TemplateSnapshotEnvelope {
  templateKey: string;
  runtimeKey: string;
  bridgeVersion: string;
  snapshotSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface VisualM05SnapshotPayload {
  simulation: PersistedSimulationSnapshot;
  ui: UIStoreSnapshot;
  animation: AnimationStoreSnapshot;
}

export interface VisualM05SnapshotDocument {
  envelope: TemplateSnapshotEnvelope;
  payload: VisualM05SnapshotPayload;
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
}

interface TemplateBridge {
  getDefaultSnapshot(): VisualM05SnapshotDocument;
  getSnapshot(): VisualM05SnapshotDocument;
  loadSnapshot(snapshot: unknown): void;
  validateSnapshot(snapshot: unknown): ValidationResult;
  getAiContext(): M05AiContext;
  applyOperations(operations: unknown): M05BridgeOperationResult;
}

interface PersistedSimulationResult {
  type: string;
  stats: Record<string, number | string>;
  timestamp: number;
  replay?: SimulationReplayMetadata | null;
  data?: unknown;
}

interface PersistedSimulationEntity extends Omit<SimulationEntity, 'result'> {
  result: PersistedSimulationResult | null;
}

interface PersistedSimulationSnapshot {
  simulations: Record<string, PersistedSimulationEntity>;
  activeSimId: string | null;
  nextId: number;
}

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: TemplateBridge;
    __EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?: () => void;
  }
}

function cloneSerializable<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildEnvelope(createdAt?: string): TemplateSnapshotEnvelope {
  const now = getChinaIso();
  return {
    templateKey: TEMPLATE_KEY,
    runtimeKey: RUNTIME_KEY,
    bridgeVersion: BRIDGE_VERSION,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

function getChinaIso(date = new Date()): string {
  const chinaOffsetMinutes = 8 * 60;
  const localOffsetMinutes = -date.getTimezoneOffset();
  const diffMinutes = chinaOffsetMinutes - localOffsetMinutes;
  const chinaTime = new Date(date.getTime() + diffMinutes * 60 * 1000);
  const year = chinaTime.getFullYear();
  const month = String(chinaTime.getMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getDate()).padStart(2, '0');
  const hours = String(chinaTime.getHours()).padStart(2, '0');
  const minutes = String(chinaTime.getMinutes()).padStart(2, '0');
  const seconds = String(chinaTime.getSeconds()).padStart(2, '0');
  const milliseconds = String(chinaTime.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}+08:00`;
}

function ensureInitialized(): void {
  initApp();
}

function compactSimulationResult(result: SimulationResult | null): PersistedSimulationResult | null {
  if (!result) return null;
  if (!result.replay) {
    return cloneSerializable(result);
  }
  return {
    type: result.type,
    stats: cloneSerializable(result.stats),
    timestamp: result.timestamp,
    replay: cloneSerializable(result.replay),
  };
}

function compactSimulationSnapshot(snapshot: SimulationSnapshot): PersistedSimulationSnapshot {
  const nextSimulations = Object.fromEntries(
    Object.entries(snapshot.simulations).map(([id, sim]) => [
      id,
      {
        ...cloneSerializable(sim),
        result: compactSimulationResult(sim.result),
      },
    ]),
  ) as Record<string, PersistedSimulationEntity>;

  return {
    simulations: nextSimulations,
    activeSimId: snapshot.activeSimId,
    nextId: snapshot.nextId,
  };
}

function hydrateSimulationResult(
  type: SimulationEntity['type'],
  params: SimulationEntity['params'],
  result: PersistedSimulationResult | null,
): SimulationResult | null {
  if (!result) return null;
  if (result.data !== undefined) {
    return cloneSerializable(result as SimulationResult);
  }
  if (result.replay) {
    return rebuildSimulationResultFromReplay(type, params, result.replay, result.timestamp);
  }
  return {
    type,
    data: null,
    stats: cloneSerializable(result.stats),
    timestamp: result.timestamp,
    replay: result.replay ?? null,
  };
}

function hydrateSimulationSnapshot(snapshot: PersistedSimulationSnapshot): SimulationSnapshot {
  const nextSimulations = Object.fromEntries(
    Object.entries(snapshot.simulations).map(([id, sim]) => [
      id,
      {
        ...cloneSerializable(sim),
        result: hydrateSimulationResult(sim.type, sim.params, sim.result),
      },
    ]),
  ) as Record<string, SimulationEntity>;

  return {
    simulations: nextSimulations,
    activeSimId: snapshot.activeSimId,
    nextId: snapshot.nextId,
  };
}

export function getVisualM05Snapshot(): VisualM05SnapshotDocument {
  ensureInitialized();

  const simulation = compactSimulationSnapshot(useSimulationStore.getState().getSnapshot());
  const ui = cloneSerializable(useUIStore.getState().getSnapshot());
  const animation = cloneSerializable(useAnimationStore.getState().getSnapshot());
  currentSnapshotCreatedAt = currentSnapshotCreatedAt ?? getChinaIso();

  return {
    envelope: buildEnvelope(currentSnapshotCreatedAt),
    payload: {
      simulation,
      ui,
      animation,
    },
  };
}

export function getVisualM05DefaultSnapshot(): VisualM05SnapshotDocument {
  ensureInitialized();
  return getVisualM05Snapshot();
}

export function validateVisualM05Snapshot(snapshot: unknown): ValidationResult {
  const errors: string[] = [];

  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, errors: ['snapshot 必须是对象'] };
  }

  const value = snapshot as Record<string, unknown>;
  const envelope = value.envelope;
  const payload = value.payload;

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    errors.push('缺少 envelope');
  } else {
    const meta = envelope as Record<string, unknown>;
    if (meta.templateKey !== TEMPLATE_KEY) {
      errors.push(`templateKey 必须为 ${TEMPLATE_KEY}`);
    }
    if (typeof meta.snapshotSchemaVersion !== 'number') {
      errors.push('snapshotSchemaVersion 必须是数字');
    } else if (meta.snapshotSchemaVersion > SNAPSHOT_SCHEMA_VERSION) {
      errors.push(
        `snapshotSchemaVersion ${meta.snapshotSchemaVersion} 高于当前支持的 ${SNAPSHOT_SCHEMA_VERSION}`,
      );
    }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('缺少 payload');
  } else {
    const data = payload as Record<string, unknown>;
    if (!data.simulation || typeof data.simulation !== 'object' || Array.isArray(data.simulation)) {
      errors.push('payload.simulation 缺失或非法');
    }
    if (data.ui !== undefined && (typeof data.ui !== 'object' || data.ui === null || Array.isArray(data.ui))) {
      errors.push('payload.ui 必须是对象');
    }
    if (
      data.animation !== undefined &&
      (typeof data.animation !== 'object' || data.animation === null || Array.isArray(data.animation))
    ) {
      errors.push('payload.animation 必须是对象');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function loadVisualM05Snapshot(snapshot: unknown): void {
  ensureInitialized();

  const validation = validateVisualM05Snapshot(snapshot);
  if (!validation.ok) {
    throw new Error(`Invalid visual_m05 snapshot: ${validation.errors.join('; ')}`);
  }

  const doc = cloneSerializable(snapshot as VisualM05SnapshotDocument);
  const payload = doc.payload;
  currentSnapshotCreatedAt = doc.envelope.createdAt;

  useSimulationStore.getState().loadSnapshot(hydrateSimulationSnapshot(payload.simulation));
  useUIStore.getState().loadSnapshot(payload.ui);
  useAnimationStore.getState().loadSnapshot(payload.animation);
  useHistoryStore.getState().reset();
}

function createBridge(): TemplateBridge {
  return {
    getDefaultSnapshot: getVisualM05DefaultSnapshot,
    getSnapshot: getVisualM05Snapshot,
    loadSnapshot: loadVisualM05Snapshot,
    validateSnapshot: validateVisualM05Snapshot,
    getAiContext: buildM05AiContext,
    applyOperations: applyM05AiOperations,
  };
}

export function registerTemplateBridge(): void {
  if (typeof window === 'undefined') return;

  ensureInitialized();
  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?.();

  const bridge = createBridge();
  window.__EDUMIND_TEMPLATE_BRIDGE__ = bridge;

  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    const data = message as {
      namespace?: string;
      type?: string;
      requestId?: string;
      payload?: unknown;
    };

    if (data.namespace !== 'edumind.templateBridge') return;

    let response:
      | { namespace: string; type: string; requestId?: string; success: true; payload?: unknown }
      | { namespace: string; type: string; requestId?: string; success: false; error: string };

    try {
      switch (data.type) {
        case 'getSnapshot':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
            payload: bridge.getSnapshot(),
          };
          break;
        case 'loadSnapshot':
          bridge.loadSnapshot(data.payload);
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
          };
          break;
        case 'validateSnapshot':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
            payload: bridge.validateSnapshot(data.payload),
          };
          break;
        case 'getAiContext':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
            payload: bridge.getAiContext(),
          };
          break;
        case 'applyOperations':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
            payload: bridge.applyOperations(data.payload),
          };
          break;
        default:
          return;
      }
    } catch (error) {
      response = {
        namespace: 'edumind.templateBridge',
        type: 'response',
        requestId: data.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    event.source?.postMessage(response, { targetOrigin: '*' });
  };

  window.addEventListener('message', handleMessage);
  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__ = () => {
    window.removeEventListener('message', handleMessage);
  };
}
