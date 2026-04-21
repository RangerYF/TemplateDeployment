/**
 * 压强平衡工具函数
 *
 * 功能：液柱压强计算、U管平衡、双密封管联立方程求解
 */

import { g, P0_PA, RHO_HG } from './gas-law-utils';

/**
 * 竖直液柱压强 (Pa)
 * Δp = ρgh
 */
export function verticalLiquidPressure(length: number, density: number): number {
  return density * g * length;
}

/**
 * 倾斜液柱压强 (Pa)
 * Δp = ρg·L·sinθ
 * @param angle 管与水平面夹角（度）
 */
export function inclinedLiquidPressure(
  length: number,
  density: number,
  angle: number,
): number {
  const angleRad = (angle * Math.PI) / 180;
  return density * g * length * Math.sin(angleRad);
}

/**
 * 密封管（开口朝上）气体压强
 * p_gas = p0 + ρgL_liq
 */
export function sealedTubeOpenTopPressure(
  p0: number,
  liquidLength: number,
  liquidDensity: number,
): number {
  return p0 + verticalLiquidPressure(liquidLength, liquidDensity);
}

/**
 * 密封管（开口朝下）气体压强
 * p_gas = p0 - ρgL_liq
 */
export function sealedTubeOpenBottomPressure(
  p0: number,
  liquidLength: number,
  liquidDensity: number,
): number {
  return p0 - verticalLiquidPressure(liquidLength, liquidDensity);
}

/**
 * 密封管（水平放置）气体压强
 * p_gas = p0（液柱不产生附加压强）
 */
export function sealedTubeHorizontalPressure(p0: number): number {
  return p0;
}

/**
 * 密封管（倾斜放置）气体压强
 * @param openEndUp 开口端在上方则 true（液柱在气柱上方加压）
 */
export function sealedTubeInclinedPressure(
  p0: number,
  liquidLength: number,
  liquidDensity: number,
  angle: number,
  openEndUp: boolean,
): number {
  const dp = inclinedLiquidPressure(liquidLength, liquidDensity, angle);
  return openEndUp ? p0 + dp : p0 - dp;
}

/**
 * U管平衡求解
 *
 * 左侧封闭气柱 + 左侧液柱 + 右侧液柱（开口）
 *
 * 约束：
 * 1. 液体总量守恒：L_left + L_right = L_total
 * 2. 底部压强平衡：p_gas + ρg·L_left = p0 + ρg·L_right
 * 3. 气体状态方程：p1·V1/T1 = p2·V2/T2
 *
 * 使用牛顿迭代法求解
 */
export function solveUTube(
  p0: number,
  initialGasLength: number,
  initialGasPressure: number,
  initialTemperature: number,
  newTemperature: number,
  totalLiquidLength: number,
  initialLeftLiquid: number,
  liquidDensity: number,
): {
  gasLength: number;
  gasPressure: number;
  leftLiquidLength: number;
  rightLiquidLength: number;
} {
  // 牛顿迭代：设 x = 新的气柱长度
  // 约束推导：
  // 新左侧液柱 = tubeLength - x（管长 - 气柱长度 = 左侧液柱长度上方部分）
  // 但实际上需要基于液体守恒和压强平衡联立

  // 简化模型：设新气柱长度为 Lg
  // 新气体体积 Vg = Lg * S
  // 由状态方程：p_new = p1 * V1 * T2 / (T1 * Vg) = p1 * L1 * T2 / (T1 * Lg)
  // 左侧液柱长度上方：由管的几何关系确定
  // 液体总量不变，但左侧变化导致右侧变化

  // 设左侧液柱新长度 Ll
  // Lg + Ll = 左管有效长度 = initialGasLength + initialLeftLiquid
  // => Ll = (initialGasLength + initialLeftLiquid) - Lg

  const leftArmTotal = initialGasLength + initialLeftLiquid;
  const L_total = totalLiquidLength;

  // 牛顿迭代：f(Lg) = 0
  // p_gas = p1 * L1 * T2 / (T1 * Lg)
  // L_left = leftArmTotal - Lg
  // L_right = L_total - L_left = L_total - leftArmTotal + Lg
  // 压强平衡：p_gas + ρg * L_left = p0 + ρg * L_right
  // => p1*L1*T2/(T1*Lg) + ρg*(leftArmTotal - Lg) = p0 + ρg*(L_total - leftArmTotal + Lg)
  // => p1*L1*T2/(T1*Lg) = p0 + ρg*(L_total - 2*leftArmTotal + 2*Lg)

  const C = initialGasPressure * initialGasLength * newTemperature / initialTemperature;
  const rg = liquidDensity * g;

  let Lg = initialGasLength; // 初始猜测

  for (let iter = 0; iter < 50; iter++) {
    const f = C / Lg - p0 - rg * (L_total - 2 * leftArmTotal + 2 * Lg);
    const df = -C / (Lg * Lg) - 2 * rg;

    const dLg = -f / df;
    Lg += dLg;

    if (Lg < 0.001) Lg = 0.001;
    if (Lg > leftArmTotal - 0.001) Lg = leftArmTotal - 0.001;

    if (Math.abs(dLg) < 1e-8) break;
  }

  const L_left = leftArmTotal - Lg;
  const L_right = L_total - L_left;
  const p_gas = C / Lg;

  return {
    gasLength: Lg,
    gasPressure: p_gas,
    leftLiquidLength: L_left,
    rightLiquidLength: L_right,
  };
}

