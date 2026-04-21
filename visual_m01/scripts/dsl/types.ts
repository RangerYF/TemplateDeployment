/**
 * 场景构造指令 DSL 类型定义
 *
 * 指令是精简格式：只包含 geometry + constructions + measurements
 * 几何体环境信息（可用顶点/棱/面）由 geometry-env.ts 注册表提供，不出现在指令中
 */

import type { GeometryType } from '../src/types/geometry';

// ═══════════════════════════════════════════════════════════
// 顶层指令
// ═══════════════════════════════════════════════════════════

export interface SceneInstruction {
  /** 作品 ID，如 "cube-S05-1" */
  id: string;

  /** 几何体定义 */
  geometry: {
    type: GeometryType;
    params: Record<string, number>;
  };

  /** 有序构造步骤（可选，无增强的基础场景不需要） */
  constructions?: Construction[];

  /** 度量声明（可选） */
  measurements?: Measurement[];

  /** 坐标系（可选） */
  coordinateSystem?: CoordinateSystemDecl;

  /** 外接球（可选） */
  circumSphere?: boolean;
}

// ═══════════════════════════════════════════════════════════
// 构造步骤（有序，前面创建的标签后面可引用）
// ═══════════════════════════════════════════════════════════

export type Construction =
  | MidpointConstruction
  | EdgePointConstruction
  | FreePointConstruction
  | CentroidConstruction
  | SegmentConstruction
  | FaceConstruction;

// ─── 点构造 ───

export interface MidpointConstruction {
  type: 'midpoint';
  /** 新点标签，如 "M" */
  label: string;
  /** 两端点标签，如 ["A", "B"] */
  of: [string, string];
}

export interface EdgePointConstruction {
  type: 'edge_point';
  /** 新点标签 */
  label: string;
  /** 棱的两端点标签 */
  edge: [string, string];
  /** 0~1 参数，0.5 = 中点 */
  t: number;
}

export interface FreePointConstruction {
  type: 'free_point';
  /** 新点标签 */
  label: string;
  /** 绝对坐标 */
  position: [number, number, number];
}

export interface CentroidConstruction {
  type: 'centroid';
  /** 新点标签，如 "O" */
  label: string;
  /** 顶点标签列表，如 ["A", "B", "C", "D"] */
  of: string[];
}

// ─── 线段构造 ───

export interface SegmentConstruction {
  type: 'segment';
  /** 起点标签 */
  from: string;
  /** 终点标签 */
  to: string;
  /** 颜色，如 "#e74c3c" */
  color?: string;
  /** 是否虚线 */
  dashed?: boolean;
}

// ─── 面构造 ───

export interface FaceConstruction {
  type: 'face';
  /** 可选标签，供度量引用，如 "diagFace" */
  label?: string;
  /** 顶点标签列表 */
  points: string[];
  /** 截面 or 自定义面（默认 custom） */
  style?: 'crossSection' | 'custom';
}

// ═══════════════════════════════════════════════════════════
// 度量声明
// 编译器自动：解析引用 → 获取坐标 → 调用 calculator → 写入实体
// ═══════════════════════════════════════════════════════════

export type Measurement =
  | DihedralAngleMeasurement
  | LineFaceAngleMeasurement
  | LineLineAngleMeasurement
  | PointFaceDistanceMeasurement
  | LineLineDistanceMeasurement;

export interface DihedralAngleMeasurement {
  kind: 'dihedral_angle';
  /** 面引用 */
  face1: FaceRef;
  /** 面引用 */
  face2: FaceRef;
  /** 可选：显式指定棱（不指定时编译器自动计算交线） */
  edge?: [string, string];
}

export interface LineFaceAngleMeasurement {
  kind: 'line_face_angle';
  /** 线引用 */
  line: LineRef;
  /** 面引用 */
  face: FaceRef;
}

export interface LineLineAngleMeasurement {
  kind: 'line_line_angle';
  /** 线引用 */
  line1: LineRef;
  /** 线引用 */
  line2: LineRef;
}

export interface PointFaceDistanceMeasurement {
  kind: 'point_face_distance';
  /** 点标签 */
  point: string;
  /** 面引用 */
  face: FaceRef;
}

export interface LineLineDistanceMeasurement {
  kind: 'line_line_distance';
  /** 线引用 */
  line1: LineRef;
  /** 线引用 */
  line2: LineRef;
}

// ═══════════════════════════════════════════════════════════
// 引用类型
// ═══════════════════════════════════════════════════════════

/**
 * 面引用：
 * - string "底面" | "顶面" | "前面" → 内置面名
 * - string "face1" | "diagFace" → 构造步骤中的面标签
 * - string[] ["A", "B", "C", "D"] → 顶点标签列表（查找已有面或自动创建）
 */
export type FaceRef = string | string[];

/**
 * 线引用：两端点标签元组
 * 编译器优先查找内置棱，否则查找自定义线段
 */
export type LineRef = [string, string];

// ═══════════════════════════════════════════════════════════
// 坐标系声明
// ═══════════════════════════════════════════════════════════

export interface CoordinateSystemDecl {
  /** 原点标签 */
  origin: string;
  /** auto = 引擎自动计算（cube/cuboid），upZ = Z轴朝上（pyramid/prism） */
  mode?: 'auto' | 'upZ';
  /** upZ 模式下 X 轴方向（两点标签） */
  xDirection?: [string, string];
}

// ═══════════════════════════════════════════════════════════
// 编译输出
// ═══════════════════════════════════════════════════════════

export interface SceneSnapshot {
  entities: Record<string, unknown>;
  nextId: number;
  activeGeometryId: string | null;
}
