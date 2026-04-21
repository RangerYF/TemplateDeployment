import type { FrustumParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LABELS_SUB = ['A₁', 'B₁', 'C₁', 'D₁', 'E₁', 'F₁', 'G₁', 'H₁'];

/**
 * 棱台 Builder
 * 正 n 棱台，下底面在 y=0，上底面在 y=height
 * 上下底面同心同轴，上底缩小
 */
export function buildFrustum(params: FrustumParams): PolyhedronResult {
  const { sides, bottomSideLength: a2, topSideLength: a1, height: h } = params;
  const n = Math.max(3, Math.min(8, Math.round(sides)));

  // 下底面外接圆半径
  const R2 = a2 / (2 * Math.sin(Math.PI / n));
  // 上底面外接圆半径
  const R1 = a1 / (2 * Math.sin(Math.PI / n));

  const vertices: { position: Vec3; label: string }[] = [];

  // 下底面 n 个顶点 (y=0)
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    vertices.push({
      position: [R2 * Math.cos(angle), 0, R2 * Math.sin(angle)],
      label: LABELS[i],
    });
  }

  // 上底面 n 个顶点 (y=h)
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    vertices.push({
      position: [R1 * Math.cos(angle), h, R1 * Math.sin(angle)],
      label: LABELS_SUB[i],
    });
  }

  // 面
  const faces: number[][] = [];

  // 下底面（索引 0~n-1，逆时针从外看）
  const bottomFace: number[] = [];
  for (let i = n - 1; i >= 0; i--) bottomFace.push(i);
  faces.push(bottomFace);

  // 上底面（索引 n~2n-1，顺时针从外看）
  const topFace: number[] = [];
  for (let i = 0; i < n; i++) topFace.push(n + i);
  faces.push(topFace);

  // 侧面梯形（每个由 4 个顶点组成）
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i]);
  }

  // 棱
  const edges: [number, number][] = [];
  // 下底边
  for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
  // 上底边
  for (let i = 0; i < n; i++) edges.push([n + i, n + (i + 1) % n]);
  // 侧棱
  for (let i = 0; i < n; i++) edges.push([i, n + i]);

  return { kind: 'polyhedron', vertices, faces, edges };
}
