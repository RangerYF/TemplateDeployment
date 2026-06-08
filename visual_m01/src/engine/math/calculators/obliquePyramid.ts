import type { CalculationResult } from '../types';

export function calculateObliquePyramid(params: Record<string, number>): CalculationResult {
  const n = params.sides;
  const a = params.sideLength;
  const h = params.height;
  const dx = params.apexOffsetX;
  const dz = params.apexOffsetZ;

  const a2 = a * a;
  const tanPiN = Math.tan(Math.PI / n);
  const baseArea = (n * a2) / (4 * tanPiN);
  const volume = baseArea * h / 3;

  const R = a / (2 * Math.sin(Math.PI / n));
  const apex: [number, number, number] = [dx, h, dz];

  let lateralArea = 0;
  for (let i = 0; i < n; i++) {
    const angle0 = (2 * Math.PI * i) / n - Math.PI / 2;
    const angle1 = (2 * Math.PI * ((i + 1) % n)) / n - Math.PI / 2;
    const bx0 = R * Math.cos(angle0);
    const bz0 = R * Math.sin(angle0);
    const bx1 = R * Math.cos(angle1);
    const bz1 = R * Math.sin(angle1);

    const ex = bx1 - bx0;
    const ez = bz1 - bz0;
    const fx = apex[0] - bx0;
    const fy = apex[1];
    const fz = apex[2] - bz0;

    const cx = ez * fy - fz * 0;
    const cy = fz * ex - fx * ez;
    const cz = fx * 0 - ex * fy;
    lateralArea += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }

  const surfaceArea = baseArea + lateralArea;

  const offsetDist = Math.sqrt(dx * dx + dz * dz);

  return {
    volume: {
      value: { latex: fmt2(volume), numeric: volume },
      steps: [
        { label: '体积公式（斜棱锥）', latex: 'V = \\dfrac{1}{3} S_{底} \\cdot h' },
        {
          label: '底面积',
          latex: `S_{底} = \\dfrac{${fmt(n)} \\times ${fmt(a)}^2}{4\\tan(\\pi/${fmt(n)})} \\approx ${fmt2(baseArea)}`,
        },
        {
          label: '代入数值',
          latex: `V = \\dfrac{1}{3} \\times ${fmt2(baseArea)} \\times ${fmt(h)} \\approx ${fmt2(volume)}`,
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
          label: '侧面积（各三角形之和）',
          latex: `S_{侧} \\approx ${fmt2(lateralArea)}`,
        },
        {
          label: '顶点偏移距离',
          latex: `d = \\sqrt{${fmt(dx)}^2 + ${fmt(dz)}^2} \\approx ${fmt2(offsetDist)}`,
        },
        {
          label: '表面积公式',
          latex: `S = S_{底} + S_{侧} \\approx ${fmt2(surfaceArea)}`,
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
