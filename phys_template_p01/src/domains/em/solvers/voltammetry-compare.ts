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
 * 伏安法内/外接法一键切换对比求解器
 *
 * 同时计算理想模型、内接法、外接法三组数据，供视角层并列展示。
 *
 * 判据：Rx 与 √(rA·rV) 比较
 *   Rx > √(rA·rV) → 推荐内接法
 *   Rx < √(rA·rV) → 推荐外接法
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

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

  const setCompareProperties = (values: Record<string, number | string | undefined>) => {
    for (const [key, value] of Object.entries(values)) {
      source.properties[key] = value;
    }
  };

  const emf = (source.properties.emf as number) ?? 6;
  const r = (source.properties.internalResistance as number) ?? 1;
  const Rx_eff = getEffectiveResistance(resistor);
  const Rx = (resistor.properties.resistance as number) ?? 10;
  const rA = (ammeter.properties.internalResistance as number) ?? 0.2;
  const rV = (voltmeter.properties.internalResistance as number) ?? 3000;
  const requestedMethod = scene.paramValues.method as string | undefined;
  const threshold = Math.sqrt(rA * rV);
  const recommendedMethod = Rx >= threshold ? 'internal' : 'external';
  const currentMethod =
    requestedMethod === 'internal' || requestedMethod === 'external'
      ? requestedMethod
      : recommendedMethod;

  resistor.properties.hasFault = Rx_eff !== Rx;
  resistor.properties.activeFault = (resistor.properties.faultType as string) ?? 'none';

  source.properties.circuitType = 'voltammetry-compare';
  source.properties.currentMethod = currentMethod;
  source.properties.recommendedMethod = recommendedMethod;
  source.properties.threshold = threshold;
  source.properties.trueR = Rx;
  source.properties.measuredR = undefined;
  source.properties.error = undefined;
  source.properties.voltmeterBranchCurrent = 0;

  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;

  if (!switchClosed) {
    ammeter.properties.reading = 0;
    ammeter.properties.overRange = false;
    voltmeter.properties.reading = 0;
    voltmeter.properties.overRange = false;
    resistor.properties.voltage = 0;
    resistor.properties.current = 0;
    source.properties.totalCurrent = 0;
    source.properties.terminalVoltage = emf;
    setCompareProperties({
      measuredR: undefined,
      trueR: Rx,
      error: undefined,
      idealI: undefined,
      idealV: undefined,
      idealMeasuredR: undefined,
      idealError: undefined,
      internalI: undefined,
      internalV: undefined,
      measuredR_internal: undefined,
      error_internal: undefined,
      externalI: undefined,
      externalV: undefined,
      measuredR_external: undefined,
      error_external: undefined,
    });
    return { time: 0, forceAnalyses, motionStates };
  }

  // 故障处理
  if (!isFinite(Rx_eff)) {
    const internalSourceCurrent = emf / Math.max(r + rV, 1e-6);
    const internalVoltage = emf - internalSourceCurrent * r;
    const externalSourceCurrent = emf / Math.max(rA + rV + r, 1e-6);
    const externalVoltage = externalSourceCurrent * rV;

    const selectedSourceCurrent = currentMethod === 'internal'
      ? internalSourceCurrent
      : externalSourceCurrent;
    const selectedVoltage = currentMethod === 'internal'
      ? internalVoltage
      : externalVoltage;
    const selectedAmmeterReading = currentMethod === 'internal'
      ? 0
      : externalSourceCurrent;

    checkOverRange(ammeter, selectedAmmeterReading, (ammeter.properties.range as number) ?? 0.6);
    checkOverRange(voltmeter, selectedVoltage, (voltmeter.properties.range as number) ?? 3);
    resistor.properties.voltage = 0;
    resistor.properties.current = 0;
    source.properties.totalCurrent = selectedSourceCurrent;
    source.properties.terminalVoltage = emf - selectedSourceCurrent * r;
    source.properties.voltmeterBranchCurrent = currentMethod === 'internal'
      ? internalSourceCurrent
      : externalSourceCurrent;
    setCompareProperties({
      measuredR: undefined,
      trueR: Rx,
      error: undefined,
      idealI: undefined,
      idealV: undefined,
      idealMeasuredR: undefined,
      idealError: undefined,
      internalI: 0,
      internalV: internalVoltage,
      measuredR_internal: undefined,
      error_internal: undefined,
      externalI: externalSourceCurrent,
      externalV: externalVoltage,
      measuredR_external: undefined,
      error_external: undefined,
    });
    return { time: 0, forceAnalyses, motionStates };
  }

  // 理想模型
  const idealI = emf / Math.max(Rx_eff + r, 1e-6);
  const idealV = idealI * Rx_eff;
  const idealMeasuredR = idealI > 0 ? idealV / idealI : 0;
  const idealError = Rx > 0 ? (idealMeasuredR - Rx) / Rx : 0;

  // 内接法
  const R_series_int = rA + Rx_eff;
  const R_par_int = parallelResistance(R_series_int, rV);
  const I_total_int = emf / Math.max(R_par_int + r, 1e-6);
  const U_par_int = I_total_int * R_par_int;
  const I_A_int = U_par_int / Math.max(R_series_int, 1e-6);
  const measuredR_int = I_A_int > 0 ? U_par_int / I_A_int : 0;
  const errInt = Rx > 0 ? (measuredR_int - Rx) / Rx : 0;

  // 外接法
  const R_par_ext = parallelResistance(Rx_eff, rV);
  const I_A_ext = emf / Math.max(rA + R_par_ext + r, 1e-6);
  const U_V_ext = I_A_ext * R_par_ext;
  const measuredR_ext = I_A_ext > 0 ? U_V_ext / I_A_ext : 0;
  const errExt = Rx > 0 ? (measuredR_ext - Rx) / Rx : 0;

  // 画布主读数沿用“更准确接法”，同时保持电源总电流/端电压为对应接法下的真实总量
  const I_A = currentMethod === 'internal' ? I_A_int : I_A_ext;
  const U_V = currentMethod === 'internal' ? U_par_int : U_V_ext;
  const sourceCurrent = currentMethod === 'internal' ? I_total_int : I_A_ext;
  const resistorCurrent = currentMethod === 'internal' ? I_A_int : U_V_ext / Math.max(Rx_eff, 1e-6);
  const voltmeterBranchCurrent = currentMethod === 'internal'
    ? U_par_int / Math.max(rV, 1e-6)
    : U_V_ext / Math.max(rV, 1e-6);

  // 更新仪表
  checkOverRange(ammeter, I_A, (ammeter.properties.range as number) ?? 0.6);
  checkOverRange(voltmeter, U_V, (voltmeter.properties.range as number) ?? 3);

  resistor.properties.voltage = U_V;
  resistor.properties.current = resistorCurrent;

  // 当前接法的测量值
  const measuredR = I_A > 0 ? U_V / I_A : 0;
  source.properties.totalCurrent = sourceCurrent;
  source.properties.terminalVoltage = emf - sourceCurrent * r;
  source.properties.measuredR = measuredR;
  source.properties.trueR = Rx;
  source.properties.error = Rx > 0 ? (measuredR - Rx) / Rx : 0;

  source.properties.measuredR_internal = measuredR_int;
  source.properties.error_internal = errInt;
  source.properties.internalI = I_A_int;
  source.properties.internalV = U_par_int;
  source.properties.measuredR_external = measuredR_ext;
  source.properties.error_external = errExt;
  source.properties.externalI = I_A_ext;
  source.properties.externalV = U_V_ext;
  source.properties.idealI = idealI;
  source.properties.idealV = idealV;
  source.properties.idealMeasuredR = idealMeasuredR;
  source.properties.idealError = idealError;

  // 推荐接法判据
  source.properties.threshold = threshold;
  source.properties.recommendedMethod = recommendedMethod;
  source.properties.currentMethod = currentMethod;
  source.properties.voltmeterBranchCurrent = voltmeterBranchCurrent;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerVoltammetryCompareSolver(): void {
  solverRegistry.register({
    id: 'em-voltammetry-compare',
    label: '伏安法·内外接法对比',
    pattern: {
      entityTypes: ['dc-source', 'fixed-resistor', 'ammeter', 'voltmeter'],
      relationType: 'connection',
      qualifier: { circuit: 'voltammetry-compare' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
