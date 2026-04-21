import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  parallelResistance,
  checkOverRange,
  findComponent,
} from '../logic/circuit-solver-utils';

/**
 * 测电源 EMF 和内阻求解器
 *
 * 电路拓扑：
 *   电源 ε,r → 开关 → 电流表 rA → 滑动变阻器 R
 *   电压表 rV 并联在电源两端（外接法测端电压）
 *
 * 物理公式：
 *   R_eff = R_max * sliderRatio（滑动变阻器接入阻值）
 *   主路：rA + R_eff
 *   并联：(rA + R_eff) ∥ rV
 *   R_total = R_parallel + r
 *   I_total = ε / R_total
 *   U_terminal = ε - I_total * r（端电压）
 *
 * 理想关系（忽略仪表影响）：
 *   U = ε - I * r （U-I 线性关系）
 *   截距 = ε，斜率 = -r
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  // 查找各元件
  const source = findComponent(scene.entities, 'dc-source');
  const rheostat = findComponent(scene.entities, 'slide-rheostat');
  const ammeter = findComponent(scene.entities, 'ammeter');
  const voltmeter = findComponent(scene.entities, 'voltmeter');
  const sw = findComponent(scene.entities, 'switch');

  if (!source || !rheostat || !ammeter || !voltmeter) {
    return { time: 0, forceAnalyses, motionStates };
  }

  // 检查开关状态
  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;

  if (!switchClosed) {
    ammeter.properties.reading = 0;
    ammeter.properties.overRange = false;
    voltmeter.properties.reading = 0;
    voltmeter.properties.overRange = false;
    rheostat.properties.voltage = 0;
    rheostat.properties.current = 0;
    return { time: 0, forceAnalyses, motionStates };
  }

  // 读取参数
  const emf = (source.properties.emf as number) ?? 6;
  const r = (source.properties.internalResistance as number) ?? 1;
  const R_max = (rheostat.properties.maxResistance as number) ?? 50;
  const sliderRatio = (rheostat.properties.sliderRatio as number) ?? 0.5;
  const rA = (ammeter.properties.internalResistance as number) ?? 0.2;
  const rV = (voltmeter.properties.internalResistance as number) ?? 3000;

  // 计算电路
  const R_eff = R_max * sliderRatio; // 滑动变阻器接入阻值
  const R_main = rA + R_eff; // 主路电阻（电流表 + 变阻器）
  const R_parallel = parallelResistance(R_main, rV); // 主路与电压表并联
  const R_total = R_parallel + r; // 总电阻

  const I_total = emf / R_total; // 总电流
  const U_terminal = emf - I_total * r; // 端电压

  // 电流表读数：流过主路的电流
  const I_A = U_terminal / R_main;
  // 电压表读数：端电压（≈ U_terminal，因为电压表并联在电源两端）
  const U_V = U_terminal;

  // 更新仪表读数
  checkOverRange(ammeter, I_A, (ammeter.properties.range as number) ?? 0.6);
  checkOverRange(voltmeter, U_V, (voltmeter.properties.range as number) ?? 15);

  // 更新变阻器状态
  rheostat.properties.voltage = I_A * R_eff;
  rheostat.properties.current = I_A;

  // 写入电源状态
  source.properties.totalCurrent = I_total;
  source.properties.terminalVoltage = U_terminal;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

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
