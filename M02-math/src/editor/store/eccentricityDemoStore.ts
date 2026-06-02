import { create } from 'zustand';
import type { EccentricityAnimationControl } from '@/engine/eccentricityEngine';

export type EccentricitySweepRange =
  | 'ellipse-only'
  | 'ellipse-to-parabola'
  | 'full-conics'
  | 'hyperbola-only';

export type EccentricityDemoPlayState = 'idle' | 'playing' | 'paused';

interface EccentricityDemoState {
  activeEntityId: string | null;
  sweepRange: EccentricitySweepRange;
  speed: number;
  playState: EccentricityDemoPlayState;
  controller: EccentricityAnimationControl | null;
  setActiveEntity: (entityId: string | null, defaultRange: EccentricitySweepRange) => void;
  setSweepRange: (range: EccentricitySweepRange) => void;
  setSpeed: (speed: number) => void;
  setPlayState: (state: EccentricityDemoPlayState) => void;
  setController: (controller: EccentricityAnimationControl | null) => void;
  reset: () => void;
}

const DEFAULT_RANGE: EccentricitySweepRange = 'full-conics';
const DEFAULT_SPEED = 0.75;

export const useEccentricityDemoStore = create<EccentricityDemoState>((set) => ({
  activeEntityId: null,
  sweepRange: DEFAULT_RANGE,
  speed: DEFAULT_SPEED,
  playState: 'idle',
  controller: null,

  setActiveEntity: (entityId, defaultRange) =>
    set((state) => {
      if (state.activeEntityId === entityId) return state;
      return {
        activeEntityId: entityId,
        sweepRange: defaultRange,
        speed: DEFAULT_SPEED,
        playState: 'idle',
        controller: null,
      };
    }),

  setSweepRange: (sweepRange) => set({ sweepRange }),

  setSpeed: (speed) => set({ speed: Math.min(2, Math.max(0.25, speed)) }),

  setPlayState: (playState) => set({ playState }),

  setController: (controller) => set({ controller }),

  reset: () =>
    set({
      activeEntityId: null,
      sweepRange: DEFAULT_RANGE,
      speed: DEFAULT_SPEED,
      playState: 'idle',
      controller: null,
    }),
}));
