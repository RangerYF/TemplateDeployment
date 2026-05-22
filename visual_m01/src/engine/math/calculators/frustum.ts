import type { CalculationResult, SymbolicValue } from '../types';
import { sqrt, sqrtFrac, frac, num, add } from '../symbolic';

/**
 * 棱台计算器
 * V = (h/3)(S₁ + S₂ + √(S₁S₂))
 * S = S₁ + S₂ + S_侧
 */
export function calculateFrustum(params: Record<string, number>): CalculationResult {
  const n = Math.max(3, Math.min(8, Math.round(params.sides)));
  const a1 = params.topSideLength;
  const a2 = params.bottomSideLength;
  const h = params.height;

  const cotPiN = 1 / Math.tan(Math.PI / n);
  const S1 = (n / 4) * a1 * a1 * cotPiN;
  const S2 = (n / 4) * a2 * a2 * cotPiN;
  const sqrtS1S2 = Math.sqrt(S1 * S2);
  const volume = (h / 3) * (S1 + S2 + sqrtS1S2);

  const apothem1 = a1 / (2 * Math.tan(Math.PI / n));
  const apothem2 = a2 / (2 * Math.tan(Math.PI / n));
  const slantHeight = Math.sqrt(h * h + (apothem2 - apothem1) ** 2);
  const sLateral = 0.5 * n * (a1 + a2) * slantHeight;
  const surfaceArea = S1 + S2 + sLateral;

  if (n === 4) return buildN4(a1, a2, h, volume, slantHeight, sLateral, surfaceArea);
  if (n === 3) return buildN3(a1, a2, h, volume, slantHeight, sLateral, surfaceArea);
  if (n === 6) return buildN6(a1, a2, h, volume, slantHeight, sLateral, surfaceArea);
  return buildGeneric(n, a1, a2, h, S1, S2, volume, slantHeight, sLateral, surfaceArea);
}

// ─── n=4：正四棱台 ───
function buildN4(
  a1: number, a2: number, h: number,
  volNum: number, slantHeight: number, lateralNum: number, totalNum: number,
): CalculationResult {
  const a1sq = a1 * a1;
  const a2sq = a2 * a2;
  const prod = a1 * a2;
  const sumForVol = a1sq + a2sq + prod;
  const hSum = h * sumForVol;

  const volSym: SymbolicValue = isNiceInt(hSum)
    ? frac(Math.round(hSum), 3)
    : { latex: fmt2(volNum), numeric: volNum };

  // slant² = h² + (a₂-a₁)²/4 = (4h²+(a₂-a₁)²)/4
  const da = a2 - a1;
  const slantInner = 4 * h * h + da * da;
  const slantNice = isNiceInt(slantInner);
  const slantSym = slantNice
    ? sqrtFrac(Math.round(slantInner), 2)
    : { latex: fmt2(slantHeight), numeric: slantHeight };

  // lateral = 2(a₁+a₂)×slant = (a₁+a₂)×√slantInner
  const sumA = a1 + a2;
  const lateralRad = sumA * sumA * slantInner;
  const lateralNice = slantNice && isNiceInt(lateralRad);
  const lateralSym: SymbolicValue = lateralNice
    ? sqrt(Math.round(lateralRad))
    : { latex: fmt2(lateralNum), numeric: lateralNum };

  const baseSumNice = isNiceInt(a1sq + a2sq);
  const totalSym: SymbolicValue = lateralNice && baseSumNice
    ? add(num(Math.round(a1sq + a2sq)), lateralSym)
    : { latex: fmt2(totalNum), numeric: totalNum };

  return {
    volume: {
      value: volSym,
      steps: [
        { label: '体积公式', latex: 'V = \\dfrac{h}{3}(S_1 + S_2 + \\sqrt{S_1 S_2})' },
        { label: '底面积', latex: `S_1 = a_1^2 = ${fmt(a1sq)},\\; S_2 = a_2^2 = ${fmt(a2sq)},\\; \\sqrt{S_1 S_2} = a_1 a_2 = ${fmt(prod)}` },
        { label: '代入数值', latex: `V = \\dfrac{${fmt(h)}}{3}(${fmt(a1sq)} + ${fmt(a2sq)} + ${fmt(prod)}) = ${volSym.latex}` },
        { label: '计算结果', latex: `V = ${volSym.latex} \\approx ${fmt2(volNum)}` },
      ],
    },
    surfaceArea: {
      value: totalSym,
      steps: [
        { label: '斜高', latex: `h' = \\sqrt{h^2 + (a_2' - a_1')^2} = ${slantSym.latex} \\approx ${fmt2(slantHeight)}` },
        { label: '侧面积', latex: `S_{侧} = \\dfrac{1}{2} \\times 4 \\times (${fmt(a1)} + ${fmt(a2)}) \\times h' = ${lateralSym.latex} \\approx ${fmt2(lateralNum)}` },
        { label: '总表面积', latex: `S = ${fmt(a1sq)} + ${fmt(a2sq)} + ${lateralSym.latex} \\approx ${fmt2(totalNum)}` },
      ],
    },
  };
}

