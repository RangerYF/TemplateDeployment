import type { CalculationResult } from '../types';
import { piMul, piMulFrac } from '../symbolic';

/**
 * 球计算器
 * V = (4/3)πr³, S = 4πr²
 */
export function calculateSphere(params: Record<string, number>): CalculationResult {
  const r = params.radius;

  const r2 = r * r;
  const r3 = r2 * r;

  // V = (4/3)πr³
  const volNumerator = 4 * r3;
  const volumeValue = simplifyPiFraction(volNumerator, 3);

  // S = 4πr²
  const surfCoeff = 4 * r2;
  const surfaceValue = piMul(surfCoeff);

  return {
    volume: {
      value: volumeValue,
      steps: [
        { label: '体积公式', latex: 'V = \\dfrac{4}{3}\\pi r^3' },
        {
          label: '代入数值',
          latex: `V = \\dfrac{4}{3}\\pi \\times ${fmt(r)}^3`,
        },
        {
          label: '化简',
          latex: `V = \\dfrac{${fmt(volNumerator)}\\pi}{3}`,
        },
        {
          label: '计算结果',
          latex: `V = ${volumeValue.latex} \\approx ${fmt2(volumeValue.numeric)}`,
        },
      ],
    },
    surfaceArea: {
      value: surfaceValue,
      steps: [
        { label: '表面积公式', latex: 'S = 4\\pi r^2' },
        {
          label: '代入数值',
          latex: `S = 4\\pi \\times ${fmt(r)}^2`,
        },
        {
          label: '计算结果',
          latex: `S = ${surfaceValue.latex} \\approx ${fmt2(surfaceValue.numeric)}`,
        },
      ],
    },
  };
}

/** 化简 coeff × π / den */
function simplifyPiFraction(coeff: number, den: number): ReturnType<typeof piMul> {
  // 处理小数系数：乘以足够大的因子使之成为整数
  let n = coeff;
  let d = den;
  // 如果 coeff 不是整数，乘以10000再约分
  if (!Number.isInteger(n)) {
    const scale = 10000;
    n = Math.round(n * scale);
    d = d * scale;
  }
  const g = gcd(Math.abs(n), Math.abs(d));
  n = n / g;
  d = d / g;
  if (d === 1) return piMul(n);
  return piMulFrac(n, d);
}

function gcd(a: number, b: number): number {
  a = Math.round(Math.abs(a));
  b = Math.round(Math.abs(b));
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
