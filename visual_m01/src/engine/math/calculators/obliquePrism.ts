import type { CalculationResult } from '../types';

export function calculateObliquePrism(params: Record<string, number>): CalculationResult {
  const n = params.sides;
  const a = params.sideLength;
  const h = params.height;
  const dx = params.topOffsetX;
  const dz = params.topOffsetZ;

  const a2 = a * a;
  const tanPiN = Math.tan(Math.PI / n);
  const baseArea = (n * a2) / (4 * tanPiN);
  const volume = baseArea * h;

  const R = a / (2 * Math.sin(Math.PI / n));
  let lateralArea = 0;
  for (let i = 0; i < n; i++) {
    const angle0 = (2 * Math.PI * i) / n - Math.PI / 2;
    const angle1 = (2 * Math.PI * ((i + 1) % n)) / n - Math.PI / 2;
    const ax0 = R * Math.cos(angle0);
    const az0 = R * Math.sin(angle0);
    const ax1 = R * Math.cos(angle1);
    const az1 = R * Math.sin(angle1);

    const ex = ax1 - ax0;
    const ez = az1 - az0;
    const fx = dx;
    const fy = h;
    const fz = dz;

    const cx = ez * fy;
    const cy = fz * ex - fx * ez;
    const cz = -ex * fy;
    lateralArea += Math.sqrt(cx * cx + cy * cy + cz * cz);
  }

  const surfaceArea = 2 * baseArea + lateralArea;

  const offsetDist = Math.sqrt(dx * dx + dz * dz);
  const lateralEdge = Math.sqrt(dx * dx + h * h + dz * dz);

  return {
    volume: {
      value: { latex: fmt2(volume), numeric: volume },
      steps: [
        { label: '体积公式（斜棱柱）', latex: 'V = S_{底} \\cdot h' },
        {
          label: '底面积',
          latex: `S_{底} = \\dfrac{${fmt(n)} \\times ${fmt(a)}^2}{4\\tan(\\pi/${fmt(n)})} \\approx ${fmt2(baseArea)}`,
        },
        {
          label: '代入数值',
          latex: `V = ${fmt2(baseArea)} \\times ${fmt(h)} \\approx ${fmt2(volume)}`,
        },
      ],
    },
    surfaceArea: {
      value: { latex: fmt2(surfaceArea), numeric: surfaceArea },
      steps: [
        {
          label: '底面积',
          latex: `S_{底} \\approx ${fmt2(baseArea)}`,
        },
        {
          label: '侧面积（各平行四边形之和）',
          latex: `S_{侧} \\approx ${fmt2(lateralArea)}`,
        },
        {
          label: '偏移距离 / 侧棱长',
          latex: `d = ${fmt2(offsetDist)},\\quad l = ${fmt2(lateralEdge)}`,
        },
        {
          label: '表面积公式',
          latex: `S = 2S_{底} + S_{侧} \\approx ${fmt2(surfaceArea)}`,
        },
      ],
    },
  };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
