import type { Vec3 } from '../types';

/** 精确值：同时持有 LaTeX 展示形式和数值近似 */
export interface SymbolicValue {
  /** LaTeX 字符串（用于 KaTeX 渲染） */
  latex: string;
  /** 数值近似 */
  numeric: number;
}

/** 计算步骤 */
export interface CalcStep {
  /** 步骤说明（中文） */
  label: string;
  /** 公式/表达式（LaTeX） */
  latex: string;
}

/** 单项计算结果（体积或表面积） */
export interface MeasureResult {
  /** 精确值 */
  value: SymbolicValue;
  /** 计算步骤序列 */
  steps: CalcStep[];
}

/** 几何体完整计算结果 */
export interface CalculationResult {
  volume: MeasureResult;
  surfaceArea: MeasureResult;
}

/** 坐标系 */
export interface CoordinateSystem {
  /** 原点顶点索引 */
  originIndex: number;
  /** 原点 3D 坐标 */
  origin: Vec3;
  /** 三个轴方向（单位向量） */
  axes: [Vec3, Vec3, Vec3]; // X, Y, Z
  /** 各顶点在此坐标系下的坐标 */
  vertexCoords: Vec3[];
}

/** 外接球 */
export interface CircumscribedSphere {
  center: Vec3;
  radius: number;
  /** 半径精确值（LaTeX） */
  radiusLatex: string;
}

/** 外接圆 */
export interface CircumscribedCircle {
  center: Vec3;
  radius: number;
  /** 半径精确值（LaTeX） */
  radiusLatex: string;
  /** 平面法向量（用于渲染圆环朝向） */
  normal: Vec3;
}
