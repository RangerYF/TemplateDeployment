import type { Vec3 } from '../types';

// ─── 向量工具 ───

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function crossProduct(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-10) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

// ─── 角度结果 ───

export interface AngleResult {
  radians: number;
  degrees: number;
  latex: string;       // 精确值 LaTeX（如 "\\arctan\\sqrt{2}"）
  degreesStr: string;  // 度数字符串（如 "54.74°"）
}

// ─── 精确角度匹配 ───

const KNOWN_ANGLES: { radians: number; latex: string; degreesStr: string }[] = [
  { radians: 0, latex: '0°', degreesStr: '0°' },
  { radians: Math.PI / 6, latex: '30°', degreesStr: '30°' },
  { radians: Math.PI / 4, latex: '45°', degreesStr: '45°' },
  { radians: Math.PI / 3, latex: '60°', degreesStr: '60°' },
  { radians: Math.PI / 2, latex: '90°', degreesStr: '90°' },
  // arctan 类
  { radians: Math.atan(Math.sqrt(2)), latex: '\\arctan\\sqrt{2}', degreesStr: '54.74°' },
  { radians: Math.atan(Math.sqrt(2) / 2), latex: '\\arctan\\dfrac{\\sqrt{2}}{2}', degreesStr: '35.26°' },
  // arccos 类
  { radians: Math.acos(1 / 3), latex: '\\arccos\\dfrac{1}{3}', degreesStr: '70.53°' },
  { radians: Math.acos(2 / 3), latex: '\\arccos\\dfrac{2}{3}', degreesStr: '48.19°' },
  { radians: Math.acos(1 / Math.sqrt(3)), latex: '\\arccos\\dfrac{1}{\\sqrt{3}}', degreesStr: '54.74°' },
];

function matchExactAngle(radians: number): { latex: string; degreesStr: string } {
  const eps = 1e-6;
  for (const known of KNOWN_ANGLES) {
    if (Math.abs(radians - known.radians) < eps) {
      return { latex: known.latex, degreesStr: known.degreesStr };
    }
  }
  // fallback: 用度数近似值
  const deg = (radians * 180) / Math.PI;
  const degStr = `${deg.toFixed(2)}°`;
  return { latex: degStr, degreesStr: degStr };
}

function buildResult(radians: number): AngleResult {
  const degrees = (radians * 180) / Math.PI;
  const match = matchExactAngle(radians);
  return {
    radians,
    degrees,
    latex: match.latex,
    degreesStr: match.degreesStr,
  };
}

// ─── 面法向量计算 ───

/**
 * 从面上的点集计算法向量（取前三个不共线的点）
 */
export function faceNormal(points: Vec3[]): Vec3 {
  if (points.length < 3) return [0, 1, 0];
  const v1 = sub(points[1], points[0]);
  const v2 = sub(points[2], points[0]);
  const n = crossProduct(v1, v2);
  return normalize(n);
}

function centroid(points: Vec3[]): Vec3 {
  let sx = 0, sy = 0, sz = 0;
  for (const p of points) {
    sx += p[0]; sy += p[1]; sz += p[2];
  }
  const n = points.length;
  return [sx / n, sy / n, sz / n];
}

// ─── 二面角 ───

/**
 * 计算二面角：沿棱线 edgeStart→edgeEnd，两个邻接面的夹角
 *
 * 方法：在棱线上取中点，计算两个面上各自 ⊥ 棱线的方向向量 d1, d2
 * （通过 cross(n, edgeDir) 得到，再用面重心修正方向使其朝向面内部）
 *
 * 数学证明：d1·d2 的 arccos 直接就是二面角
 * - 正方体：d1⊥d2, arccos(0) = 90° ✓
 * - 正四面体：d1·d2 = 1/3, arccos(1/3) ≈ 70.53° ✓
 */
