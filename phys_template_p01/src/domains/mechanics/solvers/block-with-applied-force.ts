import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

const G = 9.8; // m/s²

/**
 * 水平面施加外力求解器（解析解）
 *
 * 物块在水平面上受斜向外力 F（与水平方向夹角 θ），分析四个力的平衡或非平衡。
 *
 * 竖直方向：N + F·sinθ = mg → N = mg − F·sinθ
 * 水平方向：F·cosθ − f = ma
 *
 * 摩擦力判定：
 * - frictionToggle = false（光滑）：f = 0
 * - frictionToggle = true（粗糙）：
 *   - 静摩擦足够：|F·cosθ| ≤ μN → f = F·cosθ，a = 0
 *   - 动摩擦：f = μN，a = (F·cosθ − μN) / m
 */
const blockWithAppliedForceSolver: SolverFunction = (scene, time) => {
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  if (!block) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // 参数读取（优先 paramValues）
  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 2;
  const F = (scene.paramValues.appliedForce as number) ?? 10;
  const angleDeg = (scene.paramValues.forceAngle as number) ?? 30;
  const frictionToggle = (scene.paramValues.frictionToggle as boolean) ?? true;
  const mu = frictionToggle
    ? ((scene.paramValues.friction as number) ?? 0.3)
    : 0;

  const mg = mass * G;
  const angleRad = (angleDeg * Math.PI) / 180;
  const Fcos = F * Math.cos(angleRad);
  const Fsin = F * Math.sin(angleRad);

  // 支持力
  let N = mg - Fsin;
  if (N < 0) N = 0; // 物块被提起，支持力为零

  // ─── 力列表 ───
  const forces: Force[] = [];

  // 重力 G：竖直向下
  forces.push({
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  });

  // 支持力 N：竖直向上（仅在 N > 0 时）
  if (N > 0) {
    forces.push({
      type: 'normal',
      label: 'N',
      magnitude: N,
      direction: { x: 0, y: 1 },
    });
  }

  // 外力 F外：斜向
  forces.push({
    type: 'custom',
    label: 'F外',
    magnitude: F,
    direction: { x: Math.cos(angleRad), y: Math.sin(angleRad) },
  });

  // 摩擦力判定与加速度计算
  let frictionMag = 0;
  let ax = 0;

  if (N > 0 && mu > 0) {
    const maxStaticFriction = mu * N;
    if (Math.abs(Fcos) <= maxStaticFriction) {
      // 静摩擦平衡
      frictionMag = Math.abs(Fcos);
      ax = 0;
    } else {
      // 动摩擦
      frictionMag = mu * N;
      ax = (Fcos - Math.sign(Fcos) * frictionMag) / mass;
    }

    if (frictionMag > 0) {
      forces.push({
        type: 'friction',
        label: 'f',
        magnitude: frictionMag,
        direction: { x: -Math.sign(Fcos), y: 0 },
      });
    }
  } else if (N > 0) {
    // 光滑面，无摩擦
    ax = Fcos / mass;
  } else {
    // 物块被提起（N=0），此情况简化处理：竖直方向有净力
    ax = Fcos / mass;
  }

  // 合力
  const resultantX = Fcos - Math.sign(Fcos) * frictionMag;
  const resultantY = N > 0 ? 0 : (Fsin - mg); // N=0 时竖直有净力
  const resultantMag = Math.sqrt(resultantX * resultantX + resultantY * resultantY);
  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: resultantMag,
    direction: resultantMag > 1e-6
      ? { x: resultantX / resultantMag, y: resultantY / resultantMag }
      : { x: 0, y: 0 },
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces,
    resultant,
  };

  // ─── 运动状态 ───
  // 位移计算（匀加速）
  const isMoving = Math.abs(ax) > 1e-6;
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

export function registerBlockWithAppliedForceSolver(): void {
  solverRegistry.register({
    id: 'mech-block-with-applied-force',
    label: '水平面·施加外力',
    pattern: {
      entityTypes: ['block', 'surface'],
      relationType: 'contact',
      qualifier: { surface: 'horizontal', motion: 'applied-force' },
    },
    solveMode: 'analytical',
    solve: blockWithAppliedForceSolver,
  });
}