// ─── n=3：正三棱台 ───
function buildN3(
  a1: number, a2: number, h: number,
  volNum: number, slantHeight: number, lateralNum: number, totalNum: number,
): CalculationResult {
  const a1sq = a1 * a1;
  const a2sq = a2 * a2;
  const prod = a1 * a2;
  const sumForVol = a1sq + a2sq + prod;
  const hSum = h * sumForVol;
  const da = a2 - a1;

  // V = h√3(a₁²+a₂²+a₁a₂)/12
  const volSym: SymbolicValue = isNiceInt(hSum)
    ? sqrt3Frac(Math.round(hSum), 12)
    : { latex: fmt2(volNum), numeric: volNum };

  const base1Latex = isNiceInt(a1sq) ? sqrt3Frac(Math.round(a1sq), 4).latex : fmt2(a1sq * Math.sqrt(3) / 4);
  const base2Latex = isNiceInt(a2sq) ? sqrt3Frac(Math.round(a2sq), 4).latex : fmt2(a2sq * Math.sqrt(3) / 4);

  // slant² = (12h²+Δa²)/12, rationalized: √(3(12h²+Δa²))/6
  const slantInner = 12 * h * h + da * da;
  const slantNice = isNiceInt(slantInner);
  const slantSym = slantNice
    ? sqrtFrac(3 * Math.round(slantInner), 6)
    : { latex: fmt2(slantHeight), numeric: slantHeight };

  // lateral = (a₁+a₂)√(3·slantInner)/4
  const sumA = a1 + a2;
  const lateralRad = 3 * sumA * sumA * slantInner;
  const lateralNice = slantNice && isNiceInt(lateralRad);
  const lateralSym: SymbolicValue = lateralNice
    ? sqrtFrac(Math.round(lateralRad), 4)
    : { latex: fmt2(lateralNum), numeric: lateralNum };

  const sumA2 = a1sq + a2sq;
  let totalSym: SymbolicValue;
  if (isNiceInt(sumA2) && lateralNice) {
    totalSym = add(sqrt3Frac(Math.round(sumA2), 4), lateralSym);
  } else {
    totalSym = { latex: fmt2(totalNum), numeric: totalNum };
  }

  return {
    volume: {
      value: volSym,
      steps: [
        { label: '体积公式', latex: 'V = \\dfrac{h}{3}(S_1 + S_2 + \\sqrt{S_1 S_2})' },
        { label: '底面积', latex: `S_1 = ${base1Latex},\\; S_2 = ${base2Latex}` },
        { label: '代入数值', latex: `V = \\dfrac{${fmt(h)}\\sqrt{3}}{12} \\times (${fmt(a1sq)} + ${fmt(a2sq)} + ${fmt(prod)}) = ${volSym.latex}` },
        { label: '计算结果', latex: `V = ${volSym.latex} \\approx ${fmt2(volNum)}` },
      ],
    },
    surfaceArea: {
      value: totalSym,
      steps: [
        { label: '斜高', latex: `h' = \\sqrt{h^2 + (a_2' - a_1')^2} = ${slantSym.latex} \\approx ${fmt2(slantHeight)}` },
        { label: '侧面积', latex: `S_{侧} = \\dfrac{1}{2} \\times 3 \\times (${fmt(a1)} + ${fmt(a2)}) \\times h' = ${lateralSym.latex} \\approx ${fmt2(lateralNum)}` },
        { label: '总表面积', latex: `S = S_1 + S_2 + S_{侧} = ${totalSym.latex} \\approx ${fmt2(totalNum)}` },
      ],
    },
  };
}

