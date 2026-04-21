import type { PrismParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LABELS_SUB = ['A₁', 'B₁', 'C₁', 'D₁', 'E₁', 'F₁', 'G₁', 'H₁'];

/**
 * 正棱柱 Builder
 * 底面正 n 边形在 y=0 平面，中心在 XZ 原点，顶面在 y=h
 * 底面标签 A/B/C/...，顶面标签 A₁/B₁/C₁/...
 */
export function buildPrism(params: PrismParams): PolyhedronResult {
  const { sides, sideLength, height } = params;
  const n = Math.max(3, Math.min(8, Math.round(sides)));

  // 底面外接圆半径 R = sideLength / (2 * sin(π/n))
  const R = sideLength / (2 * Math.sin(Math.PI / n));

  const vertices: { position: Vec3; label: string }[] = [];

  // 底面 n 个顶点（y=0）
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    vertices.push({
      position: [R * Math.cos(angle), 0, R * Math.sin(angle)],
      label: LABELS[i],
    });
  }

  // 顶面 n 个顶点（y=height）
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    vertices.push({
      position: [R * Math.cos(angle), height, R * Math.sin(angle)],
      label: LABELS_SUB[i],
    });
  }

  // 面：1 底面 + 1 顶面 + n 侧面
  const faces: number[][] = [];

  // 底面（从外侧看逆时针 → 反转顺序）
  const bottomFace: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    bottomFace.push(i);
  }
  faces.push(bottomFace);

  // 顶面（正序）
  const topFace: number[] = [];
  for (let i = 0; i < n; i++) {
    topFace.push(n + i);
  }
  faces.push(topFace);

  // n 个矩形侧面
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i]);
  }

  // 棱：n 底边 + n 顶边 + n 侧棱 = 3n
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    edges.push([i, (i + 1) % n]);           // 底边
  }
  for (let i = 0; i < n; i++) {
    edges.push([n + i, n + ((i + 1) % n)]); // 顶边
  }
  for (let i = 0; i < n; i++) {
    edges.push([i, n + i]);                  // 侧棱
  }

  return { kind: 'polyhedron', vertices, faces, edges };
}
