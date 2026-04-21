import type { CalculationResult } from '../types';
import { piMul, piMulFrac } from '../symbolic';

/**
 * 圆柱计算器
 * V = πr²h, S = 2πr(r + h)
 */
export function calculateCylinder(params: Record<string, number>): CalculationResult {
  const r = params.radius;
  const h = params.height;

  const r2 = r * r;

  // V = πr²h
  const volCoeff = r2 * h;
  const volumeValue = simplifyPiFraction(volCoeff, 1);

  // S_侧 = 2πrh
  const sLateralCoeff = 2 * r * h;
  // S_底 = πr² × 2 = 2πr²
  const sBaseCoeff = 2 * r2;
  // S = 2πr² + 2πrh = 2πr(r + h)
  const sTotalCoeff = sBaseCoeff + sLateralCoeff;
  const surfaceValue = piMul(sTotalCoeff);

  return {
    volume: {
      value: volumeValue,
      steps: [
        { label: '体积公式', latex: 'V = \\pi r^2 h' },
        {
          label: '代入数值',
          latex: `V = \\pi \\times ${fmt(r)}^2 \\times ${fmt(h)}`,
        },
        {
          label: '化简',
          latex: `V = ${fmt(volCoeff)}\\pi`,
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
        {
          label: '侧面积',
          latex: `S_{侧} = 2\\pi r h = 2\\pi \\times ${fmt(r)} \\times ${fmt(h)} = ${piMul(sLateralCoeff).latex}`,
        },
        {
          label: '底面积（×2）',
          latex: `S_{底} = 2\\pi r^2 = 2\\pi \\times ${fmt(r)}^2 = ${piMul(sBaseCoeff).latex}`,
        },
        {
          label: '总表面积',
          latex: `S = S_{侧} + S_{底} = ${surfaceValue.latex} \\approx ${fmt2(surfaceValue.numeric)}`,
        },
      ],
    },
  };
}

/** 化简 coeff × π / den */
function simplifyPiFraction(coeff: number, den: number): ReturnType<typeof piMul> {
  const g = gcd(Math.abs(coeff), Math.abs(den));
  const n = coeff / g;
  const d = den / g;
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
