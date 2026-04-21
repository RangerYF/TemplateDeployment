import type { IsoscelesTetrahedronParams } from '@/types/geometry';
import type { Vec2, UnfoldFace, CuboidUnfoldResult } from './cuboidUnfold';

/**
 * 对棱相等四面体展开图
 *
 * 4 个全等三角形（每面三边为 p, q, r），花瓣展开
 * 中心面 ABC + 3 个面沿边外翻
 */
export function isoscelesTetrahedronUnfold(params: IsoscelesTetrahedronParams): CuboidUnfoldResult {
  const { edgeP: p, edgeQ: q, edgeR: r } = params;

  // 构造参考面 ABD（三边 = r, p, q）
  // 在等腰四面体中，面 ACB 的三边为 AC=q, CB=r...
  // 实际上每个面的三边都是 p, q, r
  // 放置第一个面：A 在原点，B 在 x 轴正方向
  // AB 对应哪条棱？AB = r (内接长方体中 AB = √(a²+b²) = r)

  // 面 ACB：边 AC=q, CB=r, AB=r... wait
  // 实际上：AB=CD=p... no, let me check.
  // From builder: A=(0,0,0), B=(a,b,0), C=(a,0,c), D=(0,b,c)
  // AB = √(a²+b²) = r, AC = √(a²+c²) = q, AD = √(b²+c²) = p
  // BC = √(b²+c²) = p, BD = √(a²+c²) = q, CD = √(a²+b²) = r
  // So: AB=CD=r, AC=BD=q, AD=BC=p
  //
  // Face ACB: sides AC=q, CB=p, BA=r → triangle with sides p, q, r ✓
  // Face ABD: sides AB=r, BD=q, DA=p → triangle with sides p, q, r ✓
  // All faces have sides p, q, r ✓

  // Place face ACB as the center face
  // A at origin, B along x-axis at distance r (since AB = r)
  const A: Vec2 = [0, 0];
  const B: Vec2 = [r, 0];

  // C: AC=q, BC=p (above AB line)
  const cosA = (r * r + q * q - p * p) / (2 * r * q);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const C: Vec2 = [q * cosA, q * sinA];

  // Center of face ACB
  const center: Vec2 = [(A[0] + C[0] + B[0]) / 3, (A[1] + C[1] + B[1]) / 3];

  // Face ABD: reflect D across edge AB (y=0 line)
  // ABD has sides AB=r, BD=q, DA=p
  // D is on the other side of AB from C
  // DA=p, DB=q → from A: AD=p, from B: BD=q
  const cosA2 = (r * r + p * p - q * q) / (2 * r * p);
  const sinA2 = Math.sqrt(Math.max(0, 1 - cosA2 * cosA2));
  const D_AB: Vec2 = [p * cosA2, -p * sinA2]; // reflected below AB

  // Face BCD: reflect D' across edge BC
  // BCD has sides BC=p, CD=r, DB=q
  const D_BC = reflectTriangleVertex(B, C, q, r, p, center);

  // Face ACD: reflect B' across edge AC
  // ACD has sides AC=q, CD=r, DA=p → triangle with third vertex D
  // Actually, face ADC has sides AD=p, DC=r, CA=q
  const D_AC = reflectTriangleVertex(A, C, p, r, q, center);

  // Compute bounding box
  const allPoints = [A, B, C, D_AB, D_BC, D_AC];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const pad = Math.max(p, q, r) * 0.15;
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
      name: '面ACD',
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

/**
 * 沿边 P1-P2 展开第三个顶点到斜面中心的对面
 * leg1 = P1 到第三顶点的距离
 * leg2 = P2 到第三顶点的距离
 * base = P1P2 的距离
 */
function reflectTriangleVertex(
  P1: Vec2, P2: Vec2,
  leg1: number, leg2: number, base: number,
  faceCenter: Vec2,
): Vec2 {
  // 用余弦定理求第三顶点在 P1P2 上的投影
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
