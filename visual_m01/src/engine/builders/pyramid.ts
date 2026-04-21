import type { PyramidParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * 棱锥 Builder
 * 正 n 棱锥，底面在 y=0 平面，中心在 XZ 原点，Y 轴朝上
 * 顶部顶点标签 P，底面顶点标签 A~H（按边数截取）
 */
export function buildPyramid(params: PyramidParams): PolyhedronResult {
  const { sides, sideLength, paramMode, lateralEdgeLength } = params;
  const n = Math.max(3, Math.min(8, Math.round(sides)));

  // 外接圆半径 R = sideLength / (2 * sin(π/n))
  const R = sideLength / (2 * Math.sin(Math.PI / n));

  // 侧棱长模式：从 lateralEdgeLength 换算 height
  let height: number;
  if (paramMode === 'lateralEdge' && lateralEdgeLength !== undefined) {
    const l2 = lateralEdgeLength * lateralEdgeLength;
    const r2 = R * R;
    height = l2 > r2 ? Math.sqrt(l2 - r2) : 0.01;
  } else {
    height = params.height;
  }

  // 底面 n 个顶点（y=0）
  const vertices: { position: Vec3; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    vertices.push({
      position: [
        R * Math.cos(angle),
        0,
        R * Math.sin(angle),
      ],
      label: LABELS[i],
    });
  }

  // 顶部顶点（索引 = n）
  vertices.push({
    position: [0, height, 0],
    label: 'P',
  });

  // 面：1 个底面 + n 个三角形侧面
  const faces: number[][] = [];

  // 底面（索引 0~n-1，从外侧看逆时针 → 反转顺序）
  const bottomFace: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    bottomFace.push(i);
  }
  faces.push(bottomFace);

  // 侧面三角形（顶点 P 索引 = n）
  for (let i = 0; i < n; i++) {
    faces.push([i, (i + 1) % n, n]);
  }

  // 棱：n 条底边 + n 条侧棱
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    edges.push([i, (i + 1) % n]); // 底边
  }
  for (let i = 0; i < n; i++) {
    edges.push([i, n]); // 侧棱
  }

  return { kind: 'polyhedron', vertices, faces, edges };
}
