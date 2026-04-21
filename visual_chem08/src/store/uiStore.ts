import { create } from 'zustand';

export type ActiveTab = 'curve' | 'comparison' | 'buffer';

export interface UISnapshot {
  activeTab: ActiveTab;
}

export interface UIState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  getSnapshot: () => UISnapshot;
  loadSnapshot: (snapshot?: Partial<UISnapshot>) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTab: 'curve',
  setActiveTab: (tab) => set({ activeTab: tab }),
  getSnapshot: (): UISnapshot => {
    const state: UIState = get();
    return {
      activeTab: state.activeTab,
    };
  },
  loadSnapshot: (snapshot) =>
    set({
      activeTab:
        snapshot?.activeTab === 'comparison' || snapshot?.activeTab === 'buffer' || snapshot?.activeTab === 'curve'
          ? snapshot.activeTab
          : 'curve',
    }),
}));
