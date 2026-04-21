import type { SnapSurface } from './types'

/**
 * Transform a local-coordinate point to world coordinates
 * given body position and angle.
 */
export function localToWorld(
  localX: number,
  localY: number,
  bodyX: number,
  bodyY: number,
  angle: number,
): { x: number; y: number } {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: bodyX + localX * cos - localY * sin,
    y: bodyY + localX * sin + localY * cos,
  }
}

/**
 * Create a snap surface from two local-coordinate points,
 * transformed to world coordinates.
 * Normal is computed as the left-hand perpendicular of (start→end).
 */
export function createSnapSurface(
  type: 'rest' | 'contact',
  localStart: { x: number; y: number },
  localEnd: { x: number; y: number },
  bodyX: number,
  bodyY: number,
  angle: number,
  normalDir?: { x: number; y: number },
): SnapSurface {
  const start = localToWorld(localStart.x, localStart.y, bodyX, bodyY, angle)
  const end = localToWorld(localEnd.x, localEnd.y, bodyX, bodyY, angle)

  let normal: { x: number; y: number }
  let localNormal: { x: number; y: number }
  if (normalDir) {
    // Transform normal direction
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    localNormal = { ...normalDir }
    normal = {
      x: normalDir.x * cos - normalDir.y * sin,
      y: normalDir.x * sin + normalDir.y * cos,
    }
  } else {
    // Compute outward normal: perpendicular to edge direction
    const dx = localEnd.x - localStart.x
    const dy = localEnd.y - localStart.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.001) {
      localNormal = { x: 0, y: 1 }
    } else {
      // Left-hand normal (pointing outward/upward for a CCW-oriented surface)
      localNormal = { x: -dy / len, y: dx / len }
    }
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    normal = {
      x: localNormal.x * cos - localNormal.y * sin,
      y: localNormal.x * sin + localNormal.y * cos,
    }
  }

  return { type, start, end, normal, localStart, localEnd, localNormal }
}
