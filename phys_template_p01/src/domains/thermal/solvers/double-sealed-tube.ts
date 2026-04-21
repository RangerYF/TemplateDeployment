import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { solveDoubleSealedTube } from '../logic/pressure-balance';

/**
 * 双密封管求解器 (THM-026)
 *
 * 两端密封，中间液柱隔开两段气体
 * 联立两段气体状态方程
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const container = findEntity(scene.entities, 'gas-container');
  if (!container) {
    return { time: 0, forceAnalyses, motionStates };
  }

  // 查找两段气柱
  const gasColumns = findAllEntities(scene.entities, 'gas-column');
  const leftGas = gasColumns.find(e => (e.properties.columnId as string) === 'left') ?? gasColumns[0];
  const rightGas = gasColumns.find(e => (e.properties.columnId as string) === 'right') ?? gasColumns[1];
  const liquidColumn = findEntity(scene.entities, 'liquid-column');

  if (!leftGas || !rightGas || !liquidColumn) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const tubeLength = (container.properties.height as number) ?? 1.0;
  const crossSection = (leftGas.properties.crossSection as number) ?? 2e-4;
  const L_liq = (liquidColumn.properties.length as number) ?? 0.1;

  const L1_left = (leftGas.properties.initialVolume as number) ?? 0.3 * crossSection;
  const p1_left = (leftGas.properties.initialPressure as number) ?? 101325;
  const L1_right = (rightGas.properties.initialVolume as number) ?? 0.3 * crossSection;
  const p1_right = (rightGas.properties.initialPressure as number) ?? 101325;

  const T1 = (leftGas.properties.initialTemperature as number) ?? 300;
  const T2 = (leftGas.properties.temperature as number) ?? T1;

  // 将 V 转为 L 用于求解
  const iL_left = L1_left / crossSection;
  const iL_right = L1_right / crossSection;

  const result = solveDoubleSealedTube(
    iL_left,
    p1_left,
    iL_right,
    p1_right,
    T1,
    T2,
    L_liq,
    crossSection,
    tubeLength,
  );

  // 更新左气柱
  leftGas.properties.pressure = result.leftPressure;
  leftGas.properties.length = result.leftGasLength;
  leftGas.properties.volume = result.leftGasLength * crossSection;

  // 更新右气柱
  rightGas.properties.pressure = result.rightPressure;
  rightGas.properties.length = result.rightGasLength;
  rightGas.properties.volume = result.rightGasLength * crossSection;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const e of entities.values()) {
    if (e.type === type) return e;
  }
  return undefined;
}

function findAllEntities(entities: Map<string, Entity>, type: string): Entity[] {
  const result: Entity[] = [];
  for (const e of entities.values()) {
    if (e.type === type) result.push(e);
  }
  return result;
}

export function registerDoubleSealedTubeSolver(): void {
  solverRegistry.register({
    id: 'thm-double-sealed-tube',
    label: '双密封管',
    pattern: {
      entityTypes: ['gas-container', 'gas-column', 'liquid-column'],
      relationType: 'contains',
      qualifier: { thermal: 'double-sealed-tube' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
