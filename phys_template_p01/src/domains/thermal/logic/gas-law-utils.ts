/**
 * 理想气体定律工具函数
 *
 * 包含：理想气体状态方程计算、单位换算、三大气体过程公式
 */

// ═══════════════════════════════════════════════
// 物理常量
// ═══════════════════════════════════════════════

/** 玻尔兹曼常数 (J/K) */
export const kB = 1.38e-23;

/** 理想气体常数 (J/(mol·K)) */
export const R = 8.314;

/** 重力加速度 (m/s²) */
export const g = 9.8;

/** 水银密度 (kg/m³) */
export const RHO_HG = 13600;

/** 标准大气压 (Pa) */
export const P0_PA = 101325;

/** 标准大气压 (cmHg) */
export const P0_CMHG = 76;

// ═══════════════════════════════════════════════
// 单位换算
// ═══════════════════════════════════════════════

/** cmHg → Pa */
export function cmHgToPa(cmHg: number): number {
  return (cmHg / P0_CMHG) * P0_PA;
}

/** Pa → cmHg */
export function paToCmHg(pa: number): number {
  return (pa / P0_PA) * P0_CMHG;
}

/** L → m³ */
export function litersToM3(liters: number): number {
  return liters * 1e-3;
}

/** m³ → L */
export function m3ToLiters(m3: number): number {
  return m3 * 1e3;
}

/** cm → m */
export function cmToM(cm: number): number {
  return cm * 0.01;
}

/** m → cm */
export function mToCm(m: number): number {
  return m * 100;
}

// ═══════════════════════════════════════════════
// 理想气体状态方程
// ═══════════════════════════════════════════════

/**
 * 等温过程：p1 * V1 = p2 * V2
 * 已知 p1, V1, V2 → 求 p2
 */
export function isothermalPressure(p1: number, V1: number, V2: number): number {
  return (p1 * V1) / V2;
}

/**
 * 等温过程：已知 p1, V1, p2 → 求 V2
 */
export function isothermalVolume(p1: number, V1: number, p2: number): number {
  return (p1 * V1) / p2;
}

/**
 * 等压过程：V1/T1 = V2/T2
 * 已知 V1, T1, T2 → 求 V2
 */
export function isobaricVolume(V1: number, T1: number, T2: number): number {
  return (V1 * T2) / T1;
}

/**
 * 等压过程：已知 V1, T1, V2 → 求 T2
 */
export function isobaricTemperature(V1: number, T1: number, V2: number): number {
  return (T1 * V2) / V1;
}

/**
 * 等容过程：p1/T1 = p2/T2
 * 已知 p1, T1, T2 → 求 p2
 */
export function isochoricPressure(p1: number, T1: number, T2: number): number {
  return (p1 * T2) / T1;
}

/**
 * 等容过程：已知 p1, T1, p2 → 求 T2
 */
export function isochoricTemperature(p1: number, T1: number, p2: number): number {
  return (T1 * p2) / p1;
}

/**
 * 一般气体状态方程：p1V1/T1 = p2V2/T2
 * 已知 p1, V1, T1, T2 和约束条件 → 求 p2, V2
 */
export function generalGasLaw(
  p1: number, V1: number, T1: number,
  p2: number | null, V2: number | null, T2: number,
): { p: number; V: number } {
  const nRT_ratio = T2 / T1;
  if (p2 !== null && V2 === null) {
    // 已知 p2，求 V2
    return { p: p2, V: (p1 * V1 * nRT_ratio) / p2 };
  }
  if (V2 !== null && p2 === null) {
    // 已知 V2，求 p2
    return { p: (p1 * V1 * nRT_ratio) / V2, V: V2 };
  }
  // 两者都已知或都未知 — 返回按比例计算
  return { p: p1 * nRT_ratio, V: V1 };
}

/**
 * 计算液柱产生的压强 (Pa)
 * @param length 液柱长度 (m)
 * @param density 液体密度 (kg/m³)
 * @param angle 管与水平面的夹角 (度)，竖直=90
 */
export function liquidColumnPressure(
  length: number,
  density: number,
  angle: number = 90,
): number {
  const angleRad = (angle * Math.PI) / 180;
  return density * g * length * Math.sin(angleRad);
}

/**
 * 气柱体积 = 长度 × 截面积
 */
export function gasColumnVolume(length: number, crossSection: number): number {
  return length * crossSection;
}

/**
 * 根据体积和截面积计算气柱长度
 */
export function gasColumnLength(volume: number, crossSection: number): number {
  return volume / crossSection;
}
