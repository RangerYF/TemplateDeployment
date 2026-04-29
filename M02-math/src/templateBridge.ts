import { navigate } from '@/lib/navigate';
import { useFunctionStore, type FunctionStoreSnapshot } from '@/editor/store/functionStore';
import {
  useInteractionStore,
  type M02InteractionSnapshot,
} from '@/editor/store/interactionStore';
import {
  useParamAnimationStore,
  type ParamAnimationStoreSnapshot,
} from '@/editor/store/paramAnimationStore';
import { useEntityStore, type EntityStoreSnapshot } from '@/editor/store/entityStore';
import {
  useM03InteractionStore,
  type M03InteractionSnapshot,
} from '@/editor/store/m03InteractionStore';
import { useLocusStore, type LocusStoreSnapshot } from '@/editor/store/locusStore';
import { useOpticalStore, type OpticalStoreSnapshot } from '@/editor/store/opticalStore';
import { useUnitCircleStore, type UnitCircleStoreSnapshot } from '@/editor/store/unitCircleStore';
import { useM04FunctionStore, type M04FunctionStoreSnapshot } from '@/editor/store/m04FunctionStore';
import {
  useTriangleSolverStore,
  type TriangleSolverStoreSnapshot,
} from '@/editor/store/triangleSolverStore';
import { useTrigStore, type TrigStoreSnapshot } from '@/editor/store/trigStore';
import { useM04UiStore, type M04UiStoreSnapshot } from '@/editor/store/m04UiStore';
import { buildM02AiContext, type M02AiContext } from '@/runtime/aiContext';
import { applyAiOperations, type BridgeOperationResult } from '@/runtime/aiOperations';
import { buildM03AiContext, type M03AiContext } from '@/runtime/m03AiContext';
import { applyM03AiOperations, type M03BridgeOperationResult } from '@/runtime/m03AiOperations';
import { buildM04AiContext, type M04AiContext } from '@/runtime/m04AiContext';
import { applyM04AiOperations, type M04BridgeOperationResult } from '@/runtime/m04AiOperations';

const RUNTIME_KEY = 'visual-math-suite';
const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 1;
type SupportedTemplateKey = 'm02' | 'm03' | 'm04';

