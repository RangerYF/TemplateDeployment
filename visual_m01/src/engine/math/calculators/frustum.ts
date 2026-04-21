import type { CalculationResult } from '../types';

/**
 * 棱台计算器
 * V = (h/3)(S₁ + S₂ + √(S₁S₂))
 * S = S₁ + S₂ + S_侧
 */
export function calculateFrustum(params: Record<string, number>): CalculationResult {
  const n = Math.max(3, Math.min(8, Math.round(params.sides)));
  const a2 = params.bottomSideLength;
  const a1 = params.topSideLength;
  const h = params.height;

  // 底面积 S = (n/4) × a² × cot(π/n)
  const cotPiN = 1 / Math.tan(Math.PI / n);
  const S1 = (n / 4) * a1 * a1 * cotPiN;
  const S2 = (n / 4) * a2 * a2 * cotPiN;

  // 体积 V = (h/3)(S₁ + S₂ + √(S₁S₂))
  const sqrtS1S2 = Math.sqrt(S1 * S2);
  const volume = (h / 3) * (S1 + S2 + sqrtS1S2);

  // 斜高 h' = √(h² + (apothem₂ - apothem₁)²)
  const apothem1 = a1 / (2 * Math.tan(Math.PI / n));
  const apothem2 = a2 / (2 * Math.tan(Math.PI / n));
  const slantHeight = Math.sqrt(h * h + (apothem2 - apothem1) * (apothem2 - apothem1));

  // 侧面积 S_侧 = ½ × n × (a₁ + a₂) × h'
  const sLateral = 0.5 * n * (a1 + a2) * slantHeight;
  const surfaceArea = S1 + S2 + sLateral;

  return {
    volume: {
      value: { latex: `${fmt2(volume)}`, numeric: volume },
      steps: [
        { label: '体积公式', latex: 'V = \\dfrac{h}{3}(S_1 + S_2 + \\sqrt{S_1 S_2})' },
        {
          label: '底面积',
          latex: `S_1 = ${fmt(S1)}, \\quad S_2 = ${fmt(S2)}`,
        },
        {
          label: '代入数值',
          latex: `V = \\dfrac{${fmt(h)}}{3} \\times (${fmt(S1)} + ${fmt(S2)} + \\sqrt{${fmt(S1 * S2)}})`,
        },
        {
          label: '计算结果',
          latex: `V = ${fmt2(volume)}`,
        },
      ],
    },
    surfaceArea: {
      value: { latex: `${fmt2(surfaceArea)}`, numeric: surfaceArea },
      steps: [
        {
          label: '斜高',
          latex: `h' = \\sqrt{h^2 + (a_2' - a_1')^2} = ${fmt(slantHeight)}`,
        },
        {
          label: '侧面积',
          latex: `S_{侧} = \\frac{1}{2} \\times ${n} \\times (${fmt(a1)} + ${fmt(a2)}) \\times ${fmt(slantHeight)} = ${fmt(sLateral)}`,
        },
        {
          label: '总表面积',
          latex: `S = S_1 + S_2 + S_{侧} = ${fmt2(surfaceArea)}`,
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
