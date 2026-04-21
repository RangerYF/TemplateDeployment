/**
 * 三视图正交投影算法
 *
 * 坐标系约定（与 builders 一致）：
 * - X 轴 = 长方体 length 方向
 * - Y 轴 = 高度方向（朝上）
 * - Z 轴 = 长方体 width 方向
 *
 * 三视图投影：
 * - 正视图（front）：沿 -Z 看，投影到 XY 平面 → 2D(x, y)
 * - 侧视图（side）：沿 +X 看，投影到 ZY 平面 → 2D(z, y)  注：z翻转使左=前
 * - 俯视图（top）：沿 -Y 看，投影到 XZ 平面 → 2D(x, z)  注：z翻转使上=前
 */

// ─── 类型定义 ───

export interface ViewSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  visible: boolean;
}

export interface ViewCircle {
  cx: number; cy: number;
  r: number;
  visible: boolean;
}

export interface ViewPoint {
  x: number; y: number;
}

export interface DimensionLabel {
  /** 标注线两端 */
  x1: number; y1: number;
  x2: number; y2: number;
  /** 标注文字 */
  text: string;
  /** 标注偏移方向 */
  side: 'bottom' | 'left' | 'right' | 'top';
}

export interface SingleView {
  /** 视图宽高（2D 坐标范围） */
  width: number;
  height: number;
  segments: ViewSegment[];
  circles: ViewCircle[];
  points: ViewPoint[];
  dimensions: DimensionLabel[];
  label: string;
}

export interface ThreeViewResult {
  front: SingleView;
  side: SingleView;
  top: SingleView;
}

// ─── 长方体三视图 ───

export function cuboidThreeView(params: { length: number; width: number; height: number }): ThreeViewResult {
  const { length: l, width: w, height: h } = params;

  // 正视图：沿 -Z 看 → 矩形 l × h
  const front: SingleView = {
    width: l, height: h, label: '正视图',
    segments: rectSegments(l, h, true),
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: l, y2: 0, text: String(l), side: 'bottom' },
      { x1: 0, y1: 0, x2: 0, y2: h, text: String(h), side: 'left' },
    ],
  };

  // 侧视图：沿 +X 看 → 矩形 w × h
  const side: SingleView = {
    width: w, height: h, label: '侧视图',
    segments: rectSegments(w, h, true),
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: w, y2: 0, text: String(w), side: 'bottom' },
      { x1: w, y1: 0, x2: w, y2: h, text: String(h), side: 'right' },
    ],
  };

  // 俯视图：沿 -Y 看 → 矩形 l × w
  const top: SingleView = {
    width: l, height: w, label: '俯视图',
    segments: rectSegments(l, w, true),
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: l, y2: 0, text: String(l), side: 'bottom' },
      { x1: 0, y1: 0, x2: 0, y2: w, text: String(w), side: 'left' },
    ],
  };

  return { front, side, top };
}

// ─── 圆锥三视图 ───

export function coneThreeView(params: { radius: number; height: number }): ThreeViewResult {
  const { radius: r, height: h } = params;
  const slant = Math.sqrt(r * r + h * h);

  // 正视图：等腰三角形，底 2r、高 h
  const front: SingleView = {
    width: 2 * r, height: h, label: '正视图',
    segments: [
      // 左斜边
      { x1: 0, y1: 0, x2: r, y2: h, visible: true },
      // 右斜边
      { x1: 2 * r, y1: 0, x2: r, y2: h, visible: true },
      // 底边
      { x1: 0, y1: 0, x2: 2 * r, y2: 0, visible: true },
      // 中心轴线（虚线）
      { x1: r, y1: 0, x2: r, y2: h, visible: false },
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: 2 * r, y2: 0, text: `2×${r}`, side: 'bottom' },
      { x1: 2 * r, y1: 0, x2: 2 * r, y2: h, text: String(h), side: 'right' },
      // 母线长
      { x1: 0, y1: 0, x2: r, y2: h, text: `l≈${slant.toFixed(1)}`, side: 'left' },
    ],
  };

  // 侧视图：与正视图相同（圆锥轴对称）
  const side: SingleView = {
    width: 2 * r, height: h, label: '侧视图',
    segments: [
      { x1: 0, y1: 0, x2: r, y2: h, visible: true },
      { x1: 2 * r, y1: 0, x2: r, y2: h, visible: true },
      { x1: 0, y1: 0, x2: 2 * r, y2: 0, visible: true },
      { x1: r, y1: 0, x2: r, y2: h, visible: false },
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: 2 * r, y2: 0, text: `2×${r}`, side: 'bottom' },
    ],
  };

  // 俯视图：圆 + 圆心
  const top: SingleView = {
    width: 2 * r, height: 2 * r, label: '俯视图',
    segments: [
      // 十字中心线（虚线）
      { x1: 0, y1: r, x2: 2 * r, y2: r, visible: false },
      { x1: r, y1: 0, x2: r, y2: 2 * r, visible: false },
    ],
    circles: [
      { cx: r, cy: r, r, visible: true },
    ],
    points: [
      { x: r, y: r }, // 圆心
    ],
    dimensions: [
      { x1: 0, y1: r, x2: 2 * r, y2: r, text: `⌀${2 * r}`, side: 'bottom' },
    ],
  };

  return { front, side, top };
}

