import { create } from 'zustand';

interface AnimationState {
  /** True while any RAF-driven animation is running. */
  isAnyAnimating: boolean;
  setIsAnimating: (v: boolean) => void;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  isAnyAnimating: false,
  setIsAnimating: (v) => set({ isAnyAnimating: v }),
}));
