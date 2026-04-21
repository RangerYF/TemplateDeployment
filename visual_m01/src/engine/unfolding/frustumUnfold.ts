import type { FrustumParams } from '@/types/geometry';
import type { Vec2, UnfoldFace, CuboidUnfoldResult } from './cuboidUnfold';

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LABELS_SUB = ['A₁', 'B₁', 'C₁', 'D₁', 'E₁', 'F₁', 'G₁', 'H₁'];

/**
 * 棱台展开图
 *
 * 布局：
 * - n 个梯形侧面从左到右排成一排
 * - 下底正 n 边形向下翻出
 * - 上底正 n 边形向上翻出
 */
export function frustumUnfold(params: FrustumParams): CuboidUnfoldResult {
  const { sides, bottomSideLength: a2, topSideLength: a1, height: h } = params;
  const n = Math.max(3, Math.min(8, Math.round(sides)));

  // 边心距
  const apothem2 = a2 / (2 * Math.tan(Math.PI / n));
  const apothem1 = a1 / (2 * Math.tan(Math.PI / n));

  // 斜高
  const slantHeight = Math.sqrt(h * h + (apothem2 - apothem1) * (apothem2 - apothem1));

  // 外接圆半径（用于底面和顶面展开）
  const R2 = a2 / (2 * Math.sin(Math.PI / n));
  const R1 = a1 / (2 * Math.sin(Math.PI / n));

  const padding = a2 * 0.15;

  // 侧面梯形排列
  // 每个梯形：下底 a₂，上底 a₁，高 slantHeight
  // 梯形的 x 偏移：下底居中于 i*a₂ ~ (i+1)*a₂
  const xOffset = (a2 - a1) / 2; // 上底相对于下底的 x 偏移

  // 侧面 y 范围
  const sideY0 = R2 + apothem2 + padding; // 留出底面空间
  const sideY1 = sideY0 + slantHeight;

  const faces: UnfoldFace[] = [];

  // n 个梯形侧面
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = i * a2;
    faces.push({
      name: `侧面${i + 1}`,
      vertices: [
        [x0, sideY0],              // 下底左
        [x0 + a2, sideY0],         // 下底右
        [x0 + xOffset + a1, sideY1], // 上底右
        [x0 + xOffset, sideY1],    // 上底左
      ],
      labels: [LABELS[i], LABELS[j], LABELS_SUB[j], LABELS_SUB[i]],
    });
  }

  // 下底正 n 边形（向下翻出，连接第一个梯形的下底边）
  const bottomVerts = buildPolygonAlongEdge(
    [0, sideY0], [a2, sideY0], n, R2, 'below',
  );
  faces.push({
    name: '底面',
    vertices: bottomVerts,
    labels: Array.from({ length: n }, (_, i) => LABELS[i]),
  });

  // 上底正 n 边形（向上翻出，连接第一个梯形的上底边）
  const topVerts = buildPolygonAlongEdge(
    [xOffset, sideY1], [xOffset + a1, sideY1], n, R1, 'above',
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

  return {
    kind: 'polygon',
    faces: shiftedFaces,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

/**
 * 构建正 n 边形顶点，使第一条边与 edgeP1→edgeP2 精确对齐
 */
function buildPolygonAlongEdge(
  edgeP1: Vec2, edgeP2: Vec2,
  n: number, R: number,
  direction: 'above' | 'below',
): Vec2[] {
  const mx = (edgeP1[0] + edgeP2[0]) / 2;
  const my = (edgeP1[1] + edgeP2[1]) / 2;

  const edx = edgeP2[0] - edgeP1[0];
  const edy = edgeP2[1] - edgeP1[1];
  const edgeLen = Math.sqrt(edx * edx + edy * edy);
  const ux = edx / edgeLen;
  const uy = edy / edgeLen;

  const nx = direction === 'below' ? uy : -uy;
  const ny = direction === 'below' ? -ux : ux;

  const apothem = R * Math.cos(Math.PI / n);
  const cx = mx + apothem * nx;
  const cy = my + apothem * ny;

  const startAngle = Math.atan2(edgeP1[1] - cy, edgeP1[0] - cx);

  const vertices: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (2 * Math.PI * i) / n;
    vertices.push([cx + R * Math.cos(angle), cy + R * Math.sin(angle)]);
  }

  return vertices;
}
