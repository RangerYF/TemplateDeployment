import { create } from 'zustand';
import type {
  EntityId,
  FieldLineDensity,
  InfoDensity,
  ParamValues,
  PhysicsResult,
  SimulationState,
  SimulationStatus,
  Vec2,
  ViewportState,
  ViewportType,
} from '@/core/types';

// ─── Store State ───

export type SolenoidDisplayMode = 'textbook' | 'particles' | 'volume';
export type SolenoidViewMode = 'front' | 'side' | 'section' | 'orbit';
export type LoopCompassDisplayMode = 'needle' | 'out' | 'into';

export interface LoopCompassProbe {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface LoopHoverSample {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  directionLabel: string;
  screenX: number;
  screenY: number;
}

export interface LoopTeachingState {
  compasses: LoopCompassProbe[];
  hoverSample: LoopHoverSample | null;
}

export interface SolenoidCompassProbe {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface SolenoidHoverSample {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  directionLabel: string;
  screenX: number;
  screenY: number;
  region: 'inside' | 'outside';
}

export interface SolenoidTeachingState {
  displayMode: SolenoidDisplayMode;
  viewMode: SolenoidViewMode;
  orbitYawDeg: number;
  orbitPitchDeg: number;
  orbitDistance: number;
  compasses: SolenoidCompassProbe[];
  hoverSample: SolenoidHoverSample | null;
}

export interface SimulationStoreState {
  /** 当前模拟状态 */
  simulationState: SimulationState;

  /** 当前参数值 */
  paramValues: ParamValues;

  /** 当前选中实体 */
  selectedEntityId: EntityId | null;

  /** 当前视角状态 */
  viewportState: ViewportState;

  /** 电场线显示开关 */
  showFieldLines: boolean;

  /** 等势线显示开关 */
  showEquipotentialLines: boolean;

  /** 电势分布显示开关 */
  showPotentialMap: boolean;

  /** P-08 场线密度 */
  fieldLineDensity: FieldLineDensity;

  /** 轨迹显示开关 */
  showTrajectory: boolean;

  /** 电势差测量点 A */
  potentialProbeA: Vec2 | null;

  /** 电势差测量点 B */
  potentialProbeB: Vec2 | null;

  /** 螺线管教学工作台状态 */
  solenoidTeaching: SolenoidTeachingState;

  /** 圆形电流教学工作台状态 */
  loopTeaching: LoopTeachingState;
}

// ─── Store Actions ───

export interface SimulationStoreActions {
  /** 更新参数值 */
  updateParam: (key: string, value: number | boolean | string) => void;

  /** 批量替换参数值 */
  setParamValues: (values: ParamValues) => void;

  /** 选中实体 */
  selectEntity: (id: EntityId | null) => void;

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

  /** 切换电场线显示/隐藏 */
  toggleFieldLines: () => void;

  /** 切换等势线显示/隐藏 */
  toggleEquipotentialLines: () => void;

  /** 切换电势分布显示/隐藏 */
  togglePotentialMap: () => void;

  /** 设置 P-08 场线密度 */
  setFieldLineDensity: (density: FieldLineDensity) => void;

  /** 切换轨迹显示/隐藏 */
  toggleTrajectory: () => void;

  /** 放置两点电势差测量点 */
  placePotentialProbe: (point: Vec2) => void;

  /** 清空两点电势差测量点 */
  clearPotentialProbes: () => void;

  /** 设置螺线管显示模式 */
  setSolenoidDisplayMode: (mode: SolenoidDisplayMode) => void;

  /** 设置螺线管视角模式 */
  setSolenoidViewMode: (mode: SolenoidViewMode) => void;

  /** 设置螺线管 3D 相机 */
  setSolenoidOrbitCamera: (
    camera: Partial<Pick<SolenoidTeachingState, 'orbitYawDeg' | 'orbitPitchDeg' | 'orbitDistance'>>,
  ) => void;

  /** 添加磁针 */
  addSolenoidCompass: (compass: Omit<SolenoidCompassProbe, 'id'> & { id?: string }) => void;

  /** 移动磁针 */
  moveSolenoidCompass: (id: string, position: Pick<SolenoidCompassProbe, 'x' | 'y' | 'z'>) => void;

  /** 设置局部磁场 hover 采样 */
  setSolenoidHoverSample: (sample: SolenoidHoverSample | null) => void;

  /** 重置螺线管教学工作台 */
  resetSolenoidTeaching: () => void;

  /** 添加圆形电流磁针 */
  addLoopCompass: (compass: Omit<LoopCompassProbe, 'id'> & { id?: string }) => void;

  /** 移动圆形电流磁针 */
  moveLoopCompass: (id: string, position: Pick<LoopCompassProbe, 'x' | 'y' | 'z'>) => void;

  /** 设置圆形电流 hover 采样 */
  setLoopHoverSample: (sample: LoopHoverSample | null) => void;

  /** 重置圆形电流教学工作台 */
  resetLoopTeaching: () => void;