export function calculateDihedralAngle(
  edgeStart: Vec3,
  edgeEnd: Vec3,
  face1Points: Vec3[],
  face2Points: Vec3[],
): AngleResult {
  const edgeDir = normalize(sub(edgeEnd, edgeStart));
  const n1 = faceNormal(face1Points);
  const n2 = faceNormal(face2Points);

  // 面上 ⊥ 棱线的方向 = cross(n, edgeDir)
  let d1 = normalize(crossProduct(n1, edgeDir));
  let d2 = normalize(crossProduct(n2, edgeDir));

  // 用面重心修正方向，确保 d1, d2 朝向各自面的内部
  const edgeMid: Vec3 = [
    (edgeStart[0] + edgeEnd[0]) / 2,
    (edgeStart[1] + edgeEnd[1]) / 2,
    (edgeStart[2] + edgeEnd[2]) / 2,
  ];

  const c1 = centroid(face1Points);
  const toC1 = sub(c1, edgeMid);
  const toC1perp = sub(toC1, scale(edgeDir, dot(toC1, edgeDir)));
  if (dot(toC1perp, d1) < 0) d1 = scale(d1, -1);

  const c2 = centroid(face2Points);
  const toC2 = sub(c2, edgeMid);
  const toC2perp = sub(toC2, scale(edgeDir, dot(toC2, edgeDir)));
  if (dot(toC2perp, d2) < 0) d2 = scale(d2, -1);

  // 二面角 = arccos(d1·d2)（不需要 π - 修正）
  const cosAngle = Math.max(-1, Math.min(1, dot(d1, d2)));
  const angle = Math.acos(cosAngle);

  return buildResult(angle);
}

// ─── 线面角 ───

/**
 * 计算线面角：线段方向与面法向量的余角
 * α = arcsin(|d · n|) = π/2 - arccos(|d · n|)
 */
export function calculateLineFaceAngle(
  lineStart: Vec3,
  lineEnd: Vec3,
  facePoints: Vec3[],
): AngleResult {
  const d = normalize(sub(lineEnd, lineStart));
  const n = faceNormal(facePoints);

  const absDotDN = Math.abs(dot(d, n));
  const clampedDot = Math.max(0, Math.min(1, absDotDN));
  const angle = Math.asin(clampedDot);

  return buildResult(angle);
}

// ─── 线线角 ───

/**
 * 计算线线角：两条线段方向向量的夹角（取锐角）
 * θ = arccos(|d1 · d2|)
 */
export function calculateLineLineAngle(
  line1Start: Vec3,
  line1End: Vec3,
  line2Start: Vec3,
  line2End: Vec3,
): AngleResult {
  const d1 = normalize(sub(line1End, line1Start));
  const d2 = normalize(sub(line2End, line2Start));

  const absDot = Math.abs(dot(d1, d2));
  const clampedDot = Math.max(0, Math.min(1, absDot));
  const angle = Math.acos(clampedDot);

  return buildResult(angle);
}

// ─── 可视化辅助数据 ───

export interface DihedralVisData {
  arcCenter: Vec3;
  dir1: Vec3;
  dir2: Vec3;
  angleRadians: number;
}

export interface LineFaceVisData {
  arcCenter: Vec3;
  lineDir: Vec3;
  projDir: Vec3;
  angleRadians: number;
}

export interface LineLineVisData {
  arcCenter: Vec3;
  dir1: Vec3;
  dir2: Vec3;
  angleRadians: number;
}

/**
 * 计算二面角的可视化数据（弧线圆心和两个方向）
 * arcCenter = 棱线中点
 * dir1, dir2 = 面上⊥棱线方向（朝向面内部）
 * 弧线从 dir1 扫到 dir2，扫过的角 = 二面角
 */
export function getDihedralVisData(
  edgeStart: Vec3,
  edgeEnd: Vec3,
  face1Points: Vec3[],
  face2Points: Vec3[],
): DihedralVisData {
  const edgeDir = normalize(sub(edgeEnd, edgeStart));
  const edgeMid: Vec3 = [
    (edgeStart[0] + edgeEnd[0]) / 2,
    (edgeStart[1] + edgeEnd[1]) / 2,
    (edgeStart[2] + edgeEnd[2]) / 2,
  ];

  const n1 = faceNormal(face1Points);
  const n2 = faceNormal(face2Points);

  let d1 = normalize(crossProduct(n1, edgeDir));
  let d2 = normalize(crossProduct(n2, edgeDir));

  // 确保方向朝向各自面的内部
  const c1 = centroid(face1Points);
  const toC1 = sub(c1, edgeMid);
  const toC1perp = sub(toC1, scale(edgeDir, dot(toC1, edgeDir)));
  if (dot(toC1perp, d1) < 0) d1 = scale(d1, -1);

  const c2 = centroid(face2Points);
  const toC2 = sub(c2, edgeMid);
  const toC2perp = sub(toC2, scale(edgeDir, dot(toC2, edgeDir)));
  if (dot(toC2perp, d2) < 0) d2 = scale(d2, -1);

  // 二面角 = arccos(d1·d2)，弧线几何角度与二面角一致
  const cosAngle = Math.max(-1, Math.min(1, dot(d1, d2)));
  const angle = Math.acos(cosAngle);

  return { arcCenter: edgeMid, dir1: d1, dir2: d2, angleRadians: angle };
}

