/**
 * UI 状态管理
 * 显示模式、标注状态、面板状态
 */

import { create } from 'zustand';

export type DisplayMode =
  | 'ball-and-stick'    // 球棍模型 (3D)
  | 'space-filling'     // 空间填充 (3D)
  | 'electron-cloud'    // 电子云模型 (3D)
  | 'structural'        // 结构简式 (2D)
  | 'electron-formula'  // 电子式 (2D)
  | 'skeletal';         // 键线式 (2D)

/** 判断是否为 2D 模式 */
export function is2DMode(mode: DisplayMode): boolean {
  return mode === 'structural' || mode === 'electron-formula' || mode === 'skeletal';
}

export interface UISnapshot {
  displayMode: DisplayMode;
  showLabels: boolean;
  showBondLengths: boolean;
  showLonePairs: boolean;
  showVseprOverlay: boolean;
  autoRotate: boolean;
  panelCollapsed: Record<string, boolean>;
}

interface UIState {
  displayMode: DisplayMode;
  showLabels: boolean;          // 显示原子标签
  showBondLengths: boolean;     // 显示键长
  showLonePairs: boolean;       // 显示孤电子对
  showVseprOverlay: boolean;    // 显示 VSEPR 电子域构型
  autoRotate: boolean;          // 自动旋转

  // 面板折叠状态
  panelCollapsed: Record<string, boolean>;

  // 双击弹窗状态
  popupAtomIndex: number | null;
  popupBondIndex: number | null;

  // Actions
  setDisplayMode: (mode: DisplayMode) => void;
  toggleLabels: () => void;
  toggleBondLengths: () => void;
  toggleLonePairs: () => void;
  toggleVseprOverlay: () => void;
  toggleAutoRotate: () => void;
  togglePanel: (panelId: string) => void;
  setPopupAtom: (index: number | null) => void;
  setPopupBond: (index: number | null) => void;
  getSnapshot: () => UISnapshot;
  loadSnapshot: (snapshot?: Partial<UISnapshot>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  displayMode: 'ball-and-stick',
  showLabels: true,
  showBondLengths: false,
  showLonePairs: false,
  showVseprOverlay: false,
  autoRotate: false,

  panelCollapsed: {},

  popupAtomIndex: null,
  popupBondIndex: null,

  setDisplayMode: (mode) => set({ displayMode: mode, popupAtomIndex: null, popupBondIndex: null }),
  toggleLabels: () => set(s => ({ showLabels: !s.showLabels })),
  toggleBondLengths: () => set(s => ({ showBondLengths: !s.showBondLengths })),
  toggleLonePairs: () => set(s => ({ showLonePairs: !s.showLonePairs })),
  toggleVseprOverlay: () => set(s => ({ showVseprOverlay: !s.showVseprOverlay })),
  toggleAutoRotate: () => set(s => ({ autoRotate: !s.autoRotate })),
  togglePanel: (panelId) => set(s => ({
    panelCollapsed: { ...s.panelCollapsed, [panelId]: !s.panelCollapsed[panelId] },
  })),
  setPopupAtom: (index) => set({ popupAtomIndex: index, popupBondIndex: null }),
  setPopupBond: (index) => set({ popupBondIndex: index, popupAtomIndex: null }),
  getSnapshot: (): UISnapshot => {
    const state: UIState = useUIStore.getState();
    return {
      displayMode: state.displayMode,
      showLabels: state.showLabels,
      showBondLengths: state.showBondLengths,
      showLonePairs: state.showLonePairs,
      showVseprOverlay: state.showVseprOverlay,
      autoRotate: state.autoRotate,
      panelCollapsed: { ...state.panelCollapsed },
    };
  },
  loadSnapshot: (snapshot?: Partial<UISnapshot>) => set({
    displayMode: snapshot?.displayMode ?? 'ball-and-stick',
    showLabels: snapshot?.showLabels ?? true,
    showBondLengths: snapshot?.showBondLengths ?? false,
    showLonePairs: snapshot?.showLonePairs ?? false,
    showVseprOverlay: snapshot?.showVseprOverlay ?? false,
    autoRotate: snapshot?.autoRotate ?? false,
    panelCollapsed: snapshot?.panelCollapsed ? { ...snapshot.panelCollapsed } : {},
    popupAtomIndex: null,
    popupBondIndex: null,
  }),
}));
