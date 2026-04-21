import type { CuboidParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

/**
 * 长方体 Builder
 * 底面在 y=0 平面，中心在 XZ 原点，Y 轴朝上
 * 默认标签：底面 A/B/C/D，顶面 A₁/B₁/C₁/D₁
 */
export function buildCuboid(params: CuboidParams): PolyhedronResult {
  const { length, width, height } = params;
  const hl = length / 2; // half length (X)
  const hw = width / 2;  // half width (Z)

  // 8 个顶点：底面 ABCD（y=0），顶面 A₁B₁C₁D₁（y=height）
  const vertices = [
    { position: [-hl, 0, hw] as Vec3, label: 'A' },      // 0
    { position: [hl, 0, hw] as Vec3, label: 'B' },       // 1
    { position: [hl, 0, -hw] as Vec3, label: 'C' },      // 2
    { position: [-hl, 0, -hw] as Vec3, label: 'D' },     // 3
    { position: [-hl, height, hw] as Vec3, label: 'A₁' },  // 4
    { position: [hl, height, hw] as Vec3, label: 'B₁' },   // 5
    { position: [hl, height, -hw] as Vec3, label: 'C₁' },  // 6
    { position: [-hl, height, -hw] as Vec3, label: 'D₁' }, // 7
  ];

  // 6 个面（顶点索引，从外侧看逆时针）
  const faces = [
    [0, 3, 2, 1], // 底面 ADCB
    [4, 5, 6, 7], // 顶面 A₁B₁C₁D₁
    [0, 1, 5, 4], // 前面 ABA₁B₁ → ABB₁A₁
    [2, 3, 7, 6], // 后面 CDC₁D₁ → CDD₁C₁
    [3, 0, 4, 7], // 左面 DAA₁D₁ → DAA₁D₁
    [1, 2, 6, 5], // 右面 BCC₁B₁ → BCC₁B₁
  ];

  // 12 条棱
  const edges: [number, number][] = [
    // 底面 4 条
    [0, 1], [1, 2], [2, 3], [3, 0],
    // 顶面 4 条
    [4, 5], [5, 6], [6, 7], [7, 4],
    // 侧棱 4 条
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  return { kind: 'polyhedron', vertices, faces, edges };
}
