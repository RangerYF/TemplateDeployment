/**
 * 标签/面/线引用解析器
 *
 * 将 DSL 中的语义化引用（标签名、面名）解析为 EntityBuilder 内部的 ID/索引
 */

import type { GeometryEnv } from './geometry-env';
import type { FaceRef, LineRef } from './types';
import { labelNotFound, faceRefNotFound, lineRefNotFound } from './errors';
import type { Vec3 } from '../../src/engine/types';

// ═══════════════════════════════════════════════════════════
// 编译上下文（编译器和 resolver 共享的状态）
// ═══════════════════════════════════════════════════════════

export interface CompileContext {
  /** 指令 ID（用于错误信息） */
  instructionId: string;
  /** 几何体环境 */
  env: GeometryEnv;
  /** 标签 → 顶点索引（内置顶点） */
  labelToVertexIndex: Map<string, number>;
  /** 所有已知标签（内置 + 构造创建的） */
  knownLabels: Set<string>;
  /** 构造步骤中创建的面标签 → faceId */
  constructedFaces: Map<string, string>;
  /** 构造步骤中创建的线段标签 → segmentId（from-to 格式） */
  constructedSegments: Map<string, string>;

  // EntityBuilder 引用（编译器传入）
  builder: {
    findPointByLabel: (label: string) => string | null;
    findBuiltInSegment: (idx1: number, idx2: number) => string | null;
    findFaceByIndex: (faceIndex: number) => string | null;
    getVertexPositionByLabel: (label: string) => Vec3 | null;
    getPointPositionById: (pointId: string) => Vec3;
    getFacePositionsByEntityId: (faceId: string) => Vec3[];
    getSegmentEndpoints: (segmentId: string) => [Vec3, Vec3];
    addCustomFace: (pointLabels: string[], source?: { type: 'crossSection'; definingPointIds: string[] }) => string;
  };

  /** 编译日志（debug 模式下收集） */
  logs: string[];
  /** 是否开启 debug 日志 */
  debug: boolean;
}

export function log(ctx: CompileContext, msg: string): void {
  if (ctx.debug) {
    ctx.logs.push(msg);
  }
}

// ═══════════════════════════════════════════════════════════
// 标签解析
// ═══════════════════════════════════════════════════════════

/**
 * 确认标签存在，返回 pointId
 * @throws DSLCompileError 标签不存在时
 */
export function resolveLabel(ctx: CompileContext, label: string, phase: string): string {
  const pointId = ctx.builder.findPointByLabel(label);
  if (!pointId) {
    throw labelNotFound(ctx.instructionId, phase, label, Array.from(ctx.knownLabels));
  }
  return pointId;
}

/**
 * 检查标签是否已知（不要求有 pointId，只检查 knownLabels）
 */
export function assertLabelExists(ctx: CompileContext, label: string, phase: string): void {
  if (!ctx.knownLabels.has(label)) {
    throw labelNotFound(ctx.instructionId, phase, label, Array.from(ctx.knownLabels));
  }
}

/**
 * 获取标签对应的顶点索引（仅内置顶点有效）
 */
export function labelToVertexIndex(ctx: CompileContext, label: string): number | undefined {
  return ctx.labelToVertexIndex.get(label);
}

// ═══════════════════════════════════════════════════════════
// 面引用解析
// ═══════════════════════════════════════════════════════════

/**
 * 解析面引用 → faceId
 *
 * 解析优先级：
 * 1. string → env.faceNameToIndex（内置面名如 "底面"）
 * 2. string → constructedFaces（构造步骤中的面标签如 "diagFace"）
 * 3. string[] → 按顶点列表查找/创建面
 */
