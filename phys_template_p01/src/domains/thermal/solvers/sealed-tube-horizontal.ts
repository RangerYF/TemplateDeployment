import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { P0_PA } from '../logic/gas-law-utils';

/**
 * 密封管（水平放置）求解器 (THM-023)
 *
 * 管水平放置，液柱不产生附加压强。
 * p_gas = p0
 * 状态方程：p1V1/T1 = p2V2/T2
 * 由于 p 不变（始终 = p0），等效于等压过程
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const gasColumn = findEntity(scene.entities, 'gas-column');
  if (!gasColumn) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const p0 = P0_PA;
  const crossSection = (gasColumn.properties.crossSection as number) ?? 2e-4;

  const V1 = (gasColumn.properties.initialVolume as number) ?? 1e-4;
  const T1 = (gasColumn.properties.initialTemperature as number) ?? 300;
  const T2 = (gasColumn.properties.temperature as number) ?? T1;

  // 水平管中 p 始终 = p0，V2 = V1 * T2 / T1
  const V2 = (V1 * T2) / T1;

  gasColumn.properties.pressure = p0;
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

export function registerSealedTubeHorizontalSolver(): void {
  solverRegistry.register({
    id: 'thm-sealed-tube-horizontal',
    label: '密封管（水平放置）',
    pattern: {
      entityTypes: ['gas-container', 'gas-column', 'liquid-column'],
      relationType: 'contains',
      qualifier: { thermal: 'sealed-tube-horizontal' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
