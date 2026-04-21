import type { CubeParams } from '@/types/geometry';
import type { PolyhedronResult } from '../types';
import { buildCuboid } from './cuboid';

/**
 * 正方体 Builder
 * 复用长方体 Builder（length = width = height = sideLength）
 */
export function buildCube(params: CubeParams): PolyhedronResult {
  const { sideLength } = params;
  return buildCuboid({ length: sideLength, width: sideLength, height: sideLength });
}
