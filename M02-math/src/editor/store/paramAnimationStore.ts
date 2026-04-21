import { create } from 'zustand';
import type { EasingName } from '@/engine/animationEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnimParam {
  /** e.g. "transform.a", "transform.h", "named.omega" */
  key: string;
  label: string;
  enabled: boolean;
  from: number;
  to: number;
}

export type PlayState = 'idle' | 'playing' | 'paused';

export interface ParamAnimationStoreSnapshot {
  params: AnimParam[];
  duration: number;
  easing: EasingName;
  loop: boolean;
  recordEnabled: boolean;
  playState: PlayState;
}

export interface ParamAnimationState {
  params: AnimParam[];
  duration: number;
  easing: EasingName;
  loop: boolean;
  recordEnabled: boolean;
  playState: PlayState;

  setParams: (params: AnimParam[]) => void;
  updateParam: (key: string, patch: Partial<AnimParam>) => void;
  setDuration: (ms: number) => void;
  setEasing: (name: EasingName) => void;
  setLoop: (v: boolean) => void;
  setRecordEnabled: (v: boolean) => void;
  setPlayState: (s: PlayState) => void;
  reset: () => void;
  getSnapshot: () => ParamAnimationStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<ParamAnimationStoreSnapshot>) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useParamAnimationStore = create<ParamAnimationState>((set, get) => ({
  params: [],
  duration: 2000,
  easing: 'easeInOut',
  loop: false,
  recordEnabled: false,
  playState: 'idle',

  setParams: (params) => set({ params }),
  updateParam: (key, patch) =>
    set((s) => ({
      params: s.params.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    })),
  setDuration: (duration) => set({ duration }),
  setEasing: (easing) => set({ easing }),
  setLoop: (loop) => set({ loop }),
  setRecordEnabled: (recordEnabled) => set({ recordEnabled }),
  setPlayState: (playState) => set({ playState }),
  reset: () =>
    set({
      params: [],
      duration: 2000,
      easing: 'easeInOut',
      loop: false,
      recordEnabled: false,
      playState: 'idle',
    }),

  getSnapshot: () => {
    const state: ParamAnimationState = get();
    return {
      params: structuredClone(state.params),
      duration: state.duration,
      easing: state.easing,
      loop: state.loop,
      recordEnabled: state.recordEnabled,
      playState: state.playState,
    };
  },

  loadSnapshot: (snapshot) =>
    set({
      params: snapshot?.params ? structuredClone(snapshot.params) : [],
      duration: typeof snapshot?.duration === 'number' ? snapshot.duration : 2000,
      easing: snapshot?.easing ?? 'easeInOut',
      loop: typeof snapshot?.loop === 'boolean' ? snapshot.loop : false,
      recordEnabled: typeof snapshot?.recordEnabled === 'boolean' ? snapshot.recordEnabled : false,
      playState: snapshot?.playState ?? 'idle',
    }),
}));
