/** 几何体类型 */
export type GeometryType = 'pyramid' | 'cone' | 'cylinder' | 'cuboid' | 'cube' | 'sphere' | 'regularTetrahedron' | 'cornerTetrahedron' | 'prism' | 'truncatedCone' | 'frustum' | 'isoscelesTetrahedron' | 'orthogonalTetrahedron';

/** 几何体类型元数据 */
export interface GeometryMeta {
  type: GeometryType;
  label: string;
  icon: string; // lucide-react icon name
}

export const GEOMETRY_LIST: GeometryMeta[] = [
  { type: 'pyramid', label: '棱锥', icon: 'Triangle' },
  { type: 'cone', label: '圆锥', icon: 'Cone' },
  { type: 'cylinder', label: '圆柱', icon: 'Cylinder' },
  { type: 'cuboid', label: '长方体', icon: 'Box' },
  { type: 'cube', label: '正方体', icon: 'BoxSelect' },
  { type: 'sphere', label: '球', icon: 'Circle' },
  { type: 'regularTetrahedron', label: '正四面体', icon: 'Triangle' },
  { type: 'cornerTetrahedron', label: '墙角四面体', icon: 'Triangle' },
  { type: 'prism', label: '正棱柱', icon: 'Box' },
  { type: 'truncatedCone', label: '圆台', icon: 'Cone' },
  { type: 'frustum', label: '棱台', icon: 'Triangle' },
  { type: 'isoscelesTetrahedron', label: '等腰四面体', icon: 'Triangle' },
  { type: 'orthogonalTetrahedron', label: '正交四面体', icon: 'Triangle' },
];

/** 几何体分组（用于 TopBar 分类显示） */
export interface GeometryGroup {
  label: string;
  types: GeometryType[];
}

export const GEOMETRY_GROUPS: GeometryGroup[] = [
  { label: '棱柱', types: ['cube', 'cuboid', 'prism'] },
  { label: '棱锥/棱台', types: ['pyramid', 'frustum'] },
  { label: '旋转体', types: ['cylinder', 'cone', 'truncatedCone', 'sphere'] },
  { label: '四面体', types: ['regularTetrahedron', 'cornerTetrahedron', 'isoscelesTetrahedron', 'orthogonalTetrahedron'] },
];

/** 各几何体参数接口 */
export interface PyramidParams {
  sides: number;      // 底面边数 3~8
  sideLength: number; // 底面边长
  height: number;     // 高
  /** 侧棱长（可选，与 height 互斥输入） */
  lateralEdgeLength?: number;
  /** 当前参数模式：height（默认）或 lateralEdge */
  paramMode?: 'height' | 'lateralEdge';
}

export interface ConeParams {
  radius: number; // 底面半径
  height: number; // 高
}

export interface CylinderParams {
  radius: number; // 底面半径
  height: number; // 高
}

export interface CuboidParams {
  length: number; // 长
  width: number;  // 宽
  height: number; // 高
}

export interface CubeParams {
  sideLength: number; // 边长
}

export interface SphereParams {
  radius: number; // 半径
}

export interface RegularTetrahedronParams {
  sideLength: number; // 棱长
}

export interface CornerTetrahedronParams {
  edgeA: number; // 直角边 a（沿 X 轴）
  edgeB: number; // 直角边 b（沿 Z 轴）
  edgeC: number; // 直角边 c（沿 Y 轴，朝上）
}

export interface PrismParams {
  sides: number;      // 底面边数 3~8
  sideLength: number; // 底面边长
  height: number;     // 高
}

export interface TruncatedConeParams {
  topRadius: number;    // 上底半径 r₁
  bottomRadius: number; // 下底半径 r₂
  height: number;       // 高 h
}

export interface FrustumParams {
  sides: number;           // 底面边数 3~8
  bottomSideLength: number; // 下底边长 a₂
  topSideLength: number;    // 上底边长 a₁
  height: number;           // 高 h
}

export interface IsoscelesTetrahedronParams {
  edgeP: number; // 对棱 AB = CD = p
  edgeQ: number; // 对棱 AC = BD = q
  edgeR: number; // 对棱 AD = BC = r
}

export interface OrthogonalTetrahedronParams {
  edgeAB: number; // 对棱 AB 长
  edgeCD: number; // 对棱 CD 长（与 AB 垂直）
}

/** 参数联合类型 */
export type GeometryParams = {
  pyramid: PyramidParams;
  cone: ConeParams;
  cylinder: CylinderParams;
  cuboid: CuboidParams;
  cube: CubeParams;
  sphere: SphereParams;
  regularTetrahedron: RegularTetrahedronParams;
  cornerTetrahedron: CornerTetrahedronParams;
  prism: PrismParams;
  truncatedCone: TruncatedConeParams;
  frustum: FrustumParams;
  isoscelesTetrahedron: IsoscelesTetrahedronParams;
  orthogonalTetrahedron: OrthogonalTetrahedronParams;
};

/** 默认参数 */
export const DEFAULT_PARAMS: GeometryParams = {
  pyramid: { sides: 4, sideLength: 2, height: 2 },
  cone: { radius: 1.5, height: 2 },
  cylinder: { radius: 1.5, height: 2 },
  cuboid: { length: 3, width: 2, height: 2 },
  cube: { sideLength: 2 },
  sphere: { radius: 1 },
  regularTetrahedron: { sideLength: 2 },
  cornerTetrahedron: { edgeA: 2, edgeB: 2, edgeC: 2 },
  prism: { sides: 6, sideLength: 1.5, height: 2 },
  truncatedCone: { topRadius: 1, bottomRadius: 2, height: 2 },
  frustum: { sides: 4, bottomSideLength: 2, topSideLength: 1, height: 2 },
  isoscelesTetrahedron: { edgeP: 2, edgeQ: 2, edgeR: 2 },
  orthogonalTetrahedron: { edgeAB: 2, edgeCD: 2 },
};
