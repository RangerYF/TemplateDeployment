import type { CornerTetrahedronParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

/**
 * 墙角四面体（直角四面体）Builder
 * 三条直角边两两垂直，直角顶点 O 在原点
 *
 * O = (0, 0, 0)  — 直角顶点
 * A = (a, 0, 0)  — 沿 X 轴
 * B = (0, 0, b)  — 沿 Z 轴
 * C = (0, c, 0)  — 沿 Y 轴（朝上）
 */
export function buildCornerTetrahedron(params: CornerTetrahedronParams): PolyhedronResult {
  const { edgeA: a, edgeB: b, edgeC: c } = params;

  const vertices: { position: Vec3; label: string }[] = [
    { position: [0, 0, 0], label: 'O' },     // 0: 直角顶点
    { position: [a, 0, 0], label: 'A' },      // 1: 沿 X
    { position: [0, 0, b], label: 'B' },      // 2: 沿 Z
    { position: [0, c, 0], label: 'C' },      // 3: 沿 Y
  ];

  // 面（从外侧看逆时针）
  const faces: number[][] = [
    [0, 2, 1],       // 底面 OBA（y=0 平面，从下方看逆时针）
    [0, 1, 3],       // 侧面 OAC
    [0, 3, 2],       // 侧面 OCB
    [1, 2, 3],       // 斜面 ABC
  ];

  // 棱：6 条
  const edges: [number, number][] = [
    [0, 1], // OA
    [0, 2], // OB
    [0, 3], // OC
    [1, 2], // AB
    [1, 3], // AC
    [2, 3], // BC
  ];

  return { kind: 'polyhedron', vertices, faces, edges };
}
