export const TEMPLATE_BRIDGE_NAMESPACE = 'edumind.templateBridge';
export const TEMPLATE_BRIDGE_GLOBAL_KEY = '__EDUMIND_TEMPLATE_BRIDGE__';
export const M01_TEMPLATE_KEY = 'm01';
export const M01_RUNTIME_KEY = 'visual-m01';
export const M01_BRIDGE_VERSION = '1.0.0';
export const M01_SNAPSHOT_SCHEMA_VERSION = 1;

export interface M01SceneSnapshot {
  entities: Record<string, unknown>;
  nextId: number;
  activeGeometryId: string | null;
}

export interface M01SnapshotEnvelope {
  envelope: {
    templateKey: string;
    runtimeKey: string;
    bridgeVersion: string;
    snapshotSchemaVersion: number;
    createdAt: string;
    updatedAt: string;
  };
  payload: {
    scene: M01SceneSnapshot;
  };
}

export interface BridgeValidationResult {
  ok: boolean;
  errors: string[];
}

export interface BridgeOperationResult {
  ok: boolean;
  errors: string[];
  applied: number;
}

export interface TemplateAiContext {
  templateKey: string;
  summary: string;
  [key: string]: unknown;
}

export interface EdumindTemplateBridge {
  getDefaultSnapshot: () => M01SnapshotEnvelope;
  getSnapshot: () => M01SnapshotEnvelope;
  getAiContext?: () => TemplateAiContext;
  loadSnapshot: (snapshot: unknown) => void;
  validateSnapshot: (snapshot: unknown) => BridgeValidationResult;
  applyOperations?: (operations: unknown) => BridgeOperationResult | Promise<BridgeOperationResult>;
}

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: EdumindTemplateBridge;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export function createDefaultSceneSnapshot(): M01SceneSnapshot {
  return {
    entities: {},
    nextId: 1,
    activeGeometryId: null,
  };
}

export function buildSnapshotEnvelope(
  snapshot: M01SceneSnapshot,
  options?: { createdAt?: string; updatedAt?: string }
): M01SnapshotEnvelope {
  const createdAt = options?.createdAt || nowIso();
  const updatedAt = options?.updatedAt || createdAt;

  return {
    envelope: {
      templateKey: M01_TEMPLATE_KEY,
      runtimeKey: M01_RUNTIME_KEY,
      bridgeVersion: M01_BRIDGE_VERSION,
      snapshotSchemaVersion: M01_SNAPSHOT_SCHEMA_VERSION,
      createdAt,
      updatedAt,
    },
    payload: {
      scene: snapshot,
    },
  };
}

export function getDefaultSnapshotEnvelope(): M01SnapshotEnvelope {
  return buildSnapshotEnvelope(createDefaultSceneSnapshot());
}

export function extractSceneSnapshot(snapshot: unknown): M01SceneSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') return null;

  const value = snapshot as Record<string, unknown>;

  const payload = value.payload;
  if (payload && typeof payload === 'object') {
    const scene = (payload as Record<string, unknown>).scene;
    if (scene && typeof scene === 'object') {
      const sceneValue = scene as Record<string, unknown>;
      if (
        typeof sceneValue.nextId === 'number' &&
        sceneValue.entities &&
        typeof sceneValue.entities === 'object'
      ) {
        return {
          entities: sceneValue.entities as Record<string, unknown>,
          nextId: sceneValue.nextId,
          activeGeometryId:
            typeof sceneValue.activeGeometryId === 'string' || sceneValue.activeGeometryId === null
              ? sceneValue.activeGeometryId
              : null,
        };
      }
    }
  }

  if (
    value.entities &&
    typeof value.entities === 'object' &&
    typeof value.nextId === 'number'
  ) {
    return {
      entities: value.entities as Record<string, unknown>,
      nextId: value.nextId,
      activeGeometryId:
        typeof value.activeGeometryId === 'string' || value.activeGeometryId === null
          ? value.activeGeometryId
          : null,
    };
  }

  return null;
}

export function validateSnapshotPayload(snapshot: unknown): BridgeValidationResult {
  const errors: string[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return {
      ok: false,
      errors: ['snapshot 必须是对象'],
    };
  }

  const value = snapshot as Record<string, unknown>;

  if (!value.envelope || typeof value.envelope !== 'object') {
    errors.push('缺少 envelope');
  } else {
    const envelope = value.envelope as Record<string, unknown>;
    if (envelope.templateKey !== M01_TEMPLATE_KEY) {
      errors.push(`templateKey 必须为 ${M01_TEMPLATE_KEY}`);
    }
    if (typeof envelope.snapshotSchemaVersion !== 'number') {
      errors.push('snapshotSchemaVersion 必须为数字');
    }
  }

  const scene = extractSceneSnapshot(snapshot);
  if (!scene) {
    errors.push('payload.scene 结构无效，缺少 entities / nextId / activeGeometryId');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
