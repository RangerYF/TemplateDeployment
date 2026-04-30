import { create } from 'zustand';

export interface ViewportSnapshot {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface LayoutSnapshot {
  leftWidth: number;
  rightWidth: number;
}

export interface UISnapshot {
  layout: LayoutSnapshot;
  viewport: ViewportSnapshot;
}

interface UIState extends UISnapshot {
  setLayoutWidths: (layout: Partial<LayoutSnapshot>) => void;
  setViewport: (updater: ViewportSnapshot | ((current: ViewportSnapshot) => ViewportSnapshot)) => void;
  getSnapshot: () => UISnapshot;
  loadSnapshot: (snapshot?: Partial<UISnapshot>) => void;
}

const DEFAULT_UI_SNAPSHOT: UISnapshot = {
  layout: {
    leftWidth: 232,
    rightWidth: 312,
  },
  viewport: {
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  },
};

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeLayout(snapshot?: Partial<LayoutSnapshot>): LayoutSnapshot {
  return {
    leftWidth: clamp(sanitizeNumber(snapshot?.leftWidth, DEFAULT_UI_SNAPSHOT.layout.leftWidth), 196, 340),
    rightWidth: clamp(sanitizeNumber(snapshot?.rightWidth, DEFAULT_UI_SNAPSHOT.layout.rightWidth), 280, 460),
  };
}

function sanitizeViewport(snapshot?: Partial<ViewportSnapshot>): ViewportSnapshot {
  return {
    offsetX: clamp(sanitizeNumber(snapshot?.offsetX, DEFAULT_UI_SNAPSHOT.viewport.offsetX), -1200, 1200),
    offsetY: clamp(sanitizeNumber(snapshot?.offsetY, DEFAULT_UI_SNAPSHOT.viewport.offsetY), -1200, 1200),
    zoom: clamp(sanitizeNumber(snapshot?.zoom, DEFAULT_UI_SNAPSHOT.viewport.zoom), 0.55, 2.4),
  };
}

export function getDefaultUISnapshot(): UISnapshot {
  return cloneSnapshot(DEFAULT_UI_SNAPSHOT);
}

export const useUIStore = create<UIState>((set, get) => ({
  ...getDefaultUISnapshot(),

  setLayoutWidths: (layout) => set((state) => ({
    layout: sanitizeLayout({ ...state.layout, ...layout }),
  })),

  setViewport: (updater) => set((state) => {
    const nextViewport = typeof updater === 'function' ? updater(state.viewport) : updater;
    return { viewport: sanitizeViewport(nextViewport) };
  }),

  getSnapshot: () => {
    const state = get();
    return cloneSnapshot({
      layout: state.layout,
      viewport: state.viewport,
    });
  },

  loadSnapshot: (snapshot) => set({
    layout: sanitizeLayout(snapshot?.layout),
    viewport: sanitizeViewport(snapshot?.viewport),
  }),
}));
