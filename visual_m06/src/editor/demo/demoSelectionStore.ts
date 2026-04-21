import { create } from 'zustand';

interface DemoSelectionStoreState {
  selectedId: string | null;
  hoveredId: string | null;

  select(id: string | null): void;
  setHovered(id: string | null): void;
  clear(): void;
}

export const useDemoSelectionStore = create<DemoSelectionStoreState>()((set) => ({
  selectedId: null,
  hoveredId: null,

  select(id) {
    set({ selectedId: id });
  },

  setHovered(id) {
    set({ hoveredId: id });
  },

  clear() {
    set({ selectedId: null, hoveredId: null });
  },
}));
