import type { Vec2D, Vec3D } from '../editor/entities/types';

// ─── 2D 向量运算 ───

export function add2D(a: Vec2D, b: Vec2D): Vec2D {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub2D(a: Vec2D, b: Vec2D): Vec2D {
  return [a[0] - b[0], a[1] - b[1]];
}

export function scale2D(a: Vec2D, k: number): Vec2D {
  return [a[0] * k, a[1] * k];
}

export function dot2D(a: Vec2D, b: Vec2D): number {
  return a[0] * b[0] + a[1] * b[1];
}

export function mag2D(a: Vec2D): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}

/** 两向量夹角（弧度），返回 [0, π] */
export function angle2D(a: Vec2D, b: Vec2D): number {
  const magA = mag2D(a);
  const magB = mag2D(b);
  if (magA < 1e-10 || magB < 1e-10) return 0;
  const cos = Math.max(-1, Math.min(1, dot2D(a, b) / (magA * magB)));
  return Math.acos(cos);
}

/** 向量 a 在向量 b 方向上的投影长度（带符号） */
export function projection2D(a: Vec2D, b: Vec2D): number {
  const magB = mag2D(b);
  if (magB < 1e-10) return 0;
  return dot2D(a, b) / magB;
}

/** 向量 a 在向量 b 方向上的投影向量 */
export function projectVec2D(a: Vec2D, b: Vec2D): Vec2D {
  const magB2 = dot2D(b, b);
  if (magB2 < 1e-10) return [0, 0];
  const t = dot2D(a, b) / magB2;
  return [b[0] * t, b[1] * t];
}

/** 2D 叉积（标量，表示有向面积） */
export function cross2D(a: Vec2D, b: Vec2D): number {
  return a[0] * b[1] - a[1] * b[0];
}

/** 共线判断 */
export function isCollinear2D(a: Vec2D, b: Vec2D): boolean {
  return Math.abs(cross2D(a, b)) < 1e-10;
}

/** 垂直判断 */
export function isPerpendicular2D(a: Vec2D, b: Vec2D): boolean {
  return Math.abs(dot2D(a, b)) < 1e-10;
}

/**
 * 基底分解：将 target 分解为 c1*e1 + c2*e2
 * 返回 [c1, c2] 或 null（若 e1, e2 共线）
 */
export function decomposeVector(target: Vec2D, e1: Vec2D, e2: Vec2D): [number, number] | null {
  // 求解线性方程组：[e1 | e2] * [c1, c2]^T = target
  const det = e1[0] * e2[1] - e1[1] * e2[0];
  if (Math.abs(det) < 1e-10) return null; // e1, e2 共线，无法分解
  const c1 = (target[0] * e2[1] - target[1] * e2[0]) / det;
  const c2 = (e1[0] * target[1] - e1[1] * target[0]) / det;
  return [c1, c2];
}

// ─── 3D 向量运算 ───

