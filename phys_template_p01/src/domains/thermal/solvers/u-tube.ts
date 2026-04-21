import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { P0_PA } from '../logic/gas-law-utils';
import { solveUTube } from '../logic/pressure-balance';

/**
 * U管求解器 (THM-025)
 *
 * 左侧封闭 + 液柱 + 右侧开口
 * 两侧液柱高度差平衡
 */
const solver: SolverFunction = (scene) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const gasColumn = findEntity(scene.entities, 'gas-column');
  const container = findEntity(scene.entities, 'gas-container');
  if (!gasColumn || !container) {
    return { time: 0, forceAnalyses, motionStates };
  }

  // 查找液柱实体（可能有多个）
  const liquidColumns = findAllEntities(scene.entities, 'liquid-column');
  const leftLiquid = liquidColumns.find(e => (e.properties.columnId as string) === 'left') ?? liquidColumns[0];
  const rightLiquid = liquidColumns.find(e => (e.properties.columnId as string) === 'right') ?? liquidColumns[1];

  if (!leftLiquid) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const p0 = P0_PA;
  const crossSection = (gasColumn.properties.crossSection as number) ?? 2e-4;
  const density = (leftLiquid.properties.density as number) ?? 13600;

  const initialGasLength = (gasColumn.properties.length as number) ?? 0.5;
  const initialGasPressure = (gasColumn.properties.initialPressure as number) ?? p0;
  const T1 = (gasColumn.properties.initialTemperature as number) ?? 300;
  const T2 = (gasColumn.properties.temperature as number) ?? T1;

  const initialLeftLiquid = (leftLiquid.properties.length as number) ?? 0.3;
  const totalLiquid = initialLeftLiquid + ((rightLiquid?.properties.length as number) ?? initialLeftLiquid);

  const result = solveUTube(
    p0,
    initialGasLength,
    initialGasPressure,
    T1,
    T2,
    totalLiquid,
    initialLeftLiquid,
    density,
  );

  // 更新气柱
  gasColumn.properties.pressure = result.gasPressure;
  gasColumn.properties.volume = result.gasLength * crossSection;
  gasColumn.properties.length = result.gasLength;

  // 更新液柱
  if (leftLiquid) {
    leftLiquid.properties.length = result.leftLiquidLength;
  }
  if (rightLiquid) {
    rightLiquid.properties.length = result.rightLiquidLength;
  }

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

export function registerUTubeSolver(): void {
  solverRegistry.register({
    id: 'thm-u-tube',
    label: 'U管',
    pattern: {
      entityTypes: ['gas-container', 'gas-column', 'liquid-column'],
      relationType: 'contains',
      qualifier: { thermal: 'u-tube' },
    },
    solveMode: 'analytical',
    solve: solver,
  });
}
