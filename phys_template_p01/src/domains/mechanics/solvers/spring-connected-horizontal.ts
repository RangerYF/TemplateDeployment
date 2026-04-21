import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type { Force, ForceAnalysis, MotionState } from '@/core/types';

const G = 9.8;

/**
 * 水平弹簧连两物体求解器（FM-033）
 *
 *   Fᴬ → [A]~~spring~~[B] ← Fᴮ
 *   __________________________
 *           surface
 *
 * 每物块可独立施加外力（FA, θA）（FB, θB）
 * 整体法：a = (FAx + FBx - μ(NA+NB)) / (m₁+m₂)
 * 隔离 B：F弹 = m₂a + fB - FBx
 * 弹簧形变量：x = F弹/k
 */
const springConnectedHorizontalSolver: SolverFunction = (scene, time) => {
  const allEntities = Array.from(scene.entities.values());
  const blocks = allEntities.filter((e) => e.type === 'block');
  const surface = allEntities.find((e) => e.type === 'surface');
  if (blocks.length < 2 || !surface) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // 按 x 坐标排序：左 A（受外力），右 B
  blocks.sort((a, b) => a.transform.position.x - b.transform.position.x);
  const blockA = blocks[0]!;
  const blockB = blocks[1]!;

  // ─── 参数读取 ───
  const m1 = (scene.paramValues.mass1 as number) ?? (blockA.properties.mass as number) ?? 2;
  const m2 = (scene.paramValues.mass2 as number) ?? (blockB.properties.mass as number) ?? 3;
  const k = (scene.paramValues.stiffness as number) ?? 100;
  const mu = (scene.paramValues.friction as number) ?? 0;
  const analysisMethod = (scene.paramValues.analysisMethod as string) ?? 'isolated';

  // 每物块独立外力
  const FA = (scene.paramValues.forceA as number) ?? 0;
  const angleADeg = (scene.paramValues.forceAngleA as number) ?? 0;
  const angleARad = (angleADeg * Math.PI) / 180;
  const FAx = FA * Math.cos(angleARad);
  const FAy = FA * Math.sin(angleARad);

  const FB = (scene.paramValues.forceB as number) ?? 0;
  const angleBDeg = (scene.paramValues.forceAngleB as number) ?? 0;
  const angleBRad = (angleBDeg * Math.PI) / 180;
  const FBx = FB * Math.cos(angleBRad);
  const FBy = FB * Math.sin(angleBRad);

  const m1g = m1 * G;
  const m2g = m2 * G;

  // 法力（考虑竖直分量）
  let NA = m1g - FAy;
  if (NA < 0) NA = 0;
  let NB = m2g - FBy;
  if (NB < 0) NB = 0;

  const totalMass = m1 + m2;
  const totalFx = FAx + FBx;
  const totalN = NA + NB;

  // ─── 求解 ───
  let a: number;
  const maxStaticFriction = mu * totalN;
  if (Math.abs(totalFx) < 1e-6) {
    a = 0;
  } else if (mu > 0 && Math.abs(totalFx) <= maxStaticFriction) {
    a = 0;
  } else {
    a = (totalFx - Math.sign(totalFx) * mu * totalN) / totalMass;
  }

  // 弹簧弹力（隔离 B）
  // FBx + F弹 - fB = m₂·a → F弹 = m₂·a + fB - FBx
  let springForce = 0;
  let fA = 0;
  let fB = 0;

  if (Math.abs(a) > 1e-9) {
    fA = mu * NA;
    fB = mu * NB;
    const frictionDirB = a > 0 ? -1 : 1;
    springForce = m2 * a - FBx - frictionDirB * fB;
    // springForce > 0 means spring pushes B to the right (compressed)
  } else if (Math.abs(totalFx) > 1e-6 && mu > 0) {
    // 静止：弹簧无形变，静摩擦分配
    springForce = 0;
    fA = Math.abs(FAx);
    fB = Math.abs(FBx);
  }

  const springDeformation = k > 0 ? -springForce / k : 0;

  // ─── 输出 ForceAnalysis ───
  const forceAnalyses = new Map<string, ForceAnalysis>();

  const frictionDirSign = a > 0 ? -1 : a < 0 ? 1 : (totalFx > 0 ? -1 : 1);
  const absSpringForce = Math.abs(springForce);
  const springDirOnA = springForce > 0 ? -1 : 1; // compressed: pushes A left (away from B)
  const springDirOnB = -springDirOnA; // opposite on B

  if (analysisMethod === 'overall') {
    const forces: Force[] = [];
    forces.push({ type: 'gravity', label: 'G', magnitude: m1g + m2g, direction: { x: 0, y: -1 } });
    forces.push({ type: 'normal', label: 'N', magnitude: NA + NB, direction: { x: 0, y: 1 } });

    if (FA > 0) {
      forces.push({ type: 'custom', label: FB > 0 ? 'Fᴬ' : 'F', magnitude: FA, direction: { x: Math.cos(angleARad), y: Math.sin(angleARad) } });
    }
    if (FB > 0) {
      forces.push({ type: 'custom', label: FA > 0 ? 'Fᴮ' : 'F', magnitude: FB, direction: { x: Math.cos(angleBRad), y: Math.sin(angleBRad) } });
    }

    const totalFriction = fA + fB;
    if (totalFriction > 0.001) {
      forces.push({ type: 'friction', label: 'f', magnitude: totalFriction, direction: { x: frictionDirSign, y: 0 } });
    }

    let rX = 0, rY = 0;
    for (const f of forces) { rX += f.direction.x * f.magnitude; rY += f.direction.y * f.magnitude; }
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
    forcesA.push({ type: 'normal', label: 'N₁', magnitude: NA, direction: { x: 0, y: 1 } });
    if (FA > 0) {
      forcesA.push({ type: 'custom', label: FB > 0 ? 'Fᴬ' : 'F', magnitude: FA, direction: { x: Math.cos(angleARad), y: Math.sin(angleARad) } });
    }
    if (fA > 0.001) {
      forcesA.push({ type: 'friction', label: 'f₁', magnitude: fA, direction: { x: frictionDirSign, y: 0 } });
    }
    if (absSpringForce > 0.001) {
      // 弹簧弹力对 A
      forcesA.push({ type: 'spring', label: 'F弹', magnitude: absSpringForce, direction: { x: springDirOnA, y: 0 } });
    }

    let rAx = 0, rAy = 0;
    for (const f of forcesA) { rAx += f.direction.x * f.magnitude; rAy += f.direction.y * f.magnitude; }
    const rAMag = Math.hypot(rAx, rAy);
    const resultantA: Force = {
      type: 'resultant',
      label: 'F合₁',
      magnitude: rAMag,
      direction: rAMag > 1e-6 ? { x: rAx / rAMag, y: rAy / rAMag } : { x: 0, y: 0 },
    };
    forceAnalyses.set(blockA.id, { entityId: blockA.id, forces: forcesA, resultant: resultantA });

    // Block B
    const forcesB: Force[] = [];
    forcesB.push({ type: 'gravity', label: 'G₂', magnitude: m2g, direction: { x: 0, y: -1 } });
    forcesB.push({ type: 'normal', label: 'N₂', magnitude: NB, direction: { x: 0, y: 1 } });
    if (FB > 0) {
      forcesB.push({ type: 'custom', label: FA > 0 ? 'Fᴮ' : 'F', magnitude: FB, direction: { x: Math.cos(angleBRad), y: Math.sin(angleBRad) } });
    }
    if (absSpringForce > 0.001) {
      // 弹簧弹力对 B（与对 A 的方向相反）
      forcesB.push({ type: 'spring', label: 'F弹', magnitude: absSpringForce, direction: { x: springDirOnB, y: 0 } });
    }
    if (fB > 0.001) {
      forcesB.push({ type: 'friction', label: 'f₂', magnitude: fB, direction: { x: frictionDirSign, y: 0 } });
    }

    let rBx = 0, rBy = 0;
    for (const f of forcesB) { rBx += f.direction.x * f.magnitude; rBy += f.direction.y * f.magnitude; }
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
  const dx = 0.5 * a * time * time;
  const vx = a * time;

  // 弹簧形变按质量比分配到两侧（质心系：轻的动得多）
  // 压缩(deformation<0)：A 向右 (+)，B 向左 (-)
  // 拉伸(deformation>0)：A 向左 (-)，B 向右 (+)
  const ratioA = totalMass > 0 ? m2 / totalMass : 0.5;
  const ratioB = totalMass > 0 ? m1 / totalMass : 0.5;
  const offsetA = -springDeformation * ratioA; // 压缩时 A 向右(+)
  const offsetB = springDeformation * ratioB;  // 压缩时 B 向左(-)

  const motionA: MotionState = {
    entityId: blockA.id,
    position: { x: blockA.transform.position.x + dx + offsetA, y: blockA.transform.position.y },
    velocity: { x: vx, y: 0 },
    acceleration: { x: a, y: 0 },
  };

  const motionB: MotionState = {
    entityId: blockB.id,
    position: { x: blockB.transform.position.x + dx + offsetB, y: blockB.transform.position.y },
    velocity: { x: vx, y: 0 },
    acceleration: { x: a, y: 0 },
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

export function registerSpringConnectedHorizontalSolver(): void {
  solverRegistry.register({
    id: 'mech-spring-connected-horizontal',
    label: '水平弹簧连两物体',
    pattern: {
      entityTypes: ['block', 'surface', 'spring'],
      relationType: 'contact',
      qualifier: { spring: 'horizontal-connected' },
    },
    solveMode: 'analytical',
    solve: springConnectedHorizontalSolver,
  });
}
