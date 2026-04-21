import type {
  EventActionMapping,
  ParamValues,
  PhysicsEvent,
  PhysicsResult,
  PresetData,
  SceneDefinition,
  SimulationState,
  SimulatorEvent,
  SimulatorEventHandler,
  SolveMode,
  ViewportType,
} from '../types';
import type { SolverRegistration } from '../registries';
import { loadPreset, type PresetLoadResult } from './preset-loader';

// ─── 常量 ───

const MAX_DT = 1 / 30; // 最大时间步长（防止大步长导致数值不稳定）
const SAMPLE_RATE = 60; // 解析解预计算采样率

// ─── Simulator ───

export interface ISimulator {
  // 生命周期
  loadPreset(preset: PresetData): void;
  unload(): void;

  // 播放控制
  play(): void;
  pause(): void;
  reset(): void;

  // 时间轴
  seekTo(time: number): void;
  setPlaybackRate(rate: number): void;

  // 参数交互
  updateParam(paramKey: string, value: ParamValues[string]): void;

  // 状态读取
  getState(): SimulationState;
  getCurrentResult(): PhysicsResult | null;
  getResultHistory(): PhysicsResult[];

  // 单步（供 render-loop 调用）
  step(dt: number): void;

  // 事件订阅
  on(event: SimulatorEvent, handler: SimulatorEventHandler): void;
  off(event: SimulatorEvent, handler: SimulatorEventHandler): void;
}