// ─── 辅助函数 ───

/** 生成矩形的 4 条边 */
function rectSegments(w: number, h: number, visible: boolean): ViewSegment[] {
  return [
    { x1: 0, y1: 0, x2: w, y2: 0, visible },   // 底边
    { x1: w, y1: 0, x2: w, y2: h, visible },     // 右边
    { x1: w, y1: h, x2: 0, y2: h, visible },     // 顶边
    { x1: 0, y1: h, x2: 0, y2: 0, visible },     // 左边
  ];
}

// ─── 棱锥三视图 ───

/**
 * 正 n 棱锥三视图
 *
 * 底面在 y=0，顶点 P 在 y=h
 * 底面外接圆半径 R = a / (2 sin(π/n))
 * 边心距 apothem = a / (2 tan(π/n))
 *
 * 正视图（沿 -Z 看）：等腰三角形，底宽=2R（外接圆直径投影），高=h
 *   - 对于 n 为偶数：底宽 = 2R（左右最远顶点距离）
 *   - 实际投影底宽取决于顶点的 X 坐标范围
 *
 * 俯视图（沿 -Y 看）：正 n 边形 + 中心点
 *
 * 侧视图（沿 +X 看）：类似正视图
 *
 * 手算验证：正四棱锥 (a=2, h=2)
 * → R = √2 ≈ 1.414, apothem = 1
 * → 正视图宽 = 2R ≈ 2.83（沿 -Z 看，X 方向顶点投影范围）
 */
export function pyramidThreeView(params: { sides: number; sideLength: number; height: number }): ThreeViewResult {
  const { sides: n, sideLength: a, height: h } = params;
  const R = a / (2 * Math.sin(Math.PI / n));

  // 底面顶点 3D 坐标（与 pyramid builder 一致）
  const baseVerts3D: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    baseVerts3D.push({
      x: R * Math.cos(angle),
      y: 0,
      z: R * Math.sin(angle),
    });
  }

  // === 正视图（沿 -Z 看 → XY 平面）===
  const front = buildPyramidElevation(
    baseVerts3D.map((v) => v.x),
    baseVerts3D.map((v) => v.z),
    h, '正视图',
  );

  // === 侧视图（沿 +X 看 → ZY 平面，Z 翻转使左=前）===
  const side = buildPyramidElevation(
    baseVerts3D.map((v) => -v.z),
    baseVerts3D.map((v) => v.x),
    h, '侧视图',
  );

  // === 俯视图（沿 -Y 看 → XZ 平面，Z 翻转使上=前）===
  const xCoords = baseVerts3D.map((v) => v.x);
  const zFlipped = baseVerts3D.map((v) => -v.z);
  const frontMinX = Math.min(...xCoords);
  const sideMinZ = Math.min(...zFlipped);
  const topVerts = baseVerts3D.map((v) => ({
    x: v.x - frontMinX,
    y: -v.z - sideMinZ,
  }));
  const topWidth = Math.max(...xCoords) - frontMinX;
  const topHeight = Math.max(...zFlipped) - sideMinZ;

  const topSegments: ViewSegment[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    topSegments.push({
      x1: topVerts[i].x, y1: topVerts[i].y,
      x2: topVerts[j].x, y2: topVerts[j].y,
      visible: true,
    });
  }
  // 中心到各顶点的连线（虚线，表示侧棱投影）
  const topCx = -frontMinX;
  const topCy = -sideMinZ;
  for (let i = 0; i < n; i++) {
    topSegments.push({
      x1: topCx, y1: topCy,
      x2: topVerts[i].x, y2: topVerts[i].y,
      visible: false,
    });
  }

  const top: SingleView = {
    width: topWidth, height: topHeight, label: '俯视图',
    segments: topSegments,
    circles: [],
    points: [{ x: topCx, y: topCy }],
    dimensions: [],
  };

  return { front, side, top };
}

