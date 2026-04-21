import type { GeometryType } from '@/types/geometry';
import { cuboidUnfold, type CuboidUnfoldResult } from './cuboidUnfold';
import { coneUnfold, type ConeUnfoldResult } from './coneUnfold';
import { pyramidUnfold } from './pyramidUnfold';
import { regularTetrahedronUnfold } from './regularTetrahedronUnfold';
import { cornerTetrahedronUnfold } from './cornerTetrahedronUnfold';
import { prismUnfold } from './prismUnfold';
import { cylinderUnfold, type CylinderUnfoldResult } from './cylinderUnfold';
import { truncatedConeUnfold, type TruncatedConeUnfoldResult } from './truncatedConeUnfold';
import { frustumUnfold } from './frustumUnfold';
import { isoscelesTetrahedronUnfold } from './isoscelesTetrahedronUnfold';
import { orthogonalTetrahedronUnfold } from './orthogonalTetrahedronUnfold';

export type { Vec2, UnfoldFace, CuboidUnfoldResult } from './cuboidUnfold';
export type { ConeUnfoldResult } from './coneUnfold';
export type { CylinderUnfoldResult } from './cylinderUnfold';
export type { TruncatedConeUnfoldResult } from './truncatedConeUnfold';

/** 展开图统一结果 */
export type UnfoldResult = CuboidUnfoldResult | ConeUnfoldResult | CylinderUnfoldResult | TruncatedConeUnfoldResult;

/** 支持展开图的几何体类型 */
export const UNFOLDABLE_TYPES: GeometryType[] = [
  'cuboid', 'cube', 'cone', 'pyramid', 'cylinder',
  'regularTetrahedron', 'cornerTetrahedron', 'prism',
  'truncatedCone', 'frustum', 'isoscelesTetrahedron', 'orthogonalTetrahedron',
];

type Unfolder = (params: Record<string, number>) => UnfoldResult;

const unfolders: Partial<Record<GeometryType, Unfolder>> = {
  cuboid: (p) => cuboidUnfold({ length: p.length, width: p.width, height: p.height }),
  cube: (p) => cuboidUnfold({ length: p.sideLength, width: p.sideLength, height: p.sideLength }),
  cone: (p) => coneUnfold({ radius: p.radius, height: p.height }),
  pyramid: (p) => pyramidUnfold({ sides: p.sides, sideLength: p.sideLength, height: p.height }),
  cylinder: (p) => cylinderUnfold({ radius: p.radius, height: p.height }),
  regularTetrahedron: (p) => regularTetrahedronUnfold({ sideLength: p.sideLength }),
  cornerTetrahedron: (p) => cornerTetrahedronUnfold({ edgeA: p.edgeA, edgeB: p.edgeB, edgeC: p.edgeC }),
  prism: (p) => prismUnfold({ sides: p.sides, sideLength: p.sideLength, height: p.height }),
  truncatedCone: (p) => truncatedConeUnfold({ topRadius: p.topRadius, bottomRadius: p.bottomRadius, height: p.height }),
  frustum: (p) => frustumUnfold({ sides: p.sides, bottomSideLength: p.bottomSideLength, topSideLength: p.topSideLength, height: p.height }),
  isoscelesTetrahedron: (p) => isoscelesTetrahedronUnfold({ edgeP: p.edgeP, edgeQ: p.edgeQ, edgeR: p.edgeR }),
  orthogonalTetrahedron: (p) => orthogonalTetrahedronUnfold({ edgeAB: p.edgeAB, edgeCD: p.edgeCD }),
};

/**
 * 根据几何体类型生成展开图
 * 不支持的类型返回 null
 */
export function unfold(
  type: GeometryType,
  params: Record<string, number>,
): UnfoldResult | null {
  const fn = unfolders[type];
  if (!fn) return null;
  return fn(params);
}
