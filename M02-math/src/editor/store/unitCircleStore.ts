/**
 * unitCircleStore — M04 Phase 1
 *
 * Manages the state of the interactive unit circle:
 *  - Current angle (with snap state and exact values)
 *  - Display toggles (projections, angle arc, labels, quadrant hints)
 *  - Independent Viewport for the unit-circle canvas
 *
 * Cross-store push: setAngle() directly calls useM04FunctionStore.setTraceX(rad)
 * to keep the function-graph trace point in sync (single-direction, no subscribe).
 */

import { create } from 'zustand';
import type { ViewportState, SpecialAngleValues } from '@/types';
import { useM04FunctionStore } from '@/editor/store/m04FunctionStore';

export const DEFAULT_UNIT_CIRCLE_VIEWPORT: ViewportState = {
  xMin: -1.8,
  xMax:  1.8,
  yMin: -1.8,
  yMax:  1.8,
};

// ─── State shape ─────────────────────────────────────────────────────────────

interface UnitCircleState {
  /** Current angle in radians, normalized to [0, 2π). */
  angleRad:     number;
  /** True when the angle is snapped to a special value. */
  isSnapped:    boolean;
  /** Exact trig values when snapped; null when not snapped or snap disabled. */
  snappedValues: SpecialAngleValues | null;

  /** Whether snap-to-special-angle is enabled. */
  snapEnabled:  boolean;
  /** True during pointer drag — used to style the canvas cursor. */
  isDragging:   boolean;

  // ── Display toggles ─────────────────────────────────────────────────────
  showProjections:   boolean;
  showAngleArc:      boolean;
  showLabels:        boolean;
  showQuadrantHints: boolean;

  /** Viewport for the unit-circle canvas (independent from function graph). */
  viewport: ViewportState;

  // ── Actions ──────────────────────────────────────────────────────────────
  setAngle: (rad: number, snapped: boolean, values: SpecialAngleValues | null) => void;
  setDragging:    (v: boolean) => void;
  setSnapEnabled: (v: boolean) => void;
  setDisplayOption: <K extends keyof Pick<UnitCircleState,
    'showProjections' | 'showAngleArc' | 'showLabels' | 'showQuadrantHints'>>(
    key: K, value: boolean
  ) => void;
  setViewport: (vp: ViewportState) => void;
  getSnapshot: () => UnitCircleStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<UnitCircleStoreSnapshot>) => void;
}

export interface UnitCircleStoreSnapshot {
  angleRad: number;
  isSnapped: boolean;
  snappedValues: SpecialAngleValues | null;
  snapEnabled: boolean;
  showProjections: boolean;
  showAngleArc: boolean;
  showLabels: boolean;
  showQuadrantHints: boolean;
  viewport: ViewportState;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUnitCircleStore = create<UnitCircleState>((set, get) => ({
  angleRad:      0,
  isSnapped:     true,
  snappedValues: null,

  snapEnabled:  true,
  isDragging:   false,

  showProjections:   true,
  showAngleArc:      true,
  showLabels:        true,
  showQuadrantHints: false,

  viewport: { ...DEFAULT_UNIT_CIRCLE_VIEWPORT },

  setAngle: (rad, snapped, values) => {
    set({ angleRad: rad, isSnapped: snapped, snappedValues: values });
    // Cross-store push: keep function graph trace point in sync
    useM04FunctionStore.getState().setTraceX(rad);
  },

  setDragging:    (v) => set({ isDragging: v }),
  setSnapEnabled: (v) => set({ snapEnabled: v }),

  setDisplayOption: (key, value) => set({ [key]: value }),

  setViewport: (vp) => set({ viewport: vp }),

  getSnapshot: () => {
    const state = get();
    return {
      angleRad: state.angleRad,
      isSnapped: state.isSnapped,
      snappedValues: state.snappedValues ? structuredClone(state.snappedValues) : null,
      snapEnabled: state.snapEnabled,
      showProjections: state.showProjections,
      showAngleArc: state.showAngleArc,
      showLabels: state.showLabels,
      showQuadrantHints: state.showQuadrantHints,
      viewport: structuredClone(state.viewport),
    };
  },

  loadSnapshot: (snapshot) => {
    const angleRad = typeof snapshot?.angleRad === 'number' ? snapshot.angleRad : 0;
    set({
      angleRad,
      isSnapped: typeof snapshot?.isSnapped === 'boolean' ? snapshot.isSnapped : true,
      snappedValues: snapshot?.snappedValues ? structuredClone(snapshot.snappedValues) : null,
      snapEnabled: typeof snapshot?.snapEnabled === 'boolean' ? snapshot.snapEnabled : true,
      isDragging: false,
      showProjections: typeof snapshot?.showProjections === 'boolean' ? snapshot.showProjections : true,
      showAngleArc: typeof snapshot?.showAngleArc === 'boolean' ? snapshot.showAngleArc : true,
      showLabels: typeof snapshot?.showLabels === 'boolean' ? snapshot.showLabels : true,
      showQuadrantHints: typeof snapshot?.showQuadrantHints === 'boolean' ? snapshot.showQuadrantHints : false,
      viewport: snapshot?.viewport ? structuredClone(snapshot.viewport) : { ...DEFAULT_UNIT_CIRCLE_VIEWPORT },
    });
    useM04FunctionStore.getState().setTraceX(angleRad);
  },
}));
