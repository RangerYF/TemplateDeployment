import type { CalculationResult } from '../types';
import { sqrtFrac, frac, num, add } from '../symbolic';

/**
 * 墙角四面体计算器
 * params: { edgeA (a), edgeB (b), edgeC (c) }
 *
 * 体积：V = abc/6
 * 底面积（斜面）：S_斜面 = ½√(a²b² + b²c² + a²c²)
 * 表面积：S = ½(ab + bc + ac) + S_斜面
 */
export function calculateCornerTetrahedron(params: Record<string, number>): CalculationResult {
  const a = params.edgeA;
  const b = params.edgeB;
  const c = params.edgeC;

  const ab = a * b;
  const bc = b * c;
  const ac = a * c;
  const abc = a * b * c;

  const volume = abc / 6;

  const innerSum = ab * ab + bc * bc + ac * ac;
  const slopeArea = Math.sqrt(innerSum) / 2;

  const sumProd = ab + bc + ac;
  const rightArea = sumProd / 2;

  const surfaceArea = rightArea + slopeArea;

  // ── 符号表达 ──

  const volLatex = isNiceInt(abc) ? frac(Math.round(abc), 6).latex : fmt2(volume);

  const sumProdNice = isNiceInt(sumProd);
  let rightLatex: string;
  if (sumProdNice) {
    const sr = Math.round(sumProd);
    rightLatex = sr % 2 === 0 ? fmt(sr / 2) : frac(sr, 2).latex;
  } else {
    rightLatex = fmt2(rightArea);
  }

  const innerNice = isNiceInt(innerSum);
  let slopeSym: { latex: string; numeric: number };
  if (innerNice) {
    slopeSym = sqrtFrac(Math.round(innerSum), 2);
  } else {
    slopeSym = { latex: fmt2(slopeArea), numeric: slopeArea };
  }

  let totalLatex: string;
  let totalStepLatex: string;
  if (innerNice && sumProdNice) {
    const ir = Math.round(innerSum);
    const sqrtVal = Math.sqrt(ir);
    if (isNiceInt(sqrtVal)) {
      totalLatex = frac(Math.round(sumProd) + Math.round(sqrtVal), 2).latex;
      totalStepLatex = `S = ${rightLatex} + ${slopeSym.latex} = ${totalLatex} \\approx ${fmt2(surfaceArea)}`;
    } else {
      const sr = Math.round(sumProd);
      const rightSym = sr % 2 === 0 ? num(sr / 2) : frac(sr, 2);
      totalLatex = add(rightSym, slopeSym).latex;
      totalStepLatex = `S = ${totalLatex} \\approx ${fmt2(surfaceArea)}`;
    }
  } else {
    totalLatex = fmt2(surfaceArea);
    totalStepLatex = `S \\approx ${fmt2(surfaceArea)}`;
  }

  const slopeStepLatex = innerNice
    ? `S_{斜面} = \\dfrac{1}{2}\\sqrt{a^2b^2 + b^2c^2 + a^2c^2} = \\dfrac{1}{2}\\sqrt{${fmt(Math.round(innerSum))}} = ${slopeSym.latex} \\approx ${fmt2(slopeArea)}`
    : `S_{斜面} = \\dfrac{1}{2}\\sqrt{a^2b^2 + b^2c^2 + a^2c^2} \\approx ${fmt2(slopeArea)}`;

  return {
    volume: {
      value: { latex: volLatex, numeric: volume },
      steps: [
        { label: '体积公式（墙角四面体）', latex: 'V = \\dfrac{abc}{6}' },
        {
          label: '代入数值',
          latex: `V = \\dfrac{${fmt(a)} \\times ${fmt(b)} \\times ${fmt(c)}}{6} = \\dfrac{${fmt(abc)}}{6}`,
        },
        { label: '计算结果', latex: `V = ${volLatex} \\approx ${fmt2(volume)}` },
      ],
    },
    surfaceArea: {
      value: { latex: totalLatex, numeric: surfaceArea },
      steps: [
        {
          label: '三个直角面面积',
          latex: `S_{直角} = \\dfrac{ab + bc + ac}{2} = \\dfrac{${fmt(ab)} + ${fmt(bc)} + ${fmt(ac)}}{2} = ${rightLatex}`,
        },
        {
          label: '斜面面积',
          latex: slopeStepLatex,
        },
        {
          label: '总表面积',
          latex: totalStepLatex,
        },
      ],
    },
  };
}

function isNiceInt(n: number): boolean {
  return Math.abs(n - Math.round(n)) < 1e-9;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10000) / 10000);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
