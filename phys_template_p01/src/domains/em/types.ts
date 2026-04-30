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
  /** 边界形状：矩形(默认)、圆形或半圆 */
  boundaryShape?: 'rect' | 'circle' | 'semicircle';
  /** 圆/半圆边界半径 (m)，仅 boundaryShape='circle'|'semicircle' 时使用 */
  boundaryRadius?: number;
  /** 半圆朝向，仅 boundaryShape='semicircle' 时使用 */
  boundaryHalf?: 'up' | 'down' | 'left' | 'right';
  /** 自动圆形边界规则 */
  autoBoundaryMode?: 'focusing-min-radius' | 'divergence-base-speed';
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
  /** 初速度大小（磁场模块用，可由方向重新计算分量） */
  initialSpeed?: number;
  /** 初速度方向，单位 °，0° 向右 */
  initialDirectionDeg?: number;
  /** 显示半径 (m) */
  radius: number;
}

/** 点电荷实体类型别名 */
export type PointChargeEntity = Entity<PointChargeProps>;

// ═══════════════════════════════════════════════
// 匀强电场实体属性（预留，后续实现）
// ═══════════════════════════════════════════════

/** 匀强电场实体属性 */
export type UniformEFieldCapacitorModel = 'constant-voltage' | 'constant-charge';

/** 匀强电场实体属性 */
export interface UniformEFieldProps extends Record<string, unknown> {
  /** 电场强度大小 (V/m) */
  magnitude: number;
  /** 电场方向（单位向量） */
  direction: Vec2;
  /** 场区域宽度 (m)，平行板模式下即极板宽度 W */
  width: number;
  /** 场区域高度 (m)，平行板模式下即极板间距 d */
  height: number;
  /** 是否显示极板 */
  showPlates?: boolean;
  /** 显示极板时，是否在粒子碰板后立即停止；默认 true */
  stopOnPlateCollision?: boolean;
  /** 是否显示极板外侧的边缘弯曲场线，默认 true */
  showEdgeFieldLines?: boolean;
  /** 两段式电场中的分段角色 */
  stageRole?: 'acceleration' | 'deflection';
  /** 当前场区到下一段的固定间距 */
  stageGapAfter?: number;
  /** 当前场区到接收屏的固定间距 */
  screenGapAfter?: number;
  /** 电场模式：静态（默认）或交变（回旋加速器） */
  mode?: 'static' | 'alternating';
  /** 平行板电容器模型 */
  capacitorModel?: UniformEFieldCapacitorModel;
  /** 极板电压 (V)，平行板模式使用，恒压模型下 E = U / d */
  voltage?: number;
  /** 极板带电量 Q (C)，定电荷模型使用 */
  plateCharge?: number;
  /** 相对介电常数 εr，默认 1（空气） */
  dielectric?: number;
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
  /** 连接模式：'variable'（A+W 变阻器）或 'divider'（A+W+B 分压器） */
  connectionMode?: 'variable' | 'divider';
  /** 端口定义（三端：A固定端、B固定端、W滑片端） */
  ports?: ComponentPort[];
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

// ═══════════════════════════════════════════════
// 端口模型（元件多端口连接）
// ═══════════════════════════════════════════════

/** 元件端口定义 */
export interface ComponentPort {
  /** 端口标识，如 'A', 'B', 'W' */
  id: string;
  /** 显示名称，如 '固定端A', '滑片端W' */
  label: string;
  /** 端口在元件上的方位 */
  side: 'left' | 'right' | 'top' | 'bottom';
}

/** 带端口的实体属性基础接口 */
export interface PortedEntityProps extends Record<string, unknown> {
  ports?: ComponentPort[];
}

// ═══════════════════════════════════════════════
// 载流导线实体属性（P-08 磁感线可视化）
// ═══════════════════════════════════════════════

/** 载流导线实体属性 */
export interface CurrentWireProps extends Record<string, unknown> {
  /** 电流强度 (A) */
  current: number;
  /** 导线长度 (m) */
  length: number;
  /** 导线方向（单位向量，沿导线） */
  wireDirection: Vec2;
  /** 导线形状：直线或圆环 */
  wireShape?: 'straight' | 'loop';
  /** 圆环半径 (m)，仅 wireShape='loop' 时使用 */
  loopRadius?: number;
  /** 宽度用于渲染/碰撞 */
  width: number;
  /** 高度用于渲染/碰撞 */
  height: number;
}

/** 载流导线实体类型别名 */
export type CurrentWireEntity = Entity<CurrentWireProps>;

// ═══════════════════════════════════════════════
// 螺线管实体属性（P-08 磁感线可视化）
// ═══════════════════════════════════════════════

/** 螺线管实体属性 */
export interface SolenoidProps extends Record<string, unknown> {
  /** 电流强度 (A) */
  current: number;
  /** 匝数 */
  turns: number;
  /** 螺线管长度 (m) */
  length: number;
  /** 宽度用于渲染 (m) */
  width: number;
  /** 高度用于渲染 (m) */
  height: number;
}
