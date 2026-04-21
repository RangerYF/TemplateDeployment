/**
 * 轻量拖拽状态 — 模块级变量，非 React 状态
 * 用于拖拽期间绕过 React 重渲染，由 useFrame 直接读取
 */
export const transientDragState = {
  pointId: null as string | null,
  position: null as [number, number, number] | null,
};
