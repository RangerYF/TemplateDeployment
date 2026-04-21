import type { OrthogonalTetrahedronParams } from '@/types/geometry';
import type { Vec2, UnfoldFace, CuboidUnfoldResult } from './cuboidUnfold';

/**
 * 对棱垂直四面体展开图
 *
 * 棱长：AB=edgeAB, CD=edgeCD, AC=AD=BC=BD=e=√((AB²+CD²)/2)
 * 花瓣展开：中心面 + 3 个面沿边外翻
 */
export function orthogonalTetrahedronUnfold(params: OrthogonalTetrahedronParams): CuboidUnfoldResult {
  const { edgeAB: ab, edgeCD: cd } = params;

  const e = Math.sqrt((ab * ab + cd * cd) / 2);

  // 面 ACB: 三边 AC=e, CB=e, AB=ab → 等腰三角形
  // 面 ABD: 三边 AB=ab, BD=e, DA=e → 等腰三角形
  // 面 BCD: 三边 BC=e, CD=cd, DB=e → 等腰三角形
  // 面 ADC: 三边 AD=e, DC=cd, CA=e → 等腰三角形

  // 放置中心面 ACB：A 在原点，B 在 x 轴
  const A: Vec2 = [0, 0];
  const B: Vec2 = [ab, 0];

  // C: AC=e, BC=e → 等腰三角形顶点在 AB 中垂线上
  const hC = Math.sqrt(Math.max(0, e * e - (ab / 2) * (ab / 2)));
  const C: Vec2 = [ab / 2, hC];

  const center: Vec2 = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];

  // 面 ABD: 沿 AB 外翻，DA=e, DB=e → D 在 AB 下方中垂线上
  const D_AB: Vec2 = [ab / 2, -hC];

  // 面 BCD: 沿 BC 外翻, BD=e, CD=cd
  const D_BC = reflectTriangleVertex(B, C, e, cd, e, center);

  // 面 ADC: 沿 AC 外翻, AD=e, CD=cd
  const D_AC = reflectTriangleVertex(A, C, e, cd, e, center);

  // 包围盒
  const allPoints = [A, B, C, D_AB, D_BC, D_AC];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const pad = Math.max(ab, cd) * 0.15;
  const offsetX = -minX + pad;
  const offsetY = -minY + pad;
  const shift = (v: Vec2): Vec2 => [v[0] + offsetX, v[1] + offsetY];

  const faces: UnfoldFace[] = [
    {
      name: '面ACB',
      vertices: [shift(A), shift(C), shift(B)],
      labels: ['A', 'C', 'B'],
    },
    {
      name: '面ABD',
      vertices: [shift(A), shift(B), shift(D_AB)],
      labels: ['A', 'B', 'D'],
    },
    {
      name: '面BCD',
      vertices: [shift(B), shift(C), shift(D_BC)],
      labels: ['B', 'C', 'D'],
    },
    {
      name: '面ADC',
      vertices: [shift(A), shift(C), shift(D_AC)],
      labels: ['A', 'C', 'D'],
    },
  ];

  return {
    kind: 'polygon',
    faces,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

function reflectTriangleVertex(
  P1: Vec2, P2: Vec2,
  leg1: number, leg2: number, base: number,
  faceCenter: Vec2,
): Vec2 {
  const t = (leg1 * leg1 + base * base - leg2 * leg2) / (2 * base);
  const d = Math.sqrt(Math.max(0, leg1 * leg1 - t * t));

  const dx = P2[0] - P1[0];
  const dy = P2[1] - P1[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;

  const fx = P1[0] + t * ux;
  const fy = P1[1] + t * uy;

  const n1x = -uy, n1y = ux;
  const n2x = uy, n2y = -ux;

  const c1: Vec2 = [fx + d * n1x, fy + d * n1y];
  const c2: Vec2 = [fx + d * n2x, fy + d * n2y];

  const dist1 = (c1[0] - faceCenter[0]) ** 2 + (c1[1] - faceCenter[1]) ** 2;
  const dist2 = (c2[0] - faceCenter[0]) ** 2 + (c2[1] - faceCenter[1]) ** 2;

  return dist1 > dist2 ? c1 : c2;
}
