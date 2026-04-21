import { create } from 'zustand';
import type { SimulationType } from '../../types/simulation';

export type AnimMode = 'single' | 'multi';
export type AnimStatus = 'idle' | 'playing' | 'paused' | 'done';

export interface AnimationStoreSnapshot {
  mode: AnimMode;
  speed: number;
  singleSimId: string | null;
  singleType: SimulationType | null;
  singleTrials: unknown[];
  singleLastDisplay: string | null;
}

interface AnimationState {
  mode: AnimMode;

  // Multi-mode animation
  status: AnimStatus;
  animStep: number;    // current step (0..targetStep)
  targetStep: number;  // total trials in the result being animated
  speed: number;       // 1=slow, 2=medium, 3=fast, 4=very fast
  animSimId: string | null;

  // Single-mode accumulated state
  singleSimId: string | null;
  singleType: SimulationType | null;
  singleTrials: unknown[];
  singleLastDisplay: string | null;

  // Single-step animation (coin flip / dice roll visual)
  singleAnimating: boolean;
  singleAnimResult: unknown;

  setMode(mode: AnimMode): void;

  startAnimation(simId: string, total: number): void;
  setAnimStep(step: number): void;
  pauseAnimation(): void;
  resumeAnimation(): void;
  stopAnimation(): void;
  doneAnimation(): void;
  replayAnimation(): void;
  setSpeed(speed: number): void;

  initSingle(simId: string, type: SimulationType): void;
  pushSingleTrial(trial: unknown, display: string): void;
  resetSingle(): void;
  startSingleAnim(result: unknown): void;
  endSingleAnim(): void;
  getSnapshot(): AnimationStoreSnapshot;
  loadSnapshot(snapshot?: Partial<AnimationStoreSnapshot>): void;
}

export const useAnimationStore = create<AnimationState>()((set, get) => ({
  mode: 'multi',
  status: 'idle',
  animStep: 0,
  targetStep: 0,
  speed: 2,
  animSimId: null,

  singleSimId: null,
  singleType: null,
  singleTrials: [],
  singleLastDisplay: null,

  singleAnimating: false,
  singleAnimResult: null,

  setMode(mode) {
    set({ mode });
  },

  startAnimation(simId, total) {
    set({ status: 'playing', animStep: 0, targetStep: total, animSimId: simId });
  },

  setAnimStep(step) {
    set({ animStep: step });
  },

  pauseAnimation() {
    if (get().status === 'playing') set({ status: 'paused' });
  },

  resumeAnimation() {
    if (get().status === 'paused') set({ status: 'playing' });
  },

  stopAnimation() {
    set({ status: 'idle', animStep: 0, animSimId: null });
  },

  doneAnimation() {
    set({ status: 'done' });
  },

  replayAnimation() {
    set({ status: 'playing', animStep: 0 });
  },

  setSpeed(speed) {
    set({ speed });
  },

  initSingle(simId, type) {
    const state = get();
    if (state.singleSimId !== simId || state.singleType !== type) {
      set({ singleSimId: simId, singleType: type, singleTrials: [], singleLastDisplay: null });
    }
  },

  pushSingleTrial(trial, display) {
    const state = get();
    set({ singleTrials: [...state.singleTrials, trial], singleLastDisplay: display });
  },

  resetSingle() {
    set({ singleTrials: [], singleLastDisplay: null, singleAnimating: false, singleAnimResult: null });
  },

  startSingleAnim(result) {
    set({ singleAnimating: true, singleAnimResult: result });
  },

  endSingleAnim() {
    set({ singleAnimating: false, singleAnimResult: null });
  },

  getSnapshot() {
    const state = get();
    return {
      mode: state.mode,
      speed: state.speed,
      singleSimId: state.singleSimId,
      singleType: state.singleType,
      singleTrials: [...state.singleTrials],
      singleLastDisplay: state.singleLastDisplay,
    };
  },

  loadSnapshot(snapshot) {
    set({
      mode: snapshot?.mode ?? 'multi',
      status: 'idle',
      animStep: 0,
      targetStep: 0,
      speed: snapshot?.speed ?? 2,
      animSimId: null,
      singleSimId: snapshot?.singleSimId ?? null,
      singleType: snapshot?.singleType ?? null,
      singleTrials: snapshot?.singleTrials ? [...snapshot.singleTrials] : [],
      singleLastDisplay: snapshot?.singleLastDisplay ?? null,
      singleAnimating: false,
      singleAnimResult: null,
    });
  },
}));
