import type { GeometryType } from '@/types/geometry';
import {
  CubeIcon,
  CuboidIcon,
  PrismIcon,
  PyramidIcon,
  FrustumIcon,
  ConeIcon,
  TruncatedConeIcon,
  CylinderIcon,
  SphereIcon,
  RegularTetrahedronIcon,
  CornerTetrahedronIcon,
  IsoscelesTetrahedronIcon,
  OrthogonalTetrahedronIcon,
} from './GeometryIcons';

/** 几何体类型 → 图标组件映射 */
export const GEOMETRY_ICON_MAP: Record<GeometryType, React.ComponentType<{ size?: number; className?: string }>> = {
  cube: CubeIcon,
  cuboid: CuboidIcon,
  prism: PrismIcon,
  pyramid: PyramidIcon,
  frustum: FrustumIcon,
  cone: ConeIcon,
  truncatedCone: TruncatedConeIcon,
  cylinder: CylinderIcon,
  sphere: SphereIcon,
  regularTetrahedron: RegularTetrahedronIcon,
  cornerTetrahedron: CornerTetrahedronIcon,
  isoscelesTetrahedron: IsoscelesTetrahedronIcon,
  orthogonalTetrahedron: OrthogonalTetrahedronIcon,
};
