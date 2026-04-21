import type { CalculationResult } from '../types';
import { piMul, piMulFrac, sqrt } from '../symbolic';

export function calculateCone(params: Record<string, number>): CalculationResult {
  const r = params.radius;
  const h = params.height;

  // 母线长 l = √(r² + h²)
  const r2 = r * r;
  const h2 = h * h;
  const slantSquared = r2 + h2;
  const slant = Math.sqrt(slantSquared);

  // V = πr²h / 3
  const volCoeff = r2 * h;
  const volumeValue = simplifyPiFraction(volCoeff, 3);

  // S_底 = πr²
  // S_侧 = πrl
  // S = πr² + πrl = πr(r + l)
  const sLateral = r * slant; // πrl 的系数
  const sBase = r2;           // πr² 的系数

  const surfaceValue = piMul(sBase + sLateral);

  // 母线精确值
  const slantSymbolic = sqrt(slantSquared);

  return {
    volume: {
      value: volumeValue,
      steps: [
        { label: '体积公式', latex: 'V = \\dfrac{1}{3}\\pi r^2 h' },
        {
          label: '代入数值',
          latex: `V = \\dfrac{1}{3}\\pi \\times ${fmt(r)}^2 \\times ${fmt(h)}`,
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
          latex: `l = \\sqrt{r^2 + h^2} = \\sqrt{${fmt(r2)} + ${fmt(h2)}} = ${slantSymbolic.latex}`,
        },
        { label: '侧面积公式', latex: 'S_{侧} = \\pi r l' },
        {
          label: '代入数值',
          latex: `S_{侧} = \\pi \\times ${fmt(r)} \\times ${slantSymbolic.latex} = ${piMul(sLateral).latex}`,
        },
        {
          label: '底面积',
          latex: `S_{底} = \\pi r^2 = ${piMul(sBase).latex}`,
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
  // 尝试约分
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