interface TemplateSnapshotEnvelope {
  templateKey: SupportedTemplateKey;
  runtimeKey: string;
  bridgeVersion: string;
  snapshotSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface VisualMathSuiteSnapshotPayload {
  skill: {
    activeSkill: SupportedTemplateKey;
  };
  m02?: {
    function: FunctionStoreSnapshot;
    interaction?: M02InteractionSnapshot;
    paramAnimation: ParamAnimationStoreSnapshot;
  };
  m03?: {
    entity: EntityStoreSnapshot;
    interaction: M03InteractionSnapshot;
    locus: LocusStoreSnapshot;
    optical: OpticalStoreSnapshot;
  };
  m04?: {
    ui: M04UiStoreSnapshot;
    unitCircle: UnitCircleStoreSnapshot;
    functionGraph: M04FunctionStoreSnapshot;
    triangleSolver: TriangleSolverStoreSnapshot;
    trig: TrigStoreSnapshot;
  };
}

export interface VisualMathSuiteSnapshotDocument {
  envelope: TemplateSnapshotEnvelope;
  payload: VisualMathSuiteSnapshotPayload;
}

interface SnapshotValidationResult {
  ok: boolean;
  errors: string[];
}

interface TemplateBridge {
  getDefaultSnapshot(): VisualMathSuiteSnapshotDocument;
  getSnapshot(): VisualMathSuiteSnapshotDocument;
  getAiContext(): M02AiContext | M03AiContext | M04AiContext | null;
  applyOperations(operations: unknown): Promise<BridgeOperationResult | M03BridgeOperationResult | M04BridgeOperationResult>;
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
    templateKey: resolveActiveTemplate(),
    runtimeKey: RUNTIME_KEY,
    bridgeVersion: BRIDGE_VERSION,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

function resolveActiveTemplate(): SupportedTemplateKey {
  if (typeof window === 'undefined') return 'm02';
  const seg = window.location.pathname.replace(/^\//, '').toLowerCase().split('/')[0];
  if (seg === 'm03' || seg === 'm04') return seg;
  return 'm02';
}

function ensureRoute(templateKey: SupportedTemplateKey) {
  if (typeof window === 'undefined') return;
  const targetPath = `/${templateKey}`;
  if (window.location.pathname !== targetPath) {
    navigate(targetPath);
  }
}

export function getM02Snapshot(): VisualMathSuiteSnapshotDocument {
  const functionState = cloneSerializable(useFunctionStore.getState().getSnapshot());
  const interaction = cloneSerializable(useInteractionStore.getState().getSnapshot());
  const paramAnimation = cloneSerializable(useParamAnimationStore.getState().getSnapshot());
  currentSnapshotCreatedAt = currentSnapshotCreatedAt ?? getChinaIso();

  return {
    envelope: buildEnvelope(currentSnapshotCreatedAt),
    payload: {
      skill: {
        activeSkill: 'm02',
      },
      m02: {
        function: functionState,
        interaction,
        paramAnimation,
      },
    },
  };
}

export function getM03Snapshot(): VisualMathSuiteSnapshotDocument {
  const entity = cloneSerializable(useEntityStore.getState().getSnapshot());
  const interaction = cloneSerializable(useM03InteractionStore.getState().getSnapshot());
  const locus = cloneSerializable(useLocusStore.getState().getSnapshot());
  const optical = cloneSerializable(useOpticalStore.getState().getSnapshot());
  currentSnapshotCreatedAt = currentSnapshotCreatedAt ?? getChinaIso();

  return {
    envelope: {
      ...buildEnvelope(currentSnapshotCreatedAt),
      templateKey: 'm03',
    },
    payload: {
      skill: {
        activeSkill: 'm03',
      },
      m03: {
        entity,
        interaction,
        locus,
        optical,
      },
    },
  };
}

export function getM04Snapshot(): VisualMathSuiteSnapshotDocument {
  const ui = cloneSerializable(useM04UiStore.getState().getSnapshot());
  const unitCircle = cloneSerializable(useUnitCircleStore.getState().getSnapshot());
  const functionGraph = cloneSerializable(useM04FunctionStore.getState().getSnapshot());
  const triangleSolver = cloneSerializable(useTriangleSolverStore.getState().getSnapshot());
  const trig = cloneSerializable(useTrigStore.getState().getSnapshot());
  currentSnapshotCreatedAt = currentSnapshotCreatedAt ?? getChinaIso();

  return {
    envelope: {
      ...buildEnvelope(currentSnapshotCreatedAt),
      templateKey: 'm04',
    },
    payload: {
      skill: {
        activeSkill: 'm04',
      },
      m04: {
        ui,
        unitCircle,
        functionGraph,
        triangleSolver,
        trig,
      },
    },
  };
}

export function getM02DefaultSnapshot(): VisualMathSuiteSnapshotDocument {
  return getM02Snapshot();
}

function getDefaultSnapshotForTemplate(templateKey: SupportedTemplateKey): VisualMathSuiteSnapshotDocument {
  if (templateKey === 'm03') return getM03Snapshot();
  if (templateKey === 'm04') return getM04Snapshot();
  return getM02Snapshot();
}

export function validateM02Snapshot(snapshot: unknown): SnapshotValidationResult {
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
    if (meta.templateKey !== 'm02' && meta.templateKey !== 'm03' && meta.templateKey !== 'm04') {
      errors.push('templateKey 必须为 m02、m03 或 m04');
    }
    if (meta.runtimeKey !== RUNTIME_KEY) {
      errors.push(`runtimeKey 必须为 ${RUNTIME_KEY}`);
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
    if (!data.skill || typeof data.skill !== 'object' || Array.isArray(data.skill)) {
      errors.push('payload.skill 缺失或非法');
    } else {
      const skill = data.skill as Record<string, unknown>;
      if (skill.activeSkill !== 'm02' && skill.activeSkill !== 'm03' && skill.activeSkill !== 'm04') {
        errors.push('payload.skill.activeSkill 必须为 m02、m03 或 m04');
      }
    }
    const skill = data.skill as Record<string, unknown> | undefined;
    if (skill?.activeSkill === 'm02') {
      if (!data.m02 || typeof data.m02 !== 'object' || Array.isArray(data.m02)) {
        errors.push('payload.m02 缺失或非法');
      } else {
        const m02 = data.m02 as Record<string, unknown>;
        if (!m02.function || typeof m02.function !== 'object' || Array.isArray(m02.function)) {
          errors.push('payload.m02.function 缺失或非法');
        }
        if (
          m02.interaction !== undefined &&
          (!m02.interaction || typeof m02.interaction !== 'object' || Array.isArray(m02.interaction))
        ) {
          errors.push('payload.m02.interaction 非法');
        }
        if (!m02.paramAnimation || typeof m02.paramAnimation !== 'object' || Array.isArray(m02.paramAnimation)) {
          errors.push('payload.m02.paramAnimation 缺失或非法');
        }
      }
    } else if (skill?.activeSkill === 'm03') {
      if (!data.m03 || typeof data.m03 !== 'object' || Array.isArray(data.m03)) {
        errors.push('payload.m03 缺失或非法');
      } else {
        const m03 = data.m03 as Record<string, unknown>;
        if (!m03.entity || typeof m03.entity !== 'object' || Array.isArray(m03.entity)) {
          errors.push('payload.m03.entity 缺失或非法');
        }
        if (!m03.interaction || typeof m03.interaction !== 'object' || Array.isArray(m03.interaction)) {
          errors.push('payload.m03.interaction 缺失或非法');
        }
        if (!m03.locus || typeof m03.locus !== 'object' || Array.isArray(m03.locus)) {
          errors.push('payload.m03.locus 缺失或非法');
        }
        if (!m03.optical || typeof m03.optical !== 'object' || Array.isArray(m03.optical)) {
          errors.push('payload.m03.optical 缺失或非法');
        }
      }
    } else if (skill?.activeSkill === 'm04') {
      if (!data.m04 || typeof data.m04 !== 'object' || Array.isArray(data.m04)) {
        errors.push('payload.m04 缺失或非法');
      } else {
        const m04 = data.m04 as Record<string, unknown>;
        if (!m04.ui || typeof m04.ui !== 'object' || Array.isArray(m04.ui)) {
          errors.push('payload.m04.ui 缺失或非法');
        }
        if (!m04.unitCircle || typeof m04.unitCircle !== 'object' || Array.isArray(m04.unitCircle)) {
          errors.push('payload.m04.unitCircle 缺失或非法');
        }
        if (!m04.functionGraph || typeof m04.functionGraph !== 'object' || Array.isArray(m04.functionGraph)) {
          errors.push('payload.m04.functionGraph 缺失或非法');
        }
        if (!m04.triangleSolver || typeof m04.triangleSolver !== 'object' || Array.isArray(m04.triangleSolver)) {
          errors.push('payload.m04.triangleSolver 缺失或非法');
        }
        if (!m04.trig || typeof m04.trig !== 'object' || Array.isArray(m04.trig)) {
          errors.push('payload.m04.trig 缺失或非法');
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function loadM02Snapshot(snapshot: unknown): SnapshotValidationResult {
  const validation = validateM02Snapshot(snapshot);
  if (!validation.ok) return validation;

  const doc = cloneSerializable(snapshot as VisualMathSuiteSnapshotDocument);
  currentSnapshotCreatedAt = doc.envelope.createdAt;
  const activeSkill = doc.payload.skill.activeSkill;
  ensureRoute(activeSkill);
  if (activeSkill === 'm02' && doc.payload.m02) {
    useFunctionStore.getState().loadSnapshot(doc.payload.m02.function);
    useInteractionStore.getState().loadSnapshot(doc.payload.m02.interaction);
    useParamAnimationStore.getState().loadSnapshot(doc.payload.m02.paramAnimation);
  } else if (activeSkill === 'm03' && doc.payload.m03) {
    useEntityStore.getState().loadSnapshot(doc.payload.m03.entity);
    useM03InteractionStore.getState().loadSnapshot(doc.payload.m03.interaction);
    useLocusStore.getState().loadSnapshot(doc.payload.m03.locus);
    useOpticalStore.getState().loadSnapshot(doc.payload.m03.optical);
  } else if (activeSkill === 'm04' && doc.payload.m04) {
    useM04UiStore.getState().loadSnapshot(doc.payload.m04.ui);
    useM04FunctionStore.getState().loadSnapshot(doc.payload.m04.functionGraph);
    useTrigStore.getState().loadSnapshot(doc.payload.m04.trig);
    useTriangleSolverStore.getState().loadSnapshot(doc.payload.m04.triangleSolver);
    useUnitCircleStore.getState().loadSnapshot(doc.payload.m04.unitCircle);
  }
  return validation;
}

function createBridge(): TemplateBridge {
  return {
    getDefaultSnapshot: () => getDefaultSnapshotForTemplate(resolveActiveTemplate()),
    getSnapshot: () => getDefaultSnapshotForTemplate(resolveActiveTemplate()),
    getAiContext: () => {
      const template = resolveActiveTemplate();
      if (template === 'm02') return buildM02AiContext();
      if (template === 'm03') return buildM03AiContext();
      if (template === 'm04') return buildM04AiContext();
      return null;
    },
    applyOperations: (operations: unknown) => {
      const template = resolveActiveTemplate();
      if (template === 'm02') return applyAiOperations(operations);
      if (template === 'm03') return applyM03AiOperations(operations);
      if (template === 'm04') return applyM04AiOperations(operations);
      return Promise.resolve({
        ok: false,
        errors: ['当前模板暂不支持 AI operations'],
        applied: 0,
      });
    },
    loadSnapshot: loadM02Snapshot,
    validateSnapshot: validateM02Snapshot,
  };
}

export function registerTemplateBridge(): void {
  if (typeof window === 'undefined') return;

  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?.();
  const bridge = createBridge();
  window.__EDUMIND_TEMPLATE_BRIDGE__ = bridge;

    const handleMessage = async (event: MessageEvent) => {
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
        case 'getDefaultSnapshot':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
            payload: bridge.getDefaultSnapshot(),
          };
          break;
        case 'getSnapshot':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
            payload: bridge.getSnapshot(),
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
        case 'applyOperations': {
          const result = await bridge.applyOperations(data.payload);
          response = result.ok
            ? {
                namespace: 'edumind.templateBridge',
                type: 'response',
                requestId: data.requestId,
                success: true,
                payload: result,
              }
            : {
                namespace: 'edumind.templateBridge',
                type: 'response',
                requestId: data.requestId,
                success: false,
                error: result.errors.join('; '),
              };
          break;
        }
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
