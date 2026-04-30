import type { Rect, Vec2 } from '../types';

export type SemicircleHalf = 'up' | 'down' | 'left' | 'right';

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

/** 判断点是否在半圆内 */
export function pointInSemicircle(
  point: Vec2,
  center: Vec2,
  radius: number,
  half: SemicircleHalf = 'up',
): boolean {
  if (!pointInCircle(point, center, radius)) return false;

  if (half === 'down') return point.y <= center.y;
  if (half === 'left') return point.x <= center.x;
  if (half === 'right') return point.x >= center.x;
  return point.y >= center.y;
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