export function createSimulator(): ISimulator {
  // ─── 内部状态 ───
  let scene: SceneDefinition | null = null;
  let activeSolver: SolverRegistration | null = null;
  let solveMode: SolveMode = 'analytical';
  let duration = 5;
  let currentTime = 0;
  let playbackRate = 1;
  let status: 'idle' | 'running' | 'paused' | 'finished' = 'idle';
  let currentResult: PhysicsResult | null = null;
  let resultHistory: PhysicsResult[] = [];
  let precomputedResults: PhysicsResult[] | null = null;
  let eventActions: EventActionMapping[] = [];
  let supportedViewports: ViewportType[] = [];
  let defaultViewport: ViewportType = 'force';

  // 事件系统
  const listeners = new Map<SimulatorEvent, Set<SimulatorEventHandler>>();

  function emit(event: SimulatorEvent, data?: unknown): void {
    const handlers = listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  // ─── 内部辅助 ───

  function findNearestFrame(
    frames: PhysicsResult[],
    time: number,
  ): PhysicsResult | null {
    if (frames.length === 0) return null;

    // 二分查找最近帧
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const midFrame = frames[mid];
      if (midFrame && midFrame.time < time) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    const loFrame = frames[lo];
    if (!loFrame) return null;

    // 比较 lo 和 lo-1 哪个更近
    if (lo > 0) {
      const prevFrame = frames[lo - 1];
      if (prevFrame) {
        const diffLo = Math.abs(loFrame.time - time);
        const diffPrev = Math.abs(prevFrame.time - time);
        return diffLo < diffPrev ? loFrame : prevFrame;
      }
    }
    return loFrame;
  }

  function runEventDetection(
    prevResult: PhysicsResult | null,
    result: PhysicsResult,
  ): void {
    if (!activeSolver?.eventDetectors || !scene) return;

    for (const detector of activeSolver.eventDetectors) {
      const detection = detector.detect(scene, result, prevResult);
      if (detection) {
        const physicsEvent: PhysicsEvent = {
          type: detection.eventType,
          time: result.time,
          entityId: detection.entityId,
          description: `事件: ${detection.eventType}`,
          data: detection.data,
        };

        // 查找匹配的 eventAction
        for (const ea of eventActions) {
          if (ea.eventType !== detection.eventType) continue;
          if (ea.entityId && ea.entityId !== detection.entityId) continue;

          // 执行动作
          if (ea.action.type === 'stop') {
            status = 'finished';
          }

          emit('physics-event', { event: physicsEvent, action: ea.action });
        }
      }
    }
  }

  function computePrecomputedResults(): void {
    if (
      solveMode !== 'analytical' ||
      !activeSolver?.precompute ||
      !scene
    ) {
      precomputedResults = null;
      return;
    }
    precomputedResults = activeSolver.precompute(
      scene,
      duration,
      SAMPLE_RATE,
    );
  }

  function solveAtTime(time: number, dt: number): PhysicsResult | null {
    if (!activeSolver || !scene) return null;

    if (solveMode === 'analytical') {
      // 优先从预计算结果中取
      if (precomputedResults) {
        return findNearestFrame(precomputedResults, time);
      }
      return activeSolver.solve(scene, time, 0, null);
    } else {
      // 数值积分
      const prev =
        resultHistory.length > 0
          ? (resultHistory[resultHistory.length - 1] ?? null)
          : null;
      return activeSolver.solve(scene, time, dt, prev);
    }
  }

  function findParamSchema(
    paramKey: string,
  ): { targetEntityId?: string; targetProperty?: string } | null {
    if (!scene) return null;
    for (const group of scene.paramGroups) {
      for (const param of group.params) {
        if (param.key === paramKey) {
          return {
            targetEntityId: param.targetEntityId,
            targetProperty: param.targetProperty,
          };
        }
      }
    }
    return null;
  }

  // ─── 构建当前 SimulationState 快照 ───

  function buildState(): SimulationState {
    return {
      status,
      solveMode,
      integrator: activeSolver?.integrator ?? 'semi-implicit-euler',
      timeline: {
        currentTime,
        duration,
        playbackRate,
        dt: 1 / 60,
      },
      scene: scene ?? {
        entities: new Map(),
        relations: [],
        paramGroups: [],
        paramValues: {},
      },
      currentResult,
      resultHistory,
    };
  }

  // ─── 公开 API ───

  return {
    loadPreset(preset: PresetData): void {
      let loadResult: PresetLoadResult;
      try {
        loadResult = loadPreset(preset);
      } catch (e) {
        console.error('[Simulator] 预设加载失败:', e);
        throw e;
      }

      scene = loadResult.scene;
      activeSolver = loadResult.solver;
      solveMode = loadResult.solveMode;
      duration = loadResult.duration;
      defaultViewport = loadResult.defaultViewport;
      supportedViewports = loadResult.supportedViewports;
      eventActions = loadResult.eventActions;
      currentTime = 0;
      status = 'idle';
      resultHistory = [];
      currentResult = null;

      // 解析解预计算
      computePrecomputedResults();

      // 计算 t=0 的结果
      currentResult = solveAtTime(0, 0);
      if (currentResult) {
        resultHistory.push(currentResult);
      }

      emit('preset-loaded', {
        scene,
        defaultViewport,
        supportedViewports,
      });
    },

    unload(): void {
      scene = null;
      activeSolver = null;
      currentResult = null;
      resultHistory = [];
      precomputedResults = null;
      eventActions = [];
      status = 'idle';
      currentTime = 0;
    },

    play(): void {
      if (!scene || !activeSolver) return;
      if (status === 'finished') return;
      status = 'running';
    },

    pause(): void {
      if (status === 'running') {
        status = 'paused';
      }
    },

    reset(): void {
      currentTime = 0;
      status = 'idle';
      resultHistory = [];

      // 重新计算 t=0
      currentResult = solveAtTime(0, 0);
      if (currentResult) {
        resultHistory.push(currentResult);
      }

      emit('reset', null);
    },

    seekTo(time: number): void {
      const clampedTime = Math.max(0, Math.min(time, duration));

      if (solveMode === 'analytical') {
        currentResult = solveAtTime(clampedTime, 0);
      } else {
        // 数值积分：从 resultHistory 中查找最近帧
        currentResult = findNearestFrame(resultHistory, clampedTime);
      }

      currentTime = clampedTime;
    },

    setPlaybackRate(rate: number): void {
      playbackRate = rate;
    },

    updateParam(paramKey: string, value: ParamValues[string]): void {
      if (!scene) return;

      // 1. 更新参数值
      scene.paramValues[paramKey] = value;

      // 2. 更新实体属性（如有映射）
      const schema = findParamSchema(paramKey);
      if (schema?.targetEntityId && schema?.targetProperty) {
        const entity = scene.entities.get(schema.targetEntityId);
        if (entity) {
          setNestedProperty(
            entity.properties as Record<string, unknown>,
            schema.targetProperty,
            value,
          );
        }
      }

      // 3. 重置模拟
      currentTime = 0;
      resultHistory = [];

      // 4. 重新预计算（解析解）
      computePrecomputedResults();

      // 5. 计算 t=0 的结果
      currentResult = solveAtTime(0, 0);
      if (currentResult) {
        resultHistory.push(currentResult);
      }
    },

    step(dt: number): void {
      if (status !== 'running' || !scene || !activeSolver) return;

      // ① 计算实际 dt
      const effectiveDt = Math.min(dt * playbackRate, MAX_DT);

      // ② 推进时间
      let newTime = currentTime + effectiveDt;
      if (newTime >= duration) {
        newTime = duration;
        status = 'finished';
      }

      // ③ 求解
      const prevResult = currentResult;
      const result = solveAtTime(newTime, effectiveDt);

      if (result) {
        // ④ 事件检测
        runEventDetection(prevResult, result);

        // ⑤ 状态更新
        currentResult = result;
        currentTime = newTime;

        resultHistory.push(result);

        // ⑥ 通知渲染
        emit('frame', { time: newTime, result });
      }

      // ⑦ 循环控制
      if (status === 'finished') {
        emit('finished', { time: newTime });
      }
    },

    getState(): SimulationState {
      return buildState();
    },

    getCurrentResult(): PhysicsResult | null {
      return currentResult;
    },

    getResultHistory(): PhysicsResult[] {
      return precomputedResults ?? resultHistory;
    },

    on(event: SimulatorEvent, handler: SimulatorEventHandler): void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
    },

    off(event: SimulatorEvent, handler: SimulatorEventHandler): void {
      listeners.get(event)?.delete(handler);
    },
  };
}

// ─── 工具函数：设置嵌套属性 ───

function setNestedProperty(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split('.');
  const lastKey = keys[keys.length - 1];
  if (!lastKey) return;

  if (keys.length === 1) {
    obj[lastKey] = value;
    return;
  }

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (
      current[key] === undefined ||
      current[key] === null ||
      typeof current[key] !== 'object'
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[lastKey] = value;
}

/** 全局默认 Simulator 实例 */
export const simulator = createSimulator();
