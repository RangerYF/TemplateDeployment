import type { CalculationResult } from '../types';
import { sqrt } from '../symbolic';

/**
 * 对棱垂直四面体计算器
 *
 * AB⊥CD, AC⊥BD, AD⊥BC
 * 构造：A=(-AB/2, d, 0), B=(AB/2, d, 0), C=(0, 0, -CD/2), D=(0, 0, CD/2)
 * 其中 d = √(AB² + CD²) / 2
 *
 * 其余 4 条棱等长：e = √((AB² + CD²) / 2)
 */
export function calculateOrthogonalTetrahedron(params: Record<string, number>): CalculationResult {
  const ab = params.edgeAB;
  const cd = params.edgeCD;

  const ab2 = ab * ab;
  const cd2 = cd * cd;
  const d = Math.sqrt(ab2 + cd2) / 2;
  const e2 = (ab2 + cd2) / 2; // 其余 4 条棱的平方
  const e = Math.sqrt(e2);

  // 体积：用行列式法
  // A=(-ab/2, d, 0), B=(ab/2, d, 0), C=(0, 0, -cd/2), D=(0, 0, cd/2)
  // V = |det([AB, AC, AD])| / 6
  // AB = (ab, 0, 0)
  // AC = (ab/2, -d, -cd/2)
  // AD = (ab/2, -d, cd/2)
  // det = ab * ((-d)(cd/2) - (-cd/2)(-d)) = ab * (-d·cd/2 - d·cd/2) = ab * (-d·cd)
  // |det| = ab·d·cd
  const volume = (ab * d * cd) / 6;

  // 表面积：4 个三角形
  // 两个面 ACB 和 ABD：底边 AB，顶点到 AB 的距离
  // 面 ACB：A=(-ab/2,d,0), C=(0,0,-cd/2), B=(ab/2,d,0)
  // 面 BCD：B=(ab/2,d,0), C=(0,0,-cd/2), D=(0,0,cd/2)
  // 用棱长计算：AC=AD=BC=BD=e, AB=ab, CD=cd

  // 面 ACB：三边 AC=e, CB=e, AB=ab → 等腰三角形
  const s1 = (e + e + ab) / 2;
  const area1 = Math.sqrt(Math.max(0, s1 * (s1 - e) * (s1 - e) * (s1 - ab)));

  // 面 ACD：三边 AC=e, CD=cd, AD=e → 等腰三角形
  const s2 = (e + e + cd) / 2;
  const area2 = Math.sqrt(Math.max(0, s2 * (s2 - e) * (s2 - e) * (s2 - cd)));

  // 共 4 个面：2 个底边为 AB 的 + 2 个底边为 CD 的
  const surfaceArea = 2 * area1 + 2 * area2;

  const eSymbolic = sqrt(e2);

  return {
    volume: {
      value: { latex: fmt2(volume), numeric: volume },
      steps: [
        {
          label: '对棱间距',
          latex: `d = \\dfrac{\\sqrt{AB^2 + CD^2}}{2} = ${fmt(d)}`,
        },
        {
          label: '体积公式',
          latex: `V = \\dfrac{AB \\times d \\times CD}{6}`,
        },
        {
          label: '代入数值',
          latex: `V = \\dfrac{${fmt(ab)} \\times ${fmt(d)} \\times ${fmt(cd)}}{6}`,
        },
        {
          label: '计算结果',
          latex: `V \\approx ${fmt2(volume)}`,
        },
      ],
    },
    surfaceArea: {
      value: { latex: fmt2(surfaceArea), numeric: surfaceArea },
      steps: [
        {
          label: '其余四棱等长',
          latex: `e = \\sqrt{\\dfrac{AB^2 + CD^2}{2}} = ${eSymbolic.latex}`,
        },
        {
          label: '含 AB 的面（×2）',
          latex: `S_1 = ${fmt2(area1)} \\times 2 = ${fmt2(2 * area1)}`,
        },
        {
          label: '含 CD 的面（×2）',
          latex: `S_2 = ${fmt2(area2)} \\times 2 = ${fmt2(2 * area2)}`,
        },
        {
          label: '总表面积',
          latex: `S = ${fmt2(surfaceArea)}`,
        },
      ],
    },
  };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}
