import type { PresetData } from '../editor/entities/types';

// ─── VEC-001 向量基本要素预设 ───

export const CONCEPT_PRESETS: PresetData[] = [
  {
    id: 'VEC-001-A',
    name: '一般向量',
    operation: 'concept',
    vecA: [3, 2],
    teachingPoint: '向量有方向和大小（模），自由向量位置不限',
    teachingPoints: [
      '向量是有方向的线段（有向线段）',
      '两向量相等：方向相同，模相等',
      '自由向量：起点位置不影响向量本身',
      '虚线副本与原向量表示相同向量',
    ],
  },
  {
    id: 'VEC-001-B',
    name: '单位向量',
    operation: 'concept',
    vecA: [1, 0],
    teachingPoint: '|a|=1 称为单位向量，用于表示方向',
    teachingPoints: [
      '单位向量模长为 1',
      'x 轴正方向单位向量记为 i=(1,0)',
      'y 轴正方向单位向量记为 j=(0,1)',
    ],
  },
];

// ─── VEC-002 坐标表示预设 ───

export const COORDINATE_PRESETS: PresetData[] = [
  {
    id: 'VEC-002-A',
    name: '一般情形',
    operation: 'coordinate',
    vecA: [3, 4],
    teachingPoint: 'a=(3,4)，|a|=√(9+16)=5，勾股定理验证',
    teachingPoints: [
      '向量坐标 = 终点坐标 − 起点坐标',
      '横分量 x=3，纵分量 y=4',
      '|a|=√(x²+y²)=5（勾股定理）',
    ],
  },
  {
    id: 'VEC-002-B',
    name: '含负分量',
    operation: 'coordinate',
    vecA: [-2, 3],
    teachingPoint: 'a=(-2,3)，坐标可以为负数',
    teachingPoints: [
      '坐标可以是负数',
      '负号表示方向在对应轴负方向',
      '|a|=√(4+9)=√13≈3.61',
    ],
  },
];

// ─── VEC-011 平行四边形法则预设 ───

export const PARALLELOGRAM_PRESETS: PresetData[] = [
  {
    id: 'VEC-011-A',
    name: '直角情形',
    operation: 'parallelogram',
    vecA: [3, 0],
    vecB: [0, 4],
    teachingPoint: '两向量垂直时，|a+b| = √(|a|²+|b|²) = 5',
    teachingPoints: [
      '向量加法满足交换律：a+b = b+a',
      '平行四边形对角线即为和向量',
      '直角情形可直接用勾股定理求模',
    ],
  },
  {
    id: 'VEC-011-B',
    name: '一般情形',
    operation: 'parallelogram',
    vecA: [2, 1],
    vecB: [1, 3],
    teachingPoint: '一般情形：和向量在平行四边形对角线上',
    teachingPoints: [
      '以两向量为邻边作平行四边形',
      '对角线即为和向量 a+b = (3,4)',
      '向量加法满足结合律：(a+b)+c = a+(b+c)',
    ],
  },
  {
    id: 'VEC-011-C',
    name: '一个分量为负',
    operation: 'parallelogram',
    vecA: [3, 2],
    vecB: [-1, 2],
    teachingPoint: '分量有负值时，法则同样成立',
    teachingPoints: [
      '坐标分量可以是负数',
      '和向量 a+b = (2,4)',
      '平行四边形法则对任意向量均成立',
    ],
  },
  {
    id: 'VEC-011-D',
    name: '相反向量',
    operation: 'parallelogram',
    vecA: [4, 0],
    vecB: [-4, 0],
    teachingPoint: '相反向量之和为零向量',
    teachingPoints: [
      'a 与 -a 互为相反向量',
      '相反向量之和 a+(-a) = 0',
      '零向量模为0，方向任意',
    ],
  },
  {
    id: 'VEC-011-E',
    name: '同向向量',
    operation: 'parallelogram',
    vecA: [2, 3],
    vecB: [2, 3],
    teachingPoint: '同向向量（a=b）退化为线段，模加倍',
    teachingPoints: [
      '两向量平行时，平行四边形退化',
      'a+b = 2a，模为 |a| 的2倍',
      '共线向量首尾相接更直观',
    ],
  },
];

// ─── VEC-012 三角形法则预设 ───

export const TRIANGLE_PRESETS: PresetData[] = [
  {
    id: 'VEC-012-A',
    name: '基本示例',
    operation: 'triangle',
    vecA: [3, 1],
    vecB: [1, 3],
    teachingPoint: '首尾相接：b 的起点接在 a 的终点，可通过 + 添加更多向量',
    teachingPoints: [
      '首尾相接法：前一个向量终点即为下一个起点',
      '从链首到链尾的连线即为总和向量',
      '点击 + 按钮添加更多向量，体验 n 向量首尾相接',
    ],
  },
];

