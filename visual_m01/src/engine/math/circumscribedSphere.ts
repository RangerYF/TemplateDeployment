import type { GeometryType } from '@/types/geometry';
import type { Vec3 } from '../types';
import type { CircumscribedSphere } from './types';
import { sqrtFrac, sqrt } from './symbolic';

/**
 * 计算几何体外接球
 * 支持：cuboid, cube, pyramid, cylinder, cone
 * sphere 返回 null（球本身即外接球）
 */
export function computeCircumscribedSphere(
  type: GeometryType,
  params: Record<string, number>,
): CircumscribedSphere | null {
  if (type === 'cuboid') {
    return cuboidCircumSphere(params);
  }
  if (type === 'cube') {
    const a = params.sideLength;
    return cuboidCircumSphere({ length: a, width: a, height: a });
  }
  if (type === 'pyramid') {
    return pyramidCircumSphere(params);
  }
  if (type === 'cylinder') {
    return cylinderCircumSphere(params);
  }
  if (type === 'cone') {
    return coneCircumSphere(params);
  }
  if (type === 'regularTetrahedron') {
    return regularTetrahedronCircumSphere(params);
  }
  if (type === 'cornerTetrahedron') {
    return cornerTetrahedronCircumSphere(params);
  }
  if (type === 'prism') {
    return prismCircumSphere(params);
  }
  if (type === 'truncatedCone') {
    return truncatedConeCircumSphere(params);
  }
  if (type === 'frustum') {
    return frustumCircumSphere(params);
  }
  if (type === 'isoscelesTetrahedron') {
    return isoscelesTetrahedronCircumSphere(params);
  }
  if (type === 'orthogonalTetrahedron') {
    return orthogonalTetrahedronCircumSphere(params);
  }
  // sphere: 球本身即外接球，无需额外渲染
  return null;
}

function cuboidCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const l = params.length;
  const w = params.width;
  const h = params.height;

  const diagSquared = l * l + w * w + h * h;
  const radius = Math.sqrt(diagSquared) / 2;

  // 球心：底面中心在 XZ 原点，Y 方向在 h/2
  const center: Vec3 = [0, h / 2, 0];

  // 精确值 LaTeX
  const radiusSymbolic = sqrtFrac(diagSquared, 2);

  return {
    center,
    radius,
    radiusLatex: radiusSymbolic.latex,
  };
}

/**
 * 正 n 棱锥外接球
 * 底面外接圆半径 R_底 = a / (2sin(π/n))
 * 球心在轴上，距底面高度 y = (h² - R_底²) / (2h)
 * R_球 = (h² + R_底²) / (2h)
 */
function pyramidCircumSphere(params: Record<string, number>): CircumscribedSphere | null {
  const n = params.sides;
  const a = params.sideLength;
  const h = params.height;

  const sinPiN = Math.sin(Math.PI / n);
  const Rbase = a / (2 * sinPiN);
  const Rbase2 = Rbase * Rbase;
  const h2 = h * h;

  const radius = (h2 + Rbase2) / (2 * h);
  const centerY = (h2 - Rbase2) / (2 * h);

  // 如果球心在底面以下（centerY < 0），外接球仍然存在，球心在轴的延长线上
  const center: Vec3 = [0, centerY, 0];

  // LaTeX：R = (h² + R_底²) / (2h)
  const numerator = h2 + Rbase2;
  const denominator = 2 * h;
  const radiusLatex = `\\dfrac{${fmt(numerator)}}{${fmt(denominator)}}`;

  return {
    center,
    radius,
    radiusLatex,
  };
}

/**
 * 圆柱外接球
 * R_球 = √(r² + h²/4)
 * 球心 = (0, h/2, 0)
 */
function cylinderCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const r = params.radius;
  const h = params.height;

  const r2 = r * r;
  const h2 = h * h;
  const radiusSquared = r2 + h2 / 4;
  const radius = Math.sqrt(radiusSquared);

  const center: Vec3 = [0, h / 2, 0];

  const radiusSymbolic = sqrt(radiusSquared);

  return {
    center,
    radius,
    radiusLatex: radiusSymbolic.latex,
  };
}