/**
 * 计算线面角的可视化数据
 *
 * arcCenter = 线段与面平面的交点（若不相交则用最近端点在面上的投影）
 * lineDir  = 线段方向，指向远离面的一端
 * projDir  = lineDir 在面上的投影（与 lineDir 同侧）
 * 弧线从 projDir 扫到 lineDir，扫过的角 = 线面角
 */
export function getLineFaceVisData(
  lineStart: Vec3,
  lineEnd: Vec3,
  facePoints: Vec3[],
): LineFaceVisData {
  const n = faceNormal(facePoints);
  const faceOrigin = facePoints[0];

  // 两端点到面平面的有符号距离
  const distStart = dot(sub(lineStart, faceOrigin), n);
  const distEnd = dot(sub(lineEnd, faceOrigin), n);

  // lineDir 指向远离面的端点（距面更远的端点方向）
  let lineDir: Vec3;
  if (Math.abs(distStart) >= Math.abs(distEnd)) {
    // lineStart 距面更远，lineDir 从 lineEnd 指向 lineStart
    lineDir = normalize(sub(lineStart, lineEnd));
  } else {
    // lineEnd 距面更远
    lineDir = normalize(sub(lineEnd, lineStart));
  }

  // 确定 arcCenter：优先用线段与面平面的交点
  const lineVec = sub(lineEnd, lineStart);
  const denom = dot(lineVec, n);
  let arcCenter: Vec3;

  if (Math.abs(denom) > 1e-10) {
    const t = dot(sub(faceOrigin, lineStart), n) / denom;
    // 交点在合理范围内使用（线段两端各延伸一倍）
    if (t >= -1 && t <= 2) {
      arcCenter = add(lineStart, scale(lineVec, t));
    } else {
      // 交点太远，用最近端点投影
      const footEp = Math.abs(distStart) <= Math.abs(distEnd) ? lineStart : lineEnd;
      const footDist = dot(sub(footEp, faceOrigin), n);
      arcCenter = sub(footEp, scale(n, footDist));
    }
  } else {
    // 线段平行于面，用中点投影
    const mid: Vec3 = [
      (lineStart[0] + lineEnd[0]) / 2,
      (lineStart[1] + lineEnd[1]) / 2,
      (lineStart[2] + lineEnd[2]) / 2,
    ];
    const midDist = dot(sub(mid, faceOrigin), n);
    arcCenter = sub(mid, scale(n, midDist));
  }

  // projDir = lineDir 在面上的投影
  const projOnN = dot(lineDir, n);
  const projRaw: Vec3 = [
    lineDir[0] - projOnN * n[0],
    lineDir[1] - projOnN * n[1],
    lineDir[2] - projOnN * n[2],
  ];
  const projDir = normalize(projRaw);

  // 线面角
  const absDot = Math.abs(dot(normalize(sub(lineEnd, lineStart)), n));
  const angle = Math.asin(Math.max(0, Math.min(1, absDot)));

  return { arcCenter, lineDir, projDir, angleRadians: angle };
}

/**
 * 计算线线角的可视化数据
 *
 * 定位策略：
 * 1. 两线段共顶点 → arcCenter = 共顶点
 * 2. 异面直线 → arcCenter = 线段1 与 线段2 距离最近的端点，
 *    将另一条线的方向平移到此点展示角度
 *
 * dir1, dir2 = 两线段方向（调整使夹角为锐角）
 */
