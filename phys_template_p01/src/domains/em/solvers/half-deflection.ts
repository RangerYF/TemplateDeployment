import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  checkOverRange,
  findAllComponents,
  findByFamily,
  findPreferredByFamily,
  isFixedResistance,
  isCurrentMeter,
  resetInactiveInstrumentReadings,
  setInstrumentActivity,
} from '../logic/circuit-solver-utils';
import { inspectHalfDeflectionAmmeterTopology } from '../logic/half-deflection-ammeter-topology';
import { calculateSourceResistanceHalfDeflection } from '../logic/half-deflection-calculator';

/**
 * 半偏法测电源内阻求解器（按教材近似）
 *
 * 电路拓扑：
 *   电源 ε,r → 主开关S → A_left → [ 电流表A / (S'+R') ] → A_right → 回路返回
 *
 * 教学要点：
 * - Step 1：保持 S' 断开，记录电流表基准读数 I0。
 * - Step 2：闭合 S' 后调 R'，使电流表示数变为 I0/2。
 * - 教材近似：若 A 表内阻远大于电源内阻，则半偏时可取 r ≈ R'。
 * - 更严格模型下，真正满足半偏的 R' 会略小于 r。
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const source = findByFamily(scene.entities, (type) => type === 'dc-source');
  const preferredCurrentMeterId = scene.paramValues.activeCurrentMeterId as string | undefined;
  const ammeter = findPreferredByFamily(scene.entities, isCurrentMeter, preferredCurrentMeterId);
  const halfResistor = findByFamily(scene.entities, isFixedResistance);
  const switches = findAllComponents(scene.entities, 'switch');

  setInstrumentActivity(scene.entities, {
    activeCurrentMeterId: ammeter?.id,
  });
  resetInactiveInstrumentReadings(scene.entities, {
    activeCurrentMeterId: ammeter?.id,
  });

  if (!source || !ammeter || !halfResistor || switches.length < 2) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const sortedSwitches = [...switches].sort(
    (a, b) => a.transform.position.x - b.transform.position.x,
  );
  const mainSwitch = sortedSwitches[0]!;
  const halfSwitch = sortedSwitches[1]!;

  const mainClosed = (mainSwitch.properties.closed as boolean) !== false;
  const branchClosed = (halfSwitch.properties.closed as boolean) !== false;

  const emf = (source.properties.emf as number) ?? 6;
  const sourceInternalResistance = (source.properties.internalResistance as number) ?? 0;
  const meterResistance = (ammeter.properties.internalResistance as number) ?? 0.2;
  const halfResistance = (halfResistor.properties.resistance as number) ?? sourceInternalResistance;
  const currentRange = (ammeter.properties.range as number) ?? 0.6;
  const topology = inspectHalfDeflectionAmmeterTopology({
    relations: scene.relations,
    source,
    mainSwitch,
    meter: ammeter,
    halfSwitch,
    halfResistor,
  });
  const effectiveMainClosed = mainClosed && topology.mainLoopValid;
  const effectiveBranchClosed = branchClosed && topology.branchAcrossMeter;

  source.properties.circuitType = 'half-deflection-ammeter';
  source.properties.halfDeflectionMode = 'ammeter';
  source.properties.topologyLeftNode = topology.leftNodeName;
  source.properties.topologyRightNode = topology.rightNodeName;
  source.properties.topologyValid = topology.valid;
  source.properties.parallelAcrossMeter = topology.branchAcrossMeter;
  source.properties.topologyNote = topology.note;

  if (!effectiveMainClosed) {
    checkOverRange(ammeter, 0, currentRange);
    ammeter.properties.deflectionRatio = 0;

    halfResistor.properties.current = 0;
    halfResistor.properties.voltage = 0;

    source.properties.step = 'off';
    source.properties.totalCurrent = 0;
    source.properties.terminalVoltage = emf;
    source.properties.referenceReading = 0;
    source.properties.targetHalfReading = 0;
    source.properties.currentReading = 0;
    source.properties.currentReadingRatio = 0;
    source.properties.estimatedResistance = 0;
    source.properties.parallelBranchCurrent = 0;
    source.properties.branchVoltage = 0;
    source.properties.branchCurrentNonZero = false;
    source.properties.approximationNote = mainClosed
      ? '主回路未按 A_left/A_right 正确闭合'
      : '主开关断开';
    source.properties.isHalfDeflection = false;
    return { time: 0, forceAnalyses, motionStates };
  }

  const calc = calculateSourceResistanceHalfDeflection(
    {
      emf,
      sourceInternalResistance,
      meterResistance,
      halfResistance,
    },
    effectiveBranchClosed,
  );

  checkOverRange(ammeter, calc.meterReading, currentRange);
  ammeter.properties.deflectionRatio =
    currentRange > 0 ? Math.min(calc.meterReading / currentRange, 1.2) : 0;

  halfResistor.properties.current = effectiveBranchClosed ? calc.shuntCurrent : 0;
  halfResistor.properties.voltage = effectiveBranchClosed ? calc.branchVoltage : 0;

  source.properties.step = effectiveBranchClosed ? 'step2' : 'step1';
  source.properties.totalCurrent = calc.totalCurrent;
  source.properties.terminalVoltage = emf - calc.totalCurrent * sourceInternalResistance;
  source.properties.referenceReading = calc.initialReading;
  source.properties.targetHalfReading = calc.targetHalfReading;
  source.properties.currentReading = calc.meterReading;
  source.properties.currentReadingRatio = calc.readingRatio;
  source.properties.parallelBranchCurrent = effectiveBranchClosed ? calc.shuntCurrent : 0;
  source.properties.branchVoltage = effectiveBranchClosed ? calc.branchVoltage : 0;
  source.properties.branchCurrentNonZero = effectiveBranchClosed && calc.shuntCurrent > 1e-9;
  source.properties.seriesResistance = sourceInternalResistance;
  source.properties.rheostatResistance = 0;
  source.properties.idealHalfResistance = calc.idealEstimatedResistance;
  source.properties.exactHalfResistance = calc.exactHalfResistance;
  source.properties.currentHalfResistance = calc.currentEstimatedResistance;
  source.properties.estimatedResistance = calc.currentEstimatedResistance;
  source.properties.idealMeasuredResistance = calc.idealEstimatedResistance;
  source.properties.realMeasuredResistance = calc.exactHalfResistance;
  source.properties.idealErrorPercent = 0;
  source.properties.realErrorPercent = calc.approximationErrorPercent;
  source.properties.currentErrorPercent = calc.currentErrorPercent;
  source.properties.trueInternalResistance = sourceInternalResistance;
  source.properties.meterInternalResistance = meterResistance;
  source.properties.approximationNote =
    !topology.branchAcrossMeter
      ? "S'+R' 未跨接在 A 表两端，当前不会出现半偏"
      : meterResistance >= sourceInternalResistance * 5
      ? '按教材近似：A表内阻远大于电源内阻，可取 r≈R\''
      : '当前参数下 A表内阻不够大，r≈R\' 仅作近似估计';
  source.properties.isHalfDeflection = effectiveBranchClosed && calc.isHalfDeflection;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerHalfDeflectionSolver(): void {
  solverRegistry.register({
    id: 'em-half-deflection-ammeter',
    label: '半偏法测电源内阻',
    pattern: {
      entityTypes: ['dc-source', 'ammeter', 'fixed-resistor', 'switch'],
      relationType: 'connection',
      qualifier: { circuit: 'half-deflection-ammeter' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
