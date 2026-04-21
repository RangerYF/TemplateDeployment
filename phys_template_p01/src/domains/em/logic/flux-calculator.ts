import type { Entity, Vec2 } from '@/core/types';
import type { MagneticFieldDirection } from '../types';

/**
 * 磁通量计算器
 *
 * 物理公式：
 *   Φ = B · S_overlap
 *   ε = -dΦ/dt ≈ -(Φ_current - Φ_previous) / dt
 *   I = ε / R
 *
 * 其中 S_overlap 是线框与磁场区域的重叠面积。
 */

export interface FluxResult {
  /** 当前磁通量 Φ (Wb) */
  flux: number;
  /** 重叠面积 (m²) */
  overlapArea: number;
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
  const overlapX = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const overlapY = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  return overlapX * overlapY;
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
  let totalFlux = 0;
  let totalOverlap = 0;

  for (const field of fieldEntities) {
    const fieldPos = field.transform.position;
    const fieldW = (field.properties.width as number) ?? 0;
    const fieldH = (field.properties.height as number) ?? 0;
    const fieldMag = (field.properties.magnitude as number) ?? 0;
    const fieldDir = (field.properties.direction as MagneticFieldDirection) ?? 'into';

    const overlap = computeOverlapArea(
      framePos.x, framePos.y, frameWidth, frameHeight,
      fieldPos.x, fieldPos.y, fieldW, fieldH,
    );

    if (overlap > 0) {
      // B_z 符号：into 为负（向纸面内），out 为正
      const bz = fieldDir === 'out' ? fieldMag : -fieldMag;
      totalFlux += bz * overlap;
      totalOverlap += overlap;
    }
  }

  return {
    flux: totalFlux,
    overlapArea: totalOverlap,
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
  // ε = -dΦ/dt
  const emf = dt > 0 ? -(currentFlux - previousFlux) / dt : 0;

  // I = ε / R
  const current = resistance > 0 ? emf / resistance : 0;

  return {
    emf,
    current,
    flux: currentFlux,
    overlapArea,
  };
}
