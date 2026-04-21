import { create } from 'zustand';

export type M04AppMode = 'trig' | 'triangle';

export interface M04UiStoreSnapshot {
  appMode: M04AppMode;
}

interface M04UiState {
  appMode: M04AppMode;
  setAppMode: (mode: M04AppMode) => void;
  getSnapshot: () => M04UiStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<M04UiStoreSnapshot>) => void;
}

export const useM04UiStore = create<M04UiState>((set, get) => ({
  appMode: 'trig',

  setAppMode: (appMode) => set({ appMode }),

  getSnapshot: () => {
    const state = get();
    return {
      appMode: state.appMode,
    };
  },

  loadSnapshot: (snapshot) =>
    set({
      appMode: snapshot?.appMode === 'triangle' ? 'triangle' : 'trig',
    }),
}));