export function add3D(a: Vec3D, b: Vec3D): Vec3D {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub3D(a: Vec3D, b: Vec3D): Vec3D {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale3D(a: Vec3D, k: number): Vec3D {
  return [a[0] * k, a[1] * k, a[2] * k];
}

export function dot3D(a: Vec3D, b: Vec3D): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function mag3D(a: Vec3D): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

/** 叉积 a × b */
export function cross3D(a: Vec3D, b: Vec3D): Vec3D {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** 两向量夹角（弧度），返回 [0, π] */
export function angle3D(a: Vec3D, b: Vec3D): number {
  const magA = mag3D(a);
  const magB = mag3D(b);
  if (magA < 1e-10 || magB < 1e-10) return 0;
  const cos = Math.max(-1, Math.min(1, dot3D(a, b) / (magA * magB)));
  return Math.acos(cos);
}

// ─── 表达式解析器（支持 √() 嵌套） ───

interface ExprCursor { pos: number }

function parseExprAdd(s: string, c: ExprCursor): number {
  let result = parseExprMul(s, c);
  while (c.pos < s.length) {
    const ch = s[c.pos];
    if (ch === '+') { c.pos++; result += parseExprMul(s, c); }
    else if (ch === '-') { c.pos++; result -= parseExprMul(s, c); }
    else break;
  }
  return result;
}

function parseExprMul(s: string, c: ExprCursor): number {
  let result = parseExprUnary(s, c);
  while (c.pos < s.length) {
    const ch = s[c.pos];
    if (ch === '*' || ch === '×') { c.pos++; result *= parseExprUnary(s, c); }
    else if (ch === '/' || ch === '÷') { c.pos++; const d = parseExprUnary(s, c); result /= d; }
    else break;
  }
  return result;
}

function parseExprUnary(s: string, c: ExprCursor): number {
  if (c.pos < s.length && s[c.pos] === '-') { c.pos++; return -parseExprAtom(s, c); }
  if (c.pos < s.length && s[c.pos] === '+') { c.pos++; }
  return parseExprAtom(s, c);
}

function parseExprAtom(s: string, c: ExprCursor): number {
  if (c.pos < s.length && s[c.pos] === '√') {
    c.pos++;
    if (c.pos < s.length && s[c.pos] === '(') {
      c.pos++;
      const inner = parseExprAdd(s, c);
      if (c.pos < s.length && s[c.pos] === ')') c.pos++;
      return Math.sqrt(inner);
    }
    const num = parseExprNumber(s, c);
    return Math.sqrt(num);
  }
  if (c.pos < s.length && s[c.pos] === '(') {
    c.pos++;
    const inner = parseExprAdd(s, c);
    if (c.pos < s.length && s[c.pos] === ')') c.pos++;
    return inner;
  }
  return parseExprNumber(s, c);
}

function parseExprNumber(s: string, c: ExprCursor): number {
  const start = c.pos;
  while (c.pos < s.length && (s[c.pos] >= '0' && s[c.pos] <= '9' || s[c.pos] === '.')) c.pos++;
  if (c.pos === start) throw new Error('expected number');
  return parseFloat(s.slice(start, c.pos));
}

/** 将含 √() 的表达式求值为数字，失败返回 NaN */
export function evalSqrtExpr(expr: string): number {
  const s = expr.replace(/\s/g, '');
  if (s === '') return NaN;
  try { return parseExprAdd(s, { pos: 0 }); } catch { return NaN; }
}

/** 格式化数字，最多保留 decimalPlaces 位小数 */
export function fmt(n: number, decimalPlaces = 2): string {
  if (Math.abs(n) < 1e-10) return '0';
  const rounded = Math.round(n * 10 ** decimalPlaces) / 10 ** decimalPlaces;
  // 去掉尾随零
  return String(rounded);
}

/** 将角度从弧度转换为度数 */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 格式化向量为字符串 */
export function fmtVec2D(v: Vec2D, dp = 2): string {
  return `(${fmt(v[0], dp)}, ${fmt(v[1], dp)})`;
}

export function fmtVec3D(v: Vec3D, dp = 2): string {
  return `(${fmt(v[0], dp)}, ${fmt(v[1], dp)}, ${fmt(v[2], dp)})`;
}

// ─── 根号精确显示（卡西欧模式）───

/** 尝试检测的无平方因子根号值 */
const SURD_BASES = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 23, 26, 29, 30];
/** 尝试的分母 */
const DENOMS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
/** 尝试的 a（整数部分）范围 */
const A_RANGE = 20;
const TOL = 1e-6;

export interface SurdForm {
  a: number;       // 整数部分（可为 0）
  bNum: number;    // √c 的系数分子（可为负）
  bDen: number;    // √c 的系数分母（≥1）
  c: number;       // 根号下的数（无平方因子），0 表示没有根号项
}

/**
 * 尝试将浮点数 n 表示为 a + (bNum/bDen)√c 的形式
 * 返回 null 表示无法简化
 */
export function detectSurd(n: number): SurdForm | null {
  if (Math.abs(n) < TOL) return { a: 0, bNum: 0, bDen: 1, c: 0 };
  // 先检查是否为整数
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < TOL) return { a: rounded, bNum: 0, bDen: 1, c: 0 };

  for (const c of SURD_BASES) {
    const sqrtC = Math.sqrt(c);
    for (const den of DENOMS) {
      for (let a = -A_RANGE; a <= A_RANGE; a++) {
        // n = a + (bNum/den) * √c  =>  bNum = (n - a) * den / √c
        const remainder = n - a;
        const bNumExact = (remainder * den) / sqrtC;
        const bNum = Math.round(bNumExact);
        if (bNum === 0) continue;
        if (Math.abs(bNumExact - bNum) < TOL) {
          return { a, bNum, bDen: den, c };
        }
      }
    }
  }
  return null;
}

/** 将 SurdForm 格式化为字符串 */
export function surdToStr(s: SurdForm): string {
  if (s.bNum === 0 || s.c === 0) return String(s.a);

  // 根号项部分
  let sqrtPart: string;
  const absBNum = Math.abs(s.bNum);
  if (s.bDen === 1) {
    sqrtPart = absBNum === 1 ? `√${s.c}` : `${absBNum}√${s.c}`;
  } else {
    sqrtPart = absBNum === 1 ? `√${s.c}/${s.bDen}` : `${absBNum}√${s.c}/${s.bDen}`;
  }

  const sign = s.bNum > 0;

  if (s.a === 0) {
    return sign ? sqrtPart : `-${sqrtPart}`;
  }
  return sign ? `${s.a}+${sqrtPart}` : `${s.a}-${sqrtPart}`;
}

/** 根号模式格式化数字：优先显示 a+b√c 形式，fallback 到小数 */
export function fmtSurd(n: number, decimalPlaces = 2): string {
  const s = detectSurd(n);
  if (s) return surdToStr(s);
  return fmt(n, decimalPlaces);
}

/** 根号模式格式化 2D 向量 */
export function fmtVec2DSurd(v: Vec2D, dp = 2): string {
  return `(${fmtSurd(v[0], dp)}, ${fmtSurd(v[1], dp)})`;
}

/** 根号模式格式化 3D 向量 */
export function fmtVec3DSurd(v: Vec3D, dp = 2): string {
  return `(${fmtSurd(v[0], dp)}, ${fmtSurd(v[1], dp)}, ${fmtSurd(v[2], dp)})`;
}

/** 智能格式化：优先 π → 分数 → 根号 → 小数 */
export function fmtSmart(n: number, dp = 2): string {
  if (Math.abs(n) < 1e-10) return '0';
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-10) return String(rounded);

  const pi = detectPiFraction(n);
  if (pi) return fmtPi(pi.k, pi.denom);

  const surd = detectSurd(n);
  if (surd) return surdToStr(surd);

  const frac = toFraction(n, 100);
  if (frac) return fmtFraction(frac[0], frac[1]);

  return fmt(n, dp);
}