/**
 * 圆锥外接球
 * 球心在轴上，y = (h² - r²) / (2h)
 * R_球 = (h² + r²) / (2h)
 */
function coneCircumSphere(params: Record<string, number>): CircumscribedSphere | null {
  const r = params.radius;
  const h = params.height;

  const r2 = r * r;
  const h2 = h * h;

  const radius = (h2 + r2) / (2 * h);
  const centerY = (h2 - r2) / (2 * h);

  const center: Vec3 = [0, centerY, 0];

  const numerator = h2 + r2;
  const denominator = 2 * h;
  const radiusLatex = `\\dfrac{${fmt(numerator)}}{${fmt(denominator)}}`;

  return {
    center,
    radius,
    radiusLatex,
  };
}

/**
 * 正四面体外接球
 * R = (√6/4)·a
 * 球心在重心位置，距底面 h/4 = (√6/12)·a
 */
function regularTetrahedronCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const a = params.sideLength;

  // h = (√6/3)·a
  const h = (Math.sqrt(6) / 3) * a;

  // R = (√6/4)·a
  const radius = (Math.sqrt(6) / 4) * a;

  // 球心在 (0, h/4, 0)，即距底面 h/4
  const centerY = h / 4;
  const center: Vec3 = [0, centerY, 0];

  // LaTeX：R = (√6/4)·a
  let radiusLatex: string;
  if (Number.isInteger(a) && a % 4 === 0) {
    radiusLatex = `${a / 4}\\sqrt{6}`;
  } else if (Number.isInteger(a) && a % 2 === 0) {
    radiusLatex = `\\dfrac{${a / 2}\\sqrt{6}}{2}`;
  } else {
    radiusLatex = `\\dfrac{${fmt(a)}\\sqrt{6}}{4}`;
  }

  return { center, radius, radiusLatex };
}

/**
 * 墙角四面体外接球
 * R = √(a² + b² + c²) / 2
 * 球心 = 斜面中点 = (a/2, c/2, b/2)
 */
/**
 * 正棱柱外接球
 * R_底 = a / (2sin(π/n))
 * R = √(R_底² + h²/4)
 * 球心 = (0, h/2, 0)
 */
function prismCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const n = params.sides;
  const a = params.sideLength;
  const h = params.height;

  const Rbase = a / (2 * Math.sin(Math.PI / n));
  const Rbase2 = Rbase * Rbase;
  const h2over4 = (h * h) / 4;
  const radiusSquared = Rbase2 + h2over4;
  const radius = Math.sqrt(radiusSquared);

  const center: Vec3 = [0, h / 2, 0];

  const radiusSymbolic = sqrt(radiusSquared);

  return {
    center,
    radius,
    radiusLatex: radiusSymbolic.latex,
  };
}

function cornerTetrahedronCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const a = params.edgeA;
  const b = params.edgeB;
  const c = params.edgeC;

  const diagSquared = a * a + b * b + c * c;
  const radius = Math.sqrt(diagSquared) / 2;

  // 球心在斜面对角线中点 = (a/2, c/2, b/2)
  const center: Vec3 = [a / 2, c / 2, b / 2];

  const radiusSymbolic = sqrtFrac(diagSquared, 2);

  return {
    center,
    radius,
    radiusLatex: radiusSymbolic.latex,
  };
}

/**
 * 圆台外接球
 * 球心在轴上 y = (h² + r₂² - r₁²) / (2h)
 * R = √(r₂² + y²)
 */
function truncatedConeCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const r1 = params.topRadius;
  const r2 = params.bottomRadius;
  const h = params.height;

  const r1_2 = r1 * r1;
  const r2_2 = r2 * r2;
  const h2 = h * h;

  const centerY = (h2 + r2_2 - r1_2) / (2 * h);
  const radiusSquared = r2_2 + centerY * centerY;
  const radius = Math.sqrt(radiusSquared);
  const center: Vec3 = [0, centerY, 0];

  const radiusSymbolic = sqrt(radiusSquared);

  return { center, radius, radiusLatex: radiusSymbolic.latex };
}