// ─── VEC-021 向量减法预设 ───

export const SUBTRACTION_PRESETS: PresetData[] = [
  {
    id: 'VEC-021-A',
    name: '基本减法',
    operation: 'subtraction',
    vecA: [4, 3],
    vecB: [1, 2],
    teachingPoint: '共起点，由 b 终点指向 a 终点',
    teachingPoints: [
      'a-b 从 b 的终点指向 a 的终点',
      '减法等价于加上相反向量：a-b = a+(-b)',
      '坐标运算：对应坐标相减',
    ],
  },
  {
    id: 'VEC-021-B',
    name: '直角情形',
    operation: 'subtraction',
    vecA: [3, 0],
    vecB: [0, 3],
    teachingPoint: 'a-b = (3,-3)，模为 3√2',
    teachingPoints: [
      'a 和 b 垂直时，差向量模为 √(|a|²+|b|²)',
      '与加法对称：a+b 和 a-b 互相垂直且等模',
    ],
  },
  {
    id: 'VEC-021-C',
    name: '相等向量相减',
    operation: 'subtraction',
    vecA: [2, 3],
    vecB: [2, 3],
    teachingPoint: 'a=b 时，a-b = 零向量',
    teachingPoints: [
      '相等向量相减结果为零向量',
      '零向量模为0',
    ],
  },
];

// ─── VEC-031 数乘向量预设 ───

export const SCALAR_PRESETS: PresetData[] = [
  {
    id: 'VEC-031-A',
    name: '完整变化',
    operation: 'scalar',
    vecA: [2, 1],
    scalarK: 2,
    teachingPoint: 'k 从 -2 到 3：方向反转、缩放的完整变化',
    teachingPoints: [
      'k>0：方向不变，模变为 k 倍',
      'k<0：方向相反，模变为 |k| 倍',
      'k=0：结果为零向量',
    ],
  },
  {
    id: 'VEC-031-B',
    name: '水平方向',
    operation: 'scalar',
    vecA: [1, 0],
    scalarK: 3,
    teachingPoint: '单位向量 i 的数乘：k·i',
    teachingPoints: [
      '水平方向向量的数乘直观',
      'k·i 对应 x 轴方向的拉伸',
    ],
  },
  {
    id: 'VEC-031-C',
    name: '反向',
    operation: 'scalar',
    vecA: [3, 4],
    scalarK: -1,
    teachingPoint: 'k=-1 时，k·a = -a（相反向量）',
    teachingPoints: [
      '-a 与 a 方向相反，模相等',
      '(-1)·a 是 a 的相反向量',
    ],
  },
];

// ─── VEC-041 数量积预设 ───

export const DOT_PRODUCT_PRESETS: PresetData[] = [
  {
    id: 'VEC-041-A',
    name: '垂直情形',
    operation: 'dotProduct',
    vecA: [3, 0],
    vecB: [0, 4],
    teachingPoint: 'a⊥b 时，a·b=0（cosθ=0，θ=90°）',
    teachingPoints: [
      'a·b = 0 ⟺ a ⊥ b（非零向量）',
      '垂直是数量积为零的充要条件',
    ],
  },
  {
    id: 'VEC-041-B',
    name: '同向情形',
    operation: 'dotProduct',
    vecA: [3, 0],
    vecB: [4, 0],
    teachingPoint: '同向时，a·b = |a||b|（θ=0°）',
    teachingPoints: [
      '同向时点积取最大值 |a||b|',
      '点积 = 3×4 = 12',
    ],
  },
  {
    id: 'VEC-041-C',
    name: '反向情形',
    operation: 'dotProduct',
    vecA: [3, 0],
    vecB: [-4, 0],
    teachingPoint: '反向时，a·b = -|a||b|（θ=180°）',
    teachingPoints: [
      '反向时点积取最小值 -|a||b|',
      '点积 = 3×(-4) = -12',
    ],
  },
  {
    id: 'VEC-041-D',
    name: '45°垂直验证',
    operation: 'dotProduct',
    vecA: [1, 1],
    vecB: [1, -1],
    teachingPoint: '(1,1)·(1,-1) = 1-1 = 0，两者垂直',
    teachingPoints: [
      '坐标法验证垂直：x₁x₂+y₁y₂=0',
      '两对角线方向向量互相垂直',
    ],
  },
  {
    id: 'VEC-041-E',
    name: '一般情形',
    operation: 'dotProduct',
    vecA: [3, 4],
    vecB: [4, 3],
    teachingPoint: 'a·b = 12+12 = 24，cosθ = 24/25',
    teachingPoints: [
      '坐标法：a·b = x₁x₂+y₁y₂',
      '求夹角：cosθ = a·b/(|a||b|)',
      'θ = arccos(24/25) ≈ 16.3°',
    ],
  },
  {
    id: 'VEC-041-F',
    name: '极化恒等式',
    operation: 'dotProduct',
    vecA: [3, 1],
    vecB: [1, 3],
    teachingPoint: 'a·b = (|a+b|²−|a−b|²)/4，用模长求点积',
    teachingPoints: [
      '极化恒等式：a·b = (|a+b|² − |a−b|²) / 4',
      '另一形式：|a+b|² + |a−b|² = 2(|a|² + |b|²)',
      '可通过度量模长间接求点积',
      '适用于只知道模长、不知坐标的情形',
    ],
  },
  {
    id: 'VEC-041-G',
    name: '投影演示',
    operation: 'dotProduct',
    vecA: [1, 4],
    vecB: [5, 2],
    teachingPoint: '投影 = a·b/|b|，投影向量 = (a·b/|b|²)·b',
    teachingPoints: [
      '投影标量 = |a|cosθ = a·b / |b|',
      '投影向量 = 标量投影 × b 方向单位向量',
      '投影是 a 在 b 方向的"影子"',
      '几何意义：从 a 终点向 b 所在直线作垂线',
    ],
  },
];