/**
 * 构建棱锥正/侧视图（立面图）
 *
 * 投影方向上的坐标为 projCoords，深度方向为 depthCoords。
 * 外轮廓 = 投影最左/最右顶点到顶点 P 的三角形。
 * 被遮挡的侧棱 = 深度在后方、且投影不与外轮廓重合的棱。
 */
function buildPyramidElevation(
  projCoords: number[],
  depthCoords: number[],
  h: number,
  label: string,
): SingleView {
  const n = projCoords.length;
  const minProj = Math.min(...projCoords);
  const maxProj = Math.max(...projCoords);
  const width = maxProj - minProj;
  const cx = -minProj; // 顶点 P 的投影 X（底面中心）

  // 外轮廓三角形（实线）
  const segments: ViewSegment[] = [
    { x1: 0, y1: 0, x2: width, y2: 0, visible: true },
    { x1: 0, y1: 0, x2: cx, y2: h, visible: true },
    { x1: width, y1: 0, x2: cx, y2: h, visible: true },
  ];

  // 中心轴线（虚线）
  segments.push({ x1: cx, y1: 0, x2: cx, y2: h, visible: false });

  // 被遮挡的侧棱：仅当投影位置不与外轮廓左/右边重合时才画
  const maxDepth = Math.max(...depthCoords); // 最前面
  const EPS = 1e-6;
  for (let i = 0; i < n; i++) {
    if (depthCoords[i] >= maxDepth - EPS) continue; // 前方顶点，不遮挡
    const px = projCoords[i] - minProj;
    // 与外轮廓左边(0)或右边(width)或中心轴(cx)重合则跳过
    if (Math.abs(px) < EPS || Math.abs(px - width) < EPS || Math.abs(px - cx) < EPS) continue;
    segments.push({
      x1: px, y1: 0, x2: cx, y2: h, visible: false,
    });
  }

  return {
    width, height: h, label,
    segments,
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: width, y2: 0, text: `${width.toFixed(2)}`, side: 'bottom' },
      ...(label === '正视图' ? [{ x1: width, y1: 0, x2: width, y2: h, text: h.toFixed(2), side: 'right' as const }] : []),
    ],
  };
}

// ─── 圆柱三视图 ───

/**
 * 圆柱三视图
 *
 * 正视图/侧视图：矩形 2r × h
 * 俯视图：圆（半径 r）+ 圆心
 */
export function cylinderThreeView(params: { radius: number; height: number }): ThreeViewResult {
  const { radius: r, height: h } = params;

  // 正视图：矩形
  const front: SingleView = {
    width: 2 * r, height: h, label: '正视图',
    segments: rectSegments(2 * r, h, true),
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: 2 * r, y2: 0, text: `2×${r}`, side: 'bottom' },
      { x1: 0, y1: 0, x2: 0, y2: h, text: String(h), side: 'left' },
    ],
  };

  // 侧视图：与正视图相同
  const side: SingleView = {
    width: 2 * r, height: h, label: '侧视图',
    segments: rectSegments(2 * r, h, true),
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: 2 * r, y2: 0, text: `2×${r}`, side: 'bottom' },
    ],
  };

  // 俯视图：圆 + 十字中心线
  const top: SingleView = {
    width: 2 * r, height: 2 * r, label: '俯视图',
    segments: [
      { x1: 0, y1: r, x2: 2 * r, y2: r, visible: false },
      { x1: r, y1: 0, x2: r, y2: 2 * r, visible: false },
    ],
    circles: [
      { cx: r, cy: r, r, visible: true },
    ],
    points: [{ x: r, y: r }],
    dimensions: [
      { x1: 0, y1: r, x2: 2 * r, y2: r, text: `⌀${2 * r}`, side: 'bottom' },
    ],
  };

  return { front, side, top };
}

// ─── 正棱柱三视图 ───

/**
 * 正棱柱三视图
 *
 * 底面在 y=0，顶面在 y=h
 * R_底 = a / (2sin(π/n))
 *
 * 正视图（沿 -Z 看）：矩形轮廓（宽=最大X投影范围，高=h）
 * 侧视图（沿 +X 看）：矩形轮廓（宽=最大Z投影范围，高=h）
 * 俯视图（沿 -Y 看）：正 n 边形
 */
