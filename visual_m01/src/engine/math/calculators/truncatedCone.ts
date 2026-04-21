import type { CalculationResult } from '../types';
import { piMul, piMulFrac, sqrt } from '../symbolic';

/**
 * 圆台计算器
 * V = (π/3)h(r₁² + r₂² + r₁r₂)
 * S = π(r₁² + r₂² + (r₁+r₂)l)
 */
export function calculateTruncatedCone(params: Record<string, number>): CalculationResult {
  const r1 = params.topRadius;
  const r2 = params.bottomRadius;
  const h = params.height;

  const r1_2 = r1 * r1;
  const r2_2 = r2 * r2;

  // 母线长 l = √((r₂ - r₁)² + h²)
  const dr = r2 - r1;
  const slantSquared = dr * dr + h * h;
  const slant = Math.sqrt(slantSquared);
  const slantSymbolic = sqrt(slantSquared);

  // V = (π/3)h(r₁² + r₂² + r₁r₂)
  const volCoeff = h * (r1_2 + r2_2 + r1 * r2);
  const volumeValue = simplifyPiFraction(volCoeff, 3);

  // S_侧 = π(r₁ + r₂)l
  const sLateralCoeff = (r1 + r2) * slant;
  // S_底 = πr₂², S_顶 = πr₁²
  const sTotalCoeff = r1_2 + r2_2 + sLateralCoeff;
  const surfaceValue = piMul(sTotalCoeff);

  return {
    volume: {
      value: volumeValue,
      steps: [
        { label: '体积公式', latex: 'V = \\dfrac{\\pi}{3} h(r_1^2 + r_2^2 + r_1 r_2)' },
        {
          label: '代入数值',
          latex: `V = \\dfrac{\\pi}{3} \\times ${fmt(h)} \\times (${fmt(r1_2)} + ${fmt(r2_2)} + ${fmt(r1 * r2)})`,
        },
        {
          label: '化简',
          latex: `V = \\dfrac{${fmt(volCoeff)}\\pi}{3}`,
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
          label: '母线长',
          latex: `l = \\sqrt{(r_2 - r_1)^2 + h^2} = ${slantSymbolic.latex}`,
        },
        {
          label: '侧面积',
          latex: `S_{侧} = \\pi(r_1 + r_2)l = ${piMul(sLateralCoeff).latex}`,
        },
        {
          label: '底面积 + 顶面积',
          latex: `S_{底} + S_{顶} = \\pi r_2^2 + \\pi r_1^2 = ${piMul(r1_2 + r2_2).latex}`,
        },
        {
          label: '总表面积',
          latex: `S = ${surfaceValue.latex} \\approx ${fmt2(surfaceValue.numeric)}`,
        },
      ],
    },
  };
}

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
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
