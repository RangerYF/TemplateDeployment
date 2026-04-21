import type { RegularTetrahedronParams } from '@/types/geometry';
import type { Vec2, UnfoldFace, CuboidUnfoldResult } from './cuboidUnfold';

/**
 * 正四面体展开图（花瓣式）
 *
 * 布局：底面正三角形居中，3 个等边三角形侧面沿底边外翻
 * 所有面都是相同的等边三角形，展开图是经典的"一个三角形外接三个三角形"
 *
 * 手算验证（a=2）：
 * → 底面外接圆半径 R = 2/√3 ≈ 1.155
 * → 等边三角形高 = √3/2 × 2 = √3 ≈ 1.732
 */
export function regularTetrahedronUnfold(params: RegularTetrahedronParams): CuboidUnfoldResult {
  const { sideLength: a } = params;

  // 底面外接圆半径
  const R = a / Math.sqrt(3);

  // 底面正三角形顶点（2D，中心在原点）
  const baseVertices: Vec2[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (2 * Math.PI * i) / 3 - Math.PI / 2;
    baseVertices.push([R * Math.cos(angle), R * Math.sin(angle)]);
  }

  // 每条底边的侧面三角形外翻顶点
  // 对于等边三角形，侧面高度就是 (√3/2)·a（等边三角形的高）
  const triHeight = (Math.sqrt(3) / 2) * a;
  const apexPositions: Vec2[] = [];

  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const mx = (baseVertices[i][0] + baseVertices[j][0]) / 2;
    const my = (baseVertices[i][1] + baseVertices[j][1]) / 2;
    // 向外方向（从中心指向中点）
    const dist = Math.sqrt(mx * mx + my * my) || 1;
    const ux = mx / dist;
    const uy = my / dist;
    apexPositions.push([mx + ux * triHeight, my + uy * triHeight]);
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

  const padding = a * 0.15;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;
  const shift = (v: Vec2): Vec2 => [v[0] + offsetX, v[1] + offsetY];

  const LABELS = ['A', 'B', 'C'];

  // 底面
  const bottomFace: UnfoldFace = {
    name: '底面',
    vertices: baseVertices.map(shift),
    labels: LABELS.slice(),
  };

  // 侧面（3 个等边三角形）
  const sideFaces: UnfoldFace[] = [];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    sideFaces.push({
      name: `侧面${i + 1}`,
      vertices: [
        shift(baseVertices[i]),
        shift(baseVertices[j]),
        shift(apexPositions[i]),
      ],
      labels: [LABELS[i], LABELS[j], 'D'],
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
