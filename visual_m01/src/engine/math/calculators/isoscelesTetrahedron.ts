import type { CalculationResult } from '../types';
import { sqrt } from '../symbolic';

/**
 * 对棱相等四面体计算器
 * V = (√2/12)·√((p²+q²-r²)(p²+r²-q²)(q²+r²-p²))
 * S = 4 × 三角形面积（每个面三边为 p, q, r）
 */
export function calculateIsoscelesTetrahedron(params: Record<string, number>): CalculationResult {
  const p = params.edgeP;
  const q = params.edgeQ;
  const r = params.edgeR;

  const p2 = p * p;
  const q2 = q * q;
  const r2 = r * r;

  // 体积
  const factor1 = p2 + q2 - r2;
  const factor2 = p2 + r2 - q2;
  const factor3 = q2 + r2 - p2;
  const product = factor1 * factor2 * factor3;
  const volume = (Math.sqrt(2) / 12) * Math.sqrt(Math.max(0, product));

  // 每个面三边为 p, q, r
  // 海伦公式：面积 = √(s(s-p)(s-q)(s-r))
  const s = (p + q + r) / 2;
  const faceArea = Math.sqrt(Math.max(0, s * (s - p) * (s - q) * (s - r)));
  const surfaceArea = 4 * faceArea;

  // 精确值
  const volProduct = Math.max(0, product);
  const volLatex = product > 0
    ? `\\dfrac{\\sqrt{2}}{12} \\times ${sqrt(volProduct).latex}`
    : '0';

  return {
    volume: {
      value: { latex: volLatex, numeric: volume },
      steps: [
        {
          label: '体积公式',
          latex: 'V = \\dfrac{\\sqrt{2}}{12}\\sqrt{(p^2+q^2-r^2)(p^2+r^2-q^2)(q^2+r^2-p^2)}',
        },
        {
          label: '代入数值',
          latex: `p=${fmt(p)},\\; q=${fmt(q)},\\; r=${fmt(r)}`,
        },
        {
          label: '各因子',
          latex: `p^2+q^2-r^2=${fmt(factor1)},\\; p^2+r^2-q^2=${fmt(factor2)},\\; q^2+r^2-p^2=${fmt(factor3)}`,
        },
        {
          label: '计算结果',
          latex: `V \\approx ${fmt2(volume)}`,
        },
      ],
    },
    surfaceArea: {
      value: { latex: `${fmt2(surfaceArea)}`, numeric: surfaceArea },
      steps: [
        {
          label: '每个面三边',
          latex: `p=${fmt(p)},\\; q=${fmt(q)},\\; r=${fmt(r)}`,
        },
        {
          label: '海伦公式',
          latex: `S_{面} = \\sqrt{s(s-p)(s-q)(s-r)},\\; s=\\frac{p+q+r}{2}=${fmt(s)}`,
        },
        {
          label: '单面面积',
          latex: `S_{面} \\approx ${fmt2(faceArea)}`,
        },
        {
          label: '总表面积（4个全等面）',
          latex: `S = 4 \\times ${fmt2(faceArea)} = ${fmt2(surfaceArea)}`,
        },
      ],
    },
  };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
