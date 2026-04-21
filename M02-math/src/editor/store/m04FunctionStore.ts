/**
 * m04FunctionStore — M04 function-graph state (Phase 4).
 *
 * Phases 2-3 state: fnType, transform, traceX/History, showReference.
 * Phase 4 additions:
 *  - fivePointStep  : 0-5 stepper for the Five-Point canvas overlay
 *  - showAuxiliary  : switch to auxiliary-angle 3-curve view
 *  - auxiliaryA/B   : coefficients for a·sin x + b·cos x synthesis
 *  - auxShowC1/C2/R : per-curve visibility toggles for auxiliary view
 */

import { create } from 'zustand';
import type { ViewportState, FnType, TrigTransform, FivePointStep } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _evalTrig(fnType: FnType, t: TrigTransform, x: number): number {
  const arg = t.omega * x + t.phi;
  const base = fnType === 'sin' ? Math.sin(arg)
             : fnType === 'cos' ? Math.cos(arg)
             : Math.tan(arg);
  return t.A * base + t.k;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TWO_PI = 2 * Math.PI;
const MAX_HISTORY = 300;

export const DEFAULT_TRIG_TRANSFORM: TrigTransform = {
  A: 1, omega: 1, phi: 0, k: 0,
};

export const DEFAULT_M04_FUNCTION_VIEWPORT: ViewportState = {
  xMin: -TWO_PI,
  xMax:  TWO_PI,
  yMin: -1.8,
  yMax:  1.8,
};

// ─── Store shape ─────────────────────────────────────────────────────────────

export interface M04FunctionStoreSnapshot {
  traceX: number;
  viewport: ViewportState;
  fnType: FnType;
  transform: TrigTransform;
  showReference: boolean;
  fivePointStep: FivePointStep;
  showAuxiliary: boolean;
  auxiliaryA: number;
  auxiliaryB: number;
  auxShowC1: boolean;
  auxShowC2: boolean;
  auxShowCR: boolean;
}

export interface M04FunctionState {
  // Phase 2-3
  traceX:        number;
  viewport:      ViewportState;
  fnType:        FnType;
  transform:     TrigTransform;
  traceHistory:  Array<{ x: number; y: number }>;
  showReference: boolean;

  // Phase 4 — Five-Point Method
  fivePointStep: FivePointStep;

  // Phase 4 — Auxiliary Angle Synthesis
  showAuxiliary: boolean;
  auxiliaryA:    number;
  auxiliaryB:    number;
  auxShowC1:     boolean;   // show a·sin x
  auxShowC2:     boolean;   // show b·cos x
  auxShowCR:     boolean;   // show R·sin(x+φ)

  // Actions
  setTraceX:        (x: number) => void;
  setFnType:        (t: FnType) => void;
  setTransform:     (t: Partial<TrigTransform>) => void;
  setShowReference: (v: boolean) => void;
  clearHistory:     () => void;
  setViewport:      (vp: ViewportState) => void;
  setFivePointStep: (step: FivePointStep) => void;
  setShowAuxiliary: (v: boolean) => void;
  setAuxiliaryA:    (a: number) => void;
  setAuxiliaryB:    (b: number) => void;
  setAuxShowC1:     (v: boolean) => void;
  setAuxShowC2:     (v: boolean) => void;
  setAuxShowCR:     (v: boolean) => void;
  getSnapshot:      () => M04FunctionStoreSnapshot;
  loadSnapshot:     (snapshot?: Partial<M04FunctionStoreSnapshot>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useM04FunctionStore = create<M04FunctionState>((set, get) => ({
  // Phase 2-3 defaults
  traceX:        0,
  viewport:      { ...DEFAULT_M04_FUNCTION_VIEWPORT },
  fnType:        'sin',
  transform:     { ...DEFAULT_TRIG_TRANSFORM },
  traceHistory:  [],
  showReference: true,

  // Phase 4 defaults
  fivePointStep: 0,
  showAuxiliary: false,
  auxiliaryA:    1,
  auxiliaryB:    1,
  auxShowC1:     true,
  auxShowC2:     true,
  auxShowCR:     true,

  // ── Phase 2-3 actions ────────────────────────────────────────────────────
  setTraceX: (x) => set((state) => {
    const y = _evalTrig(state.fnType, state.transform, x);
    const valid = isFinite(y);
    const newHistory = valid
      ? [...state.traceHistory.slice(-(MAX_HISTORY - 1)), { x, y }]
      : state.traceHistory;
    return { traceX: x, traceHistory: newHistory };
  }),

  setFnType: (t) => set({ fnType: t, traceHistory: [], fivePointStep: 0 }),

  setTransform: (t) => set((state) => ({
    transform:     { ...state.transform, ...t },
    traceHistory:  [],
    fivePointStep: 0,
  })),

  setShowReference: (v) => set({ showReference: v }),
  clearHistory:     ()  => set({ traceHistory: [] }),
  setViewport:      (vp) => set({ viewport: vp }),

  // ── Phase 4 actions ──────────────────────────────────────────────────────
  setFivePointStep: (step) => set({ fivePointStep: step }),
  setShowAuxiliary: (v)    => set({ showAuxiliary: v }),
  setAuxiliaryA:    (a)    => set({ auxiliaryA: a }),
  setAuxiliaryB:    (b)    => set({ auxiliaryB: b }),
  setAuxShowC1:     (v)    => set({ auxShowC1: v }),
  setAuxShowC2:     (v)    => set({ auxShowC2: v }),
  setAuxShowCR:     (v)    => set({ auxShowCR: v }),

  getSnapshot: () => {
    const state = get();
    return {
      traceX: state.traceX,
      viewport: structuredClone(state.viewport),
      fnType: state.fnType,
      transform: structuredClone(state.transform),
      showReference: state.showReference,
      fivePointStep: state.fivePointStep,
      showAuxiliary: state.showAuxiliary,
      auxiliaryA: state.auxiliaryA,
      auxiliaryB: state.auxiliaryB,
      auxShowC1: state.auxShowC1,
      auxShowC2: state.auxShowC2,
      auxShowCR: state.auxShowCR,
    };
  },

  loadSnapshot: (snapshot) =>
    set({
      traceX: typeof snapshot?.traceX === 'number' ? snapshot.traceX : 0,
      viewport: snapshot?.viewport ? structuredClone(snapshot.viewport) : { ...DEFAULT_M04_FUNCTION_VIEWPORT },
      fnType: snapshot?.fnType ?? 'sin',
      transform: snapshot?.transform ? structuredClone(snapshot.transform) : { ...DEFAULT_TRIG_TRANSFORM },
      traceHistory: [],
      showReference: typeof snapshot?.showReference === 'boolean' ? snapshot.showReference : true,
      fivePointStep: snapshot?.fivePointStep ?? 0,
      showAuxiliary: typeof snapshot?.showAuxiliary === 'boolean' ? snapshot.showAuxiliary : false,
      auxiliaryA: typeof snapshot?.auxiliaryA === 'number' ? snapshot.auxiliaryA : 1,
      auxiliaryB: typeof snapshot?.auxiliaryB === 'number' ? snapshot.auxiliaryB : 1,
      auxShowC1: typeof snapshot?.auxShowC1 === 'boolean' ? snapshot.auxShowC1 : true,
      auxShowC2: typeof snapshot?.auxShowC2 === 'boolean' ? snapshot.auxShowC2 : true,
      auxShowCR: typeof snapshot?.auxShowCR === 'boolean' ? snapshot.auxShowCR : true,
    }),
}));
