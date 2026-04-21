/**
 * triangleSolverStore — M04 Phase 5
 *
 * Holds the active solve mode, current input values, and latest solve result
 * so TriangleCanvas and TriangleSolverPanel can restore a full editing session.
 */

import { create } from 'zustand';
import type { SolveMode, SolveResult } from '@/types';

export type TriangleSolverInputs = Record<string, number>;

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
}

export interface TriangleSolverState {
  mode: SolveMode;
  inputs: TriangleSolverInputs;
  result: SolveResult | null;
  setMode: (mode: SolveMode) => void;
  setInput: (key: string, value: number) => void;
  setInputs: (inputs: TriangleSolverInputs) => void;
  setResult: (result: SolveResult | null) => void;
  getSnapshot: () => TriangleSolverStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<TriangleSolverStoreSnapshot>) => void;
}

export const useTriangleSolverStore = create<TriangleSolverState>((set, get) => ({
  mode: 'SSS',
  inputs: { ...TRIANGLE_MODE_DEFAULTS.SSS },
  result: null,

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
    })),

  setInputs: (inputs) =>
    set({
      inputs,
    }),

  setResult: (result) => set({ result }),

  getSnapshot: () => {
    const state = get();
    return {
      mode: state.mode,
      inputs: structuredClone(state.inputs),
      result: state.result ? structuredClone(state.result) : null,
    };
  },

  loadSnapshot: (snapshot) => {
    const mode = snapshot?.mode ?? 'SSS';
    set({
      mode,
      inputs: snapshot?.inputs ? structuredClone(snapshot.inputs) : { ...TRIANGLE_MODE_DEFAULTS[mode] },
      result: snapshot?.result ? structuredClone(snapshot.result) : null,
    });
  },
}));