/**
 * 双密封管求解
 *
 * 管中两段气体被液柱隔开，两端都封闭。
 * 约束：
 * 1. 左气柱 + 液柱 + 右气柱 = 管总长
 * 2. 左气体状态方程
 * 3. 右气体状态方程
 *
 * 牛顿迭代法
 */
export function solveDoubleSealedTube(
  initialLeftGasLength: number,
  initialLeftPressure: number,
  initialRightGasLength: number,
  initialRightPressure: number,
  initialTemperature: number,
  newTemperature: number,
  liquidLength: number,
  _crossSection: number,
  tubeLength: number,
): {
  leftGasLength: number;
  leftPressure: number;
  rightGasLength: number;
  rightPressure: number;
} {
  // 总长约束：Lg_left + L_liq + Lg_right = tubeLength
  // 状态方程：
  //   p_left * Lg_left / T2 = p1_left * L1_left / T1
  //   p_right * Lg_right / T2 = p1_right * L1_right / T1
  // 压强平衡（液柱质量忽略/水平）：p_left = p_right（水平管）
  // => C_left / Lg_left = C_right / Lg_right
  // 其中 C_left = p1_left * L1_left * T2 / T1, C_right 类似

  const ratio = newTemperature / initialTemperature;
  const C_left = initialLeftPressure * initialLeftGasLength * ratio;
  const C_right = initialRightPressure * initialRightGasLength * ratio;

  // 可用空间
  const gasSpace = tubeLength - liquidLength;

  // p_left = p_right => C_left / Lg_left = C_right / Lg_right
  // Lg_left + Lg_right = gasSpace
  // => C_left / Lg_left = C_right / (gasSpace - Lg_left)
  // => C_left * (gasSpace - Lg_left) = C_right * Lg_left
  // => C_left * gasSpace = Lg_left * (C_left + C_right)
  // => Lg_left = C_left * gasSpace / (C_left + C_right)

  const Lg_left = (C_left * gasSpace) / (C_left + C_right);
  const Lg_right = gasSpace - Lg_left;
  const p_eq = C_left / Lg_left;

  return {
    leftGasLength: Lg_left,
    leftPressure: p_eq,
    rightGasLength: Lg_right,
    rightPressure: p_eq,
  };
}

/**
 * 单活塞压强平衡
 * @param orientation 'vertical' | 'horizontal'
 * @param pistonOnTop 竖直时活塞在气柱上方
 */
export function pistonPressure(
  p0: number,
  pistonMass: number,
  crossSection: number,
  orientation: string,
  pistonOnTop: boolean = true,
): number {
  if (orientation === 'horizontal') {
    return p0; // 水平时活塞重力不影响
  }
  const pPiston = (pistonMass * g) / crossSection;
  return pistonOnTop ? p0 + pPiston : p0 - pPiston;
}

/**
 * 双活塞系统求解
 *
 * 两个活塞夹着气体，竖直放置
 * p_gas = p0 + (m1 + m2) * g / S （或根据具体布局）
 */
export function doublePistonPressure(
  p0: number,
  mass1: number,
  mass2: number,
  crossSection: number,
): { gasAPressure: number; gasBPressure: number } {
  // 上活塞(m1)和下活塞(m2)之间的气体A, 上方气体B
  // p_A = p0 + m1*g/S (上活塞压下来)
  // p_B = p0 (上方开放)
  // 更一般情况取决于具体布局

  const pA = p0 + (mass1 * g) / crossSection;
  const pB = p0 + ((mass1 + mass2) * g) / crossSection;

  return { gasAPressure: pA, gasBPressure: pB };
}

// Re-export constants for convenience
export { P0_PA, RHO_HG, g };
