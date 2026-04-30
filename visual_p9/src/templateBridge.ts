import { getDefaultSimulationSnapshot, useSimulationStore, type SimulationSnapshot } from '@/store/simulationStore';
import { getDefaultUISnapshot, useUIStore, type UISnapshot } from '@/store/uiStore';

const TEMPLATE_KEY = 'phys-P09';
const RUNTIME_KEY = 'visual-p09';
const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 2;

interface TemplateSnapshotEnvelope {
  templateKey: string;
  runtimeKey: string;
  bridgeVersion: string;
  snapshotSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisualP09SnapshotDocument {
  envelope: TemplateSnapshotEnvelope;
  payload: {
    simulation: SimulationSnapshot;
    ui?: UISnapshot;
  };
}

interface SnapshotValidationResult {
  ok: boolean;
  errors: string[];
}

interface TemplateBridge {
  getDefaultSnapshot(): VisualP09SnapshotDocument;
  getSnapshot(): VisualP09SnapshotDocument;
  loadSnapshot(snapshot: unknown): SnapshotValidationResult;
  validateSnapshot(snapshot: unknown): SnapshotValidationResult;
}

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: TemplateBridge;
    __EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?: () => void;
  }
}

let currentSnapshotCreatedAt: string | null = null;

function cloneSerializable<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
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

export function getVisualP09Snapshot(): VisualP09SnapshotDocument {
  currentSnapshotCreatedAt = currentSnapshotCreatedAt ?? getChinaIso();
  return {
    envelope: buildEnvelope(currentSnapshotCreatedAt),
    payload: {
      simulation: cloneSerializable(useSimulationStore.getState().getSnapshot()),
      ui: cloneSerializable(useUIStore.getState().getSnapshot()),
    },
  };
}

export function getVisualP09DefaultSnapshot(): VisualP09SnapshotDocument {
  const now = getChinaIso();
  return {
    envelope: {
      ...buildEnvelope(now),
      createdAt: now,
      updatedAt: now,
    },
    payload: {
      simulation: getDefaultSimulationSnapshot(),
      ui: getDefaultUISnapshot(),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateSimulationPayload(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('payload.simulation 缺失或非法');
    return;
  }

  const requiredBooleans = ['isPlaying', 'showVectors', 'showAreaSectors'];
  const requiredNumbers = ['speedMultiplier', 'hohmannIgnitionAngle'];
  if (typeof value.currentModelId !== 'string') errors.push('payload.simulation.currentModelId 必须是字符串');
  if (!isRecord(value.paramsByModel)) errors.push('payload.simulation.paramsByModel 必须是对象');
  for (const key of requiredBooleans) {
    if (typeof value[key] !== 'boolean') errors.push(`payload.simulation.${key} 必须是布尔值`);
  }
  for (const key of requiredNumbers) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      errors.push(`payload.simulation.${key} 必须是数字`);
    }
  }
  if (typeof value.hohmannPhase !== 'string') errors.push('payload.simulation.hohmannPhase 必须是字符串');
}

function validateUIPayload(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('payload.ui 缺失或非法');
    return;
  }
  if (!isRecord(value.layout)) errors.push('payload.ui.layout 必须是对象');
  if (!isRecord(value.viewport)) errors.push('payload.ui.viewport 必须是对象');
}

