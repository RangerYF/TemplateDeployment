import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

const G = 9.8; // m/s²

/**
 * 水平面摩擦减速求解器（解析解）
 *
 * 物块以初速度 v0 在有摩擦的水平面上滑动，匀减速直到停止。
 * a = -μg（与速度方向相反）
 * v(t) = v0 - μg·t
 * x(t) = v0·t - ½μg·t²
 * 停止时刻 t_stop = v0 / (μg)
 */
const frictionDecelerationSolver: SolverFunction = (scene, time) => {
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  if (!block) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  const mass = (block.properties.mass as number) ?? 1;
  const v0 = (block.properties.initialVelocity as number)
    ?? (scene.paramValues.initialVelocity as number) ?? 3;
  const mg = mass * G;

  // 摩擦因数：优先从 paramValues 读取（参数面板联动），否则从关系属性读取
  const friction = (scene.paramValues.friction as number)
    ?? (scene.relations.length > 0
      ? (scene.relations[0]?.properties.friction as number) ?? 0.3
      : 0.3);

  const a = friction * G; // 减速加速度大小
  const tStop = v0 / a; // 停止时刻
  const stopped = time >= tStop;

  // 当前速度和位移
  const vx = stopped ? 0 : v0 - a * time;
  const x = stopped
    ? v0 * tStop - 0.5 * a * tStop * tStop // 停止后位移不变
    : v0 * time - 0.5 * a * time * time;

  // ─── 力 ───
  const gravity: Force = {
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  };

  const normal: Force = {
    type: 'normal',
    label: 'N',
    magnitude: mg,
    direction: { x: 0, y: 1 },
  };

  const forces: Force[] = [gravity, normal];

  // 摩擦力（运动时存在，停止后消失）
  if (!stopped) {
    const frictionForce: Force = {
      type: 'friction',
      label: 'f',
      magnitude: friction * mg,
      direction: { x: -1, y: 0 }, // 与运动方向（+x）相反
    };
    forces.push(frictionForce);
  }

  // 合力
  const resultantMag = stopped ? 0 : friction * mg;
  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: resultantMag,
    direction: stopped ? { x: 0, y: 0 } : { x: -1, y: 0 },
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces,
    resultant,
  };

  const motionState: MotionState = {
    entityId: block.id,
    position: {
      x: block.transform.position.x + x,
      y: block.transform.position.y,
    },
    velocity: { x: vx, y: 0 },
    acceleration: { x: stopped ? 0 : -a, y: 0 },
  };

  return {
    time,
    forceAnalyses: new Map([[block.id, forceAnalysis]]),
    motionStates: new Map([[block.id, motionState]]),
  };
};

export function registerFrictionDecelerationSolver(): void {
  solverRegistry.register({
    id: 'mech-block-friction-deceleration',
    label: '水平面摩擦减速',
    pattern: {
      entityTypes: ['block', 'surface'],
      relationType: 'contact',
      qualifier: { surface: 'horizontal', motion: 'friction-deceleration' },
    },
    solveMode: 'analytical',
    solve: frictionDecelerationSolver,
    eventDetectors: [
      {
        eventType: 'velocity-zero',
        detect: (_scene, result, prevResult) => {
          if (!prevResult) return null;
          for (const [entityId, motion] of result.motionStates) {
            const prev = prevResult.motionStates.get(entityId);
            if (prev && prev.velocity.x > 0 && motion.velocity.x === 0) {
              return { eventType: 'velocity-zero', entityId };
            }
          }
          return null;
        },
      },
    ],
  });
}
