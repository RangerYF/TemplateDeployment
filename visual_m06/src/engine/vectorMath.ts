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
const SURD_BASES = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];
/** 尝试的分母 */
const DENOMS = [1, 2, 3, 4, 6];
/** 尝试的 a（整数部分）范围 */
const A_RANGE = 12;
const TOL = 1e-6;

interface SurdForm {
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
