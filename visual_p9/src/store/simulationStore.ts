import { create } from 'zustand';
import { CELESTIAL_MODELS, CONSTANTS, getDefaultParams } from '@/data/celestialData';
import type { HohmannPhase } from '@/engine/orbitalMechanics';

export interface SimulationSnapshot {
  currentModelId: string;
  paramsByModel: Record<string, Record<string, number>>;
  isPlaying: boolean;
  speedMultiplier: number;
  showVectors: boolean;
  showAreaSectors: boolean;
  hohmannPhase: HohmannPhase;
  hohmannIgnitionAngle: number;
}

interface SimulationState extends SimulationSnapshot {
  elapsedSeconds: number;
  selectModel: (modelId: string) => void;
  setParam: (key: string, value: number) => void;
  resetActiveParams: () => void;
  setPlaying: (playing: boolean) => void;
  setSpeedMultiplier: (value: number) => void;
  tick: (deltaSeconds: number) => void;
  resetTime: () => void;
  fireHohmann: () => void;
  setShowVectors: (value: boolean) => void;
  setShowAreaSectors: (value: boolean) => void;
  getSnapshot: () => SimulationSnapshot;
  loadSnapshot: (snapshot: SimulationSnapshot) => void;
}

const DEFAULT_PARAMS_BY_MODEL = Object.fromEntries(
  CELESTIAL_MODELS.map((model) => [model.id, getDefaultParams(model)]),
);
const DEFAULT_MODEL_ID = 'CEL-001';
const TAU = Math.PI * 2;
const HOHMANN_VISUAL_ANGULAR_SPEED = 0.18;
const CHASE_RADIUS_GAP_M = 1e5;
const HOHMANN_PHASES: HohmannPhase[] = ['low', 'transfer', 'high', 'transferDown'];

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeAngle(rad: number): number {
  const value = rad % TAU;
  return value < 0 ? value + TAU : value;
}

function getActiveParams(modelId: string, paramsByModel: Record<string, Record<string, number>>) {
  return paramsByModel[modelId] ?? {};
}

function applyParamConstraints(modelId: string, params: Record<string, number>, key: string, value: number) {
  if (modelId !== 'CEL-031') return { ...params, [key]: value };
  if (key === 'innerRadiusM') {
    return { ...params, innerRadiusM: Math.min(value, params.outerRadiusM - CHASE_RADIUS_GAP_M) };
  }
  if (key === 'outerRadiusM') {
    return { ...params, outerRadiusM: Math.max(value, params.innerRadiusM + CHASE_RADIUS_GAP_M) };
  }
  return { ...params, [key]: value };
}

function isKnownModelId(modelId: unknown): modelId is string {
  return typeof modelId === 'string' && CELESTIAL_MODELS.some((model) => model.id === modelId);
}

function sanitizeParamsByModel(paramsByModel: unknown): Record<string, Record<string, number>> {
  const input = paramsByModel && typeof paramsByModel === 'object' && !Array.isArray(paramsByModel)
    ? paramsByModel as Record<string, unknown>
    : {};

  return Object.fromEntries(
    CELESTIAL_MODELS.map((model) => {
      let nextParams = { ...DEFAULT_PARAMS_BY_MODEL[model.id] };
      const source = input[model.id];
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        for (const field of model.params) {
          const value = (source as Record<string, unknown>)[field.key];
          if (typeof value === 'number' && Number.isFinite(value)) {
            const clamped = Math.min(field.max, Math.max(field.min, value));
            nextParams = applyParamConstraints(model.id, nextParams, field.key, clamped);
          }
        }
      }
      return [model.id, nextParams];
    }),
  );
}

export function getDefaultSimulationSnapshot(): SimulationSnapshot {
  return {
    currentModelId: DEFAULT_MODEL_ID,
    paramsByModel: cloneSnapshot(DEFAULT_PARAMS_BY_MODEL),
    isPlaying: true,
    speedMultiplier: 1,
    showVectors: true,
    showAreaSectors: true,
    hohmannPhase: 'low',
    hohmannIgnitionAngle: 0,
  };
}

