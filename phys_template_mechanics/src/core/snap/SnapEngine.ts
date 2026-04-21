import type { SceneBody } from '@/models/types'
import type { SnapSurface, SnapResult } from './types'
import { getBodyDescriptor } from '@/models/bodyTypes'

const SNAP_THRESHOLD = 0.3 // world units (meters)
const VISUAL_GAP = 0.008

/**
 * Compute the best snap result for a dragged body against all other bodies.
 * Returns null if no snap is within threshold.
 */
export function computeSnap(
  draggedBody: SceneBody,
  allBodies: SceneBody[],
  disabled: boolean,
  threshold: number = SNAP_THRESHOLD,
): SnapResult | null {
  if (disabled) return null

  // Get contact surfaces of the dragged body
  const dragDesc = getBodyDescriptor(draggedBody.type)
  if (!dragDesc.getSnapSurfaces) return null
  const contactSurfaces = dragDesc.getSnapSurfaces(draggedBody)
    .filter((s) => s.type === 'contact')

  if (contactSurfaces.length === 0) return null

  let bestResult: SnapResult | null = null

  for (const other of allBodies) {
    if (other.id === draggedBody.id) continue

    const restSurfaces = getRestSurfaces(other)
    if (restSurfaces.length === 0) continue

    for (const restSurface of restSurfaces) {
      for (const contactSurface of contactSurfaces) {
        const result = computeSurfaceSnap(contactSurface, restSurface, draggedBody)
        if (result && result.distance < threshold) {
          if (!bestResult || result.distance < bestResult.distance) {
            bestResult = result
          }
        }
      }
    }
  }

  return bestResult
}

function computeSurfaceSnap(
  contact: SnapSurface,
  rest: SnapSurface,
  body: SceneBody,
): SnapResult | null {
  // Determine if the rest surface is approximately horizontal
  const restDx = rest.end.x - rest.start.x
  const restDy = rest.end.y - rest.start.y
  const restLen = Math.sqrt(restDx * restDx + restDy * restDy)
  if (restLen < 0.001) return null

  const isHorizontal = Math.abs(restDy / restLen) < 0.05

  if (isHorizontal) {
    return computeHorizontalSnap(contact, rest, body)
  } else {
    return computeSlopeSnap(contact, rest, body)
  }
}

/**
 * Horizontal surface snap: align contact bottom to rest top (y-axis only).
 */
function computeHorizontalSnap(
  contact: SnapSurface,
  rest: SnapSurface,
  body: SceneBody,
): SnapResult | null {
  if (body.type !== 'ball') {
    const generic = computeLineSurfaceSnap(contact, rest, body)
    if (generic) return generic
  }

  // Rest surface y-position (top of supporting surface)
  const restY = (rest.start.y + rest.end.y) / 2

  // Contact surface y-position (bottom of dragged body)
  const contactY = (contact.start.y + contact.end.y) / 2

  // Distance from contact to rest
  const distance = Math.abs(contactY - restY)

  // Check x-overlap: contact should be within rest surface x-range
  const restMinX = Math.min(rest.start.x, rest.end.x)
  const restMaxX = Math.max(rest.start.x, rest.end.x)
  const bodyX = body.position.x

  // Allow snap even if body center is slightly outside rest surface
  // (generous for ground which spans wide)
  if (restMaxX - restMinX > 10) {
    // Wide surface (like ground), always allow
  } else {
    const margin = 2.0 // allow 2m margin
    if (bodyX < restMinX - margin || bodyX > restMaxX + margin) {
      return null
    }
  }

  // Snap: move body so contact surface aligns with rest surface
  const offsetY = restY - contactY
  const newPos = {
    x: body.position.x,
    y: body.position.y + offsetY,
  }

  // When snapping to a horizontal surface, reset rotation to 0
  // (e.g. body was rotated on a slope, now returning to flat ground)
  const snapAngle = body.type === 'ball' ? body.angle : 0

  return {
    position: newPos,
    angle: snapAngle,
    targetSurface: rest,
    distance,
  }
}

/**
 * Slope surface snap: project body onto slope, rotate to align, offset by normal.
 */
