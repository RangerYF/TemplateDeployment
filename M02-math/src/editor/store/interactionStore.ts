import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * The snapped hover point on a function curve.
 * Updated on every pointermove; NEVER written to historyStore.
 */
export interface HoveredPoint {
  /** Math-coordinate position on the curve */
  readonly mathX: number;
  readonly mathY: number;
  /** Canvas-pixel position (pre-computed for the renderer) */
  readonly canvasX: number;
  readonly canvasY: number;
  /** Which function this point belongs to */
  readonly functionId: string;
  /** Slope f'(x) at this point — used for tangent overlay in Phase 6 */
  readonly slope: number | null;
  /** false while the mouse is not near any curve */
  readonly isVisible: boolean;
}

/**
 * A click-pinned marker point on a curve.
 * Persists until clicked again or cleared.
 */
export interface PinnedPoint {
  /** Stable ID = "fnId@mathX.toFixed(6)" */
  readonly id: string;
  readonly mathX: number;
  readonly mathY: number;
  readonly functionId: string;
  /** Sequential label: P1, P2, … */
  readonly label: string;
}

/**
 * The intersection point currently under the cursor.
 * Cleared on drag; higher priority than HoveredPoint in click handling.
 */
export interface IntersectionHover {
  readonly mathX: number;
  readonly mathY: number;
  /** Canvas-pixel position for the renderer */
  readonly canvasX: number;
  readonly canvasY: number;
  /** IDs of the two intersecting functions */
  readonly fnId1: string;
  readonly fnId2: string;
}

/**
 * A click-pinned intersection marker.
 * Labeled X1, X2, … to distinguish from curve pins (P1, P2, …).
 */
export interface PinnedIntersection {
  readonly id: string;
  readonly mathX: number;
  readonly mathY: number;
  readonly fnId1: string;
  readonly fnId2: string;
  readonly label: string;
}

interface InteractionState {
  hoveredPoint:        HoveredPoint | null;
  hoveredIntersection: IntersectionHover | null;
  pinnedPoints:        PinnedPoint[];
  pinnedIntersections: PinnedIntersection[];

  setHoveredPoint:        (point: HoveredPoint | null) => void;
  setHoveredIntersection: (pt: IntersectionHover | null) => void;

  /**
   * Toggle a pinned point at (mathX, mathY) on the given function.
   * If a pin already exists within 1e-4 of mathX on the same function,
   * it is removed; otherwise a new pin is added.
   */
  togglePinnedPoint: (pt: { mathX: number; mathY: number; functionId: string }) => void;

  /**
   * Toggle a pinned intersection marker.
   * Matched by proximity (|Δx| < 1e-4) regardless of which fn pair.
   */
  togglePinnedIntersection: (pt: { mathX: number; mathY: number; fnId1: string; fnId2: string }) => void;

  clearPinnedPoints: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _pinCounter    = 0;
let _xsectCounter  = 0;

function makeId(fnId: string, mathX: number): string {
  return `${fnId}@${mathX.toFixed(6)}`;
}
function makeXsectId(fnId1: string, fnId2: string, mathX: number): string {
  return `${fnId1}|${fnId2}@${mathX.toFixed(6)}`;
}

// ─── Store ───────────────────────────────────────────────────────────────────

/**
 * Lightweight store for transient mouse-interaction state.
 *
 * Intentionally isolated from historyStore — mutations here never create
 * Undo entries and never cause the static canvas to re-render.
 * The dynamic canvas reads this store inside a requestAnimationFrame loop.
 */
export const useInteractionStore = create<InteractionState>((set, get) => ({
  hoveredPoint:        null,
  hoveredIntersection: null,
  pinnedPoints:        [],
  pinnedIntersections: [],

  setHoveredPoint(point) {
    set({ hoveredPoint: point });
  },

  setHoveredIntersection(pt) {
    set({ hoveredIntersection: pt });
  },

  togglePinnedPoint({ mathX, mathY, functionId }) {
    const existing = get().pinnedPoints;
    const id = makeId(functionId, mathX);

    // Check if pin already exists near this x on the same function
    const idx = existing.findIndex(
      (p) => p.functionId === functionId && Math.abs(p.mathX - mathX) < 1e-4,
    );
    if (idx !== -1) {
      // Remove the pin
      set({ pinnedPoints: existing.filter((_, i) => i !== idx) });
    } else {
      // Add a new pin with a sequential label
      _pinCounter += 1;
      const label = `P${_pinCounter}`;
      set({ pinnedPoints: [...existing, { id, mathX, mathY, functionId, label }] });
    }
  },

  togglePinnedIntersection({ mathX, mathY, fnId1, fnId2 }) {
    const existing = get().pinnedIntersections;
    const id = makeXsectId(fnId1, fnId2, mathX);

    const idx = existing.findIndex((p) => Math.abs(p.mathX - mathX) < 1e-4);
    if (idx !== -1) {
      set({ pinnedIntersections: existing.filter((_, i) => i !== idx) });
    } else {
      _xsectCounter += 1;
      const label = `X${_xsectCounter}`;
      set({
        pinnedIntersections: [
          ...existing,
          { id, mathX, mathY, fnId1, fnId2, label },
        ],
      });
    }
  },

  clearPinnedPoints() {
    _pinCounter   = 0;
    _xsectCounter = 0;
    set({ pinnedPoints: [], pinnedIntersections: [] });
  },
}));
