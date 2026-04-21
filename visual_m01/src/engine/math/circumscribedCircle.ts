import type { Vec3 } from '../types';
import type { CircumscribedCircle } from './types';

/**
 * 三点定圆算法（3D 空间）
 * 给定不共线的 3 点 A, B, C，求其外接圆
 */
export function computeCircumscribedCircle(
  a: Vec3,
  b: Vec3,
  c: Vec3,
): CircumscribedCircle | null {
  // 向量
  const ab = sub(b, a);
  const ac = sub(c, a);

  // 平面法向量
  const normal = cross(ab, ac);
  const normalLen = length(normal);
  if (normalLen < 1e-10) return null; // 共线

  const n = scale(normal, 1 / normalLen);

  // 在平面内求外接圆圆心
  // 使用公式：圆心 = a + s*ab + t*ac
  // 其中 s 和 t 由两条中垂线联立求得
  const abLenSq = dot(ab, ab);
  const acLenSq = dot(ac, ac);
  const abDotAc = dot(ab, ac);

  const denom = 2 * (abLenSq * acLenSq - abDotAc * abDotAc);
  if (Math.abs(denom) < 1e-10) return null;

  const s = acLenSq * (abLenSq - abDotAc) / denom;
  const t = abLenSq * (acLenSq - abDotAc) / denom;

  const center: Vec3 = [
    a[0] + s * ab[0] + t * ac[0],
    a[1] + s * ab[1] + t * ac[1],
    a[2] + s * ab[2] + t * ac[2],
  ];

  const radius = length(sub(center, a));

  // 半径 LaTeX（近似值）
  const radiusLatex = Number.isInteger(radius)
    ? String(radius)
    : radius.toFixed(2);

  return { center, radius, radiusLatex, normal: n };
}

// ─── 向量工具 ───

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}
