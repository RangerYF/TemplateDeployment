import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState, Vec2 } from '@/core/types';

const G = 9.8;

/**
 * 计算物块在斜面上的位置
 */
function slopeBlockPos(
  slopePos: Vec2,
  slopeLength: number,
  d: number,
  cosA: number,
  sinA: number,
): Vec2 {
  return {
    x: slopePos.x + slopeLength * cosA - d * cosA,
    y: slopePos.y + d * sinA,
  };
}

/**
 * 绳连斜面-悬挂求解器（FM-032）
 *
 *       ○ pivot-top (定滑轮)
 *      /|
 *     / | rope-2 (竖直段)
 *    /  |
 *   /   [B] 悬挂物块
 *  [A] 斜面物块
 * /____________
 *    slope
 *
 * 约束：绳不可伸长 → |a_A| = |a_B|
 * 设 m₂ 下降（block-A 沿斜面上行）为正方向：
 *   block-A（沿斜面）: T - m₁g·sinθ - μm₁g·cosθ = m₁a
 *   block-B（竖直）: m₂g - T = m₂a
 *   联立：a = (m₂g - m₁g·sinθ - μm₁g·cosθ) / (m₁+m₂)
 *   T = m₂(g - a)
 */
const ropeConnectedInclineSolver: SolverFunction = (scene, time) => {
  const allEntities = Array.from(scene.entities.values());
  const blocks = allEntities.filter((e) => e.type === 'block');
  const slope = allEntities.find((e) => e.type === 'slope');
  const pivot = allEntities.find((e) => e.type === 'pivot');
  if (blocks.length < 2 || !slope || !pivot) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // block-A 在斜面上（y 较低），block-B 悬挂（y 较低时为自由悬挂端）
  // 通过关系区分：有 contact 关系（接触斜面）的是 A
  const contactRelations = Array.from(scene.relations.values()).filter(
    (r) => r.type === 'contact',
  );
  const contactEntityIds = new Set(contactRelations.map((r) => r.sourceEntityId));

  let foundA: typeof blocks[0] | undefined;
  let foundB: typeof blocks[0] | undefined;
  for (const b of blocks) {
    if (contactEntityIds.has(b.id)) {
      foundA = b;
    } else {
      foundB = b;
    }
  }
  if (!foundA || !foundB) {
    // fallback: 左边是 A（斜面上），右边是 B
    blocks.sort((a, b) => a.transform.position.x - b.transform.position.x);
    foundA = blocks[0];
    foundB = blocks[1];
  }
  const blockA = foundA!;
  const blockB = foundB!;

  // ─── 参数读取 ───
  const m1 = (scene.paramValues.mass1 as number) ?? (blockA.properties.mass as number) ?? 2;
  const m2 = (scene.paramValues.mass2 as number) ?? (blockB.properties.mass as number) ?? 3;
  const angleDeg = (scene.paramValues.slopeAngle as number) ?? (slope.properties.angle as number) ?? 30;
  const mu = (scene.paramValues.friction as number) ?? 0.2;
  const analysisMethod = (scene.paramValues.analysisMethod as string) ?? 'isolated';

  // 外力参数
  const FA = (scene.paramValues.forceA as number) ?? 0;
  const angleAForceDeg = (scene.paramValues.forceAngleA as number) ?? 0;
  const angleAForceRad = (angleAForceDeg * Math.PI) / 180;
  const FB = (scene.paramValues.forceB as number) ?? 0;
  const angleBForceDeg = (scene.paramValues.forceAngleB as number) ?? 0;
  const angleBForceRad = (angleBForceDeg * Math.PI) / 180;

  const angleRad = (angleDeg * Math.PI) / 180;
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);
  const m1g = m1 * G;
  const m2g = m2 * G;

  // ─── 外力分解 ───
  // block-A（斜面上）：外力角度以水平向右为 0°，逆时针为正（全局坐标系）
  const FAx = FA * Math.cos(angleAForceRad); // 水平向右
  const FAy = FA * Math.sin(angleAForceRad); // 竖直向上
  // 分解到沿斜面/垂直斜面（沿斜面向上为正，垂直斜面向外为正）
  const FA_along = -FAx * cosA + FAy * sinA; // 沿斜面向上分量
  const FA_perp = FAx * sinA + FAy * cosA;   // 垂直斜面向外分量

  // block-B（悬挂）：外力角度以水平向右为 0°
  const FBy = FB * Math.sin(angleBForceRad); // 竖直向上（水平分量在简化模型中不影响竖直运动方程）

  // ─── 法力（考虑外力垂直分量） ───
  let NA = m1g * cosA - FA_perp;
  if (NA < 0) NA = 0;

  // ─── 求解：假设 m₂ 下降为正 ───
  // block-A 沿斜面：T + FA_along - m₁g·sinθ - μNA = m₁a
  // block-B 竖直：m₂g - T - FBy = m₂a  （FBy 向上减小驱动力）
  // 联立：a = (m₂g - FBy - m₁g·sinθ + FA_along - μNA) / (m₁+m₂)
  const drivingForce = m2g - FBy - m1g * sinA + FA_along;
  const frictionForce = mu * NA;

  // 先判断是否能运动
  let a: number;
  let T: number;
  let motionDirection: 'down' | 'up' | 'static'; // m₂ 的运动方向

  if (Math.abs(drivingForce) <= frictionForce) {
    // 静摩擦力足以平衡，系统静止
    a = 0;
    T = m2g; // 静止时 T = m₂g
    motionDirection = 'static';
  } else if (drivingForce > 0) {
    // m₂ 趋势下降：摩擦力阻碍 A 上行 → 方向为 -沿斜面向上
    a = (drivingForce - frictionForce) / (m1 + m2);
    T = m2 * (G - a);
    motionDirection = 'down';
  } else {
    // m₂ 趋势上升（m₁g·sinθ > m₂g）：A 趋势下滑，摩擦力阻碍下滑
    // 此时摩擦力方向反转（沿斜面向上），重新求解
    a = (drivingForce + frictionForce) / (m1 + m2); // 注意符号
    if (a > 0) {
      // 即使加上摩擦力也不能阻止（不太可能，因为 |driving|≤friction 已排除）
      a = 0;
      T = m2g;
      motionDirection = 'static';
    } else {
      // a < 0：m₂ 上升，A 下滑
      T = m2 * (G - a); // a 为负，T > m₂g
      motionDirection = 'up';
    }
  }

  // ─── 设置斜面物块旋转（底面贴合斜面） ───
  blockA.transform.rotation = -angleRad;

  // ─── 斜面方向向量 ───
  const slopeUpX = -cosA; // 沿斜面向上（世界坐标）
  const slopeUpY = sinA;
  const slopeDownX = cosA;
  const slopeDownY = -sinA;

  // ─── 张力方向（从物块指向滑轮） ───
  const pivotPos = pivot.transform.position;
  const blockACenter = {
    x: blockA.transform.position.x + Math.sin(angleRad) * ((blockA.properties.height as number ?? 0.5) / 2),
    y: blockA.transform.position.y + Math.cos(angleRad) * ((blockA.properties.height as number ?? 0.5) / 2),
  };
  const toDirLen = Math.hypot(pivotPos.x - blockACenter.x, pivotPos.y - blockACenter.y);
  const tensionDirA = toDirLen > 1e-6
    ? { x: (pivotPos.x - blockACenter.x) / toDirLen, y: (pivotPos.y - blockACenter.y) / toDirLen }
    : { x: slopeUpX, y: slopeUpY };

  // ─── 输出 ForceAnalysis ───
  const forceAnalyses = new Map<string, ForceAnalysis>();

  if (analysisMethod === 'overall') {
    // 整体法：隐藏绳张力，显示外力合力
    const forces: Force[] = [];

    // m₁ 的重力
    forces.push({ type: 'gravity', label: 'G₁', magnitude: m1g, direction: { x: 0, y: -1 } });
    // m₂ 的重力
    forces.push({ type: 'gravity', label: 'G₂', magnitude: m2g, direction: { x: 0, y: -1 } });
    // 法力（斜面对 A）
    forces.push({ type: 'normal', label: 'N', magnitude: NA, direction: { x: sinA, y: cosA } });

    // 外力
    if (FA > 0) {
      forces.push({
        type: 'custom',
        label: FB > 0 ? 'Fᴬ' : 'F',
        magnitude: FA,
        direction: { x: Math.cos(angleAForceRad), y: Math.sin(angleAForceRad) },
      });
    }
    if (FB > 0) {
      forces.push({
        type: 'custom',
        label: FA > 0 ? 'Fᴮ' : 'F',
        magnitude: FB,
        direction: { x: Math.cos(angleBForceRad), y: Math.sin(angleBForceRad) },
      });
    }

    // 摩擦力
    if (mu > 0 && motionDirection !== 'static') {
      const fDir = motionDirection === 'down'
        ? { x: slopeDownX, y: slopeDownY } // A 上行时摩擦力沿斜面向下
        : { x: slopeUpX, y: slopeUpY }; // A 下滑时摩擦力沿斜面向上
      forces.push({ type: 'friction', label: 'f', magnitude: frictionForce, direction: fDir });
    } else if (mu > 0 && motionDirection === 'static' && Math.abs(drivingForce) > 0.001) {
      // 静摩擦力
      const staticF = Math.abs(drivingForce);
      const fDir = drivingForce > 0
        ? { x: slopeDownX, y: slopeDownY }
        : { x: slopeUpX, y: slopeUpY };
      forces.push({ type: 'friction', label: 'f', magnitude: staticF, direction: fDir });
    }

    const rMag = Math.abs(a) * (m1 + m2);
    const resultant: Force = {
      type: 'resultant',
      label: 'F合',
      magnitude: rMag,
      direction: rMag > 1e-6 ? { x: 0, y: 0 } : { x: 0, y: 0 },
    };
    forceAnalyses.set(blockA.id, { entityId: blockA.id, forces, resultant });
  } else {
    // 隔离法
    // Block A（斜面上）
    const forcesA: Force[] = [];
    forcesA.push({ type: 'gravity', label: 'G₁', magnitude: m1g, direction: { x: 0, y: -1 } });
    forcesA.push({ type: 'normal', label: 'N', magnitude: NA, direction: { x: sinA, y: cosA } });

    if (FA > 0) {
      forcesA.push({
        type: 'custom',
        label: FB > 0 ? 'Fᴬ' : 'F',
        magnitude: FA,
        direction: { x: Math.cos(angleAForceRad), y: Math.sin(angleAForceRad) },
      });
    }

    // 绳张力：从物块指向滑轮方向
    if (T > 0.001) {
      forcesA.push({ type: 'tension', label: 'T', magnitude: T, direction: tensionDirA });
    }

    // 摩擦力
    if (mu > 0) {
      if (motionDirection === 'down') {
        // A 上行 → 摩擦力沿斜面向下
        forcesA.push({ type: 'friction', label: 'f₁', magnitude: frictionForce, direction: { x: slopeDownX, y: slopeDownY } });
      } else if (motionDirection === 'up') {
        // A 下滑 → 摩擦力沿斜面向上
        forcesA.push({ type: 'friction', label: 'f₁', magnitude: frictionForce, direction: { x: slopeUpX, y: slopeUpY } });
      } else if (Math.abs(drivingForce) > 0.001) {
        // 静摩擦力
        const staticF = Math.abs(m2g - m1g * sinA);
        // 方向由平衡决定：如果 m₂g > m₁g·sinθ，则 A 有上行趋势，摩擦力向下
        const fDir = (m2g > m1g * sinA)
          ? { x: slopeDownX, y: slopeDownY }
          : { x: slopeUpX, y: slopeUpY };
        // 沿斜面：T + FA_along - m₁g·sinθ - f = 0
        // f = T + FA_along - m₁g·sinθ = (m₂g - FBy) + FA_along - m₁g·sinθ
        forcesA.push({ type: 'friction', label: 'f₁', magnitude: staticF, direction: fDir });
      }
    }

    let rAx = 0;
    let rAy = 0;
    for (const f of forcesA) {
      if (f.type !== 'resultant') {
        rAx += f.direction.x * f.magnitude;
        rAy += f.direction.y * f.magnitude;
      }
    }
    const rAMag = Math.hypot(rAx, rAy);
    const resultantA: Force = {
      type: 'resultant',
      label: 'F合₁',
      magnitude: rAMag,
      direction: rAMag > 1e-6 ? { x: rAx / rAMag, y: rAy / rAMag } : { x: 0, y: 0 },
    };
    forceAnalyses.set(blockA.id, { entityId: blockA.id, forces: forcesA, resultant: resultantA });

    // Block B（悬挂）
    const forcesB: Force[] = [];
    forcesB.push({ type: 'gravity', label: 'G₂', magnitude: m2g, direction: { x: 0, y: -1 } });
    if (T > 0.001) {
      forcesB.push({ type: 'tension', label: 'T', magnitude: T, direction: { x: 0, y: 1 } });
    }
    if (FB > 0) {
      forcesB.push({
        type: 'custom',
        label: FA > 0 ? 'Fᴮ' : 'F',
        magnitude: FB,
        direction: { x: Math.cos(angleBForceRad), y: Math.sin(angleBForceRad) },
      });
    }

    let rBx = 0;
    let rBy = 0;
    for (const f of forcesB) {
      if (f.type !== 'resultant') {
        rBx += f.direction.x * f.magnitude;
        rBy += f.direction.y * f.magnitude;
      }
    }
    const rBMag = Math.hypot(rBx, rBy);
    const resultantB: Force = {
      type: 'resultant',
      label: 'F合₂',
      magnitude: rBMag,
      direction: rBMag > 1e-6 ? { x: rBx / rBMag, y: rBy / rBMag } : { x: 0, y: 0 },
    };
    forceAnalyses.set(blockB.id, { entityId: blockB.id, forces: forcesB, resultant: resultantB });
  }

  // ─── 运动状态 ───
  const slopeLength = (slope.properties.length as number) ?? 4;
  const slopePos = slope.transform.position;
  const initialD = 1.5; // 物块初始在斜面中部

  // A 的位移（沿斜面方向，正=上行）
  const aAlongSlope = motionDirection === 'down' ? a : -a;
  const dA = aAlongSlope > 0
    ? initialD + 0.5 * aAlongSlope * time * time
    : initialD + 0.5 * aAlongSlope * time * time;
  const posA = slopeBlockPos(slopePos, slopeLength, Math.max(0.3, Math.min(dA, slopeLength - 0.3)), cosA, sinA);

  const motionA: MotionState = {
    entityId: blockA.id,
    position: posA,
    velocity: {
      x: slopeUpX * aAlongSlope * time,
      y: slopeUpY * aAlongSlope * time,
    },
    acceleration: {
      x: slopeUpX * aAlongSlope,
      y: slopeUpY * aAlongSlope,
    },
  };

  // B 的位移（竖直方向，正=下降）
  const bDisp = motionDirection === 'down'
    ? 0.5 * a * time * time
    : motionDirection === 'up'
      ? 0.5 * a * time * time // a 为负
      : 0;
  const ropeLength = 1.5; // 默认绳长
  const posB = {
    x: pivotPos.x,
    y: pivotPos.y - ropeLength - bDisp,
  };

  const bVel = motionDirection === 'static' ? 0 : a * time;
  const motionB: MotionState = {
    entityId: blockB.id,
    position: posB,
    velocity: { x: 0, y: -bVel }, // 正 a → m₂ 下降 → vy 为负
    acceleration: { x: 0, y: motionDirection === 'static' ? 0 : -a },
  };

  return {
    time,
    forceAnalyses,
    motionStates: new Map([
      [blockA.id, motionA],
      [blockB.id, motionB],
    ]),
  };
};

export function registerRopeConnectedInclineSolver(): void {
  solverRegistry.register({
    id: 'mech-rope-connected-incline',
    label: '绳连斜面-悬挂',
    pattern: {
      entityTypes: ['block', 'slope', 'pivot', 'rope'],
      relationType: 'contact',
      qualifier: { connected: 'rope-incline-suspended' },
    },
    solveMode: 'analytical',
    solve: ropeConnectedInclineSolver,
  });
}
