import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  findComponent,
  findAllByFamily,
  findByFamily,
  isFixedResistance,
  isCurrentMeter,
  getEffectiveResistance,
} from '../logic/circuit-solver-utils';

/**
 * 惠斯通电桥求解器 — 节点电压法（Nodal Analysis）
 *
 * 电路拓扑（标准电桥）：
 *
 *         A（电源正极）
 *        / \
 *       R1   R3
 *      /       \
 *     B----G----D
 *      \       /
 *       R2   R4
 *        \ /
 *         C（电源负极 / 地）
 *
 *   电源 ε 连接 A-C，内阻 r
 *
 * 节点方程（V_C = 0 为参考）：
 *   节点 A：V_A = ε - I_total · r
 *   节点 B：(V_A-V_B)/R1 = V_B/R2 + (V_B-V_D)/Rg
 *   节点 D：(V_A-V_D)/R3 = V_D/R4 + (V_D-V_B)/Rg
 *
 * 平衡条件：R1/R2 = R3/R4 → Ig = 0
 *
 * 桥臂分配：用 y 坐标区分上下桥臂，x 坐标区分左右
 *   上桥臂（y 较大）：左=R1，右=R2
 *   下桥臂（y 较小）：左=R3，右=R4
 */

const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const source = findComponent(scene.entities, 'dc-source');
  const galv = findByFamily(scene.entities, isCurrentMeter);
  const sw = findComponent(scene.entities, 'switch');
  const allResistors = findAllByFamily(scene.entities, isFixedResistance);

  if (!source || !galv || allResistors.length < 4) {
    return { time: 0, forceAnalyses, motionStates };
  }

  // 开关检查
  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;

  if (!switchClosed) {
    galv.properties.reading = 0;
    galv.properties.overRange = false;
    galv.properties.current = 0;
    for (const re of allResistors) {
      re.properties.voltage = 0;
      re.properties.current = 0;
    }
    source.properties.totalCurrent = 0;
    source.properties.terminalVoltage = (source.properties.emf as number) ?? 6;
    return { time: 0, forceAnalyses, motionStates };
  }

  // ── 桥臂分配：按 y 坐标分上下，再按 x 坐标分左右 ──
  const sorted = [...allResistors];
  // 计算中位 y
  const yValues = sorted.map((e) => e.transform.position.y);
  const yMid = (Math.max(...yValues) + Math.min(...yValues)) / 2;

  const upper = sorted.filter((e) => e.transform.position.y > yMid);
  const lower = sorted.filter((e) => e.transform.position.y <= yMid);

  // 上桥臂按 x 排序：左=R1，右=R2
  upper.sort((a, b) => a.transform.position.x - b.transform.position.x);
  // 下桥臂按 x 排序：左=R3，右=R4
  lower.sort((a, b) => a.transform.position.x - b.transform.position.x);

  if (upper.length < 2 || lower.length < 2) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const entR1 = upper[0]!;
  const entR2 = upper[1]!;
  const entR3 = lower[0]!;
  const entR4 = lower[1]!;

  const R1 = getEffectiveResistance(entR1) || ((entR1.properties.resistance as number) ?? 100);
  const R2 = getEffectiveResistance(entR2) || ((entR2.properties.resistance as number) ?? 1000);
  const R3 = getEffectiveResistance(entR3) || ((entR3.properties.resistance as number) ?? 500);
  const R4 = getEffectiveResistance(entR4) || ((entR4.properties.resistance as number) ?? 5000);

  const emf = (source.properties.emf as number) ?? 6;
  const r = (source.properties.internalResistance as number) ?? 0;
  const Rg = (galv.properties.internalResistance as number) ?? 100;
  const galvRange = (galv.properties.range as number) ?? 500; // μA

  // ── 节点电压法求解 ──
  // V_C = 0（参考地），V_A = emf（先忽略内阻，后修正）
  // 节点 B：V_B(1/R1 + 1/R2 + 1/Rg) - V_D(1/Rg) = V_A/R1
  // 节点 D：V_D(1/R3 + 1/R4 + 1/Rg) - V_B(1/Rg) = V_A/R3

  // 先用 V_A = emf 求解，再迭代修正内阻影响
  let V_A = emf;

  // 迭代 2 次足够收敛（r 远小于桥臂电阻）
  let V_B = 0, V_D = 0;
  for (let iter = 0; iter < 3; iter++) {
    const a = 1 / R1 + 1 / R2 + 1 / Rg;
    const b = -1 / Rg;
    const cVal = V_A / R1;
    const d = -1 / Rg;
    const e = 1 / R3 + 1 / R4 + 1 / Rg;
    const f = V_A / R3;

    const det = a * e - b * d;
    if (Math.abs(det) < 1e-20) break;

    V_B = (cVal * e - b * f) / det;
    V_D = (a * f - cVal * d) / det;

    // 修正 V_A（考虑电源内阻）
    const I_total = (V_A - V_B) / R1 + (V_A - V_D) / R3;
    V_A = emf - I_total * r;
  }

  // ── 计算各支路电流 ──
  const I_R1 = (V_A - V_B) / R1;
  const I_R2 = V_B / R2;
  const I_R3 = (V_A - V_D) / R3;
  const I_R4 = V_D / R4;
  const Ig_A = (V_B - V_D) / Rg; // 电流计电流（A）
  const Ig_uA = Ig_A * 1e6; // 转 μA

  const I_total = I_R1 + I_R3;

  // ── 更新灵敏电流计 ──
  galv.properties.reading = Ig_uA;
  galv.properties.overRange = Math.abs(Ig_uA) > galvRange;
  galv.properties.current = Ig_A;

  // ── 更新各电阻状态 ──
  entR1.properties.current = I_R1;
  entR1.properties.voltage = I_R1 * R1;
  entR2.properties.current = I_R2;
  entR2.properties.voltage = I_R2 * R2;
  entR3.properties.current = I_R3;
  entR3.properties.voltage = I_R3 * R3;
  entR4.properties.current = I_R4;
  entR4.properties.voltage = I_R4 * R4;

  // ── 电源状态 ──
  source.properties.totalCurrent = I_total;
  source.properties.terminalVoltage = V_A;

  // ── 节点电压（供教学标注用） ──
  source.properties.nodeVA = V_A;
  source.properties.nodeVB = V_B;
  source.properties.nodeVC = 0;
  source.properties.nodeVD = V_D;

  // ── 平衡判定 ──
  const isBalanced = Math.abs(Ig_uA) < 1; // <1μA 视为平衡
  source.properties.isBalanced = isBalanced;
  source.properties.balanceCondition = `R₁/R₂ = ${(R1 / R2).toFixed(4)}, R₃/R₄ = ${
    R4 > 0 ? (R3 / R4).toFixed(4) : '∞'
  }`;
  source.properties.theoreticalR4 = R2 > 0 ? (R3 * R1) / R2 : 0;
  source.properties.step = isBalanced ? 'balanced' : 'balancing';
  source.properties.circuitType = 'wheatstone-bridge';

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

export function registerWheatsoneBridgeSolver(): void {
  solverRegistry.register({
    id: 'em-wheatstone-bridge',
    label: '惠斯通电桥测电阻',
    pattern: {
      entityTypes: ['dc-source', 'fixed-resistor', 'resistance-box', 'galvanometer'],
      relationType: 'connection',
      qualifier: { circuit: 'wheatstone-bridge' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