// ─── π 检测与分数检测（连分数逼近算法）───

/** 检测浮点数是否为 kπ/n 形式（连分数逼近算法） */
export function detectPiFraction(n: number): { k: number; denom: number } | null {
  if (Math.abs(n) < 1e-10) return null;
  const ratio = n / Math.PI;
  // Also check negative
  if (ratio < 0) {
    const pos = detectPiFraction(-n);
    if (pos) return { k: -pos.k, denom: pos.denom };
    return null;
  }
  // Use continued fraction approximation to find rational approximation of ratio
  const maxDenom = 24;
  let bestNum = 0, bestDen = 1, bestErr = Math.abs(ratio);

  // Stern-Brocot tree / mediants approach
  let lNum = 0, lDen = 1, rNum = 1, rDen = 0;
  for (let iter = 0; iter < 100; iter++) {
    const medNum = lNum + rNum;
    const medDen = lDen + rDen;
    if (medDen > maxDenom) break;
    const medVal = medNum / medDen;
    const err = Math.abs(ratio - medVal);
    if (err < bestErr) {
      bestErr = err;
      bestNum = medNum;
      bestDen = medDen;
    }
    if (err < 1e-9) break;
    if (ratio < medVal) {
      rNum = medNum; rDen = medDen;
    } else {
      lNum = medNum; lDen = medDen;
    }
  }
  if (bestErr > 1e-6 || bestDen === 0 || bestNum === 0) return null;
  return { k: bestNum, denom: bestDen };
}

