import { solverRegistry } from '@/core/registries/solver-registry';
import type { SolverFunction } from '@/core/registries/solver-registry';
import type {
  Force,
  ForceAnalysis,
  MotionState,
  OrthogonalDecomposition,
  Vec2,
} from '@/core/types';

const G = 9.8;

/**
 * 绳+杆混合悬挂求解器
 *
 *   pivot-1 (绳端)     pivot-2 (杆端)
 *      \  θ₁        θ₂  /
 *    T  \            / F_rod
 *   (绳) \          / (杆)
 *         \        /
 *          ■ block
 *
 * 绳只能拉（T > 0），杆可拉可压（F_rod 正=拉力，负=压力）
 * 计算同双绳，但需判断杆力方向
 */
const ropeRodSuspensionSolver: SolverFunction = (scene, time) => {
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  const pivots = Array.from(scene.entities.values()).filter((e) => e.type === 'pivot');
  if (!block || pivots.length < 2) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // 确定哪个 pivot 连绳、哪个连杆
  // 通过查找 rope 和 rod 实体的 pivotEntityId 来判断
  const rope = Array.from(scene.entities.values()).find((e) => e.type === 'rope');
  const rod = Array.from(scene.entities.values()).find((e) => e.type === 'rod');
  if (!rope || !rod) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  const ropePivotId = rope.properties.pivotEntityId as string;
  const rodPivotId = rod.properties.pivotEntityId as string;
  const ropePivot = pivots.find((p) => p.id === ropePivotId) ?? pivots[0]!;
  const rodPivot = pivots.find((p) => p.id === rodPivotId) ?? pivots[1]!;

  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 1;
  const mg = mass * G;

  const ropeAngleDeg = (scene.paramValues.ropeAngle as number) ?? 30;
  const rodAngleDeg = (scene.paramValues.rodAngle as number) ?? 60;
  const thetaRope = (ropeAngleDeg * Math.PI) / 180;
  const thetaRod = (rodAngleDeg * Math.PI) / 180;

  const sinSum = Math.sin(thetaRope + thetaRod);
  if (Math.abs(sinSum) < 1e-10) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // 绳张力（始终为拉力，> 0）
  const T = (mg * Math.sin(thetaRod)) / sinSum;
  // 杆力（可正可负）
  const Frod = (mg * Math.sin(thetaRope)) / sinSum;

  // 计算物块位置
  const P1 = ropePivot.transform.position;
  const P2 = rodPivot.transform.position;

  // 判断 ropePivot 在左还是右
  const ropeOnLeft = P1.x <= P2.x;
  const thetaLeft = ropeOnLeft ? thetaRope : thetaRod;
  const thetaRight = ropeOnLeft ? thetaRod : thetaRope;
  const Pleft = ropeOnLeft ? P1 : P2;
  const Pright = ropeOnLeft ? P2 : P1;

  const blockPos = computeIntersection(Pleft, thetaLeft, Pright, thetaRight);

  // 张力方向：从物块几何中心指向 pivot（与 force-viewport getEdgeStart 一致）
  const blockH = (block.properties.height as number) ?? 0.5;
  const blockCenter = { x: blockPos.x, y: blockPos.y + blockH / 2 };
  const ropeTdir = normalize({ x: P1.x - blockCenter.x, y: P1.y - blockCenter.y });
  const rodDir = normalize({ x: P2.x - blockCenter.x, y: P2.y - blockCenter.y });

  // 力列表
  const gravity: Force = {
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  };

  const tensionForce: Force = {
    type: 'tension',
    label: 'T',
    magnitude: T,
    direction: ropeTdir,
  };

  // 杆力：Frod > 0 为拉力（方向指向 pivot），Frod < 0 为压力（方向反转）
  // 在此模型中 Frod 始终为正（因为 sinθ > 0），方向为从 block 到 rodPivot
  // 但如果某些角度组合下可能为压力，需要判断
  const isCompression = Frod < 0;
  const rodForce: Force = {
    type: 'tension',
    label: isCompression ? 'F杆(压)' : 'F杆',
    magnitude: Math.abs(Frod),
    direction: isCompression
      ? { x: -rodDir.x, y: -rodDir.y }
      : rodDir,
  };

  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: 0,
    direction: { x: 0, y: 0 },
  };

  // 正交分解
  const decomposition: OrthogonalDecomposition = {
    axis1: { x: 1, y: 0 },
    axis2: { x: 0, y: 1 },
    axis1Label: '水平',
    axis2Label: '竖直',
    components: [
      {
        force: gravity,
        component1: 0,
        component2: -mg,
        label1: '0',
        label2: 'G',
      },
      {
        force: tensionForce,
        component1: T * ropeTdir.x,
        component2: T * ropeTdir.y,
        label1: 'Tsinθ',
        label2: 'Tcosθ',
      },
      {
        force: rodForce,
        component1: Math.abs(Frod) * rodForce.direction.x,
        component2: Math.abs(Frod) * rodForce.direction.y,
        label1: 'F杆sinφ',
        label2: 'F杆cosφ',
      },
    ],
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces: [gravity, tensionForce, rodForce],
    resultant,
    decomposition,
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

function computeIntersection(Pleft: Vec2, thetaLeft: number, Pright: Vec2, thetaRight: number): Vec2 {
  const d1x = Math.sin(thetaLeft);
  const d1y = -Math.cos(thetaLeft);
  const d2x = -Math.sin(thetaRight);
  const d2y = -Math.cos(thetaRight);

  const det = d1x * (-d2y) - d1y * (-d2x);
  if (Math.abs(det) < 1e-10) {
    return { x: Pleft.x, y: Pleft.y - 1.5 };
  }

  const dx = Pright.x - Pleft.x;
  const dy = Pright.y - Pleft.y;
  const t1 = (dx * (-d2y) - dy * (-d2x)) / det;

  return {
    x: Pleft.x + t1 * d1x,
    y: Pleft.y + t1 * d1y,
  };
}

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-10) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function registerRopeRodSuspensionSolver(): void {
  solverRegistry.register({
    id: 'mech-rope-rod-suspension',
    label: '绳+杆混合悬挂',
    pattern: {
      entityTypes: ['block', 'pivot', 'rope', 'rod'],
      relationType: 'connection',
      qualifier: { suspension: 'rope-rod' },
    },
    solveMode: 'analytical',
    solve: ropeRodSuspensionSolver,
  });
}
