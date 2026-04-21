import { create } from 'zustand';

interface UIState {
  unfoldingEnabled: boolean;
  threeViewEnabled: boolean;
  setUnfoldingEnabled: (enabled: boolean) => void;
  setThreeViewEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  unfoldingEnabled: false,
  threeViewEnabled: false,
  setUnfoldingEnabled: (enabled) => set({ unfoldingEnabled: enabled }),
  setThreeViewEnabled: (enabled) => set({ threeViewEnabled: enabled }),
}));
