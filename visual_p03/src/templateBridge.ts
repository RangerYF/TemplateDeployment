/**
 * templateBridge.ts
 * Iframe communication bridge for visual_p03 (optics).
 * Exposes snapshot get/set/validate on window.__EDUMIND_TEMPLATE_BRIDGE__
 * and handles postMessage from the parent platform.
 *
 * Follows the P09 bridge pattern; adds P03-specific operations
 * (setActiveModule, loadOpticsExperiment, setModuleParams, setDisplayOptions).
 */

import { useSimulationStore } from '@/store/simulationStore';
import { useLensStore } from '@/store/lensStore';
import { useDoubleSlitStore } from '@/store/doubleSlitStore';
import { useDiffractionStore } from '@/store/diffractionStore';
import { useThinFilmStore } from '@/store/thinFilmStore';
import { useModuleStore, type ModuleId } from '@/store/moduleStore';
import { useUIStore, getDefaultUISnapshot, type UISnapshot } from '@/store/uiStore';

import type { RefractionSettings } from '@/data/refractionData';
import { buildDefaultSettings as buildDefaultRefractionSettings } from '@/data/refractionData';
import type { LensSettings } from '@/data/lensData';
import { buildDefaultLensSettings } from '@/data/lensData';
import type { DoubleSlitSettings } from '@/data/doubleSlitData';
import { buildDefaultDoubleSlitSettings } from '@/data/doubleSlitData';
import type { DiffractionSettings } from '@/data/diffractionData';
import { buildDefaultDiffractionSettings } from '@/data/diffractionData';
import type { ThinFilmSettings } from '@/data/thinFilmData';
import { buildDefaultThinFilmSettings } from '@/data/thinFilmData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEMPLATE_KEY = 'phys-P03';
const RUNTIME_KEY = 'visual-p03';
const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 1;

const MODULE_IDS: readonly ModuleId[] = ['refraction', 'lens', 'doubleslit', 'diffraction', 'thinfilm'];

// ---------------------------------------------------------------------------
// Snapshot document types
// ---------------------------------------------------------------------------

