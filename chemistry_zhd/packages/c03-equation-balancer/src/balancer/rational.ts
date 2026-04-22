function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

export class Fraction {
  readonly num: number;
  readonly den: number;

  constructor(num: number, den: number = 1) {
    if (den === 0) throw new Error('除数为零');
    const g = gcd(Math.abs(num), Math.abs(den));
    const sign = den < 0 ? -1 : 1;
    this.num = sign * num / g;
    this.den = sign * den / g;
  }

  static ZERO = new Fraction(0);
  static ONE  = new Fraction(1);

  isZero(): boolean { return this.num === 0; }
  isPositive(): boolean { return this.num > 0; }

  add(o: Fraction): Fraction {
    return new Fraction(this.num * o.den + o.num * this.den, this.den * o.den);
  }
  sub(o: Fraction): Fraction {
    return new Fraction(this.num * o.den - o.num * this.den, this.den * o.den);
  }
  mul(o: Fraction): Fraction {
    return new Fraction(this.num * o.num, this.den * o.den);
  }
  div(o: Fraction): Fraction {
    return new Fraction(this.num * o.den, this.den * o.num);
  }
  neg(): Fraction {
    return new Fraction(-this.num, this.den);
  }

  toNumber(): number { return this.num / this.den; }
  toString(): string { return this.den === 1 ? `${this.num}` : `${this.num}/${this.den}`; }
}

/** 求整数数组的最小公倍数 */
export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}
