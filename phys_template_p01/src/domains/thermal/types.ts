/**
 * 热力学域特有类型
 *
 * 核心类型（Entity, Vec2 等）从 @/core/types 导入，
 * 本文件仅定义热力学域的扩展属性接口。
 */

import type { Entity } from '@/core/types';

// ═══════════════════════════════════════════════
// 容器类型枚举
// ═══════════════════════════════════════════════

/** 气体容器类型 */
export type ContainerType =
  | 'cylinder'       // 气缸（带活塞）
  | 'sealed-tube'    // 密封管（一端封闭）
  | 'u-tube'         // U形管
  | 'open-box'       // 开放容器（分子运动模拟用）
  | 'double-sealed'; // 双端密封管

/** 开口端方向 */
export type OpenEnd = 'top' | 'bottom' | 'left' | 'right' | 'none';

// ═══════════════════════════════════════════════
// 气体容器实体属性
// ═══════════════════════════════════════════════

/** 气体容器实体属性 */
export interface GasContainerProps extends Record<string, unknown> {
  /** 容器类型 */
  containerType: ContainerType;
  /** 容器宽度 (m) */
  width: number;
  /** 容器高度 (m) */
  height: number;
  /** 开口端方向 */
  openEnd: OpenEnd;
  /** 倾斜角度 (度) — 用于倾斜管 */
  inclineAngle: number;
  /** U管左臂高度 (m) — 仅 u-tube */
  leftArmHeight?: number;
  /** U管右臂高度 (m) — 仅 u-tube */
  rightArmHeight?: number;
  /** 管内径 (m) — 用于管状容器 */
  innerDiameter?: number;
}

/** 气体容器实体类型别名 */
export type GasContainerEntity = Entity<GasContainerProps>;

// ═══════════════════════════════════════════════
// 气柱实体属性
// ═══════════════════════════════════════════════

/** 图表数据点 */
export interface ChartPoint {
  x: number;
  y: number;
}

/** 图表类型 */
export type ChartType = 'p-V' | 'V-T' | 'p-T';

/** 气柱实体属性 */
export interface GasColumnProps extends Record<string, unknown> {
  /** 气体压强 (Pa) */
  pressure: number;
  /** 气体体积 (m³) */
  volume: number;
  /** 气体温度 (K) */
  temperature: number;
  /** 气柱长度 (m) — 在管中的长度 */
  length: number;
  /** 横截面积 (m²) */
  crossSection: number;
  /** 图表类型 */
  chartType?: ChartType;
  /** 图表数据点（初始态 + 终态） */
  chartData?: ChartPoint[];
  /** 初始压强 (Pa) — 用于图表标注 */
  initialPressure?: number;
  /** 初始体积 (m³) */
  initialVolume?: number;
  /** 初始温度 (K) */
  initialTemperature?: number;
  /** 气柱标识（用于双密封管区分左右气柱） */
  columnId?: string;
  /** 气柱在容器中的偏移位置 (m) */
  positionOffset?: number;
}

/** 气柱实体类型别名 */
export type GasColumnEntity = Entity<GasColumnProps>;

// ═══════════════════════════════════════════════
// 活塞实体属性
// ═══════════════════════════════════════════════

/** 活塞方向 */
export type PistonOrientation = 'vertical' | 'horizontal';

/** 活塞实体属性 */
export interface PistonProps extends Record<string, unknown> {
  /** 活塞质量 (kg) */
  mass: number;
  /** 横截面积 (m²) */
  crossSection: number;
  /** 活塞方向 */
  orientation: PistonOrientation;
  /** 活塞在容器中的位置偏移 (m) */
  positionOffset: number;
  /** 活塞宽度用于渲染 (m) */
  width: number;
  /** 活塞厚度用于渲染 (m) */
  thickness: number;
  /** 活塞标识（双活塞时区分） */
  pistonId?: string;
}

/** 活塞实体类型别名 */
export type PistonEntity = Entity<PistonProps>;

// ═══════════════════════════════════════════════
// 液柱实体属性
// ═══════════════════════════════════════════════

/** 液柱实体属性 */
export interface LiquidColumnProps extends Record<string, unknown> {
  /** 液柱长度 (m) */
  length: number;
  /** 液体密度 (kg/m³) */
  density: number;
  /** 横截面积 (m²) */
  crossSection: number;
  /** 液柱在容器中的位置偏移 (m) */
  positionOffset: number;
  /** 液柱标识（U管区分左右液柱） */
  columnId?: string;
}

/** 液柱实体类型别名 */
export type LiquidColumnEntity = Entity<LiquidColumnProps>;

// ═══════════════════════════════════════════════
// 气体分子集合实体属性
// ═══════════════════════════════════════════════

/** 气体分子集合实体属性 */
export interface GasMoleculesProps extends Record<string, unknown> {
  /** 分子数量 */
  count: number;
  /** 温度 (K) */
  temperature: number;
  /** 分子质量 (kg) — 单个分子 */
  molecularMass: number;
  /** 分子位置数组 [x1,y1,x2,y2,...] */
  positions: number[];
  /** 分子速度数组 [vx1,vy1,vx2,vy2,...] */
  velocities: number[];
  /** 速率分布直方图 [count_bin0, count_bin1, ...] */
  speedHistogram: number[];
  /** 直方图分箱边界 */
  histogramBins: number[];
  /** 容器边界宽度 (m) */
  containerWidth: number;
  /** 容器边界高度 (m) */
  containerHeight: number;
}

/** 气体分子集合实体类型别名 */
export type GasMoleculesEntity = Entity<GasMoleculesProps>;

// ═══════════════════════════════════════════════
// 布朗运动粒子实体属性
// ═══════════════════════════════════════════════

/** 布朗运动粒子实体属性 */
export interface BrownianParticleProps extends Record<string, unknown> {
  /** 粒子半径 (m) — 大粒子 */
  radius: number;
  /** 温度 (K) */
  temperature: number;
  /** 轨迹点 [x1,y1,x2,y2,...] */
  trajectory: number[];
  /** 液体分子数量（背景可视化） */
  liquidMoleculeCount: number;
  /** 液体分子位置 [x1,y1,...] */
  liquidPositions: number[];
  /** 液体分子速度 [vx1,vy1,...] */
  liquidVelocities: number[];
  /** 容器边界宽度 (m) */
  containerWidth: number;
  /** 容器边界高度 (m) */
  containerHeight: number;
  /** 粒子当前位置 x */
  currentX: number;
  /** 粒子当前位置 y */
  currentY: number;
}

/** 布朗运动粒子实体类型别名 */
export type BrownianParticleEntity = Entity<BrownianParticleProps>;