// ─── VEC-051 基底分解预设 ───

export const DECOMPOSITION_PRESETS: PresetData[] = [
  {
    id: 'VEC-051-A',
    name: '标准正交基',
    operation: 'decomposition',
    decompTarget: [5, 3],
    basis1: [1, 0],
    basis2: [0, 1],
    teachingPoint: '标准正交基：分解系数即为坐标分量 (5,3)',
    teachingPoints: [
      '坐标本质是在标准正交基下的分解',
      '正交基（互相垂直的单位向量）最方便',
      '5·e₁ + 3·e₂ = (5,3)',
    ],
  },
  {
    id: 'VEC-051-B',
    name: '45°旋转基',
    operation: 'decomposition',
    decompTarget: [5, 3],
    basis1: [1, 1],
    basis2: [1, -1],
    teachingPoint: 'e₁=(1,1), e₂=(1,-1) 正交但非单位',
    teachingPoints: [
      '正交非单位基：分解系数不等于坐标',
      '4·e₁ + 1·e₂ = 4(1,1)+1(1,-1) = (5,3)',
      '两个基底向量互相垂直',
    ],
  },
  {
    id: 'VEC-051-C',
    name: '斜交基',
    operation: 'decomposition',
    decompTarget: [5, 3],
    basis1: [2, 1],
    basis2: [1, 2],
    teachingPoint: 'e₁=(2,1), e₂=(1,2)，斜交基',
    teachingPoints: [
      '斜交基：分解系数不直观',
      '(7/3)·e₁ + (1/3)·e₂ = (5,3)',
      '只要不共线，任意两向量可作基底',
    ],
  },
];

// ─── VEC-061 空间向量预设 ───

export const SPACE3D_PRESETS: PresetData[] = [
  {
    id: 'VEC-061-A',
    name: 'x-y 平面加法',
    operation: 'space3D',
    vecA3: [1, 0, 0],
    vecB3: [0, 1, 0],
    teachingPoint: 'i + j = (1,1,0)，在 xy 平面内',
    teachingPoints: [
      '空间向量加法与平面类似',
      '坐标对应相加',
    ],
  },
  {
    id: 'VEC-061-B',
    name: '一般向量点积',
    operation: 'space3D',
    vecA3: [1, 2, 3],
    vecB3: [4, 5, 6],
    teachingPoint: 'a·b = 1×4+2×5+3×6 = 32',
    teachingPoints: [
      '三维点积：a·b = x₁x₂+y₁y₂+z₁z₂',
      '点积仍为标量',
    ],
  },
  {
    id: 'VEC-061-C',
    name: '垂直向量',
    operation: 'space3D',
    vecA3: [1, 0, 0],
    vecB3: [0, 1, 1],
    teachingPoint: 'a·b = 0，两向量垂直',
    teachingPoints: [
      '三维中垂直条件：x₁x₂+y₁y₂+z₁z₂=0',
      '法向量的求法依赖此条件',
    ],
  },
  {
    id: 'VEC-061-D',
    name: '夹角计算',
    operation: 'space3D',
    vecA3: [1, 1, 1],
    vecB3: [1, -1, 0],
    teachingPoint: 'a·b=0，(1,1,1)与(1,-1,0)垂直',
    teachingPoints: [
      'a·b = 1×1+1×(-1)+1×0 = 0',
      '两向量垂直，夹角 θ = 90°',
      '利用点积公式可求任意两空间向量的夹角',
    ],
  },
];