export function prismThreeView(params: { sides: number; sideLength: number; height: number }): ThreeViewResult {
  const { sides: n, sideLength: a, height: h } = params;
  const R = a / (2 * Math.sin(Math.PI / n));

  // 底面顶点 3D 坐标
  const baseVerts3D: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    baseVerts3D.push({
      x: R * Math.cos(angle),
      z: R * Math.sin(angle),
    });
  }

  // 正视图（沿 -Z 看）：矩形（宽=X范围，高=h）+ 内部棱线
  const xCoords = baseVerts3D.map((v) => v.x);
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const frontWidth = maxX - minX;

  const frontSegments: ViewSegment[] = rectSegments(frontWidth, h, true);
  // 内部竖直棱线（投影到同一位置的不同顶点）
  const uniqueX = [...new Set(xCoords.map((x) => Math.round((x - minX) * 1000) / 1000))];
  uniqueX.sort((a, b) => a - b);
  const EPS = 1e-4;
  for (const px of uniqueX) {
    if (px > EPS && px < frontWidth - EPS) {
      frontSegments.push({ x1: px, y1: 0, x2: px, y2: h, visible: false });
    }
  }

  const front: SingleView = {
    width: frontWidth, height: h, label: '正视图',
    segments: frontSegments,
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: frontWidth, y2: 0, text: frontWidth.toFixed(1), side: 'bottom' },
      { x1: 0, y1: 0, x2: 0, y2: h, text: String(h), side: 'left' },
    ],
  };

  // 侧视图（沿 +X 看）
  const zCoords = baseVerts3D.map((v) => -v.z);
  const minZ = Math.min(...zCoords);
  const maxZ = Math.max(...zCoords);
  const sideWidth = maxZ - minZ;

  const sideSegments: ViewSegment[] = rectSegments(sideWidth, h, true);
  const uniqueZ = [...new Set(zCoords.map((z) => Math.round((z - minZ) * 1000) / 1000))];
  uniqueZ.sort((a, b) => a - b);
  for (const pz of uniqueZ) {
    if (pz > EPS && pz < sideWidth - EPS) {
      sideSegments.push({ x1: pz, y1: 0, x2: pz, y2: h, visible: false });
    }
  }

  const side: SingleView = {
    width: sideWidth, height: h, label: '侧视图',
    segments: sideSegments,
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: sideWidth, y2: 0, text: sideWidth.toFixed(1), side: 'bottom' },
    ],
  };

  // 俯视图（沿 -Y 看）：正 n 边形
  const topVerts = baseVerts3D.map((v) => ({
    x: v.x - minX,
    y: -v.z - minZ,
  }));
  const topWidth = maxX - minX;
  const topHeight = maxZ - minZ;

  const topSegments: ViewSegment[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    topSegments.push({
      x1: topVerts[i].x, y1: topVerts[i].y,
      x2: topVerts[j].x, y2: topVerts[j].y,
      visible: true,
    });
  }

  const top: SingleView = {
    width: topWidth, height: topHeight, label: '俯视图',
    segments: topSegments,
    circles: [],
    points: [],
    dimensions: [],
  };

  return { front, side, top };
}

// ─── 墙角四面体三视图 ───

/**
 * 墙角四面体三视图
 *
 * O=(0,0,0), A=(a,0,0), B=(0,0,b), C=(0,c,0)
 *
 * 正视图（沿 -Z 看 → XY 平面）：直角三角形 OAC（宽 a，高 c）
 * 侧视图（沿 +X 看 → ZY 平面）：直角三角形 OBC（宽 b，高 c）
 * 俯视图（沿 -Y 看 → XZ 平面）：直角三角形 OAB（宽 a，深 b）+ 斜线
 */
