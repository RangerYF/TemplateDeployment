import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';

const G = 9.8; // m/s²

const blockOnSurfaceSolver: SolverFunction = (scene, time) => {
  // 找到 block 实体
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  if (!block) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  const mass = (block.properties.mass as number) ?? 1;
  const mg = mass * G;

  // 重力 G：竖直向下
  const gravity: Force = {
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  };

  // 支持力 N：竖直向上
  const normal: Force = {
    type: 'normal',
    label: 'N',
    magnitude: mg,
    direction: { x: 0, y: 1 },
  };

  // 合力为零（静力平衡）
  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: 0,
    direction: { x: 0, y: 0 },
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces: [gravity, normal],
    resultant,
  };

  const motionState: MotionState = {
    entityId: block.id,
    position: block.transform.position,
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
  };

  const result: PhysicsResult = {
    time,
    forceAnalyses: new Map([[block.id, forceAnalysis]]),
    motionStates: new Map([[block.id, motionState]]),
  };

  return result;
};

export function registerBlockOnSurfaceSolver(): void {
  solverRegistry.register({
    id: 'mech-block-on-horizontal-surface',
    label: '水平面物块受力',
    pattern: {
      entityTypes: ['block', 'surface'],
      relationType: 'contact',
      qualifier: { surface: 'horizontal', motion: 'static' },
    },
    solveMode: 'analytical',
    solve: blockOnSurfaceSolver,
  });
}
