import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface M03PinnedPoint {
  readonly id: string;
  readonly mathX: number;
  readonly mathY: number;
  readonly entityId: string;
  readonly label: string;
}

export interface M03PinnedIntersection {
  readonly id: string;
  readonly mathX: number;
  readonly mathY: number;
  readonly lineId: string;
  readonly conicId: string;
  readonly label: string;
}

interface M03InteractionState {
  pinnedPoints: M03PinnedPoint[];
  pinnedIntersections: M03PinnedIntersection[];

  togglePinnedPoint: (pt: { mathX: number; mathY: number; entityId: string }) => void;
  togglePinnedIntersection: (pt: { mathX: number; mathY: number; lineId: string; conicId: string }) => void;
  clearAll: () => void;
  getSnapshot: () => M03InteractionSnapshot;
  loadSnapshot: (snapshot?: Partial<M03InteractionSnapshot>) => void;
}

export interface M03InteractionSnapshot {
  pinnedPoints: M03PinnedPoint[];
  pinnedIntersections: M03PinnedIntersection[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _pinCounter = 0;
let _xsectCounter = 0;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useM03InteractionStore = create<M03InteractionState>((set, get) => ({
  pinnedPoints: [],
  pinnedIntersections: [],

  togglePinnedPoint({ mathX, mathY, entityId }) {
    const existing = get().pinnedPoints;
    const idx = existing.findIndex(
      (p) => p.entityId === entityId && Math.abs(p.mathX - mathX) < 1e-4 && Math.abs(p.mathY - mathY) < 1e-4,
    );
    if (idx !== -1) {
      set({ pinnedPoints: existing.filter((_, i) => i !== idx) });
    } else {
      _pinCounter += 1;
      const id = `${entityId}@${mathX.toFixed(6)},${mathY.toFixed(6)}`;
      const label = `C${_pinCounter}`;
      set({ pinnedPoints: [...existing, { id, mathX, mathY, entityId, label }] });
    }
  },

  togglePinnedIntersection({ mathX, mathY, lineId, conicId }) {
    const existing = get().pinnedIntersections;
    const idx = existing.findIndex(
      (p) => Math.abs(p.mathX - mathX) < 1e-4 && Math.abs(p.mathY - mathY) < 1e-4,
    );
    if (idx !== -1) {
      set({ pinnedIntersections: existing.filter((_, i) => i !== idx) });
    } else {
      _xsectCounter += 1;
      const id = `${lineId}|${conicId}@${mathX.toFixed(6)},${mathY.toFixed(6)}`;
      const label = `X${_xsectCounter}`;
      set({ pinnedIntersections: [...existing, { id, mathX, mathY, lineId, conicId, label }] });
    }
  },

  clearAll() {
    _pinCounter = 0;
    _xsectCounter = 0;
    set({ pinnedPoints: [], pinnedIntersections: [] });
  },

  getSnapshot() {
    return {
      pinnedPoints: structuredClone(get().pinnedPoints),
      pinnedIntersections: structuredClone(get().pinnedIntersections),
    };
  },

  loadSnapshot(snapshot) {
    const pinnedPoints = snapshot?.pinnedPoints ? structuredClone(snapshot.pinnedPoints) : [];
    const pinnedIntersections = snapshot?.pinnedIntersections ? structuredClone(snapshot.pinnedIntersections) : [];
    _pinCounter = pinnedPoints.length;
    _xsectCounter = pinnedIntersections.length;
    set({ pinnedPoints, pinnedIntersections });
  },
}));