  /** 加载预设后初始化 store（由 PresetLoader 调用） */
  initFromPreset: (init: {
    simulationState: SimulationState;
    paramValues: ParamValues;
    viewportState: ViewportState;
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

function createDefaultSolenoidCompasses(): SolenoidCompassProbe[] {
  return [
    { id: 'solenoid-compass-1', x: -1.05, y: 0, z: 0 },
    { id: 'solenoid-compass-2', x: 0, y: 0, z: 0 },
    { id: 'solenoid-compass-3', x: 1.05, y: 0, z: 0 },
    { id: 'solenoid-compass-4', x: 1.9, y: 0.88, z: 0.12 },
    { id: 'solenoid-compass-5', x: -1.9, y: 0.88, z: -0.12 },
    { id: 'solenoid-compass-6', x: 0, y: -1.38, z: 0 },
  ];
}

function createInitialSolenoidTeachingState(): SolenoidTeachingState {
  return {
    displayMode: 'textbook',
    viewMode: 'orbit',
    orbitYawDeg: -18,
    orbitPitchDeg: 14,
    orbitDistance: 9.2,
    compasses: createDefaultSolenoidCompasses(),
    hoverSample: null,
  };
}

function createDefaultLoopCompasses(): LoopCompassProbe[] {
  return [
    { id: 'loop-compass-center', x: 0, y: 0, z: 0 },
  ];
}

function createInitialLoopTeachingState(): LoopTeachingState {
  return {
    compasses: createDefaultLoopCompasses(),
    hoverSample: null,
  };
}

// ─── Store 创建 ───

export const useSimulationStore = create<
  SimulationStoreState & SimulationStoreActions
>((set) => ({
  // ─── 初始状态 ───
  simulationState: initialSimulationState,
  paramValues: {},
  selectedEntityId: null,
  viewportState: initialViewportState,
  showFieldLines: true,
  showEquipotentialLines: true,
  showPotentialMap: true,
  fieldLineDensity: 'standard',
  showTrajectory: true,
  potentialProbeA: null,
  potentialProbeB: null,
  solenoidTeaching: createInitialSolenoidTeachingState(),
  loopTeaching: createInitialLoopTeachingState(),

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

  setParamValues: (values) =>
    set((state) => ({
      paramValues: { ...values },
      simulationState: {
        ...state.simulationState,
        scene: {
          ...state.simulationState.scene,
          paramValues: { ...values },
        },
      },
    })),

  selectEntity: (id) => set({ selectedEntityId: id }),

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

  toggleFieldLines: () =>
    set((state) => ({ showFieldLines: !state.showFieldLines })),

  toggleEquipotentialLines: () =>
    set((state) => ({ showEquipotentialLines: !state.showEquipotentialLines })),

  togglePotentialMap: () =>
    set((state) => ({ showPotentialMap: !state.showPotentialMap })),

  setFieldLineDensity: (density) =>
    set({ fieldLineDensity: density }),

  toggleTrajectory: () =>
    set((state) => ({ showTrajectory: !state.showTrajectory })),

  placePotentialProbe: (point) =>
    set((state) => {
      if (!state.potentialProbeA) {
        return { potentialProbeA: { ...point }, potentialProbeB: null };
      }
      if (!state.potentialProbeB) {
        return { potentialProbeB: { ...point } };
      }
      return {
        potentialProbeA: { ...point },
        potentialProbeB: null,
      };
    }),

  clearPotentialProbes: () =>
    set({
      potentialProbeA: null,
      potentialProbeB: null,
    }),

  setSolenoidDisplayMode: (mode) =>
    set((state) => ({
      solenoidTeaching: {
        ...state.solenoidTeaching,
        displayMode: mode,
      },
    })),

  setSolenoidViewMode: (mode) =>
    set((state) => ({
      solenoidTeaching: {
        ...state.solenoidTeaching,
        viewMode: mode,
      },
    })),

  setSolenoidOrbitCamera: (camera) =>
    set((state) => ({
      solenoidTeaching: {
        ...state.solenoidTeaching,
        ...camera,
      },
    })),

  addSolenoidCompass: (compass) =>
    set((state) => ({
      solenoidTeaching: {
        ...state.solenoidTeaching,
        compasses: [
          ...state.solenoidTeaching.compasses,
          {
            id: compass.id ?? `solenoid-compass-${crypto.randomUUID().slice(0, 8)}`,
            x: compass.x,
            y: compass.y,
            z: compass.z,
          },
        ],
      },
    })),

  moveSolenoidCompass: (id, position) =>
    set((state) => ({
      solenoidTeaching: {
        ...state.solenoidTeaching,
        compasses: state.solenoidTeaching.compasses.map((compass) =>
          compass.id === id
            ? { ...compass, ...position }
            : compass,
        ),
      },
    })),

  setSolenoidHoverSample: (sample) =>
    set((state) => ({
      solenoidTeaching: {
        ...state.solenoidTeaching,
        hoverSample: sample,
      },
    })),

  resetSolenoidTeaching: () =>
    set({
      solenoidTeaching: createInitialSolenoidTeachingState(),
    }),

  addLoopCompass: (compass) =>
    set((state) => ({
      loopTeaching: {
        ...state.loopTeaching,
        compasses: [
          ...state.loopTeaching.compasses,
          {
            id: compass.id ?? `loop-compass-${crypto.randomUUID().slice(0, 8)}`,
            x: compass.x,
            y: compass.y,
            z: compass.z,
          },
        ],
      },
    })),

  moveLoopCompass: (id, position) =>
    set((state) => ({
      loopTeaching: {
        ...state.loopTeaching,
        compasses: state.loopTeaching.compasses.map((compass) =>
          compass.id === id
            ? { ...compass, ...position }
            : compass,
        ),
      },
    })),

  setLoopHoverSample: (sample) =>
    set((state) => ({
      loopTeaching: {
        ...state.loopTeaching,
        hoverSample: sample,
      },
    })),

  resetLoopTeaching: () =>
    set({
      loopTeaching: createInitialLoopTeachingState(),
    }),

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
      selectedEntityId: null,
      showFieldLines: true,
      showEquipotentialLines: true,
      showPotentialMap: true,
      fieldLineDensity: 'standard',
      showTrajectory: true,
      potentialProbeA: null,
      potentialProbeB: null,
      solenoidTeaching: createInitialSolenoidTeachingState(),
      loopTeaching: createInitialLoopTeachingState(),
    }),
}));
