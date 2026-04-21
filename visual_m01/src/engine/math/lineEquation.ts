import type { Vec3 } from '@/engine/types';

export interface LineEquation {
  /** 参数方程 LaTeX */
  parametric: string;
  /** 对称式 LaTeX */
  symmetric: string;
  /** 方向向量 LaTeX */
  directionVector: string;
  /** 经过的点坐标 LaTeX */
  passingPoint: string;
}

/**
 * 计算直线方程（参数方程 + 对称式）
 * @param startCoord 起点在坐标系下的坐标
 * @param endCoord 终点在坐标系下的坐标
 */
export function calculateLineEquation(startCoord: Vec3, endCoord: Vec3): LineEquation {
  // 方向向量
  const dx = endCoord[0] - startCoord[0];
  const dy = endCoord[1] - startCoord[1];
  const dz = endCoord[2] - startCoord[2];

  // 化简方向向量为最简整数比
  const [a, b, c] = simplifyDirection(dx, dy, dz);

  // 经过的点（使用起点）
  const [x0, y0, z0] = startCoord;

  const fmtPt = (n: number) => fmtCoord(n);

  // 方向向量 LaTeX
  const directionVector = `(${fmtPt(a)},\\, ${fmtPt(b)},\\, ${fmtPt(c)})`;

  // 经过的点 LaTeX
  const passingPoint = `(${fmtPt(x0)},\\, ${fmtPt(y0)},\\, ${fmtPt(z0)})`;

  // 参数方程
  const parametric = buildParametric(x0, y0, z0, a, b, c);

  // 对称式
  const symmetric = buildSymmetric(x0, y0, z0, a, b, c);

  return { parametric, symmetric, directionVector, passingPoint };
}

/** 构建参数方程 LaTeX */
function buildParametric(
  x0: number, y0: number, z0: number,
  a: number, b: number, c: number,
): string {
  const lines = [
    `x = ${fmtParamLine(x0, a)}`,
    `y = ${fmtParamLine(y0, b)}`,
    `z = ${fmtParamLine(z0, c)}`,
  ];
  return `\\begin{cases} ${lines.join(' \\\\ ')} \\end{cases}`;
}

/** 格式化参数方程的单行：x0 + a*t */
function fmtParamLine(p0: number, d: number): string {
  const p0Str = fmtCoord(p0);
  if (isZero(d)) return p0Str;
  const dAbs = Math.abs(d);
  const sign = d > 0 ? '+' : '-';
  const dStr = dAbs === 1 ? 't' : `${fmtCoord(dAbs)}t`;
  if (isZero(p0)) return d < 0 ? `-${dAbs === 1 ? 't' : fmtCoord(dAbs) + 't'}` : dStr;
  return `${p0Str} ${sign} ${dStr}`;
}

/** 构建对称式 LaTeX */
function buildSymmetric(
  x0: number, y0: number, z0: number,
  a: number, b: number, c: number,
): string {
  const coords = [
    { var: 'x', p0: x0, d: a },
    { var: 'y', p0: y0, d: b },
    { var: 'z', p0: z0, d: c },
  ];

  const fractions: string[] = [];
  const constants: string[] = [];

  for (const { var: v, p0, d } of coords) {
    if (isZero(d)) {
      // 方向分量为0：该坐标为常数
      constants.push(`${v} = ${fmtCoord(p0)}`);
    } else {
      const numerator = isZero(p0) ? v : `${v} - ${fmtCoord(p0)}`;
      // 分母为1时简化显示
      if (Math.abs(d) === 1) {
        fractions.push(d > 0 ? numerator : `-(${numerator})`);
      } else {
        fractions.push(`\\frac{${numerator}}{${fmtCoord(d)}}`);
      }
    }
  }

  let result = '';
  if (fractions.length > 0) {
    result = fractions.join(' = ');
  }
  if (constants.length > 0) {
    const constStr = constants.join(',\\; ');
    result = result ? `${result},\\quad ${constStr}` : constStr;
  }

  return result;
}

/**
 * 将方向向量化简为最简整数比
 * 如 (2, 4, 6) → (1, 2, 3)
 * 如 (0.5, 1, 1.5) → (1, 2, 3)
 */
function simplifyDirection(dx: number, dy: number, dz: number): [number, number, number] {
  // 全零特殊处理（退化情况）
  if (isZero(dx) && isZero(dy) && isZero(dz)) return [0, 0, 0];

  // 尝试转为整数比：乘以一个公共因子
  const values = [dx, dy, dz];

  // 先尝试直接当整数处理
  const scale = findIntegerScale(values);
  if (scale !== null) {
    const ints = values.map((v) => Math.round(v * scale));
    const g = gcd3(Math.abs(ints[0]), Math.abs(ints[1]), Math.abs(ints[2]));
    const result: [number, number, number] = [ints[0] / g, ints[1] / g, ints[2] / g];
    // 确保首个非零分量为正
    const firstNonZero = result.find((v) => v !== 0);
    if (firstNonZero && firstNonZero < 0) {
      return [-result[0], -result[1], -result[2]];
    }
    return result;
  }

  // 若无法整数化，直接用浮点数除以最大绝对值归一化
  const maxAbs = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
  return [dx / maxAbs, dy / maxAbs, dz / maxAbs];
}

/** 尝试找到一个缩放因子使所有值变为（近似）整数 */
function findIntegerScale(values: number[]): number | null {
  const nonZero = values.filter((v) => !isZero(v));
  if (nonZero.length === 0) return 1;

  // 尝试分母 1~12
  for (let den = 1; den <= 12; den++) {
    const scaled = values.map((v) => v * den);
    if (scaled.every((s) => Math.abs(s - Math.round(s)) < 1e-6)) {
      return den;
    }
  }
  return null;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function gcd3(a: number, b: number, c: number): number {
  return gcd(gcd(a, b), c);
}

function isZero(n: number): boolean {
  return Math.abs(n) < 1e-9;
}

function fmtCoord(n: number): string {
  if (isZero(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 10) / 10;
  if (Math.abs(n - rounded) < 1e-6 && Number.isInteger(rounded * 10)) {
    return rounded.toFixed(1);
  }
  return n.toFixed(1);
}
