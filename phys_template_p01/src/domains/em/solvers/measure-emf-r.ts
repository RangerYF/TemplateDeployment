import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  parallelResistance,
  checkOverRange,
  findComponent,
  findByFamily,
  findPreferredComponent,
  getConfiguredResistance,
  getEffectiveResistance,
  getRheostatConnectionMode,
  isFixedResistance,
  isVariableResistor,
  resetInactiveInstrumentReadings,
  setInstrumentActivity,
} from '../logic/circuit-solver-utils';

/**
 * 测电源 EMF 和内阻求解器
 *
 * 电路拓扑：
 * - 限流接法：
 *   电源 ε,r → 开关 → 电流表 rA → 滑动变阻器 R
 *   电压表 rV 并联在电源两端（测路端电压）
 * - 分压接法：
 *   滑动变阻器整段跨接在电源两端，滑片作为输出节点
 *   负载支路（负载电阻）接在滑片与电源负极之间
 *   电流表串在电源正极与外电路之间，读主支路电流
 *   电压表仍并联在电源两端，读路端电压
 *
 * 物理公式：
 * - 限流接法：
 *   R_eff = 接入段电阻
 *   主路：rA + R_eff
 *   并联：(rA + R_eff) ∥ rV
 * - 分压接法：
 *   R_upper = 滑片上段
 *   R_lower = 滑片下段
 *   R_load = rA + R_external
 *   R_lower_eq = R_lower ∥ R_load ∥ rV
 *   外电路等效：R_upper + R_lower_eq
 *   U_out = I_branch × R_lower_eq（滑片输出电压）
 *
 * 理想关系（忽略仪表影响）：
 *   U = ε - I * r （U-I 线性关系）
 *   截距 = ε，斜率 = -r
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  // 查找各元件（可调电阻：滑动变阻器 或 电阻箱均可）
  const source = findComponent(scene.entities, 'dc-source');
  const rheostat = findByFamily(scene.entities, isVariableResistor);
  const loadResistor = findByFamily(scene.entities, isFixedResistance);
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

  if (!source || !rheostat || !ammeter || !voltmeter) {
    return { time: 0, forceAnalyses, motionStates };
  }

  source.properties.circuitType = 'measure-emf-r';

  const emf = (source.properties.emf as number) ?? 6;
  const r = (source.properties.internalResistance as number) ?? 1;
  const rA = (ammeter.properties.internalResistance as number) ?? 0.2;
  const rV = (voltmeter.properties.internalResistance as number) ?? 3000;
  const configuredRheostatResistance = getConfiguredResistance(rheostat);
  const connectionMode = getRheostatConnectionMode(rheostat);

  source.properties.measureMode = connectionMode;
  source.properties.voltageMeasurementMode = 'terminal';

  // 检查开关状态
  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;

  if (!switchClosed) {
    const openTerminal = computeOpenTerminalState(emf, r, rV);
    ammeter.properties.reading = 0;
    ammeter.properties.overRange = false;
    checkOverRange(voltmeter, openTerminal.terminalVoltage, (voltmeter.properties.range as number) ?? 15);
    source.properties.totalCurrent = openTerminal.totalCurrent;
    source.properties.terminalVoltage = openTerminal.terminalVoltage;
    source.properties.outputVoltage = 0;
    source.properties.externalBranchResistance = undefined;
    source.properties.lastU = openTerminal.terminalVoltage;
    rheostat.properties.voltage = 0;
    rheostat.properties.current = 0;
    rheostat.properties.outputVoltage = 0;
    if (loadResistor) {
      loadResistor.properties.voltage = 0;
      loadResistor.properties.current = 0;
    }
    source.properties.outputCurrent = 0;
    source.properties.lastI = 0;
    return { time: 0, forceAnalyses, motionStates };
  }

  // 计算电路（考虑故障状态）
  const R_rheostat_eff = getEffectiveResistance(rheostat);
  // 故障：变阻器断路时回路断开
  if (!isFinite(R_rheostat_eff)) {
    const openTerminal = computeOpenTerminalState(emf, r, rV);
    ammeter.properties.reading = 0;
    ammeter.properties.overRange = false;
    checkOverRange(voltmeter, openTerminal.terminalVoltage, (voltmeter.properties.range as number) ?? 15);
    source.properties.totalCurrent = openTerminal.totalCurrent;
    source.properties.terminalVoltage = openTerminal.terminalVoltage;
    source.properties.outputVoltage = 0;
    source.properties.externalBranchResistance = undefined;
    source.properties.lastU = openTerminal.terminalVoltage;
    rheostat.properties.voltage = 0;
    rheostat.properties.current = 0;
    rheostat.properties.outputVoltage = 0;
    rheostat.properties.hasFault = true;
    rheostat.properties.activeFault = 'open';
    if (loadResistor) {
      loadResistor.properties.voltage = 0;
      loadResistor.properties.current = 0;
    }
    source.properties.outputCurrent = 0;
    source.properties.lastI = 0;
    return { time: 0, forceAnalyses, motionStates };
  }
  rheostat.properties.hasFault = Math.abs(R_rheostat_eff - configuredRheostatResistance) > 1e-9;
  rheostat.properties.activeFault = (rheostat.properties.faultType as string) ?? 'none';

  let I_total = 0;
  let U_terminal = 0;
  let I_A = 0;
  let U_V = 0;
  let outputVoltage = 0;

  if (connectionMode === 'divider') {
    const sliderRatio = clampRatio((rheostat.properties.sliderRatio as number) ?? 0.5);
    const R_upper = R_rheostat_eff * (1 - sliderRatio);
    const R_lower = R_rheostat_eff * sliderRatio;
    const R_loadExternal = loadResistor ? getEffectiveResistance(loadResistor) : 20;
    const R_loadBranch = Number.isFinite(R_loadExternal) ? Math.max(R_loadExternal, 0) : Infinity;
    const R_lowerEq = parallelResistanceMany([R_lower, R_loadBranch]);
    const R_externalBranch = rA + R_upper + R_lowerEq;
    const R_parallel = parallelResistanceMany([R_externalBranch, rV]);
    const R_total = R_parallel + r;

    I_total = emf / Math.max(R_total, 1e-6);
    U_terminal = emf - I_total * r;
    I_A = U_terminal / Math.max(R_externalBranch, 1e-6);
    outputVoltage = I_A * R_lowerEq;
    U_V = U_terminal;
    const I_load = Number.isFinite(R_loadBranch) ? outputVoltage / Math.max(R_loadBranch, 1e-6) : 0;

    checkOverRange(ammeter, I_A, (ammeter.properties.range as number) ?? 0.6);
    checkOverRange(voltmeter, U_V, (voltmeter.properties.range as number) ?? 15);

    rheostat.properties.voltage = U_terminal;
    rheostat.properties.current = I_A;
    rheostat.properties.outputVoltage = outputVoltage;
    rheostat.properties.upperResistance = R_upper;
    rheostat.properties.lowerResistance = R_lower;
    rheostat.properties.outputEquivalentResistance = R_lowerEq;

    if (loadResistor) {
      loadResistor.properties.voltage = I_load * Math.max(Number(loadResistor.properties.resistance ?? 0), 0);
      loadResistor.properties.current = I_load;
    }

    source.properties.totalCurrent = I_total;
    source.properties.terminalVoltage = U_terminal;
    source.properties.outputVoltage = outputVoltage;
    source.properties.outputCurrent = I_load;
    source.properties.externalBranchResistance = R_externalBranch;
    source.properties.lastI = I_A;
    source.properties.lastU = U_terminal;
  } else {
    const R_eff = R_rheostat_eff; // 滑动变阻器接入段阻值
    const R_main = rA + R_eff; // 主路电阻（电流表 + 变阻器）
    const R_parallel = parallelResistance(R_main, rV); // 主路与电压表并联
    const R_total = R_parallel + r; // 总电阻

    I_total = emf / Math.max(R_total, 1e-6); // 总电流
    U_terminal = emf - I_total * r; // 端电压
    I_A = U_terminal / Math.max(R_main, 1e-6);
    U_V = U_terminal;
    outputVoltage = U_terminal;

    checkOverRange(ammeter, I_A, (ammeter.properties.range as number) ?? 0.6);
    checkOverRange(voltmeter, U_V, (voltmeter.properties.range as number) ?? 15);

    rheostat.properties.voltage = I_A * R_eff;
    rheostat.properties.current = I_A;
    rheostat.properties.outputVoltage = outputVoltage;
    rheostat.properties.upperResistance = undefined;
    rheostat.properties.lowerResistance = undefined;
    rheostat.properties.outputEquivalentResistance = undefined;

    if (loadResistor) {
      loadResistor.properties.voltage = 0;
      loadResistor.properties.current = 0;
    }

    source.properties.totalCurrent = I_total;
    source.properties.terminalVoltage = U_terminal;
    source.properties.outputVoltage = outputVoltage;
    source.properties.outputCurrent = I_A;
    source.properties.externalBranchResistance = R_main;
    source.properties.lastI = I_A;
    source.properties.lastU = U_V;
  }
  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function parallelResistanceMany(resistances: number[]): number {
  let reciprocalSum = 0;

  for (const resistance of resistances) {
    if (!Number.isFinite(resistance)) continue;
    if (resistance <= 0) return 0;
    reciprocalSum += 1 / resistance;
  }

  return reciprocalSum > 0 ? 1 / reciprocalSum : Infinity;
}

function computeOpenTerminalState(
  emf: number,
  sourceInternalResistance: number,
  voltmeterResistance: number,
): { totalCurrent: number; terminalVoltage: number } {
  const totalCurrent = emf / Math.max(sourceInternalResistance + voltmeterResistance, 1e-6);
  return {
    totalCurrent,
    terminalVoltage: emf - totalCurrent * sourceInternalResistance,
  };
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0.01, Math.min(1, value));
}

export function registerMeasureEmfRSolver(): void {
  solverRegistry.register({
    id: 'em-measure-emf-r',
    label: '测电源EMF和内阻',
    pattern: {
      entityTypes: ['dc-source', 'slide-rheostat', 'ammeter', 'voltmeter'],
      relationType: 'connection',
      qualifier: { circuit: 'measure-emf-r' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
