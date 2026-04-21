import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import { kB } from '../logic/gas-law-utils';
import { initializeMolecules } from '../logic/maxwell-distribution';

/**
 * 布朗运动求解器 (THM-041)
 *
 * 数值模拟：
 * 1. 大粒子随机游走，步长 ∝ √T·√dt
 * 2. 背景液体分子运动
 * 3. 记录轨迹
 */
const solver: SolverFunction = (scene, _time, dt) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const particle = findEntity(scene.entities, 'brownian-particle');
  if (!particle) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const temperature = (particle.properties.temperature as number) ?? 300;
  const containerW = (particle.properties.containerWidth as number) ?? 4;
  const containerH = (particle.properties.containerHeight as number) ?? 3;
  const liquidCount = (particle.properties.liquidMoleculeCount as number) ?? 100;

  let currentX = (particle.properties.currentX as number) ?? 0;
  let currentY = (particle.properties.currentY as number) ?? 0;
  let trajectory = (particle.properties.trajectory as number[]) ?? [];
  let liquidPositions = (particle.properties.liquidPositions as number[]) ?? [];
  let liquidVelocities = (particle.properties.liquidVelocities as number[]) ?? [];

  // 初始化
  if (liquidPositions.length !== liquidCount * 2) {
    const init = initializeMolecules(
      liquidCount,
      temperature,
      4.65e-26, // 液体分子质量
      containerW,
      containerH,
    );
    liquidPositions = init.positions;
    liquidVelocities = init.velocities;
    trajectory = [currentX, currentY];
  }

  // 大粒子随机游走
  // 步长 ∝ √(kB·T) · √dt
  const stepScale = Math.sqrt(kB * temperature) * 1e11 * Math.sqrt(dt);
  const dx = (Math.random() - 0.5) * 2 * stepScale;
  const dy = (Math.random() - 0.5) * 2 * stepScale;

  currentX += dx;
  currentY += dy;

  // 边界约束
  const halfW = containerW / 2 * 0.8;
  const halfH = containerH / 2 * 0.8;
  currentX = Math.max(-halfW, Math.min(halfW, currentX));
  currentY = Math.max(-halfH, Math.min(halfH, currentY));

  // 记录轨迹（最多 500 点）
  trajectory.push(currentX, currentY);
  const maxTrajectoryPoints = 500 * 2;
  if (trajectory.length > maxTrajectoryPoints) {
    trajectory = trajectory.slice(trajectory.length - maxTrajectoryPoints);
  }

  // 更新液体分子位置
  const scaledDt = dt * 0.3;
  for (let i = 0; i < liquidCount; i++) {
    const xi = i * 2;
    const yi = i * 2 + 1;

    const lvx = liquidVelocities[xi] as number;
    const lvy = liquidVelocities[yi] as number;
    let lpx = (liquidPositions[xi] as number) + lvx * scaledDt;
    let lpy = (liquidPositions[yi] as number) + lvy * scaledDt;

    // 壁碰撞
    if (lpx < 0 || lpx > containerW) {
      liquidVelocities[xi] = -lvx;
      lpx = Math.max(0, Math.min(containerW, lpx));
    }
    if (lpy < 0 || lpy > containerH) {
      liquidVelocities[yi] = -lvy;
      lpy = Math.max(0, Math.min(containerH, lpy));
    }
    liquidPositions[xi] = lpx;
    liquidPositions[yi] = lpy;
  }

  // 更新属性
  particle.properties.currentX = currentX;
  particle.properties.currentY = currentY;
  particle.properties.trajectory = trajectory;
  particle.properties.liquidPositions = liquidPositions;
  particle.properties.liquidVelocities = liquidVelocities;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const e of entities.values()) {
    if (e.type === type) return e;
  }
  return undefined;
}

export function registerBrownianMotionSolver(): void {
  solverRegistry.register({
    id: 'thm-brownian-motion',
    label: '布朗运动',
    pattern: {
      entityTypes: ['gas-container', 'brownian-particle'],
      relationType: 'contains',
      qualifier: { thermal: 'brownian-motion' },
    },
    solveMode: 'numerical',
    integrator: 'semi-implicit-euler',
    solve: solver,
  });
}
