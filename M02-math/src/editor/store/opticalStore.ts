import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Photon {
  x: number;
  y: number;
  /** Progress along the ray path [0, 1]. */
  t: number;
  /** Which segment: 0 = incoming, 1 = reflected */
  segment: 0 | 1;
  /** Ray index for color/identification */
  rayIndex: number;
}

interface OpticalState {
  /** Whether the "Light Beam" mode is enabled. */
  enabled: boolean;
  /** Number of rays to show. */
  rayCount: number;
  /** Whether photon animation is running. */
  isAnimating: boolean;
  /** Current photon positions (updated every frame). */
  photons: Photon[];
  /** Render tick for throttled static redraws. */
  renderTick: number;

  setEnabled: (v: boolean) => void;
  setRayCount: (n: number) => void;
  setAnimating: (v: boolean) => void;
  setPhotons: (photons: Photon[]) => void;
  incrementRenderTick: () => void;
  reset: () => void;
  getSnapshot: () => OpticalStoreSnapshot;
  loadSnapshot: (snapshot?: Partial<OpticalStoreSnapshot>) => void;
}

export interface OpticalStoreSnapshot {
  enabled: boolean;
  rayCount: number;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useOpticalStore = create<OpticalState>((set, get) => ({
  enabled: false,
  rayCount: 8,
  isAnimating: false,
  photons: [],
  renderTick: 0,

  setEnabled(v) {
    set({ enabled: v });
    if (!v) {
      set({ isAnimating: false, photons: [] });
    }
  },

  setRayCount(n) {
    set({ rayCount: n });
  },

  setAnimating(v) {
    set({ isAnimating: v });
  },

  setPhotons(photons) {
    set({ photons });
  },

  incrementRenderTick() {
    set({ renderTick: get().renderTick + 1 });
  },

  reset() {
    set({ enabled: false, isAnimating: false, photons: [], renderTick: 0 });
  },

  getSnapshot() {
    const state = get();
    return {
      enabled: state.enabled,
      rayCount: state.rayCount,
    };
  },

  loadSnapshot(snapshot) {
    set({
      enabled: typeof snapshot?.enabled === 'boolean' ? snapshot.enabled : false,
      rayCount: typeof snapshot?.rayCount === 'number' ? snapshot.rayCount : 8,
      isAnimating: false,
      photons: [],
      renderTick: 0,
    });
  },
}));
