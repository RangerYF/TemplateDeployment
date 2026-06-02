import { appScope } from '@/app-config';
import type {
  Entity,
  ParamGroup,
  ParamValues,
  PhysicsResult,
  Relation,
  SceneDefinition,
  SimulationState,
  ViewportState,
} from '@/core/types';
import { simulator } from '@/core/engine/simulator';
import { applyP04AiOperations } from '@/domains/em/runtime/aiOperations';
import { applyP08AiOperations } from '@/domains/em/runtime/p08AiOperations';
import { applyP13AiOperations } from '@/domains/em/runtime/p13AiOperations';
import { useBuilderStore, useSimulationStore, type BuilderStoreSnapshot } from '@/store';
import { getPageSnapshots, loadPageSnapshots } from '@/snapshotPageRegistry';

const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 1;

type TemplateKey = 'p04' | 'p08' | 'p13' | 'physics-sandbox';

interface TemplateSnapshotEnvelope {
  templateKey: TemplateKey;
  runtimeKey: string;
  bridgeVersion: string;
  snapshotSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

interface SerializableSceneDefinition
  extends Omit<SceneDefinition, 'entities'> {
  entities: Entity[];
}

interface SerializableSimulationState
  extends Omit<SimulationState, 'scene'> {
  scene: SerializableSceneDefinition;
}

interface SimulationUiSnapshot {
  paramValues: ParamValues;
  selectedEntityId: string | null;
  viewportState: ViewportState;
  showFieldLines: boolean;
  showEquipotentialLines: boolean;
  showPotentialMap: boolean;
  showPotentialSurface3D: boolean;
  fieldLineDensity: ReturnType<typeof useSimulationStore.getState>['fieldLineDensity'];
  showTrajectory: boolean;
  potentialProbeA: ReturnType<typeof useSimulationStore.getState>['potentialProbeA'];
  potentialProbeB: ReturnType<typeof useSimulationStore.getState>['potentialProbeB'];
  activePotentialProbe: ReturnType<typeof useSimulationStore.getState>['activePotentialProbe'];
  solenoidTeaching: ReturnType<typeof useSimulationStore.getState>['solenoidTeaching'];
  loopTeaching: ReturnType<typeof useSimulationStore.getState>['loopTeaching'];
  electrostaticSurface3D: ReturnType<typeof useSimulationStore.getState>['electrostaticSurface3D'];
}

interface PhysicsTemplateSnapshotPayload {
  route: {
    hash: string;
  };
  simulation: {
    state: SerializableSimulationState;
    ui: SimulationUiSnapshot;
    currentResult: PhysicsResult | null;
  };
  builder: BuilderStoreSnapshot;
  pages: Record<string, unknown>;
}

interface PhysicsTemplateSnapshotDocument {
  envelope: TemplateSnapshotEnvelope;
  payload: PhysicsTemplateSnapshotPayload;
}

interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ApplyOperationsResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  applied: number;
  rolledBack?: boolean;
}

interface TemplateBridge {
  getDefaultSnapshot(): PhysicsTemplateSnapshotDocument;
  getSnapshot(): PhysicsTemplateSnapshotDocument;
  loadSnapshot(snapshot: unknown): void;
  validateSnapshot(snapshot: unknown): ValidationResult;
  applyOperations(input: unknown): ApplyOperationsResult;
}

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: TemplateBridge;
    __EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?: () => void;
  }
}

function cloneSerializable<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function getTemplateKey(): TemplateKey {
  if (appScope === 'p04-standalone' || appScope === 'electric-feedback') return 'p04';
  if (appScope === 'p08-standalone') return 'p08';
  if (appScope === 'p13-standalone') return 'p13';
  return 'physics-sandbox';
}

function getRuntimeKey(): string {
  return appScope === 'full' ? 'phys-template-p01' : `phys-template-${appScope}`;
}

