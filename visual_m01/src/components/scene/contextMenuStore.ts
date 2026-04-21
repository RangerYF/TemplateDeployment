import { create } from 'zustand';

export interface ContextMenuState {
  screenPosition: { x: number; y: number };
  targetEntityId: string;
  targetEntityType: 'segment' | 'point' | 'face';
  /** 命中点在线段上的 t 参数（仅 segment） */
  hitT?: number;
  /** 命中点的 3D 坐标（仅 face，用于面上取点） */
  hitPoint?: [number, number, number];
}

interface ContextMenuStoreState {
  menu: ContextMenuState | null;
  openMenu(menu: ContextMenuState): void;
  closeMenu(): void;
}

export const useContextMenuStore = create<ContextMenuStoreState>()((set) => ({
  menu: null,
  openMenu(menu: ContextMenuState) {
    set({ menu });
  },
  closeMenu() {
    set({ menu: null });
  },
}));
