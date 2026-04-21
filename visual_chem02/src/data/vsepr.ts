/**
 * VSEPR 几何模板 — 13 种电子域构型
 *
 * 每个模板定义了归一化坐标（单位长度 = 1），
 * 实际使用时按键长缩放。
 *
 * positions: 成键位置（排除孤电子对占位）
 * lonePairPositions: 孤电子对方向（归一化向量）
 */

export interface VseprTemplate {
  electronDomains: number;       // 电子域总数
  bondPairs: number;             // 成键对数
  lonePairs: number;             // 孤电子对数
  geometry: string;              // 分子空间构型名称
  electronGeometry: string;      // 电子域构型名称
  idealAngle: number;            // 理想键角
  positions: [number, number, number][];          // 归一化成键方向
  lonePairPositions: [number, number, number][];  // 孤电子对方向
}

const sin = Math.sin;
const cos = Math.cos;
const PI = Math.PI;
const sqrt = Math.sqrt;

// 常用方向向量
const UP: [number, number, number] = [0, 1, 0];
const DOWN: [number, number, number] = [0, -1, 0];
const RIGHT: [number, number, number] = [1, 0, 0];
const LEFT: [number, number, number] = [-1, 0, 0];
const FRONT: [number, number, number] = [0, 0, 1];
const BACK: [number, number, number] = [0, 0, -1];

// 三角形平面 (xy 平面，120° 间隔)
const TRI_0: [number, number, number] = [1, 0, 0];
const TRI_1: [number, number, number] = [cos(2 * PI / 3), sin(2 * PI / 3), 0];
const TRI_2: [number, number, number] = [cos(4 * PI / 3), sin(4 * PI / 3), 0];

// 四面体方向
const TET_0: [number, number, number] = [0, 1, 0];
const TET_1: [number, number, number] = [0, -1 / 3, sqrt(8 / 9)];
const TET_2: [number, number, number] = [sqrt(2 / 3), -1 / 3, -sqrt(2 / 9)];
const TET_3: [number, number, number] = [-sqrt(2 / 3), -1 / 3, -sqrt(2 / 9)];

// 三角双锥方向
const TBP_AX_UP: [number, number, number] = [0, 1, 0];
const TBP_AX_DN: [number, number, number] = [0, -1, 0];
const TBP_EQ_0: [number, number, number] = [1, 0, 0];
const TBP_EQ_1: [number, number, number] = [cos(2 * PI / 3), 0, sin(2 * PI / 3)];
const TBP_EQ_2: [number, number, number] = [cos(4 * PI / 3), 0, sin(4 * PI / 3)];

// 八面体方向
const OCT_0: [number, number, number] = UP;
const OCT_1: [number, number, number] = DOWN;
const OCT_2: [number, number, number] = RIGHT;
const OCT_3: [number, number, number] = LEFT;
const OCT_4: [number, number, number] = FRONT;
const OCT_5: [number, number, number] = BACK;

