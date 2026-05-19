import { create } from 'zustand';

interface TraceState {
  traces: Record<string, { x: number; y: number }[]>;
  traceEnabled: Record<string, boolean>;
  maxPoints: number;

  addTracePoint(id: string, x: number, y: number): void;
  clearTrace(id: string): void;
  clearAllTraces(): void;
  setTraceEnabled(id: string, enabled: boolean): void;
}

export const useTraceStore = create<TraceState>((set) => ({
  traces: {},
  traceEnabled: {},
  maxPoints: 500,

  addTracePoint(id, x, y) {
    set((s) => {
      const prev = s.traces[id] ?? [];
      const next = prev.length >= s.maxPoints
        ? [...prev.slice(prev.length - s.maxPoints + 1), { x, y }]
        : [...prev, { x, y }];
      return { traces: { ...s.traces, [id]: next } };
    });
  },

  clearTrace(id) {
    set((s) => {
      const next = { ...s.traces };
      delete next[id];
      return { traces: next };
    });
  },

  clearAllTraces() {
    set({ traces: {} });
  },

  setTraceEnabled(id, enabled) {
    set((s) => ({
      traceEnabled: { ...s.traceEnabled, [id]: enabled },
    }));
  },
}));
