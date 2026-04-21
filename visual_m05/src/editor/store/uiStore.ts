import { create } from 'zustand';
import type { SimulationCategory } from '../../types/simulation';

interface UIState {
  activeCategory: SimulationCategory;
  showResultPanel: boolean;
  isAnimating: boolean;
  animationSpeed: number; // 1=slow, 2=medium, 3=fast, 4=very fast

  setActiveCategory(cat: SimulationCategory): void;
  setShowResultPanel(show: boolean): void;
  setIsAnimating(v: boolean): void;
  setAnimationSpeed(speed: number): void;
  getSnapshot(): UIStoreSnapshot;
  loadSnapshot(snapshot?: Partial<UIStoreSnapshot>): void;
}

export interface UIStoreSnapshot {
  activeCategory: SimulationCategory;
  showResultPanel: boolean;
  animationSpeed: number;
}

export const useUIStore = create<UIState>()((set) => ({
  activeCategory: 'classical',
  showResultPanel: true,
  isAnimating: false,
  animationSpeed: 2,

  setActiveCategory(cat: SimulationCategory): void {
    set({ activeCategory: cat });
  },

  setShowResultPanel(show: boolean): void {
    set({ showResultPanel: show });
  },

  setIsAnimating(v: boolean): void {
    set({ isAnimating: v });
  },

  setAnimationSpeed(speed: number): void {
    set({ animationSpeed: speed });
  },

  getSnapshot(): UIStoreSnapshot {
    const state = useUIStore.getState();
    return {
      activeCategory: state.activeCategory,
      showResultPanel: state.showResultPanel,
      animationSpeed: state.animationSpeed,
    };
  },

  loadSnapshot(snapshot): void {
    set({
      activeCategory: snapshot?.activeCategory ?? 'classical',
      showResultPanel: snapshot?.showResultPanel ?? true,
      animationSpeed: snapshot?.animationSpeed ?? 2,
      isAnimating: false,
    });
  },
}));
