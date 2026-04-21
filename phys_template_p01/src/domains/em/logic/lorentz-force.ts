import type { Entity, Force, Vec2 } from '@/core/types';
import type { MagneticFieldDirection } from '../types';

/**
 * 洛伦兹力计算（2D 简化）
 *
 * 物理公式：F = q(v × B)
 *
 * 2D 简化：磁场 B 只有 z 分量（垂直纸面），速度 v 在 xy 平面内。
 * 叉积结果：
 *   F_x = q * v_y * B_z
 *   F_y = -q * v_x * B_z
 *
 * 其中 B_z > 0 表示向外（out），B_z < 0 表示向内（into）。
 */

/**
 * 获取磁场 z 分量的符号值
 * 'into' → B_z < 0（垂直纸面向内）
 * 'out'  → B_z > 0（垂直纸面向外）
 */
function getBzSigned(magnitude: number, direction: MagneticFieldDirection): number {
  return direction === 'out' ? magnitude : -magnitude;
}

/**
 * 判断点是否在磁场区域内
 */
function isInFieldRegion(
  point: Vec2,
  fieldPosition: Vec2,
  fieldWidth: number,
  fieldHeight: number,
): boolean {
  return (
    point.x >= fieldPosition.x &&
    point.x <= fieldPosition.x + fieldWidth &&
    point.y >= fieldPosition.y &&
    point.y <= fieldPosition.y + fieldHeight
  );
}

export interface LorentzForceResult {
  /** 洛伦兹力 */
  force: Force;
  /** 力的分量（用于加速度计算） */
  fx: number;
  fy: number;
}

/**
 * 计算单个带电粒子在所有磁场中受到的洛伦兹力之和
 *
 * @param particlePosition - 粒子当前位置
 * @param velocity - 粒子当前速度
 * @param charge - 电荷量 (C)
 * @param fieldEntities - 场景中所有 uniform-bfield 实体
 * @returns 洛伦兹力结果，如果粒子不在任何磁场中返回 null
 */
export function computeLorentzForce(
  particlePosition: Vec2,
  velocity: Vec2,
  charge: number,
  fieldEntities: Entity[],
): LorentzForceResult | null {
  let totalFx = 0;
  let totalFy = 0;
  let inField = false;

  for (const field of fieldEntities) {
    const fieldPos = field.transform.position;
    const fieldW = (field.properties.width as number) ?? 0;
    const fieldH = (field.properties.height as number) ?? 0;
    const fieldMag = (field.properties.magnitude as number) ?? 0;
    const fieldDir = (field.properties.direction as MagneticFieldDirection) ?? 'into';

    if (!isInFieldRegion(particlePosition, fieldPos, fieldW, fieldH)) {
      continue;
    }

    inField = true;
    const bz = getBzSigned(fieldMag, fieldDir);

    // F = q(v × B)  在 2D 中：
    // F_x = q * v_y * B_z
    // F_y = -q * v_x * B_z
    totalFx += charge * velocity.y * bz;
    totalFy += -charge * velocity.x * bz;
  }

  if (!inField) return null;

  const magnitude = Math.hypot(totalFx, totalFy);

  return {
    force: {
      type: 'lorentz',
      label: magnitude > 0.01 ? `F=${magnitude.toFixed(2)}N` : 'F≈0',
      magnitude,
      direction: magnitude > 0
        ? { x: totalFx / magnitude, y: totalFy / magnitude }
        : { x: 0, y: 0 },
    },
    fx: totalFx,
    fy: totalFy,
  };
}
