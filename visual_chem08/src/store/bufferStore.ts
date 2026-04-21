import { create } from 'zustand';
import { getBuffer } from '@/data/bufferSystems';
import { calcBufferComparison, type BufferResult } from '@/engine/titrationMath';

export type BufferDisplayMode = 'delta' | 'absolute';

export interface BufferStoreSnapshot {
  selectedBufferId: string;
  addedAmount: number;
  addType: 'acid' | 'base';
  bufferConc: number;
  bufferVol: number;
  displayMode: BufferDisplayMode;
}

export interface BufferState {
  selectedBufferId: string;
  addedAmount: number; // moles
  addType: 'acid' | 'base';
  bufferConc: number;
  bufferVol: number; // mL
  displayMode: BufferDisplayMode;
  result: BufferResult | null;

  setSelectedBuffer: (id: string) => void;
  setAddedAmount: (a: number) => void;
  setAddType: (t: 'acid' | 'base') => void;
  setDisplayMode: (m: BufferDisplayMode) => void;
  getSnapshot: () => BufferStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<BufferStoreSnapshot>) => void;
}

function recalculate(state: {
  selectedBufferId: string;
  addedAmount: number;
  addType: 'acid' | 'base';
  bufferConc: number;
  bufferVol: number;
}): BufferResult {
  const buf = getBuffer(state.selectedBufferId);
  return calcBufferComparison(
    buf.pKa,
    state.bufferConc,
    state.bufferVol,
    state.addedAmount,
    state.addType === 'acid',
  );
}

const initialState = {
  selectedBufferId: 'acetate',
  addedAmount: 0.001,
  addType: 'acid' as const,
  bufferConc: 0.1,
  bufferVol: 100,
  displayMode: 'delta' as BufferDisplayMode,
};

function clampPositive(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export const useBufferStore = create<BufferState>((set, get) => ({
  ...initialState,
  result: recalculate(initialState),

  setSelectedBuffer: (id) =>
    set((s) => {
      const next = { ...s, selectedBufferId: id };
      return { selectedBufferId: id, result: recalculate(next) };
    }),

  setAddedAmount: (a) =>
    set((s) => {
      const next = { ...s, addedAmount: a };
      return { addedAmount: a, result: recalculate(next) };
    }),

  setAddType: (t) =>
    set((s) => {
      const next = { ...s, addType: t };
      return { addType: t, result: recalculate(next) };
    }),

  setDisplayMode: (m) => set({ displayMode: m }),

  getSnapshot: (): BufferStoreSnapshot => {
    const state: BufferState = get();
    return {
      selectedBufferId: state.selectedBufferId,
      addedAmount: state.addedAmount,
      addType: state.addType,
      bufferConc: state.bufferConc,
      bufferVol: state.bufferVol,
      displayMode: state.displayMode,
    };
  },

  loadSnapshot: (snapshot) => {
    const nextState: BufferStoreSnapshot = {
      selectedBufferId: snapshot?.selectedBufferId ?? initialState.selectedBufferId,
      addedAmount: clampPositive(snapshot?.addedAmount, initialState.addedAmount),
      addType: snapshot?.addType === 'base' ? 'base' : 'acid',
      bufferConc: clampPositive(snapshot?.bufferConc, initialState.bufferConc),
      bufferVol: clampPositive(snapshot?.bufferVol, initialState.bufferVol),
      displayMode: snapshot?.displayMode === 'absolute' ? 'absolute' : 'delta',
    };
    set({
      ...nextState,
      result: recalculate(nextState),
    });
  },
}));
