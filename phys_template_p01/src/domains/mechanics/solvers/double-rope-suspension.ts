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
 * 双绳悬挂求解器
 *
 * 物理模型：
 *   pivot-1 (左)     pivot-2 (右)
 *      \  θ₁      θ₂  /
 *    T₁ \          / T₂
 *        \        /
 *         ■ block
 *
 * 三力平衡：G + T₁ + T₂ = 0
 * 水平：T₁sinθ₁ = T₂sinθ₂
 * 竖直：T₁cosθ₁ + T₂cosθ₂ = mg
 *
 * 解（拉密定理）：
 *   T₁ = mg·sinθ₂ / sin(θ₁+θ₂)
 *   T₂ = mg·sinθ₁ / sin(θ₁+θ₂)
 */
const doubleRopeSuspensionSolver: SolverFunction = (scene, time) => {
  const block = Array.from(scene.entities.values()).find((e) => e.type === 'block');
  const pivots = Array.from(scene.entities.values()).filter((e) => e.type === 'pivot');
  if (!block || pivots.length < 2) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // 按 x 坐标排序：左 pivot = pivot1，右 pivot = pivot2
  pivots.sort((a, b) => a.transform.position.x - b.transform.position.x);
  const pivot1 = pivots[0]!;
  const pivot2 = pivots[1]!;

  const mass = (scene.paramValues.mass as number) ?? (block.properties.mass as number) ?? 1;
  const mg = mass * G;

  // 角度（度→弧度）：θ₁ = 左绳与竖直方向的夹角，θ₂ = 右绳与竖直方向的夹角
  const angle1Deg = (scene.paramValues.angle1 as number) ?? 30;
  const angle2Deg = (scene.paramValues.angle2 as number) ?? 60;
  const theta1 = (angle1Deg * Math.PI) / 180;
  const theta2 = (angle2Deg * Math.PI) / 180;

  const sinSum = Math.sin(theta1 + theta2);
  if (Math.abs(sinSum) < 1e-10) {
    return { time, forceAnalyses: new Map(), motionStates: new Map() };
  }

  // 张力大小
  const T1 = (mg * Math.sin(theta2)) / sinSum;
  const T2 = (mg * Math.sin(theta1)) / sinSum;

  // 计算物块位置（两绳交点）
  // 绳1从 pivot1 向右下方：方向 (sinθ₁, -cosθ₁)
  // 绳2从 pivot2 向左下方：方向 (-sinθ₂, -cosθ₂)
  // 求交点
  const P1 = pivot1.transform.position;
  const P2 = pivot2.transform.position;
  const blockPos = computeIntersection(P1, theta1, P2, theta2);

  // 张力方向：从物块几何中心指向 pivot（与 force-viewport getEdgeStart 一致）
  const blockH = (block.properties.height as number) ?? 0.5;
  const blockCenter = { x: blockPos.x, y: blockPos.y + blockH / 2 };
  const T1dir = normalize({ x: P1.x - blockCenter.x, y: P1.y - blockCenter.y });
  const T2dir = normalize({ x: P2.x - blockCenter.x, y: P2.y - blockCenter.y });

  // 力列表
  const gravity: Force = {
    type: 'gravity',
    label: 'G',
    magnitude: mg,
    direction: { x: 0, y: -1 },
  };

  const tension1: Force = {
    type: 'tension',
    label: 'T₁',
    magnitude: T1,
    direction: T1dir,
  };

  const tension2: Force = {
    type: 'tension',
    label: 'T₂',
    magnitude: T2,
    direction: T2dir,
  };

  const resultant: Force = {
    type: 'resultant',
    label: 'F合',
    magnitude: 0,
    direction: { x: 0, y: 0 },
  };

  // 正交分解（水平-竖直坐标系）
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
        force: tension1,
        component1: -T1 * Math.sin(theta1),
        component2: T1 * Math.cos(theta1),
        label1: 'T₁sinθ₁',
        label2: 'T₁cosθ₁',
      },
      {
        force: tension2,
        component1: T2 * Math.sin(theta2),
        component2: T2 * Math.cos(theta2),
        label1: 'T₂sinθ₂',
        label2: 'T₂cosθ₂',
      },
    ],
  };

  const forceAnalysis: ForceAnalysis = {
    entityId: block.id,
    forces: [gravity, tension1, tension2],
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

/**
 * 计算两绳交点
 * 绳1：从 P1 出发，方向 (sinθ₁, -cosθ₁)
 * 绳2：从 P2 出发，方向 (-sinθ₂, -cosθ₂)
 */
function computeIntersection(P1: Vec2, theta1: number, P2: Vec2, theta2: number): Vec2 {
  const d1x = Math.sin(theta1);
  const d1y = -Math.cos(theta1);
  const d2x = -Math.sin(theta2);
  const d2y = -Math.cos(theta2);

  // P1 + t1 * d1 = P2 + t2 * d2
  // t1 * d1x - t2 * d2x = P2.x - P1.x
  // t1 * d1y - t2 * d2y = P2.y - P1.y
  const det = d1x * (-d2y) - d1y * (-d2x);
  if (Math.abs(det) < 1e-10) {
    // 平行（不应发生），fallback 到 P1 正下方
    return { x: P1.x, y: P1.y - 1.5 };
  }

  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const t1 = (dx * (-d2y) - dy * (-d2x)) / det;

  return {
    x: P1.x + t1 * d1x,
    y: P1.y + t1 * d1y,
  };
}

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-10) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function registerDoubleRopeSuspensionSolver(): void {
  solverRegistry.register({
    id: 'mech-double-rope-suspension',
    label: '双绳悬挂',
    pattern: {
      entityTypes: ['block', 'pivot', 'rope'],
      relationType: 'connection',
      qualifier: { suspension: 'double-rope' },
    },
    solveMode: 'analytical',
    solve: doubleRopeSuspensionSolver,
  });
}
