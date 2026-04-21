import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

const G = 9.8;

/**
 * 竖直弹簧求解器（FM-051 竖直）
 *
 *   /////// (天花板)
 *     ● pivot-top
 *     |
 *     ⌇ spring
 *     ⌇
 *     |
 *    [A] block
 *
 * 平衡态：kx₀ = mg → x₀ = mg/k
 * 弹簧力 F弹 = kx₀ = mg（向上）
 */
const springVerticalSolver: SolverFunction = (scene, time) => {
  const allEntities = Array.from(scene.entities.values());
  const block = allEntities.find((e) => e.type === 'block');
  const pivot = allEntities.find((e) => e.type === 'pivot');
  const spring = allEntities.find((e) => e.type === 'spring');
  if (!block || !pivot || !spring) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 1;
  const k = (scene.paramValues.stiffness as number) ?? (spring.properties.stiffness as number) ?? 100;
  const naturalLength = (spring.properties.naturalLength as number) ?? 1.0;

  // 外力参数
  const F = (scene.paramValues.appliedForce as number) ?? 0;
  const angleDeg = (scene.paramValues.forceAngle as number) ?? 0;
  const angleRad = (angleDeg * Math.PI) / 180;
  const Fy = F * Math.sin(angleRad); // 竖直向上为正

  const mg = mass * G;
  // 平衡：kx₀ = mg - Fy（向上力减小伸长量）
  let x0 = (mg - Fy) / k;
  if (x0 < 0) x0 = 0; // 弹簧不能被推到自然长度以上（压缩由自重驱动）

  const springForce = k * x0;

  // 力列表
  const forces: Force[] = [];

  // 重力
  forces.push({
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  });

  // 弹簧弹力（向上，拉力）
  forces.push({
    type: 'spring',
    label: 'F弹',
    magnitude: springForce,
    direction: { x: 0, y: 1 },
  });

  // 外力
  if (F > 0) {
    forces.push({
      type: 'custom',
      label: 'F',
      magnitude: F,
      direction: { x: Math.cos(angleRad), y: Math.sin(angleRad) },
    });
  }

  // 合力
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

  // 物块位置 = pivot 正下方，距离 = naturalLength + x₀
  const blockPos = {
    x: pivot.transform.position.x,
    y: pivot.transform.position.y - naturalLength - x0,
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

export function registerSpringVerticalSolver(): void {
  solverRegistry.register({
    id: 'mech-spring-vertical',
    label: '竖直弹簧',
    pattern: {
      entityTypes: ['block', 'pivot', 'spring'],
      relationType: 'connection',
      qualifier: { spring: 'vertical' },
    },
    solveMode: 'analytical',
    solve: springVerticalSolver,
  });
}
