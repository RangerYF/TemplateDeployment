import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, OrthogonalDecomposition, Vec2 } from '@/core/types';

const G = 9.8; // m/s²

/**
 * 计算物块在斜面上的位置
 *
 * 斜面几何：
 *        topCorner
 *       /|
 *      / |
 *     /  | height
 *    /θ__|
 *  bottomLeft (slopePos)  →  bottomRight
 *
 * 斜边从 bottomRight 到 topCorner，方向 (-cosA, sinA)（向上）
 * d = 从斜面底端（bottomRight）沿斜边向上的距离
 */
function slopeBlockPos(
  slopePos: Vec2,
  slopeLength: number,
  d: number,
  cosA: number,
  sinA: number,
): Vec2 {
  // bottomRight = slopePos + (slopeLength * cosA, 0)
  // 沿斜边向上偏移 d：方向 (-cosA, sinA)
  return {
    x: slopePos.x + slopeLength * cosA - d * cosA,
    y: slopePos.y + d * sinA,
  };
}

/**
 * 斜面统一求解器
 *
 * 内部通过参数自动判断场景：
 * - initialVelocity > 0 → 冲上斜面（sliding-up）
 * - friction = 0 → 光滑斜面（smooth-slide）
 * - tanθ ≤ μ → 静止平衡（static）
 * - tanθ > μ → 自由下滑（sliding-down）
 */
