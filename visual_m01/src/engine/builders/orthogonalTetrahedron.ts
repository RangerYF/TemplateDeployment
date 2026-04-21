import type { OrthogonalTetrahedronParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

/**
 * 对棱垂直四面体 Builder
 *
 * 三组对棱分别垂直：AB⊥CD, AC⊥BD, AD⊥BC
 *
 * 构造方式：两条对棱 AB, CD 沿 x 轴和 z 轴放置（互相垂直），
 * 它们之间的距离 d = √(AB² + CD²) / 2 保证第二对和第三对也垂直。
 *
 * 顶点（使底部在 y=0）：
 *   A = (-AB/2, d, 0)
 *   B = (AB/2, d, 0)
 *   C = (0, 0, -CD/2)
 *   D = (0, 0, CD/2)
 *
 * 其余 4 条棱等长：AC = AD = BC = BD = √((AB² + CD²) / 2)
 */
export function buildOrthogonalTetrahedron(params: OrthogonalTetrahedronParams): PolyhedronResult {
  const { edgeAB, edgeCD } = params;

  const halfAB = edgeAB / 2;
  const halfCD = edgeCD / 2;
  const d = Math.sqrt(edgeAB * edgeAB + edgeCD * edgeCD) / 2;

  const vertices: { position: Vec3; label: string }[] = [
    { position: [-halfAB, d, 0], label: 'A' },
    { position: [halfAB, d, 0], label: 'B' },
    { position: [0, 0, -halfCD], label: 'C' },
    { position: [0, 0, halfCD], label: 'D' },
  ];

  // 4 个三角形面
  const faces: number[][] = [
    [0, 2, 1], // ACB
    [0, 1, 3], // ABD
    [1, 2, 3], // BCD
    [0, 3, 2], // ADC
  ];

  // 6 条棱
  const edges: [number, number][] = [
    [0, 1], // AB
    [0, 2], // AC
    [0, 3], // AD
    [1, 2], // BC
    [1, 3], // BD
    [2, 3], // CD
  ];

  return { kind: 'polyhedron', vertices, faces, edges };
}
