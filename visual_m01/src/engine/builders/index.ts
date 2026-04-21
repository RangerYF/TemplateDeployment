import type { GeometryType, GeometryParams } from '@/types/geometry';
import type { BuilderResult } from '../types';
import { buildCuboid } from './cuboid';
import { buildCone } from './cone';
import { buildPyramid } from './pyramid';
import { buildCube } from './cube';
import { buildCylinder } from './cylinder';
import { buildSphere } from './sphere';
import { buildRegularTetrahedron } from './regularTetrahedron';
import { buildCornerTetrahedron } from './cornerTetrahedron';
import { buildPrism } from './prism';
import { buildTruncatedCone } from './truncatedCone';
import { buildFrustum } from './frustum';
import { buildIsoscelesTetrahedron } from './isoscelesTetrahedron';
import { buildOrthogonalTetrahedron } from './orthogonalTetrahedron';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBuilderFn = (params: any) => BuilderResult;

const builders: Partial<Record<GeometryType, AnyBuilderFn>> = {
  cuboid: buildCuboid,
  cone: buildCone,
  pyramid: buildPyramid,
  cube: buildCube,
  cylinder: buildCylinder,
  sphere: buildSphere,
  regularTetrahedron: buildRegularTetrahedron,
  cornerTetrahedron: buildCornerTetrahedron,
  prism: buildPrism,
  truncatedCone: buildTruncatedCone,
  frustum: buildFrustum,
  isoscelesTetrahedron: buildIsoscelesTetrahedron,
  orthogonalTetrahedron: buildOrthogonalTetrahedron,
};

/**
 * 根据几何体类型构建 BuilderResult
 * 未实现的类型返回 null
 */
export function buildGeometry<T extends GeometryType>(
  type: T,
  params: GeometryParams[T],
): BuilderResult | null {
  const builder = builders[type];
  if (!builder) return null;
  return builder(params);
}
