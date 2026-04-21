import { useDemoEntityStore } from './editor/demo/demoEntityStore';
import { useDemoToolStore, type DemoToolSnapshot } from './editor/demo/demoToolStore';
import type { DemoSnapshot } from './editor/demo/demoTypes';
import { useHistoryStore, useUIStore, useVectorStore } from './editor/store';
import type { UISnapshot } from './editor/store/uiStore';
import type { VectorSnapshot } from './editor/store/vectorStore';

const TEMPLATE_KEY = 'm06';
const RUNTIME_KEY = 'visual-m06';
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

interface VisualM06SnapshotPayload {
  vector: VectorSnapshot;
  ui: UISnapshot;
  demo: DemoSnapshot;
  demoTool: DemoToolSnapshot;
}

export interface VisualM06SnapshotDocument {
  envelope: TemplateSnapshotEnvelope;
  payload: VisualM06SnapshotPayload;
}

interface SnapshotValidationResult {
  ok: boolean;
  errors: string[];
}

interface TemplateBridge {
  getDefaultSnapshot(): VisualM06SnapshotDocument;
  getSnapshot(): VisualM06SnapshotDocument;
  loadSnapshot(snapshot: unknown): SnapshotValidationResult;
  validateSnapshot(snapshot: unknown): SnapshotValidationResult;
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

export function getVisualM06Snapshot(): VisualM06SnapshotDocument {
  const vector = cloneSerializable(useVectorStore.getState().getSnapshot());
  const ui = cloneSerializable(useUIStore.getState().getSnapshot());
  const demo = cloneSerializable(useDemoEntityStore.getState().getSnapshot());
  const demoTool = cloneSerializable(useDemoToolStore.getState().getSnapshot());
  currentSnapshotCreatedAt = currentSnapshotCreatedAt ?? getChinaIso();

  return {
    envelope: buildEnvelope(currentSnapshotCreatedAt),
    payload: {
      vector,
      ui,
      demo,
      demoTool,
    },
  };
}

export function getVisualM06DefaultSnapshot(): VisualM06SnapshotDocument {
  return getVisualM06Snapshot();
}

export function validateVisualM06Snapshot(snapshot: unknown): SnapshotValidationResult {
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
    if (!data.vector || typeof data.vector !== 'object' || Array.isArray(data.vector)) {
      errors.push('payload.vector 缺失或非法');
    }
    if (!data.ui || typeof data.ui !== 'object' || Array.isArray(data.ui)) {
      errors.push('payload.ui 缺失或非法');
    }
    if (!data.demo || typeof data.demo !== 'object' || Array.isArray(data.demo)) {
      errors.push('payload.demo 缺失或非法');
    }
    if (!data.demoTool || typeof data.demoTool !== 'object' || Array.isArray(data.demoTool)) {
      errors.push('payload.demoTool 缺失或非法');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function loadVisualM06Snapshot(snapshot: unknown): SnapshotValidationResult {
  const validation = validateVisualM06Snapshot(snapshot);
  if (!validation.ok) return validation;

  const doc = cloneSerializable(snapshot as VisualM06SnapshotDocument);
  currentSnapshotCreatedAt = doc.envelope.createdAt;

  useVectorStore.getState().loadSnapshot(doc.payload.vector);
  useUIStore.getState().loadSnapshot(doc.payload.ui);
  useDemoEntityStore.getState().loadSnapshot(doc.payload.demo);
  useDemoToolStore.getState().loadSnapshot(doc.payload.demoTool);
  useHistoryStore.setState({
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  });

  return validation;
}

function createBridge(): TemplateBridge {
  return {
    getDefaultSnapshot: getVisualM06DefaultSnapshot,
    getSnapshot: getVisualM06Snapshot,
    loadSnapshot: loadVisualM06Snapshot,
    validateSnapshot: validateVisualM06Snapshot,
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
        case 'loadSnapshot':
          {
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
          }
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
