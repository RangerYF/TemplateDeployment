/**
 * 电磁域特有类型
 *
 * 核心类型（Entity, Vec2, Rect 等）从 @/core/types 导入，
 * 本文件仅定义电磁域的扩展属性接口。
 */

import type { Entity, Rect, Vec2 } from '@/core/types';

// ═══════════════════════════════════════════════
// 磁场方向（2D 平面中垂直纸面的方向）
// ═══════════════════════════════════════════════

/** 磁场方向：垂直纸面向内(×) 或向外(·) */
export type MagneticFieldDirection = 'into' | 'out';

// ═══════════════════════════════════════════════
// 匀强磁场实体属性
// ═══════════════════════════════════════════════

/** 匀强磁场实体属性 */
export interface UniformBFieldProps extends Record<string, unknown> {
  /** 磁感应强度大小 (T) */
  magnitude: number;
  /** 磁场方向：垂直纸面向内 / 向外 */
  direction: MagneticFieldDirection;
  /** 场区域宽度 (m) */
  width: number;
  /** 场区域高度 (m) */
  height: number;
}

/** 匀强磁场实体类型别名 */
export type UniformBFieldEntity = Entity<UniformBFieldProps>;

// ═══════════════════════════════════════════════
// 点电荷实体属性（已有实体的类型补全）
// ═══════════════════════════════════════════════

/** 点电荷实体属性 */
export interface PointChargeProps extends Record<string, unknown> {
  /** 电荷量 (C，库仑力预设中单位为 μC 需在求解器中转换) */
  charge: number;
  /** 质量 (kg) */
  mass: number;
  /** 初速度 (m/s) */
  initialVelocity: Vec2;
  /** 显示半径 (m) */
  radius: number;
}

/** 点电荷实体类型别名 */
export type PointChargeEntity = Entity<PointChargeProps>;

// ═══════════════════════════════════════════════
// 匀强电场实体属性（预留，后续实现）
// ═══════════════════════════════════════════════

/** 匀强电场实体属性 */
export interface UniformEFieldProps extends Record<string, unknown> {
  /** 电场强度大小 (V/m) */
  magnitude: number;
  /** 电场方向（单位向量） */
  direction: Vec2;
  /** 场区域宽度 (m) */
  width: number;
  /** 场区域高度 (m) */
  height: number;
}

/** 匀强电场实体类型别名 */
export type UniformEFieldEntity = Entity<UniformEFieldProps>;

// ═══════════════════════════════════════════════
// 矩形线框实体属性（电磁感应）
// ═══════════════════════════════════════════════

/** 矩形线框实体属性 */
export interface WireFrameProps extends Record<string, unknown> {
  /** 线框宽度 (m) */
  width: number;
  /** 线框高度 (m) */
  height: number;
  /** 电阻 (Ω) */
  resistance: number;
  /** 初速度 (m/s) */
  initialVelocity: Vec2;
  /** 感应电动势 (V)，由求解器每帧更新 */
  emf: number;
  /** 感应电流 (A)，由求解器每帧更新 */
  current: number;
  /** 当前磁通量 (Wb)，由求解器每帧更新 */
  flux: number;
}

/** 矩形线框实体类型别名 */
export type WireFrameEntity = Entity<WireFrameProps>;

// ═══════════════════════════════════════════════
// 场渲染辅助类型
// ═══════════════════════════════════════════════

/** 场符号网格点（用于渲染 ×/· 阵列） */
export interface FieldSymbolGrid {
  /** 场区域（物理坐标） */
  region: Rect;
  /** 网格间距 (m) */
  spacing: number;
  /** 符号类型 */
  symbol: 'cross' | 'dot';
}

// ═══════════════════════════════════════════════
// 电路元件实体属性（P-04 电路搭建器）
// ═══════════════════════════════════════════════

/** 直流电源实体属性 */
export interface DCSourceProps extends Record<string, unknown> {
  /** 电动势 (V) */
  emf: number;
  /** 内阻 (Ω) */
  internalResistance: number;
  /** 宽度用于渲染 (m) */
  width: number;
  /** 高度用于渲染 (m) */
  height: number;
}

/** 直流电源实体类型别名 */
export type DCSourceEntity = Entity<DCSourceProps>;

/** 定值电阻实体属性 */
export interface FixedResistorProps extends Record<string, unknown> {
  /** 电阻值 (Ω) */
  resistance: number;
  /** 宽度用于渲染 (m) */
  width: number;
  /** 高度用于渲染 (m) */
  height: number;
  /** 两端电压 (V)，求解器运行时更新 */
  voltage: number;
  /** 通过电流 (A)，求解器运行时更新 */
  current: number;
}

/** 定值电阻实体类型别名 */
export type FixedResistorEntity = Entity<FixedResistorProps>;

/** 滑动变阻器实体属性 */
export interface SlideRheostatProps extends Record<string, unknown> {
  /** 最大阻值 (Ω) */
  maxResistance: number;
  /** 滑片位置比例 0~1（0 = 最小阻值，1 = 最大阻值） */
  sliderRatio: number;
  /** 宽度用于渲染 (m) */
  width: number;
  /** 高度用于渲染 (m) */
  height: number;
  /** 两端电压 (V)，求解器运行时更新 */
  voltage: number;
  /** 通过电流 (A)，求解器运行时更新 */
  current: number;
}

/** 滑动变阻器实体类型别名 */
export type SlideRheostatEntity = Entity<SlideRheostatProps>;

/** 开关实体属性 */
export interface SwitchProps extends Record<string, unknown> {
  /** 是否闭合 */
  closed: boolean;
  /** 宽度用于渲染 (m) */
  width: number;
  /** 高度用于渲染 (m) */
  height: number;
}

/** 开关实体类型别名 */
export type SwitchEntity = Entity<SwitchProps>;

/** 电流表实体属性 */
export interface AmmeterProps extends Record<string, unknown> {
  /** 量程 (A)：双量程 */
  range: number;
  /** 内阻 (Ω) */
  internalResistance: number;
  /** 显示半径 (m) */
  radius: number;
  /** 当前读数 (A)，求解器运行时更新 */
  reading: number;
  /** 是否超量程，求解器运行时更新 */
  overRange: boolean;
}

/** 电流表实体类型别名 */
export type AmmeterEntity = Entity<AmmeterProps>;

/** 电压表实体属性 */
export interface VoltmeterProps extends Record<string, unknown> {
  /** 量程 (V)：双量程 */
  range: number;
  /** 内阻 (Ω) */
  internalResistance: number;
  /** 显示半径 (m) */
  radius: number;
  /** 当前读数 (V)，求解器运行时更新 */
  reading: number;
  /** 是否超量程，求解器运行时更新 */
  overRange: boolean;
}

/** 电压表实体类型别名 */
export type VoltmeterEntity = Entity<VoltmeterProps>;
