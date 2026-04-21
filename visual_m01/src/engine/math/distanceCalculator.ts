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

function cross(a: Vec3, b: Vec3): Vec3 {
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

function vecLength(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

// ─── 面法向量 ───

function faceNormal(points: Vec3[]): Vec3 {
  if (points.length < 3) return [0, 1, 0];
  const v1 = sub(points[1], points[0]);
  const v2 = sub(points[2], points[0]);
  return normalize(cross(v1, v2));
}

// ─── 距离结果 ───

export interface DistanceResult {
  value: number;
  latex: string;
  approxStr: string;
}

// ─── 精确值匹配 ───

function matchExactDistance(value: number): string | null {
  if (value < 1e-10) return '0';

  const v2 = value * value;

  // 检查 value² 是否为整数 → value = √n 或整数
  if (Math.abs(v2 - Math.round(v2)) < 1e-6) {
    const n = Math.round(v2);
    const sqrtN = Math.sqrt(n);
    if (Math.abs(sqrtN - Math.round(sqrtN)) < 1e-6) {
      return String(Math.round(sqrtN));
    }
    // 尝试简化 √n = a√b
    const simplified = simplifySquareRoot(n);
    if (simplified.coeff === 1) return `\\sqrt{${simplified.radicand}}`;
    return `${simplified.coeff}\\sqrt{${simplified.radicand}}`;
  }

  // 检查简单分数 p/q（q ≤ 12）
  for (let q = 2; q <= 12; q++) {
    const pRaw = v2 * q;
    const p = Math.round(pRaw);
    if (Math.abs(pRaw - p) < 1e-6 && p > 0) {
      // value = √(p/q) = √p / √q
      const numSimp = simplifySquareRoot(p);
      const denSimp = simplifySquareRoot(q);

      if (denSimp.radicand === 1) {
        // 分母为整数
        const den = denSimp.coeff;
        if (numSimp.radicand === 1) {
          // 全是整数
          return formatFraction(numSimp.coeff, den);
        }
        if (numSimp.coeff === 1) {
          return `\\dfrac{\\sqrt{${numSimp.radicand}}}{${den}}`;
        }
        return `\\dfrac{${numSimp.coeff}\\sqrt{${numSimp.radicand}}}{${den}}`;
      }

      // 分母含根号 → 有理化
      // √(p/q) = √(pq) / q
      const rationalized = p * q;
      const rSimp = simplifySquareRoot(rationalized);
      if (rSimp.radicand === 1) {
        return formatFraction(rSimp.coeff, q);
      }
      if (rSimp.coeff === 1) {
        return `\\dfrac{\\sqrt{${rSimp.radicand}}}{${q}}`;
      }
      // gcd simplify coeff/q
      const g = gcd(rSimp.coeff, q);
      const num = rSimp.coeff / g;
      const den = q / g;
      if (den === 1) {
        if (rSimp.radicand === 1) return String(num);
        return num === 1 ? `\\sqrt{${rSimp.radicand}}` : `${num}\\sqrt{${rSimp.radicand}}`;
      }
      if (num === 1) {
        return `\\dfrac{\\sqrt{${rSimp.radicand}}}{${den}}`;
      }
      return `\\dfrac{${num}\\sqrt{${rSimp.radicand}}}{${den}}`;
    }
  }

  return null;
}

function simplifySquareRoot(n: number): { coeff: number; radicand: number } {
  let coeff = 1;
  let radicand = n;
  for (let i = 2; i * i <= radicand; i++) {
    while (radicand % (i * i) === 0) {
      coeff *= i;
      radicand /= i * i;
    }
  }
  return { coeff, radicand };
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function formatFraction(num: number, den: number): string {
  const g = gcd(num, den);
  const n = num / g;
  const d = den / g;
  if (d === 1) return String(n);
  return `\\dfrac{${n}}{${d}}`;
}

function buildDistanceResult(value: number): DistanceResult {
  const exact = matchExactDistance(value);
  const approx = value.toFixed(2);
  return {
    value,
    latex: exact ?? `\\approx ${approx}`,
    approxStr: `≈ ${approx}`,
  };
}

// ─── 点到点距离 ───

export function calculatePointPointDistance(
  p1: Vec3,
  p2: Vec3,
): DistanceResult {
  return buildDistanceResult(vecLength(sub(p1, p2)));
}

// ─── 点到线距离 ───

export function calculatePointLineDistance(
  point: Vec3,
  lineStart: Vec3,
  lineEnd: Vec3,
): DistanceResult {
  const d = sub(lineEnd, lineStart);
  const w = sub(point, lineStart);
  const t = dot(w, d) / dot(d, d);
  const closest = add(lineStart, scale(d, t));
  return buildDistanceResult(vecLength(sub(point, closest)));
}

// ─── 线到面距离 ───

export function calculateLineFaceDistance(
  lineStart: Vec3,
  lineEnd: Vec3,
  facePoints: Vec3[],
): DistanceResult {
  const n = faceNormal(facePoints);
  const lineDir = normalize(sub(lineEnd, lineStart));
  const sinAngle = Math.abs(dot(lineDir, n));

  if (sinAngle > 1e-6) {
    // 线段与面不平行（相交），距离 = 0
    return buildDistanceResult(0);
  }

  // 平行：取线段起点到面的距离
  const p0 = facePoints[0];
  const d = Math.abs(dot(sub(lineStart, p0), n));
  return buildDistanceResult(d);
}

// ─── 点到面距离 ───

export function calculatePointFaceDistance(
  point: Vec3,
  facePoints: Vec3[],
): DistanceResult {
  const n = faceNormal(facePoints);
  const p0 = facePoints[0];
  const d = Math.abs(dot(sub(point, p0), n));
  return buildDistanceResult(d);
}

// ─── 异面直线距离 ───

export function calculateLineLineDistance(
  line1Start: Vec3, line1End: Vec3,
  line2Start: Vec3, line2End: Vec3,
): DistanceResult {
  const d1 = sub(line1End, line1Start);
  const d2 = sub(line2End, line2Start);
  const n = cross(d1, d2);
  const nLen = vecLength(n);

  if (nLen < 1e-10) {
    // 平行线：退化为点到线距离
    const w = sub(line1Start, line2Start);
    const d2n = normalize(d2);
    const proj = scale(d2n, dot(w, d2n));
    const perp = sub(w, proj);
    return buildDistanceResult(vecLength(perp));
  }

  // 异面直线距离 = |dot(P1-P2, n)| / |n|
  const w = sub(line1Start, line2Start);
  const dist = Math.abs(dot(w, n)) / nLen;
  return buildDistanceResult(dist);
}

// ─── 可视化数据 ───

export interface PointPointVisData {
  point1: Vec3;
  point2: Vec3;
  distance: number;
}

export interface PointLineVisData {
  point: Vec3;
  foot: Vec3;
  lineDir: Vec3;
  distance: number;
}

export interface PointFaceVisData {
  point: Vec3;
  foot: Vec3;
  distance: number;
}

export interface LineFaceVisData {
  linePoint: Vec3;
  foot: Vec3;
  faceNormalDir: Vec3;
  distance: number;
}

export interface LineLineVisData {
  point1: Vec3;
  point2: Vec3;
  distance: number;
}

/** 点到点可视化 */
export function getPointPointVisData(p1: Vec3, p2: Vec3): PointPointVisData {
  return { point1: p1, point2: p2, distance: vecLength(sub(p1, p2)) };
}

/** 点到线的垂足 */
export function getPointLineVisData(
  point: Vec3,
  lineStart: Vec3,
  lineEnd: Vec3,
): PointLineVisData {
  const d = sub(lineEnd, lineStart);
  const w = sub(point, lineStart);
  const t = dot(w, d) / dot(d, d);
  const foot = add(lineStart, scale(d, t));
  const lineDir = normalize(d);
  return { point, foot, lineDir, distance: vecLength(sub(point, foot)) };
}

/** 线到面可视化（取线段中点到面的垂足） */
export function getLineFaceVisData(
  lineStart: Vec3,
  lineEnd: Vec3,
  facePoints: Vec3[],
): LineFaceVisData {
  const n = faceNormal(facePoints);
  const mid: Vec3 = [(lineStart[0] + lineEnd[0]) / 2, (lineStart[1] + lineEnd[1]) / 2, (lineStart[2] + lineEnd[2]) / 2];
  const p0 = facePoints[0];
  const d = dot(sub(mid, p0), n);
  const foot: Vec3 = sub(mid, scale(n, d));
  return { linePoint: mid, foot, faceNormalDir: n, distance: Math.abs(d) };
}

/** 点到面的垂足 */
export function getPointFaceVisData(
  point: Vec3,
  facePoints: Vec3[],
): PointFaceVisData {
  const n = faceNormal(facePoints);
  const p0 = facePoints[0];
  const d = dot(sub(point, p0), n);
  const foot: Vec3 = sub(point, scale(n, d));
  return { point, foot, distance: Math.abs(d) };
}

/** 异面直线的公垂线段两端点 */
export function getLineLineVisData(
  line1Start: Vec3, line1End: Vec3,
  line2Start: Vec3, line2End: Vec3,
): LineLineVisData {
  const d1 = sub(line1End, line1Start);
  const d2 = sub(line2End, line2Start);
  const n = cross(d1, d2);
  const nLen = vecLength(n);

  if (nLen < 1e-10) {
    // 平行线：取 line1Start 到 line2 的垂足
    const w = sub(line1Start, line2Start);
    const d2n = normalize(d2);
    const t = dot(w, d2n);
    const foot = add(line2Start, scale(d2n, t));
    return { point1: line1Start, point2: foot, distance: vecLength(sub(line1Start, foot)) };
  }

  // 求两直线最近点参数 t1, t2
  const w = sub(line1Start, line2Start);
  const a = dot(d1, d1);
  const b = dot(d1, d2);
  const c = dot(d2, d2);
  const dw1 = dot(d1, w);
  const dw2 = dot(d2, w);
  const denom = a * c - b * b;

  const t1 = (b * dw2 - c * dw1) / denom;
  const t2 = (a * dw2 - b * dw1) / denom;

  const point1: Vec3 = add(line1Start, scale(d1, t1));
  const point2: Vec3 = add(line2Start, scale(d2, t2));

  return { point1, point2, distance: vecLength(sub(point1, point2)) };
}