export function getLineLineVisData(
  line1Start: Vec3,
  line1End: Vec3,
  line2Start: Vec3,
  line2End: Vec3,
): LineLineVisData {
  const eps = 1e-6;

  // 寻找共顶点，同时记录每条线的"另一端"以确定方向
  // [共顶点, 线1另一端, 线2另一端]
  const candidates: [Vec3, Vec3, Vec3][] = [
    [line1Start, line1End, line2End],   // 共 line1Start & line2Start
    [line1Start, line1End, line2Start], // 共 line1Start & line2End
    [line1End, line1Start, line2End],   // 共 line1End & line2Start
    [line1End, line1Start, line2Start], // 共 line1End & line2End
  ];
  const checkPairs: [Vec3, Vec3][] = [
    [line1Start, line2Start],
    [line1Start, line2End],
    [line1End, line2Start],
    [line1End, line2End],
  ];

  let arcCenter: Vec3 | null = null;
  let dir1: Vec3;
  let dir2: Vec3;

  for (let i = 0; i < checkPairs.length; i++) {
    if (length(sub(checkPairs[i][0], checkPairs[i][1])) < eps) {
      const [shared, other1, other2] = candidates[i];
      arcCenter = shared;
      // 方向从共顶点指向各自另一端（朝外）
      dir1 = normalize(sub(other1, shared));
      dir2 = normalize(sub(other2, shared));
      // 取锐角：如果 d1·d2 < 0，翻转 d2
      if (dot(dir1, dir2) < 0) dir2 = scale(dir2, -1);
      break;
    }
  }

  if (!arcCenter) {
    // 无共顶点（异面直线）→ 用全局方向，arcCenter 放在线段1上最近点
    dir1 = normalize(sub(line1End, line1Start));
    dir2 = normalize(sub(line2End, line2Start));
    if (dot(dir1, dir2) < 0) dir2 = scale(dir2, -1);
    arcCenter = closestPointOnFirstSegment(line1Start, line1End, line2Start, line2End);
  }

  const absDot = Math.abs(dot(dir1!, dir2!));
  const angle = Math.acos(Math.max(0, Math.min(1, absDot)));

  return { arcCenter, dir1: dir1!, dir2: dir2!, angleRadians: angle };
}

/**
 * 计算线段1上距线段2最近的点
 * 用于异面直线的角度标注定位（将弧线放在线段1上，而非两线段中间的空中）
 */
function closestPointOnFirstSegment(
  p1: Vec3, q1: Vec3,
  p2: Vec3, q2: Vec3,
): Vec3 {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);

  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);

  // 退化情况
  if (a < 1e-10) return p1;

  let s: number;

  const c = dot(d1, r);
  if (e < 1e-10) {
    s = Math.max(0, Math.min(1, -c / a));
  } else {
    const b = dot(d1, d2);
    const denom = a * e - b * b;

    if (Math.abs(denom) > 1e-10) {
      s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
    } else {
      s = 0;
    }

    const t = (b * s + f) / e;

    if (t < 0) {
      s = Math.max(0, Math.min(1, -c / a));
    } else if (t > 1) {
      s = Math.max(0, Math.min(1, (b - c) / a));
    }
  }

  return [
    p1[0] + s * d1[0],
    p1[1] + s * d1[1],
    p1[2] + s * d1[2],
  ];
}

/**
 * 生成弧线点序列（用于渲染）
 *
 * 从 dir1 方向扫到 dir2 方向，生成圆弧上的点。
 * 使用 dir1 和 dir2 构建局部坐标系，通过 atan2 计算精确扫掠角。
 */
export function generateArcPoints(
  center: Vec3,
  dir1: Vec3,
  dir2: Vec3,
  radius: number,
  _angleRadians: number,
  segments: number = 24,
): Vec3[] {
  const points: Vec3[] = [];

  // u = dir1 方向（弧线起点方向）
  const u = normalize(dir1);

  // v = dir2 去除 u 分量后的方向（保证 dir2 在 u-v 平面内）
  const d2projU = dot(dir2, u);
  const vRaw: Vec3 = [
    dir2[0] - d2projU * u[0],
    dir2[1] - d2projU * u[1],
    dir2[2] - d2projU * u[2],
  ];
  const vLen = length(vRaw);
  if (vLen < 1e-10) return [center]; // 方向共线，无法画弧
  const v: Vec3 = [vRaw[0] / vLen, vRaw[1] / vLen, vRaw[2] / vLen];

  // dir2 在 u-v 坐标系中的角度 = 从 dir1 到 dir2 的扫掠角
  // sinA = dot(dir2, v) ≥ 0（因为 v 就是 dir2 的垂直分量方向）
  // cosA = dot(dir2, u) = d2projU（可能为正、零或负）
  const cosA = dot(normalize(dir2), u);
  const sinA = dot(normalize(dir2), v);
  const sweepAngle = Math.atan2(sinA, cosA);

  // sweepAngle 应在 (0, π] 范围内（sinA ≥ 0 保证）
  // 如果因数值误差变成很小的负数，取绝对值
  const actualSweep = Math.abs(sweepAngle) < 1e-10 ? _angleRadians : Math.abs(sweepAngle);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = t * actualSweep;
    const cosT = Math.cos(a);
    const sinT = Math.sin(a);
    points.push([
      center[0] + radius * (cosT * u[0] + sinT * v[0]),
      center[1] + radius * (cosT * u[1] + sinT * v[1]),
      center[2] + radius * (cosT * u[2] + sinT * v[2]),
    ]);
  }

  return points;
}
