import type { Entity, Vec2 } from '@/core/types';
import {
  computeInducedCurrent,
  computeInducedEmf,
  computeRectOverlapArea,
  computeRectangularLoopFlux,
  extractUniformBFieldRegions,
} from '../p13/core';

/**
 * 磁通量计算器
 *
 * P-13 Phase 1 中继续保留这个兼容门面：
 * - 旧求解器可沿用 computeFlux / computeInduction
 * - 内部统一委托给新的 P-13 核心层，避免磁通量/电流/安培力逻辑继续散落
 */

export interface FluxResult {
  /** 当前磁通量 Φ (Wb) */
  flux: number;
  /** 重叠面积 (m²) */
  overlapArea: number;
  /** 当前参与感应的净 Bz（带符号） */
  activeSignedFluxDensity?: number;
}

export interface InductionResult {
  /** 感应电动势 ε (V) */
  emf: number;
  /** 感应电流 I (A) */
  current: number;
  /** 当前磁通量 Φ (Wb) */
  flux: number;
  /** 重叠面积 (m²) */
  overlapArea: number;
}

/**
 * 计算两个轴对齐矩形的重叠面积
 *
 * @param ax - 矩形 A 左下角 x
 * @param ay - 矩形 A 左下角 y
 * @param aw - 矩形 A 宽度
 * @param ah - 矩形 A 高度
 * @param bx - 矩形 B 左下角 x
 * @param by - 矩形 B 左下角 y
 * @param bw - 矩形 B 宽度
 * @param bh - 矩形 B 高度
 * @returns 重叠面积（≥0）
 */
export function computeOverlapArea(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): number {
  return computeRectOverlapArea(
    { x: ax, y: ay, width: aw, height: ah },
    { x: bx, y: by, width: bw, height: bh },
  );
}

/**
 * 计算线框在所有磁场中的总磁通量
 *
 * @param framePos - 线框左下角位置（物理坐标）
 * @param frameWidth - 线框宽度 (m)
 * @param frameHeight - 线框高度 (m)
 * @param fieldEntities - 场景中所有 uniform-bfield 实体
 * @returns 磁通量结果
 */
export function computeFlux(
  framePos: Vec2,
  frameWidth: number,
  frameHeight: number,
  fieldEntities: Entity[],
): FluxResult {
  const fluxSample = computeRectangularLoopFlux(
    {
      position: framePos,
      width: frameWidth,
      height: frameHeight,
    },
    extractUniformBFieldRegions(fieldEntities),
  );

  return {
    flux: fluxSample.flux,
    overlapArea: fluxSample.overlapArea,
    activeSignedFluxDensity: fluxSample.activeSignedFluxDensity,
  };
}

/**
 * 计算电磁感应的完整结果
 *
 * @param currentFlux - 当前帧磁通量
 * @param previousFlux - 上一帧磁通量
 * @param dt - 时间步长 (s)
 * @param resistance - 线框电阻 (Ω)
 * @param overlapArea - 当前重叠面积
 * @returns 感应结果（EMF、电流、磁通量）
 */
export function computeInduction(
  currentFlux: number,
  previousFlux: number,
  dt: number,
  resistance: number,
  overlapArea: number,
): InductionResult {
  const emf = computeInducedEmf({
    previousFlux,
    currentFlux,
    dt,
  });
  const current = computeInducedCurrent({
    emf,
    resistance,
  });

  return {
    emf,
    current,
    flux: currentFlux,
    overlapArea,
  };
}
