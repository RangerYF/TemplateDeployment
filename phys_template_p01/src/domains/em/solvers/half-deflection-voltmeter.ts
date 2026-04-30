import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  checkOverRange,
  findAllComponents,
  findByFamily,
  findPreferredComponent,
  getEffectiveResistance,
  isFixedResistance,
  isVariableResistor,
  resetInactiveInstrumentReadings,
  setInstrumentActivity,
} from '../logic/circuit-solver-utils';
import { calculateVoltmeterHalfDeflection } from '../logic/half-deflection-calculator';

/**
 * 半偏法测电压表内阻求解器
 *
 * 电路拓扑：
 *   电源 ε,r → 开关S → 滑动变阻器R → [ 开关S' 短接 / 电阻R' ] → 电压表V
 *
 * 教学要点：
 * - Step 1：闭合短接开关 S'，调滑动变阻器得到基准读数 U0。
 * - Step 2：断开 S'，调 R' 使电压表示数变为 U0/2。
 * - 理想条件：认为分压近似不变，则 R' ≈ rV。
 * - 真实情况：串联总电阻增大，测得 R' 偏大。
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const source = findByFamily(scene.entities, (type) => type === 'dc-source');
  const preferredVoltmeterId = scene.paramValues.activeVoltmeterId as string | undefined;
  const voltmeter = findPreferredComponent(scene.entities, 'voltmeter', preferredVoltmeterId);
  const rheostat = findByFamily(scene.entities, isVariableResistor);
  const halfResistor = findByFamily(scene.entities, isFixedResistance);
  const switches = findAllComponents(scene.entities, 'switch');

  setInstrumentActivity(scene.entities, {
    activeVoltmeterId: voltmeter?.id,
  });
  resetInactiveInstrumentReadings(scene.entities, {
    activeVoltmeterId: voltmeter?.id,
  });

  if (!source || !voltmeter || !rheostat || !halfResistor || switches.length < 2) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const sortedSwitches = [...switches].sort(
    (a, b) => a.transform.position.x - b.transform.position.x,
  );
  const mainSwitch = sortedSwitches[0]!;
  const bypassSwitch = sortedSwitches[1]!;

  const mainClosed = (mainSwitch.properties.closed as boolean) !== false;
  const bypassClosed = (bypassSwitch.properties.closed as boolean) !== false;

  const emf = (source.properties.emf as number) ?? 6;
  const sourceInternalResistance = (source.properties.internalResistance as number) ?? 0;
  const rheostatResistance = getEffectiveResistance(rheostat);
  const meterResistance = (voltmeter.properties.internalResistance as number) ?? 3000;
  const halfResistance = (halfResistor.properties.resistance as number) ?? meterResistance;
  const voltageRange = (voltmeter.properties.range as number) ?? 3;

  source.properties.circuitType = 'half-deflection-voltmeter';
  source.properties.halfDeflectionMode = 'voltmeter';

  if (!mainClosed) {
    checkOverRange(voltmeter, 0, voltageRange);
    voltmeter.properties.deflectionRatio = 0;

    rheostat.properties.current = 0;
    rheostat.properties.voltage = 0;
    halfResistor.properties.current = 0;
    halfResistor.properties.voltage = 0;

    source.properties.step = 'off';
    source.properties.totalCurrent = 0;
    source.properties.terminalVoltage = emf;
    source.properties.referenceReading = 0;
    source.properties.targetHalfReading = 0;
    source.properties.currentReading = 0;
    source.properties.isHalfDeflection = false;
    return { time: 0, forceAnalyses, motionStates };
  }

  const calc = calculateVoltmeterHalfDeflection(
    {
      emf,
      sourceInternalResistance,
      rheostatResistance,
      meterResistance,
      halfResistance,
    },
    bypassClosed,
  );

  checkOverRange(voltmeter, calc.meterReading, voltageRange);
  voltmeter.properties.deflectionRatio =
    voltageRange > 0 ? Math.min(calc.meterReading / voltageRange, 1.2) : 0;

  rheostat.properties.current = calc.totalCurrent;
  rheostat.properties.voltage = calc.totalCurrent * calc.rheostatResistance;
  halfResistor.properties.current = bypassClosed ? 0 : calc.totalCurrent;
  halfResistor.properties.voltage = bypassClosed ? 0 : calc.totalCurrent * calc.currentHalfResistance;

  source.properties.step = bypassClosed ? 'step1' : 'step2';
  source.properties.totalCurrent = calc.totalCurrent;
  source.properties.terminalVoltage = emf - calc.totalCurrent * sourceInternalResistance;
  source.properties.referenceReading = calc.referenceReading;
  source.properties.targetHalfReading = calc.targetHalfReading;
  source.properties.currentReading = calc.meterReading;
  source.properties.seriesResistance = calc.totalSeriesResistance;
  source.properties.rheostatResistance = calc.rheostatResistance;
  source.properties.idealHalfResistance = calc.idealHalfResistance;
  source.properties.exactHalfResistance = calc.exactHalfResistance;
  source.properties.currentHalfResistance = calc.currentHalfResistance;
  source.properties.idealMeasuredResistance = calc.idealMeasuredResistance;
  source.properties.realMeasuredResistance = calc.realMeasuredResistance;
  source.properties.idealErrorPercent = calc.idealErrorPercent;
  source.properties.realErrorPercent = calc.realErrorPercent;
  source.properties.currentErrorPercent = calc.currentErrorPercent;
  source.properties.trueInternalResistance = meterResistance;
  source.properties.isHalfDeflection = calc.isHalfDeflection;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerHalfDeflectionVoltmeterSolver(): void {
  solverRegistry.register({
    id: 'em-half-deflection-voltmeter',
    label: '半偏法测电压表内阻',
    pattern: {
      entityTypes: ['dc-source', 'voltmeter', 'slide-rheostat', 'fixed-resistor', 'switch'],
      relationType: 'connection',
      qualifier: { circuit: 'half-deflection-voltmeter' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
