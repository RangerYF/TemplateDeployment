import type { GeometryType } from '@/types/geometry';
import {
  cuboidThreeView, coneThreeView, pyramidThreeView, prismThreeView,
  cornerTetrahedronThreeView, regularTetrahedronThreeView,
  cylinderThreeView, sphereThreeView,
  truncatedConeThreeView, frustumThreeView,
  isoscelesTetrahedronThreeView, orthogonalTetrahedronThreeView,
  type ThreeViewResult,
} from './threeView';

export type { ThreeViewResult, SingleView, ViewSegment, ViewCircle, ViewPoint, DimensionLabel } from './threeView';

/** 支持三视图的几何体类型 */
export const THREE_VIEW_TYPES: GeometryType[] = [
  'cuboid', 'cube', 'cone', 'pyramid', 'cylinder', 'sphere',
  'regularTetrahedron', 'cornerTetrahedron', 'prism',
  'truncatedCone', 'frustum', 'isoscelesTetrahedron', 'orthogonalTetrahedron',
];

type Projector = (params: Record<string, number>) => ThreeViewResult;

const projectors: Partial<Record<GeometryType, Projector>> = {
  cuboid: (p) => cuboidThreeView({ length: p.length, width: p.width, height: p.height }),
  cube: (p) => cuboidThreeView({ length: p.sideLength, width: p.sideLength, height: p.sideLength }),
  cone: (p) => coneThreeView({ radius: p.radius, height: p.height }),
  pyramid: (p) => pyramidThreeView({ sides: p.sides, sideLength: p.sideLength, height: p.height }),
  cylinder: (p) => cylinderThreeView({ radius: p.radius, height: p.height }),
  sphere: (p) => sphereThreeView({ radius: p.radius }),
  regularTetrahedron: (p) => regularTetrahedronThreeView({ sideLength: p.sideLength }),
  cornerTetrahedron: (p) => cornerTetrahedronThreeView({ edgeA: p.edgeA, edgeB: p.edgeB, edgeC: p.edgeC }),
  prism: (p) => prismThreeView({ sides: p.sides, sideLength: p.sideLength, height: p.height }),
  truncatedCone: (p) => truncatedConeThreeView({ topRadius: p.topRadius, bottomRadius: p.bottomRadius, height: p.height }),
  frustum: (p) => frustumThreeView({ sides: p.sides, bottomSideLength: p.bottomSideLength, topSideLength: p.topSideLength, height: p.height }),
  isoscelesTetrahedron: (p) => isoscelesTetrahedronThreeView({ edgeP: p.edgeP, edgeQ: p.edgeQ, edgeR: p.edgeR }),
  orthogonalTetrahedron: (p) => orthogonalTetrahedronThreeView({ edgeAB: p.edgeAB, edgeCD: p.edgeCD }),
};

/**
 * 根据几何体类型生成三视图
 * 不支持的类型返回 null
 */
export function project(
  type: GeometryType,
  params: Record<string, number>,
): ThreeViewResult | null {
  const fn = projectors[type];
  if (!fn) return null;
  return fn(params);
}
