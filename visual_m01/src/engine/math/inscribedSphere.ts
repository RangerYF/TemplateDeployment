import type { GeometryType } from '@/types/geometry';
import type { Vec3 } from '../types';
import type { InscribedSphere } from './types';
import { calculate } from './index';
import { num, frac, sqrtFrac } from './symbolic';

const SUPPORTED_TYPES: Set<GeometryType> = new Set([
  'cube',
  'cuboid',
  'regularTetrahedron',
  'cornerTetrahedron',
  'isoscelesTetrahedron',
  'orthogonalTetrahedron',
  'cone',
  'cylinder',
  'truncatedCone',
  'pyramid',
  'prism',
  'frustum',
]);

export function isInscribedSphereSupported(type: GeometryType): boolean {
  return SUPPORTED_TYPES.has(type);
}

/** 返回当前参数不满足内切球条件时的提示文案，满足则返回 null */
export function getInSphereConditionHint(
  type: GeometryType,
  params: Record<string, number>,
): string | null {
  if (type === 'cuboid') {
    const { length: l, width: w, height: h } = params;
    if (!isClose(l, w) || !isClose(w, h))
      return `需满足长=宽=高（当前 ${l}×${w}×${h}）`;
  }
  if (type === 'cylinder') {
    const r = params.radius;
    const h = params.height;
    if (!isClose(r, h / 2))
      return `需满足 h = 2R（当前 h=${h}, 2R=${(2 * r).toFixed(2)}）`;
  }
  if (type === 'prism') {
    const n = params.sides;
    const a = params.sideLength;
    const h = params.height;
    const apothem = a / (2 * Math.tan(Math.PI / n));
    if (!isClose(apothem, h / 2))
      return `需满足 h = 2×底面内切圆半径（当前 h=${h}, 2r=${(2 * apothem).toFixed(2)}）`;
  }
  if (type === 'truncatedCone') {
    const R = params.bottomRadius;
    const r = params.topRadius;
    const h = params.height;
    const requiredH = 2 * Math.sqrt(R * r);
    if (!isClose(h, requiredH))
      return `需满足 h = 2√(Rr)（当前 h=${h}, 2√(Rr)=${requiredH.toFixed(2)}）`;
  }
  if (type === 'frustum') {
    const n = params.sides;
    const a1 = params.topSideLength;
    const a2 = params.bottomSideLength;
    const h = params.height;
    const apTop = a1 / (2 * Math.tan(Math.PI / n));
    const apBot = a2 / (2 * Math.tan(Math.PI / n));
    const requiredH = 2 * Math.sqrt(apTop * apBot);
    if (!isClose(h, requiredH))
      return `需满足 h = 2√(r₁r₂)（当前 h=${h}, 2√(r₁r₂)=${requiredH.toFixed(2)}）`;
  }
  return null;
}

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01 * Math.max(Math.abs(a), Math.abs(b), 1);
}

export function computeInscribedSphere(
  type: GeometryType,
  params: Record<string, number>,
): InscribedSphere | null {
  if (!SUPPORTED_TYPES.has(type)) return null;

  if (type === 'cube') return cubeInSphere(params);
  if (type === 'cuboid') return cuboidInSphere(params);
  if (type === 'regularTetrahedron') return regularTetrahedronInSphere(params);
  if (type === 'cone') return coneInSphere(params);
  if (type === 'cylinder') return cylinderInSphere(params);
  if (type === 'prism') return prismInSphere(params);
  if (type === 'truncatedCone') return truncatedConeInSphere(params);
  if (type === 'frustum') return frustumInSphere(params);

  return genericInSphere(type, params);
}

function cubeInSphere(params: Record<string, number>): InscribedSphere {
  const a = params.sideLength;
  const radius = a / 2;
  const center: Vec3 = [0, a / 2, 0];
  const sym = frac(a, 2);
  return { center, radius, radiusLatex: sym.latex };
}

function cuboidInSphere(params: Record<string, number>): InscribedSphere | null {
  const { length: l, width: w, height: h } = params;
  if (!isClose(l, w) || !isClose(w, h)) return null;
  const radius = l / 2;
  const center: Vec3 = [0, h / 2, 0];
  const radiusLatex = frac(l, 2).latex;
  return { center, radius, radiusLatex };
}

function regularTetrahedronInSphere(params: Record<string, number>): InscribedSphere {
  const a = params.sideLength;
  // r = (√6 / 12) · a
  const radius = (Math.sqrt(6) / 12) * a;
  // 球心距底面 r，即 y = r
  const h = (Math.sqrt(6) / 3) * a;
  const centerY = h / 4; // h/4 = (√6/12)·a = r
  const center: Vec3 = [0, centerY, 0];

  let radiusLatex: string;
  if (Number.isInteger(a) && a % 12 === 0) {
    radiusLatex = `${a / 12}\\sqrt{6}`;
  } else if (Number.isInteger(a) && a % 6 === 0) {
    radiusLatex = `\\dfrac{${a / 6}\\sqrt{6}}{2}`;
  } else {
    const sym = sqrtFrac(6 * a * a, 12);
    radiusLatex = sym.latex;
  }

  return { center, radius, radiusLatex };
}

