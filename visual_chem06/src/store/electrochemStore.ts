import { create } from 'zustand';
import { DEFAULT_MODEL_ID, ELECTROCHEM_MODELS } from '@/data/electrochemModels';
import type { ElectrochemModel, ModelScenario, ModelFamily } from '@/types/electrochem';

export type FamilyFilter = 'all' | ModelFamily;
export type SpeedOption = 0.5 | 1 | 2;

export interface ElectrochemStoreSnapshot {
  selectedModelId: string;
  selectedScenarioId: string;
  searchQuery: string;
  familyFilter: FamilyFilter;
  playing: boolean;
  speed: SpeedOption;
  progress: number;
  showIonLabels: boolean;
  ionLabelFontSize: number;
}

interface ElectrochemState {
  models: ElectrochemModel[];
  selectedModelId: string;
  selectedScenarioId: string;
  searchQuery: string;
  familyFilter: FamilyFilter;
  playing: boolean;
  speed: SpeedOption;
  progress: number;
  showIonLabels: boolean;
  ionLabelFontSize: number;
  selectModel: (id: string) => void;
  setScenario: (id: string) => void;
  setSearchQuery: (value: string) => void;
  setFamilyFilter: (value: FamilyFilter) => void;
  togglePlaying: () => void;
  pause: () => void;
  reset: () => void;
  setProgress: (value: number) => void;
  stepForward: () => void;
  setSpeed: (value: SpeedOption) => void;
  setShowIonLabels: (value: boolean) => void;
  setIonLabelFontSize: (value: number) => void;
  tick: (deltaSeconds: number) => void;
  getSnapshot: () => ElectrochemStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<ElectrochemStoreSnapshot>) => void;
}

function clampProgress(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampFontSize(value: number) {
  if (value < 10) return 10;
  if (value > 18) return 18;
  return value;
}

function getModelById(id: string) {
  return ELECTROCHEM_MODELS.find((model) => model.id === id) ?? ELECTROCHEM_MODELS[0];
}

function getScenario(model: ElectrochemModel, scenarioId: string): ModelScenario {
  return model.scenarios.find((scenario) => scenario.id === scenarioId) ?? model.scenarios[0];
}

function getInitialScenarioId(modelId: string) {
  return getModelById(modelId)?.scenarios[0]?.id ?? 'standard';
}

function normalizeSpeed(value: unknown): SpeedOption {
  return value === 0.5 || value === 1 || value === 2 ? value : 1;
}

function normalizeFamilyFilter(value: unknown): FamilyFilter {
  return value === 'galvanic' || value === 'electrolytic' || value === 'all' ? value : 'all';
}

export const useElectrochemStore = create<ElectrochemState>((set, get) => ({
  models: ELECTROCHEM_MODELS,
  selectedModelId: DEFAULT_MODEL_ID,
  selectedScenarioId: getInitialScenarioId(DEFAULT_MODEL_ID),
  searchQuery: '',
  familyFilter: 'all',
  playing: false,
  speed: 1,
  progress: 0,
  showIonLabels: false,
  ionLabelFontSize: 12,

  selectModel: (id) => {
    const model = getModelById(id);
    set({
      selectedModelId: model.id,
      selectedScenarioId: model.scenarios[0]?.id ?? 'standard',
      playing: false,
      progress: 0,
    });
  },

  setScenario: (id) => set({ selectedScenarioId: id, playing: false, progress: 0 }),
  setSearchQuery: (value) => set({ searchQuery: value }),
  setFamilyFilter: (value) => set({ familyFilter: value }),
  togglePlaying: () => set((state) => ({ playing: !state.playing })),
  pause: () => set({ playing: false }),
  reset: () => set({ playing: false, progress: 0 }),
  setProgress: (value) => set({ progress: clampProgress(value) }),
  setSpeed: (value) => set({ speed: value }),
  setShowIonLabels: (value) => set({ showIonLabels: value }),
  setIonLabelFontSize: (value) => set({ ionLabelFontSize: clampFontSize(value) }),

  stepForward: () => {
    const state = get();
    const model = getModelById(state.selectedModelId);
    const scenario = getScenario(model, state.selectedScenarioId);
    const next = scenario.keyframes.find((keyframe) => keyframe.at > state.progress + 0.001);
    set({ playing: false, progress: next ? next.at : 1 });
  },

  tick: (deltaSeconds) => {
    const state = get();
    if (!state.playing) return;

    const model = getModelById(state.selectedModelId);
    const scenario = getScenario(model, state.selectedScenarioId);
    const duration = Math.max(scenario.duration, 1);
    const nextProgress = state.progress + (deltaSeconds * state.speed) / duration;
    set({ progress: nextProgress >= 1 ? nextProgress - 1 : nextProgress });
  },

  getSnapshot: (): ElectrochemStoreSnapshot => {
    const state = get();
    return {
      selectedModelId: state.selectedModelId,
      selectedScenarioId: state.selectedScenarioId,
      searchQuery: state.searchQuery,
      familyFilter: state.familyFilter,
      playing: state.playing,
      speed: state.speed,
      progress: state.progress,
      showIonLabels: state.showIonLabels,
      ionLabelFontSize: state.ionLabelFontSize,
    };
  },

  loadSnapshot: (snapshot) => {
    const nextModel = getModelById(snapshot?.selectedModelId ?? DEFAULT_MODEL_ID);
    const nextScenario = getScenario(nextModel, snapshot?.selectedScenarioId ?? nextModel.scenarios[0]?.id ?? 'standard');
    set({
      selectedModelId: nextModel.id,
      selectedScenarioId: nextScenario.id,
      searchQuery: typeof snapshot?.searchQuery === 'string' ? snapshot.searchQuery : '',
      familyFilter: normalizeFamilyFilter(snapshot?.familyFilter),
      playing: typeof snapshot?.playing === 'boolean' ? snapshot.playing : false,
      speed: normalizeSpeed(snapshot?.speed),
      progress: clampProgress(typeof snapshot?.progress === 'number' ? snapshot.progress : 0),
      showIonLabels: typeof snapshot?.showIonLabels === 'boolean' ? snapshot.showIonLabels : false,
      ionLabelFontSize: clampFontSize(typeof snapshot?.ionLabelFontSize === 'number' ? snapshot.ionLabelFontSize : 12),
    });
  },
}));

export function getCurrentModel(state: Pick<ElectrochemState, 'selectedModelId'>) {
  return getModelById(state.selectedModelId);
}

export function getCurrentScenario(state: Pick<ElectrochemState, 'selectedModelId' | 'selectedScenarioId'>) {
  const model = getModelById(state.selectedModelId);
  return getScenario(model, state.selectedScenarioId);
}

export function getFilteredModels(models: ElectrochemModel[], familyFilter: FamilyFilter, searchQuery: string) {
  const trimmed = searchQuery.trim().toLowerCase();
  return models.filter((model) => {
    const familyMatch = familyFilter === 'all' || model.family === familyFilter;
    if (!familyMatch) return false;
    if (!trimmed) return true;
    return [model.title, model.subtype, model.level, ...model.tags].some((value) => value.toLowerCase().includes(trimmed));
  });
}
