/**
 * triangleSolverStore — M04 Phase 5
 *
 * Holds the active solve mode, current input values, and latest solve result
 * so TriangleCanvas and TriangleSolverPanel can restore a full editing session.
 */

import { create } from 'zustand';
import type { SolveMode, SolveResult } from '@/types';

export type TriangleSolverInputs = Record<string, number>;
export type TriangleCanvasMode = 'solve' | 'range-demo';

export interface TriangleAuxiliaryOptions {
  showMedians: boolean;
  showAngleBisectors: boolean;
  showAltitudes: boolean;
  showPerpBisectors: boolean;
  showCentroid: boolean;
  showCircumcenter: boolean;
}

export interface TriangleRangeDemoState {
  sideLength: number;
  angleDeg: number;
  sampleRatio: number;
}

export const TRIANGLE_MODE_DEFAULTS: Record<SolveMode, TriangleSolverInputs> = {
  SSS: { a: 3, b: 4, c: 5 },
  SAS: { a: 3, C: 60, b: 4 },
  ASA: { A: 60, c: 5, B: 45 },
  AAS: { A: 60, B: 45, a: 4 },
  SSA: { a: 3, b: 5, A: 30 },
};

export interface TriangleSolverStoreSnapshot {
  mode: SolveMode;
  inputs: TriangleSolverInputs;
  result: SolveResult | null;
  canvasMode: TriangleCanvasMode;
  auxiliaryOptions: TriangleAuxiliaryOptions;
  rangeDemo: TriangleRangeDemoState;
}

export interface TriangleSolverState {
  mode: SolveMode;
  inputs: TriangleSolverInputs;
  result: SolveResult | null;
  canvasMode: TriangleCanvasMode;
  auxiliaryOptions: TriangleAuxiliaryOptions;
  rangeDemo: TriangleRangeDemoState;
  setMode: (mode: SolveMode) => void;
  setInput: (key: string, value: number) => void;
  setInputs: (inputs: TriangleSolverInputs) => void;
  setResult: (result: SolveResult | null) => void;
  setCanvasMode: (mode: TriangleCanvasMode) => void;
  setAuxiliaryOption: <K extends keyof TriangleAuxiliaryOptions>(key: K, value: TriangleAuxiliaryOptions[K]) => void;
  setRangeDemo: (patch: Partial<TriangleRangeDemoState>) => void;
  getSnapshot: () => TriangleSolverStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<TriangleSolverStoreSnapshot>) => void;
}

const DEFAULT_AUXILIARY_OPTIONS: TriangleAuxiliaryOptions = {
  showMedians: false,
  showAngleBisectors: false,
  showAltitudes: false,
  showPerpBisectors: false,
  showCentroid: false,
  showCircumcenter: false,
};

const DEFAULT_RANGE_DEMO: TriangleRangeDemoState = {
  sideLength: 4,
  angleDeg: 45,
  sampleRatio: 0.45,
};

export const useTriangleSolverStore = create<TriangleSolverState>((set, get) => ({
  mode: 'SSS',
  inputs: { ...TRIANGLE_MODE_DEFAULTS.SSS },
  result: null,
  canvasMode: 'solve',
  auxiliaryOptions: { ...DEFAULT_AUXILIARY_OPTIONS },
  rangeDemo: { ...DEFAULT_RANGE_DEMO },

  setMode: (mode) =>
    set({
      mode,
      inputs: { ...TRIANGLE_MODE_DEFAULTS[mode] },
      result: null,
    }),

  setInput: (key, value) =>
    set((state) => ({
      inputs: {
        ...state.inputs,
        [key]: value,
      },
      result: null,
    })),

  setInputs: (inputs) =>
    set({
      inputs,
      result: null,
    }),

  setResult: (result) => set({ result }),

  setCanvasMode: (canvasMode) => set({ canvasMode }),

  setAuxiliaryOption: (key, value) =>
    set((state) => ({
      auxiliaryOptions: {
        ...state.auxiliaryOptions,
        [key]: value,
      },
    })),

  setRangeDemo: (patch) =>
    set((state) => ({
      rangeDemo: {
        ...state.rangeDemo,
        ...patch,
      },
    })),

  getSnapshot: () => {
    const state = get();
    return {
      mode: state.mode,
      inputs: structuredClone(state.inputs),
      result: state.result ? structuredClone(state.result) : null,
      canvasMode: state.canvasMode,
      auxiliaryOptions: structuredClone(state.auxiliaryOptions),
      rangeDemo: structuredClone(state.rangeDemo),
    };
  },

  loadSnapshot: (snapshot) => {
    const mode = snapshot?.mode ?? 'SSS';
    set({
      mode,
      inputs: snapshot?.inputs ? structuredClone(snapshot.inputs) : { ...TRIANGLE_MODE_DEFAULTS[mode] },
      result: snapshot?.result ? structuredClone(snapshot.result) : null,
      canvasMode: snapshot?.canvasMode ?? 'solve',
      auxiliaryOptions: snapshot?.auxiliaryOptions
        ? structuredClone(snapshot.auxiliaryOptions)
        : { ...DEFAULT_AUXILIARY_OPTIONS },
      rangeDemo: snapshot?.rangeDemo
        ? structuredClone(snapshot.rangeDemo)
        : { ...DEFAULT_RANGE_DEMO },
    });
  },
}));