export function validateVisualP09Snapshot(snapshot: unknown): SnapshotValidationResult {
  const errors: string[] = [];

  if (!isRecord(snapshot)) {
    return { ok: false, errors: ['snapshot 必须是对象'] };
  }

  const envelope = snapshot.envelope;
  const payload = snapshot.payload;
  let schemaVersion: number | null = null;

  if (!isRecord(envelope)) {
    errors.push('缺少 envelope');
  } else {
    if (envelope.templateKey !== TEMPLATE_KEY) errors.push(`templateKey 必须为 ${TEMPLATE_KEY}`);
    if (envelope.runtimeKey !== RUNTIME_KEY) errors.push(`runtimeKey 必须为 ${RUNTIME_KEY}`);
    if (typeof envelope.bridgeVersion !== 'string') errors.push('bridgeVersion 必须是字符串');
    if (typeof envelope.createdAt !== 'string') errors.push('createdAt 必须是字符串');
    if (typeof envelope.updatedAt !== 'string') errors.push('updatedAt 必须是字符串');
    if (typeof envelope.snapshotSchemaVersion !== 'number') {
      errors.push('snapshotSchemaVersion 必须是数字');
    } else {
      schemaVersion = envelope.snapshotSchemaVersion;
      if (envelope.snapshotSchemaVersion > SNAPSHOT_SCHEMA_VERSION) {
        errors.push(`snapshotSchemaVersion ${envelope.snapshotSchemaVersion} 高于当前支持版本 ${SNAPSHOT_SCHEMA_VERSION}`);
      }
    }
  }

  if (!isRecord(payload)) {
    errors.push('缺少 payload');
  } else {
    validateSimulationPayload(payload.simulation, errors);
    if (payload.ui !== undefined) {
      validateUIPayload(payload.ui, errors);
    } else if (schemaVersion !== null && schemaVersion >= 2) {
      errors.push('payload.ui 缺失或非法');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function loadVisualP09Snapshot(snapshot: unknown): SnapshotValidationResult {
  const validation = validateVisualP09Snapshot(snapshot);
  if (!validation.ok) return validation;

  const doc = cloneSerializable(snapshot as VisualP09SnapshotDocument);
  currentSnapshotCreatedAt = doc.envelope.createdAt;
  useSimulationStore.getState().loadSnapshot(doc.payload.simulation);
  useUIStore.getState().loadSnapshot(doc.payload.ui);
  return validation;
}

function createBridge(): TemplateBridge {
  return {
    getDefaultSnapshot: getVisualP09DefaultSnapshot,
    getSnapshot: getVisualP09Snapshot,
    loadSnapshot: loadVisualP09Snapshot,
    validateSnapshot: validateVisualP09Snapshot,
  };
}

export function registerTemplateBridge(): void {
  if (typeof window === 'undefined') return;
  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?.();

  const bridge = createBridge();
  window.__EDUMIND_TEMPLATE_BRIDGE__ = bridge;

  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    if (!isRecord(message)) return;
    if (message.namespace !== 'edumind.templateBridge') return;

    let response:
      | { namespace: string; type: string; requestId?: string; success: true; payload?: unknown }
      | { namespace: string; type: string; requestId?: string; success: false; error: string };

    try {
      switch (message.type) {
        case 'getSnapshot':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: typeof message.requestId === 'string' ? message.requestId : undefined,
            success: true,
            payload: bridge.getSnapshot(),
          };
          break;
        case 'loadSnapshot': {
          const result = bridge.loadSnapshot(message.payload);
          response = result.ok
            ? {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: typeof message.requestId === 'string' ? message.requestId : undefined,
              success: true,
              payload: result,
            }
            : {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: typeof message.requestId === 'string' ? message.requestId : undefined,
              success: false,
              error: result.errors.join('; '),
            };
          break;
        }
        case 'validateSnapshot':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: typeof message.requestId === 'string' ? message.requestId : undefined,
            success: true,
            payload: bridge.validateSnapshot(message.payload),
          };
          break;
        default:
          return;
      }
    } catch (error) {
      response = {
        namespace: 'edumind.templateBridge',
        type: 'response',
        requestId: typeof message.requestId === 'string' ? message.requestId : undefined,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    event.source?.postMessage(response, { targetOrigin: '*' });
  };

  window.addEventListener('message', handleMessage);
  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__ = () => {
    window.removeEventListener('message', handleMessage);
    if (window.__EDUMIND_TEMPLATE_BRIDGE__) delete window.__EDUMIND_TEMPLATE_BRIDGE__;
    delete window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__;
  };
}