export function cornerTetrahedronThreeView(params: { edgeA: number; edgeB: number; edgeC: number }): ThreeViewResult {
  const { edgeA: a, edgeB: b, edgeC: c } = params;

  // 正视图（沿 -Z 看）：投影到 XY 平面
  // O→(0,0), A→(a,0), C→(0,c), B→(0,0)（与O重合）
  // 可见轮廓：三角形 OAC + 虚线从 O 到某处表示 B 投影
  const front: SingleView = {
    width: a, height: c, label: '正视图',
    segments: [
      { x1: 0, y1: 0, x2: a, y2: 0, visible: true },   // OA（底边）
      { x1: 0, y1: 0, x2: 0, y2: c, visible: true },     // OC（左边）
      { x1: a, y1: 0, x2: 0, y2: c, visible: true },     // AC（斜边）
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: a, y2: 0, text: `a=${a}`, side: 'bottom' },
      { x1: 0, y1: 0, x2: 0, y2: c, text: `c=${c}`, side: 'left' },
    ],
  };

  // 侧视图（沿 +X 看）：投影到 ZY 平面，Z 翻转
  // O→(0,0), B→(b,0)（Z翻转后），C→(0,c), A→(0,0)（与O重合）
  const side: SingleView = {
    width: b, height: c, label: '侧视图',
    segments: [
      { x1: 0, y1: 0, x2: b, y2: 0, visible: true },     // OB
      { x1: 0, y1: 0, x2: 0, y2: c, visible: true },     // OC
      { x1: b, y1: 0, x2: 0, y2: c, visible: true },     // BC
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: b, y2: 0, text: `b=${b}`, side: 'bottom' },
      { x1: b, y1: 0, x2: b, y2: c, text: `c=${c}`, side: 'right' },
    ],
  };

  // 俯视图（沿 -Y 看）：投影到 XZ 平面，Z 翻转
  // O→(0,0), A→(a,0), B→(0,b)（Z翻转后），C→(0,0)（与O重合）
  const top: SingleView = {
    width: a, height: b, label: '俯视图',
    segments: [
      { x1: 0, y1: 0, x2: a, y2: 0, visible: true },     // OA
      { x1: 0, y1: 0, x2: 0, y2: b, visible: true },     // OB
      { x1: a, y1: 0, x2: 0, y2: b, visible: true },     // AB
      // 虚线：C 投影到 O 点（重合，用短虚线标记）
    ],
    circles: [],
    points: [{ x: 0, y: 0 }],
    dimensions: [
      { x1: 0, y1: 0, x2: a, y2: 0, text: `a=${a}`, side: 'bottom' },
      { x1: 0, y1: 0, x2: 0, y2: b, text: `b=${b}`, side: 'left' },
    ],
  };

  return { front, side, top };
}

// ─── 正四面体三视图 ───

/**
 * 正四面体三视图
 *
 * 底面正三角形在 y=0，顶点 D 在 y=h
 * h = (√6/3)·a，底面外接圆半径 R = a/√3
 *
 * 正视图（沿 -Z 看）：等腰三角形
 * 侧视图（沿 +X 看）：等腰三角形
 * 俯视图（沿 -Y 看）：正三角形 + 中心点
 */
export function regularTetrahedronThreeView(params: { sideLength: number }): ThreeViewResult {
  const { sideLength: a } = params;
  const h = (Math.sqrt(6) / 3) * a;
  const R = a / Math.sqrt(3);

  // 底面顶点 3D 坐标（与 builder 一致）
  const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  const baseVerts3D = angles.map((angle) => ({
    x: R * Math.cos(angle),
    y: 0,
    z: R * Math.sin(angle),
  }));

  // === 正视图（沿 -Z 看 → XY 平面）===
  const front = buildPyramidElevation(
    baseVerts3D.map((v) => v.x),
    baseVerts3D.map((v) => v.z),
    h, '正视图',
  );

  // === 侧视图（沿 +X 看 → ZY 平面，Z 翻转）===
  const side = buildPyramidElevation(
    baseVerts3D.map((v) => -v.z),
    baseVerts3D.map((v) => v.x),
    h, '侧视图',
  );

  // === 俯视图（沿 -Y 看 → XZ 平面，Z 翻转）===
  const xCoords = baseVerts3D.map((v) => v.x);
  const zFlipped = baseVerts3D.map((v) => -v.z);
  const frontMinX = Math.min(...xCoords);
  const sideMinZ = Math.min(...zFlipped);
  const topVerts = baseVerts3D.map((v) => ({
    x: v.x - frontMinX,
    y: -v.z - sideMinZ,
  }));
  const topWidth = Math.max(...xCoords) - frontMinX;
  const topHeight = Math.max(...zFlipped) - sideMinZ;

  const topSegments: ViewSegment[] = [];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    topSegments.push({
      x1: topVerts[i].x, y1: topVerts[i].y,
      x2: topVerts[j].x, y2: topVerts[j].y,
      visible: true,
    });
  }
  // 中心到各顶点的连线（虚线，表示侧棱投影）
  const topCx = -frontMinX;
  const topCy = -sideMinZ;
  for (let i = 0; i < 3; i++) {
    topSegments.push({
      x1: topCx, y1: topCy,
      x2: topVerts[i].x, y2: topVerts[i].y,
      visible: false,
    });
  }

  const top: SingleView = {
    width: topWidth, height: topHeight, label: '俯视图',
    segments: topSegments,
    circles: [],
    points: [{ x: topCx, y: topCy }],
    dimensions: [],
  };

  return { front, side, top };
}

// ─── 球三视图 ───

/**
 * 球三视图
 *
 * 三个视图完全相同：圆（半径 r）+ 圆心
 */