export function resolveFaceRef(ctx: CompileContext, ref: FaceRef, phase: string): string {
  if (typeof ref === 'string') {
    // 1. 尝试内置面名
    const faceIndex = ctx.env.faceNameToIndex[ref];
    if (faceIndex !== undefined) {
      const faceId = ctx.builder.findFaceByIndex(faceIndex);
      if (faceId) {
        log(ctx, `  面引用 "${ref}" → 内置面 faceIndex=${faceIndex} → id=${faceId}`);
        return faceId;
      }
    }

    // 2. 尝试构造步骤中的面标签
    const constructedFaceId = ctx.constructedFaces.get(ref);
    if (constructedFaceId) {
      log(ctx, `  面引用 "${ref}" → 构造面 id=${constructedFaceId}`);
      return constructedFaceId;
    }

    throw faceRefNotFound(ctx.instructionId, phase, ref);
  }

  // 3. 顶点标签列表 → 查找/创建面
  if (Array.isArray(ref)) {
    // 先验证所有点标签存在
    for (const label of ref) {
      assertLabelExists(ctx, label, phase);
    }
    // 创建自定义面
    const faceId = ctx.builder.addCustomFace(ref);
    log(ctx, `  面引用 [${ref.join(',')}] → 自动创建面 id=${faceId}`);
    return faceId;
  }

  throw faceRefNotFound(ctx.instructionId, phase, ref);
}

/**
 * 获取面的顶点坐标（用于度量计算）
 */
export function getFacePositions(ctx: CompileContext, faceId: string): Vec3[] {
  return ctx.builder.getFacePositionsByEntityId(faceId);
}

// ═══════════════════════════════════════════════════════════
// 线引用解析
// ═══════════════════════════════════════════════════════════

/**
 * 解析线引用 → segmentId
 *
 * 解析优先级：
 * 1. 两端点都是内置顶点 → findBuiltInSegment
 * 2. 在已创建的自定义线段中查找
 */
export function resolveLineRef(ctx: CompileContext, line: LineRef, phase: string): string {
  const [startLabel, endLabel] = line;
  assertLabelExists(ctx, startLabel, phase);
  assertLabelExists(ctx, endLabel, phase);

  // 1. 尝试内置棱
  const startIdx = ctx.labelToVertexIndex.get(startLabel);
  const endIdx = ctx.labelToVertexIndex.get(endLabel);
  if (startIdx !== undefined && endIdx !== undefined) {
    const segId = ctx.builder.findBuiltInSegment(startIdx, endIdx);
    if (segId) {
      log(ctx, `  线引用 [${startLabel},${endLabel}] → 内置棱 (${startIdx}-${endIdx}) → id=${segId}`);
      return segId;
    }
  }

  // 2. 查找自定义线段（正向和反向）
  const fwdKey = `${startLabel}-${endLabel}`;
  const revKey = `${endLabel}-${startLabel}`;
  const customSegId = ctx.constructedSegments.get(fwdKey) ?? ctx.constructedSegments.get(revKey);
  if (customSegId) {
    log(ctx, `  线引用 [${startLabel},${endLabel}] → 自定义线段 id=${customSegId}`);
    return customSegId;
  }

  throw lineRefNotFound(ctx.instructionId, phase, line);
}

// ═══════════════════════════════════════════════════════════
// 二面角交线自动计算
// ═══════════════════════════════════════════════════════════

/**
 * 计算两面的交线（用于二面角度量）
 *
 * 策略：
 * 1. 优先找两面的公共顶点对（最稳定）
 * 2. 若无公共顶点，用法向量叉积 + 平面交线方程
 *
 * @returns [交线起点, 交线终点]
 */
