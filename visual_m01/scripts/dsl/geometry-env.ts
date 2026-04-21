/**
 * 几何体环境注册表
 *
 * 单一数据源：提供每种几何体的内置顶点、棱、面信息
 *
 * 用途：
 * 1. 编译器验证标签有效性
 * 2. v0.7 LLM prompt 注入可用标签
 * 3. 人工编写指令时的参考
 */

// ═══════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════

export interface GeometryEnv {
  /** 所有内置顶点标签 */
  vertices: string[];

  /** 所有内置棱（用端点标签表示） */
  edges: [string, string][];

  /** 内置面（面名 → 顶点标签列表，顺序与 builder 的 faceIndex 一致） */
  faces: Record<string, string[]>;

  /** 面名 → faceIndex 映射（编译器用） */
  faceNameToIndex: Record<string, number>;

  /** 给 LLM 的自然语言描述 */
  promptHint: string;
}

type EnvFactory = (params: Record<string, number>) => GeometryEnv;

// ═══════════════════════════════════════════════════════════
// 注册表
// ═══════════════════════════════════════════════════════════

const REGISTRY: Record<string, EnvFactory> = {

  cube: (p) => {
    const s = p.sideLength ?? 2;
    return {
      vertices: ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁'],
      edges: [
        ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
        ['A₁', 'B₁'], ['B₁', 'C₁'], ['C₁', 'D₁'], ['D₁', 'A₁'],
        ['A', 'A₁'], ['B', 'B₁'], ['C', 'C₁'], ['D', 'D₁'],
      ],
      faces: {
        '底面': ['A', 'D', 'C', 'B'],
        '顶面': ['A₁', 'B₁', 'C₁', 'D₁'],
        '前面': ['A', 'B', 'B₁', 'A₁'],
        '后面': ['C', 'D', 'D₁', 'C₁'],
        '左面': ['D', 'A', 'A₁', 'D₁'],
        '右面': ['B', 'C', 'C₁', 'B₁'],
      },
      faceNameToIndex: { '底面': 0, '顶面': 1, '前面': 2, '后面': 3, '左面': 4, '右面': 5 },
      promptHint: `正方体ABCD-A₁B₁C₁D₁，棱长${s}。底面ABCD在下，顶面A₁B₁C₁D₁在上。A左前、B右前、C右后、D左后。`,
    };
  },

  cuboid: (p) => {
    const l = p.length ?? 3;
    const w = p.width ?? 2;
    const h = p.height ?? 2;
    return {
      vertices: ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁'],
      edges: [
        ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
        ['A₁', 'B₁'], ['B₁', 'C₁'], ['C₁', 'D₁'], ['D₁', 'A₁'],
        ['A', 'A₁'], ['B', 'B₁'], ['C', 'C₁'], ['D', 'D₁'],
      ],
      faces: {
        '底面': ['A', 'D', 'C', 'B'],
        '顶面': ['A₁', 'B₁', 'C₁', 'D₁'],
        '前面': ['A', 'B', 'B₁', 'A₁'],
        '后面': ['C', 'D', 'D₁', 'C₁'],
        '左面': ['D', 'A', 'A₁', 'D₁'],
        '右面': ['B', 'C', 'C₁', 'B₁'],
      },
      faceNameToIndex: { '底面': 0, '顶面': 1, '前面': 2, '后面': 3, '左面': 4, '右面': 5 },
      promptHint: `长方体ABCD-A₁B₁C₁D₁，长${l}(AB)、宽${w}(AD)、高${h}(AA₁)。`,
    };
  },

  pyramid: (p) => {
    const n = p.sides ?? 4;
    const s = p.sideLength ?? 2;
    const h = p.height ?? 2;
    const labels = 'ABCDEFGH'.slice(0, n).split('');

    const edges: [string, string][] = [
      ...labels.map((l, i) => [l, labels[(i + 1) % n]] as [string, string]),
      ...labels.map((l) => [l, 'P'] as [string, string]),
    ];

    const faces: Record<string, string[]> = {
      '底面': [...labels].reverse(),
    };
    const faceNameToIndex: Record<string, number> = { '底面': 0 };

    for (let i = 0; i < n; i++) {
      const fv = [labels[i], labels[(i + 1) % n], 'P'];
      const name = `面${fv.join('')}`;
      faces[name] = fv;
      faceNameToIndex[name] = i + 1;
    }

    return {
      vertices: [...labels, 'P'],
      edges,
      faces,
      faceNameToIndex,
      promptHint: `正${n}棱锥${labels.join('')}-P，底面边长${s}，高${h}。底面${labels.join('')}在下，顶点P在上。`,
    };
  },

  prism: (p) => {
    const n = p.sides ?? 3;
    const s = p.sideLength ?? 2;
    const h = p.height ?? 2;
    const bottom = 'ABCDEFGH'.slice(0, n).split('');
    const top = bottom.map((l) => l + '₁');

    const edges: [string, string][] = [
      ...bottom.map((l, i) => [l, bottom[(i + 1) % n]] as [string, string]),
      ...top.map((l, i) => [l, top[(i + 1) % n]] as [string, string]),
      ...bottom.map((l, i) => [l, top[i]] as [string, string]),
    ];

    const faces: Record<string, string[]> = {
      '底面': [...bottom].reverse(),
      '顶面': [...top],
    };
    const faceNameToIndex: Record<string, number> = { '底面': 0, '顶面': 1 };

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const fv = [bottom[i], bottom[j], top[j], top[i]];
      const name = `面${fv.join('')}`;
      faces[name] = fv;
      faceNameToIndex[name] = i + 2;
    }

    return {
      vertices: [...bottom, ...top],
      edges,
      faces,
      faceNameToIndex,
      promptHint: `正${n}棱柱${bottom.join('')}-${top.join('')}，底面边长${s}，高${h}。`,
    };
  },

  regularTetrahedron: (p) => {
    const s = p.sideLength ?? 2;
    return {
      vertices: ['A', 'B', 'C', 'D'],
      edges: [
        ['A', 'B'], ['B', 'C'], ['C', 'A'],
        ['A', 'D'], ['B', 'D'], ['C', 'D'],
      ],
      faces: {
        '底面': ['C', 'B', 'A'],
        '面ABD': ['A', 'B', 'D'],
        '面BCD': ['B', 'C', 'D'],
        '面CAD': ['C', 'A', 'D'],
      },
      faceNameToIndex: { '底面': 0, '面ABD': 1, '面BCD': 2, '面CAD': 3 },
      promptHint: `正四面体ABCD，棱长${s}。底面ABC（底面三角形），顶点D在上。`,
    };
  },

  cylinder: (p) => {
    const r = p.radius ?? 1;
    const h = p.height ?? 2;
    return {
      vertices: ['O', 'O₁'],
      edges: [],
      faces: { '底面': ['O'], '顶面': ['O₁'], '侧面': [] },
      faceNameToIndex: { '底面': 0, '顶面': 1, '侧面': 2 },
      promptHint: `圆柱，底面半径${r}，高${h}。O为底面圆心，O₁为顶面圆心。`,
    };
  },

  cone: (p) => {
    const r = p.radius ?? 1;
    const h = p.height ?? 2;
    return {
      vertices: ['O', 'P'],
      edges: [],
      faces: { '底面': ['O'], '侧面': [] },
      faceNameToIndex: { '底面': 0, '侧面': 1 },
      promptHint: `圆锥，底面半径${r}，高${h}。O为底面圆心，P为顶点。`,
    };
  },

  sphere: (p) => {
    const r = p.radius ?? 2;
    return {
      vertices: ['O'],
      edges: [],
      faces: { '球面': [] },
      faceNameToIndex: { '球面': 0 },
      promptHint: `球，半径${r}。O为球心。`,
    };
  },

  cornerTetrahedron: (p) => {
    const a = p.edgeA ?? 2;
    const b = p.edgeB ?? 2;
    const c = p.edgeC ?? 2;
    return {
      vertices: ['O', 'A', 'B', 'C'],
      edges: [
        ['O', 'A'], ['O', 'B'], ['O', 'C'],
        ['A', 'B'], ['B', 'C'], ['C', 'A'],
      ],
      faces: {
        '底面': ['A', 'B', 'C'],
        '面OAB': ['O', 'A', 'B'],
        '面OBC': ['O', 'B', 'C'],
        '面OCA': ['O', 'C', 'A'],
      },
      faceNameToIndex: { '底面': 0, '面OAB': 1, '面OBC': 2, '面OCA': 3 },
      promptHint: `墙角四面体OABC，三条直角棱OA=${a}(X轴)、OB=${b}(Z轴)、OC=${c}(Y轴)，两两垂直。`,
    };
  },
};

// cube 和 cuboid 各自独立定义（拓扑相同但 promptHint 不同）

// ═══════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════

/**
 * 获取几何体环境信息
 * @throws 不支持的几何体类型时抛出错误
 */
export function getGeometryEnv(type: string, params: Record<string, number>): GeometryEnv {
  const factory = REGISTRY[type];
  if (!factory) {
    throw new Error(`[GeometryEnv] 不支持的几何体类型: "${type}"。支持的类型: ${Object.keys(REGISTRY).join(', ')}`);
  }
  return factory(params);
}

/**
 * 检查几何体类型是否有注册的环境
 */
export function hasGeometryEnv(type: string): boolean {
  return type in REGISTRY;
}
