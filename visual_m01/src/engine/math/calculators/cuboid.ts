import type { CalculationResult } from '../types';
import { num } from '../symbolic';

export function calculateCuboid(params: Record<string, number>): CalculationResult {
  const l = params.length;
  const w = params.width;
  const h = params.height;

  const volume = l * w * h;
  const surfaceArea = 2 * (l * w + l * h + w * h);

  return {
    volume: {
      value: num(volume),
      steps: [
        { label: '体积公式', latex: 'V = l \\times w \\times h' },
        {
          label: '代入数值',
          latex: `V = ${fmt(l)} \\times ${fmt(w)} \\times ${fmt(h)}`,
        },
        { label: '计算结果', latex: `V = ${fmt(volume)}` },
      ],
    },
    surfaceArea: {
      value: num(surfaceArea),
      steps: [
        { label: '表面积公式', latex: 'S = 2(lw + lh + wh)' },
        {
          label: '代入数值',
          latex: `S = 2(${fmt(l)} \\times ${fmt(w)} + ${fmt(l)} \\times ${fmt(h)} + ${fmt(w)} \\times ${fmt(h)})`,
        },
        {
          label: '展开计算',
          latex: `S = 2(${fmt(l * w)} + ${fmt(l * h)} + ${fmt(w * h)})`,
        },
        {
          label: '计算结果',
          latex: `S = 2 \\times ${fmt(l * w + l * h + w * h)} = ${fmt(surfaceArea)}`,
        },
      ],
    },
  };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000);
}