/** 格式化 kπ/n */
export function fmtPi(k: number, denom: number): string {
  const sign = k < 0 ? '-' : '';
  const absK = Math.abs(k);
  const numStr = absK === 1 ? 'π' : `${absK}π`;
  if (denom === 1) return `${sign}${numStr}`;
  return `${sign}${numStr}/${denom}`;
}

/** 将浮点数转为最简分数（连分数逼近算法，非枚举） */
export function toFraction(n: number, maxDenom = 1000): [number, number] | null {
  if (Math.abs(n) < 1e-10) return [0, 1];
  if (Math.abs(n - Math.round(n)) < 1e-10) return [Math.round(n), 1];

  const sign = n < 0 ? -1 : 1;
  const absN = Math.abs(n);

  let h0 = 0, h1 = 1;
  let k0 = 1, k1 = 0;
  let x = absN;

  for (let i = 0; i < 30; i++) {
    const a = Math.floor(x);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDenom) break;
    h0 = h1; h1 = h2;
    k0 = k1; k1 = k2;
    const rem = x - a;
    if (Math.abs(rem) < 1e-12) break;
    x = 1 / rem;
  }

  if (k1 === 0 || k1 === 1) return null;
  if (Math.abs(sign * h1 / k1 - n) > 1e-8) return null;
  return [sign * h1, k1];
}

/** 格式化分数 */
export function fmtFraction(num: number, den: number): string {
  if (den === 1) return String(num);
  return `${num}/${den}`;
}

// ─── 近似显示辅助 ───

/** 判断浮点数是否可精确显示（整数/已知根号/π/分数） */
export function isExactDisplay(n: number): boolean {
  if (Math.abs(n) < 1e-10) return true;
  if (Math.abs(n - Math.round(n)) < 1e-10) return true;
  if (detectSurd(n) !== null) return true;
  if (detectPiFraction(n) !== null) return true;
  const frac = toFraction(n, 100);
  if (frac !== null) return true;
  return false;
}

/** 格式化数字：精确值不加≈，非精确值加≈前缀 */
export function fmtApprox(n: number, dp = 2): string {
  if (isExactDisplay(n)) return fmtSurd(n, dp);
  return `≈ ${fmt(n, dp)}`;
}

// ─── LaTeX 格式化 ───

export function surdToLatex(s: SurdForm): string {
  if (s.bNum === 0 || s.c === 0) return String(s.a);
  const absBNum = Math.abs(s.bNum);
  let sqrtPart: string;
  if (s.bDen === 1) {
    sqrtPart = absBNum === 1 ? `\\sqrt{${s.c}}` : `${absBNum}\\sqrt{${s.c}}`;
  } else {
    const num = absBNum === 1 ? `\\sqrt{${s.c}}` : `${absBNum}\\sqrt{${s.c}}`;
    sqrtPart = `\\frac{${num}}{${s.bDen}}`;
  }
  const sign = s.bNum > 0;
  if (s.a === 0) return sign ? sqrtPart : `-${sqrtPart}`;
  return sign ? `${s.a}+${sqrtPart}` : `${s.a}-${sqrtPart}`;
}

export function fmtSurdLatex(n: number, dp = 2): string {
  const s = detectSurd(n);
  if (s) return surdToLatex(s);
  return fmt(n, dp);
}

export function fmtPiLatex(k: number, denom: number): string {
  const sign = k < 0 ? '-' : '';
  const absK = Math.abs(k);
  const numStr = absK === 1 ? '\\pi' : `${absK}\\pi`;
  if (denom === 1) return `${sign}${numStr}`;
  return `${sign}\\frac{${absK === 1 ? '' : absK}\\pi}{${denom}}`;
}

export function fmtFractionLatex(num: number, den: number): string {
  if (den === 1) return String(num);
  return `\\frac{${num}}{${den}}`;
}

