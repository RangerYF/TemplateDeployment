/**
 * thinFilmStore.ts
 * Zustand store for the thin-film interference module.
 * Follows the same pattern as lensStore.ts.
 */

import { create } from 'zustand';
import type { ThinFilmSettings, ThinFilmExperimentId } from '@/data/thinFilmData';
import { buildDefaultThinFilmSettings, THINFILM_EXPERIMENTS } from '@/data/thinFilmData';

interface ThinFilmSnapshot {
  currentExperimentId: ThinFilmExperimentId;
  settings: ThinFilmSettings;
}

interface ThinFilmState extends ThinFilmSnapshot {
  selectExperiment: (id: ThinFilmExperimentId) => void;
  updateSettings: (partial: Partial<ThinFilmSettings>) => void;
  resetSettings: () => void;
  getSnapshot: () => ThinFilmSnapshot;
  loadSnapshot: (snapshot: Partial<ThinFilmSnapshot>) => void;
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const useThinFilmStore = create<ThinFilmState>((set, get) => ({
  currentExperimentId: 'opt-043' as ThinFilmExperimentId,
  settings: buildDefaultThinFilmSettings(),

  selectExperiment: (id) => set((state) => {
    const experiment = THINFILM_EXPERIMENTS.find((e) => e.id === id);
    if (!experiment) return {};
    const defaults = experiment.defaults as Partial<ThinFilmSettings>;
    return {
      currentExperimentId: id,
      settings: { ...state.settings, ...defaults },
    };
  }),

  updateSettings: (partial) => set((state) => ({
    settings: { ...state.settings, ...partial },
  })),

  resetSettings: () => set({
    currentExperimentId: 'opt-043',
    settings: buildDefaultThinFilmSettings(),
  }),

  getSnapshot: () => {
    const state = get();
    return {
      currentExperimentId: state.currentExperimentId,
      settings: cloneSnapshot(state.settings),
    };
  },

  loadSnapshot: (snapshot) => {
    const experimentId = snapshot.currentExperimentId ?? 'opt-043';
    const isKnown = THINFILM_EXPERIMENTS.some((e) => e.id === experimentId);
    set({
      currentExperimentId: isKnown ? experimentId : ('opt-043' as ThinFilmExperimentId),
      settings: snapshot.settings
        ? { ...buildDefaultThinFilmSettings(), ...snapshot.settings }
        : buildDefaultThinFilmSettings(),
    });
  },
}));