function coneInSphere(params: Record<string, number>): InscribedSphere {
  const r = params.radius;
  const h = params.height;
  // l = 母线长 = √(r² + h²)
  const l = Math.sqrt(r * r + h * h);
  // r_in = r·h / (r + l)
  const radius = (r * h) / (r + l);
  // 球心在轴上，距底面 r_in
  const center: Vec3 = [0, radius, 0];

  const radiusLatex = fmtNum(radius);

  return { center, radius, radiusLatex };
}

function cylinderInSphere(params: Record<string, number>): InscribedSphere | null {
  const r = params.radius;
  const h = params.height;
  if (!isClose(r, h / 2)) return null;
  const radius = r;
  const center: Vec3 = [0, h / 2, 0];
  const radiusLatex = num(radius).latex;
  return { center, radius, radiusLatex };
}

function prismInSphere(params: Record<string, number>): InscribedSphere | null {
  const n = params.sides;
  const a = params.sideLength;
  const h = params.height;
  const apothem = a / (2 * Math.tan(Math.PI / n));
  if (!isClose(apothem, h / 2)) return null;
  const radius = apothem;
  const center: Vec3 = [0, h / 2, 0];
  const radiusLatex = fmtNum(radius);
  return { center, radius, radiusLatex };
}

function truncatedConeInSphere(params: Record<string, number>): InscribedSphere | null {
  const R = params.bottomRadius;
  const r = params.topRadius;
  const h = params.height;
  const requiredH = 2 * Math.sqrt(R * r);
  if (!isClose(h, requiredH)) return null;
  const radius = h / 2;
  const center: Vec3 = [0, h / 2, 0];
  const radiusLatex = fmtNum(radius);
  return { center, radius, radiusLatex };
}

function frustumInSphere(params: Record<string, number>): InscribedSphere | null {
  const n = params.sides;
  const a1 = params.topSideLength;
  const a2 = params.bottomSideLength;
  const h = params.height;
  const apTop = a1 / (2 * Math.tan(Math.PI / n));
  const apBot = a2 / (2 * Math.tan(Math.PI / n));
  const requiredH = 2 * Math.sqrt(apTop * apBot);
  if (!isClose(h, requiredH)) return null;
  const radius = h / 2;
  const center: Vec3 = [0, h / 2, 0];
  const radiusLatex = fmtNum(radius);
  return { center, radius, radiusLatex };
}

/**
 * 通用公式 r = 3V/S，适用于四面体、正棱锥
 */
function genericInSphere(
  type: GeometryType,
  params: Record<string, number>,
): InscribedSphere | null {
  const result = calculate(type, params);
  if (!result) return null;

  const V = result.volume.value.numeric;
  const S = result.surfaceArea.value.numeric;
  if (S <= 0 || V <= 0) return null;

  const radius = (3 * V) / S;

  const center = computeGenericCenter(type, params, radius);

  const radiusLatex = fmtNum(radius);

  return { center, radius, radiusLatex };
}

function computeGenericCenter(
  type: GeometryType,
  params: Record<string, number>,
  radius: number,
): Vec3 {
  if (type === 'pyramid') {
    // 正棱锥：球心在轴线上，距底面 r
    return [0, radius, 0];
  }
  if (type === 'cornerTetrahedron') {
    // 墙角四面体：原点在直角顶点，球心到三个坐标面距离均为 r
    return [radius, radius, radius];
  }
  if (type === 'isoscelesTetrahedron') {
    // 等腰四面体：内切球球心 = 体心（长方体中心）
    const p = params.edgeP;
    const q = params.edgeQ;
    const r = params.edgeR;
    const a = Math.sqrt(Math.max(0, (q * q + r * r - p * p) / 2));
    const b = Math.sqrt(Math.max(0, (p * p + r * r - q * q) / 2));
    const c = Math.sqrt(Math.max(0, (p * p + q * q - r * r) / 2));
    return [a / 2, b / 2, c / 2];
  }
  if (type === 'orthogonalTetrahedron') {
    // 对棱垂直四面体：球心在对称轴上
    const ab = params.edgeAB;
    const cd = params.edgeCD;
    const d = Math.sqrt(ab * ab + cd * cd) / 2;
    return [0, d / 2, 0];
  }
  // 默认：几何中心
  return [0, radius, 0];
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const r4 = Math.round(n * 10000) / 10000;
  if (Number.isInteger(r4)) return String(r4);
  return String(r4);
}
