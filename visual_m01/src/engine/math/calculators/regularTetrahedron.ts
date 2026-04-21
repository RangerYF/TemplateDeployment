import type { CalculationResult, SymbolicValue } from '../types';

/**
 * 正四面体计算器
 * params: { sideLength (a) }
 *
 * 体积：V = (√2/12)·a³
 * 表面积：S = √3·a²
 *
 * 手算验证（a=2）：
 * V = (√2/12)·8 = 2√2/3 ≈ 0.943
 * S = √3·4 = 4√3 ≈ 6.928
 */
export function calculateRegularTetrahedron(params: Record<string, number>): CalculationResult {
  const a = params.sideLength;
  const a2 = a * a;
  const a3 = a2 * a;

  // 体积 V = (√2/12)·a³
  const volumeNumeric = (Math.SQRT2 / 12) * a3;

  // 表面积 S = √3·a²（4 个等边三角形 = 4 × (√3/4)a²）
  const totalAreaNumeric = Math.sqrt(3) * a2;

  // 符号表达
  const { volume, volumeSteps } = buildVolumeSymbolic(a, a3, volumeNumeric);
  const { totalArea, surfaceSteps } = buildSurfaceSymbolic(a, a2, totalAreaNumeric);

  return {
    volume: { value: volume, steps: volumeSteps },
    surfaceArea: { value: totalArea, steps: surfaceSteps },
  };
}

function buildVolumeSymbolic(a: number, a3: number, volumeNumeric: number) {
  // V = (√2/12)·a³ = a³√2/12
  // 化简分数 a³/12
  const g = gcd(Math.abs(Math.round(a3)), 12);
  const n = Math.round(a3) / g;
  const d = 12 / g;

  let volumeLatex: string;
  if (Number.isInteger(a3) && a3 > 0) {
    if (d === 1) {
      volumeLatex = n === 1 ? '\\sqrt{2}' : `${n}\\sqrt{2}`;
    } else {
      volumeLatex = `\\dfrac{${n === 1 ? '' : n}\\sqrt{2}}{${d}}`;
    }
  } else {
    volumeLatex = fmt2(volumeNumeric);
  }

  const volume: SymbolicValue = { latex: volumeLatex, numeric: volumeNumeric };

  const volumeSteps = [
    { label: '体积公式（正四面体）', latex: 'V = \\dfrac{\\sqrt{2}}{12}a^3' },
    { label: '代入数值', latex: `V = \\dfrac{\\sqrt{2}}{12} \\times ${fmt(a)}^3` },
    { label: '计算结果', latex: `V = ${volumeLatex} \\approx ${fmt2(volumeNumeric)}` },
  ];

  return { volume, volumeSteps };
}

function buildSurfaceSymbolic(a: number, a2: number, totalAreaNumeric: number) {
  // S = √3·a² = a²√3
  let totalLatex: string;
  if (Number.isInteger(a2) && a2 > 0) {
    totalLatex = a2 === 1 ? '\\sqrt{3}' : `${fmt(a2)}\\sqrt{3}`;
  } else {
    totalLatex = fmt2(totalAreaNumeric);
  }

  const totalArea: SymbolicValue = { latex: totalLatex, numeric: totalAreaNumeric };

  const surfaceSteps = [
    { label: '单面面积（等边三角形）', latex: 'S_{面} = \\dfrac{\\sqrt{3}}{4}a^2' },
    { label: '表面积公式（4个面）', latex: 'S = 4 \\times \\dfrac{\\sqrt{3}}{4}a^2 = \\sqrt{3}a^2' },
    { label: '代入数值', latex: `S = \\sqrt{3} \\times ${fmt(a)}^2 = ${totalLatex}` },
    { label: '计算结果', latex: `S = ${totalLatex} \\approx ${fmt2(totalAreaNumeric)}` },
  ];

  return { totalArea, surfaceSteps };
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
