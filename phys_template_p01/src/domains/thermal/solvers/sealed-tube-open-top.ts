import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { P0_PA } from '../logic/gas-law-utils';
import { sealedTubeOpenTopPressure } from '../logic/pressure-balance';

/**
 * 密封管（开口朝上）求解器 (THM-021)
 *
 * 管底封闭、上端开口，液柱封住气体。
 * p_gas = p0 + ρgL_liq
 * 状态方程：p1V1/T1 = p2V2/T2
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const gasColumn = findEntity(scene.entities, 'gas-column');
  const liquidColumn = findEntity(scene.entities, 'liquid-column');
  if (!gasColumn || !liquidColumn) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const p0 = P0_PA;
  const L_liq = (liquidColumn.properties.length as number) ?? 0.1;
  const density = (liquidColumn.properties.density as number) ?? 13600;
  const crossSection = (gasColumn.properties.crossSection as number) ?? 2e-4;

  const p1 = (gasColumn.properties.initialPressure as number) ?? sealedTubeOpenTopPressure(p0, L_liq, density);
  const L1 = (gasColumn.properties.initialVolume as number) ?? 1e-4;
  const T1 = (gasColumn.properties.initialTemperature as number) ?? 300;
  const T2 = (gasColumn.properties.temperature as number) ?? T1;

  // 液柱长度不变（质量守恒），气体压强 = p0 + ρgL_liq
  const p2 = sealedTubeOpenTopPressure(p0, L_liq, density);

  // 状态方程：p1V1/T1 = p2V2/T2 → V2 = p1V1T2/(T1*p2)
  const V2 = (p1 * L1 * T2) / (T1 * p2);

  gasColumn.properties.pressure = p2;
  gasColumn.properties.volume = V2;
  gasColumn.properties.length = V2 / crossSection;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const e of entities.values()) {
    if (e.type === type) return e;
  }
  return undefined;
}

export function registerSealedTubeOpenTopSolver(): void {
  solverRegistry.register({
    id: 'thm-sealed-tube-open-top',
    label: '密封管（开口朝上）',
    pattern: {
      entityTypes: ['gas-container', 'gas-column', 'liquid-column'],
      relationType: 'contains',
      qualifier: { thermal: 'sealed-tube-open-top' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
