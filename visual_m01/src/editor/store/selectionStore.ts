import { create } from 'zustand';
import { signals } from '../signals';

interface SelectionStoreState {
  selectedIds: string[];
  primaryId: string | null;
  hoveredId: string | null;

  select(entityId: string): void;
  addToSelection(entityId: string): void;
  deselect(entityId: string): void;
  clear(): void;
  toggle(entityId: string): void;
  setHovered(entityId: string | null): void;
}

export const useSelectionStore = create<SelectionStoreState>()((set, get) => ({
  selectedIds: [],
  primaryId: null,
  hoveredId: null,

  select(entityId: string): void {
    set({ selectedIds: [entityId], primaryId: entityId });
    signals.selectionChanged.emit({ selectedIds: [entityId], primaryId: entityId });
  },

  addToSelection(entityId: string): void {
    const state = get();
    if (state.selectedIds.includes(entityId)) return;
    const newIds = [...state.selectedIds, entityId];
    set({ selectedIds: newIds, primaryId: entityId });
    signals.selectionChanged.emit({ selectedIds: newIds, primaryId: entityId });
  },

  deselect(entityId: string): void {
    const state = get();
    const newIds = state.selectedIds.filter((id) => id !== entityId);
    const newPrimary = newIds.length > 0 ? newIds[newIds.length - 1] : null;
    set({ selectedIds: newIds, primaryId: newPrimary });
    signals.selectionChanged.emit({ selectedIds: newIds, primaryId: newPrimary });
  },

  clear(): void {
    set({ selectedIds: [], primaryId: null });
    signals.selectionChanged.emit({ selectedIds: [], primaryId: null });
  },

  toggle(entityId: string): void {
    const state = get();
    if (state.selectedIds.includes(entityId)) {
      state.deselect(entityId);
    } else {
      state.select(entityId);
    }
  },

  setHovered(entityId: string | null): void {
    if (get().hoveredId === entityId) return;
    set({ hoveredId: entityId });
  },
}));
