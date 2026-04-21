import type { IsoscelesTetrahedronParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

/**
 * 对棱相等四面体（等腰四面体）Builder
 *
 * 三组对棱分别相等：AB=CD=p, AC=BD=q, AD=BC=r
 * 可内接于长方体，长方体棱长 a, b, c 满足：
 *   p² = b² + c², q² = a² + c², r² = a² + b²
 *
 * 四面体取长方体的 4 个交替顶点：
 *   A = (0, 0, 0)
 *   B = (a, b, 0)
 *   C = (a, 0, c)
 *   D = (0, b, c)
 */
export function buildIsoscelesTetrahedron(params: IsoscelesTetrahedronParams): PolyhedronResult {
  const { edgeP: p, edgeQ: q, edgeR: r } = params;

  // 求解长方体棱长
  // a² = (q² + r² - p²) / 2
  // b² = (p² + r² - q²) / 2
  // c² = (p² + q² - r²) / 2
  const a2 = (q * q + r * r - p * p) / 2;
  const b2 = (p * p + r * r - q * q) / 2;
  const c2 = (p * p + q * q - r * r) / 2;

  // 确保有效（需三角不等式）
  const a = Math.sqrt(Math.max(0, a2));
  const b = Math.sqrt(Math.max(0, b2));
  const c = Math.sqrt(Math.max(0, c2));

  // 四个顶点（内接于长方体）
  // 将几何体居中使中心在 (a/2, b/2, c/2)，然后平移到 y 方向底面在 y=0
  // 实际上，y 坐标范围 0~b，底面已在 y=0
  const vertices: { position: Vec3; label: string }[] = [
    { position: [0, 0, 0], label: 'A' },
    { position: [a, b, 0], label: 'B' },
    { position: [a, 0, c], label: 'C' },
    { position: [0, b, c], label: 'D' },
  ];

  // 4 个三角形面
  const faces: number[][] = [
    [0, 2, 1], // ACB（底面）
    [0, 1, 3], // ABD
    [1, 2, 3], // BCD
    [0, 3, 2], // ADC
  ];

  // 6 条棱
  const edges: [number, number][] = [
    [0, 1], // AB (对棱 CD = p)
    [0, 2], // AC (对棱 BD = q)
    [0, 3], // AD (对棱 BC = r)
    [1, 2], // BC = r
    [1, 3], // BD = q
    [2, 3], // CD = p
  ];

  return { kind: 'polyhedron', vertices, faces, edges };
}
