/**
 * doubleSlitStore.ts
 * Zustand store for the double-slit interference module.
 * Follows the same pattern as lensStore.ts / diffractionStore.ts.
 */

import { create } from 'zustand';
import type { DoubleSlitSettings } from '@/data/doubleSlitData';
import { buildDefaultDoubleSlitSettings, DOUBLESLIT_EXPERIMENTS } from '@/data/doubleSlitData';

type DoubleSlitExperimentId = 'opt-021';

interface DoubleSlitSnapshot {
  currentExperimentId: DoubleSlitExperimentId;
  settings: DoubleSlitSettings;
}

interface DoubleSlitState extends DoubleSlitSnapshot {
  selectExperiment: (id: DoubleSlitExperimentId) => void;
  updateSettings: (partial: Partial<DoubleSlitSettings>) => void;
  resetSettings: () => void;
  getSnapshot: () => DoubleSlitSnapshot;
  loadSnapshot: (snapshot: Partial<DoubleSlitSnapshot>) => void;
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const useDoubleSlitStore = create<DoubleSlitState>((set, get) => ({
  currentExperimentId: 'opt-021' as DoubleSlitExperimentId,
  settings: buildDefaultDoubleSlitSettings(),

  selectExperiment: (id) => set((state) => {
    const experiment = DOUBLESLIT_EXPERIMENTS.find((e) => e.id === id);
    if (!experiment) return {};
    const defaults = experiment.defaults as Partial<DoubleSlitSettings>;
    return {
      currentExperimentId: id,
      settings: { ...state.settings, ...defaults },
    };
  }),

  updateSettings: (partial) => set((state) => ({
    settings: { ...state.settings, ...partial },
  })),

  resetSettings: () => set({
    currentExperimentId: 'opt-021',
    settings: buildDefaultDoubleSlitSettings(),
  }),

  getSnapshot: () => {
    const state = get();
    return {
      currentExperimentId: state.currentExperimentId,
      settings: cloneSnapshot(state.settings),
    };
  },

  loadSnapshot: (snapshot) => {
    const experimentId = snapshot.currentExperimentId ?? 'opt-021';
    const isKnown = DOUBLESLIT_EXPERIMENTS.some((e) => e.id === experimentId);
    set({
      currentExperimentId: isKnown ? experimentId : ('opt-021' as DoubleSlitExperimentId),
      settings: snapshot.settings
        ? { ...buildDefaultDoubleSlitSettings(), ...snapshot.settings }
        : buildDefaultDoubleSlitSettings(),
    });
  },
}));
