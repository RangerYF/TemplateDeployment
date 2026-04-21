import type { CalculationResult, SymbolicValue } from '../types';
import { num, sqrt, frac, add } from '../symbolic';

/**
 * 正 n 棱锥计算器
 * params: { sides (n), sideLength (a), height (h) }
 */
export function calculatePyramid(params: Record<string, number>): CalculationResult {
  const n = params.sides;
  const a = params.sideLength;
  const h = params.height;

  const a2 = a * a;
  const h2 = h * h;

  const tanPiN = Math.tan(Math.PI / n);
  const r = a / (2 * tanPiN);
  const baseAreaNumeric = (n * a2) / (4 * tanPiN);
  const volumeNumeric = baseAreaNumeric * h / 3;
  const slantHeight = Math.sqrt(h2 + r * r);
  const lateralAreaNumeric = 0.5 * n * a * slantHeight;
  const totalAreaNumeric = baseAreaNumeric + lateralAreaNumeric;

  const { volume, totalArea, volumeSteps, surfaceSteps } =
    buildByN(n, a, a2, h, h2, baseAreaNumeric, volumeNumeric, slantHeight, lateralAreaNumeric, totalAreaNumeric);

  return {
    volume: { value: volume, steps: volumeSteps },
    surfaceArea: { value: totalArea, steps: surfaceSteps },
  };
}

function buildByN(
  n: number, a: number, a2: number, h: number, h2: number,
  baseAreaNum: number, volNum: number,
  slantHeight: number, lateralNum: number, totalNum: number,
) {
  if (n === 3) return buildN3(a, a2, h, baseAreaNum, volNum, slantHeight, lateralNum, totalNum);
  if (n === 4) return buildN4(a, a2, h, h2, volNum, lateralNum, totalNum);
  if (n === 6) return buildN6(a, a2, h, baseAreaNum, volNum, slantHeight, lateralNum, totalNum);
  return buildGeneric(n, a, h, baseAreaNum, volNum, slantHeight, lateralNum, totalNum);
}

// ─── n=3：正三棱锥 ───
function buildN3(
  a: number, a2: number, h: number,
  baseAreaNum: number, volNum: number,
  slantHeight: number, lateralNum: number, totalNum: number,
) {
  // S_底 = (√3/4)a²
  const baseArea: SymbolicValue = {
    latex: `\\dfrac{${fmt(a2)}\\sqrt{3}}{4}`,
    numeric: baseAreaNum,
  };
  if (a2 % 4 === 0) {
    const simplified = a2 / 4;
    baseArea.latex = simplified === 1 ? '\\sqrt{3}' : `${fmt(simplified)}\\sqrt{3}`;
  }

  // V = (√3/12) × a² × h
  const volNumerator = a2 * h;
  const volume: SymbolicValue = {
    latex: `\\dfrac{${fmt(volNumerator)}\\sqrt{3}}{12}`,
    numeric: volNum,
  };
  const g = gcd(Math.abs(volNumerator), 12);
  const vn = volNumerator / g;
  const vd = 12 / g;
  if (vd === 1) {
    volume.latex = vn === 1 ? '\\sqrt{3}' : `${fmt(vn)}\\sqrt{3}`;
  } else {
    volume.latex = `\\dfrac{${vn === 1 ? '' : fmt(vn)}\\sqrt{3}}{${fmt(vd)}}`;
  }

  const volumeSteps = [
    { label: '底面积公式（正三角形）', latex: 'S_{底} = \\dfrac{\\sqrt{3}}{4}a^2' },
    { label: '代入数值', latex: `S_{底} = \\dfrac{\\sqrt{3}}{4} \\times ${fmt(a)}^2 = ${baseArea.latex}` },
    { label: '体积公式', latex: 'V = \\dfrac{1}{3} S_{底} h' },
    { label: '代入数值', latex: `V = \\dfrac{1}{3} \\times ${baseArea.latex} \\times ${fmt(h)} = ${volume.latex}` },
    { label: '计算结果', latex: `V = ${volume.latex} \\approx ${fmt2(volNum)}` },
  ];

  const surfaceSteps = [
    { label: '底面积', latex: `S_{底} = ${baseArea.latex}` },
    { label: '斜高', latex: `l = \\sqrt{h^2 + r^2} \\approx ${fmt2(slantHeight)}` },
    { label: '侧面积', latex: `S_{侧} = \\dfrac{1}{2} \\times 3 \\times ${fmt(a)} \\times ${fmt2(slantHeight)} \\approx ${fmt2(lateralNum)}` },
    { label: '总表面积', latex: `S = S_{底} + S_{侧} \\approx ${fmt2(totalNum)}` },
  ];

  return { volume, totalArea: num(totalNum), volumeSteps, surfaceSteps };
}

