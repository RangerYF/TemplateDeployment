import { create } from 'zustand'

interface ViewportState {
  offset: { x: number; y: number }
  scale: number // pixels per meter, default 50 (1m = 50px)
  canvasSize: { width: number; height: number }
}

interface ViewportActions {
  pan: (dx: number, dy: number) => void
  zoom: (newScale: number, centerX: number, centerY: number) => void
  resetView: () => void
  setCanvasSize: (width: number, height: number) => void
  setViewSnapshot: (view: { offset: { x: number; y: number }; scale: number }) => void
}

const DEFAULT_SCALE = 50
export const DEFAULT_VIEWPORT_SNAPSHOT = {
  offset: { x: 0, y: 100 },
  scale: DEFAULT_SCALE,
}

export const useViewportStore = create<ViewportState & ViewportActions>()(
  (set) => ({
    offset: { ...DEFAULT_VIEWPORT_SNAPSHOT.offset },
    scale: DEFAULT_VIEWPORT_SNAPSHOT.scale,
    canvasSize: { width: 800, height: 600 },

    pan: (dx, dy) =>
      set((state) => ({
        offset: {
          x: state.offset.x + dx,
          y: state.offset.y + dy,
        },
      })),

    zoom: (newScale, centerX, centerY) =>
      set((state) => {
        const clampedScale = Math.min(200, Math.max(10, newScale))
        const { width, height } = state.canvasSize
        const worldX = (centerX - width / 2 - state.offset.x) / state.scale
        const worldY = (height - centerY - state.offset.y) / state.scale
        return {
          scale: clampedScale,
          offset: {
            x: centerX - width / 2 - worldX * clampedScale,
            y: height - centerY - worldY * clampedScale,
          },
        }
      }),

    resetView: () =>
      set({
        offset: { ...DEFAULT_VIEWPORT_SNAPSHOT.offset },
        scale: DEFAULT_VIEWPORT_SNAPSHOT.scale,
      }),

    setCanvasSize: (width, height) =>
      set({ canvasSize: { width, height } }),

    setViewSnapshot: (view) =>
      set({
        offset: { ...view.offset },
        scale: view.scale,
      }),
  }),
)