// ─── VEC-062 叉积预设 ───

export const CROSS_PRODUCT_PRESETS: PresetData[] = [
  {
    id: 'VEC-062-A',
    name: 'i×j=k',
    operation: 'crossProduct',
    vecA3: [1, 0, 0],
    vecB3: [0, 1, 0],
    teachingPoint: 'i×j = k，右手定则',
    teachingPoints: [
      '基本关系：i×j=k, j×k=i, k×i=j',
      '叉积方向由右手定则确定',
      '叉积模 = |a||b|sinθ = 面积',
    ],
  },
  {
    id: 'VEC-062-B',
    name: 'j×k=i',
    operation: 'crossProduct',
    vecA3: [0, 1, 0],
    vecB3: [0, 0, 1],
    teachingPoint: 'j×k = i，构成右手坐标系',
    teachingPoints: [
      '三个基向量构成右手坐标系',
      'x×y=z, y×z=x, z×x=y',
    ],
  },
  {
    id: 'VEC-062-C',
    name: '面积计算',
    operation: 'crossProduct',
    vecA3: [3, 0, 0],
    vecB3: [0, 4, 0],
    teachingPoint: '|a×b| = 12，平行四边形面积',
    teachingPoints: [
      '叉积模 = 平行四边形面积',
      '|3i × 4j| = 12k，面积为12',
    ],
  },
  {
    id: 'VEC-062-D',
    name: '一般情形',
    operation: 'crossProduct',
    vecA3: [1, 2, 3],
    vecB3: [4, 5, 6],
    teachingPoint: 'a×b = (-3, 6, -3)',
    teachingPoints: [
      '行列式公式展开',
      '结果垂直于 a 和 b',
      '验证：(a×b)·a = 0，(a×b)·b = 0',
    ],
  },
];

// ─── VEC-071 立体几何应用预设 ───

export const GEOMETRY3D_PRESETS: PresetData[] = [
  {
    id: 'VEC-071-A',
    name: '正方体对角线',
    operation: 'geometry3D',
    vecA3: [2, 0, 0],
    vecB3: [0, 2, 0],
    teachingPoint: '正方体棱长为2，空间对角线长度 = 2√3',
    teachingPoints: [
      '底面两棱向量 a=(2,0,0), b=(0,2,0)',
      '底面对角线 a+b=(2,2,0)，|a+b|=2√2',
      '空间对角线=(2,2,2)，|d|=2√3',
      '面法向量 a×b=(0,0,4)，垂直于底面',
    ],
  },
  {
    id: 'VEC-071-B',
    name: '三棱锥法向量',
    operation: 'geometry3D',
    vecA3: [2, 0, 0],
    vecB3: [1, 2, 0],
    teachingPoint: '底面法向量由两边向量叉积求得',
    teachingPoints: [
      '底面两边向量 a=(2,0,0), b=(1,2,0)',
      '法向量 n=a×b=(0,0,4)，垂直底面',
      '底面积 = |a×b|/2 = 2（三角形面积）',
      '叉积可求任意平面的法向量',
    ],
  },
  {
    id: 'VEC-071-C',
    name: '斜平行六面体',
    operation: 'geometry3D',
    vecA3: [2, 1, 0],
    vecB3: [0, 2, 1],
    teachingPoint: '非正交底面的平行六面体，体积=底面积×高',
    teachingPoints: [
      '底面两边向量 a=(2,1,0), b=(0,2,1)',
      '面法向量 n=a×b=(1,-2,4)',
      '底面积 = |a×b| = √21 ≈ 4.58',
      '体积 = 底面积 × 高度（|c|=2）',
    ],
  },
];

// ─── 汇总所有预设 ───

export const ALL_PRESETS: PresetData[] = [
  ...CONCEPT_PRESETS,
  ...COORDINATE_PRESETS,
  ...PARALLELOGRAM_PRESETS,
  ...TRIANGLE_PRESETS,
  ...SUBTRACTION_PRESETS,
  ...SCALAR_PRESETS,
  ...DOT_PRODUCT_PRESETS,
  ...DECOMPOSITION_PRESETS,
  ...SPACE3D_PRESETS,
  ...CROSS_PRODUCT_PRESETS,
  ...GEOMETRY3D_PRESETS,
];

export function getPresetsByOperation(operation: string): PresetData[] {
  return ALL_PRESETS.filter((p) => p.operation === operation);
}

export function getPresetById(id: string): PresetData | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}
