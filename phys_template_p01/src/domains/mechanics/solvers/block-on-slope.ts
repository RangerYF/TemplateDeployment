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
 * - friction = 0（或 frictionToggle = false）→ 光滑斜面（smooth-slide）
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
  const frictionToggle = (scene.paramValues.frictionToggle as boolean) ?? true;
  const mu = frictionToggle
    ? ((scene.paramValues.friction as number) ?? 0)
    : 0;
  const v0 = (scene.paramValues.initialVelocity as number) ?? 0;

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

  const N = mg * cosA;
  const normal: Force = {
    type: 'normal',
    label: 'N',
    magnitude: N,
    direction: { x: sinA, y: cosA }, // 垂直斜面向外（斜边方向顺时针旋转90°）
  };

  const forces: Force[] = [gravity, normal];

  // ─── 正交分解（仅对重力，受 showDecomposition 开关控制） ───
  const showDecomp = (scene.paramValues.showDecomposition as boolean) ?? true;
  const axis1 = { x: cosA, y: -sinA };  // 沿斜面向下
  const axis2 = { x: sinA, y: cosA };  // 垂直斜面向外

  const decomposition: OrthogonalDecomposition | undefined = showDecomp
    ? {
        axis1,
        axis2,
        components: [
          {
            force: gravity,
            component1: mg * sinA,   // mgsinθ，沿斜面向下
            component2: -mg * cosA,  // mgcosθ，指向斜面（负方向）
          },
        ],
      }
    : undefined;

  // ─── 斜面几何 ───
  const slopePos = slope.transform.position;
  const slopeLength = (slope.properties.length as number) ?? 3;

  // d = 从斜面底端沿斜边向上的距离
  // 沿斜面向下速度/加速度：d 减小
  // 沿斜面向上速度/加速度：d 增大
  // 统一初始位置：所有静态/动态场景使用相同的 d0，避免切换时跳变
  const d0 = slopeLength * 0.65; // 斜面偏上位置，留足滑行空间

  if (v0 > 0) {
    // ── 冲上斜面 ──
    const aUp = G * (sinA + mu * cosA); // 减速加速度大小
    const tStop = v0 / aUp;

    if (time <= tStop) {
      // 上冲阶段：d 增大
      const sUp = v0 * time - 0.5 * aUp * time * time;
      const vCurrent = v0 - aUp * time;
      const d = d0 + sUp;

      return buildResult(block.id, time, forces, mu * N, -1,
        sinA, cosA, angleRad, decomposition,
        slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
        { x: -vCurrent * cosA, y: vCurrent * sinA }, // 沿斜面向上
        -aUp);
    } else {
      const sMax = v0 * tStop - 0.5 * aUp * tStop * tStop;
      const dMax = d0 + sMax;

      if (Math.tan(angleRad) > mu) {
        // 下滑
        const aDown = G * (sinA - mu * cosA);
        const tAfter = time - tStop;
        const sDown = 0.5 * aDown * tAfter * tAfter;
        const vDown = aDown * tAfter;
        const d = dMax - sDown; // d 减小

        return buildResult(block.id, time, forces, mu * N, 1,
          sinA, cosA, angleRad, decomposition,
          slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
          { x: vDown * cosA, y: -vDown * sinA }, // 沿斜面向下
          aDown);
      } else {
        // 停在斜面上
        return buildResult(block.id, time, forces, mg * sinA, 1,
          sinA, cosA, angleRad, decomposition,
          slopeBlockPos(slopePos, slopeLength, dMax, cosA, sinA),
          { x: 0, y: 0 },
          0);
      }
    }
  } else if (mu === 0) {
    // ── 光滑斜面 ──
    const aSlide = G * sinA;
    const s = 0.5 * aSlide * time * time;
    const v = aSlide * time;
    const d = d0 - s; // 下滑，d 减小

    return buildResult(block.id, time, forces, 0, 0,
      sinA, cosA, angleRad, decomposition,
      slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
      { x: v * cosA, y: -v * sinA }, // 沿斜面向下
      aSlide);
  } else if (Math.tan(angleRad) <= mu) {
    // ── 静止平衡 ──
    const d = d0;

    return buildResult(block.id, time, forces, mg * sinA, 1,
      sinA, cosA, angleRad, decomposition,
      slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
      { x: 0, y: 0 },
      0);
  } else {
    // ── 自由下滑 ──
    const aSlide = G * (sinA - mu * cosA);
    const s = 0.5 * aSlide * time * time;
    const v = aSlide * time;
    const d = d0 - s; // 下滑，d 减小

    return buildResult(block.id, time, forces, mu * N, 1,
      sinA, cosA, angleRad, decomposition,
      slopeBlockPos(slopePos, slopeLength, d, cosA, sinA),
      { x: v * cosA, y: -v * sinA },
      aSlide);
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

// ─── 注册 4 个变体 ───

export function registerBlockOnSlopeSolvers(): void {
  const variants: Array<{
    id: string;
    label: string;
    qualifier: Record<string, string>;
    hasEventDetectors: boolean;
  }> = [
    {
      id: 'mech-block-on-slope-static',
      label: '斜面·静止平衡',
      qualifier: { surface: 'inclined', motion: 'static' },
      hasEventDetectors: false,
    },
    {
      id: 'mech-block-on-slope-sliding-down',
      label: '斜面·自由下滑',
      qualifier: { surface: 'inclined', motion: 'sliding-down' },
      hasEventDetectors: false,
    },
    {
      id: 'mech-block-on-slope-sliding-up',
      label: '斜面·冲上斜面',
      qualifier: { surface: 'inclined', motion: 'sliding-up' },
      hasEventDetectors: true,
    },
    {
      id: 'mech-block-on-slope-smooth',
      label: '斜面·光滑无摩擦',
      qualifier: { surface: 'inclined', motion: 'smooth-slide' },
      hasEventDetectors: false,
    },
  ];

  for (const v of variants) {
    solverRegistry.register({
      id: v.id,
      label: v.label,
      pattern: {
        entityTypes: ['block', 'slope'],
        relationType: 'contact',
        qualifier: v.qualifier,
      },
      solveMode: 'analytical',
      solve: blockOnSlopeSolver,
      eventDetectors: v.hasEventDetectors
        ? [
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
          ]
        : undefined,
    });
  }
}
