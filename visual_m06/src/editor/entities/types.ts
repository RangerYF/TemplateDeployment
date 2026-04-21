// ─── 基础向量类型 ───

export type Vec2D = [number, number];
export type Vec3D = [number, number, number];

// ─── 运算类型（对应需求文档 VEC-011 ~ VEC-062）───

export type OperationType =
  | 'concept'        // VEC-001 向量基本要素
  | 'coordinate'     // VEC-002 坐标表示
  | 'parallelogram'  // VEC-011 平行四边形法则（加法）
  | 'triangle'       // VEC-012 三角形法则（加法）
  | 'subtraction'    // VEC-021 向量减法
  | 'scalar'         // VEC-031 数乘向量
  | 'dotProduct'     // VEC-041 数量积（点积）
  | 'decomposition'  // VEC-051 基底分解
  | 'space3D'        // VEC-061 空间向量基本运算
  | 'crossProduct'   // VEC-062 叉积（向量积）
  | 'geometry3D'    // VEC-071 立体几何应用
  | 'demoStage';    // 演示台：自由向量创建与运算

// ─── 当前维度 ───

export type Dimension = '2D' | '3D';

// ─── 运算元数据 ───

export interface OperationMeta {
  id: OperationType;
  label: string;
  shortLabel: string;
  dimension: Dimension;
  category: '基本运算' | '数量积' | '分解' | '空间向量' | '演示台';
  vecIds: string[];  // 需要哪些向量
  description: string;
}

export const OPERATION_META: Record<OperationType, OperationMeta> = {
  concept: {
    id: 'concept',
    label: '向量基本要素',
    shortLabel: '向量概念',
    dimension: '2D',
    category: '基本运算',
    vecIds: ['a'],
    description: 'VEC-001：向量的方向、模（大小）与自由向量概念',
  },
  coordinate: {
    id: 'coordinate',
    label: '向量坐标表示',
    shortLabel: '坐标',
    dimension: '2D',
    category: '基本运算',
    vecIds: ['a'],
    description: 'VEC-002：平面向量坐标表示，坐标分量与模长的关系',
  },
  parallelogram: {
    id: 'parallelogram',
    label: '平行四边形法则',
    shortLabel: 'a+b',
    dimension: '2D',
    category: '基本运算',
    vecIds: ['a', 'b'],
    description: 'VEC-011：以两向量为邻边构造平行四边形，对角线为和向量',
  },
  triangle: {
    id: 'triangle',
    label: '三角形法则',
    shortLabel: '首尾相接',
    dimension: '2D',
    category: '基本运算',
    vecIds: ['a', 'b'],
    description: 'VEC-012：首尾相接，从起点到终点为和向量',
  },
  subtraction: {
    id: 'subtraction',
    label: '向量减法',
    shortLabel: 'a−b',
    dimension: '2D',
    category: '基本运算',
    vecIds: ['a', 'b'],
    description: 'VEC-021：共起点，由 b 终点指向 a 终点',
  },
  scalar: {
    id: 'scalar',
    label: '数乘向量',
    shortLabel: 'k·a',
    dimension: '2D',
    category: '基本运算',
    vecIds: ['a'],
    description: 'VEC-031：k>0方向不变，k<0方向相反，k=0零向量',
  },
  dotProduct: {
    id: 'dotProduct',
    label: '数量积（点积）',
    shortLabel: 'a·b',
    dimension: '2D',
    category: '数量积',
    vecIds: ['a', 'b'],
    description: 'VEC-041：a·b = |a||b|cosθ，结果为标量',
  },
  decomposition: {
    id: 'decomposition',
    label: '基底分解',
    shortLabel: '分解',
    dimension: '2D',
    category: '分解',
    vecIds: ['target', 'e1', 'e2'],
    description: 'VEC-051：平面向量基本定理，任意向量在给定基底下唯一分解',
  },
  space3D: {
    id: 'space3D',
    label: '空间向量',
    shortLabel: '三维',
    dimension: '3D',
    category: '空间向量',
    vecIds: ['a3', 'b3'],
    description: 'VEC-061：空间向量的加法、数量积与夹角',
  },
  crossProduct: {
    id: 'crossProduct',
    label: '叉积（向量积）',
    shortLabel: 'a×b',
    dimension: '3D',
    category: '空间向量',
    vecIds: ['a3', 'b3'],
    description: 'VEC-062：a×b 垂直于 a 和 b 的平面，模等于平行四边形面积',
  },
  geometry3D: {
    id: 'geometry3D',
    label: '立体几何应用',
    shortLabel: '几何体',
    dimension: '3D',
    category: '空间向量',
    vecIds: ['a3', 'b3'],
    description: 'VEC-071：向量在立体几何中的应用——法向量、对角线、体积计算',
  },
  demoStage: {
    id: 'demoStage',
    label: '演示台',
    shortLabel: '演示台',
    dimension: '2D',
    category: '演示台',
    vecIds: [],
    description: '自由创建向量，拖拽移动，执行向量运算，支持撤销/重做与导入/导出',
  },
};

// ─── 预设数据结构 ───

export interface PresetData {
  id: string;
  name: string;
  operation: OperationType;
  vecA?: Vec2D;
  vecB?: Vec2D;
  chainVecs?: Vec2D[];
  scalarK?: number;
  decompTarget?: Vec2D;
  basis1?: Vec2D;
  basis2?: Vec2D;
  vecA3?: Vec3D;
  vecB3?: Vec3D;
  teachingPoint: string;
  teachingPoints?: string[];
}
