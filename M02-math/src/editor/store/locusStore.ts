import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TracePoint {
  x: number;
  y: number;
  t: number;
}

export type LocusPreset = 'sum-of-distances' | 'focus-directrix';

interface LocusState {
  isAnimating: boolean;
  activePreset: LocusPreset | null;
  activeEntityId: string | null;
  currentPoint: TracePoint | null;
  tracePoints: TracePoint[];
  maxTrace: number;
  renderTick: number;

  setAnimating: (v: boolean) => void;
  setPreset: (preset: LocusPreset | null, entityId: string | null) => void;
  pushTrace: (pt: TracePoint) => void;
  setCurrentPoint: (pt: TracePoint | null) => void;
  incrementRenderTick: () => void;
  clearTrace: () => void;
  getSnapshot: () => LocusStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<LocusStoreSnapshot>) => void;
}

export interface LocusStoreSnapshot {
  activePreset: LocusPreset | null;
  activeEntityId: string | null;
  currentPoint: TracePoint | null;
  tracePoints: TracePoint[];
  maxTrace: number;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useLocusStore = create<LocusState>((set, get) => ({
  isAnimating: false,
  activePreset: null,
  activeEntityId: null,
  currentPoint: null,
  tracePoints: [],
  maxTrace: 200,
  renderTick: 0,

  setAnimating(v) {
    set({ isAnimating: v });
  },

  setPreset(preset, entityId) {
    set({ activePreset: preset, activeEntityId: entityId });
  },

  pushTrace(pt) {
    const { tracePoints, maxTrace } = get();
    const next = tracePoints.length >= maxTrace
      ? [...tracePoints.slice(1), pt]
      : [...tracePoints, pt];
    set({ tracePoints: next });
  },

  setCurrentPoint(pt) {
    set({ currentPoint: pt });
  },

  incrementRenderTick() {
    set({ renderTick: get().renderTick + 1 });
  },

  clearTrace() {
    set({
      tracePoints: [],
      currentPoint: null,
      activePreset: null,
      activeEntityId: null,
      renderTick: 0,
    });
  },

  getSnapshot() {
    const state = get();
    return {
      activePreset: state.activePreset,
      activeEntityId: state.activeEntityId,
      currentPoint: state.currentPoint ? structuredClone(state.currentPoint) : null,
      tracePoints: structuredClone(state.tracePoints),
      maxTrace: state.maxTrace,
    };
  },

  loadSnapshot(snapshot) {
    set({
      isAnimating: false,
      activePreset: snapshot?.activePreset ?? null,
      activeEntityId: snapshot?.activeEntityId ?? null,
      currentPoint: snapshot?.currentPoint ? structuredClone(snapshot.currentPoint) : null,
      tracePoints: snapshot?.tracePoints ? structuredClone(snapshot.tracePoints) : [],
      maxTrace: typeof snapshot?.maxTrace === 'number' ? snapshot.maxTrace : 200,
      renderTick: 0,
    });
  },
}));