export function findIntersectionLine(face1Points: Vec3[], face2Points: Vec3[]): [Vec3, Vec3] {
  // 1. 找公共顶点
  const commonVertices: Vec3[] = [];
  const EPS = 1e-9;

  for (const p1 of face1Points) {
    for (const p2 of face2Points) {
      if (Math.abs(p1[0] - p2[0]) < EPS &&
          Math.abs(p1[1] - p2[1]) < EPS &&
          Math.abs(p1[2] - p2[2]) < EPS) {
        // 避免重复
        if (!commonVertices.some(v =>
          Math.abs(v[0] - p1[0]) < EPS &&
          Math.abs(v[1] - p1[1]) < EPS &&
          Math.abs(v[2] - p1[2]) < EPS
        )) {
          commonVertices.push(p1);
        }
      }
    }
  }

  if (commonVertices.length >= 2) {
    return [commonVertices[0], commonVertices[1]];
  }

  // 2. 若只有一个公共顶点，用法向量叉积找交线方向
  if (commonVertices.length === 1) {
    const n1 = faceNormal(face1Points);
    const n2 = faceNormal(face2Points);
    const dir = cross(n1, n2);
    const len = vecLen(dir);
    if (len < EPS) {
      // 两面平行或共面，交线不存在
      throw new Error('两面平行或共面，无法计算交线');
    }
    const unitDir: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len];
    return [
      commonVertices[0],
      [commonVertices[0][0] + unitDir[0], commonVertices[0][1] + unitDir[1], commonVertices[0][2] + unitDir[2]],
    ];
  }

  // 3. 无公共顶点：求两平面交线
  const n1 = faceNormal(face1Points);
  const n2 = faceNormal(face2Points);
  const dir = cross(n1, n2);
  const len = vecLen(dir);
  if (len < EPS) {
    throw new Error('两面平行或共面，无法计算交线');
  }

  // 找交线上的一个点：解两个平面方程 + x=0（或 y=0 或 z=0）
  const d1 = dot(n1, face1Points[0]);
  const d2 = dot(n2, face2Points[0]);
  const point = solvePlaneIntersectionPoint(n1, d1, n2, d2, dir);

  const unitDir: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len];
  return [
    point,
    [point[0] + unitDir[0], point[1] + unitDir[1], point[2] + unitDir[2]],
  ];
}

// ═══════════════════════════════════════════════════════════
// 向量工具
// ═══════════════════════════════════════════════════════════

function faceNormal(points: Vec3[]): Vec3 {
  const v1: Vec3 = [points[1][0] - points[0][0], points[1][1] - points[0][1], points[1][2] - points[0][2]];
  const v2: Vec3 = [points[2][0] - points[0][0], points[2][1] - points[0][1], points[2][2] - points[0][2]];
  return cross(v1, v2);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vecLen(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/**
 * 求两平面交线上的一个点
 * 平面1: n1 · p = d1
 * 平面2: n2 · p = d2
 * 交线方向: dir = n1 × n2
 *
 * 选择 dir 分量最大的轴设为 0，解另外两个分量
 */
function solvePlaneIntersectionPoint(n1: Vec3, d1: number, n2: Vec3, d2: number, dir: Vec3): Vec3 {
  const absDir = [Math.abs(dir[0]), Math.abs(dir[1]), Math.abs(dir[2])];
  const maxAxis = absDir.indexOf(Math.max(...absDir));

  // 设 maxAxis 分量 = 0，解另外两个
  if (maxAxis === 0) {
    // x = 0, 解 y, z
    const det = n1[1] * n2[2] - n1[2] * n2[1];
    const y = (d1 * n2[2] - d2 * n1[2]) / det;
    const z = (n1[1] * d2 - n2[1] * d1) / det;
    return [0, y, z];
  } else if (maxAxis === 1) {
    // y = 0, 解 x, z
    const det = n1[0] * n2[2] - n1[2] * n2[0];
    const x = (d1 * n2[2] - d2 * n1[2]) / det;
    const z = (n1[0] * d2 - n2[0] * d1) / det;
    return [x, 0, z];
  } else {
    // z = 0, 解 x, y
    const det = n1[0] * n2[1] - n1[1] * n2[0];
    const x = (d1 * n2[1] - d2 * n1[1]) / det;
    const y = (n1[0] * d2 - n2[0] * d1) / det;
    return [x, y, 0];
  }
}