function computeSlopeSnap(
  contact: SnapSurface,
  rest: SnapSurface,
  body: SceneBody,
): SnapResult | null {
  if (body.type !== 'ball') {
    const generic = computeLineSurfaceSnap(contact, rest, body)
    if (generic) return generic
  }

  // Rest surface direction
  const dx = rest.end.x - rest.start.x
  const dy = rest.end.y - rest.start.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const tangentX = dx / len
  const tangentY = dy / len
  const normalX = rest.normal.x
  const normalY = rest.normal.y

  // Slope angle
  const slopeAngle = Math.atan2(tangentY, tangentX)

  // Determine offset distance based on body type
  let offsetDist: number
  if (body.type === 'ball') {
    offsetDist = body.radius ?? 0.5
  } else {
    // For rectangular bodies, offset = half height (after rotation to match slope)
    const desc = getBodyDescriptor(body.type)
    const { halfH } = desc.getSelectionBounds(body, 1) // scale=1 for world coords
    offsetDist = halfH
  }

  // Project body center onto the rest surface line
  const relX = body.position.x - rest.start.x
  const relY = body.position.y - rest.start.y
  const projDist = relX * normalX + relY * normalY // signed distance from body to surface

  // Gap = how far the body is from the correct snapped position
  const gap = Math.abs(projDist - offsetDist)

  // Check if the projection point is within the surface segment
  const t = (relX * tangentX + relY * tangentY) / len
  if (t < -0.3 || t > 1.3) return null // Allow some margin

  // Add a small gap for non-ball bodies to compensate for stroke rendering overlap
  // (both shapes have lineWidth=2, so ~2px overlap at the contact edge)
  if (body.type !== 'ball') {
    offsetDist += 0.008
  }

  // Compute snap position
  const projPointX = body.position.x - normalX * projDist
  const projPointY = body.position.y - normalY * projDist
  const snapPosX = projPointX + normalX * offsetDist
  const snapPosY = projPointY + normalY * offsetDist

  // Snap angle: for ball, keep current; for others, rotate to match slope
  let snapAngle = body.angle
  if (body.type !== 'ball') {
    snapAngle = slopeAngle
  }

  return {
    position: { x: snapPosX, y: snapPosY },
    angle: snapAngle,
    targetSurface: rest,
    distance: gap,
  }
}

function computeLineSurfaceSnap(
  contact: SnapSurface,
  rest: SnapSurface,
  body: SceneBody,
): SnapResult | null {
  const pose = computeContactPose(contact, rest)
  if (!pose) return null

  const restDx = rest.end.x - rest.start.x
  const restDy = rest.end.y - rest.start.y
  const restLen = Math.sqrt(restDx * restDx + restDy * restDy)
  if (restLen < 0.001) return null

  const tangentX = restDx / restLen
  const tangentY = restDy / restLen
  const currentMid = getSurfaceMidpoint(contact)
  const relX = currentMid.x - rest.start.x
  const relY = currentMid.y - rest.start.y
  const distanceToRest = relX * rest.normal.x + relY * rest.normal.y
  const projectedX = currentMid.x - rest.normal.x * distanceToRest
  const projectedY = currentMid.y - rest.normal.y * distanceToRest
  const along = relX * tangentX + relY * tangentY
  const t = along / restLen

  if (t < -0.3 || t > 1.3) return null

  const visualGap = getVisualGap(body)
  const desiredMid = {
    x: projectedX + rest.normal.x * visualGap,
    y: projectedY + rest.normal.y * visualGap,
  }

  return {
    position: {
      x: desiredMid.x - pose.rotatedMid.x,
      y: desiredMid.y - pose.rotatedMid.y,
    },
    angle: pose.angle,
    targetSurface: rest,
    distance: Math.abs(distanceToRest),
  }
}

function getVisualGap(body: SceneBody): number {
  if (body.type === 'anchor' || body.type === 'pulley-mount') return 0
  return VISUAL_GAP
}

function computeContactPose(
  contact: SnapSurface,
  rest: SnapSurface,
): { angle: number; rotatedMid: { x: number; y: number } } | null {
  const { localStart, localEnd, localNormal } = contact
  if (!localStart || !localEnd || !localNormal) return null

  const localDx = localEnd.x - localStart.x
  const localDy = localEnd.y - localStart.y
  const localLen = Math.sqrt(localDx * localDx + localDy * localDy)
  if (localLen < 0.001) return null

  const restDx = rest.end.x - rest.start.x
  const restDy = rest.end.y - rest.start.y
  const restLen = Math.sqrt(restDx * restDx + restDy * restDy)
  if (restLen < 0.001) return null

  let angle = Math.atan2(restDy, restDx) - Math.atan2(localDy, localDx)
  let worldNormal = rotateVector(localNormal, angle)
  if (worldNormal.x * rest.normal.x + worldNormal.y * rest.normal.y > 0) {
    angle += Math.PI
    worldNormal = rotateVector(localNormal, angle)
  }

  const rotatedMid = rotateVector({
    x: (localStart.x + localEnd.x) / 2,
    y: (localStart.y + localEnd.y) / 2,
  }, angle)

  return { angle, rotatedMid }
}