/**
 * 棱台外接球
 * R_底 = a₂ / (2sin(π/n))
 * 球心在轴上 y = (h² + R₂² - R₁²) / (2h)
 * R_球 = √(R₂² + y²)
 */
function frustumCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const n = Math.max(3, Math.min(8, Math.round(params.sides)));
  const a2 = params.bottomSideLength;
  const a1 = params.topSideLength;
  const h = params.height;

  const sinPiN = Math.sin(Math.PI / n);
  const R2 = a2 / (2 * sinPiN);
  const R1 = a1 / (2 * sinPiN);

  const R1_2 = R1 * R1;
  const R2_2 = R2 * R2;
  const h2 = h * h;

  const centerY = (h2 + R2_2 - R1_2) / (2 * h);
  const radiusSquared = R2_2 + centerY * centerY;
  const radius = Math.sqrt(radiusSquared);
  const center: Vec3 = [0, centerY, 0];

  const radiusSymbolic = sqrt(radiusSquared);

  return { center, radius, radiusLatex: radiusSymbolic.latex };
}

/**
 * 对棱相等四面体外接球
 * 内接于长方体 a×b×c，外接球 = 长方体的外接球
 * R = √(a² + b² + c²) / 2
 * 球心 = 长方体中心 = (a/2, b/2, c/2)
 */
function isoscelesTetrahedronCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const p = params.edgeP;
  const q = params.edgeQ;
  const r = params.edgeR;

  const a2 = (q * q + r * r - p * p) / 2;
  const b2 = (p * p + r * r - q * q) / 2;
  const c2 = (p * p + q * q - r * r) / 2;

  const a = Math.sqrt(Math.max(0, a2));
  const b = Math.sqrt(Math.max(0, b2));
  const c = Math.sqrt(Math.max(0, c2));

  const diagSquared = a * a + b * b + c * c;
  const radius = Math.sqrt(diagSquared) / 2;
  const center: Vec3 = [a / 2, b / 2, c / 2];

  const radiusSymbolic = sqrtFrac(diagSquared, 2);

  return { center, radius, radiusLatex: radiusSymbolic.latex };
}

/**
 * 对棱垂直四面体外接球
 * A=(-AB/2, d, 0), B=(AB/2, d, 0), C=(0, 0, -CD/2), D=(0, 0, CD/2)
 * d = √(AB² + CD²) / 2
 * 球心 = 重心 = (0, d/2, 0)
 * R = 到任一顶点的距离
 */
function orthogonalTetrahedronCircumSphere(params: Record<string, number>): CircumscribedSphere {
  const ab = params.edgeAB;
  const cd = params.edgeCD;

  const ab2 = ab * ab;
  const cd2 = cd * cd;
  const d = Math.sqrt(ab2 + cd2) / 2;

  // 球心需要通过四个顶点的外接球计算
  // A=(-ab/2, d, 0), 到球心 (0, y, 0) 的距离²:
  // ab²/4 + (d-y)² = cd²/4 + y²
  // ab²/4 + d² - 2dy + y² = cd²/4 + y²
  // ab²/4 + d² - 2dy = cd²/4
  // 2dy = ab²/4 + d² - cd²/4
  // y = (ab²/4 + d² - cd²/4) / (2d)
  const centerY = (ab2 / 4 + d * d - cd2 / 4) / (2 * d);
  const radiusSquared = ab2 / 4 + (d - centerY) * (d - centerY);
  const radius = Math.sqrt(radiusSquared);
  const center: Vec3 = [0, centerY, 0];

  const radiusSymbolic = sqrt(radiusSquared);

  return { center, radius, radiusLatex: radiusSymbolic.latex };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000);
}
