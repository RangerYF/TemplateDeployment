import { create } from 'zustand';

export interface UISnapshot {
  scenarioPanelOpen: boolean;
  paramPanelOpen: boolean;
  showTeachingPoints: boolean;
  showCoordLabels: boolean;
}

interface UIStoreState {
  /** 左侧场景库面板是否展开 */
  scenarioPanelOpen: boolean;
  /** 右侧参数面板是否展开 */
  paramPanelOpen: boolean;
  /** 是否显示教学要点 */
  showTeachingPoints: boolean;
  /** 是否显示坐标标注 */
  showCoordLabels: boolean;

  toggleScenarioPanel(): void;
  toggleParamPanel(): void;
  toggleTeachingPoints(): void;
  toggleCoordLabels(): void;
  getSnapshot(): UISnapshot;
  loadSnapshot(snapshot?: Partial<UISnapshot>): void;
}

export const useUIStore = create<UIStoreState>()((set) => ({
  scenarioPanelOpen: true,
  paramPanelOpen: true,
  showTeachingPoints: true,
  showCoordLabels: true,

  toggleScenarioPanel() {
    set((s) => ({ scenarioPanelOpen: !s.scenarioPanelOpen }));
  },
  toggleParamPanel() {
    set((s) => ({ paramPanelOpen: !s.paramPanelOpen }));
  },
  toggleTeachingPoints() {
    set((s) => ({ showTeachingPoints: !s.showTeachingPoints }));
  },
  toggleCoordLabels() {
    set((s) => ({ showCoordLabels: !s.showCoordLabels }));
  },

  getSnapshot(): UISnapshot {
    const state: UIStoreState = useUIStore.getState();
    return {
      scenarioPanelOpen: state.scenarioPanelOpen,
      paramPanelOpen: state.paramPanelOpen,
      showTeachingPoints: state.showTeachingPoints,
      showCoordLabels: state.showCoordLabels,
    };
  },

  loadSnapshot(snapshot?: Partial<UISnapshot>) {
    set({
      scenarioPanelOpen: snapshot?.scenarioPanelOpen ?? true,
      paramPanelOpen: snapshot?.paramPanelOpen ?? true,
      showTeachingPoints: snapshot?.showTeachingPoints ?? true,
      showCoordLabels: snapshot?.showCoordLabels ?? true,
    });
  },
}));