// ─── n=6：正六棱台 ───
function buildN6(
  a1: number, a2: number, h: number,
  volNum: number, slantHeight: number, lateralNum: number, totalNum: number,
): CalculationResult {
  const a1sq = a1 * a1;
  const a2sq = a2 * a2;
  const prod = a1 * a2;
  const sumForVol = a1sq + a2sq + prod;
  const hSum = h * sumForVol;
  const da = a2 - a1;

  // V = h√3(a₁²+a₂²+a₁a₂)/2
  const volSym: SymbolicValue = isNiceInt(hSum)
    ? sqrt3Frac(Math.round(hSum), 2)
    : { latex: fmt2(volNum), numeric: volNum };

  const base1Latex = isNiceInt(a1sq) ? sqrt3Frac(3 * Math.round(a1sq), 2).latex : fmt2(a1sq * Math.sqrt(3) * 1.5);
  const base2Latex = isNiceInt(a2sq) ? sqrt3Frac(3 * Math.round(a2sq), 2).latex : fmt2(a2sq * Math.sqrt(3) * 1.5);

  // slant² = (4h²+3Δa²)/4
  const slantInner = 4 * h * h + 3 * da * da;
  const slantNice = isNiceInt(slantInner);
  const slantSym = slantNice
    ? sqrtFrac(Math.round(slantInner), 2)
    : { latex: fmt2(slantHeight), numeric: slantHeight };

  // lateral = 3(a₁+a₂)×slant = √(9·sumA²·slantInner)/2
  const sumA = a1 + a2;
  const lateralRad = 9 * sumA * sumA * slantInner;
  const lateralNice = slantNice && isNiceInt(lateralRad);
  const lateralSym: SymbolicValue = lateralNice
    ? sqrtFrac(Math.round(lateralRad), 2)
    : { latex: fmt2(lateralNum), numeric: lateralNum };

  const sumA2 = a1sq + a2sq;
  let totalSym: SymbolicValue;
  if (isNiceInt(sumA2) && lateralNice) {
    totalSym = add(sqrt3Frac(3 * Math.round(sumA2), 2), lateralSym);
  } else {
    totalSym = { latex: fmt2(totalNum), numeric: totalNum };
  }

  return {
    volume: {
      value: volSym,
      steps: [
        { label: '体积公式', latex: 'V = \\dfrac{h}{3}(S_1 + S_2 + \\sqrt{S_1 S_2})' },
        { label: '底面积', latex: `S_1 = ${base1Latex},\\; S_2 = ${base2Latex}` },
        { label: '代入数值', latex: `V = \\dfrac{${fmt(h)}\\sqrt{3}}{2} \\times (${fmt(a1sq)} + ${fmt(a2sq)} + ${fmt(prod)}) = ${volSym.latex}` },
        { label: '计算结果', latex: `V = ${volSym.latex} \\approx ${fmt2(volNum)}` },
      ],
    },
    surfaceArea: {
      value: totalSym,
      steps: [
        { label: '斜高', latex: `h' = \\sqrt{h^2 + (a_2' - a_1')^2} = ${slantSym.latex} \\approx ${fmt2(slantHeight)}` },
        { label: '侧面积', latex: `S_{侧} = \\dfrac{1}{2} \\times 6 \\times (${fmt(a1)} + ${fmt(a2)}) \\times h' = ${lateralSym.latex} \\approx ${fmt2(lateralNum)}` },
        { label: '总表面积', latex: `S = S_1 + S_2 + S_{侧} = ${totalSym.latex} \\approx ${fmt2(totalNum)}` },
      ],
    },
  };
}

// ─── 通用 n 棱台（数值近似） ───
function buildGeneric(
  n: number, a1: number, a2: number, h: number,
  S1: number, S2: number,
  volume: number, slantHeight: number, sLateral: number, surfaceArea: number,
): CalculationResult {
  return {
    volume: {
      value: { latex: fmt2(volume), numeric: volume },
      steps: [
        { label: '体积公式', latex: 'V = \\dfrac{h}{3}(S_1 + S_2 + \\sqrt{S_1 S_2})' },
        { label: '底面积', latex: `S_1 = ${fmt(S1)}, \\quad S_2 = ${fmt(S2)}` },
        { label: '代入数值', latex: `V = \\dfrac{${fmt(h)}}{3} \\times (${fmt(S1)} + ${fmt(S2)} + \\sqrt{${fmt(S1 * S2)}})` },
        { label: '计算结果', latex: `V \\approx ${fmt2(volume)}` },
      ],
    },
    surfaceArea: {
      value: { latex: fmt2(surfaceArea), numeric: surfaceArea },
      steps: [
        { label: '斜高', latex: `h' = \\sqrt{h^2 + (a_2' - a_1')^2} \\approx ${fmt2(slantHeight)}` },
        { label: '侧面积', latex: `S_{侧} = \\frac{1}{2} \\times ${n} \\times (${fmt(a1)} + ${fmt(a2)}) \\times h' \\approx ${fmt2(sLateral)}` },
        { label: '总表面积', latex: `S \\approx ${fmt2(surfaceArea)}` },
      ],
    },
  };
}

// ─── 工具函数 ───

function sqrt3Frac(coeff: number, den: number): SymbolicValue {
  const g = gcd(Math.abs(coeff), Math.abs(den));
  const n = coeff / g;
  const d = den / g;
  let latex: string;
  if (d === 1) {
    latex = n === 1 ? '\\sqrt{3}' : `${n}\\sqrt{3}`;
  } else {
    const numPart = n === 1 ? '\\sqrt{3}' : `${n}\\sqrt{3}`;
    latex = `\\dfrac{${numPart}}{${d}}`;
  }
  return { latex, numeric: (coeff / den) * Math.sqrt(3) };
}

function isNiceInt(n: number): boolean {
  return Math.abs(n - Math.round(n)) < 1e-9;
}

function gcd(a: number, b: number): number {
  a = Math.round(Math.abs(a));
  b = Math.round(Math.abs(b));
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
