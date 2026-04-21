import type { Vec3 } from '../types';
import type { CoordinateSystem } from './types';
import type { BuilderResult } from '../types';
import type { GeometryType } from '@/types/geometry';

/**
 * 长方体邻接表：每个顶点索引 → 3 个邻接顶点索引
 * 顶点排列：0=A,1=B,2=C,3=D,4=A₁,5=B₁,6=C₁,7=D₁
 */
const CUBOID_ADJACENCY: Record<number, [number, number, number]> = {
  0: [1, 4, 3], // A → B(X方向), A₁(Y方向), D(Z方向)
  1: [2, 5, 0], // B → C, B₁, A
  2: [3, 6, 1], // C → D, C₁, B
  3: [0, 7, 2], // D → A, D₁, C
  4: [5, 0, 7], // A₁ → B₁, A, D₁
  5: [6, 1, 4], // B₁ → C₁, B, A₁
  6: [7, 2, 5], // C₁ → D₁, C, B₁
  7: [4, 3, 6], // D₁ → A₁, D, C₁
};

/**
 * 根据几何体类型和 BuilderResult 建立坐标系
 */
export function buildCoordinateSystem(
  type: GeometryType,
  result: BuilderResult,
  originIndex: number,
): CoordinateSystem | null {
  if (type === 'cuboid' || type === 'cube') {
    return buildCuboidCoordinateSystem(result, originIndex);
  }
  if (type === 'cone' || type === 'cylinder' || type === 'sphere') {
    return buildSurfaceCoordinateSystem(result, originIndex);
  }
  if (type === 'pyramid') {
    return buildPyramidCoordinateSystem(result, originIndex);
  }
  return null;
}

/** 长方体/正方体/棱锥坐标系：选中顶点的邻接棱作为轴方向 */
function buildCuboidCoordinateSystem(
  result: BuilderResult,
  originIndex: number,
): CoordinateSystem | null {
  if (result.kind !== 'polyhedron') return null;

  const vertices = result.vertices;
  if (originIndex < 0 || originIndex >= vertices.length) return null;

  const origin = vertices[originIndex].position;

  let axes: [Vec3, Vec3, Vec3];

  // 长方体/正方体有固定邻接表（仅当所有邻接索引在顶点范围内时使用）
  const adj = CUBOID_ADJACENCY[originIndex];
  if (adj && adj.every((i) => i < vertices.length)) {
    // 3 个邻接方向：始终从原点指向邻接顶点（保证邻接顶点坐标为正）
    const dirs = adj.map((ni) => normalize(sub(vertices[ni].position, origin))) as Vec3[];
    axes = [dirs[0], dirs[1], dirs[2]];
  } else {
    // 棱锥等：从 edges 中找邻接棱
    const adjEdges = result.edges
      .filter(([a, b]) => a === originIndex || b === originIndex)
      .map(([a, b]) => (a === originIndex ? b : a));

    if (adjEdges.length < 2) return null;

    const d0 = normalize(sub(vertices[adjEdges[0]].position, origin));
    const d1 = normalize(sub(vertices[adjEdges[1]].position, origin));
    const d2 =
      adjEdges.length >= 3
        ? normalize(sub(vertices[adjEdges[2]].position, origin))
        : normalize(crossProduct(d0, d1));

    axes = [d0, d1, d2];
  }

  // 计算各顶点在此坐标系下的坐标
  const vertexCoords: Vec3[] = vertices.map((v) => {
    const rel = sub(v.position, origin);
    return [dot(rel, axes[0]), dot(rel, axes[1]), dot(rel, axes[2])];
  });

  return { originIndex, origin, axes, vertexCoords };
}

/** 棱锥坐标系：以选中顶点为原点，用 Gram-Schmidt 正交化生成互相垂直的三轴 */
function buildPyramidCoordinateSystem(
  result: BuilderResult,
  originIndex: number,
): CoordinateSystem | null {
  if (result.kind !== 'polyhedron') return null;

  const vertices = result.vertices;
  if (originIndex < 0 || originIndex >= vertices.length) return null;

  const origin = vertices[originIndex].position;

  // 从 edges 找邻接顶点
  const adjIndices = result.edges
    .filter(([a, b]) => a === originIndex || b === originIndex)
    .map(([a, b]) => (a === originIndex ? b : a));

  if (adjIndices.length < 2) return null;

  // 取前两条边方向，用 Gram-Schmidt 正交化
  const d0 = normalize(sub(vertices[adjIndices[0]].position, origin));
  const d1raw = normalize(sub(vertices[adjIndices[1]].position, origin));

  // e0 = d0
  const e0 = d0;
  // e1 = normalize(d1 - (d1·e0)e0)  去除 d0 分量
  const proj = dot(d1raw, e0);
  const e1 = normalize([
    d1raw[0] - proj * e0[0],
    d1raw[1] - proj * e0[1],
    d1raw[2] - proj * e0[2],
  ]);
  // e2 = e0 × e1
  const e2 = crossProduct(e0, e1);

  const axes: [Vec3, Vec3, Vec3] = [e0, e1, e2];

  const vertexCoords: Vec3[] = vertices.map((v) => {
    const rel = sub(v.position, origin);
    return [dot(rel, axes[0]), dot(rel, axes[1]), dot(rel, axes[2])];
  });

  return { originIndex, origin, axes, vertexCoords };
}

/** 曲面体坐标系：原点在选中特征点，Y 沿对称轴，X/Z 取标准方向 */
function buildSurfaceCoordinateSystem(
  result: BuilderResult,
  originIndex: number,
): CoordinateSystem | null {
  if (result.kind !== 'surface') return null;

  const points = result.featurePoints;
  if (originIndex < 0 || originIndex >= points.length) return null;

  const origin = points[originIndex].position;
  // 标准方向：Y 朝上，X 朝右，Z 朝前
  const axes: [Vec3, Vec3, Vec3] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  const vertexCoords: Vec3[] = points.map((p) => {
    const rel = sub(p.position, origin);
    return [dot(rel, axes[0]), dot(rel, axes[1]), dot(rel, axes[2])];
  });

  return { originIndex, origin, axes, vertexCoords };
}

/**
 * 通用坐标系构建：接受用户指定的原点 + 轴方向，计算所有点的坐标
 */
export function buildCoordinateSystemFromAxes(
  origin: Vec3,
  axes: [Vec3, Vec3, Vec3],
  result: BuilderResult,
): CoordinateSystem {
  const points =
    result.kind === 'polyhedron' ? result.vertices : result.featurePoints;

  const vertexCoords: Vec3[] = points.map((p) => {
    const rel = sub(p.position, origin);
    return [dot(rel, axes[0]), dot(rel, axes[1]), dot(rel, axes[2])];
  });

  return { originIndex: -1, origin, axes, vertexCoords };
}

// ─── 向量工具 ───

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function crossProduct(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-10) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}