function getTimeScale(modelId: string, params: Record<string, number>): number {
  if (modelId === 'CEL-001') {
    const mu = CONSTANTS.gravitationalConstant * params.centralMassKg;
    const period = Math.PI * 2 * Math.sqrt(params.orbitRadiusM ** 3 / mu);
    return period / 18;
  }
  if (modelId === 'CEL-002') {
    const aM = params.semiMajorAxisKm * 1000;
    const mu = CONSTANTS.gravitationalConstant * params.centralMassKg;
    const period = Math.PI * 2 * Math.sqrt(aM ** 3 / mu);
    return period / 20;
  }
  if (modelId === 'CEL-031') {
    const mu = CONSTANTS.gravitationalConstant * params.centralMassKg;
    const omega1 = Math.sqrt(mu / params.innerRadiusM ** 3);
    const omega2 = Math.sqrt(mu / params.outerRadiusM ** 3);
    const delta = (params.initialAngleDeg * Math.PI) / 180;
    return Math.max(60, delta / Math.max(omega1 - omega2, 1e-12) / 10);
  }
  return 1;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  ...getDefaultSimulationSnapshot(),
  elapsedSeconds: 0,

  selectModel: (modelId) => set({ currentModelId: modelId, elapsedSeconds: 0 }),

  setParam: (key, value) => set((state) => ({
    paramsByModel: {
      ...state.paramsByModel,
      [state.currentModelId]: applyParamConstraints(
        state.currentModelId,
        state.paramsByModel[state.currentModelId],
        key,
        value,
      ),
    },
    elapsedSeconds: 0,
  })),

  resetActiveParams: () => set((state) => {
    const model = CELESTIAL_MODELS.find((item) => item.id === state.currentModelId);
    if (!model) return {};
    return {
      paramsByModel: {
        ...state.paramsByModel,
        [state.currentModelId]: getDefaultParams(model),
      },
      elapsedSeconds: 0,
      hohmannPhase: state.currentModelId === 'CEL-011' ? 'low' : state.hohmannPhase,
      hohmannIgnitionAngle: state.currentModelId === 'CEL-011' ? 0 : state.hohmannIgnitionAngle,
    };
  }),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setSpeedMultiplier: (value) => set({ speedMultiplier: value }),
  resetTime: () => set({ elapsedSeconds: 0 }),

  tick: (deltaSeconds) => set((state) => {
    if (!state.isPlaying) return {};
    const params = getActiveParams(state.currentModelId, state.paramsByModel);
    const timeScale = getTimeScale(state.currentModelId, params);
    return {
      elapsedSeconds: state.elapsedSeconds + deltaSeconds * state.speedMultiplier * timeScale,
    };
  }),

  fireHohmann: () => set((state) => {
    if (state.currentModelId !== 'CEL-011') return {};
    const nextPhase: HohmannPhase = state.hohmannPhase === 'low'
      ? 'transfer'
      : state.hohmannPhase === 'transfer'
        ? 'high'
        : state.hohmannPhase === 'high'
          ? 'transferDown'
          : 'low';
    const nextIgnitionAngle = state.hohmannPhase === 'low'
      ? normalizeAngle(state.hohmannIgnitionAngle + state.elapsedSeconds * HOHMANN_VISUAL_ANGULAR_SPEED)
      : state.hohmannPhase === 'high'
        ? normalizeAngle(state.hohmannIgnitionAngle + Math.PI + state.elapsedSeconds * HOHMANN_VISUAL_ANGULAR_SPEED)
        : state.hohmannPhase === 'transferDown'
          ? normalizeAngle(state.hohmannIgnitionAngle + Math.PI)
          : state.hohmannIgnitionAngle;
    return {
      hohmannPhase: nextPhase,
      hohmannIgnitionAngle: nextIgnitionAngle,
      elapsedSeconds: 0,
      isPlaying: true,
    };
  }),

  setShowVectors: (value) => set({ showVectors: value }),
  setShowAreaSectors: (value) => set({ showAreaSectors: value }),

  getSnapshot: () => {
    const state = get();
    return {
      currentModelId: state.currentModelId,
      paramsByModel: cloneSnapshot(state.paramsByModel),
      isPlaying: state.isPlaying,
      speedMultiplier: state.speedMultiplier,
      showVectors: state.showVectors,
      showAreaSectors: state.showAreaSectors,
      hohmannPhase: state.hohmannPhase,
      hohmannIgnitionAngle: state.hohmannIgnitionAngle,
    };
  },

  loadSnapshot: (snapshot) => {
    const paramsByModel = sanitizeParamsByModel(snapshot.paramsByModel);
    const modelId = isKnownModelId(snapshot.currentModelId) ? snapshot.currentModelId : DEFAULT_MODEL_ID;
    set({
      currentModelId: modelId,
      paramsByModel,
      isPlaying: typeof snapshot.isPlaying === 'boolean' ? snapshot.isPlaying : true,
      speedMultiplier: typeof snapshot.speedMultiplier === 'number' && Number.isFinite(snapshot.speedMultiplier)
        ? Math.min(4, Math.max(0.2, snapshot.speedMultiplier))
        : 1,
      showVectors: typeof snapshot.showVectors === 'boolean' ? snapshot.showVectors : true,
      showAreaSectors: typeof snapshot.showAreaSectors === 'boolean' ? snapshot.showAreaSectors : true,
      hohmannPhase: HOHMANN_PHASES.includes(snapshot.hohmannPhase) ? snapshot.hohmannPhase : 'low',
      hohmannIgnitionAngle: typeof snapshot.hohmannIgnitionAngle === 'number' && Number.isFinite(snapshot.hohmannIgnitionAngle)
        ? normalizeAngle(snapshot.hohmannIgnitionAngle)
        : 0,
      elapsedSeconds: 0,
    });
  },
}));

export function useActiveModel() {
  const modelId = useSimulationStore((state) => state.currentModelId);
  return CELESTIAL_MODELS.find((model) => model.id === modelId) ?? CELESTIAL_MODELS[0];
}

export function useActiveParams() {
  const modelId = useSimulationStore((state) => state.currentModelId);
  return useSimulationStore((state) => getActiveParams(modelId, state.paramsByModel));
}
