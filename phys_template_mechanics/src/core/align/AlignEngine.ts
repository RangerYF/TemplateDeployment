import type { SceneBody } from '@/models/types'
import { getBodyDescriptor, getInteraction } from '@/models/bodyTypes'

export interface AlignGuide {
  type: 'horizontal' | 'vertical'
  /** World coordinate: y-value for horizontal, x-value for vertical */
  position: number
  /** The value to snap the dragged body's coordinate to */
  snapValue: number
  /** Which alignment was detected */
  alignType: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

const ALIGN_THRESHOLD = 0.15 // world units

interface BoundsInfo {
  centerX: number
  centerY: number
  top: number
  bottom: number
  left: number
  right: number
}

function getBodyBounds(body: SceneBody): BoundsInfo {
  const { x, y } = body.position

  // For rotated bodies, use axis-aligned bounding box
  // For simplicity, use selection bounds at scale=1 (world coords)
  try {
    const desc = getBodyDescriptor(body.type)
    const { halfW, halfH } = desc.getSelectionBounds(body, 1) // scale=1 = world units

    // Note: selection bounds are in screen-local coords where y is flipped
    // In world coords, top = y + halfH, bottom = y - halfH
    return {
      centerX: x,
      centerY: y,
      top: y + halfH,
      bottom: y - halfH,
      left: x - halfW,
      right: x + halfW,
    }
  } catch {
    return { centerX: x, centerY: y, top: y, bottom: y, left: x, right: x }
  }
}

/**
 * Compute alignment guides for a dragged body against all other bodies.
 * Returns at most 1 horizontal + 1 vertical guide (the closest ones).
 */
export function computeAlignGuides(
  draggedBody: SceneBody,
  allBodies: SceneBody[],
): AlignGuide[] {
  const dragBounds = getBodyBounds(draggedBody)

  let bestH: AlignGuide | null = null
  let bestHDist = Infinity
  let bestV: AlignGuide | null = null
  let bestVDist = Infinity

  for (const other of allBodies) {
    if (other.id === draggedBody.id) continue
    if (!getInteraction(other).canAlign) continue

    const otherBounds = getBodyBounds(other)

    // Horizontal alignments (compare y values)
    const hChecks: Array<{ dragVal: number; otherVal: number; alignType: AlignGuide['alignType'] }> = [
      { dragVal: dragBounds.centerY, otherVal: otherBounds.centerY, alignType: 'center' },
      { dragVal: dragBounds.top, otherVal: otherBounds.top, alignType: 'top' },
      { dragVal: dragBounds.bottom, otherVal: otherBounds.bottom, alignType: 'bottom' },
    ]

    for (const check of hChecks) {
      const dist = Math.abs(check.dragVal - check.otherVal)
      if (dist < ALIGN_THRESHOLD && dist < bestHDist) {
        bestHDist = dist
        const snapDelta = check.otherVal - check.dragVal
        bestH = {
          type: 'horizontal',
          position: check.otherVal,
          snapValue: draggedBody.position.y + snapDelta,
          alignType: check.alignType,
        }
      }
    }

    // Vertical alignments (compare x values)
    const vChecks: Array<{ dragVal: number; otherVal: number; alignType: AlignGuide['alignType'] }> = [
      { dragVal: dragBounds.centerX, otherVal: otherBounds.centerX, alignType: 'center' },
      { dragVal: dragBounds.left, otherVal: otherBounds.left, alignType: 'left' },
      { dragVal: dragBounds.right, otherVal: otherBounds.right, alignType: 'right' },
    ]

    for (const check of vChecks) {
      const dist = Math.abs(check.dragVal - check.otherVal)
      if (dist < ALIGN_THRESHOLD && dist < bestVDist) {
        bestVDist = dist
        const snapDelta = check.otherVal - check.dragVal
        bestV = {
          type: 'vertical',
          position: check.otherVal,
          snapValue: draggedBody.position.x + snapDelta,
          alignType: check.alignType,
        }
      }
    }
  }

  const guides: AlignGuide[] = []
  if (bestH) guides.push(bestH)
  if (bestV) guides.push(bestV)
  return guides
}