export function sphereThreeView(params: { radius: number }): ThreeViewResult {
  const { radius: r } = params;

  const makeView = (label: string): SingleView => ({
    width: 2 * r, height: 2 * r, label,
    segments: [
      { x1: 0, y1: r, x2: 2 * r, y2: r, visible: false },
      { x1: r, y1: 0, x2: r, y2: 2 * r, visible: false },
    ],
    circles: [
      { cx: r, cy: r, r, visible: true },
    ],
    points: [{ x: r, y: r }],
    dimensions: [
      { x1: 0, y1: r, x2: 2 * r, y2: r, text: `⌀${2 * r}`, side: 'bottom' },
    ],
  });

  return {
    front: makeView('正视图'),
    side: makeView('侧视图'),
    top: makeView('俯视图'),
  };
}

// ─── 圆台三视图 ───

export function truncatedConeThreeView(params: { topRadius: number; bottomRadius: number; height: number }): ThreeViewResult {
  const { topRadius: r1, bottomRadius: r2, height: h } = params;
  const slant = Math.sqrt((r2 - r1) * (r2 - r1) + h * h);

  // 正视图：等腰梯形（上底 2r₁，下底 2r₂，高 h）
  const front: SingleView = {
    width: 2 * r2, height: h, label: '正视图',
    segments: [
      { x1: 0, y1: 0, x2: 2 * r2, y2: 0, visible: true },                           // 底边
      { x1: r2 - r1, y1: h, x2: r2 + r1, y2: h, visible: true },                    // 顶边
      { x1: 0, y1: 0, x2: r2 - r1, y2: h, visible: true },                           // 左斜边
      { x1: 2 * r2, y1: 0, x2: r2 + r1, y2: h, visible: true },                     // 右斜边
      { x1: r2, y1: 0, x2: r2, y2: h, visible: false },                              // 中心轴线（虚线）
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: 2 * r2, y2: 0, text: `2×${r2}`, side: 'bottom' },
      { x1: 2 * r2, y1: 0, x2: 2 * r2, y2: h, text: h.toFixed(2), side: 'right' },
      { x1: 0, y1: 0, x2: r2 - r1, y2: h, text: `l≈${slant.toFixed(2)}`, side: 'left' },
    ],
  };

  // 侧视图：与正视图相同
  const side: SingleView = {
    ...front, label: '侧视图',
    dimensions: [{ x1: 0, y1: 0, x2: 2 * r2, y2: 0, text: `2×${r2}`, side: 'bottom' }],
  };

  // 俯视图：同心圆
  const top: SingleView = {
    width: 2 * r2, height: 2 * r2, label: '俯视图',
    segments: [
      { x1: 0, y1: r2, x2: 2 * r2, y2: r2, visible: false },
      { x1: r2, y1: 0, x2: r2, y2: 2 * r2, visible: false },
    ],
    circles: [
      { cx: r2, cy: r2, r: r2, visible: true },
      { cx: r2, cy: r2, r: r1, visible: true },
    ],
    points: [{ x: r2, y: r2 }],
    dimensions: [
      { x1: 0, y1: r2, x2: 2 * r2, y2: r2, text: `⌀${2 * r2}`, side: 'bottom' },
    ],
  };

  return { front, side, top };
}

// ─── 棱台三视图 ───

