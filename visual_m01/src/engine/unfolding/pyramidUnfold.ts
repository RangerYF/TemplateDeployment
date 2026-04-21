import type { PyramidParams } from '@/types/geometry';
import type { Vec2, UnfoldFace, CuboidUnfoldResult } from './cuboidUnfold';

/**
 * 正 n 棱锥展开图（复用 CuboidUnfoldResult polygon 格式）
 *
 * 布局：底面正 n 边形居中，每条底边向外翻出等腰三角形侧面（花瓣展开）
 *
 * 对于正 n 棱锥 (sides=n, sideLength=a, height=h)：
 * - 外接圆半径 R = a / (2 sin(π/n))
 * - 边心距 apothem = a / (2 tan(π/n)) = R cos(π/n)
 * - 斜高 l_slant = √(h² + apothem²)
 * - 侧面三角形：底边 = a，高 = l_slant
 *
 * 手算验证：正四棱锥 (n=4, a=2, h=2)
 * → R = 2/(2×sin(π/4)) = √2 ≈ 1.414
 * → apothem = 2/(2×tan(π/4)) = 1
 * → l_slant = √(4+1) = √5 ≈ 2.236
 */
export function pyramidUnfold(params: PyramidParams): CuboidUnfoldResult {
  const { sides: n, sideLength: a, height: h } = params;

  const R = a / (2 * Math.sin(Math.PI / n));
  const apothem = a / (2 * Math.tan(Math.PI / n));
  const lSlant = Math.sqrt(h * h + apothem * apothem);

  // 底面正 n 边形顶点（2D，中心在原点，之后统一偏移）
  // SVG 坐标系 Y 向下，起始角 -π/2 使第一个顶点在正上方
  const baseVertices: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    baseVertices.push([R * Math.cos(angle), R * Math.sin(angle)]);
  }

  // 计算每个侧面三角形的外部顶点 P_i
  // 对于第 i 条边 (vertex_i → vertex_{(i+1)%n})：
  //   中点 M = (V_i + V_{i+1}) / 2
  //   从中心到 M 的方向就是向外方向
  //   P_i = M + outward * l_slant
  const apexPositions: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const mx = (baseVertices[i][0] + baseVertices[j][0]) / 2;
    const my = (baseVertices[i][1] + baseVertices[j][1]) / 2;
    // 向外方向（从中心 (0,0) 指向中点）
    const dist = Math.sqrt(mx * mx + my * my) || 1;
    const ux = mx / dist;
    const uy = my / dist;
    apexPositions.push([mx + ux * lSlant, my + uy * lSlant]);
  }

  // 计算包围盒
  const allPoints = [...baseVertices, ...apexPositions];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // 添加 padding
  const padding = a * 0.15;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  const shift = (v: Vec2): Vec2 => [v[0] + offsetX, v[1] + offsetY];

  // 顶点标签：底面 A, B, C, D, ...
  const LABELS = 'ABCDEFGH';

  // 底面
  const bottomFace: UnfoldFace = {
    name: '底面',
    vertices: baseVertices.map(shift),
    labels: Array.from({ length: n }, (_, i) => LABELS[i]),
  };

  // 侧面（n 个三角形）
  const sideFaces: UnfoldFace[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sideFaces.push({
      name: `侧面${i + 1}`,
      vertices: [
        shift(baseVertices[i]),
        shift(baseVertices[j]),
        shift(apexPositions[i]),
      ],
      labels: [LABELS[i], LABELS[j], 'P'],
    });
  }

  const totalWidth = maxX - minX + padding * 2;
  const totalHeight = maxY - minY + padding * 2;

  return {
    kind: 'polygon',
    faces: [bottomFace, ...sideFaces],
    width: totalWidth,
    height: totalHeight,
  };
}