function buildEnvelope(createdAt?: string): TemplateSnapshotEnvelope {
  const now = new Date().toISOString();
  return {
    templateKey: getTemplateKey(),
    runtimeKey: getRuntimeKey(),
    bridgeVersion: BRIDGE_VERSION,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

function serializeScene(scene: SceneDefinition): SerializableSceneDefinition {
  return {
    ...scene,
    entities: Array.from(scene.entities.values(), cloneSerializable),
    relations: cloneSerializable(scene.relations) as Relation[],
    paramGroups: cloneSerializable(scene.paramGroups) as ParamGroup[],
    paramValues: cloneSerializable(scene.paramValues),
  };
}

function hydrateScene(scene: SerializableSceneDefinition): SceneDefinition {
  return {
    ...cloneSerializable(scene),
    entities: new Map(scene.entities.map((entity) => [entity.id, cloneSerializable(entity)])),
    relations: cloneSerializable(scene.relations) as Relation[],
    paramGroups: cloneSerializable(scene.paramGroups) as ParamGroup[],
    paramValues: cloneSerializable(scene.paramValues),
  };
}

function serializeSimulationState(state: SimulationState): SerializableSimulationState {
  return {
    ...state,
    timeline: cloneSerializable(state.timeline),
    scene: serializeScene(state.scene),
    currentResult: null,
    resultHistory: [],
    status: state.status === 'running' ? 'paused' : state.status,
  };
}

function hydrateSimulationState(state: SerializableSimulationState): SimulationState {
  return {
    ...cloneSerializable(state),
    scene: hydrateScene(state.scene),
    currentResult: null,
    resultHistory: [],
    status: state.status === 'running' ? 'paused' : state.status,
  };
}

function getSimulationUiSnapshot(): SimulationUiSnapshot {
  const state = useSimulationStore.getState();
  return {
    paramValues: cloneSerializable(state.paramValues),
    selectedEntityId: state.selectedEntityId,
    viewportState: cloneSerializable(state.viewportState),
    showFieldLines: state.showFieldLines,
    showEquipotentialLines: state.showEquipotentialLines,
    showPotentialMap: state.showPotentialMap,
    showPotentialSurface3D: state.showPotentialSurface3D,
    fieldLineDensity: state.fieldLineDensity,
    showTrajectory: state.showTrajectory,
    potentialProbeA: cloneSerializable(state.potentialProbeA),
    potentialProbeB: cloneSerializable(state.potentialProbeB),
    activePotentialProbe: state.activePotentialProbe,
    solenoidTeaching: cloneSerializable(state.solenoidTeaching),
    loopTeaching: cloneSerializable(state.loopTeaching),
    electrostaticSurface3D: cloneSerializable(state.electrostaticSurface3D),
  };
}

function applySimulationUiSnapshot(ui: SimulationUiSnapshot): void {
  useSimulationStore.setState({
    paramValues: cloneSerializable(ui.paramValues),
    selectedEntityId: ui.selectedEntityId,
    viewportState: cloneSerializable(ui.viewportState),
    showFieldLines: ui.showFieldLines,
    showEquipotentialLines: ui.showEquipotentialLines,
    showPotentialMap: ui.showPotentialMap,
    showPotentialSurface3D: ui.showPotentialSurface3D,
    fieldLineDensity: ui.fieldLineDensity,
    showTrajectory: ui.showTrajectory,
    potentialProbeA: cloneSerializable(ui.potentialProbeA),
    potentialProbeB: cloneSerializable(ui.potentialProbeB),
    activePotentialProbe: ui.activePotentialProbe,
    solenoidTeaching: cloneSerializable(ui.solenoidTeaching),
    loopTeaching: cloneSerializable(ui.loopTeaching),
    electrostaticSurface3D: cloneSerializable(ui.electrostaticSurface3D),
  });
}

export function getPhysicsTemplateSnapshot(): PhysicsTemplateSnapshotDocument {
  const simState = simulator.getState();
  return {
    envelope: buildEnvelope(),
    payload: {
      route: {
        hash: window.location.hash,
      },
      simulation: {
        state: serializeSimulationState(simState),
        ui: getSimulationUiSnapshot(),
        currentResult: null,
      },
      builder: useBuilderStore.getState().getSnapshot(),
      pages: getPageSnapshots(),
    },
  };
}

export function getPhysicsTemplateDefaultSnapshot(): PhysicsTemplateSnapshotDocument {
  return getPhysicsTemplateSnapshot();
}

export function validatePhysicsTemplateSnapshot(snapshot: unknown): ValidationResult {
  const errors: string[] = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { ok: false, errors: ['snapshot 必须是对象'] };
  }

  const value = snapshot as Record<string, unknown>;
  const envelope = value.envelope as Record<string, unknown> | undefined;
  const payload = value.payload as Record<string, unknown> | undefined;

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    errors.push('缺少 envelope');
  } else {
    if (envelope.templateKey !== getTemplateKey()) {
      errors.push(`templateKey 必须为 ${getTemplateKey()}`);
    }
    if (typeof envelope.snapshotSchemaVersion !== 'number') {
      errors.push('snapshotSchemaVersion 必须是数字');
    } else if (envelope.snapshotSchemaVersion > SNAPSHOT_SCHEMA_VERSION) {
      errors.push(`snapshotSchemaVersion ${envelope.snapshotSchemaVersion} 高于当前支持的 ${SNAPSHOT_SCHEMA_VERSION}`);
    }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('缺少 payload');
  } else {
    if (!payload.route || typeof payload.route !== 'object') {
      errors.push('payload.route 缺失或非法');
    }
    if (!payload.simulation || typeof payload.simulation !== 'object') {
      errors.push('payload.simulation 缺失或非法');
    }
    if (!payload.builder || typeof payload.builder !== 'object') {
      errors.push('payload.builder 缺失或非法');
    }
    if (payload.pages !== undefined && (typeof payload.pages !== 'object' || Array.isArray(payload.pages))) {
      errors.push('payload.pages 必须是对象');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function loadPhysicsTemplateSnapshot(snapshot: unknown): void {
  const validation = validatePhysicsTemplateSnapshot(snapshot);
  if (!validation.ok) {
    throw new Error(`Invalid physics template snapshot: ${validation.errors.join('; ')}`);
  }

  const doc = cloneSerializable(snapshot as PhysicsTemplateSnapshotDocument);
  const simState = hydrateSimulationState(doc.payload.simulation.state);

  simulator.loadScene({
    scene: simState.scene,
    solveMode: simState.solveMode,
    duration: simState.timeline.duration,
    defaultViewport: doc.payload.simulation.ui.viewportState.primary,
    supportedViewports: [doc.payload.simulation.ui.viewportState.primary],
  });
  simulator.seekTo(simState.timeline.currentTime);
  if (simState.status === 'paused') {
    simulator.pause();
  }

  useSimulationStore.getState().initFromPreset({
    simulationState: simulator.getState(),
    paramValues: doc.payload.simulation.ui.paramValues,
    viewportState: doc.payload.simulation.ui.viewportState,
  });
  applySimulationUiSnapshot(doc.payload.simulation.ui);
  useBuilderStore.getState().loadSnapshot(doc.payload.builder);

  if (doc.payload.route.hash && window.location.hash !== doc.payload.route.hash) {
    window.location.hash = doc.payload.route.hash;
    window.setTimeout(() => loadPageSnapshots(doc.payload.pages), 0);
  } else {
    loadPageSnapshots(doc.payload.pages);
  }
}

export function applyPhysicsTemplateOperations(input: unknown): ApplyOperationsResult {
  const templateKey = getTemplateKey();
  switch (templateKey) {
    case 'p04':
      return applyP04AiOperations(input);
    case 'p08':
      return applyP08AiOperations(input);
    case 'p13':
      return applyP13AiOperations(input);
    default:
      return {
        ok: false,
        errors: [`templateKey ${templateKey} 暂未接入 applyOperations`],
        warnings: [],
        applied: 0,
      };
  }
}

function createBridge(): TemplateBridge {
  return {
    getDefaultSnapshot: getPhysicsTemplateDefaultSnapshot,
    getSnapshot: getPhysicsTemplateSnapshot,
    loadSnapshot: loadPhysicsTemplateSnapshot,
    validateSnapshot: validatePhysicsTemplateSnapshot,
    applyOperations: applyPhysicsTemplateOperations,
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
