import type { CalculationResult, SymbolicValue } from '../types';

/**
 * 墙角四面体计算器
 * params: { edgeA (a), edgeB (b), edgeC (c) }
 *
 * 体积：V = abc/6
 * 底面积（斜面）：S_斜面 = ½√(a²b² + b²c² + a²c²)
 * 表面积：S = ½(ab + bc + ac) + S_斜面
 *
 * 手算验证（a=b=c=2）：
 * V = 8/6 = 4/3 ≈ 1.333
 * S_斜面 = ½√(16+16+16) = ½√48 = 2√3 ≈ 3.464
 * S = ½(4+4+4) + 2√3 = 6 + 2√3 ≈ 9.464
 */
export function calculateCornerTetrahedron(params: Record<string, number>): CalculationResult {
  const a = params.edgeA;
  const b = params.edgeB;
  const c = params.edgeC;

  const ab = a * b;
  const bc = b * c;
  const ac = a * c;
  const abc = a * b * c;

  // V = abc/6
  const volumeNumeric = abc / 6;

  // S_斜面 = ½√(a²b² + b²c² + a²c²)
  const slopeAreaSquaredInner = ab * ab + bc * bc + ac * ac;
  const slopeArea = Math.sqrt(slopeAreaSquaredInner) / 2;

  // 三个直角面面积
  const rightFaceArea = (ab + bc + ac) / 2;

  // S = ½(ab + bc + ac) + S_斜面
  const totalAreaNumeric = rightFaceArea + slopeArea;

  // 符号表达
  const { volume, volumeSteps } = buildVolumeSymbolic(a, b, c, abc, volumeNumeric);
  const { totalArea, surfaceSteps } = buildSurfaceSymbolic(a, b, c, ab, bc, ac, rightFaceArea, slopeAreaSquaredInner, slopeArea, totalAreaNumeric);

  return {
    volume: { value: volume, steps: volumeSteps },
    surfaceArea: { value: totalArea, steps: surfaceSteps },
  };
}

function buildVolumeSymbolic(a: number, b: number, c: number, abc: number, volumeNumeric: number) {
  // V = abc/6
  const g = gcd(Math.abs(Math.round(abc)), 6);
  const n = Math.round(abc) / g;
  const d = 6 / g;

  let volumeLatex: string;
  if (Number.isInteger(abc)) {
    if (d === 1) {
      volumeLatex = fmt(n);
    } else {
      volumeLatex = `\\dfrac{${fmt(n)}}{${fmt(d)}}`;
    }
  } else {
    volumeLatex = fmt2(volumeNumeric);
  }

  const volume: SymbolicValue = { latex: volumeLatex, numeric: volumeNumeric };

  const volumeSteps = [
    { label: '体积公式（墙角四面体）', latex: 'V = \\dfrac{abc}{6}' },
    { label: '代入数值', latex: `V = \\dfrac{${fmt(a)} \\times ${fmt(b)} \\times ${fmt(c)}}{6} = \\dfrac{${fmt(abc)}}{6}` },
    { label: '计算结果', latex: `V = ${volumeLatex} \\approx ${fmt2(volumeNumeric)}` },
  ];

  return { volume, volumeSteps };
}

function buildSurfaceSymbolic(
  _a: number, _b: number, _c: number,
  ab: number, bc: number, ac: number,
  rightFaceArea: number,
  slopeAreaSquaredInner: number, slopeArea: number,
  totalAreaNumeric: number,
) {
  // S_斜面 = ½√(a²b² + b²c² + a²c²)
  const slopeLatex = `\\dfrac{1}{2}\\sqrt{${fmt(slopeAreaSquaredInner)}}`;

  const totalArea: SymbolicValue = {
    latex: fmt2(totalAreaNumeric),
    numeric: totalAreaNumeric,
  };

  const surfaceSteps = [
    { label: '三个直角面面积', latex: `S_{直角} = \\dfrac{1}{2}(ab + bc + ac) = \\dfrac{1}{2}(${fmt(ab)} + ${fmt(bc)} + ${fmt(ac)}) = ${fmt2(rightFaceArea)}` },
    { label: '斜面面积', latex: `S_{斜面} = \\dfrac{1}{2}\\sqrt{a^2b^2 + b^2c^2 + a^2c^2} = ${slopeLatex} \\approx ${fmt2(slopeArea)}` },
    { label: '总表面积', latex: `S = S_{直角} + S_{斜面} = ${fmt2(rightFaceArea)} + ${fmt2(slopeArea)}` },
    { label: '计算结果', latex: `S \\approx ${fmt2(totalAreaNumeric)}` },
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
