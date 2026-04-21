import { create } from 'zustand';
import {
  type FunctionEntry,
  type PiecewiseSegment,
  type ViewportState,
  DEFAULT_VIEWPORT,
} from '@/types';

interface FeatureFlags {
  showDerivative: boolean;
  showTangent: boolean;
  /** null = no active tangent point */
  tangentX: number | null;
  tangentY: number;
  tangentSlope: number | null;
  showFeaturePoints: boolean;
  showGrid: boolean;
  showAxisLabels: boolean;
}

export interface FunctionStoreSnapshot {
  functions: FunctionEntry[];
  activeFunctionId: string | null;
  viewport: ViewportState;
  features: FeatureFlags;
}

export interface FunctionState {
  functions: FunctionEntry[];
  activeFunctionId: string | null;
  viewport: ViewportState;
  features: FeatureFlags;

  addFunction: (fn: FunctionEntry) => void;
  removeFunction: (id: string) => void;
  updateFunction: (id: string, patch: Partial<FunctionEntry>) => void;
  setViewport: (vp: ViewportState) => void;
  setActiveFunctionId: (id: string | null) => void;
  setFeature: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void;
  /** Atomically update all three tangent fields in a single store write. */
  setTangentPoint: (x: number | null, y: number, slope: number | null) => void;
  /** Piecewise segment CRUD — each action triggers a reactive re-render. */
  addSegment: (funcId: string, segment: PiecewiseSegment) => void;
  removeSegment: (funcId: string, segId: string) => void;
  updateSegment: (funcId: string, segId: string, patch: Partial<PiecewiseSegment>) => void;
  getSnapshot: () => FunctionStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<FunctionStoreSnapshot>) => void;
}

export const useFunctionStore = create<FunctionState>((set, get) => ({
  functions: [],
  activeFunctionId: null,
  viewport: DEFAULT_VIEWPORT,
  features: {
    showDerivative: false,
    showTangent: false,
    tangentX: null,
    tangentY: 0,
    tangentSlope: null,
    showFeaturePoints: false,
    showGrid: true,
    showAxisLabels: true,
  },

  addFunction(fn) {
    set((s) => ({ functions: [...s.functions, fn] }));
  },

  removeFunction(id) {
    set((s) => ({
      functions: s.functions.filter((f) => f.id !== id),
      activeFunctionId: s.activeFunctionId === id ? null : s.activeFunctionId,
    }));
  },

  updateFunction(id, patch) {
    set((s) => ({
      functions: s.functions.map((f) =>
        f.id === id ? { ...f, ...patch } : f,
      ),
    }));
  },

  setViewport(vp) {
    set({ viewport: vp });
  },

  setActiveFunctionId(id) {
    set({ activeFunctionId: id });
  },

  setFeature(key, value) {
    set((s) => ({ features: { ...s.features, [key]: value } }));
  },

  setTangentPoint(x, y, slope) {
    set((s) => ({
      features: { ...s.features, tangentX: x, tangentY: y, tangentSlope: slope },
    }));
  },

  addSegment(funcId, segment) {
    set((s) => ({
      functions: s.functions.map((f) =>
        f.id === funcId ? { ...f, segments: [...f.segments, segment] } : f,
      ),
    }));
  },

  removeSegment(funcId, segId) {
    set((s) => ({
      functions: s.functions.map((f) =>
        f.id === funcId
          ? { ...f, segments: f.segments.filter((seg) => seg.id !== segId) }
          : f,
      ),
    }));
  },

  updateSegment(funcId, segId, patch) {
    set((s) => ({
      functions: s.functions.map((f) =>
        f.id === funcId
          ? {
              ...f,
              segments: f.segments.map((seg) =>
                seg.id === segId ? { ...seg, ...patch } : seg,
              ),
            }
          : f,
      ),
    }));
  },

  getSnapshot() {
    const state: FunctionState = get();
    return {
      functions: structuredClone(state.functions),
      activeFunctionId: state.activeFunctionId,
      viewport: structuredClone(state.viewport),
      features: structuredClone(state.features),
    };
  },

  loadSnapshot(snapshot) {
    set({
      functions: snapshot?.functions ? structuredClone(snapshot.functions) : [],
      activeFunctionId: snapshot?.activeFunctionId ?? null,
      viewport: snapshot?.viewport ? structuredClone(snapshot.viewport) : DEFAULT_VIEWPORT,
      features: snapshot?.features
        ? structuredClone(snapshot.features)
        : {
            showDerivative: false,
            showTangent: false,
            tangentX: null,
            tangentY: 0,
            tangentSlope: null,
            showFeaturePoints: false,
            showGrid: true,
            showAxisLabels: true,
          },
    });
  },
}));
