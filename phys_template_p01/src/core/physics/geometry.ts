import type { Rect, Vec2 } from '../types';

/** 判断点是否在矩形内 */
export function pointInRect(point: Vec2, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** 判断点是否在圆内 */
export function pointInCircle(
  point: Vec2,
  center: Vec2,
  radius: number,
): boolean {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return dx * dx + dy * dy <= radius * radius;
}

/** 判断点是否在三角形内（使用重心坐标法） */
export function pointInTriangle(
  point: Vec2,
  a: Vec2,
  b: Vec2,
  c: Vec2,
): boolean {
  const v0x = c.x - a.x;
  const v0y = c.y - a.y;
  const v1x = b.x - a.x;
  const v1y = b.y - a.y;
  const v2x = point.x - a.x;
  const v2y = point.y - a.y;

  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

  return u >= 0 && v >= 0 && u + v <= 1;
}

/** 判断点是否在旋转矩形内 */
export function pointInRotatedRect(
  point: Vec2,
  center: Vec2,
  halfWidth: number,
  halfHeight: number,
  rotation: number,
): boolean {
  // 将点旋转到矩形局部坐标系
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cosR = Math.cos(-rotation);
  const sinR = Math.sin(-rotation);
  const localX = dx * cosR - dy * sinR;
  const localY = dx * sinR + dy * cosR;
  return Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
}

/** 判断点是否在线段上（带阈值） */
export function pointOnLine(
  point: Vec2,
  lineStart: Vec2,
  lineEnd: Vec2,
  threshold: number = 5,
): boolean {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // 线段退化为点
    const d = Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    return d <= threshold;
  }

  // 投影参数 t，clamp 到 [0, 1]
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  // 最近点
  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;

  const dist = Math.hypot(point.x - nearestX, point.y - nearestY);
  return dist <= threshold;
}