export function frustumThreeView(params: { sides: number; bottomSideLength: number; topSideLength: number; height: number }): ThreeViewResult {
  const { sides: n, bottomSideLength: a2, topSideLength: a1, height: h } = params;
  const R2 = a2 / (2 * Math.sin(Math.PI / n));
  const R1 = a1 / (2 * Math.sin(Math.PI / n));

  // 底面和顶面顶点 X 坐标投影
  const bottomVertsX: number[] = [];
  const topVertsX: number[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    bottomVertsX.push(R2 * Math.cos(angle));
    topVertsX.push(R1 * Math.cos(angle));
  }

  const minBX = Math.min(...bottomVertsX);
  const maxBX = Math.max(...bottomVertsX);
  const frontWidth = maxBX - minBX;

  const minTX = Math.min(...topVertsX);
  const maxTX = Math.max(...topVertsX);
  const topWidth = maxTX - minTX;

  const xShiftBottom = -minBX;

  // 正视图：梯形
  const frontSegments: ViewSegment[] = [
    { x1: 0, y1: 0, x2: frontWidth, y2: 0, visible: true },                                    // 底边
    { x1: (frontWidth - topWidth) / 2, y1: h, x2: (frontWidth + topWidth) / 2, y2: h, visible: true }, // 顶边
    { x1: 0, y1: 0, x2: (frontWidth - topWidth) / 2, y2: h, visible: true },                    // 左斜边
    { x1: frontWidth, y1: 0, x2: (frontWidth + topWidth) / 2, y2: h, visible: true },           // 右斜边
  ];

  // 内部竖直虚线（投影重合的顶点）
  const uniqueBottomX = [...new Set(bottomVertsX.map((x) => Math.round((x + xShiftBottom) * 1000) / 1000))];
  const EPS = 1e-4;
  for (const px of uniqueBottomX) {
    if (px > EPS && px < frontWidth - EPS) {
      frontSegments.push({ x1: px, y1: 0, x2: px, y2: h, visible: false });
    }
  }

  const front: SingleView = {
    width: frontWidth, height: h, label: '正视图',
    segments: frontSegments,
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: frontWidth, y2: 0, text: frontWidth.toFixed(2), side: 'bottom' },
      { x1: frontWidth, y1: 0, x2: frontWidth, y2: h, text: h.toFixed(2), side: 'right' },
    ],
  };

  // 侧视图
  const bottomVertsZ: number[] = [];
  const topVertsZ: number[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    bottomVertsZ.push(R2 * Math.sin(angle));
    topVertsZ.push(R1 * Math.sin(angle));
  }
  const minBZ = Math.min(...bottomVertsZ);
  const maxBZ = Math.max(...bottomVertsZ);
  const sideWidth = maxBZ - minBZ;
  const minTZ = Math.min(...topVertsZ);
  const maxTZ = Math.max(...topVertsZ);
  const sideTopWidth = maxTZ - minTZ;

  const sideSegments: ViewSegment[] = [
    { x1: 0, y1: 0, x2: sideWidth, y2: 0, visible: true },
    { x1: (sideWidth - sideTopWidth) / 2, y1: h, x2: (sideWidth + sideTopWidth) / 2, y2: h, visible: true },
    { x1: 0, y1: 0, x2: (sideWidth - sideTopWidth) / 2, y2: h, visible: true },
    { x1: sideWidth, y1: 0, x2: (sideWidth + sideTopWidth) / 2, y2: h, visible: true },
  ];

  const side: SingleView = {
    width: sideWidth, height: h, label: '侧视图',
    segments: sideSegments,
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: sideWidth, y2: 0, text: sideWidth.toFixed(2), side: 'bottom' },
    ],
  };

  // 俯视图：两个同心正 n 边形 + 连接线
  const topViewSegments: ViewSegment[] = [];

  // 底面正 n 边形
  const bvTop: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    bvTop.push({ x: R2 * Math.cos(angle) + R2, y: -R2 * Math.sin(angle) + R2 });
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    topViewSegments.push({ x1: bvTop[i].x, y1: bvTop[i].y, x2: bvTop[j].x, y2: bvTop[j].y, visible: true });
  }

  // 顶面正 n 边形
  const tvTop: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    tvTop.push({ x: R1 * Math.cos(angle) + R2, y: -R1 * Math.sin(angle) + R2 });
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    topViewSegments.push({ x1: tvTop[i].x, y1: tvTop[i].y, x2: tvTop[j].x, y2: tvTop[j].y, visible: true });
  }

  // 连接线（虚线：各顶点到对应上底顶点）
  for (let i = 0; i < n; i++) {
    topViewSegments.push({ x1: bvTop[i].x, y1: bvTop[i].y, x2: tvTop[i].x, y2: tvTop[i].y, visible: false });
  }

  const topView: SingleView = {
    width: 2 * R2, height: 2 * R2, label: '俯视图',
    segments: topViewSegments,
    circles: [], points: [{ x: R2, y: R2 }],
    dimensions: [],
  };

  return { front, side, top: topView };
}

// ─── 对棱相等四面体三视图 ───

export function isoscelesTetrahedronThreeView(params: { edgeP: number; edgeQ: number; edgeR: number }): ThreeViewResult {
  const { edgeP: p, edgeQ: q, edgeR: r } = params;

  // 内接长方体 a × b × c
  const a = Math.sqrt(Math.max(0, (q * q + r * r - p * p) / 2));
  const b = Math.sqrt(Math.max(0, (p * p + r * r - q * q) / 2));
  const c = Math.sqrt(Math.max(0, (p * p + q * q - r * r) / 2));

  // 正视图（沿 -Z 看）→ XY 平面：长方体 a × b + 对角线
  const front: SingleView = {
    width: a, height: b, label: '正视图',
    segments: [
      ...rectSegments(a, b, true),
      { x1: 0, y1: 0, x2: a, y2: b, visible: true },  // 对角线（四面体棱 AB 投影）
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: a, y2: 0, text: a.toFixed(2), side: 'bottom' },
      { x1: 0, y1: 0, x2: 0, y2: b, text: b.toFixed(2), side: 'left' },
    ],
  };

  // 侧视图（沿 +X 看）→ ZY 平面：长方体 c × b + 对角线
  const side: SingleView = {
    width: c, height: b, label: '侧视图',
    segments: [
      ...rectSegments(c, b, true),
      { x1: 0, y1: 0, x2: c, y2: b, visible: true },
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: c, y2: 0, text: c.toFixed(2), side: 'bottom' },
    ],
  };

  // 俯视图（沿 -Y 看）→ XZ 平面：长方体 a × c + 对角线
  const top: SingleView = {
    width: a, height: c, label: '俯视图',
    segments: [
      ...rectSegments(a, c, true),
      { x1: 0, y1: 0, x2: a, y2: c, visible: true },
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: 0, x2: a, y2: 0, text: a.toFixed(2), side: 'bottom' },
    ],
  };

  return { front, side, top };
}

