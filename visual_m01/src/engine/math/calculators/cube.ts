import type { CalculationResult } from '../types';
import { num } from '../symbolic';

/**
 * 正方体计算器
 * 内部复用 cuboid 计算逻辑，重写 steps 使用 a（边长）表述
 */
export function calculateCube(params: Record<string, number>): CalculationResult {
  const a = params.sideLength;
  const a2 = a * a;
  const a3 = a2 * a;

  return {
    volume: {
      value: num(a3),
      steps: [
        { label: '体积公式', latex: 'V = a^3' },
        { label: '代入数值', latex: `V = ${fmt(a)}^3` },
        { label: '计算结果', latex: `V = ${fmt(a3)}` },
      ],
    },
    surfaceArea: {
      value: num(6 * a2),
      steps: [
        { label: '表面积公式', latex: 'S = 6a^2' },
        { label: '代入数值', latex: `S = 6 \\times ${fmt(a)}^2` },
        { label: '展开计算', latex: `S = 6 \\times ${fmt(a2)}` },
        { label: '计算结果', latex: `S = ${fmt(6 * a2)}` },
      ],
    },
  };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000);
}
