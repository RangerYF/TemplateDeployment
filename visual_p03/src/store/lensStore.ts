/**
 * lensStore.ts
 * Zustand store for the lens imaging module.
 * Follows the same pattern as simulationStore.ts (refraction).
 */

import { create } from 'zustand';
import type { LensSettings, LensExperimentId } from '@/data/lensData';
import { buildDefaultLensSettings, LENS_EXPERIMENTS } from '@/data/lensData';

interface LensSnapshot {
  currentExperimentId: LensExperimentId;
  settings: LensSettings;
}

interface LensState extends LensSnapshot {
  selectExperiment: (id: LensExperimentId) => void;
  updateSettings: (partial: Partial<LensSettings>) => void;
  resetSettings: () => void;
  getSnapshot: () => LensSnapshot;
  loadSnapshot: (snapshot: Partial<LensSnapshot>) => void;
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const useLensStore = create<LensState>((set, get) => ({
  currentExperimentId: 'opt-011' as LensExperimentId,
  settings: buildDefaultLensSettings(),

  selectExperiment: (id) => set((state) => {
    const experiment = LENS_EXPERIMENTS.find((e) => e.id === id);
    if (!experiment) return {};
    const defaults = experiment.defaults as Partial<LensSettings>;
    return {
      currentExperimentId: id,
      settings: { ...state.settings, ...defaults },
    };
  }),

  updateSettings: (partial) => set((state) => ({
    settings: { ...state.settings, ...partial },
  })),

  resetSettings: () => set({
    currentExperimentId: 'opt-011',
    settings: buildDefaultLensSettings(),
  }),

  getSnapshot: () => {
    const state = get();
    return {
      currentExperimentId: state.currentExperimentId,
      settings: cloneSnapshot(state.settings),
    };
  },

  loadSnapshot: (snapshot) => {
    const experimentId = snapshot.currentExperimentId ?? 'opt-011';
    const isKnown = LENS_EXPERIMENTS.some((e) => e.id === experimentId);
    set({
      currentExperimentId: isKnown ? experimentId : ('opt-011' as LensExperimentId),
      settings: snapshot.settings
        ? { ...buildDefaultLensSettings(), ...snapshot.settings }
        : buildDefaultLensSettings(),
    });
  },
}));
