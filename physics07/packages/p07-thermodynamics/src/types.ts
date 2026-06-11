import type { SimState, GraphTrace } from '@physics/core';
import type { CanvasManager, SyncedGraph } from '@physics/core';

export interface ThermoState extends SimState {
  [key: string]: number;
}

export type SceneName =
  | '气体分子微观模拟'
  | '三种气体实验'
  | '液柱密封模型'
  | '气缸/双活塞模型'
  | '布朗运动';

export type SnapshotPayload = {
  params: Record<string, number | string | boolean>;
  sim: {
    t: number;
    speed: number;
    seed: number;
    engineVersion: 'p07-thermo-v1';
    state?: ThermoState;
  };
  results: Record<string, never>;
};

export type TemplateSnapshot = {
  envelope: {
    templateKey: 'p07';
    runtimeKey: 'physics-p07-thermodynamics';
    bridgeVersion: '1.0.0';
    snapshotSchemaVersion: 1;
    createdAt: string;
    updatedAt: string;
  };
  payload: SnapshotPayload;
};

export type SnapshotValidationResult = {
  ok: boolean;
  errors: string[];
};

export type TemplateBridge = {
  getDefaultSnapshot: () => TemplateSnapshot;
  getSnapshot: () => TemplateSnapshot;
  loadSnapshot: (snapshot: unknown) => SnapshotValidationResult;
  validateSnapshot: (snapshot: unknown) => SnapshotValidationResult;
};

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: TemplateBridge;
  }
}

export interface RenderContext {
  cm: CanvasManager;
  graph: SyncedGraph;
  canvasWidth: number;
  canvasHeight: number;
}

export interface StateDisplayData {
  p?: number;
  V?: number;
  T?: number;
  pUnit?: string;
  VUnit?: string;
  pvOverT?: number;
  invariant?: { label: string; value: number | string; highlight?: boolean };
  customEntries?: { label: string; value: string; highlight?: boolean }[];
}

export interface CalcStep {
  text: string;
  highlight?: boolean;
}

export interface SceneModule {
  createInitialState(params: Record<string, number | string | boolean>, seed: number): ThermoState;
  createStepFn(params: Record<string, number | string | boolean>): (t: number, dt: number, state: ThermoState) => ThermoState;
  render(t: number, state: ThermoState, ctx: RenderContext, params: Record<string, number | string | boolean>): void;
  getGraphTraces?(params: Record<string, number | string | boolean>, state: ThermoState): GraphTrace[];
  getStateDisplay?(params: Record<string, number | string | boolean>, state: ThermoState): StateDisplayData;
  getCalcSteps?(params: Record<string, number | string | boolean>, state: ThermoState): CalcStep[];
  /** Called when switching AWAY from this scene. Lets a scene tear down /
   *  hide any auxiliary surfaces (e.g. a Three.js WebGL overlay). */
  onLeave?(): void;
  /** Called when the colour theme toggles. Lets a scene re-theme resources that
   *  are not re-read every frame (e.g. a Three.js scene's lights/grid/labels). */
  onThemeChange?(): void;
}

/* ===== Teaching / Config types ===== */

export interface ModelVariant {
  id: string;
  label: string;
  paramOverrides: Record<string, number | string | boolean>;
}

export interface ScenePreset {
  label: string;
  params: Record<string, number | string | boolean>;
}

export interface DisplayToggle {
  key: string;
  label: string;
  default: boolean;
}

export interface LiveEntry {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface TeachingContent {
  coreValues: { label: string; dynamicKey?: string; staticValue?: string }[];
  insight: string;
  formulas: string[];
  summary: string;
  bullets: string[];
}

export interface SceneConfig {
  name: SceneName;
  tabLabel: string;
  description: string;
  modelId: string;
  models: ModelVariant[];
  presets: ScenePreset[];
  displayToggles: DisplayToggle[];
  teaching: TeachingContent;
}

export const TEMPLATE_KEY = 'p07';
export const RUNTIME_KEY = 'physics-p07-thermodynamics';
export const BRIDGE_VERSION = '1.0.0';
export const SNAPSHOT_SCHEMA_VERSION = 1;
export const ENGINE_VERSION = 'p07-thermo-v1' as const;
