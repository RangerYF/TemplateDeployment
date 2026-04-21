import type { GeometryType } from '@/types/geometry';
import type { CalculationResult } from './types';
import { calculateCuboid } from './calculators/cuboid';
import { calculateCone } from './calculators/cone';
import { calculatePyramid } from './calculators/pyramid';
import { calculateCube } from './calculators/cube';
import { calculateCylinder } from './calculators/cylinder';
import { calculateSphere } from './calculators/sphere';
import { calculateRegularTetrahedron } from './calculators/regularTetrahedron';
import { calculateCornerTetrahedron } from './calculators/cornerTetrahedron';
import { calculatePrism } from './calculators/prism';
import { calculateTruncatedCone } from './calculators/truncatedCone';
import { calculateFrustum } from './calculators/frustum';
import { calculateIsoscelesTetrahedron } from './calculators/isoscelesTetrahedron';
import { calculateOrthogonalTetrahedron } from './calculators/orthogonalTetrahedron';

type Calculator = (params: Record<string, number>) => CalculationResult;

const calculators: Partial<Record<GeometryType, Calculator>> = {
  cuboid: calculateCuboid,
  cone: calculateCone,
  pyramid: calculatePyramid,
  cube: calculateCube,
  cylinder: calculateCylinder,
  sphere: calculateSphere,
  regularTetrahedron: calculateRegularTetrahedron,
  cornerTetrahedron: calculateCornerTetrahedron,
  prism: calculatePrism,
  truncatedCone: calculateTruncatedCone,
  frustum: calculateFrustum,
  isoscelesTetrahedron: calculateIsoscelesTetrahedron,
  orthogonalTetrahedron: calculateOrthogonalTetrahedron,
};

/**
 * 根据几何体类型和参数计算体积/表面积
 * 未注册的类型返回 null
 */
export function calculate(
  type: GeometryType,
  params: Record<string, number>,
): CalculationResult | null {
  const calc = calculators[type];
  if (!calc) return null;
  return calc(params);
}
