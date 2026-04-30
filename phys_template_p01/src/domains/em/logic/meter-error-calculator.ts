/**
 * 电表测量误差计算器
 *
 * 对比三种电路的测量差异：
 * 1) 理想电路（r_A=0, r_V=∞）
 * 2) 内接法（电压表跨 R+r_A）
 * 3) 外接法（电压表只跨 R，电流表测总电流含电压表支路）
 */

export interface MeterErrorParams {
  /** 电源电动势 E (V) */
  E: number;
  /** 电源内阻 r (Ω) */
  r: number;
  /** 待测电阻 Rx (Ω) */
  Rx: number;
  /** 电流表内阻 (Ω) */
  rA: number;
  /** 电压表内阻 (Ω) */
  rV: number;
}

export interface CircuitResult {
  /** 电流表读数 (A) */
  I: number;
  /** 电压表读数 (V) */
  V: number;
  /** 测得电阻 R' = V/I (Ω) */
  Rmeasured: number;
  /** 相对误差 (R'-R)/R */
  error: number;
  /** 相对真实值的偏差方向 */
  direction: 'higher' | 'lower' | 'equal';
}

export interface MeterTrueValues {
  emf: number;
  sourceResistance: number;
  trueResistance: number;
  criticalResistance: number;
}

export interface MeterErrorSummary {
  innerErrorPercent: number;
  outerErrorPercent: number;
  betterMethod: 'inner' | 'outer';
}

export interface MeterErrorResult {
  trueValues: MeterTrueValues;
  idealValues: CircuitResult;
  innerConnectionValues: CircuitResult;
  outerConnectionValues: CircuitResult;
  /** 推荐方法：'inner' | 'outer' */
  recommended: 'inner' | 'outer';
  /** 推荐理由 */
  recommendReason: string;
  errorSummary: MeterErrorSummary;
}

function parallelResistance(a: number, b: number): number {
  const safeA = Math.max(a, 1e-6);
  const safeB = Math.max(b, 1e-6);
  return (safeA * safeB) / (safeA + safeB);
}

function directionFromError(error: number): 'higher' | 'lower' | 'equal' {
  if (error > 1e-9) return 'higher';
  if (error < -1e-9) return 'lower';
  return 'equal';
}

/**
 * 计算三种电路的测量结果
 *
 * 理想情况：
 *   I_ideal = E / (r + Rx)
 *   V_ideal = I_ideal × Rx
 *   R_measured = V/I = Rx
 *
 * 内接法（电压表跨 R + r_A 两端）：
 *   并联支路：(Rx + rA) ∥ rV
 *   A 表读数 I_in = U_branch / (Rx + rA)
 *   V 表读数 V_in = U_branch
 *   R_measured = V_in / I_in = Rx + rA
 *   误差 = r_A / Rx（偏大）
 *
 * 外接法（电压表只跨 R，电流表测含电压表支路的总电流）：
 *   R_parallel = Rx ∥ rV
 *   总回路：E, r 与 rA + R_parallel 串联
 *   A 表读数 I_out = I_total
 *   V 表读数 V_out = I_total × R_parallel
 *   R_measured = V_out / I_out = R_parallel
 *   误差 = (R_parallel - Rx) / Rx（偏小）
 */
export function calculateMeterError(params: MeterErrorParams): MeterErrorResult {
  const { E, r, Rx, rA, rV } = params;

  // 防止除零
  const safeE = Math.max(E, 0);
  const safeSourceR = Math.max(r, 0);
  const safeR = Math.max(Rx, 1e-6);
  const safeRA = Math.max(rA, 0);
  const safeRV = Math.max(rV, 1e-6);
  const criticalResistance = Math.sqrt(Math.max(safeRA * safeRV, 0));

  // ─── 1) 理想电路 ───
  const I_ideal = safeE / Math.max(safeSourceR + safeR, 1e-6);
  const V_ideal = I_ideal * safeR;
  const R_ideal = safeR;

  const idealValues: CircuitResult = {
    I: I_ideal,
    V: V_ideal,
    Rmeasured: R_ideal,
    error: 0,
    direction: 'equal',
  };

  // ─── 2) 内接法 ───
  const innerBranchResistance = safeR + safeRA;
  const innerExternalResistance = parallelResistance(innerBranchResistance, safeRV);
  const innerSourceCurrent = safeE / Math.max(safeSourceR + innerExternalResistance, 1e-6);
  const V_inner = innerSourceCurrent * innerExternalResistance;
  const I_inner = V_inner / Math.max(innerBranchResistance, 1e-6);
  const R_measured_inner = V_inner / Math.max(I_inner, 1e-6);
  const error_inner = (R_measured_inner - safeR) / safeR;

  const innerConnectionValues: CircuitResult = {
    I: I_inner,
    V: V_inner,
    Rmeasured: R_measured_inner,
    error: error_inner,
    direction: directionFromError(error_inner),
  };

  // ─── 3) 外接法 ───
  const R_parallel = parallelResistance(safeR, safeRV);
  const R_total_outer = safeSourceR + safeRA + R_parallel;
  const I_outer = safeE / Math.max(R_total_outer, 1e-6);
  const V_outer = I_outer * R_parallel;
  const R_measured_outer = V_outer / Math.max(I_outer, 1e-6);
  const error_outer = (R_measured_outer - safeR) / safeR;

  const outerConnectionValues: CircuitResult = {
    I: I_outer,
    V: V_outer,
    Rmeasured: R_measured_outer,
    error: error_outer,
    direction: directionFromError(error_outer),
  };

  // ─── 推荐方案 ───
  const absErrInner = Math.abs(error_inner);
  const absErrOuter = Math.abs(error_outer);

  let recommended: 'inner' | 'outer';
  let recommendReason: string;

  if (absErrInner < absErrOuter) {
    recommended = 'inner';
    recommendReason = `内接法误差绝对值更小：|${formatPercent(error_inner)}| < |${formatPercent(error_outer)}|`;
  } else if (absErrOuter < absErrInner) {
    recommended = 'outer';
    recommendReason = `外接法误差绝对值更小：|${formatPercent(error_outer)}| < |${formatPercent(error_inner)}|`;
  } else {
    recommended = 'inner';
    recommendReason = '两种方法误差相同';
  }

  return {
    trueValues: {
      emf: safeE,
      sourceResistance: safeSourceR,
      trueResistance: safeR,
      criticalResistance,
    },
    idealValues,
    innerConnectionValues,
    outerConnectionValues,
    recommended,
    recommendReason,
    errorSummary: {
      innerErrorPercent: error_inner * 100,
      outerErrorPercent: error_outer * 100,
      betterMethod: recommended,
    },
  };
}

/**
 * 格式化数值，保留有效数字
 */
export function formatValue(value: number, precision: number = 3): string {
  if (!isFinite(value)) return '—';
  if (Math.abs(value) < 1e-10) return '0';
  if (Math.abs(value) >= 1000) return value.toFixed(1);
  if (Math.abs(value) >= 1) return value.toPrecision(precision);
  // 小数
  return value.toPrecision(precision);
}

/**
 * 格式化百分比误差
 */
export function formatPercent(error: number): string {
  if (!isFinite(error)) return '—';
  const pct = error * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