function rotateVector(
  point: { x: number; y: number },
  angle: number,
): { x: number; y: number } {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }
}

function getSurfaceMidpoint(surface: SnapSurface): { x: number; y: number } {
  return {
    x: (surface.start.x + surface.end.x) / 2,
    y: (surface.start.y + surface.end.y) / 2,
  }
}

/**
 * 检测与 ground 接触的物体 ID 列表（含递归：斜面上的物块也会被检测到）。
 */
export function getGroundContactBodyIds(groundY: number, allBodies: SceneBody[]): string[] {
  const CONTACT_THRESHOLD = 0.05
  const contactedSet = new Set<string>()

  // 找出所有 contact surface 与某个 rest surface 匹配的物体
  function findBodiesOnSurface(restSurfaces: SnapSurface[]) {
    for (const body of allBodies) {
      if (body.type === 'ground' || contactedSet.has(body.id)) continue
      const desc = getBodyDescriptor(body.type)
      if (!desc.getSnapSurfaces) continue
      const surfaces = desc.getSnapSurfaces(body)
      for (const contact of surfaces) {
        if (contact.type !== 'contact') continue
        if (isContactOnRest(contact, restSurfaces)) {
          contactedSet.add(body.id)
          // 递归：这个物体的 rest surface 上可能还有其他物体
          const bodyRestSurfaces = surfaces.filter(s => s.type === 'rest')
          if (bodyRestSurfaces.length > 0) {
            findBodiesOnSurface(bodyRestSurfaces)
          }
          break
        }
      }
    }
  }

  // 检测 contact surface 是否落在某个 rest surface 上
  function isContactOnRest(contact: SnapSurface, rests: SnapSurface[]): boolean {
    const contactMidX = (contact.start.x + contact.end.x) / 2
    const contactMidY = (contact.start.y + contact.end.y) / 2
    for (const rest of rests) {
      const restMidY = (rest.start.y + rest.end.y) / 2
      // 水平面：只检查 Y 距离
      const restDx = rest.end.x - rest.start.x
      const restDy = rest.end.y - rest.start.y
      const restLen = Math.sqrt(restDx * restDx + restDy * restDy)
      const isHorizontal = restLen > 0.001 && Math.abs(restDy / restLen) < 0.05

      if (isHorizontal) {
        if (Math.abs(contactMidY - restMidY) < CONTACT_THRESHOLD) {
          // 检查 X 方向是否有重叠（ground 宽度 >10 跳过检查）
          const restMinX = Math.min(rest.start.x, rest.end.x)
          const restMaxX = Math.max(rest.start.x, rest.end.x)
          if (restMaxX - restMinX > 10) return true // ground 等超宽面，直接通过
          const contactMinX = Math.min(contact.start.x, contact.end.x)
          const contactMaxX = Math.max(contact.start.x, contact.end.x)
          const margin = 0.1
          if (contactMaxX >= restMinX - margin && contactMinX <= restMaxX + margin) return true
        }
      } else {
        // 斜面：计算 contact 中点到 rest 线段的法线距离
        if (restLen < 0.001) continue
        const nx = rest.normal.x, ny = rest.normal.y
        const relX = contactMidX - rest.start.x
        const relY = contactMidY - rest.start.y
        const dist = Math.abs(relX * nx + relY * ny)
        // 还需检查投影是否在线段范围内
        const t = (relX * restDx + relY * restDy) / (restLen * restLen)
        if (t >= -0.3 && t <= 1.3 && dist < CONTACT_THRESHOLD) return true
      }
    }
    return false
  }

  // 起始：ground 的 rest surface
  const groundRest: SnapSurface[] = [{
    type: 'rest',
    start: { x: -100, y: groundY },
    end: { x: 100, y: groundY },
    normal: { x: 0, y: 1 },
  }]
  findBodiesOnSurface(groundRest)

  return Array.from(contactedSet)
}

/**
 * Get rest surfaces for a body via its descriptor.
 */
function getRestSurfaces(body: SceneBody): SnapSurface[] {
  try {
    const desc = getBodyDescriptor(body.type)
    if (!desc.getSnapSurfaces) return []
    return desc.getSnapSurfaces(body).filter((s) => s.type === 'rest')
  } catch {
    return []
  }
}
