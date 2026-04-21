import { create } from 'zustand';

/**
 * 动画 transient 状态 — 模块级变量，非 React 状态
 * 动画播放时每帧更新，由 PointEntityRenderer 的 useFrame 直接读取，
 * 绕过 React 重渲染实现流畅 60fps 视觉更新。
 */
export const transientAnimationState = {
  pointId: null as string | null,
  position: null as [number, number, number] | null,
  t: 0,
};

export interface AnimationState {
  /** 正在播放动画的点 ID，null 表示无动画 */
  playingPointId: string | null;
  /** 动画速度倍率 */
  speed: number;
  /** 当前运动方向 */
  direction: 'forward' | 'backward';
  /** 播放开始时记录的初始 t 值（用于撤销） */
  initialT: number | null;

  play: (pointId: string, currentT: number) => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
}

export const useAnimationStore = create<AnimationState>((set) => ({
  playingPointId: null,
  speed: 1,
  direction: 'forward',
  initialT: null,

  play: (pointId, currentT) => {
    set({
      playingPointId: pointId,
      initialT: currentT,
      direction: 'forward',
    });
  },

  pause: () => {
    transientAnimationState.pointId = null;
    transientAnimationState.position = null;
    set({ playingPointId: null });
  },

  reset: () => {
    transientAnimationState.pointId = null;
    transientAnimationState.position = null;
    set({ playingPointId: null, initialT: null });
  },

  setSpeed: (speed) => {
    set({ speed: Math.max(0.1, Math.min(3, speed)) });
  },
}));
