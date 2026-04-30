import { useElectrochemStore, type ElectrochemStoreSnapshot } from './store/electrochemStore';
import { getChem06AiContext } from './runtime/aiContext';
import { applyChem06Operations, type ApplyOperationsResult } from './runtime/aiOperations';

const TEMPLATE_KEY = 'chem06';
const RUNTIME_KEY = 'visual-chem06';
const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 1;

interface TemplateSnapshotEnvelope {
  templateKey: string;
  runtimeKey: string;
  bridgeVersion: string;
  snapshotSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface VisualChem06SnapshotPayload {
  electrochem: ElectrochemStoreSnapshot;
}

export interface VisualChem06SnapshotDocument {
  envelope: TemplateSnapshotEnvelope;
  payload: VisualChem06SnapshotPayload;
}

interface SnapshotValidationResult {
  ok: boolean;
  errors: string[];
}

interface TemplateBridge {
  getDefaultSnapshot(): VisualChem06SnapshotDocument;
  getSnapshot(): VisualChem06SnapshotDocument;
  loadSnapshot(snapshot: unknown): SnapshotValidationResult;
  validateSnapshot(snapshot: unknown): SnapshotValidationResult;
  getAiContext(): ReturnType<typeof getChem06AiContext>;
  applyOperations(operations: unknown): ApplyOperationsResult;
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

let currentSnapshotCreatedAt: string | null = null;

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

function stabilizeSnapshot(snapshot: ElectrochemStoreSnapshot): ElectrochemStoreSnapshot {
  return {
    ...snapshot,
    // Playback is volatile runtime state driven by requestAnimationFrame. Keeping
    // it in bridge snapshots makes host AI consistency checks fail while playing.
    playing: false,
    progress: 0,
  };
}

export function getVisualChem06Snapshot(): VisualChem06SnapshotDocument {
  const electrochem = stabilizeSnapshot(cloneSerializable(useElectrochemStore.getState().getSnapshot()));
  currentSnapshotCreatedAt = currentSnapshotCreatedAt ?? getChinaIso();

  return {
    envelope: buildEnvelope(currentSnapshotCreatedAt),
    payload: {
      electrochem,
    },
  };
}

export function getVisualChem06DefaultSnapshot(): VisualChem06SnapshotDocument {
  return getVisualChem06Snapshot();
}

export function validateVisualChem06Snapshot(snapshot: unknown): SnapshotValidationResult {
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
    if (!data.electrochem || typeof data.electrochem !== 'object' || Array.isArray(data.electrochem)) {
      errors.push('payload.electrochem 缺失或非法');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function loadVisualChem06Snapshot(snapshot: unknown): SnapshotValidationResult {
  const validation = validateVisualChem06Snapshot(snapshot);
  if (!validation.ok) return validation;

  const doc = cloneSerializable(snapshot as VisualChem06SnapshotDocument);
  currentSnapshotCreatedAt = doc.envelope.createdAt;
  useElectrochemStore.getState().loadSnapshot(doc.payload.electrochem);
  return validation;
}

function createBridge(): TemplateBridge {
  return {
    getDefaultSnapshot: getVisualChem06DefaultSnapshot,
    getSnapshot: getVisualChem06Snapshot,
    loadSnapshot: loadVisualChem06Snapshot,
    validateSnapshot: validateVisualChem06Snapshot,
    getAiContext: getChem06AiContext,
    applyOperations: applyChem06Operations,
  };
}

export function registerTemplateBridge(): void {
  if (typeof window === 'undefined') return;

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
        case 'loadSnapshot': {
          const result = bridge.loadSnapshot(data.payload);
          if (result.ok) {
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: data.requestId,
              success: true,
              payload: result,
            };
          } else {
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: data.requestId,
              success: false,
              error: result.errors.join('; '),
            };
          }
          break;
        }
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
    delete window.__EDUMIND_TEMPLATE_BRIDGE__;
  };
}