export function fmtSmartLatex(n: number, dp = 2): string {
  if (Math.abs(n) < 1e-10) return '0';
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-10) return String(rounded);
  const pi = detectPiFraction(n);
  if (pi) return fmtPiLatex(pi.k, pi.denom);
  const surd = detectSurd(n);
  if (surd) return surdToLatex(surd);
  const frac = toFraction(n, 100);
  if (frac) return fmtFractionLatex(frac[0], frac[1]);
  return fmt(n, dp);
}

export function fmtApproxLatex(n: number, dp = 2): string {
  if (isExactDisplay(n)) return `= ${fmtSurdLatex(n, dp)}`;
  return `\\approx ${fmt(n, dp)}`;
}

// ─── 几何交点计算（用于吸附功能）───

export type Pt2 = [number, number];

/** 线段-线段交点（数学坐标）。返回交点或 null */
export function segSegIntersection(
  p1: Pt2, p2: Pt2, p3: Pt2, p4: Pt2,
): Pt2 | null {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denom;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / denom;
  if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
  return [p1[0] + t * d1x, p1[1] + t * d1y];
}

/** 线段-圆交点（数学坐标） */
export function segCircleIntersections(
  p1: Pt2, p2: Pt2, center: Pt2, radius: number,
): Pt2[] {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const fx = p1[0] - center[0], fy = p1[1] - center[1];
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return [];
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  let disc = b * b - 4 * a * c;
  if (disc < -1e-6) return [];
  if (disc < 0) disc = 0;
  const sqrtD = Math.sqrt(disc);
  const results: Pt2[] = [];
  for (const sign of [-1, 1]) {
    const t = (-b + sign * sqrtD) / (2 * a);
    if (t >= -1e-6 && t <= 1 + 1e-6) {
      results.push([p1[0] + t * dx, p1[1] + t * dy]);
    }
  }
  return results;
}

/** 圆-圆交点（数学坐标） */
export function circleCircleIntersections(
  cx1: number, cy1: number, r1: number,
  cx2: number, cy2: number, r2: number,
): Pt2[] {
  const dx = cx2 - cx1, dy = cy2 - cy1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-10) return [];
  if (d > r1 + r2 + 1e-6) return [];
  if (d + 1e-6 < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  const h = hSq > 0 ? Math.sqrt(hSq) : 0;
  const px = cx1 + a * dx / d, py = cy1 + a * dy / d;
  if (h < 1e-8) return [[px, py]];
  const ox = h * dy / d, oy = h * dx / d;
  return [[px + ox, py - oy], [px - ox, py + oy]];
}

// ─── 几何构造辅助函数 ───

/** 点 P 到直线 AB 的垂足（无界投影，用于点到直线距离） */
export function footOfPerpendicular(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number,
): Pt2 {
  const abx = bx - ax, aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-10) return [ax, ay];
  const t = ((px - ax) * abx + (py - ay) * aby) / lenSq;
  return [ax + t * abx, ay + t * aby];
}

/** 点 P 到线段 AB 的垂足（clamp t∈[0,1]） */
export function footOnSegment(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number,
): Pt2 {
  const abx = bx - ax, aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-10) return [ax, ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  return [ax + t * abx, ay + t * aby];
}

/** 点 P 到直线 AB 的距离 */
export function pointToLineDistance(
  px: number, py: number,
  ax: number, ay: number, bx: number, by: number,
): number {
  const abx = bx - ax, aby = by - ay;
  const len = Math.sqrt(abx * abx + aby * aby);
  if (len < 1e-10) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  return Math.abs((px - ax) * aby - (py - ay) * abx) / len;
}

/** 角 AVC 的平分线单位方向向量（从顶点 V 出发） */
export function angleBisectorDir(
  ax: number, ay: number,
  vx: number, vy: number,
  cx: number, cy: number,
): Pt2 {
  const vax = ax - vx, vay = ay - vy;
  const vcx = cx - vx, vcy = cy - vy;
  const lenA = Math.sqrt(vax * vax + vay * vay);
  const lenC = Math.sqrt(vcx * vcx + vcy * vcy);
  if (lenA < 1e-10 || lenC < 1e-10) return [1, 0];
  const uax = vax / lenA, uay = vay / lenA;
  const ucx = vcx / lenC, ucy = vcy / lenC;
  const bx = uax + ucx, by = uay + ucy;
  const bLen = Math.sqrt(bx * bx + by * by);
  if (bLen < 1e-10) return [-uay, uax];
  return [bx / bLen, by / bLen];
}

