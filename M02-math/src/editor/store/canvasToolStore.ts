import { create } from 'zustand';

export type CanvasMode =
  | 'pan-zoom'
  | 'select'
  | 'pin-point';

interface CanvasToolState {
  mode: CanvasMode;
  setMode: (mode: CanvasMode) => void;
}

export const useCanvasToolStore = create<CanvasToolState>((set) => ({
  mode: 'pan-zoom',
  setMode(mode) { set({ mode }); },
}));
