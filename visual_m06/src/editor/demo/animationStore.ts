import { create } from 'zustand';

export type AnimationStatus = 'stopped' | 'playing' | 'paused';

interface DemoAnimationState {
  status: AnimationStatus;
  speed: number;
  elapsedTime: number;
  play(): void;
  pause(): void;
  stop(): void;
  setSpeed(s: number): void;
  setElapsedTime(t: number): void;
}

export const useAnimationStore = create<DemoAnimationState>((set) => ({
  status: 'stopped',
  speed: 1,
  elapsedTime: 0,
  play: () => set({ status: 'playing' }),
  pause: () => set({ status: 'paused' }),
  stop: () => set({ status: 'stopped', elapsedTime: 0 }),
  setSpeed: (s) => set({ speed: s }),
  setElapsedTime: (t) => set({ elapsedTime: t }),
}));
