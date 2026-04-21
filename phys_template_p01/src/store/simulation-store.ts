import { create } from 'zustand';
import type {
  EntityId,
  InfoDensity,
  ParamValues,
  PhysicsResult,
  Selection,
  SimulationState,
  SimulationStatus,
  ViewportState,
  ViewportType,
} from '@/core/types';

// ─── Store State ───

export interface SimulationStoreState {
  /** 当前模拟状态 */
  simulationState: SimulationState;

  /** 当前参数值 */
  paramValues: ParamValues;

  /** 统一选中目标（替代 selectedEntityId） */
  selection: Selection | null;

  /** hover 目标 */
  hoveredTarget: Selection | null;

  /** 当前视角状态 */
  viewportState: ViewportState;

  /** 当前预设支持的视角列表 */
  supportedViewports: ViewportType[];
}

/** 从 Selection 中提取 entityId（向后兼容） */
function extractEntityId(selection: Selection | null): EntityId | null {
  if (!selection) return null;
  if (selection.type === 'entity') {
    return (selection.data as { entityId: EntityId }).entityId;
  }
  // force-arrow 等域类型也可能携带 entityId
  const data = selection.data as { entityId?: EntityId };
  return data?.entityId ?? null;
}

// ─── Store Actions ───

export interface SimulationStoreActions {
  /** 更新参数值 */
  updateParam: (key: string, value: number | boolean | string) => void;

  /** 统一选中 */
  select: (target: Selection | null) => void;

  /** 设置 hover 目标 */
  setHovered: (target: Selection | null) => void;

  /** 向后兼容：选中实体 */
  selectEntity: (id: EntityId | null) => void;

  /** 向后兼容 getter：从 selection 派生 selectedEntityId */
  readonly selectedEntityId: EntityId | null;

  /** 播放 */
  play: () => void;

  /** 暂停 */
  pause: () => void;

  /** 重置 */
  reset: () => void;

  /** 切换主视角（清空叠加层+重置密度） */
  switchPrimaryViewport: (type: ViewportType) => void;

  /** 切换叠加视角 */
  toggleOverlayViewport: (type: ViewportType) => void;

  /** 设置信息密度 */
  setInfoDensity: (density: InfoDensity) => void;

  /** 更新模拟状态（引擎调用） */
  setSimulationState: (state: Partial<SimulationState>) => void;

  /** 更新当前求解结果（引擎调用） */
  setCurrentResult: (result: PhysicsResult | null) => void;

  /** 设置模拟状态 */
  setStatus: (status: SimulationStatus) => void;

  /** 加载预设后初始化 store（由 PresetLoader 调用） */
  initFromPreset: (init: {
    simulationState: SimulationState;
    paramValues: ParamValues;
    viewportState: ViewportState;
    supportedViewports?: ViewportType[];
  }) => void;
}

// ─── 初始状态 ───

const initialViewportState: ViewportState = {
  primary: 'force',
  overlays: [],
  density: 'standard',
};

const initialSimulationState: SimulationState = {
  status: 'idle',
  solveMode: 'analytical',
  integrator: 'semi-implicit-euler',
  timeline: {
    currentTime: 0,
    duration: 5,
    playbackRate: 1,
    dt: 1 / 60,
  },
  scene: {
    entities: new Map(),
    relations: [],
    paramGroups: [],
    paramValues: {},
  },
  currentResult: null,
  resultHistory: [],
};

// ─── Store 创建 ───

export const useSimulationStore = create<
  SimulationStoreState & SimulationStoreActions
>((set) => ({
  // ─── 初始状态 ───
  simulationState: initialSimulationState,
  paramValues: {},
  selection: null,
  hoveredTarget: null,
  viewportState: initialViewportState,
  supportedViewports: ['force'],

  // 向后兼容 getter
  get selectedEntityId(): EntityId | null {
    return extractEntityId(this.selection);
  },

  // ─── Actions ───

  updateParam: (key, value) =>
    set((state) => {
      const newParamValues = { ...state.paramValues, [key]: value };
      return {
        paramValues: newParamValues,
        simulationState: {
          ...state.simulationState,
          scene: {
            ...state.simulationState.scene,
            paramValues: newParamValues,
          },
        },
      };
    }),

  select: (target) => set({ selection: target }),

  setHovered: (target) => set({ hoveredTarget: target }),

  selectEntity: (id) =>
    set({
      selection: id
        ? { type: 'entity', id, data: { entityId: id } }
        : null,
    }),

  play: () =>
    set((state) => ({
      simulationState: {
        ...state.simulationState,
        status: 'running',
      },
    })),

  pause: () =>
    set((state) => ({
      simulationState: {
        ...state.simulationState,
        status: 'paused',
      },
    })),

  reset: () =>
    set((state) => ({
      simulationState: {
        ...state.simulationState,
        status: 'idle',
        timeline: {
          ...state.simulationState.timeline,
          currentTime: 0,
        },
        currentResult: null,
        resultHistory: [],
      },
    })),

  switchPrimaryViewport: (type) =>
    set({
      viewportState: {
        primary: type,
        overlays: [],
        density: 'standard',
      },
    }),

  toggleOverlayViewport: (type) =>
    set((state) => {
      const { overlays, primary } = state.viewportState;

      // 不能叠加自己
      if (type === primary) return state;

      const exists = overlays.includes(type);
      let newOverlays: ViewportType[];
      let newDensity = state.viewportState.density;

      if (exists) {
        // 移除
        newOverlays = overlays.filter((v) => v !== type);
      } else {
        // 添加，最多3个叠加层
        newOverlays = [...overlays, type];
        if (newOverlays.length > 3) {
          newOverlays = newOverlays.slice(-3);
        }
        // 叠加层 > 2 时自动降密度
        if (newOverlays.length > 2) {
          newDensity = 'compact';
        }
      }

      return {
        viewportState: {
          ...state.viewportState,
          overlays: newOverlays,
          density: newDensity,
        },
      };
    }),

  setInfoDensity: (density) =>
    set((state) => {
      // 叠加层 > 2 时不允许 detailed
      if (state.viewportState.overlays.length > 2 && density === 'detailed') {
        return state;
      }
      return {
        viewportState: {
          ...state.viewportState,
          density,
        },
      };
    }),

  setSimulationState: (partial) =>
    set((state) => ({
      simulationState: {
        ...state.simulationState,
        ...partial,
      },
    })),

  setCurrentResult: (result) =>
    set((state) => ({
      simulationState: {
        ...state.simulationState,
        currentResult: result,
      },
    })),

  setStatus: (status) =>
    set((state) => ({
      simulationState: {
        ...state.simulationState,
        status,
      },
    })),

  initFromPreset: (init) =>
    set({
      simulationState: init.simulationState,
      paramValues: init.paramValues,
      viewportState: init.viewportState,
      supportedViewports: init.supportedViewports ?? ['force'],
      selection: null,
      hoveredTarget: null,
    }),
}));
