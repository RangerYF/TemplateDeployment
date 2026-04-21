import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, OrthogonalDecomposition } from '@/core/types';

const G = 9.8; // m/s²

/**
 * 水平面统一求解器
 *
 * 通过参数自动判断场景：
 * - 外力 F（F=0 时无外力，F>0 时有外力）
 * - 光滑/粗糙（μ=0 为光滑）
 * - 有无初速度（initialVelocity slider）
 *
 * 逐力判断：
 * - 重力 G：始终存在
 * - 支持力 N：N = mg - F·sinθ（N>0 时存在）
 * - 外力 F外：F>0 时存在
 * - 摩擦力 f：μ>0 且 N>0 且有水平运动趋势时存在
 */
const horizontalSurfaceSolver: SolverFunction = (scene, time) => {
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  if (!block) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // ─── 参数读取 ───
  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 2;
  const v0 = (scene.paramValues.initialVelocity as number) ?? 0;
  const F = (scene.paramValues.appliedForce as number) ?? 0;
  const angleDeg = (scene.paramValues.forceAngle as number) ?? 0;
  const mu = (scene.paramValues.friction as number) ?? 0;

  const mg = mass * G;
  const angleRad = (angleDeg * Math.PI) / 180;
  const Fcos = F * Math.cos(angleRad);
  const Fsin = F * Math.sin(angleRad);

  // ─── 支持力 ───
  let N = mg - Fsin;
  if (N < 0) N = 0;

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
  if (N > 0) {
    forces.push({
      type: 'normal',
      label: 'N',
      magnitude: N,
      direction: { x: 0, y: 1 },
    });
  }

  // 外力
  if (F > 0) {
    forces.push({
      type: 'custom',
      label: 'F外',
      magnitude: F,
      direction: { x: Math.cos(angleRad), y: Math.sin(angleRad) },
    });
  }

  // ─── 摩擦力与加速度计算 ───
  // 水平方向净驱动力（不含摩擦）
  const drivingForceX = Fcos;
  // 初速度方向：+x
  // 需要综合考虑初速度和外力来判断运动状态

  let frictionMag = 0;
  let ax = 0;

  if (N > 0 && mu > 0) {
    const maxStaticFriction = mu * N;

    if (v0 === 0 && Math.abs(drivingForceX) < 1e-6) {
      // 无初速度、无水平驱动力 → 静止，无摩擦力
      ax = 0;
      frictionMag = 0;
    } else if (v0 === 0) {
      // 无初速度、有水平驱动力 → 判断静摩擦是否足够
      if (Math.abs(drivingForceX) <= maxStaticFriction) {
        // 静摩擦平衡
        frictionMag = Math.abs(drivingForceX);
        ax = 0;
      } else {
        // 动摩擦，开始加速
        frictionMag = mu * N;
        ax = (drivingForceX - Math.sign(drivingForceX) * frictionMag) / mass;
      }
    } else {
      // 有初速度
      // 阶段1：初速度方向（+x）减速
      const aDecel = mu * G; // 摩擦减速大小
      const tStop = v0 / aDecel;

      if (time <= tStop) {
        // 仍在减速中
        frictionMag = mu * N;
        ax = (drivingForceX - frictionMag) / mass; // 摩擦力反向（-x）
      } else {
        // 已停止，检查外力能否再次推动
        if (Math.abs(drivingForceX) <= maxStaticFriction) {
          frictionMag = Math.abs(drivingForceX);
          ax = 0;
        } else {
          frictionMag = mu * N;
          ax = (drivingForceX - Math.sign(drivingForceX) * frictionMag) / mass;
        }
      }
    }

    if (frictionMag > 0.001) {
      // 摩擦力方向：与运动方向（或运动趋势方向）相反
      let frictionDirX: number;
      if (v0 > 0 && time <= v0 / (mu * G)) {
        frictionDirX = -1; // 与 +x 初速度方向相反
      } else if (Math.abs(drivingForceX) > 1e-6) {
        frictionDirX = -Math.sign(drivingForceX);
      } else {
        frictionDirX = -1; // fallback
      }
      forces.push({
        type: 'friction',
        label: 'f',
        magnitude: frictionMag,
        direction: { x: frictionDirX, y: 0 },
      });
    }
  } else if (N > 0) {
    // 光滑面
    ax = drivingForceX / mass;
  } else {
    // N=0，物块被提起
    ax = drivingForceX / mass;
  }

  // ─── 合力 ───
  let rX = 0;
  let rY = 0;
  for (const f of forces) {
    rX += f.direction.x * f.magnitude;
    rY += f.direction.y * f.magnitude;
  }
  const rMag = Math.sqrt(rX * rX + rY * rY);
  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: rMag,
    direction: rMag > 1e-6 ? { x: rX / rMag, y: rY / rMag } : { x: 0, y: 0 },
  };

  // ─── 正交分解（仅当有斜向外力时） ───
  const appliedForce = forces.find((f) => f.label === 'F外');
  let decomposition: OrthogonalDecomposition | undefined;
  if (appliedForce && Math.abs(angleDeg) > 0.5) {
    decomposition = {
      axis1: { x: 1, y: 0 },
      axis2: { x: 0, y: 1 },
      axis1Label: '水平',
      axis2Label: '竖直',
      components: [
        {
          force: appliedForce,
          component1: Fcos,
          component2: Fsin,
          label1: 'Fcosθ',
          label2: 'Fsinθ',
        },
      ],
    };
  }

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces,
    resultant,
    decomposition,
  };

  // ─── 运动状态 ───
  let vx: number;
  let dx: number;

  if (v0 > 0 && mu > 0 && N > 0) {
    // 有初速度 + 有摩擦：分段计算
    const aDecel = mu * G;
    const tStop = v0 / aDecel;

    if (time <= tStop) {
      // 减速阶段
      const aTotal = (drivingForceX - mu * N) / mass;
      vx = v0 + aTotal * time;
      dx = v0 * time + 0.5 * aTotal * time * time;
      if (vx < 0) { vx = 0; } // 速度不变负（单方向）
    } else {
      // 停止后的位移
      const dxStop = v0 * tStop + 0.5 * ((drivingForceX - mu * N) / mass) * tStop * tStop;
      const tAfter = time - tStop;

      if (Math.abs(drivingForceX) > mu * N + 0.001) {
        // 外力足以再次推动
        const aAfter = (drivingForceX - Math.sign(drivingForceX) * mu * N) / mass;
        vx = aAfter * tAfter;
        dx = dxStop + 0.5 * aAfter * tAfter * tAfter;
      } else {
        // 静止
        vx = 0;
        dx = dxStop;
      }
    }
  } else {
    // 无初速度 或 光滑面：匀加速
    vx = v0 + ax * time;
    dx = v0 * time + 0.5 * ax * time * time;
  }

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

export function registerHorizontalSurfaceSolver(): void {
  solverRegistry.register({
    id: 'mech-horizontal-surface',
    label: '水平面受力',
    pattern: {
      entityTypes: ['block', 'surface'],
      relationType: 'contact',
      qualifier: { surface: 'horizontal' },
    },
    solveMode: 'analytical',
    solve: horizontalSurfaceSolver,
    eventDetectors: [
      {
        eventType: 'velocity-zero',
        detect: (_scene, result, prevResult) => {
          if (!prevResult) return null;
          for (const [entityId, motion] of result.motionStates) {
            const prev = prevResult.motionStates.get(entityId);
            if (prev && Math.hypot(prev.velocity.x, prev.velocity.y) > 0.01
              && Math.hypot(motion.velocity.x, motion.velocity.y) < 0.01) {
              return { eventType: 'velocity-zero', entityId };
            }
          }
          return null;
        },
      },
    ],
  });
}
