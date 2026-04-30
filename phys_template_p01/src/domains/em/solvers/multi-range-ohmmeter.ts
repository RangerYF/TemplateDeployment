import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { findComponent, findByFamily, isCurrentMeter } from '../logic/circuit-solver-utils';

interface RangeItem {
  label: string;
  resistance: number;
}

/**
 * 多量程欧姆表求解器
 *
 * 与单量程欧姆表的区别：
 * - 用"量程选择开关"（range-switch）替代滑动变阻器（slide-rheostat）
 * - 每个档位对应固定串联电阻，切换量程改变测量范围
 *
 * 闭合回路：E → 开关 → G(Rg) → R_sel(量程电阻) → 黑端 → Rx → 红端 → E
 *
 * 核心公式：
 *   R_sel = ranges[selectedIndex].resistance
 *   Ig_range = E / (Rg + R_sel)           // 该量程满偏电流
 *   I = E / (Rg + R_sel + Rx)             // 回路电流
 *   deflectionRatio = I / Ig_range
 *   R_mid = Rg + R_sel                     // 中值电阻
 *   ohmReading = R_mid × (1/deflectionRatio - 1)
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const source = findComponent(scene.entities, 'dc-source');
  const galv = findByFamily(scene.entities, isCurrentMeter);
  const rangeSwitch = findComponent(scene.entities, 'range-switch');
  const rxEntity = findComponent(scene.entities, 'resistance-box');
  const sw = findComponent(scene.entities, 'switch');

  if (!source || !galv || !rangeSwitch) {
    return { time: 0, forceAnalyses, motionStates };
  }

  // 标记电路类型
  source.properties.circuitType = 'multi-range-ohmmeter';

  // 开关检查
  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;
  if (!switchClosed) {
    galv.properties.reading = 0;
    galv.properties.overRange = false;
    galv.properties.deflectionRatio = 0;
    rangeSwitch.properties.voltage = 0;
    rangeSwitch.properties.current = 0;
    if (rxEntity) { rxEntity.properties.voltage = 0; rxEntity.properties.current = 0; }
    source.properties.totalCurrent = 0;
    source.properties.deflectionRatio = 0;
    return { time: 0, forceAnalyses, motionStates };
  }

  // ── 读取参数 ──
  const emf = (source.properties.emf as number) ?? 1.5;
  const Rg = (galv.properties.internalResistance as number) ?? 1000;
  const ranges = (rangeSwitch.properties.ranges as RangeItem[]) ?? [];
  const selectedIndex = (rangeSwitch.properties.selectedIndex as number) ?? 2;
  const R_sel = ranges[selectedIndex]?.resistance ?? 1000;
  const Rx = rxEntity ? ((rxEntity.properties.resistance as number) ?? 0) : Infinity;

  // ── 核心计算 ──
  const Ig_range = emf / (Rg + R_sel); // 该量程满偏电流
  const R_total = Rg + R_sel + Rx;
  const I = (R_total > 0 && isFinite(R_total)) ? emf / R_total : 0;
  const deflectionRatio = Ig_range > 0 ? I / Ig_range : 0;
  const R_mid = Rg + R_sel; // 中值电阻

  // ── 更新量程开关属性 ──
  rangeSwitch.properties.activeResistance = R_sel;
  rangeSwitch.properties.voltage = I * R_sel;
  rangeSwitch.properties.current = I;

  // ── 更新电流计 ──
  // 动态设置 range 为当前量程的满偏电流，让渲染器正确显示偏转
  galv.properties.range = Ig_range;
  galv.properties.reading = I;
  galv.properties.overRange = deflectionRatio > 1.05;
  galv.properties.deflectionRatio = Math.min(deflectionRatio, 1.2);

  // ── 更新 Rx ──
  if (rxEntity) {
    rxEntity.properties.voltage = isFinite(Rx) ? I * Rx : emf;
    rxEntity.properties.current = I;
  }

  // ── 电源状态 ──
  source.properties.totalCurrent = I;

  // ── 欧姆表显示数据 ──
  source.properties.ohmReading = deflectionRatio > 0.001 ? R_mid * (1 / deflectionRatio - 1) : Infinity;
  source.properties.deflectionRatio = deflectionRatio;
  source.properties.R_mid = R_mid;
  source.properties.R_internal = R_mid; // 多量程时 R_internal = R_mid
  source.properties.isZeroed = true; // 多量程每档自动"调零"
  source.properties.trueRx = isFinite(Rx) ? Rx : undefined;
  source.properties.step = 'measuring';
  source.properties.selectedRange = ranges[selectedIndex]?.label ?? '';
  source.properties.R_sel = R_sel;

  // 调试信息
  source.properties._debug_I_uA = I * 1e6;
  source.properties._debug_R_sel = R_sel;
  source.properties._debug_Rg = Rg;
  source.properties._debug_Rx = Rx;
  source.properties._debug_Ig_range = Ig_range;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerMultiRangeOhmmeterSolver(): void {
  solverRegistry.register({
    id: 'em-multi-range-ohmmeter',
    label: '多量程欧姆表',
    pattern: {
      entityTypes: ['dc-source', 'range-switch'],
      relationType: 'connection',
      qualifier: { circuit: 'multi-range-ohmmeter' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
