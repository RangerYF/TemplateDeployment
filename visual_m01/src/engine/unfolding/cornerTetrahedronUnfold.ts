import type { CornerTetrahedronParams } from '@/types/geometry';
import type { Vec2, UnfoldFace, CuboidUnfoldResult } from './cuboidUnfold';

/**
 * 墙角四面体展开图
 *
 * 布局：斜面 ABC 居中，三个直角三角形面沿斜面的边外翻
 * 每个直角面沿对应边翻到斜面的外侧（远离斜面中心的方向）
 */
export function cornerTetrahedronUnfold(params: CornerTetrahedronParams): CuboidUnfoldResult {
  const { edgeA: a, edgeB: b, edgeC: c } = params;

  // 斜面边长
  const AB = Math.sqrt(a * a + b * b);
  const AC = Math.sqrt(a * a + c * c);
  const BC = Math.sqrt(b * b + c * c);

  // 将斜面 ABC 放在 2D 中
  // A 在原点，B 在 x 轴正方向
  const A: Vec2 = [0, 0];
  const B: Vec2 = [AB, 0];

  // C 通过三角形边长计算位置（在 AB 上方）
  const cosAngleA = (AB * AB + AC * AC - BC * BC) / (2 * AB * AC);
  const sinAngleA = Math.sqrt(1 - cosAngleA * cosAngleA);
  const C: Vec2 = [AC * cosAngleA, AC * sinAngleA];

  // 斜面中心（用于判断外翻方向）
  const center: Vec2 = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];

  // 面 OAB（直角在 O，OA=a, OB=b, 斜边=AB）沿边 AB 外翻
  const O_AB = reflectTriangleVertex(A, B, a, b, AB, center);

  // 面 OAC（直角在 O，OA=a, OC=c, 斜边=AC）沿边 AC 外翻
  const O_AC = reflectTriangleVertex(A, C, a, c, AC, center);

  // 面 OBC（直角在 O，OB=b, OC=c, 斜边=BC）沿边 BC 外翻
  const O_BC = reflectTriangleVertex(B, C, b, c, BC, center);

  // 计算包围盒
  const allPoints = [A, B, C, O_AB, O_AC, O_BC];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const padding = Math.max(a, b, c) * 0.15;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;
  const shift = (v: Vec2): Vec2 => [v[0] + offsetX, v[1] + offsetY];

  const slopeFace: UnfoldFace = {
    name: '斜面',
    vertices: [shift(A), shift(B), shift(C)],
    labels: ['A', 'B', 'C'],
  };

  const face1: UnfoldFace = {
    name: '底面 OAB',
    vertices: [shift(A), shift(B), shift(O_AB)],
    labels: ['A', 'B', 'O'],
  };
  const face2: UnfoldFace = {
    name: '侧面 OAC',
    vertices: [shift(A), shift(C), shift(O_AC)],
    labels: ['A', 'C', 'O'],
  };
  const face3: UnfoldFace = {
    name: '侧面 OBC',
    vertices: [shift(B), shift(C), shift(O_BC)],
    labels: ['B', 'C', 'O'],
  };

  const totalWidth = maxX - minX + padding * 2;
  const totalHeight = maxY - minY + padding * 2;

  return {
    kind: 'polygon',
    faces: [slopeFace, face1, face2, face3],
    width: totalWidth,
    height: totalHeight,
  };
}

/**
 * 沿边 P1-P2 展开一个直角三角形，直角顶点 O 翻到斜面中心的对面
 *
 * 直角三角形：直角在 O，OP1=leg1，OP2=leg2，斜边 P1P2=hypotenuse
 * O 在斜边上的投影：到 P1 的距离 t = leg1²/hypotenuse
 * O 到斜边的距离：d = leg1*leg2/hypotenuse
 */
function reflectTriangleVertex(
  P1: Vec2, P2: Vec2,
  leg1: number, leg2: number, hypotenuse: number,
  slopeFaceCenter: Vec2,
): Vec2 {
  const d = (leg1 * leg2) / hypotenuse;
  const t = (leg1 * leg1) / hypotenuse;

  // 沿 P1→P2 的单位方向
  const dx = P2[0] - P1[0];
  const dy = P2[1] - P1[1];
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;

  // 投影点 F = P1 + t * u
  const fx = P1[0] + t * ux;
  const fy = P1[1] + t * uy;

  // 两个可能的法向量方向
  const n1x = -uy, n1y = ux;   // 左法线
  const n2x = uy, n2y = -ux;   // 右法线

  // 选择远离斜面中心的方向
  const candidate1: Vec2 = [fx + d * n1x, fy + d * n1y];
  const candidate2: Vec2 = [fx + d * n2x, fy + d * n2y];

  const dist1 = (candidate1[0] - slopeFaceCenter[0]) ** 2 + (candidate1[1] - slopeFaceCenter[1]) ** 2;
  const dist2 = (candidate2[0] - slopeFaceCenter[0]) ** 2 + (candidate2[1] - slopeFaceCenter[1]) ** 2;

  // 选择离中心更远的那个（即外翻方向）
  return dist1 > dist2 ? candidate1 : candidate2;
}
