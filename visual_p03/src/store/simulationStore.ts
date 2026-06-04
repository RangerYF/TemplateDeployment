import { create } from 'zustand';
import type { RefractionSettings, RefractionExperimentId } from '@/data/refractionData';
import { BASE_SHAPE_PRESETS, SHAPES, buildDefaultSettings } from '@/data/refractionData';

interface SimulationSnapshot {
  currentExperimentId: RefractionExperimentId;
  settings: RefractionSettings;
}

interface SimulationState extends SimulationSnapshot {
  selectExperiment: (id: RefractionExperimentId) => void;
  updateSettings: (partial: Partial<RefractionSettings>) => void;
  resetSettings: () => void;
  getSnapshot: () => SimulationSnapshot;
  loadSnapshot: (snapshot: Partial<SimulationSnapshot>) => void;
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  currentExperimentId: 'opt-001' as RefractionExperimentId,
  settings: buildDefaultSettings(),

  selectExperiment: (id) => set((state) => {
    const shape = SHAPES.find((sh) => sh.experimentId === id);
    if (!shape) return {};
    const preset = BASE_SHAPE_PRESETS[shape.id] ?? {};
    return {
      currentExperimentId: id,
      settings: { ...state.settings, ...preset },
    };
  }),

  updateSettings: (partial) => set((state) => ({
    settings: { ...state.settings, ...partial },
  })),

  resetSettings: () => set({ settings: buildDefaultSettings() }),

  getSnapshot: () => {
    const state = get();
    return {
      currentExperimentId: state.currentExperimentId,
      settings: cloneSnapshot(state.settings),
    };
  },

  loadSnapshot: (snapshot) => {
    const experimentId = snapshot.currentExperimentId ?? 'opt-001';
    const isKnown = SHAPES.some((sh) => sh.experimentId === experimentId);
    set({
      currentExperimentId: isKnown ? experimentId : ('opt-001' as RefractionExperimentId),
      settings: snapshot.settings
        ? { ...buildDefaultSettings(), ...snapshot.settings }
        : buildDefaultSettings(),
    });
  },
}));

export function useCurrentExperiment() {
  return useSimulationStore((s) => SHAPES.find((sh) => sh.experimentId === s.currentExperimentId) ?? SHAPES[0]);
}