// ─── 几何变换与计算 ───

/** 从外部点到圆的切线切点坐标 */
export function tangentPoints(
  px: number, py: number,
  cx: number, cy: number, r: number,
): [Pt2, Pt2] | null {
  const dx = px - cx, dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < r + 1e-8) return null;
  const a = Math.acos(r / dist);
  const baseAngle = Math.atan2(dy, dx);
  return [
    [cx + r * Math.cos(baseAngle + a), cy + r * Math.sin(baseAngle + a)],
    [cx + r * Math.cos(baseAngle - a), cy + r * Math.sin(baseAngle - a)],
  ];
}

/** 两圆外公切线端点对 */
export function commonExternalTangents(
  cx1: number, cy1: number, r1: number,
  cx2: number, cy2: number, r2: number,
): [Pt2, Pt2][] {
  const dx = cx2 - cx1, dy = cy2 - cy1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-10) return [];
  const rDiff = r1 - r2;
  if (d < Math.abs(rDiff) + 1e-8) return [];
  const sinA = rDiff / d;
  const baseAngle = Math.atan2(dy, dx);
  const results: [Pt2, Pt2][] = [];
  for (const sign of [1, -1]) {
    const angle = baseAngle + sign * Math.acos(sinA);
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    results.push([
      [cx1 + r1 * nx, cy1 + r1 * ny],
      [cx2 + r2 * nx, cy2 + r2 * ny],
    ]);
  }
  return results;
}

/** 两圆内公切线端点对 */
export function commonInternalTangents(
  cx1: number, cy1: number, r1: number,
  cx2: number, cy2: number, r2: number,
): [Pt2, Pt2][] {
  const dx = cx2 - cx1, dy = cy2 - cy1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < r1 + r2 + 1e-8) return [];
  const rSum = r1 + r2;
  const sinA = rSum / d;
  if (sinA > 1) return [];
  const baseAngle = Math.atan2(dy, dx);
  const results: [Pt2, Pt2][] = [];
  for (const sign of [1, -1]) {
    const angle = baseAngle + sign * Math.acos(sinA);
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    results.push([
      [cx1 + r1 * nx, cy1 + r1 * ny],
      [cx2 - r2 * nx, cy2 - r2 * ny],
    ]);
  }
  return results;
}

/** 多边形面积（Shoelace 公式，带符号，正=逆时针） */
export function polygonArea(vertices: Pt2[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }
  return area / 2;
}

/** 线段/直线斜率（垂直线返回 null） */
export function slopeOf(x1: number, y1: number, x2: number, y2: number): number | null {
  const dx = x2 - x1;
  if (Math.abs(dx) < 1e-10) return null;
  return (y2 - y1) / dx;
}

/** 绕点旋转 */
export function rotatePoint(
  px: number, py: number,
  cx: number, cy: number,
  angleRad: number,
): Pt2 {
  const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
  const dx = px - cx, dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

/** 关于直线 AB 反射点 P */
export function reflectPoint(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): Pt2 {
  const foot = footOfPerpendicular(px, py, ax, ay, bx, by);
  return [2 * foot[0] - px, 2 * foot[1] - py];
}

/** 位似变换（以 center 为中心，ratio 为比例） */
export function dilatePoint(
  px: number, py: number,
  cx: number, cy: number,
  ratio: number,
): Pt2 {
  return [cx + (px - cx) * ratio, cy + (py - cy) * ratio];
}

export function clampToRegion(
  px: number, py: number,
  minX: number, minY: number,
  maxX: number, maxY: number,
): Pt2 {
  return [
    Math.max(minX, Math.min(maxX, px)),
    Math.max(minY, Math.min(maxY, py)),
  ];
}
