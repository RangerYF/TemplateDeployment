import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { P0_PA, g } from '../logic/gas-law-utils';

/**
 * 双活塞求解器 (THM-032)
 *
 * 两个活塞夹着气体，竖直放置。
 * 上方气体A（两活塞之间），下方开放
 * p_A = p0 + m_upper * g / S
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const gasColumns = findAllEntities(scene.entities, 'gas-column');
  const pistons = findAllEntities(scene.entities, 'piston');

  if (gasColumns.length < 1 || pistons.length < 2) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const gasA = gasColumns.find(e => (e.properties.columnId as string) === 'gas-A') ?? gasColumns[0]!;
  const gasB = gasColumns.length > 1
    ? (gasColumns.find(e => (e.properties.columnId as string) === 'gas-B') ?? gasColumns[1]!)
    : null;

  const piston1 = pistons.find(e => (e.properties.pistonId as string) === 'upper') ?? pistons[0]!;
  const piston2 = pistons.find(e => (e.properties.pistonId as string) === 'lower') ?? pistons[1]!;

  const p0 = P0_PA;
  const m1 = (piston1.properties.mass as number) ?? 1.0;
  const m2 = (piston2.properties.mass as number) ?? 1.0;
  const S = (piston1.properties.crossSection as number) ?? 2e-4;

  // 气体A（上活塞和下活塞之间）
  // p_A = p0 + m1*g/S（上活塞的重力）
  const p_A = p0 + (m1 * g) / S;

  const p1_A = (gasA.properties.initialPressure as number) ?? p_A;
  const V1_A = (gasA.properties.initialVolume as number) ?? 1e-4;
  const T1 = (gasA.properties.initialTemperature as number) ?? 300;
  const T2 = (gasA.properties.temperature as number) ?? T1;

  const V2_A = (p1_A * V1_A * T2) / (T1 * p_A);

  gasA.properties.pressure = p_A;
  gasA.properties.volume = V2_A;
  gasA.properties.length = V2_A / S;

  // 气体B（下活塞和底部之间），如果存在
  if (gasB) {
    // p_B = p0 + (m1+m2)*g/S
    const p_B = p0 + ((m1 + m2) * g) / S;
    const p1_B = (gasB.properties.initialPressure as number) ?? p_B;
    const V1_B = (gasB.properties.initialVolume as number) ?? 1e-4;
    const T1_B = (gasB.properties.initialTemperature as number) ?? 300;
    const T2_B = (gasB.properties.temperature as number) ?? T1_B;

    const V2_B = (p1_B * V1_B * T2_B) / (T1_B * p_B);

    gasB.properties.pressure = p_B;
    gasB.properties.volume = V2_B;
    gasB.properties.length = V2_B / S;
  }

  // 更新活塞位置
  const lenA = V2_A / S;
  piston1.properties.positionOffset = gasB ? (gasB.properties.length as number) + lenA : lenA;
  piston2.properties.positionOffset = gasB ? (gasB.properties.length as number) : 0;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findAllEntities(entities: Map<string, Entity>, type: string): Entity[] {
  const result: Entity[] = [];
  for (const e of entities.values()) {
    if (e.type === type) result.push(e);
  }
  return result;
}

export function registerDoublePistonSolver(): void {
  solverRegistry.register({
    id: 'thm-double-piston',
    label: '双活塞气缸',
    pattern: {
      entityTypes: ['gas-container', 'gas-column', 'piston'],
      relationType: 'contains',
      qualifier: { thermal: 'double-piston' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
