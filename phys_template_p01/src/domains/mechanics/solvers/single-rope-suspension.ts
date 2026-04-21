import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

const G = 9.8;

const singleRopeSuspensionSolver: SolverFunction = (scene, time) => {
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  const pivot = Array.from(scene.entities.values()).find((e) => e.type === 'pivot');
  if (!block || !pivot) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 1;
  const mg = mass * G;

  // 找到绳实体获取绳长
  const rope = Array.from(scene.entities.values()).find((e) => e.type === 'rope');
  const ropeLength = rope ? (rope.properties.length as number) ?? 1.5 : 1.5;

  // 物块位置 = pivot 正下方，距离 = ropeLength
  const blockPos = {
    x: pivot.transform.position.x,
    y: pivot.transform.position.y - ropeLength,
  };

  // 重力
  const gravity: Force = {
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  };

  // 张力（竖直向上）
  const tension: Force = {
    type: 'tension',
    label: 'T',
    magnitude: mg,
    direction: { x: 0, y: 1 },
  };

  // 合力为零
  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: 0,
    direction: { x: 0, y: 0 },
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces: [gravity, tension],
    resultant,
  };

  const motionState: MotionState = {
    entityId: block.id,
    position: blockPos,
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
  };

  return {
    time,
    forceAnalyses: new Map([[block.id, forceAnalysis]]),
    motionStates: new Map([[block.id, motionState]]),
  };
};

export function registerSingleRopeSuspensionSolver(): void {
  solverRegistry.register({
    id: 'mech-single-rope-suspension',
    label: '单绳竖直悬挂',
    pattern: {
      entityTypes: ['block', 'pivot', 'rope'],
      relationType: 'connection',
      qualifier: { suspension: 'single-rope' },
    },
    solveMode: 'analytical',
    solve: singleRopeSuspensionSolver,
  });
}
