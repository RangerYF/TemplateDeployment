// ─── 演示台实体类型 ───

export type DemoEntityType = 'demoPoint' | 'demoVector' | 'demoVecOp';

export interface DemoPoint {
  id: string;
  type: 'demoPoint';
  x: number;
  y: number;
  label: string;
}

/**
 * constraint 约束模式：
 *  - undefined / 'free': 自由向量（默认）
 *  - 'fixedStart': 起点固定、终点可沿圆弧拖拽（定起点向量）
 *  - 'fixedEnd': 终点固定、起点可沿圆弧拖拽（定终点向量）
 * constraintLength: 约束模长（仅 constraint 非 free 时有效）
 */
export interface DemoVector {
  id: string;
  type: 'demoVector';
  startId: string;
  endId: string;
  color: string;
  label: string;
  showLabel: boolean;
  constraint?: 'free' | 'fixedStart' | 'fixedEnd';
  constraintLength?: number;
}

export interface DemoVecOp {
  id: string;
  type: 'demoVecOp';
  kind: 'add' | 'subtract' | 'dotProduct' | 'scale';
  vec1Id: string;
  vec2Id?: string;   // add / subtract / dotProduct
  scalarK?: number;  // scale（默认 2）
  originX?: number;  // 运算结果向量的起点 X（未设置时默认 vec1 起点）
  originY?: number;  // 运算结果向量的起点 Y
  // 注意：结果向量不作为独立实体存储，由渲染层实时计算
}

export type DemoEntity = DemoPoint | DemoVector | DemoVecOp;

/** 端点绑定（两点来自不同向量，始终同步位置） */
export interface DemoBinding {
  id: string;
  pointA: string;  // 第一个端点 ID
  pointB: string;  // 第二个端点 ID
}

export interface DemoSnapshot {
  entities: Record<string, DemoEntity>;
  bindings: DemoBinding[];
  nextId: number;
}

// ─── 演示台工具类型 ───

export type DemoTool = 'select' | 'createVector' | 'vectorOp';
export type DemoOpKind = 'add' | 'subtract' | 'dotProduct' | 'scale';

// ─── 预设向量色板 ───

export const DEMO_COLORS = [
  '#8C8C8C',  // 灰（默认）
  '#FF6B6B',  // 红
  '#4ECDC4',  // 青
  '#FFD700',  // 金
  '#9C27B0',  // 紫
  '#2196F3',  // 蓝
  '#FF9800',  // 橙
  '#00C06B',  // 绿
  '#90A4AE',  // 灰蓝
] as const;