// ─── 对棱垂直四面体三视图 ───

export function orthogonalTetrahedronThreeView(params: { edgeAB: number; edgeCD: number }): ThreeViewResult {
  const { edgeAB: ab, edgeCD: cd } = params;

  const d = Math.sqrt(ab * ab + cd * cd) / 2;

  // 顶点：A=(-ab/2, d, 0), B=(ab/2, d, 0), C=(0, 0, -cd/2), D=(0, 0, cd/2)

  // 正视图（沿 -Z 看）→ XY 平面
  // X 范围 [-ab/2, ab/2]，Y 范围 [0, d]
  // 投影：A=(-ab/2, d), B=(ab/2, d), C=(0, 0), D=(0, 0)
  // C 和 D 重合于 (0,0)
  const fW = ab;
  const fH = d;
  const front: SingleView = {
    width: fW, height: fH, label: '正视图',
    segments: [
      { x1: 0, y1: fH, x2: fW, y2: fH, visible: true },        // AB
      { x1: 0, y1: fH, x2: fW / 2, y2: 0, visible: true },     // AC (=AD, 重合)
      { x1: fW, y1: fH, x2: fW / 2, y2: 0, visible: true },    // BC (=BD, 重合)
      { x1: fW / 2, y1: 0, x2: fW / 2, y2: 0, visible: false }, // CD 退化为点
    ],
    circles: [], points: [{ x: fW / 2, y: 0 }],
    dimensions: [
      { x1: 0, y1: fH, x2: fW, y2: fH, text: ab.toFixed(2), side: 'top' },
      { x1: fW, y1: 0, x2: fW, y2: fH, text: d.toFixed(2), side: 'right' },
    ],
  };

  // 侧视图（沿 +X 看）→ ZY 平面
  // Z 范围 [-cd/2, cd/2]，Y 范围 [0, d]
  // 投影：A=(0, d), B=(0, d)重合, C=(-cd/2, 0), D=(cd/2, 0)
  const sW = cd;
  const sH = d;
  const side: SingleView = {
    width: sW, height: sH, label: '侧视图',
    segments: [
      { x1: 0, y1: 0, x2: sW, y2: 0, visible: true },        // CD
      { x1: 0, y1: 0, x2: sW / 2, y2: sH, visible: true },   // CA (=CB 重合)
      { x1: sW, y1: 0, x2: sW / 2, y2: sH, visible: true },  // DA (=DB 重合)
    ],
    circles: [], points: [{ x: sW / 2, y: sH }],
    dimensions: [
      { x1: 0, y1: 0, x2: sW, y2: 0, text: cd.toFixed(2), side: 'bottom' },
    ],
  };

  // 俯视图（沿 -Y 看）→ XZ 平面
  // A=(-ab/2, 0), B=(ab/2, 0) [Z=0], C=(0, cd/2) [Z翻转], D=(0, -cd/2)
  const tW = ab;
  const tH = cd;
  const top: SingleView = {
    width: tW, height: tH, label: '俯视图',
    segments: [
      { x1: 0, y1: tH / 2, x2: tW, y2: tH / 2, visible: true },     // AB (在中间)
      { x1: 0, y1: tH / 2, x2: tW / 2, y2: 0, visible: true },       // AC
      { x1: 0, y1: tH / 2, x2: tW / 2, y2: tH, visible: true },      // AD
      { x1: tW, y1: tH / 2, x2: tW / 2, y2: 0, visible: true },      // BC
      { x1: tW, y1: tH / 2, x2: tW / 2, y2: tH, visible: true },     // BD
      { x1: tW / 2, y1: 0, x2: tW / 2, y2: tH, visible: true },      // CD
    ],
    circles: [], points: [],
    dimensions: [
      { x1: 0, y1: tH / 2, x2: tW, y2: tH / 2, text: ab.toFixed(2), side: 'bottom' },
    ],
  };

  return { front, side, top };
}