// ─── n=4：正四棱锥 ───
function buildN4(
  a: number, a2: number, h: number, h2: number,
  volNum: number,
  lateralNum: number, totalNum: number,
) {
  const baseArea = num(a2);
  const volNumerator = a2 * h;
  const volume = frac(volNumerator, 3);

  const slantSquared = h2 + a2 / 4;
  const slantSymbolic = sqrt(slantSquared);

  const lateralArea: SymbolicValue = {
    latex: `${fmt(2 * a)}${slantSymbolic.latex}`,
    numeric: lateralNum,
  };
  if (Number.isInteger(Math.sqrt(slantSquared))) {
    lateralArea.latex = fmt(lateralNum);
  }

  const totalArea = add(baseArea, lateralArea);

  const volumeSteps = [
    { label: '底面积（正方形）', latex: 'S_{底} = a^2' },
    { label: '代入数值', latex: `S_{底} = ${fmt(a)}^2 = ${fmt(a2)}` },
    { label: '体积公式', latex: 'V = \\dfrac{1}{3} S_{底} h' },
    { label: '代入数值', latex: `V = \\dfrac{1}{3} \\times ${fmt(a2)} \\times ${fmt(h)} = ${volume.latex}` },
    { label: '计算结果', latex: `V = ${volume.latex} \\approx ${fmt2(volNum)}` },
  ];

  const surfaceSteps = [
    { label: '底面积', latex: `S_{底} = ${fmt(a2)}` },
    { label: '斜高', latex: `l = \\sqrt{h^2 + (\\frac{a}{2})^2} = \\sqrt{${fmt(h2)} + ${fmt(a2 / 4)}} = ${slantSymbolic.latex}` },
    { label: '侧面积', latex: `S_{侧} = \\dfrac{1}{2} \\times 4 \\times ${fmt(a)} \\times ${slantSymbolic.latex} = ${fmt2(lateralNum)}` },
    { label: '总表面积', latex: `S = ${fmt(a2)} + ${fmt2(lateralNum)} = ${fmt2(totalNum)}` },
  ];

  return { volume, totalArea, volumeSteps, surfaceSteps };
}

// ─── n=6：正六棱锥 ───
function buildN6(
  a: number, a2: number, h: number,
  baseAreaNum: number, volNum: number,
  slantHeight: number, lateralNum: number, totalNum: number,
) {
  const baseCoeffNum = 3 * a2;
  const baseArea: SymbolicValue = {
    latex: `\\dfrac{${fmt(baseCoeffNum)}\\sqrt{3}}{2}`,
    numeric: baseAreaNum,
  };
  if (baseCoeffNum % 2 === 0) {
    const simplified = baseCoeffNum / 2;
    baseArea.latex = simplified === 1 ? '\\sqrt{3}' : `${fmt(simplified)}\\sqrt{3}`;
  }

  const volCoeff = a2 * h;
  const volume: SymbolicValue = {
    latex: `\\dfrac{${fmt(volCoeff)}\\sqrt{3}}{2}`,
    numeric: volNum,
  };
  if (volCoeff % 2 === 0) {
    const simplified = volCoeff / 2;
    volume.latex = simplified === 1 ? '\\sqrt{3}' : `${fmt(simplified)}\\sqrt{3}`;
  }

  const volumeSteps = [
    { label: '底面积公式（正六边形）', latex: 'S_{底} = \\dfrac{3\\sqrt{3}}{2}a^2' },
    { label: '代入数值', latex: `S_{底} = \\dfrac{3\\sqrt{3}}{2} \\times ${fmt(a)}^2 = ${baseArea.latex}` },
    { label: '体积公式', latex: 'V = \\dfrac{1}{3} S_{底} h' },
    { label: '代入数值', latex: `V = \\dfrac{1}{3} \\times ${baseArea.latex} \\times ${fmt(h)} = ${volume.latex}` },
    { label: '计算结果', latex: `V = ${volume.latex} \\approx ${fmt2(volNum)}` },
  ];

  const surfaceSteps = [
    { label: '底面积', latex: `S_{底} = ${baseArea.latex}` },
    { label: '斜高', latex: `l = \\sqrt{h^2 + r^2} \\approx ${fmt2(slantHeight)}` },
    { label: '侧面积', latex: `S_{侧} = \\dfrac{1}{2} \\times 6 \\times ${fmt(a)} \\times ${fmt2(slantHeight)} \\approx ${fmt2(lateralNum)}` },
    { label: '总表面积', latex: `S = S_{底} + S_{侧} \\approx ${fmt2(totalNum)}` },
  ];

  return { volume, totalArea: num(totalNum), volumeSteps, surfaceSteps };
}

// ─── 通用 n 棱锥（数值近似） ───
function buildGeneric(
  n: number, a: number, h: number,
  baseAreaNum: number, volNum: number,
  slantHeight: number, lateralNum: number, totalNum: number,
) {
  const volume = num(volNum);
  const totalArea = num(totalNum);

  const volumeSteps = [
    { label: '底面积公式', latex: `S_{底} = \\dfrac{n a^2}{4\\tan(\\pi/n)}` },
    { label: '代入数值', latex: `S_{底} = \\dfrac{${n} \\times ${fmt(a)}^2}{4\\tan(\\pi/${n})} \\approx ${fmt2(baseAreaNum)}` },
    { label: '体积公式', latex: 'V = \\dfrac{1}{3} S_{底} h' },
    { label: '代入数值', latex: `V = \\dfrac{1}{3} \\times ${fmt2(baseAreaNum)} \\times ${fmt(h)} \\approx ${fmt2(volNum)}` },
    { label: '计算结果', latex: `V \\approx ${fmt2(volNum)}` },
  ];

  const surfaceSteps = [
    { label: '底面积', latex: `S_{底} \\approx ${fmt2(baseAreaNum)}` },
    { label: '斜高', latex: `l = \\sqrt{h^2 + r^2} \\approx ${fmt2(slantHeight)}` },
    { label: '侧面积', latex: `S_{侧} = \\dfrac{1}{2} \\times ${n} \\times ${fmt(a)} \\times ${fmt2(slantHeight)} \\approx ${fmt2(lateralNum)}` },
    { label: '总表面积', latex: `S \\approx ${fmt2(totalNum)}` },
  ];

  return { volume, totalArea, volumeSteps, surfaceSteps };
}

// ─── 工具函数 ───

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
