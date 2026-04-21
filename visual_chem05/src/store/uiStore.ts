import { create } from 'zustand';

export interface UISnapshot {
  rightPanelWidth: number;
  showTeachingPoints: boolean;
  showInfoPanel: boolean;
}

interface UIState {
  rightPanelWidth: number;
  showTeachingPoints: boolean;
  showInfoPanel: boolean;

  setRightPanelWidth: (w: number) => void;
  toggleTeachingPoints: () => void;
  toggleInfoPanel: () => void;
  getSnapshot: () => UISnapshot;
  loadSnapshot: (snapshot?: Partial<UISnapshot>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  rightPanelWidth: 320,
  showTeachingPoints: true,
  showInfoPanel: true,

  setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
  toggleTeachingPoints: () => set((s) => ({ showTeachingPoints: !s.showTeachingPoints })),
  toggleInfoPanel: () => set((s) => ({ showInfoPanel: !s.showInfoPanel })),
  getSnapshot: (): UISnapshot => {
    const state: UIState = useUIStore.getState();
    return {
      rightPanelWidth: state.rightPanelWidth,
      showTeachingPoints: state.showTeachingPoints,
      showInfoPanel: state.showInfoPanel,
    };
  },
  loadSnapshot: (snapshot?: Partial<UISnapshot>) => set({
    rightPanelWidth: snapshot?.rightPanelWidth ?? 320,
    showTeachingPoints: snapshot?.showTeachingPoints ?? true,
    showInfoPanel: snapshot?.showInfoPanel ?? true,
  }),
}));
