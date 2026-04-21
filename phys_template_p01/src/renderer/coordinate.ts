import type { CoordinateTransform, Vec2 } from '@/core/types';

/**
 * 物理坐标 → 画布像素坐标
 * Canvas Y 向下，物理 Y 向上，需翻转
 */
export function worldToScreen(
  point: Vec2,
  transform: CoordinateTransform,
): Vec2 {
  return {
    x: transform.origin.x + point.x * transform.scale,
    y: transform.origin.y - point.y * transform.scale, // Y 翻转
  };
}

/**
 * 画布像素坐标 → 物理坐标
 */
export function screenToWorld(
  pixel: Vec2,
  transform: CoordinateTransform,
): Vec2 {
  return {
    x: (pixel.x - transform.origin.x) / transform.scale,
    y: -(pixel.y - transform.origin.y) / transform.scale, // Y 翻转
  };
}

/**
 * 物理长度 → 像素长度（标量，无方向）
 */
export function worldLengthToScreen(
  length: number,
  transform: CoordinateTransform,
): number {
  return length * transform.scale;
}
