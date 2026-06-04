/**
 * diffractionStore.ts
 * Zustand store for the diffraction module.
 * Follows the same pattern as lensStore.ts.
 */

import { create } from 'zustand';
import type { DiffractionSettings, DiffractionExperimentId } from '@/data/diffractionData';
import { buildDefaultDiffractionSettings, DIFFRACTION_EXPERIMENTS } from '@/data/diffractionData';

interface DiffractionSnapshot {
  currentExperimentId: DiffractionExperimentId;
  settings: DiffractionSettings;
}

interface DiffractionState extends DiffractionSnapshot {
  selectExperiment: (id: DiffractionExperimentId) => void;
  updateSettings: (partial: Partial<DiffractionSettings>) => void;
  resetSettings: () => void;
  getSnapshot: () => DiffractionSnapshot;
  loadSnapshot: (snapshot: Partial<DiffractionSnapshot>) => void;
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const useDiffractionStore = create<DiffractionState>((set, get) => ({
  currentExperimentId: 'opt-031' as DiffractionExperimentId,
  settings: buildDefaultDiffractionSettings(),

  selectExperiment: (id) =>
    set((state) => {
      const experiment = DIFFRACTION_EXPERIMENTS.find((e) => e.id === id);
      if (!experiment) return {};
      const defaults = experiment.defaults as Partial<DiffractionSettings>;
      return {
        currentExperimentId: id,
        settings: { ...state.settings, ...defaults },
      };
    }),

  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  resetSettings: () =>
    set({
      currentExperimentId: 'opt-031',
      settings: buildDefaultDiffractionSettings(),
    }),

  getSnapshot: () => {
    const state = get();
    return {
      currentExperimentId: state.currentExperimentId,
      settings: cloneSnapshot(state.settings),
    };
  },

  loadSnapshot: (snapshot) => {
    const experimentId = snapshot.currentExperimentId ?? 'opt-031';
    const isKnown = DIFFRACTION_EXPERIMENTS.some((e) => e.id === experimentId);
    set({
      currentExperimentId: isKnown
        ? experimentId
        : ('opt-031' as DiffractionExperimentId),
      settings: snapshot.settings
        ? { ...buildDefaultDiffractionSettings(), ...snapshot.settings }
        : buildDefaultDiffractionSettings(),
    });
  },
}));
