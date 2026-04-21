/**
 * syncLineStore — M04 Phase 2
 *
 * Lightweight store holding the y-position of the cross-canvas
 * horizontal synchronisation line (drawn as an SVG overlay in M04Layout).
 *
 * Phase 1: store is created but unused until Phase 2 adds FunctionGraphCanvas.
 */

import { create } from 'zustand';

interface SyncLineState {
  /** y-coordinate (px, layout-container coordinate system) of the sync line.
   *  null = do not draw the line. */
  syncY: number | null;

  setSyncY: (y: number | null) => void;
}

export const useSyncLineStore = create<SyncLineState>((set) => ({
  syncY:    null,
  setSyncY: (y) => set({ syncY: y }),
}));
