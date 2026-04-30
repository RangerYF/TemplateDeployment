import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  findComponent,
  findPreferredByFamily,
  getEffectiveResistance,
  isCurrentMeter,
  resetInactiveInstrumentReadings,
  setInstrumentActivity,
} from '../logic/circuit-solver-utils';
import {
  canZeroExactly,
  computeActualTheta,
  computeCurrent,
  computeHalfDeflectionResistance,
  computeIdealInternalResistance,
  computeRmid,
  computeZeroedSeriesResistance,
} from '../logic/ohmmeter-physics';

/**
 * 串联式欧姆表求解器
 *
 * 闭合回路：E, r → G(Rg) → R0 → 红端 → Rx → 黑端 → 回到 E
 *
 * 单闭环公式：I = E / (Rg + r + R0 + Rx)
 *
 * 调零：当 Rx = 0 时调节 R0，使 I = Ig。
 * 中值电阻：理想调零后满足 θ = 0.5 时的 Rx，且 R中 = Rg + r + R0 = E / Ig。
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const source = findComponent(scene.entities, 'dc-source');
  const preferredCurrentMeterId = scene.paramValues.activeCurrentMeterId as string | undefined;
  const galv = findPreferredByFamily(scene.entities, isCurrentMeter, preferredCurrentMeterId);
  const rheostat = findComponent(scene.entities, 'slide-rheostat');
  const rxEntity = findComponent(scene.entities, 'resistance-box');
  const sw = findComponent(scene.entities, 'switch');

  setInstrumentActivity(scene.entities, {
    activeCurrentMeterId: galv?.id,
  });
  resetInactiveInstrumentReadings(scene.entities, {
    activeCurrentMeterId: galv?.id,
  });

  if (!source || !galv || !rheostat) {
    return { time: 0, forceAnalyses, motionStates };
  }

  // 标记电路类型（确保渲染走专用路径）
  source.properties.circuitType = 'ohmmeter';

  // ── 读取参数（每个值都从原始属性读，不依赖之前的计算结果） ──
  const emf = (source.properties.emf as number) ?? 1.5;
  const batteryInternalResistance = (source.properties.internalResistance as number) ?? 0;
  const Rg = (galv.properties.internalResistance as number) ?? 1000;

  // 满偏电流：从预设的原始 range 读取（可能是 A 也可能是 μA）
  // 预设中 range=0.0001 表示 0.0001A；如果被旧代码覆盖为 100 表示 100μA
  let Ig = (galv.properties.range as number) ?? 0.0001;
  if (Ig > 1) {
    // range > 1 说明单位是 μA，转成 A
    Ig = Ig * 1e-6;
  }

  // R₀（调零电阻）— 变阻器模式下 R₀ = R_max × sliderRatio（A-W 段电阻）
  const R0 = getEffectiveResistance(rheostat);

  // Rx（待测电阻）：无 Rx 实体时视为断路
  const Rx = rxEntity ? ((rxEntity.properties.resistance as number) ?? 0) : Infinity;
  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;
  const idealInternalResistance = computeIdealInternalResistance(emf, Ig);
  const zeroedSeriesResistance = computeZeroedSeriesResistance(emf, Ig, Rg, batteryInternalResistance);
  const R_mid = computeRmid(Rg, batteryInternalResistance, zeroedSeriesResistance);
  const R_internal = computeRmid(Rg, batteryInternalResistance, R0);
  const currentSystem = {
    emf,
    fullScaleCurrent: Ig,
    galvanometerResistance: Rg,
    batteryInternalResistance,
    seriesResistance: R0,
  };
  const zeroingThetaAtRxZero = computeActualTheta(currentSystem, 0);
  const isZeroed = Math.abs(zeroingThetaAtRxZero - 1) < 0.02;
  const midTolerance = Math.max(1, R_mid * 0.01);
  const isMidResistance = isFinite(Rx) && Math.abs(Rx - R_mid) <= midTolerance;
  const currentHalfDeflectionResistance = computeHalfDeflectionResistance(currentSystem);
  const canZero = canZeroExactly(emf, Ig, Rg, batteryInternalResistance);

  if (!switchClosed) {
    galv.properties.range = Ig;
    galv.properties.reading = 0;
    galv.properties.overRange = false;
    galv.properties.deflectionRatio = 0;
    rheostat.properties.voltage = 0;
    rheostat.properties.current = 0;
    if (rxEntity) {
      rxEntity.properties.voltage = 0;
      rxEntity.properties.current = 0;
    }
    source.properties.totalCurrent = 0;
    source.properties.ohmReading = isFinite(Rx) ? Rx : Infinity;
    source.properties.deflectionRatio = 0;
    source.properties.R_mid = R_mid;
    source.properties.R_internal = R_internal;
    source.properties.idealR_internal = idealInternalResistance;
    source.properties.isZeroed = isZeroed;
    source.properties.zeroingThetaAtRxZero = zeroingThetaAtRxZero;
    source.properties.currentHalfDeflectionResistance = currentHalfDeflectionResistance;
    source.properties.canZero = canZero;
    source.properties.batteryInternalResistance = batteryInternalResistance;
    source.properties.zeroedSeriesResistance = zeroedSeriesResistance;
    source.properties.trueRx = isFinite(Rx) ? Rx : undefined;
    source.properties.currentRx = isFinite(Rx) ? Rx : undefined;
    source.properties.isMidResistance = isMidResistance;
    source.properties.isHalfDeflection = false;
    source.properties.midTolerance = midTolerance;
    source.properties.step = isZeroed ? 'measuring' : 'zeroing';
    return { time: 0, forceAnalyses, motionStates };
  }

  const I = isFinite(Rx)
    ? computeCurrent(Rx, emf, Rg, batteryInternalResistance, R0)
    : 0;
  const deflectionRatio = isFinite(Rx) ? computeActualTheta(currentSystem, Rx) : 0;
  const isHalfDeflection = Math.abs(deflectionRatio - 0.5) < 0.03;

  // ── 更新电流计（reading 和 range 保持同单位，不覆盖 range） ──
  galv.properties.range = Ig;
  galv.properties.reading = I;
  galv.properties.overRange = deflectionRatio > 1.05;
  galv.properties.deflectionRatio = Math.min(deflectionRatio, 1.2);

  // 更新电阻元件
  rheostat.properties.voltage = I * R0;
  rheostat.properties.current = I;
  if (rxEntity) {
    rxEntity.properties.voltage = isFinite(Rx) ? I * Rx : emf;
    rxEntity.properties.current = I;
  }

  // 电源状态
  source.properties.totalCurrent = I;

  // 欧姆表显示数据
  source.properties.ohmReading = deflectionRatio > 0.001 ? R_mid * (1 / deflectionRatio - 1) : Infinity;
  source.properties.deflectionRatio = deflectionRatio;
  source.properties.R_mid = R_mid;
  source.properties.R_internal = R_internal;
  source.properties.idealR_internal = idealInternalResistance;
  source.properties.isZeroed = isZeroed;
  source.properties.zeroingThetaAtRxZero = zeroingThetaAtRxZero;
  source.properties.currentHalfDeflectionResistance = currentHalfDeflectionResistance;
  source.properties.canZero = canZero;
  source.properties.batteryInternalResistance = batteryInternalResistance;
  source.properties.zeroedSeriesResistance = zeroedSeriesResistance;
  source.properties.trueRx = isFinite(Rx) ? Rx : undefined;
  source.properties.currentRx = isFinite(Rx) ? Rx : undefined;
  source.properties.isMidResistance = isMidResistance;
  source.properties.isHalfDeflection = isHalfDeflection;
  source.properties.midTolerance = midTolerance;
  source.properties.step = isZeroed ? 'measuring' : 'zeroing';
  // 输出调试信息到 source 供检查
  source.properties._debug_I_uA = I * 1e6;
  source.properties._debug_R0 = R0;
  source.properties._debug_Rg = Rg;
  source.properties._debug_r = batteryInternalResistance;
  source.properties._debug_Rx = Rx;
  source.properties._debug_Ig = Ig;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerOhmmeterSolver(): void {
  solverRegistry.register({
    id: 'em-ohmmeter',
    label: '欧姆表原理',
    pattern: {
      entityTypes: ['dc-source', 'slide-rheostat'],
      relationType: 'connection',
      qualifier: { circuit: 'ohmmeter' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
