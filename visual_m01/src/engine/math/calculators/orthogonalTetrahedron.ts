import type { CalculationResult } from '../types';
import { sqrt } from '../symbolic';

/**
 * 对棱垂直四面体计算器
 *
 * AB⊥CD, AC⊥BD, AD⊥BC
 * 构造：A=(-AB/2, d, 0), B=(AB/2, d, 0), C=(0, 0, -CD/2), D=(0, 0, CD/2)
 * 其中 d = √(AB² + CD²) / 2
 *
 * 其余 4 条棱等长：e = √((AB² + CD²) / 2)
 */
export function calculateOrthogonalTetrahedron(params: Record<string, number>): CalculationResult {
  const ab = params.edgeAB;
  const cd = params.edgeCD;

  const ab2 = ab * ab;
  const cd2 = cd * cd;
  const sum2 = ab2 + cd2;
  const d = Math.sqrt(sum2) / 2;
  const e2 = sum2 / 2;
  const e = Math.sqrt(e2);

  const volume = (ab * d * cd) / 6;

  // 面 ACB / ABD：三边 e, e, ab
  const s1 = (e + e + ab) / 2;
  const heron1 = s1 * (s1 - e) * (s1 - e) * (s1 - ab);
  const area1 = Math.sqrt(Math.max(0, heron1));

  // 面 ACD / BCD：三边 e, e, cd
  const s2 = (e + e + cd) / 2;
  const heron2 = s2 * (s2 - e) * (s2 - e) * (s2 - cd);
  const area2 = Math.sqrt(Math.max(0, heron2));

  const surfaceArea = 2 * area1 + 2 * area2;

  // ── 符号表达 ──
  const eSymbolic = sqrt(e2 > 0 && isNiceInt(e2) ? Math.round(e2) : e2);
  const sum2Nice = isNiceInt(sum2);

  // 体积: V = ab·cd·√(ab²+cd²) / 12
  let volLatex: string;
  if (sum2Nice) {
    const sqrtPart = sqrt(Math.round(sum2));
    const coeff = ab * cd;
    if (sqrtPart.numeric === Math.round(sqrtPart.numeric)) {
      // √(sum2) 是整数，体积为有理数
      const num = coeff * Math.round(sqrtPart.numeric);
      volLatex = simplifyFrac(num, 12);
    } else {
      volLatex = `\\dfrac{${fmt(coeff)} \\times ${sqrtPart.latex}}{12}`;
    }
  } else {
    volLatex = fmt2(volume);
  }

  // 表面积各面用 sqrt
  const h1Nice = isNiceInt(heron1) && heron1 >= 0;
  const h2Nice = isNiceInt(heron2) && heron2 >= 0;

  const area1Latex = h1Nice ? sqrt(Math.round(Math.max(0, heron1))).latex : fmt2(area1);
  const area2Latex = h2Nice ? sqrt(Math.round(Math.max(0, heron2))).latex : fmt2(area2);

  const twoArea1Latex = h1Nice ? sqrt(Math.round(Math.max(0, heron1)) * 4).latex : fmt2(2 * area1);
  const twoArea2Latex = h2Nice ? sqrt(Math.round(Math.max(0, heron2)) * 4).latex : fmt2(2 * area2);

  return {
    volume: {
      value: { latex: volLatex, numeric: volume },
      steps: [
        {
          label: '其余四棱等长',
          latex: `e = \\sqrt{\\dfrac{AB^2 + CD^2}{2}} = ${eSymbolic.latex}`,
        },
        {
          label: '对棱间距',
          latex: `d = \\dfrac{\\sqrt{AB^2 + CD^2}}{2} = \\dfrac{${sum2Nice ? sqrt(Math.round(sum2)).latex : fmt(sum2)}}{2}`,
        },
        {
          label: '体积公式',
          latex: `V = \\dfrac{AB \\times d \\times CD}{6}`,
        },
        {
          label: '计算结果',
          latex: `V = ${volLatex} \\approx ${fmt2(volume)}`,
        },
      ],
    },
    surfaceArea: {
      value: { latex: fmt2(surfaceArea), numeric: surfaceArea },
      steps: [
        {
          label: '其余四棱等长',
          latex: `e = ${eSymbolic.latex}`,
        },
        {
          label: '含 AB 的面（×2）',
          latex: `S_1 = ${area1Latex} \\times 2 = ${twoArea1Latex} \\approx ${fmt2(2 * area1)}`,
        },
        {
          label: '含 CD 的面（×2）',
          latex: `S_2 = ${area2Latex} \\times 2 = ${twoArea2Latex} \\approx ${fmt2(2 * area2)}`,
        },
        {
          label: '总表面积',
          latex: `S = ${twoArea1Latex} + ${twoArea2Latex} \\approx ${fmt2(surfaceArea)}`,
        },
      ],
    },
  };
}

function isNiceInt(n: number): boolean {
  return Math.abs(n - Math.round(n)) < 1e-9;
}

function simplifyFrac(num: number, den: number): string {
  const g = gcd(Math.abs(Math.round(num)), Math.abs(Math.round(den)));
  const n = Math.round(num) / g;
  const d = Math.round(den) / g;
  if (d === 1) return fmt(n);
  return `\\dfrac{${fmt(n)}}{${fmt(d)}}`;
}

function gcd(a: number, b: number): number {
  a = Math.round(Math.abs(a));
  b = Math.round(Math.abs(b));
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
