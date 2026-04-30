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
 * 电动机电路求解器（含反电动势）
 *
 * 电路拓扑：电源 ε,r → 开关 → 电动机(ε_反, R_coil)
 *
 * 物理公式：
 *   I = (ε - ε_反) / (R_coil + r)
 *   U_motor = ε_反 + I·R_coil     （电动机两端电压）
 *   P_电 = U_motor · I             （电功率 = 总输入）
 *   P_热 = I² · R_coil             （热功率 = 线圈发热）
 *   P_机 = P_电 - P_热 = ε_反 · I  （机械功率 = 有效输出）
 *
 * 注意：ε_反 < ε 时电动机正常运转，ε_反 ≥ ε 时电流为零
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const source = findComponent(scene.entities, 'dc-source');
  const motor = findComponent(scene.entities, 'motor');
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

  if (!source || !motor) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;

  if (!switchClosed) {
    motor.properties.voltage = 0;
    motor.properties.current = 0;
    motor.properties.electricPower = 0;
    motor.properties.heatPower = 0;
    motor.properties.mechanicalPower = 0;
    if (ammeter) { ammeter.properties.reading = 0; ammeter.properties.overRange = false; }
    if (voltmeter) { voltmeter.properties.reading = 0; voltmeter.properties.overRange = false; }
    source.properties.totalCurrent = 0;
    source.properties.terminalVoltage = (source.properties.emf as number) ?? 6;
    source.properties.circuitType = 'motor-circuit';
    return { time: 0, forceAnalyses, motionStates };
  }

  const emf = (source.properties.emf as number) ?? 6;
  const r = (source.properties.internalResistance as number) ?? 1;
  const backEmf = (motor.properties.backEmf as number) ?? 2;
  const R_coil = (motor.properties.coilResistance as number) ?? 1;
  const rA = ammeter ? ((ammeter.properties.internalResistance as number) ?? 0) : 0;

  // 电流计算
  const netEmf = emf - backEmf;
  const I = netEmf > 0 ? netEmf / (R_coil + rA + r) : 0;

  // 电动机两端电压
  const U_motor = I > 0 ? backEmf + I * R_coil : 0;

  // 功率分解
  const P_electric = U_motor * I;
  const P_heat = I * I * R_coil;
  const P_mechanical = backEmf * I;

  // 写入电动机状态
  motor.properties.voltage = U_motor;
  motor.properties.current = I;
  motor.properties.electricPower = P_electric;
  motor.properties.heatPower = P_heat;
  motor.properties.mechanicalPower = P_mechanical;

  // 电源状态
  source.properties.totalCurrent = I;
  source.properties.terminalVoltage = emf - I * r;
  source.properties.circuitType = 'motor-circuit';

  // 仪表更新
  if (ammeter) {
    checkOverRange(ammeter, I, (ammeter.properties.range as number) ?? 0.6);
  }
  if (voltmeter) {
    checkOverRange(voltmeter, U_motor, (voltmeter.properties.range as number) ?? 15);
  }

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerMotorCircuitSolver(): void {
  solverRegistry.register({
    id: 'em-motor-circuit',
    label: '电动机电路（反电动势）',
    pattern: {
      entityTypes: ['dc-source', 'motor'],
      relationType: 'connection',
      qualifier: { circuit: 'motor-circuit' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
