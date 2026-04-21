import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

const G = 9.8;

/**
 * 绳连水平面两物体求解器（FM-031）
 *
 * [A]——rope——[B]
 * ______________________
 *       surface
 *
 * 每个物块可独立施加外力（FA, θA）（FB, θB）。
 *
 * 绳松弛判定（通用化）：
 * - 计算 A、B 各自不接绳时的自由加速度
 * - 若 aA_free >= aB_free（A 不落后于 B）→ 绳松弛，T = 0
 * - 否则绳拉紧，整体运动
 */
const ropeConnectedHorizontalSolver: SolverFunction = (scene, time) => {
  const allEntities = Array.from(scene.entities.values());
  const blocks = allEntities.filter((e) => e.type === 'block');
  const surface = allEntities.find((e) => e.type === 'surface');
  if (blocks.length < 2 || !surface) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // block-A 在左，block-B 在右
  blocks.sort((a, b) => a.transform.position.x - b.transform.position.x);
  const blockA = blocks[0]!;
  const blockB = blocks[1]!;

  // ─── 参数读取 ───
  const m1 = (scene.paramValues.mass1 as number) ?? (blockA.properties.mass as number) ?? 2;
  const m2 = (scene.paramValues.mass2 as number) ?? (blockB.properties.mass as number) ?? 3;
  const mu = (scene.paramValues.friction as number) ?? 0.2;
  const analysisMethod = (scene.paramValues.analysisMethod as string) ?? 'isolated';

  // A 的外力
  const FA = (scene.paramValues.forceA as number) ?? 0;
  const angleADeg = (scene.paramValues.forceAngleA as number) ?? 0;
  const angleARad = (angleADeg * Math.PI) / 180;
  const FAx = FA * Math.cos(angleARad); // 正=向右=朝B
  const FAy = FA * Math.sin(angleARad); // 正=向上

  // B 的外力
  const FB = (scene.paramValues.forceB as number) ?? 0;
  const angleBDeg = (scene.paramValues.forceAngleB as number) ?? 0;
  const angleBRad = (angleBDeg * Math.PI) / 180;
  const FBx = FB * Math.cos(angleBRad);
  const FBy = FB * Math.sin(angleBRad);

  const m1g = m1 * G;
  const m2g = m2 * G;

  // 法力
  let NA = m1g - FAy;
  if (NA < 0) NA = 0;
  let NB = m2g - FBy;
  if (NB < 0) NB = 0;

  // ─── 自由加速度（不接绳时各自的水平加速度，正=向右） ───
  const computeFreeAccel = (Fx: number, N: number, mass: number): number => {
    if (mass <= 0) return 0;
    const maxStatic = mu * N;
    if (Math.abs(Fx) <= maxStatic && mu > 0) {
      return 0; // 静摩擦平衡
    }
    const frictionForce = mu * N * (Fx >= 0 ? -1 : 1); // 摩擦力对抗运动方向
    return (Fx + frictionForce) / mass;
  };

  const aA_free = computeFreeAccel(FAx, NA, m1);
  const aB_free = computeFreeAccel(FBx, NB, m2);

  // ─── 绳松弛判定 ───
  // A 在左，B 在右。绳连接 A→B。
  // 绳只能拉不能推：当 A 的自由加速度 >= B 的自由加速度时，
  // A 追上或不落后于 B，绳松弛。
  const ropeSlack = aA_free >= aB_free;

  let aA: number;
  let aB: number;
  let T: number;
  let fA: number;
  let fB: number;

  if (ropeSlack) {
    // ── 绳松弛：A、B 各以自由加速度独立运动 ──
    T = 0;
    aA = aA_free;
    aB = aB_free;

    // 计算摩擦力大小
    if (Math.abs(aA) < 1e-9 && Math.abs(FAx) > 1e-9) {
      fA = Math.abs(FAx); // 静摩擦
    } else if (Math.abs(aA) < 1e-9) {
      fA = 0;
    } else {
      fA = mu * NA;
    }

    if (Math.abs(aB) < 1e-9 && Math.abs(FBx) > 1e-9) {
      fB = Math.abs(FBx); // 静摩擦
    } else if (Math.abs(aB) < 1e-9) {
      fB = 0;
    } else {
      fB = mu * NB;
    }
  } else {
    // ── 绳拉紧：A 落后于 B，绳提供约束 ──
    // 系统整体运动
    const totalMass = m1 + m2;
    const totalFx = FAx + FBx; // 总水平外力
    const totalN = NA + NB;
    const maxStaticTotal = mu * totalN;

    // 判断系统运动方向（用净力判断）
    if (Math.abs(totalFx) <= maxStaticTotal && mu > 0) {
      // 静摩擦足以平衡，系统静止
      aA = 0;
      aB = 0;
      T = 0;
      // 静摩擦分配：每个物块的静摩擦平衡自身水平外力
      fA = Math.abs(FAx);
      fB = Math.abs(FBx);
    } else {
      // 系统运动
      const movingRight = totalFx > 0;
      const frictionSign = movingRight ? -1 : 1; // 摩擦力对抗运动方向
      const a = (totalFx + frictionSign * mu * totalN) / totalMass;
      aA = a;
      aB = a;

      // 隔离 B 求 T：
      // FBx + T_on_B + friction_B = m2 * a
      // T_on_B 方向：绳从 B 指向 A（向左），即 T_on_B = -T（T > 0）
      // friction_B 对抗运动方向
      // FBx - T + frictionSign * mu * NB = m2 * a
      // T = FBx + frictionSign * mu * NB - m2 * a
      T = FBx + frictionSign * mu * NB - m2 * a;
      if (T < 0) T = 0; // 安全防护

      fA = mu * NA;
      fB = mu * NB;
    }
  }

  // ─── 运动方向标记 ───
  const moveDirA = aA >= 0 ? 1 : -1; // 1=向右，-1=向左
  const moveDirB = aB >= 0 ? 1 : -1;
  const frictionDirA = aA !== 0 ? -moveDirA : (FAx !== 0 ? -Math.sign(FAx) : 0);
  const frictionDirB = aB !== 0 ? -moveDirB : (FBx !== 0 ? -Math.sign(FBx) : 0);

  // ─── 输出 ForceAnalysis ───
  const forceAnalyses = new Map<string, ForceAnalysis>();

  if (analysisMethod === 'overall') {
    const forces: Force[] = [];

    if (ropeSlack) {
      // 绳松弛时整体法只分析 A
      forces.push({ type: 'gravity', label: 'G', magnitude: m1g, direction: { x: 0, y: -1 } });
      forces.push({ type: 'normal', label: 'N', magnitude: NA, direction: { x: 0, y: 1 } });
    } else {
      forces.push({ type: 'gravity', label: 'G', magnitude: m1g + m2g, direction: { x: 0, y: -1 } });
      forces.push({ type: 'normal', label: 'N', magnitude: NA + NB, direction: { x: 0, y: 1 } });
    }

    if (FA > 0) {
      forces.push({
        type: 'custom',
        label: FB > 0 ? 'Fᴬ' : 'F',
        magnitude: FA,
        direction: { x: Math.cos(angleARad), y: Math.sin(angleARad) },
      });
    }
    if (!ropeSlack && FB > 0) {
      forces.push({
        type: 'custom',
        label: FA > 0 ? 'Fᴮ' : 'F',
        magnitude: FB,
        direction: { x: Math.cos(angleBRad), y: Math.sin(angleBRad) },
      });
    }

    const totalFriction = fA + (ropeSlack ? 0 : fB);
    if (totalFriction > 0.001) {
      const fDir = frictionDirA !== 0 ? frictionDirA : frictionDirB;
      forces.push({ type: 'friction', label: 'f', magnitude: totalFriction, direction: { x: fDir, y: 0 } });
    }

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

    forceAnalyses.set(blockA.id, { entityId: blockA.id, forces, resultant });
  } else {
    // 隔离法
    // Block A
    const forcesA: Force[] = [];
    forcesA.push({ type: 'gravity', label: 'G₁', magnitude: m1g, direction: { x: 0, y: -1 } });
    if (NA > 0.001) {
      forcesA.push({ type: 'normal', label: 'N₁', magnitude: NA, direction: { x: 0, y: 1 } });
    }
    if (FA > 0) {
      forcesA.push({
        type: 'custom',
        label: FB > 0 ? 'Fᴬ' : 'F',
        magnitude: FA,
        direction: { x: Math.cos(angleARad), y: Math.sin(angleARad) },
      });
    }
    if (fA > 0.001 && frictionDirA !== 0) {
      forcesA.push({ type: 'friction', label: 'f₁', magnitude: fA, direction: { x: frictionDirA, y: 0 } });
    }
    if (T > 0.001) {
      // T 方向：从 A 指向 B（教学惯例"指向绳"）= 向右
      forcesA.push({ type: 'tension', label: 'T', magnitude: T, direction: { x: 1, y: 0 } });
    }

    const rAxNet = m1 * aA;
    const rAMag = Math.abs(rAxNet);
    const resultantA: Force = {
      type: 'resultant',
      label: 'F合₁',
      magnitude: rAMag,
      direction: rAMag > 1e-6 ? { x: Math.sign(rAxNet), y: 0 } : { x: 0, y: 0 },
    };
    forceAnalyses.set(blockA.id, { entityId: blockA.id, forces: forcesA, resultant: resultantA });

    // Block B
    const forcesB: Force[] = [];
    forcesB.push({ type: 'gravity', label: 'G₂', magnitude: m2g, direction: { x: 0, y: -1 } });
    if (NB > 0.001) {
      forcesB.push({ type: 'normal', label: 'N₂', magnitude: NB, direction: { x: 0, y: 1 } });
    }
    if (FB > 0) {
      forcesB.push({
        type: 'custom',
        label: FA > 0 ? 'Fᴮ' : 'F',
        magnitude: FB,
        direction: { x: Math.cos(angleBRad), y: Math.sin(angleBRad) },
      });
    }
    if (T > 0.001) {
      // T 方向：从 B 指向 A（教学惯例"指向绳"）= 向左
      forcesB.push({ type: 'tension', label: 'T', magnitude: T, direction: { x: -1, y: 0 } });
    }
    if (fB > 0.001 && frictionDirB !== 0) {
      forcesB.push({ type: 'friction', label: 'f₂', magnitude: fB, direction: { x: frictionDirB, y: 0 } });
    }

    const rBxNet = m2 * aB;
    const rBMag = Math.abs(rBxNet);
    const resultantB: Force = {
      type: 'resultant',
      label: 'F合₂',
      magnitude: rBMag,
      direction: rBMag > 1e-6 ? { x: Math.sign(rBxNet), y: 0 } : { x: 0, y: 0 },
    };
    forceAnalyses.set(blockB.id, { entityId: blockB.id, forces: forcesB, resultant: resultantB });
  }

  // ─── 运动状态 ───
  const dxA = 0.5 * aA * time * time;
  const vxA = aA * time;
  const dxB = 0.5 * aB * time * time;
  const vxB = aB * time;

  const motionA: MotionState = {
    entityId: blockA.id,
    position: { x: blockA.transform.position.x + dxA, y: blockA.transform.position.y },
    velocity: { x: vxA, y: 0 },
    acceleration: { x: aA, y: 0 },
  };

  const motionB: MotionState = {
    entityId: blockB.id,
    position: { x: blockB.transform.position.x + dxB, y: blockB.transform.position.y },
    velocity: { x: vxB, y: 0 },
    acceleration: { x: aB, y: 0 },
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

export function registerRopeConnectedHorizontalSolver(): void {
  solverRegistry.register({
    id: 'mech-rope-connected-horizontal',
    label: '绳连水平面两物体',
    pattern: {
      entityTypes: ['block', 'surface', 'rope'],
      relationType: 'contact',
      qualifier: { connected: 'rope-horizontal' },
    },
    solveMode: 'analytical',
    solve: ropeConnectedHorizontalSolver,
  });
}
