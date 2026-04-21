import { create } from 'zustand';
import type { ViewportState } from '@/types';
import type { TrigParams } from '@/canvas/renderers/trigCurveRenderer';

// ─── Constants ────────────────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;

/**
 * Default viewport for trig-function canvases.
 * x spans [-2π, 2π] to show two full periods of sin(x).
 * y spans [-3, 3] to leave headroom above A=2 curves.
 */
export const DEFAULT_TRIG_VIEWPORT: ViewportState = {
  xMin: -TWO_PI,
  xMax:  TWO_PI,
  yMin: -3,
  yMax:  3,
};

/**
 * Fixed reference curve parameters for Canvas A (y = sin(x)).
 * Never modified — Canvas A is intentionally read-only.
 */
export const BASE_TRIG_PARAMS: TrigParams = {
  A:     1,
  omega: 1,
  phi:   0,
  k:     0,
};

// ─── State shape ─────────────────────────────────────────────────────────────

interface TrigStoreState {
  // ── Canvas A (base function y = sin(x) — read-only reference) ────────────
  /** Independent viewport for Canvas A; user can pan/zoom Canvas A freely. */
  viewportA: ViewportState;

  // ── Canvas B (user-controlled comparison curve) ───────────────────────────
  /** Parameters driving the comparison curve y = A·sin(ω·x + φ) + k. */
  userParams: TrigParams;
  /** Independent viewport for Canvas B; isolated from Canvas A. */
  viewportB: ViewportState;

  // ── Actions ───────────────────────────────────────────────────────────────
  /** Set a single parameter field (live preview during drag — no Command). */
  setUserParam: (key: keyof TrigParams, value: number) => void;
  /** Overwrite all user params at once (used by Undo/Redo commands). */
  applyTrigParams: (patch: Partial<TrigParams>) => void;
  /** Called by EditorInjectable instance A on pan/zoom. */
  setViewportA: (vp: ViewportState) => void;
  /** Called by EditorInjectable instance B on pan/zoom. */
  setViewportB: (vp: ViewportState) => void;
  /** Reset user params to BASE_TRIG_PARAMS (A=1, ω=1, φ=0, k=0). */
  resetUserParams: () => void;
  getSnapshot: () => TrigStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<TrigStoreSnapshot>) => void;
}

export interface TrigStoreSnapshot {
  viewportA: ViewportState;
  userParams: TrigParams;
  viewportB: ViewportState;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTrigStore = create<TrigStoreState>((set, get) => ({
  viewportA:  { ...DEFAULT_TRIG_VIEWPORT },
  userParams: { ...BASE_TRIG_PARAMS },
  viewportB:  { ...DEFAULT_TRIG_VIEWPORT },

  setUserParam: (key, value) =>
    set((s) => ({ userParams: { ...s.userParams, [key]: value } })),

  applyTrigParams: (patch) =>
    set((s) => ({ userParams: { ...s.userParams, ...patch } })),

  setViewportA: (vp) => set({ viewportA: vp }),
  setViewportB: (vp) => set({ viewportB: vp }),

  resetUserParams: () => set({ userParams: { ...BASE_TRIG_PARAMS } }),

  getSnapshot: () => {
    const state = get();
    return {
      viewportA: structuredClone(state.viewportA),
      userParams: structuredClone(state.userParams),
      viewportB: structuredClone(state.viewportB),
    };
  },

  loadSnapshot: (snapshot) =>
    set({
      viewportA: snapshot?.viewportA ? structuredClone(snapshot.viewportA) : { ...DEFAULT_TRIG_VIEWPORT },
      userParams: snapshot?.userParams ? structuredClone(snapshot.userParams) : { ...BASE_TRIG_PARAMS },
      viewportB: snapshot?.viewportB ? structuredClone(snapshot.viewportB) : { ...DEFAULT_TRIG_VIEWPORT },
    }),
}));
