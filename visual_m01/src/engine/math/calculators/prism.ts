import type { CalculationResult, SymbolicValue } from '../types';

/**
 * 正棱柱计算器
 * params: { sides (n), sideLength (a), height (h) }
 *
 * 底面积：S_底 = (n/4)·a²·cot(π/n)
 * 体积：V = S_底 · h
 * 侧面积：S_侧 = n·a·h
 * 表面积：S = S_侧 + 2·S_底
 *
 * 手算验证（正六棱柱 n=6, a=1.5, h=2）：
 * S_底 = (3√3/2)·2.25 ≈ 5.846
 * V = 5.846 × 2 ≈ 11.691
 * S_侧 = 6·1.5·2 = 18
 * S = 18 + 2·5.846 ≈ 29.691
 */
export function calculatePrism(params: Record<string, number>): CalculationResult {
  const n = params.sides;
  const a = params.sideLength;
  const h = params.height;

  const a2 = a * a;
  const tanPiN = Math.tan(Math.PI / n);
  const baseAreaNumeric = (n * a2) / (4 * tanPiN);
  const volumeNumeric = baseAreaNumeric * h;
  const lateralAreaNumeric = n * a * h;
  const totalAreaNumeric = lateralAreaNumeric + 2 * baseAreaNumeric;

  const { volume, totalArea, volumeSteps, surfaceSteps } =
    buildByN(n, a, a2, h, baseAreaNumeric, volumeNumeric, lateralAreaNumeric, totalAreaNumeric);

  return {
    volume: { value: volume, steps: volumeSteps },
    surfaceArea: { value: totalArea, steps: surfaceSteps },
  };
}

function buildByN(
  n: number, a: number, a2: number, h: number,
  baseAreaNum: number, volNum: number,
  lateralNum: number, totalNum: number,
) {
  if (n === 3) return buildN3(a, a2, h, baseAreaNum, volNum, lateralNum, totalNum);
  if (n === 4) return buildN4(a, a2, h, volNum, lateralNum, totalNum);
  if (n === 6) return buildN6(a, a2, h, baseAreaNum, volNum, lateralNum, totalNum);
  return buildGeneric(n, a, h, baseAreaNum, volNum, lateralNum, totalNum);
}

// ─── n=3：正三棱柱 ───
function buildN3(
  a: number, a2: number, h: number,
  _baseAreaNum: number, volNum: number,
  lateralNum: number, totalNum: number,
) {
  // S_底 = (√3/4)a²
  const baseCoeff = a2;
  let baseLatex: string;
  if (baseCoeff % 4 === 0 && Number.isInteger(baseCoeff)) {
    const simplified = baseCoeff / 4;
    baseLatex = simplified === 1 ? '\\sqrt{3}' : `${simplified}\\sqrt{3}`;
  } else {
    baseLatex = `\\dfrac{${fmt(baseCoeff)}\\sqrt{3}}{4}`;
  }
  // baseLatex used in steps below

  // V = S_底 · h = (√3/4)a²h
  const volCoeff = a2 * h;
  let volLatex: string;
  if (Number.isInteger(volCoeff) && volCoeff % 4 === 0) {
    const simplified = volCoeff / 4;
    volLatex = simplified === 1 ? '\\sqrt{3}' : `${simplified}\\sqrt{3}`;
  } else {
    volLatex = `\\dfrac{${fmt(volCoeff)}\\sqrt{3}}{4}`;
  }
  const volume: SymbolicValue = { latex: volLatex, numeric: volNum };

  const volumeSteps = [
    { label: '底面积公式（正三角形）', latex: 'S_{底} = \\dfrac{\\sqrt{3}}{4}a^2' },
    { label: '代入数值', latex: `S_{底} = \\dfrac{\\sqrt{3}}{4} \\times ${fmt(a)}^2 = ${baseLatex}` },
    { label: '体积公式', latex: 'V = S_{底} \\times h' },
    { label: '代入数值', latex: `V = ${baseLatex} \\times ${fmt(h)} = ${volLatex}` },
    { label: '计算结果', latex: `V = ${volLatex} \\approx ${fmt2(volNum)}` },
  ];

  const surfaceSteps = [
    { label: '底面积', latex: `S_{底} = ${baseLatex}` },
    { label: '侧面积', latex: `S_{侧} = 3 \\times ${fmt(a)} \\times ${fmt(h)} = ${fmt(lateralNum)}` },
    { label: '总表面积', latex: `S = S_{侧} + 2S_{底} = ${fmt(lateralNum)} + 2 \\times ${baseLatex} \\approx ${fmt2(totalNum)}` },
    { label: '计算结果', latex: `S \\approx ${fmt2(totalNum)}` },
  ];

  return { volume, totalArea: { latex: fmt2(totalNum), numeric: totalNum } as SymbolicValue, volumeSteps, surfaceSteps };
}