interface TemplateSnapshotEnvelope {
  templateKey: string;
  runtimeKey: string;
  bridgeVersion: string;
  snapshotSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface VisualP03SnapshotDocument {
  envelope: TemplateSnapshotEnvelope;
  payload: {
    activeModule: ModuleId;
    refraction?: RefractionSettings;
    lens?: LensSettings;
    doubleslit?: DoubleSlitSettings;
    diffraction?: DiffractionSettings;
    thinfilm?: ThinFilmSettings;
    ui?: UISnapshot;
  };
}

interface SnapshotValidationResult {
  ok: boolean;
  errors: string[];
}

interface OperationResult {
  ok: boolean;
  applied: number;
  errors: string[];
  warnings: string[];
}

interface TemplateBridge {
  getDefaultSnapshot(): VisualP03SnapshotDocument;
  getSnapshot(): VisualP03SnapshotDocument;
  loadSnapshot(snapshot: unknown): SnapshotValidationResult;
  validateSnapshot(snapshot: unknown): SnapshotValidationResult;
  applyOperations(operations: unknown): OperationResult;
}

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: TemplateBridge;
    __EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?: () => void;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && (MODULE_IDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// getSnapshot / getDefaultSnapshot
// ---------------------------------------------------------------------------

export function getSnapshot(): VisualP03SnapshotDocument {
  currentSnapshotCreatedAt = currentSnapshotCreatedAt ?? getChinaIso();
  return {
    envelope: buildEnvelope(currentSnapshotCreatedAt),
    payload: {
      activeModule: useModuleStore.getState().activeModule,
      refraction: cloneSerializable(useSimulationStore.getState().getSnapshot().settings),
      lens: cloneSerializable(useLensStore.getState().getSnapshot().settings),
      doubleslit: cloneSerializable(useDoubleSlitStore.getState().getSnapshot().settings),
      diffraction: cloneSerializable(useDiffractionStore.getState().getSnapshot().settings),
      thinfilm: cloneSerializable(useThinFilmStore.getState().getSnapshot().settings),
      ui: cloneSerializable(useUIStore.getState().getSnapshot()),
    },
  };
}

export function getDefaultSnapshot(): VisualP03SnapshotDocument {
  const now = getChinaIso();
  return {
    envelope: { ...buildEnvelope(now), createdAt: now, updatedAt: now },
    payload: {
      activeModule: 'refraction',
      refraction: buildDefaultRefractionSettings(),
      lens: buildDefaultLensSettings(),
      doubleslit: buildDefaultDoubleSlitSettings(),
      diffraction: buildDefaultDiffractionSettings(),
      thinfilm: buildDefaultThinFilmSettings(),
      ui: getDefaultUISnapshot(),
    },
  };
}

// ---------------------------------------------------------------------------
// validateSnapshot
// ---------------------------------------------------------------------------

function validateModulePayload(name: string, value: unknown, errors: string[]): void {
  if (value !== undefined && !isRecord(value)) {
    errors.push(`payload.${name} must be an object when present`);
  }
}

export function validateSnapshot(snapshot: unknown): SnapshotValidationResult {
  const errors: string[] = [];

  if (!isRecord(snapshot)) {
    return { ok: false, errors: ['snapshot must be an object'] };
  }

  const envelope = snapshot.envelope;
  const payload = snapshot.payload;

  // Envelope checks
  if (!isRecord(envelope)) {
    errors.push('missing envelope');
  } else {
    if (envelope.templateKey !== TEMPLATE_KEY) errors.push(`templateKey must be ${TEMPLATE_KEY}`);
    if (envelope.runtimeKey !== RUNTIME_KEY) errors.push(`runtimeKey must be ${RUNTIME_KEY}`);
    if (typeof envelope.bridgeVersion !== 'string') errors.push('bridgeVersion must be a string');
    if (typeof envelope.createdAt !== 'string') errors.push('createdAt must be a string');
    if (typeof envelope.updatedAt !== 'string') errors.push('updatedAt must be a string');
    if (typeof envelope.snapshotSchemaVersion !== 'number') {
      errors.push('snapshotSchemaVersion must be a number');
    } else if (envelope.snapshotSchemaVersion > SNAPSHOT_SCHEMA_VERSION) {
      errors.push(`snapshotSchemaVersion ${envelope.snapshotSchemaVersion} exceeds current ${SNAPSHOT_SCHEMA_VERSION}`);
    }
  }

  // Payload checks
  if (!isRecord(payload)) {
    errors.push('missing payload');
  } else {
    if (!isModuleId(payload.activeModule)) errors.push('payload.activeModule is invalid');
    validateModulePayload('refraction', payload.refraction, errors);
    validateModulePayload('lens', payload.lens, errors);
    validateModulePayload('doubleslit', payload.doubleslit, errors);
    validateModulePayload('diffraction', payload.diffraction, errors);
    validateModulePayload('thinfilm', payload.thinfilm, errors);
    if (payload.ui !== undefined && !isRecord(payload.ui)) {
      errors.push('payload.ui must be an object when present');
    }
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// loadSnapshot
// ---------------------------------------------------------------------------

export function loadSnapshot(snapshot: unknown): SnapshotValidationResult {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) return validation;

  const doc = cloneSerializable(snapshot as VisualP03SnapshotDocument);
  currentSnapshotCreatedAt = doc.envelope.createdAt;

  const { payload } = doc;

  // Module router
  if (isModuleId(payload.activeModule)) {
    useModuleStore.getState().setActiveModule(payload.activeModule);
  }

  // Per-module stores
  if (payload.refraction) {
    useSimulationStore.getState().loadSnapshot({ settings: payload.refraction });
  }
  if (payload.lens) {
    useLensStore.getState().loadSnapshot({ settings: payload.lens });
  }
  if (payload.doubleslit) {
    useDoubleSlitStore.getState().loadSnapshot({ settings: payload.doubleslit });
  }
  if (payload.diffraction) {
    useDiffractionStore.getState().loadSnapshot({ settings: payload.diffraction });
  }
  if (payload.thinfilm) {
    useThinFilmStore.getState().loadSnapshot({ settings: payload.thinfilm });
  }
  if (payload.ui) {
    useUIStore.getState().loadSnapshot(payload.ui);
  }

  return validation;
}

// ---------------------------------------------------------------------------
// Operations (P03-specific)
// ---------------------------------------------------------------------------

type Operation = Record<string, unknown> & { type?: string; payload?: unknown };

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function applySingleOperation(
  op: Operation,
  warnings: string[],
  errors: string[],
): boolean {
  const body = { ...((isRecord(op.payload) ? op.payload : {}) as Record<string, unknown>), ...op };
  delete body.payload;
  const type = asString(op.type);

  if (!type) {
    errors.push('operation.type is required');
    return false;
  }

  // --- setActiveModule ---
  if (type === 'setActiveModule') {
    const moduleId = asString(body.moduleId ?? body.activeModule ?? body.id);
    if (!isModuleId(moduleId)) {
      errors.push(`unknown module: ${moduleId ?? ''}`);
      return false;
    }
    useModuleStore.getState().setActiveModule(moduleId);
    return true;
  }

  // --- loadOpticsExperiment ---
  if (type === 'loadOpticsExperiment') {
    const experimentId = asString(body.experimentId ?? body.presetId ?? body.id);
    if (!experimentId) {
      errors.push('loadOpticsExperiment requires experimentId');
      return false;
    }
    // Determine which module the experiment belongs to and load it
    const moduleId = experimentIdToModule(experimentId);
    if (!moduleId) {
      errors.push(`unknown experiment: ${experimentId}`);
      return false;
    }
    const store = getStoreForModule(moduleId);
    if (store) {
      store.selectExperiment(experimentId);
      if (isRecord(body.params)) {
        store.updateSettings(body.params as Record<string, unknown>);
      }
    }
    useModuleStore.getState().setActiveModule(moduleId);
    return true;
  }

  // --- setModuleParams ---
  if (type === 'setModuleParams') {
    const targetId = asString(body.moduleId ?? body.activeModule);
    const targetModule = isModuleId(targetId) ? targetId : useModuleStore.getState().activeModule;
    const params = isRecord(body.params) ? body.params : body;
    const cleanParams = { ...params };
    delete cleanParams.type;
    delete cleanParams.moduleId;
    delete cleanParams.activeModule;
    delete cleanParams.payload;

    if (Object.keys(cleanParams).length === 0) {
      warnings.push('no params to apply');
      return false;
    }

    const store = getStoreForModule(targetModule);
    if (store) {
      store.updateSettings(cleanParams as Record<string, unknown>);
    }
    return true;
  }

  // --- setDisplayOptions ---
  if (type === 'setDisplayOptions') {
    const targetId = asString(body.moduleId ?? body.activeModule);
    const targetModule = isModuleId(targetId) ? targetId : useModuleStore.getState().activeModule;
    const display: Record<string, boolean> = {};
    for (const key of ['showAngles', 'showNormals', 'showFormula', 'showColor', 'showIntensity', 'showRays', 'showScreen', 'whiteLight', 'compareMode']) {
      const value = asBoolean(body[key]);
      if (value !== undefined) display[key] = value;
    }
    if (Object.keys(display).length === 0) {
      warnings.push('no display options to apply');
      return false;
    }
    const store = getStoreForModule(targetModule);
    if (store) {
      store.updateSettings(display as Record<string, unknown>);
    }
    return true;
  }

  errors.push(`unsupported operation: ${type}`);
  return false;
}

/**
 * Map experiment ID prefix to module.
 * opt-001..006 = refraction, opt-011..012 = lens, opt-021 = doubleslit,
 * opt-031..032 = diffraction, opt-041..043 = thinfilm
 */
function experimentIdToModule(experimentId: string): ModuleId | undefined {
  const num = parseInt(experimentId.replace(/^opt-/, ''), 10);
  if (Number.isNaN(num)) return undefined;
  if (num >= 1 && num <= 6) return 'refraction';
  if (num >= 11 && num <= 12) return 'lens';
  if (num === 21) return 'doubleslit';
  if (num >= 31 && num <= 32) return 'diffraction';
  if (num >= 41 && num <= 43) return 'thinfilm';
  return undefined;
}

interface ModuleStoreAccessor {
  selectExperiment: (id: string) => void;
  updateSettings: (partial: Record<string, unknown>) => void;
}

function getStoreForModule(moduleId: ModuleId): ModuleStoreAccessor | undefined {
  switch (moduleId) {
    case 'refraction': {
      const s = useSimulationStore.getState();
      return {
        selectExperiment: (id) => s.selectExperiment(id as Parameters<typeof s.selectExperiment>[0]),
        updateSettings: (p) => s.updateSettings(p as Partial<RefractionSettings>),
      };
    }
    case 'lens': {
      const s = useLensStore.getState();
      return {
        selectExperiment: (id) => s.selectExperiment(id as Parameters<typeof s.selectExperiment>[0]),
        updateSettings: (p) => s.updateSettings(p as Partial<LensSettings>),
      };
    }
    case 'doubleslit': {
      const s = useDoubleSlitStore.getState();
      return {
        selectExperiment: (id) => s.selectExperiment(id as Parameters<typeof s.selectExperiment>[0]),
        updateSettings: (p) => s.updateSettings(p as Partial<DoubleSlitSettings>),
      };
    }
    case 'diffraction': {
      const s = useDiffractionStore.getState();
      return {
        selectExperiment: (id) => s.selectExperiment(id as Parameters<typeof s.selectExperiment>[0]),
        updateSettings: (p) => s.updateSettings(p as Partial<DiffractionSettings>),
      };
    }
    case 'thinfilm': {
      const s = useThinFilmStore.getState();
      return {
        selectExperiment: (id) => s.selectExperiment(id as Parameters<typeof s.selectExperiment>[0]),
        updateSettings: (p) => s.updateSettings(p as Partial<ThinFilmSettings>),
      };
    }
    default:
      return undefined;
  }
}

function applyOperations(operationsInput: unknown): OperationResult {
  const operationList = Array.isArray(operationsInput)
    ? operationsInput
    : isRecord(operationsInput) && Array.isArray((operationsInput as Record<string, unknown>).operations)
      ? (operationsInput as Record<string, unknown>).operations as unknown[]
      : [];

  if (!operationList.length) {
    return { ok: false, applied: 0, errors: ['operations must be a non-empty array'], warnings: [] };
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  let applied = 0;

  for (const operation of operationList) {
    if (!isRecord(operation)) {
      errors.push('operation must be an object');
      continue;
    }
    if (applySingleOperation(operation as Operation, warnings, errors)) {
      applied += 1;
    }
  }

  return { ok: errors.length === 0, applied, errors, warnings };
}

// ---------------------------------------------------------------------------
// Bridge creation & registration
// ---------------------------------------------------------------------------

function createBridge(): TemplateBridge {
  return {
    getDefaultSnapshot: getDefaultSnapshot,
    getSnapshot: getSnapshot,
    loadSnapshot: loadSnapshot,
    validateSnapshot: validateSnapshot,
    applyOperations: applyOperations,
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

    let response: Record<string, unknown> | undefined;

    try {
      // --- edumind.templateBridge namespace ---
      if (message.namespace === 'edumind.templateBridge') {
        const requestId = typeof message.requestId === 'string' ? message.requestId : undefined;

        switch (message.type) {
          case 'getDefaultSnapshot':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId,
              success: true,
              payload: bridge.getDefaultSnapshot(),
            };
            break;

          case 'getSnapshot':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId,
              success: true,
              payload: bridge.getSnapshot(),
            };
            break;

          case 'loadSnapshot': {
            const result = bridge.loadSnapshot(message.payload);
            response = result.ok
              ? { namespace: 'edumind.templateBridge', type: 'response', requestId, success: true, payload: result }
              : { namespace: 'edumind.templateBridge', type: 'response', requestId, success: false, error: result.errors.join('; ') };
            break;
          }

          case 'validateSnapshot':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId,
              success: true,
              payload: bridge.validateSnapshot(message.payload),
            };
            break;

          case 'applyOperations':
            response = {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId,
              success: true,
              payload: bridge.applyOperations(message.payload),
            };
            break;

          default:
            return;
        }
      }

      // --- edumind:* prefix format ---
      if (!response && typeof message.type === 'string' && (message.type as string).startsWith('edumind:')) {
        const requestId = typeof message.requestId === 'string' ? message.requestId : undefined;

        if (message.type === 'edumind:getDefaultSnapshot') {
          response = { type: 'edumind:bridgeResponse', requestId, ok: true, result: bridge.getDefaultSnapshot() };
        }
        if (message.type === 'edumind:getSnapshot') {
          response = { type: 'edumind:bridgeResponse', requestId, ok: true, result: bridge.getSnapshot() };
        }
        if (message.type === 'edumind:loadSnapshot') {
          const result = bridge.loadSnapshot(message.snapshot ?? message.payload);
          response = { type: 'edumind:bridgeResponse', requestId, ok: result.ok, result, errors: result.errors };
        }
        if (message.type === 'edumind:validateSnapshot') {
          const result = bridge.validateSnapshot(message.snapshot ?? message.payload);
          response = { type: 'edumind:bridgeResponse', requestId, ok: result.ok, result, errors: result.errors };
        }
        if (message.type === 'edumind:applyOperations') {
          const result = bridge.applyOperations(message.operations ?? message.payload);
          response = { type: 'edumind:bridgeResponse', requestId, ok: result.ok, result, errors: result.errors };
        }
      }
    } catch (error) {
      const requestId = typeof message.requestId === 'string' ? message.requestId : undefined;
      const errMsg = error instanceof Error ? error.message : String(error);

      if (message.namespace === 'edumind.templateBridge') {
        response = { namespace: 'edumind.templateBridge', type: 'response', requestId, success: false, error: errMsg };
      } else if (typeof message.type === 'string' && (message.type as string).startsWith('edumind:')) {
        response = { type: 'edumind:bridgeResponse', requestId, ok: false, errors: [errMsg] };
      }
    }

    if (response) {
      event.source?.postMessage(response, { targetOrigin: '*' });
    }
  };

  window.addEventListener('message', handleMessage);
  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__ = () => {
    window.removeEventListener('message', handleMessage);
    if (window.__EDUMIND_TEMPLATE_BRIDGE__) delete window.__EDUMIND_TEMPLATE_BRIDGE__;
    delete window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__;
  };
}
