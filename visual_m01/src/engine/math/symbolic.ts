import type { SymbolicValue } from './types';

/** 纯数值 */
export function num(value: number): SymbolicValue {
  return {
    latex: formatNumber(value),
    numeric: value,
  };
}

/** π 的整数/小数倍：coeff × π */
export function piMul(coeff: number): SymbolicValue {
  if (coeff === 1) return { latex: '\\pi', numeric: Math.PI };
  if (coeff === -1) return { latex: '-\\pi', numeric: -Math.PI };
  return {
    latex: `${formatNumber(coeff)}\\pi`,
    numeric: coeff * Math.PI,
  };
}

/** π 的分数倍：(num/den) × π */
export function piMulFrac(numerator: number, den: number): SymbolicValue {
  const g = gcd(Math.abs(numerator), Math.abs(den));
  const n = numerator / g;
  const d = den / g;
  if (d === 1) return piMul(n);
  const piPart = n === 1 ? '\\pi' : n === -1 ? '-\\pi' : `${formatNumber(n)}\\pi`;
  return {
    latex: `\\dfrac{${piPart}}{${formatNumber(d)}}`,
    numeric: (numerator / den) * Math.PI,
  };
}

/** coeff × π × √radicand */
export function piMulSqrt(coeff: number, radicand: number): SymbolicValue {
  const { simplified, outer } = simplifyRadical(radicand);
  const totalCoeff = coeff * outer;
  const sqrtPart = simplified === 1 ? '' : `\\sqrt{${simplified}}`;
  let latex: string;
  if (totalCoeff === 1) {
    latex = sqrtPart ? `${sqrtPart}\\pi` : '\\pi';
  } else if (totalCoeff === -1) {
    latex = sqrtPart ? `-${sqrtPart}\\pi` : '-\\pi';
  } else {
    latex = sqrtPart
      ? `${formatNumber(totalCoeff)}${sqrtPart}\\pi`
      : `${formatNumber(totalCoeff)}\\pi`;
  }
  return {
    latex,
    numeric: coeff * Math.PI * Math.sqrt(radicand),
  };
}

/** √radicand */
export function sqrt(radicand: number): SymbolicValue {
  const { simplified, outer } = simplifyRadical(radicand);
  if (simplified === 1) {
    return { latex: formatNumber(outer), numeric: outer };
  }
  const latex = outer === 1
    ? `\\sqrt{${simplified}}`
    : `${formatNumber(outer)}\\sqrt{${simplified}}`;
  return {
    latex,
    numeric: Math.sqrt(radicand),
  };
}

/** √radicand / den */
export function sqrtFrac(radicand: number, den: number): SymbolicValue {
  const { simplified, outer } = simplifyRadical(radicand);
  if (simplified === 1) {
    // 变成普通分数 outer/den
    return frac(outer, den);
  }
  const numeratorLatex = outer === 1
    ? `\\sqrt{${simplified}}`
    : `${formatNumber(outer)}\\sqrt{${simplified}}`;
  return {
    latex: `\\dfrac{${numeratorLatex}}{${formatNumber(den)}}`,
    numeric: Math.sqrt(radicand) / den,
  };
}

/** 分数 num/den */
export function frac(numerator: number, den: number): SymbolicValue {
  const g = gcd(Math.abs(numerator), Math.abs(den));
  const n = numerator / g;
  const d = den / g;
  if (d === 1) return num(n);
  return {
    latex: `\\dfrac{${formatNumber(n)}}{${formatNumber(d)}}`,
    numeric: numerator / den,
  };
}

/** 多个 SymbolicValue 相加 */
export function add(...values: SymbolicValue[]): SymbolicValue {
  if (values.length === 0) return num(0);
  if (values.length === 1) return values[0];
  const latex = values
    .map((v, i) => {
      if (i === 0) return v.latex;
      // 如果该项以负号开头，不加 +
      if (v.latex.startsWith('-')) return v.latex;
      return `+ ${v.latex}`;
    })
    .join(' ');
  return {
    latex,
    numeric: values.reduce((sum, v) => sum + v.numeric, 0),
  };
}

// ─── 内部工具 ───

function gcd(a: number, b: number): number {
  a = Math.round(Math.abs(a));
  b = Math.round(Math.abs(b));
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** 化简根号：√radicand = outer × √simplified */
function simplifyRadical(radicand: number): { simplified: number; outer: number } {
  if (radicand < 0) return { simplified: radicand, outer: 1 };
  // 检查是否是完全平方数
  const sqrtVal = Math.sqrt(radicand);
  if (Number.isInteger(sqrtVal)) {
    return { simplified: 1, outer: sqrtVal };
  }
  // 提取最大完全平方因子
  let outer = 1;
  let remaining = radicand;
  for (let i = 2; i * i <= remaining; i++) {
    while (remaining % (i * i) === 0) {
      outer *= i;
      remaining /= i * i;
    }
  }
  return { simplified: remaining, outer };
}

/** 格式化数字：整数不带小数点，小数保留合理精度 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // 检查常见分数
  const rounded = Math.round(n * 10000) / 10000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}
