import type { EntityId } from '@/core/types';

/**
 * 力学域交互状态 — 模块级变量，不进公共 store
 * 管理正交分解相关状态（选中哪个力要分解、动画进度等）
 *
 * 选中和 hover 状态已统一到公共 store.selection / store.hoveredTarget
 * 这里只存分解相关的域内业务状态
 */

export interface DecompositionTarget {
  entityId: EntityId;
  forceIndex: number;
  /** 动画进度 0~1 */
  progress: number;
  /** 动画方向 */
  direction: 'in' | 'out';
}

export interface ForceInteractionState {
  /** 正交分解目标 */
  decompositionTarget: DecompositionTarget | null;
  /** hover 的力箭头（域内缓存，渲染 overlay 时用） */
  hoveredForceKey: string | null;
}

// 模块级单例
let state: ForceInteractionState = {
  decompositionTarget: null,
  hoveredForceKey: null,
};

export function getForceInteractionState(): Readonly<ForceInteractionState> {
  return state;
}

export function setDecompositionTarget(
  entityId: EntityId,
  forceIndex: number,
): void {
  state = {
    ...state,
    decompositionTarget: {
      entityId,
      forceIndex,
      progress: 0,
      direction: 'in',
    },
  };
}

export function clearDecomposition(): void {
  if (!state.decompositionTarget) return;
  state = {
    ...state,
    decompositionTarget: {
      ...state.decompositionTarget,
      direction: 'out',
    },
  };
}

export function updateDecompositionProgress(dt: number): void {
  if (!state.decompositionTarget) return;

  const target = state.decompositionTarget;
  if (target.direction === 'in') {
    // 渐入 0.8s，ease-out
    const newProgress = Math.min(1, target.progress + dt / 0.8);
    state = {
      ...state,
      decompositionTarget: { ...target, progress: newProgress },
    };
  } else {
    // 渐出 0.3s，ease-in
    const newProgress = Math.max(0, target.progress - dt / 0.3);
    if (newProgress <= 0) {
      state = { ...state, decompositionTarget: null };
    } else {
      state = {
        ...state,
        decompositionTarget: { ...target, progress: newProgress },
      };
    }
  }
}

export function setHoveredForce(key: string | null): void {
  state = { ...state, hoveredForceKey: key };
}

export function resetForceInteraction(): void {
  state = {
    decompositionTarget: null,
    hoveredForceKey: null,
  };
}

/** ease-out 缓动 */
export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** ease-in 缓动 */
export function easeIn(t: number): number {
  return t * t;
}
