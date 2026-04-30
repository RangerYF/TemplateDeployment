import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

const G = 9.8; // m/s²

/**
 * 水平面加速运动求解器（解析解）
 *
 * 物块受水平推力 F 在粗糙水平面上运动。
 * N = mg（水平推力不影响 N）
 * a = (F − μmg) / m
 *
 * 若 F ≤ μmg：静摩擦平衡，物块不动，f = F
 * 若 F > μmg：匀加速运动，v(t) = at, x(t) = ½at²
 */
const frictionAccelerationSolver: SolverFunction = (scene, time) => {
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  if (!block) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // 参数读取（优先 paramValues）
  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 2;
  const F = (scene.paramValues.appliedForce as number) ?? 10;
  const mu = (scene.paramValues.friction as number) ?? 0.3;

  const mg = mass * G;
  const N = mg;
  const maxStaticFriction = mu * N;

  // ─── 力列表 ───
  const forces: Force[] = [];

  // 重力
  forces.push({
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  });

  // 支持力
  forces.push({
    type: 'normal',
    label: 'N',
    magnitude: N,
    direction: { x: 0, y: 1 },
  });

  // 推力（水平向右）
  forces.push({
    type: 'custom',
    label: 'F外',
    magnitude: F,
    direction: { x: 1, y: 0 },
  });

  // 判断运动状态
  const isMoving = F > maxStaticFriction;

  // 摩擦力
  const frictionMag = isMoving ? mu * N : F; // 静摩擦等于推力
  forces.push({
    type: 'friction',
    label: 'f',
    magnitude: frictionMag,
    direction: { x: -1, y: 0 },
  });

  // 加速度
  const ax = isMoving ? (F - mu * N) / mass : 0;

  // 合力
  const resultantMag = isMoving ? F - mu * N : 0;
  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: resultantMag,
    direction: resultantMag > 1e-6 ? { x: 1, y: 0 } : { x: 0, y: 0 },
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces,
    resultant,
  };

  // ─── 运动状态 ───
  const vx = isMoving ? ax * time : 0;
  const dx = isMoving ? 0.5 * ax * time * time : 0;

  const motionState: MotionState = {
    entityId: block.id,
    position: {
      x: block.transform.position.x + dx,
      y: block.transform.position.y,
    },
    velocity: { x: vx, y: 0 },
    acceleration: { x: ax, y: 0 },
  };

  return {
    time,
    forceAnalyses: new Map([[block.id, forceAnalysis]]),
    motionStates: new Map([[block.id, motionState]]),
  };
};

export function registerFrictionAccelerationSolver(): void {
  solverRegistry.register({
    id: 'mech-block-friction-acceleration',
    label: '水平面·加速运动',
    pattern: {
      entityTypes: ['block', 'surface'],
      relationType: 'contact',
      qualifier: { surface: 'horizontal', motion: 'friction-acceleration' },
    },
    solveMode: 'analytical',
    solve: frictionAccelerationSolver,
  });
}