export const VSEPR_TEMPLATES: Record<string, VseprTemplate> = {
  // 2 电子域
  'linear_2_0': {
    electronDomains: 2, bondPairs: 2, lonePairs: 0,
    geometry: '直线形', electronGeometry: '直线形', idealAngle: 180,
    positions: [LEFT, RIGHT],
    lonePairPositions: [],
  },

  // 3 电子域
  'trigonal_planar_3_0': {
    electronDomains: 3, bondPairs: 3, lonePairs: 0,
    geometry: '平面三角形', electronGeometry: '三角形', idealAngle: 120,
    positions: [TRI_0, TRI_1, TRI_2],
    lonePairPositions: [],
  },
  'bent_2_1': {
    electronDomains: 3, bondPairs: 2, lonePairs: 1,
    geometry: 'V形', electronGeometry: '三角形', idealAngle: 120,
    positions: [TRI_0, TRI_1],
    lonePairPositions: [TRI_2],
  },

  // 4 电子域
  'tetrahedral_4_0': {
    electronDomains: 4, bondPairs: 4, lonePairs: 0,
    geometry: '正四面体', electronGeometry: '四面体', idealAngle: 109.5,
    positions: [TET_0, TET_1, TET_2, TET_3],
    lonePairPositions: [],
  },
  'trigonal_pyramidal_3_1': {
    electronDomains: 4, bondPairs: 3, lonePairs: 1,
    geometry: '三角锥形', electronGeometry: '四面体', idealAngle: 107,
    positions: [TET_1, TET_2, TET_3],
    lonePairPositions: [TET_0],
  },
  'bent_2_2': {
    electronDomains: 4, bondPairs: 2, lonePairs: 2,
    geometry: 'V形', electronGeometry: '四面体', idealAngle: 104.5,
    positions: [TET_2, TET_3],
    lonePairPositions: [TET_0, TET_1],
  },

  // 5 电子域
  'trigonal_bipyramidal_5_0': {
    electronDomains: 5, bondPairs: 5, lonePairs: 0,
    geometry: '三角双锥', electronGeometry: '三角双锥', idealAngle: 90,
    positions: [TBP_AX_UP, TBP_AX_DN, TBP_EQ_0, TBP_EQ_1, TBP_EQ_2],
    lonePairPositions: [],
  },
  'seesaw_4_1': {
    electronDomains: 5, bondPairs: 4, lonePairs: 1,
    geometry: '变形四面体', electronGeometry: '三角双锥', idealAngle: 90,
    positions: [TBP_AX_UP, TBP_AX_DN, TBP_EQ_0, TBP_EQ_1],
    lonePairPositions: [TBP_EQ_2],
  },
  't_shaped_3_2': {
    electronDomains: 5, bondPairs: 3, lonePairs: 2,
    geometry: 'T形', electronGeometry: '三角双锥', idealAngle: 90,
    positions: [TBP_AX_UP, TBP_AX_DN, TBP_EQ_0],
    lonePairPositions: [TBP_EQ_1, TBP_EQ_2],
  },
  'linear_2_3': {
    electronDomains: 5, bondPairs: 2, lonePairs: 3,
    geometry: '直线形', electronGeometry: '三角双锥', idealAngle: 180,
    positions: [TBP_AX_UP, TBP_AX_DN],
    lonePairPositions: [TBP_EQ_0, TBP_EQ_1, TBP_EQ_2],
  },

  // 6 电子域
  'octahedral_6_0': {
    electronDomains: 6, bondPairs: 6, lonePairs: 0,
    geometry: '正八面体', electronGeometry: '八面体', idealAngle: 90,
    positions: [OCT_0, OCT_1, OCT_2, OCT_3, OCT_4, OCT_5],
    lonePairPositions: [],
  },
  'square_pyramidal_5_1': {
    electronDomains: 6, bondPairs: 5, lonePairs: 1,
    geometry: '四方锥', electronGeometry: '八面体', idealAngle: 90,
    positions: [OCT_0, OCT_2, OCT_3, OCT_4, OCT_5],
    lonePairPositions: [OCT_1],
  },
  'square_planar_4_2': {
    electronDomains: 6, bondPairs: 4, lonePairs: 2,
    geometry: '平面正方形', electronGeometry: '八面体', idealAngle: 90,
    positions: [OCT_2, OCT_3, OCT_4, OCT_5],
    lonePairPositions: [OCT_0, OCT_1],
  },
};

/** 根据成键对数和孤电子对数查找 VSEPR 模板 */
export function findVseprTemplate(bondPairs: number, lonePairs: number): VseprTemplate | undefined {
  const key = Object.keys(VSEPR_TEMPLATES).find(k => {
    const t = VSEPR_TEMPLATES[k];
    return t.bondPairs === bondPairs && t.lonePairs === lonePairs;
  });
  return key ? VSEPR_TEMPLATES[key] : undefined;
}
