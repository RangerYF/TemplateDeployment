/**
 * 精确有理数 (Fraction) — 用 bigint 表示分子/分母，避免浮点污染。
 * 适用场景：胜率为 0.5 / 0.7 这种十进制小数累乘后保持精确分式表示。
 */

function absBig(x: bigint): bigint { return x < 0n ? -x : x; }
function gcdBig(a: bigint, b: bigint): bigint {
  a = absBig(a); b = absBig(b);
  while (b !== 0n) { const t = b; b = a % b; a = t; }
  return a === 0n ? 1n : a;
}

export class Fraction {
  readonly num: bigint;  // 分子
  readonly den: bigint;  // 分母（始终 > 0）

  constructor(num: bigint | number, den: bigint | number = 1n) {
    let n = typeof num === 'number' ? BigInt(Math.round(num)) : num;
    let d = typeof den === 'number' ? BigInt(Math.round(den)) : den;
    if (d === 0n) throw new Error('Fraction: 分母不能为 0');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcdBig(n, d);
    this.num = n / g;
    this.den = d / g;
  }

  /** 从浮点数构造（找最简分数表示，maxDenom 默认 10000 覆盖 0.05 步长） */
  static fromDecimal(d: number, tol = 1e-9, maxDenom = 100000): Fraction {
    if (!Number.isFinite(d)) throw new Error(`非法浮点数 ${d}`);
    if (d === 0) return new Fraction(0n);
    const sign = d < 0 ? -1n : 1n;
    const v = Math.abs(d);
    // 优先尝试小分母（覆盖 0.05 步长 → 1/20 等）
    for (let denom = 1; denom <= maxDenom; denom++) {
      const numer = Math.round(v * denom);
      if (numer > 0 && Math.abs(v - numer / denom) < tol) {
        return new Fraction(sign * BigInt(numer), BigInt(denom));
      }
    }
    // 兜底：用 maxDenom 近似
    return new Fraction(sign * BigInt(Math.round(d * maxDenom)), BigInt(maxDenom));
  }

  static zero = new Fraction(0n);
  static one = new Fraction(1n);

  multiply(o: Fraction): Fraction { return new Fraction(this.num * o.num, this.den * o.den); }
  add(o: Fraction): Fraction { return new Fraction(this.num * o.den + o.num * this.den, this.den * o.den); }
  sub(o: Fraction): Fraction { return new Fraction(this.num * o.den - o.num * this.den, this.den * o.den); }

  /** 1 - this */
  complement(): Fraction { return Fraction.one.sub(this); }

  equals(o: Fraction): boolean { return this.num === o.num && this.den === o.den; }
  isZero(): boolean { return this.num === 0n; }
  isOne(): boolean { return this.num === this.den; }

  toNumber(): number { return Number(this.num) / Number(this.den); }

  /** LaTeX 渲染：整数显示数字，分数显示 \frac{n}{d} */
  toLatex(): string {
    if (this.isZero()) return '0';
    if (this.den === 1n) return `${this.num}`;
    const sign = this.num < 0n ? '-' : '';
    const n = absBig(this.num);
    return `${sign}\\frac{${n}}{${this.den}}`;
  }

  /** 纯文本（如 "3/8"） */
  toString(): string {
    if (this.isZero()) return '0';
    if (this.den === 1n) return `${this.num}`;
    return `${this.num}/${this.den}`;
  }
}
