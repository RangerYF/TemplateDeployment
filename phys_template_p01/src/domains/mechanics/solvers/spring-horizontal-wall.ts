import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

const G = 9.8;

/**
 * 水平弹簧连墙壁求解器（FM-051 水平）
 *
 *   |
 *   |~~spring~~[A]  → F
 *   |
 *   wall      水平面
 *   _____________________
 *
 * 平衡态分析：
 * - 无摩擦：F = kx → x = F/k
 * - 有摩擦：
 *   - F ≤ μmg → 静摩擦平衡，弹簧无形变
 *   - F > μmg → 弹簧形变 x = (F - μmg) / k
 */
const springHorizontalWallSolver: SolverFunction = (scene, time) => {
  const allEntities = Array.from(scene.entities.values());
  const block = allEntities.find((e) => e.type === 'block');
  const pivot = allEntities.find((e) => e.type === 'pivot');
  const spring = allEntities.find((e) => e.type === 'spring');
  if (!block || !pivot || !spring) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 1;
  const k = (scene.paramValues.stiffness as number) ?? (spring.properties.stiffness as number) ?? 100;
  const F = (scene.paramValues.appliedForce as number) ?? 0;
  const angleDeg = (scene.paramValues.forceAngle as number) ?? 0;
  const angleRad = (angleDeg * Math.PI) / 180;
  const mu = (scene.paramValues.friction as number) ?? 0;
  const naturalLength = (spring.properties.naturalLength as number) ?? 1.0;

  const mg = mass * G;
  const Fx = F * Math.cos(angleRad); // 水平分量（正=向右）
  const Fy = F * Math.sin(angleRad); // 竖直分量（正=向上）

  // 法力（考虑竖直分量）
  let N = mg - Fy;
  if (N < 0) N = 0;

  // ─── 判断弹簧形变 ───
  let x = 0; // 弹簧形变量（正=向右压缩/拉伸）
  let springForce = 0;
  let frictionMag = 0;
  let frictionDir = 0; // -1=向左，+1=向右

  if (Math.abs(Fx) > 1e-6) {
    const maxStaticFriction = mu * N;

    if (mu > 0 && Math.abs(Fx) <= maxStaticFriction) {
      // 静摩擦平衡，弹簧无形变
      x = 0;
      springForce = 0;
      frictionMag = Math.abs(Fx);
      frictionDir = Fx > 0 ? -1 : 1; // 摩擦力与水平外力反向
    } else {
      // 弹簧有形变
      const netForce = Fx - Math.sign(Fx) * mu * N;
      x = netForce / k;
      springForce = Math.abs(k * x);
      frictionMag = mu * N;
      frictionDir = Fx > 0 ? -1 : 1;
    }
  }

  // ─── 力列表 ───
  const forces: Force[] = [];

  forces.push({ type: 'gravity', label: 'G', magnitude: mg, direction: { x: 0, y: -1 } });
  forces.push({ type: 'normal', label: 'N', magnitude: N, direction: { x: 0, y: 1 } });

  if (F > 0) {
    forces.push({ type: 'custom', label: 'F', magnitude: F, direction: { x: Math.cos(angleRad), y: Math.sin(angleRad) } });
  }

  if (springForce > 0.001) {
    // 弹簧弹力方向：恢复力，与形变方向相反
    const springDir = x > 0 ? -1 : 1; // x>0 向右形变 → 弹力向左
    forces.push({ type: 'spring', label: 'F弹', magnitude: springForce, direction: { x: springDir, y: 0 } });
  }

  if (frictionMag > 0.001) {
    forces.push({ type: 'friction', label: 'f', magnitude: frictionMag, direction: { x: frictionDir, y: 0 } });
  }

  // ─── 合力 ───
  let rX = 0;
  let rY = 0;
  for (const f of forces) {
    rX += f.direction.x * f.magnitude;
    rY += f.direction.y * f.magnitude;
  }
  const rMag = Math.hypot(rX, rY);
  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: rMag,
    direction: rMag > 1e-6 ? { x: rX / rMag, y: rY / rMag } : { x: 0, y: 0 },
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces,
    resultant,
  };

  // ─── 物块位置 ───
  // pivot 在左，弹簧向右连物块
  // 物块 x = pivot.x + naturalLength + x（x 为形变量）
  const blockPos = {
    x: pivot.transform.position.x + naturalLength + x,
    y: block.transform.position.y,
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

export function registerSpringHorizontalWallSolver(): void {
  solverRegistry.register({
    id: 'mech-spring-horizontal-wall',
    label: '水平弹簧连墙壁',
    pattern: {
      entityTypes: ['block', 'pivot', 'spring', 'surface'],
      relationType: 'contact',
      qualifier: { spring: 'horizontal-wall' },
    },
    solveMode: 'analytical',
    solve: springHorizontalWallSolver,
  });
}
