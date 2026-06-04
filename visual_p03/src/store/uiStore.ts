import { create } from 'zustand';

export interface ViewportSnapshot {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export type RenderMode = '2d' | '3d';

export interface UISnapshot {
  viewport: ViewportSnapshot;
  renderMode: RenderMode;
}

interface UIState extends UISnapshot {
  setViewport: (updater: ViewportSnapshot | ((current: ViewportSnapshot) => ViewportSnapshot)) => void;
  setRenderMode: (mode: RenderMode) => void;
  getSnapshot: () => UISnapshot;
  loadSnapshot: (snapshot?: Partial<UISnapshot>) => void;
}

const DEFAULT_VIEWPORT: ViewportSnapshot = { offsetX: 0, offsetY: 0, zoom: 1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeViewport(snapshot?: Partial<ViewportSnapshot>): ViewportSnapshot {
  return {
    offsetX: clamp(sanitizeNumber(snapshot?.offsetX, 0), -2000, 2000),
    offsetY: clamp(sanitizeNumber(snapshot?.offsetY, 0), -2000, 2000),
    zoom: clamp(sanitizeNumber(snapshot?.zoom, 1), 0.3, 5.0),
  };
}

export function getDefaultUISnapshot(): UISnapshot {
  return { viewport: { ...DEFAULT_VIEWPORT }, renderMode: '2d' };
}

export const useUIStore = create<UIState>((set, get) => ({
  viewport: { ...DEFAULT_VIEWPORT },
  renderMode: '2d' as RenderMode,

  setViewport: (updater) => set((state) => {
    const nextViewport = typeof updater === 'function' ? updater(state.viewport) : updater;
    return { viewport: sanitizeViewport(nextViewport) };
  }),

  setRenderMode: (mode) => set({ renderMode: mode }),

  getSnapshot: () => ({ viewport: { ...get().viewport }, renderMode: get().renderMode }),

  loadSnapshot: (snapshot) => set({
    viewport: sanitizeViewport(snapshot?.viewport),
    renderMode: snapshot?.renderMode ?? '2d',
  }),
}));
