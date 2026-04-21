import type { PrismParams } from '@/types/geometry';
import type { Vec2, UnfoldFace, CuboidUnfoldResult } from './cuboidUnfold';

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LABELS_SUB = ['A₁', 'B₁', 'C₁', 'D₁', 'E₁', 'F₁', 'G₁', 'H₁'];

/**
 * 正棱柱展开图
 *
 * 布局（类似十字形）：
 * - n 个矩形侧面从左到右排成一排（每个宽 a，高 h）
 * - 底面正 n 边形向下翻出（连接在第一个侧面的底边 A-B）
 * - 顶面正 n 边形向上翻出（连接在第一个侧面的顶边 A₁-B₁）
 *
 * 关键：底面和顶面的 A-B / A₁-B₁ 边必须与侧面矩形的边精确对齐
 */
export function prismUnfold(params: PrismParams): CuboidUnfoldResult {
  const { sides, sideLength: a, height: h } = params;
  const n = Math.max(3, Math.min(8, Math.round(sides)));

  const R = a / (2 * Math.sin(Math.PI / n));
  const apothem = a / (2 * Math.tan(Math.PI / n)); // 边心距
  const padding = a * 0.15;

  // 侧面矩形的 y 范围：给底面留出空间
  const sideY0 = R + apothem + padding; // 侧面底边 y 坐标
  const sideY1 = sideY0 + h;           // 侧面顶边 y 坐标

  const faces: UnfoldFace[] = [];

  // ─── n 个矩形侧面 ───
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = i * a;
    faces.push({
      name: `侧面${i + 1}`,
      vertices: [
        [x0, sideY0],
        [x0 + a, sideY0],
        [x0 + a, sideY1],
        [x0, sideY1],
      ],
      labels: [LABELS[i], LABELS[j], LABELS_SUB[j], LABELS_SUB[i]],
    });
  }

  // ─── 底面正 n 边形（向下翻出） ───
  // 第一个侧面底边 = A(0, sideY0) 到 B(a, sideY0)
  // 底面的 A-B 边必须与此重合，其余顶点在 sideY0 下方
  const bottomVerts = buildPolygonAlongEdge(
    [0, sideY0], [a, sideY0], n, R, 'below',
  );
  faces.push({
    name: '底面',
    vertices: bottomVerts,
    labels: Array.from({ length: n }, (_, i) => LABELS[i]),
  });

  // ─── 顶面正 n 边形（向上翻出） ───
  // 第一个侧面顶边 = A₁(0, sideY1) 到 B₁(a, sideY1)
  // 顶面的 A₁-B₁ 边必须与此重合，其余顶点在 sideY1 上方
  const topVerts = buildPolygonAlongEdge(
    [0, sideY1], [a, sideY1], n, R, 'above',
  );
  faces.push({
    name: '顶面',
    vertices: topVerts,
    labels: Array.from({ length: n }, (_, i) => LABELS_SUB[i]),
  });

  // 计算包围盒
  const allPoints = faces.flatMap((f) => f.vertices);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of allPoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  const shiftedFaces: UnfoldFace[] = faces.map((f) => ({
    ...f,
    vertices: f.vertices.map(([x, y]) => [x + offsetX, y + offsetY] as Vec2),
  }));

  const totalWidth = maxX - minX + padding * 2;
  const totalHeight = maxY - minY + padding * 2;

  return {
    kind: 'polygon',
    faces: shiftedFaces,
    width: totalWidth,
    height: totalHeight,
  };
}

/**
 * 构建正 n 边形顶点，使第一条边（顶点0→顶点1）与 edgeP1→edgeP2 精确对齐
 * direction: 'below' = 多边形主体在边的下方, 'above' = 上方
 */
function buildPolygonAlongEdge(
  edgeP1: Vec2, edgeP2: Vec2,
  n: number, R: number,
  direction: 'above' | 'below',
): Vec2[] {
  // 边的中点
  const mx = (edgeP1[0] + edgeP2[0]) / 2;
  const my = (edgeP1[1] + edgeP2[1]) / 2;

  // 边方向单位向量
  const edx = edgeP2[0] - edgeP1[0];
  const edy = edgeP2[1] - edgeP1[1];
  const edgeLen = Math.sqrt(edx * edx + edy * edy);
  const ux = edx / edgeLen;
  const uy = edy / edgeLen;

  // 法向量（垂直于边，指向多边形内部方向）
  // below: 内部在下方 → 法向量 (uy, -ux) 对于水平边指向 -y
  // above: 内部在上方 → 法向量 (-uy, ux) 对于水平边指向 +y
  const nx = direction === 'below' ? uy : -uy;
  const ny = direction === 'below' ? -ux : ux;

  // 边心距 apothem = R * cos(π/n)
  const apothem = R * Math.cos(Math.PI / n);

  // 多边形中心 = 边中点 + apothem * 法向量
  const cx = mx + apothem * nx;
  const cy = my + apothem * ny;

  // 从中心到 edgeP1 的角度作为起始角
  const startAngle = Math.atan2(edgeP1[1] - cy, edgeP1[0] - cx);

  // 生成所有顶点
  const vertices: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    // 顶点按顺序排列（与边方向一致）
    const angle = startAngle + (2 * Math.PI * i) / n;
    vertices.push([
      cx + R * Math.cos(angle),
      cy + R * Math.sin(angle),
    ]);
  }

  return vertices;
}