// ─── n=4：正四棱柱 ───
function buildN4(
  a: number, a2: number, h: number,
  volNum: number, lateralNum: number, totalNum: number,
) {
  // S_底 = a²
  const baseLatex = fmt(a2);

  // V = a²·h
  const volVal = a2 * h;
  const volume: SymbolicValue = { latex: fmt(volVal), numeric: volNum };

  const volumeSteps = [
    { label: '底面积（正方形）', latex: 'S_{底} = a^2' },
    { label: '代入数值', latex: `S_{底} = ${fmt(a)}^2 = ${baseLatex}` },
    { label: '体积公式', latex: 'V = S_{底} \\times h' },
    { label: '代入数值', latex: `V = ${baseLatex} \\times ${fmt(h)} = ${fmt(volVal)}` },
    { label: '计算结果', latex: `V = ${fmt(volVal)}` },
  ];

  const surfaceSteps = [
    { label: '底面积', latex: `S_{底} = ${baseLatex}` },
    { label: '侧面积', latex: `S_{侧} = 4 \\times ${fmt(a)} \\times ${fmt(h)} = ${fmt(lateralNum)}` },
    { label: '总表面积', latex: `S = ${fmt(lateralNum)} + 2 \\times ${baseLatex} = ${fmt(totalNum)}` },
  ];

  return { volume, totalArea: { latex: fmt(totalNum), numeric: totalNum } as SymbolicValue, volumeSteps, surfaceSteps };
}

// ─── n=6：正六棱柱 ───
function buildN6(
  a: number, a2: number, h: number,
  _baseAreaNum: number, volNum: number,
  lateralNum: number, totalNum: number,
) {
  // S_底 = (3√3/2)a²
  const baseCoeff = 3 * a2;
  let baseLatex: string;
  if (Number.isInteger(baseCoeff) && baseCoeff % 2 === 0) {
    const simplified = baseCoeff / 2;
    baseLatex = simplified === 1 ? '\\sqrt{3}' : `${fmt(simplified)}\\sqrt{3}`;
  } else {
    baseLatex = `\\dfrac{${fmt(baseCoeff)}\\sqrt{3}}{2}`;
  }
  // baseLatex used in steps below

  // V = S_底 · h
  const volCoeff = 3 * a2 * h;
  let volLatex: string;
  if (Number.isInteger(volCoeff) && volCoeff % 2 === 0) {
    const simplified = volCoeff / 2;
    volLatex = simplified === 1 ? '\\sqrt{3}' : `${fmt(simplified)}\\sqrt{3}`;
  } else {
    volLatex = `\\dfrac{${fmt(volCoeff)}\\sqrt{3}}{2}`;
  }
  const volume: SymbolicValue = { latex: volLatex, numeric: volNum };

  const volumeSteps = [
    { label: '底面积公式（正六边形）', latex: 'S_{底} = \\dfrac{3\\sqrt{3}}{2}a^2' },
    { label: '代入数值', latex: `S_{底} = \\dfrac{3\\sqrt{3}}{2} \\times ${fmt(a)}^2 = ${baseLatex}` },
    { label: '体积公式', latex: 'V = S_{底} \\times h' },
    { label: '代入数值', latex: `V = ${baseLatex} \\times ${fmt(h)} = ${volLatex}` },
    { label: '计算结果', latex: `V = ${volLatex} \\approx ${fmt2(volNum)}` },
  ];

  const surfaceSteps = [
    { label: '底面积', latex: `S_{底} = ${baseLatex}` },
    { label: '侧面积', latex: `S_{侧} = 6 \\times ${fmt(a)} \\times ${fmt(h)} = ${fmt(lateralNum)}` },
    { label: '总表面积', latex: `S = ${fmt(lateralNum)} + 2 \\times ${baseLatex} \\approx ${fmt2(totalNum)}` },
    { label: '计算结果', latex: `S \\approx ${fmt2(totalNum)}` },
  ];

  return { volume, totalArea: { latex: fmt2(totalNum), numeric: totalNum } as SymbolicValue, volumeSteps, surfaceSteps };
}

// ─── 通用 n 棱柱 ───
function buildGeneric(
  n: number, a: number, h: number,
  baseAreaNum: number, volNum: number,
  lateralNum: number, totalNum: number,
) {
  const volume: SymbolicValue = { latex: fmt2(volNum), numeric: volNum };
  const totalArea: SymbolicValue = { latex: fmt2(totalNum), numeric: totalNum };

  const volumeSteps = [
    { label: '底面积公式', latex: `S_{底} = \\dfrac{na^2}{4\\tan(\\pi/n)}` },
    { label: '代入数值', latex: `S_{底} = \\dfrac{${n} \\times ${fmt(a)}^2}{4\\tan(\\pi/${n})} \\approx ${fmt2(baseAreaNum)}` },
    { label: '体积公式', latex: 'V = S_{底} \\times h' },
    { label: '代入数值', latex: `V \\approx ${fmt2(baseAreaNum)} \\times ${fmt(h)} \\approx ${fmt2(volNum)}` },
    { label: '计算结果', latex: `V \\approx ${fmt2(volNum)}` },
  ];

  const surfaceSteps = [
    { label: '底面积', latex: `S_{底} \\approx ${fmt2(baseAreaNum)}` },
    { label: '侧面积', latex: `S_{侧} = ${n} \\times ${fmt(a)} \\times ${fmt(h)} = ${fmt(lateralNum)}` },
    { label: '总表面积', latex: `S = ${fmt(lateralNum)} + 2 \\times ${fmt2(baseAreaNum)} \\approx ${fmt2(totalNum)}` },
  ];

  return { volume, totalArea, volumeSteps, surfaceSteps };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
