import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Entity, ForceAnalysis, MotionState, PhysicsResult } from '@/core/types';
import {
  initializeMolecules,
  computeSpeedHistogram,
} from '../logic/maxwell-distribution';

/**
 * 气体分子运动求解器 (THM-001)
 *
 * 数值模拟：
 * 1. 粒子自由运动
 * 2. 与容器壁弹性碰撞
 * 3. 粒子间不碰撞（Phase 1 简化）
 * 4. 每帧更新速率分布直方图
 */
const solver: SolverFunction = (scene, _time, dt) => {
  const forceAnalyses = new Map<string, ForceAnalysis>();
  const motionStates = new Map<string, MotionState>();

  const molecules = findEntity(scene.entities, 'gas-molecules');
  if (!molecules) {
    return { time: 0, forceAnalyses, motionStates };
  }

  const count = (molecules.properties.count as number) ?? 200;
  const temperature = (molecules.properties.temperature as number) ?? 300;
  const mass = (molecules.properties.molecularMass as number) ?? 4.65e-26;
  const containerW = (molecules.properties.containerWidth as number) ?? 4;
  const containerH = (molecules.properties.containerHeight as number) ?? 3;

  let positions = (molecules.properties.positions as number[]) ?? [];
  let velocities = (molecules.properties.velocities as number[]) ?? [];

  // 初始化分子（首次调用或数量不匹配）
  if (positions.length !== count * 2 || velocities.length !== count * 2) {
    const init = initializeMolecules(count, temperature, mass, containerW, containerH);
    positions = init.positions;
    velocities = init.velocities;
  }

  // 时间步长缩放（分子速度量级 ~500 m/s，但显示空间 ~4m）
  // 使用缩放因子使运动可见
  const scaledDt = dt * 0.5; // 视觉缩放

  // 更新位置 + 壁碰撞
  for (let i = 0; i < count; i++) {
    const xi = i * 2;
    const yi = i * 2 + 1;

    const vx = velocities[xi] as number;
    const vy = velocities[yi] as number;

    // 更新位置
    positions[xi] = (positions[xi] as number) + vx * scaledDt;
    positions[yi] = (positions[yi] as number) + vy * scaledDt;

    // 壁碰撞（弹性反射）
    const px = positions[xi] as number;
    const py = positions[yi] as number;

    if (px < 0) {
      positions[xi] = -px;
      velocities[xi] = -vx;
    } else if (px > containerW) {
      positions[xi] = 2 * containerW - px;
      velocities[xi] = -vx;
    }

    if (py < 0) {
      positions[yi] = -py;
      velocities[yi] = -vy;
    } else if (py > containerH) {
      positions[yi] = 2 * containerH - py;
      velocities[yi] = -vy;
    }
  }

  // 每隔若干帧重新统计直方图
  const { histogram, bins } = computeSpeedHistogram(velocities);

  // 更新实体属性
  molecules.properties.positions = positions;
  molecules.properties.velocities = velocities;
  molecules.properties.speedHistogram = histogram;
  molecules.properties.histogramBins = bins;

  return { time: 0, forceAnalyses, motionStates } satisfies PhysicsResult;
};

function findEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const e of entities.values()) {
    if (e.type === type) return e;
  }
  return undefined;
}

export function registerGasMolecularMotionSolver(): void {
  solverRegistry.register({
    id: 'thm-gas-molecular-motion',
    label: '气体分子运动',
    pattern: {
      entityTypes: ['gas-container', 'gas-molecules'],
      relationType: 'contains',
      qualifier: { thermal: 'gas-molecular-motion' },
    },
    solveMode: 'numerical',
    integrator: 'semi-implicit-euler',
    solve: solver,
  });
}