const blockOnSlopeSolver: SolverFunction = (scene, time) => {
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  const slope = Array.from(scene.entities.values()).find((e) => e.type === 'slope');
  if (!block || !slope) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // ─── 参数读取 ───
  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 2;
  const angleDeg = (scene.paramValues.slopeAngle as number) ?? (slope.properties.angle as number) ?? 30;
  const mu = (scene.paramValues.friction as number) ?? 0;
  const v0 = (scene.paramValues.initialVelocity as number) ?? 0;
  const appliedF = (scene.paramValues.appliedForce as number) ?? 0;
  const forceAngleDeg = (scene.paramValues.forceAngle as number) ?? 0;
  const forceAngleRad = (forceAngleDeg * Math.PI) / 180;

  const angleRad = (angleDeg * Math.PI) / 180;
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);
  const mg = mass * G;

  // ─── 通用力 ───
  const gravity: Force = {
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  };

  // ─── 外力分解（以沿斜面向上为 0°，逆时针为正） ───
  const FalongSlope = appliedF * Math.cos(forceAngleRad);  // 沿斜面向上为正
  const FperpSlope = appliedF * Math.sin(forceAngleRad);   // 垂直斜面向外为正

  // 支持力：N = mg·cosθ - F垂直斜面外（外力向外减小法向力）
  let N = mg * cosA - FperpSlope;
  if (N < 0) N = 0; // 脱离斜面时法向力为零

  const normal: Force = {
    type: 'normal',
    label: 'N',
    magnitude: N,
    direction: { x: sinA, y: cosA }, // 垂直斜面向外
  };

  const forces: Force[] = [gravity, normal];

  // 沿斜面净驱动力的等效值（用于后续运动判断）
  const FextSigned = FalongSlope; // 沿斜面向上为正，与原有变量语义兼容

  if (appliedF > 0) {
    // 外力方向（世界坐标系）：cos(α)·沿斜面向上 + sin(α)·垂直斜面向外
    const forceDirX = Math.cos(forceAngleRad) * (-cosA) + Math.sin(forceAngleRad) * sinA;
    const forceDirY = Math.cos(forceAngleRad) * sinA + Math.sin(forceAngleRad) * cosA;
    forces.push({
      type: 'custom',
      label: 'F外',
      magnitude: appliedF,
      direction: { x: forceDirX, y: forceDirY },
    });
  }

  // ─── 正交分解坐标系（始终输出，渲染由交互触发） ───
  const axis1 = { x: cosA, y: -sinA };  // 沿斜面向下
  const axis2 = { x: sinA, y: cosA };  // 垂直斜面向外

  const decompComponents: OrthogonalDecomposition['components'] = [
    {
      force: gravity,
      component1: mg * sinA,   // mgsinθ，沿斜面向下
      component2: -mg * cosA,  // mgcosθ，指向斜面（负方向）
      label1: 'mgsinθ',
      label2: 'mgcosθ',
    },
  ];

  // 外力不沿斜面方向时，加入正交分解
  if (appliedF > 0 && Math.abs(forceAngleDeg) > 0.5 && Math.abs(Math.abs(forceAngleDeg) - 180) > 0.5) {
    const appliedForce = forces.find(f => f.type === 'custom' && f.label === 'F外');
    if (appliedForce) {
      decompComponents.push({
        force: appliedForce,
        component1: -FalongSlope,  // axis1 是沿斜面向下，外力向上分量取反
        component2: FperpSlope,    // 垂直斜面向外
        label1: 'F沿斜面',
        label2: 'F⊥斜面',
      });
    }
  }

  const decomposition: OrthogonalDecomposition = {
    axis1,
    axis2,
    axis1Label: '沿斜面',
    axis2Label: '垂直斜面',
    components: decompComponents,
  };

  // ─── 斜面几何 ───
  const slopePos = slope.transform.position;
  const slopeLength = (slope.properties.length as number) ?? 3;
  const d0 = slopeLength * 0.65;

  // ─── 沿斜面净驱动力（正=向下，负=向上） ───
  // 重力沿斜面向下分量 mg·sinθ 为正
  // 外力沿斜面向上为负（FextSigned > 0 时力向上，抵消向下分量）
  const gravityAlongSlope = mg * sinA; // 向下为正
  const netDriveDown = gravityAlongSlope - FextSigned; // 正=净力向下，负=净力向上

  if (v0 > 0) {
    // ── 冲上斜面 ──
    // 上冲减速加速度 = (mg·sinθ - F沿斜面 + μN) / m（全部阻碍向上运动）
    const aUpDecel = (gravityAlongSlope - FextSigned + mu * N) / mass;

    if (aUpDecel <= 0) {
      // 外力足够大，物块持续上冲加速（不会减速停下）
      const aAccel = -aUpDecel; // 正值加速度（向上）
      const s = v0 * time + 0.5 * aAccel * time * time;
      const v = v0 + aAccel * time;
      const d = d0 + s;

      return buildResult(block.id, time, forces, mu * N, -1,
        sinA, cosA, angleRad, decomposition,
        slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
        { x: -v * cosA, y: v * sinA },
        -aAccel); // 沿斜面向下为正
    }

    const tStop = v0 / aUpDecel;

    if (time <= tStop) {
      const sUp = v0 * time - 0.5 * aUpDecel * time * time;
      const vCurrent = v0 - aUpDecel * time;
      const d = d0 + sUp;

      return buildResult(block.id, time, forces, mu * N, -1,
        sinA, cosA, angleRad, decomposition,
        slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
        { x: -vCurrent * cosA, y: vCurrent * sinA },
        aUpDecel);
    } else {
      const sMax = v0 * tStop - 0.5 * aUpDecel * tStop * tStop;
      const dMax = d0 + sMax;

      // 停止后判断：沿斜面净力是否能推动（考虑外力）
      // 净驱动力向下 = mg·sinθ - Fext，摩擦力向上最大 = μN
      if (netDriveDown > mu * N + 0.001) {
        // 下滑
        const aDown = (netDriveDown - mu * N) / mass;
        const tAfter = time - tStop;
        const sDown = 0.5 * aDown * tAfter * tAfter;
        const vDown = aDown * tAfter;
        const d = dMax - sDown;

        return buildResult(block.id, time, forces, mu * N, 1,
          sinA, cosA, angleRad, decomposition,
          slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
          { x: vDown * cosA, y: -vDown * sinA },
          aDown);
      } else if (netDriveDown < -(mu * N + 0.001)) {
        // 外力推上去
        const aUp2 = (-netDriveDown - mu * N) / mass;
        const tAfter = time - tStop;
        const sUp2 = 0.5 * aUp2 * tAfter * tAfter;
        const vUp2 = aUp2 * tAfter;
        const d = dMax + sUp2;

        return buildResult(block.id, time, forces, mu * N, -1,
          sinA, cosA, angleRad, decomposition,
          slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
          { x: -vUp2 * cosA, y: vUp2 * sinA },
          -aUp2);
      } else {
        // 静止
        const staticFriction = Math.abs(netDriveDown);
        return buildResult(block.id, time, forces, staticFriction, netDriveDown >= 0 ? 1 : -1,
          sinA, cosA, angleRad, decomposition,
          slopeBlockPos(slopePos, slopeLength, dMax, cosA, sinA),
          { x: 0, y: 0 },
          0);
      }
    }
  } else if (mu === 0) {
    // ── 光滑斜面（无摩擦） ──
    // 净加速度沿斜面向下 = netDriveDown / mass
    const aSlope = netDriveDown / mass;
    if (aSlope > 0.001) {
      // 下滑
      const s = 0.5 * aSlope * time * time;
      const v = aSlope * time;
      const d = d0 - s;

      return buildResult(block.id, time, forces, 0, 0,
        sinA, cosA, angleRad, decomposition,
        slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
        { x: v * cosA, y: -v * sinA },
        aSlope);
    } else if (aSlope < -0.001) {
      // 向上加速（外力推上去）
      const aUp2 = -aSlope;
      const s = 0.5 * aUp2 * time * time;
      const v = aUp2 * time;
      const d = d0 + s;

      return buildResult(block.id, time, forces, 0, 0,
        sinA, cosA, angleRad, decomposition,
        slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
        { x: -v * cosA, y: v * sinA },
        aSlope); // 负值表示向上
    } else {
      // 平衡
      return buildResult(block.id, time, forces, 0, 0,
        sinA, cosA, angleRad, decomposition,
        slopeBlockPos(slopePos, slopeLength, d0, cosA, sinA),
        { x: 0, y: 0 },
        0);
    }
  } else if (Math.abs(netDriveDown) <= mu * N) {
    // ── 静止平衡（摩擦力足以平衡净驱动力） ──
    const staticFriction = Math.abs(netDriveDown);
    const frictionDir = netDriveDown >= 0 ? 1 : -1; // 正=向上抵抗下滑，负=向下抵抗上推

    return buildResult(block.id, time, forces, staticFriction, frictionDir,
      sinA, cosA, angleRad, decomposition,
      slopeBlockPos(slopePos, slopeLength, d0, cosA, sinA),
      { x: 0, y: 0 },
      0);
  } else if (netDriveDown > 0) {
    // ── 自由下滑 ──
    const aSlide = (netDriveDown - mu * N) / mass;
    const s = 0.5 * aSlide * time * time;
    const v = aSlide * time;
    const d = d0 - s;

    return buildResult(block.id, time, forces, mu * N, 1,
      sinA, cosA, angleRad, decomposition,
      slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
      { x: v * cosA, y: -v * sinA },
      aSlide);
  } else {
    // ── 外力推上斜面 ──
    const aUp2 = (-netDriveDown - mu * N) / mass;
    const s = 0.5 * aUp2 * time * time;
    const v = aUp2 * time;
    const d = d0 + s;

    return buildResult(block.id, time, forces, mu * N, -1,
      sinA, cosA, angleRad, decomposition,
      slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
      { x: -v * cosA, y: v * sinA },
      -aUp2);
  }
};

