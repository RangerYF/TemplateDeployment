import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { P0_PA } from '../logic/gas-law-utils';
import { pistonPressure } from '../logic/pressure-balance';

/**
 * 单活塞求解器 (THM-031)
 *
 * 竖直气缸：p = p0 + Mg/S（活塞在上）或 p = p0 - Mg/S（活塞在下）
 * 水平气缸：p = p0
 * 状态方程：p1V1/T1 = p2V2/T2
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const gasColumn = findEntity(scene.entities, 'gas-column');
  const piston = findEntity(scene.entities, 'piston');
  if (!gasColumn || !piston) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const p0 = P0_PA;
  const mass = (piston.properties.mass as number) ?? 1.0;
  const crossSection = (piston.properties.crossSection as number) ?? 2e-4;
  const orientation = (piston.properties.orientation as string) ?? 'vertical';

  // 活塞在气柱上方
  const p_gas = pistonPressure(p0, mass, crossSection, orientation, true);

  const p1 = (gasColumn.properties.initialPressure as number) ?? p_gas;
  const V1 = (gasColumn.properties.initialVolume as number) ?? 1e-4;
  const T1 = (gasColumn.properties.initialTemperature as number) ?? 300;
  const T2 = (gasColumn.properties.temperature as number) ?? T1;

  // 活塞可自由移动，压强恒定 = p_gas
  // V2 = V1 * T2 / T1（等压过程）
  const V2 = (p1 * V1 * T2) / (T1 * p_gas);

  gasColumn.properties.pressure = p_gas;
  gasColumn.properties.volume = V2;
  gasColumn.properties.length = V2 / crossSection;

  // 更新活塞位置
  const newLength = V2 / crossSection;
  piston.properties.positionOffset = newLength;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const e of entities.values()) {
    if (e.type === type) return e;
  }
  return undefined;
}

export function registerSinglePistonSolver(): void {
  solverRegistry.register({
    id: 'thm-single-piston',
    label: '单活塞气缸',
    pattern: {
      entityTypes: ['gas-container', 'gas-column', 'piston'],
      relationType: 'contains',
      qualifier: { thermal: 'single-piston' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
