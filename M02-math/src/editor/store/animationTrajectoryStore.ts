import { create } from 'zustand';
import type { SamplePoint } from '@/engine/sampler';

export interface AnimationTrajectoryFrame {
  functionId: string;
  points: SamplePoint[];
  color: string;
  lineStyle: 'solid' | 'dashed';
}

interface AnimationTrajectoryState {
  frames: AnimationTrajectoryFrame[];
  setFrames: (frames: AnimationTrajectoryFrame[]) => void;
  appendFrame: (frame: AnimationTrajectoryFrame, maxFrames?: number) => void;
  clear: () => void;
}

export const useAnimationTrajectoryStore = create<AnimationTrajectoryState>((set) => ({
  frames: [],

  setFrames: (frames) => set({ frames }),

  appendFrame: (frame, maxFrames = 36) =>
    set((state) => ({
      frames: [...state.frames, frame].slice(-maxFrames),
    })),

  clear: () => set({ frames: [] }),
}));
