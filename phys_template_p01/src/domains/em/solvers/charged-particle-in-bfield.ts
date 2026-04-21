import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, PhysicsResult, Vec2 } from '@/core/types';
import { computeLorentzForce } from '../logic/lorentz-force';

/**
 * 带电粒子在匀强磁场中运动求解器
 *
 * 物理场景：带电粒子以初速度进入匀强磁场，受洛伦兹力做匀速圆周运动。
 * 求解模式：数值积分（semi-implicit-euler）
 *
 * 理论验证：
 *   圆周半径 R = mv / (|q|B)
 *   周期 T = 2πm / (|q|B)
 *   角速度 ω = |q|B / m
 */

const solver: SolverFunction = (scene, time, dt, prevResult) => {
  const particles = Array.from(scene.entities.values()).filter(
    (e) => e.type === 'point-charge',
  );
  const fields = Array.from(scene.entities.values()).filter(
    (e) => e.type === 'uniform-bfield',
  );

  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  for (const particle of particles) {
    const charge = (particle.properties.charge as number) ?? 1;
    const mass = (particle.properties.mass as number) ?? 1;
    const initVel = (particle.properties.initialVelocity as Vec2) ?? { x: 0, y: 0 };

    // 获取上一帧状态，若无则使用初始值
    const prevMotion = prevResult?.motionStates.get(particle.id);
    const pos: Vec2 = prevMotion
      ? { ...prevMotion.position }
      : { ...particle.transform.position };
    const vel: Vec2 = prevMotion
      ? { ...prevMotion.velocity }
      : { ...initVel };
    const prevTrajectory = prevMotion?.trajectory ?? [];

    // 计算洛伦兹力
    const lorentzResult = computeLorentzForce(pos, vel, charge, fields);

    const forces: Force[] = [];
    let ax = 0;
    let ay = 0;

    if (lorentzResult) {
      forces.push(lorentzResult.force);
      ax = lorentzResult.fx / mass;
      ay = lorentzResult.fy / mass;
    }

    // 合力
    const resultantMag = Math.hypot(ax * mass, ay * mass);
    const resultant: Force = {
      type: 'resultant',
      label: resultantMag > 0.01 ? `F合=${resultantMag.toFixed(2)}N` : 'F合≈0',
      magnitude: resultantMag,
      direction: resultantMag > 0
        ? { x: (ax * mass) / resultantMag, y: (ay * mass) / resultantMag }
        : { x: 0, y: 0 },
    };

    forceAnalyses.set(particle.id, {
      entityId: particle.id,
      forces,
      resultant,
    });

    // Semi-implicit Euler 积分
    // 先更新速度，再用新速度更新位置（比显式欧拉更稳定）
    const newVx = vel.x + ax * dt;
    const newVy = vel.y + ay * dt;
    const newX = pos.x + newVx * dt;
    const newY = pos.y + newVy * dt;

    // 轨迹采样（每 5 帧记录一个点，控制内存）
    const trajectory = [...prevTrajectory];
    const sampleInterval = 5;
    const frameIndex = Math.round(time / (dt || 1 / 60));
    if (frameIndex % sampleInterval === 0 || prevTrajectory.length === 0) {
      trajectory.push({ x: newX, y: newY });
    }
    // 限制轨迹长度
    const maxTrajectoryPoints = 2000;
    if (trajectory.length > maxTrajectoryPoints) {
      trajectory.splice(0, trajectory.length - maxTrajectoryPoints);
    }

    const speed = Math.hypot(newVx, newVy);
    motionStates.set(particle.id, {
      entityId: particle.id,
      position: { x: newX, y: newY },
      velocity: { x: newVx, y: newVy },
      acceleration: { x: ax, y: ay },
      angularVelocity: speed > 0 && mass > 0 && Math.abs(charge) > 0
        ? (Math.abs(charge) * getMaxFieldMagnitude(fields)) / mass
        : undefined,
      trajectory,
    });
  }

  return {
    time,
    forceAnalyses,
    motionStates,
  } satisfies PhysicsResult;
};

/** 获取场景中最大磁场强度（用于角速度标注） */
function getMaxFieldMagnitude(
  fields: Array<{ properties: Record<string, unknown> }>,
): number {
  let max = 0;
  for (const f of fields) {
    const mag = (f.properties.magnitude as number) ?? 0;
    if (mag > max) max = mag;
  }
  return max;
}

export function registerChargedParticleInBFieldSolver(): void {
  solverRegistry.register({
    id: 'em-charged-particle-in-bfield',
    label: '带电粒子在匀强磁场中运动',
    pattern: {
      entityTypes: ['point-charge', 'uniform-bfield'],
      relationType: 'field-effect',
      qualifier: { interaction: 'magnetic' },
    },
    solveMode: 'numerical',
    integrator: 'semi-implicit-euler',
    solve: solver,
  });
}
