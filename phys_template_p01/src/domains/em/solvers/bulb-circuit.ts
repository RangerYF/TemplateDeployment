import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  checkOverRange,
  findComponent,
  findPreferredComponent,
  resetInactiveInstrumentReadings,
  setInstrumentActivity,
} from '../logic/circuit-solver-utils';

/**
 * 灯泡（非线性电阻）电路求解器
 *
 * 电路拓扑：电源 ε,r → 开关 → 灯泡
 *
 * 非线性模型（简化温度效应）：
 *   额定工况：R_hot = U_rated² / P_rated
 *   额定电流：I_rated = P_rated / U_rated
 *   电阻随电流变化：R(I) = R_cold + (R_hot - R_cold) * min(1, (I / I_rated)²)
 *
 * 迭代求解（不动点迭代，收敛快）：
 *   I_n+1 = ε / (R(I_n) + r)
 */

export interface BulbOperatingPointInput {
  emf: number;
  internalResistance: number;
  ammeterResistance?: number;
  ratedVoltage: number;
  ratedPower: number;
  coldResistance: number;
}

export interface BulbOperatingPoint {
  current: number;
  voltage: number;
  resistance: number;
  power: number;
  ratedHotResistance: number;
  ratedCurrent: number;
}

/**
 * 灯泡工作点求解
 *
 * 保持与求解器相同的非线性模型，供 UI 记录示例数据和曲线生成复用。
 */
export function solveBulbOperatingPoint({
  emf,
  internalResistance,
  ammeterResistance = 0,
  ratedVoltage,
  ratedPower,
  coldResistance,
}: BulbOperatingPointInput): BulbOperatingPoint {
  const sourceResistance = Math.max(0, internalResistance + ammeterResistance);
  const ratedHotResistance =
    ratedPower > 0 ? (ratedVoltage * ratedVoltage) / ratedPower : coldResistance;
  const ratedCurrent = ratedPower > 0 ? ratedPower / ratedVoltage : 1;

  function bulbResistance(current: number): number {
    const ratio = Math.min(1, (current / ratedCurrent) ** 2);
    return coldResistance + (ratedHotResistance - coldResistance) * ratio;
  }

  let current = emf / Math.max(coldResistance + sourceResistance, 1e-6);
  for (let iter = 0; iter < 20; iter++) {
    const nextResistance = bulbResistance(current);
    const nextCurrent = emf / Math.max(nextResistance + sourceResistance, 1e-6);
    if (Math.abs(nextCurrent - current) < 1e-8) break;
    current = nextCurrent;
  }

  const resistance = bulbResistance(current);
  const voltage = current * resistance;

  return {
    current,
    voltage,
    resistance,
    power: voltage * current,
    ratedHotResistance,
    ratedCurrent,
  };
}

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const source = findComponent(scene.entities, 'dc-source');
  const bulb = findComponent(scene.entities, 'bulb');
  const sw = findComponent(scene.entities, 'switch');
  const preferredCurrentMeterId = scene.paramValues.activeCurrentMeterId as string | undefined;
  const preferredVoltmeterId = scene.paramValues.activeVoltmeterId as string | undefined;
  const ammeter = findPreferredComponent(scene.entities, 'ammeter', preferredCurrentMeterId);
  const voltmeter = findPreferredComponent(scene.entities, 'voltmeter', preferredVoltmeterId);

  setInstrumentActivity(scene.entities, {
    activeCurrentMeterId: ammeter?.id,
    activeVoltmeterId: voltmeter?.id,
  });
  resetInactiveInstrumentReadings(scene.entities, {
    activeCurrentMeterId: ammeter?.id,
    activeVoltmeterId: voltmeter?.id,
  });

  if (!source || !bulb) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;

  const emf = (source.properties.emf as number) ?? 6;
  const r = (source.properties.internalResistance as number) ?? 1;
  const rA = ammeter ? ((ammeter.properties.internalResistance as number) ?? 0) : 0;

  const U_rated = (bulb.properties.ratedVoltage as number) ?? 3.8;
  const P_rated = (bulb.properties.ratedPower as number) ?? 0.3;
  const R_cold = (bulb.properties.coldResistance as number) ?? 2;
  const operatingPoint = solveBulbOperatingPoint({
    emf,
    internalResistance: r,
    ammeterResistance: rA,
    ratedVoltage: U_rated,
    ratedPower: P_rated,
    coldResistance: R_cold,
  });

  source.properties.circuitType = 'bulb-circuit';
  source.properties.bulbCurrent = 0;
  source.properties.bulbVoltage = 0;
  source.properties.bulbResistance = Number.POSITIVE_INFINITY;
  source.properties.bulbPower = 0;
  source.properties.bulbRatedHotResistance = operatingPoint.ratedHotResistance;
  source.properties.bulbRatedCurrent = operatingPoint.ratedCurrent;

  if (!switchClosed) {
    bulb.properties.voltage = 0;
    bulb.properties.current = 0;
    bulb.properties.power = 0;
    bulb.properties.hotResistance = R_cold;
    if (ammeter) { ammeter.properties.reading = 0; ammeter.properties.overRange = false; }
    if (voltmeter) { voltmeter.properties.reading = 0; voltmeter.properties.overRange = false; }
    source.properties.totalCurrent = 0;
    source.properties.terminalVoltage = emf;
    return { time: 0, forceAnalyses, motionStates };
  }

  const I = operatingPoint.current;
  const U_bulb = operatingPoint.voltage;
  const R_actual = operatingPoint.resistance;
  const P_actual = operatingPoint.power;

  // 写入灯泡状态
  bulb.properties.hotResistance = R_actual;
  bulb.properties.voltage = U_bulb;
  bulb.properties.current = I;
  bulb.properties.power = P_actual;

  // 电源状态
  source.properties.totalCurrent = I;
  source.properties.terminalVoltage = emf - I * r;
  source.properties.bulbCurrent = I;
  source.properties.bulbVoltage = U_bulb;
  source.properties.bulbResistance = R_actual;
  source.properties.bulbPower = P_actual;

  // 仪表更新
  if (ammeter) {
    checkOverRange(ammeter, I, (ammeter.properties.range as number) ?? 0.6);
  }
  if (voltmeter) {
    checkOverRange(voltmeter, U_bulb, (voltmeter.properties.range as number) ?? 15);
  }

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerBulbCircuitSolver(): void {
  solverRegistry.register({
    id: 'em-bulb-circuit',
    label: '灯泡电路（非线性电阻）',
    pattern: {
      entityTypes: ['dc-source', 'bulb'],
      relationType: 'connection',
      qualifier: { circuit: 'bulb-circuit' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