/** 构建 PhysicsResult */
function buildResult(
  blockId: string,
  time: number,
  baseForcesArr: Force[],
  frictionMag: number,
  frictionDirAlongSlope: number, // +1=沿斜面向上, -1=沿斜面向下, 0=无摩擦
  sinA: number,
  cosA: number,
  angleRad: number,
  decomposition: OrthogonalDecomposition | undefined,
  position: Vec2,
  velocity: Vec2,
  accelAlongSlope: number,
) {
  const forces = [...baseForcesArr];

  // 摩擦力
  if (frictionMag > 0.001 && frictionDirAlongSlope !== 0) {
    const fDir = frictionDirAlongSlope > 0
      ? { x: -cosA, y: sinA }   // 沿斜面向上
      : { x: cosA, y: -sinA };  // 沿斜面向下
    forces.push({
      type: 'friction',
      label: 'f',
      magnitude: frictionMag,
      direction: fDir,
    });
  }

  // 合力
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
    direction: rMag > 1e-6
      ? { x: rX / rMag, y: rY / rMag }
      : { x: 0, y: 0 },
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: blockId,
    forces,
    resultant,
    decomposition,
  };

  const aVec = Math.abs(accelAlongSlope) > 1e-6
    ? { x: accelAlongSlope * cosA, y: -accelAlongSlope * sinA }
    : { x: 0, y: 0 };

  const motionState: MotionState = {
    entityId: blockId,
    position,
    velocity,
    acceleration: aVec,
    rotation: -angleRad, // 物块底边与斜面对齐（顺时针旋转θ）
  };

  return {
    time,
    forceAnalyses: new Map([[blockId, forceAnalysis]]),
    motionStates: new Map([[blockId, motionState]]),
  };
}

// ─── 注册统一求解器 ───

export function registerBlockOnSlopeSolver(): void {
  solverRegistry.register({
    id: 'mech-block-on-slope',
    label: '斜面受力',
    pattern: {
      entityTypes: ['block', 'slope'],
      relationType: 'contact',
      qualifier: { surface: 'inclined' },
    },
    solveMode: 'analytical',
    solve: blockOnSlopeSolver,
    eventDetectors: [
      {
        eventType: 'velocity-zero',
        detect: (_scene, result, prevResult) => {
          if (!prevResult) return null;
          for (const [entityId, motion] of result.motionStates) {
            const prev = prevResult.motionStates.get(entityId);
            if (!prev) continue;
            const prevSpeed = Math.hypot(prev.velocity.x, prev.velocity.y);
            const curSpeed = Math.hypot(motion.velocity.x, motion.velocity.y);
            if (prevSpeed > 0.01 && curSpeed < 0.01) {
              return { eventType: 'velocity-zero', entityId };
            }
          }
          return null;
        },
      },
    ],
  });
}
