import { create } from 'zustand'

export type EditorMode = 'edit' | 'simulate'
export type SimState = 'stopped' | 'playing' | 'paused'
export type CoordinateAxisMode = 'off' | 'horizontal' | 'vertical' | 'both'

interface Gravity {
  x: number
  y: number
}

export interface CoordinateAxesConfig {
  mode: CoordinateAxisMode
  originType: 'world' | 'anchored'
  origin: { x: number; y: number }
  originLabel?: string
  showTicks: boolean
  showDisplacementLabels: boolean
}

interface EditorState {
  mode: EditorMode
  simState: SimState
  gravity: Gravity
  coordinateAxes: CoordinateAxesConfig
}

interface EditorActions {
  play: () => void
  pause: () => void
  stop: () => void
  stopAtCurrent: () => void
  setGravity: (gravity: Gravity) => void
  setCoordinateAxisMode: (mode: CoordinateAxisMode) => void
  setCoordinateAxes: (config: CoordinateAxesConfig) => void
  anchorCoordinateAxesToWorld: () => void
  anchorCoordinateAxesToPoint: (origin: { x: number; y: number }, label?: string) => void
  toggleCoordinateTicks: () => void
  toggleDisplacementLabels: () => void
  resetCoordinateAxes: () => void
}

export const DEFAULT_COORDINATE_AXES: CoordinateAxesConfig = {
  mode: 'off',
  originType: 'world',
  origin: { x: 0, y: 0 },
  originLabel: '世界原点',
  showTicks: true,
  showDisplacementLabels: true,
}

export const useEditorStore = create<EditorState & EditorActions>()((set) => ({
  mode: 'edit',
  simState: 'stopped',
  gravity: { x: 0, y: -10 },
  coordinateAxes: DEFAULT_COORDINATE_AXES,

  play: () =>
    set({ mode: 'simulate', simState: 'playing' }),

  pause: () =>
    set({ simState: 'paused' }),

  stop: () =>
    set({ mode: 'edit', simState: 'stopped' }),

  stopAtCurrent: () =>
    set({ mode: 'simulate', simState: 'stopped' }),

  setGravity: (gravity) =>
    set({ gravity }),

  setCoordinateAxisMode: (mode) =>
    set((state) => ({
      coordinateAxes: {
        ...state.coordinateAxes,
        mode,
      },
    })),

  setCoordinateAxes: (config) =>
    set({
      coordinateAxes: {
        ...config,
        origin: { ...config.origin },
      },
    }),

  anchorCoordinateAxesToWorld: () =>
    set((state) => ({
      coordinateAxes: {
        ...state.coordinateAxes,
        originType: 'world',
        origin: { x: 0, y: 0 },
        originLabel: '世界原点',
      },
    })),

  anchorCoordinateAxesToPoint: (origin, label) =>
    set((state) => ({
      coordinateAxes: {
        ...state.coordinateAxes,
        originType: 'anchored',
        origin: { ...origin },
        originLabel: label,
      },
    })),

  toggleCoordinateTicks: () =>
    set((state) => ({
      coordinateAxes: {
        ...state.coordinateAxes,
        showTicks: !state.coordinateAxes.showTicks,
      },
    })),

  toggleDisplacementLabels: () =>
    set((state) => ({
      coordinateAxes: {
        ...state.coordinateAxes,
        showDisplacementLabels: !state.coordinateAxes.showDisplacementLabels,
      },
    })),

  resetCoordinateAxes: () =>
    set({ coordinateAxes: DEFAULT_COORDINATE_AXES }),
}))
