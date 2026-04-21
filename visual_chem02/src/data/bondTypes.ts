/**
 * 化学键类型渲染参数
 */

export type BondType = 'single' | 'double' | 'triple' | 'delocalized' | 'coordinate' | 'hydrogen';

export interface BondRenderConfig {
  cylinders: number;         // 圆柱体数量
  cylinderRadius: number;    // 单根圆柱半径
  spacing: number;           // 多根圆柱间距（相对于半径）
  opacity: number;           // 不透明度
  dashed: boolean;           // 是否虚线
  color?: string;            // 覆盖颜色（默认使用分段染色）
}

export const BOND_RENDER_CONFIG: Record<BondType, BondRenderConfig> = {
  single: {
    cylinders: 1,
    cylinderRadius: 0.08,
    spacing: 0,
    opacity: 1,
    dashed: false,
  },
  double: {
    cylinders: 2,
    cylinderRadius: 0.04,
    spacing: 0.18,
    opacity: 1,
    dashed: false,
  },
  triple: {
    cylinders: 3,
    cylinderRadius: 0.035,
    spacing: 0.15,
    opacity: 1,
    dashed: false,
  },
  delocalized: {
    cylinders: 2,
    cylinderRadius: 0.04,
    spacing: 0.18,
    opacity: 1,
    dashed: false,
  },
  coordinate: {
    cylinders: 1,
    cylinderRadius: 0.07,
    spacing: 0,
    opacity: 1,
    dashed: false,
  },
  hydrogen: {
    cylinders: 1,
    cylinderRadius: 0.04,
    spacing: 0,
    opacity: 0.6,
    dashed: true,
  },
};

/** 键长范围参考（pm） */
export const BOND_LENGTH_REFERENCE: Record<string, { length: number; energy: number }> = {
  'C-C':  { length: 154, energy: 347 },
  'C=C':  { length: 134, energy: 614 },
  'C≡C':  { length: 120, energy: 839 },
  'C-H':  { length: 109, energy: 413 },
  'C-O':  { length: 143, energy: 358 },
  'C=O':  { length: 121, energy: 745 },
  'C-N':  { length: 147, energy: 305 },
  'C-Cl': { length: 177, energy: 339 },
  'O-H':  { length: 96,  energy: 463 },
  'N-H':  { length: 101, energy: 391 },
  'H-H':  { length: 74,  energy: 436 },
  'N≡N':  { length: 110, energy: 945 },
  'O=O':  { length: 121, energy: 498 },
  'F-F':  { length: 142, energy: 159 },
  'Cl-Cl':{ length: 199, energy: 242 },
};
