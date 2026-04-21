import type { RegularTetrahedronParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

/**
 * 正四面体 Builder
 * 底面正三角形在 y=0 平面，重心在 XZ 原点，Y 轴朝上
 * 顶点标签：底面 A/B/C，顶点 D
 */
export function buildRegularTetrahedron(params: RegularTetrahedronParams): PolyhedronResult {
  const { sideLength: a } = params;

  // 高 h = (√6/3)·a
  const h = (Math.sqrt(6) / 3) * a;

  // 底面外接圆半径 R = a / √3
  const R = a / Math.sqrt(3);

  // 底面 3 个顶点（y=0），起始角 -π/2 使第一个顶点在正下方（Z轴负方向）
  const vertices: { position: Vec3; label: string }[] = [];
  const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  const labels = ['A', 'B', 'C'];

  for (let i = 0; i < 3; i++) {
    vertices.push({
      position: [
        R * Math.cos(angles[i]),
        0,
        R * Math.sin(angles[i]),
      ],
      label: labels[i],
    });
  }

  // 顶点 D（索引 3）
  vertices.push({
    position: [0, h, 0],
    label: 'D',
  });

  // 面：底面 CBA（从外侧看逆时针） + 3 个侧面
  const faces: number[][] = [
    [2, 1, 0],       // 底面 CBA
    [0, 1, 3],       // 侧面 ABD
    [1, 2, 3],       // 侧面 BCD
    [2, 0, 3],       // 侧面 CAD
  ];

  // 棱：3 条底边 + 3 条侧棱
  const edges: [number, number][] = [
    [0, 1], // AB
    [1, 2], // BC
    [2, 0], // CA
    [0, 3], // AD
    [1, 3], // BD
    [2, 3], // CD
  ];

  return { kind: 'polyhedron', vertices, faces, edges };
}
