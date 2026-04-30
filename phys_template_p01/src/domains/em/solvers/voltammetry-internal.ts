import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  parallelResistance,
  checkOverRange,
  findComponent,
  findByFamily,
  findPreferredComponent,
  getEffectiveResistance,
  isFixedResistance,
  resetInactiveInstrumentReadings,
  setInstrumentActivity,
} from '../logic/circuit-solver-utils';

/**
 * 伏安法·内接法求解器
 *
 * 电路拓扑：
 *   电源 ε,r → 开关 → [ 电流表 rA 串联 被测电阻 Rx ] 并联 电压表 rV
 *
 * 物理公式：
 *   串联部分：R_series = rA + Rx
 *   并联部分：R_parallel = R_series ∥ rV = (R_series * rV) / (R_series + rV)
 *   总电阻：R_total = R_parallel + r
 *   总电流：I_total = ε / R_total
 *   并联两支路电压：U_parallel = I_total * R_parallel
 *   电流表读数：I_A = U_parallel / R_series
 *   电压表读数：U_V = U_parallel
 *
 * 测量误差分析：
 *   R_测 = U_V / I_A = R_series = Rx + rA > Rx（偏大）
 *   适用条件：Rx >> rA 且 Rx << rV（大电阻用内接法）
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  // 查找各元件（被测电阻：定值电阻 或 电阻箱均可）
  const source = findComponent(scene.entities, 'dc-source');
  const resistor = findByFamily(scene.entities, isFixedResistance);
  const preferredCurrentMeterId = scene.paramValues.activeCurrentMeterId as string | undefined;
  const preferredVoltmeterId = scene.paramValues.activeVoltmeterId as string | undefined;
  const ammeter = findPreferredComponent(scene.entities, 'ammeter', preferredCurrentMeterId);
  const voltmeter = findPreferredComponent(scene.entities, 'voltmeter', preferredVoltmeterId);
  const sw = findComponent(scene.entities, 'switch');

  setInstrumentActivity(scene.entities, {
    activeCurrentMeterId: ammeter?.id,
    activeVoltmeterId: voltmeter?.id,
  });
  resetInactiveInstrumentReadings(scene.entities, {
    activeCurrentMeterId: ammeter?.id,
    activeVoltmeterId: voltmeter?.id,
  });

  if (!source || !resistor || !ammeter || !voltmeter) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const emf = (source.properties.emf as number) ?? 6;
  const r = (source.properties.internalResistance as number) ?? 1;
  const Rx = (resistor.properties.resistance as number) ?? 10;
  const rA = (ammeter.properties.internalResistance as number) ?? 0.2;
  const rV = (voltmeter.properties.internalResistance as number) ?? 3000;
  const Rx_eff = getEffectiveResistance(resistor); // 考虑故障状态

  resistor.properties.hasFault = Rx_eff !== Rx;
  resistor.properties.activeFault = (resistor.properties.faultType as string) ?? 'none';

  source.properties.circuitType = 'voltammetry-internal';
  source.properties.currentMethod = 'internal';
  source.properties.trueR = Rx;
  source.properties.measuredR = undefined;
  source.properties.error = undefined;
  source.properties.voltmeterBranchCurrent = 0;

  // 检查开关状态
  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;

  if (!switchClosed) {
    // 开关断开，所有读数为 0
    ammeter.properties.reading = 0;
    ammeter.properties.overRange = false;
    voltmeter.properties.reading = 0;
    voltmeter.properties.overRange = false;
    resistor.properties.voltage = 0;
    resistor.properties.current = 0;
    source.properties.totalCurrent = 0;
    source.properties.terminalVoltage = emf;
    return { time: 0, forceAnalyses, motionStates };
  }

  // 故障：被测电阻断路后，仅剩电压表支路导通，电流表支路无电流。
  if (!isFinite(Rx_eff)) {
    ammeter.properties.reading = 0;
    ammeter.properties.overRange = false;
    const I_V = emf / Math.max(r + rV, 1e-6);
    const U_V = emf - I_V * r;
    checkOverRange(voltmeter, U_V, (voltmeter.properties.range as number) ?? 3);
    resistor.properties.voltage = 0;
    resistor.properties.current = 0;
    source.properties.totalCurrent = I_V;
    source.properties.terminalVoltage = U_V;
    source.properties.voltmeterBranchCurrent = I_V;
    return { time: 0, forceAnalyses, motionStates };
  }

  // 计算电路
  const R_series = rA + Rx_eff; // 电流表与被测电阻串联
  const R_parallel = parallelResistance(R_series, rV); // 串联部分与电压表并联
  const R_total = R_parallel + r; // 加上内阻

  const I_total = emf / R_total; // 总电流
  const U_parallel = I_total * R_parallel; // 并联部分电压

  const I_A = U_parallel / R_series; // 电流表读数（流过被测电阻支路的电流）
  const U_V = U_parallel; // 电压表读数（并联部分两端电压）
  const I_V = U_parallel / Math.max(rV, 1e-6);

  // 更新仪表读数
  checkOverRange(ammeter, I_A, (ammeter.properties.range as number) ?? 0.6);
  checkOverRange(voltmeter, U_V, (voltmeter.properties.range as number) ?? 3);

  // 更新电阻元件状态
  resistor.properties.voltage = I_A * Rx_eff; // 被测电阻两端电压
  resistor.properties.current = I_A;

  // 写入电源状态用于 viewport 显示
  source.properties.totalCurrent = I_total;
  source.properties.terminalVoltage = emf - I_total * r;

  // 测量值（供视角层显示）
  source.properties.measuredR = U_V / I_A; // R_测 = U_V / I_A
  source.properties.trueR = Rx;
  source.properties.error = (U_V / I_A - Rx) / Rx; // 相对误差
  source.properties.currentMethod = 'internal';
  source.properties.voltmeterBranchCurrent = I_V;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerVoltammetryInternalSolver(): void {
  solverRegistry.register({
    id: 'em-voltammetry-internal',
    label: '伏安法·内接法',
    pattern: {
      entityTypes: ['dc-source', 'fixed-resistor', 'ammeter', 'voltmeter'],
      relationType: 'connection',
      qualifier: { circuit: 'voltammetry-internal' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
