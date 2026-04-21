import type { SceneBody } from '@/models/types'
import { getBodyDescriptor, getInteraction } from '@/models/bodyTypes'

export type HandleType =
  | 'nw' | 'ne' | 'se' | 'sw'
  | 'edge-n' | 'edge-s' | 'edge-e' | 'edge-w'
  | 'rotate'

export interface HandleInfo {
  id: HandleType
  /** Screen-space position relative to body center (in rotated canvas frame) */
  x: number
  y: number
  cursor: string
}

export interface SelectionBBox {
  halfW: number
  halfH: number
  /** Offset of bbox center from body origin in local screen coords */
  centerX: number
  centerY: number
}

/** Handle hit radius in screen pixels */
const HANDLE_HIT_RADIUS = 7
/** Edge hit distance in screen pixels */
const EDGE_HIT_DIST = 5

export const CURSOR_MAP: Record<string, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  'edge-n': 'ns-resize',
  'edge-s': 'ns-resize',
  'edge-e': 'ew-resize',
  'edge-w': 'ew-resize',
  rotate: 'default',
}

/**
 * Get the bounding box half-extents for a body (screen px).
 */
export function getSelectionBBox(body: SceneBody, scale: number): SelectionBBox | null {
  const interaction = getInteraction(body)
  if (!interaction.showResizeHandles && !interaction.showRotateHandle) return null

  const desc = getBodyDescriptor(body.type)
  const { halfW, halfH } = desc.getSelectionBounds(body, scale)

  // Center offset from getLocalBBox (scaled to screen pixels)
  let centerX = 0
  let centerY = 0
  if (desc.getLocalBBox) {
    const localBBox = desc.getLocalBBox(body)
    centerX = localBBox.centerOffsetX * scale
    centerY = localBBox.centerOffsetY * scale
  }

  return { halfW, halfH, centerX, centerY }
}

/**
 * Compute visible handle positions (4 corners + 1 rotate at NW).
 */
export function getHandles(body: SceneBody, scale: number): HandleInfo[] {
  const bbox = getSelectionBBox(body, scale)
  if (!bbox) return []

  const interaction = getInteraction(body)
  const { halfW, halfH, centerX, centerY } = bbox
  const handles: HandleInfo[] = []

  // 4 corner handles (offset by bbox center)
  if (interaction.showResizeHandles) {
    handles.push({ id: 'nw', x: centerX - halfW, y: centerY - halfH, cursor: CURSOR_MAP.nw })
    handles.push({ id: 'ne', x: centerX + halfW, y: centerY - halfH, cursor: CURSOR_MAP.ne })
    handles.push({ id: 'se', x: centerX + halfW, y: centerY + halfH, cursor: CURSOR_MAP.se })
    handles.push({ id: 'sw', x: centerX - halfW, y: centerY + halfH, cursor: CURSOR_MAP.sw })
  }

  // Rotate handle at NW corner (offset slightly outside, closer to corner)
  if (interaction.showRotateHandle) {
    handles.push({ id: 'rotate', x: centerX - halfW - 10, y: centerY - halfH - 10, cursor: CURSOR_MAP.rotate })
  }

  return handles
}

/**
 * Hit-test at a screen-local position (relative to body center, in rotated canvas frame).
 * Tests: corners → rotate → edges (priority order).
 */
export function hitTestHandle(
  localScreenX: number,
  localScreenY: number,
  handles: HandleInfo[],
  bbox: SelectionBBox,
): HandleType | null {
  // 1. Test corner handles and rotate handle
  for (const h of handles) {
    const dx = localScreenX - h.x
    const dy = localScreenY - h.y
    if (dx * dx + dy * dy <= HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS) {
      return h.id
    }
  }

  // 2. Test edges (hover near the selection box boundary)
  const { halfW, halfH, centerX, centerY } = bbox
  // Shift test point into bbox-center-relative coords
  const x = localScreenX - centerX
  const y = localScreenY - centerY

  // Check if point is near the bounding box area (within extended range)
  const margin = EDGE_HIT_DIST + 2
  if (x < -halfW - margin || x > halfW + margin || y < -halfH - margin || y > halfH + margin) {
    return null
  }

  // Top edge
  if (Math.abs(y - (-halfH)) < EDGE_HIT_DIST && x >= -halfW && x <= halfW) return 'edge-n'
  // Bottom edge
  if (Math.abs(y - halfH) < EDGE_HIT_DIST && x >= -halfW && x <= halfW) return 'edge-s'
  // Left edge (screen -halfW = west)
  if (Math.abs(x - (-halfW)) < EDGE_HIT_DIST && y >= -halfH && y <= halfH) return 'edge-w'
  // Right edge (screen +halfW = east)
  if (Math.abs(x - halfW) < EDGE_HIT_DIST && y >= -halfH && y <= halfH) return 'edge-e'

  return null
}

/** Minimum size constraints (world coordinates, meters) */
const MIN_HALF = 0.05
const MIN_RADIUS = 0.05

interface ResizeResult {
  props: Partial<SceneBody>
  /** New body center position in world coords (absolute, not delta) */
  newPosition: { x: number; y: number }
}

/**
 * Compute new properties after a resize drag.
 * Uses descriptor's getLocalBBox/applyResize — zero body.type switch-case.
 *
 * @param handle Which handle/edge is being dragged
 * @param localDx Delta X in body-local frame (right = positive), world units (px / scale)
 * @param localDy Delta Y in body-local screen frame (down = positive), world units
 * @param origBody The body state at drag start (original dimensions)
 * @returns Absolute new properties and new center position
 */
export function computeResize(
  handle: HandleType,
  localDx: number,
  localDy: number,
  origBody: SceneBody,
): ResizeResult | null {
  if (handle === 'rotate') return null

  const desc = getBodyDescriptor(origBody.type)
  if (!desc.getLocalBBox || !desc.applyResize) return null

  const bbox = desc.getLocalBBox(origBody)
  const mode = desc.resizeMode ?? 'independent'

  const cornerSigns: Record<string, { sx: number; sy: number }> = {
    nw: { sx: -1, sy: -1 },
    ne: { sx: 1, sy: -1 },
    se: { sx: 1, sy: 1 },
    sw: { sx: -1, sy: 1 },
  }

  let newHalfW = bbox.halfW
  let newHalfH = bbox.halfH
  // Raw (signed, unclamped) values for smooth position tracking through flip transitions
  let rawHalfW = bbox.halfW
  let rawHalfH = bbox.halfH
  let flipped = origBody.flipped ?? false
  let sx = 0
  let sy = 0

  if (handle in cornerSigns) {
    ;({ sx, sy } = cornerSigns[handle])

    if (mode === 'radius') {
      // Proportional scaling with diagonal projection
      const deltaR = (localDx * sx + localDy * sy) / 4
      newHalfW = newHalfH = Math.max(MIN_RADIUS, bbox.halfW + deltaR)
      rawHalfW = rawHalfH = newHalfW
    } else {
      // Independent first pass
      rawHalfW = bbox.halfW + (sx * localDx) / 2
      rawHalfH = bbox.halfH + (sy * localDy) / 2
      if (rawHalfW < 0) {
        flipped = !(origBody.flipped ?? false)
        newHalfW = Math.max(MIN_HALF, -rawHalfW)
      } else {
        newHalfW = Math.max(MIN_HALF, rawHalfW)
      }
      newHalfH = Math.max(MIN_HALF, rawHalfH)

      if (mode === 'uniform') {
        // Enforce same scale factor on both axes
        const scaleW = newHalfW / bbox.halfW
        const scaleH = newHalfH / bbox.halfH
        const scale = Math.abs(scaleW - 1) > Math.abs(scaleH - 1) ? scaleW : scaleH
        newHalfW = Math.max(MIN_HALF, bbox.halfW * scale)
        newHalfH = Math.max(MIN_HALF, bbox.halfH * scale)
        rawHalfW = bbox.halfW * scale
        rawHalfH = bbox.halfH * scale
      }
    }
  } else {
    // Edge handles — single axis
    if (mode === 'radius') return null // Circle bodies: corners only

    switch (handle) {
      case 'edge-n':
        sy = -1
        rawHalfH = bbox.halfH - localDy / 2
        newHalfH = Math.max(MIN_HALF, rawHalfH)
        break
      case 'edge-s':
        sy = 1
        rawHalfH = bbox.halfH + localDy / 2
        newHalfH = Math.max(MIN_HALF, rawHalfH)
        break
      case 'edge-e': {
        sx = 1
        rawHalfW = bbox.halfW + localDx / 2
        if (rawHalfW < 0) {
          flipped = !(origBody.flipped ?? false)
          newHalfW = Math.max(MIN_HALF, -rawHalfW)
        } else {
          newHalfW = Math.max(MIN_HALF, rawHalfW)
        }
        break
      }
      case 'edge-w': {
        sx = -1
        rawHalfW = bbox.halfW - localDx / 2
        if (rawHalfW < 0) {
          flipped = !(origBody.flipped ?? false)
          newHalfW = Math.max(MIN_HALF, -rawHalfW)
        } else {
          newHalfW = Math.max(MIN_HALF, rawHalfW)
        }
        break
      }
    }

    if (mode === 'uniform') {
      // Scale both axes proportionally from edge drag
      if (newHalfW !== bbox.halfW) {
        const scale = newHalfW / bbox.halfW
        newHalfH = Math.max(MIN_HALF, bbox.halfH * scale)
        rawHalfH = bbox.halfH * scale
      } else if (newHalfH !== bbox.halfH) {
        const scale = newHalfH / bbox.halfH
        newHalfW = Math.max(MIN_HALF, bbox.halfW * scale)
        rawHalfW = bbox.halfW * scale
      }
    }
  }

  // Apply new dimensions via descriptor
  const props = desc.applyResize(origBody, newHalfW, newHalfH)
  if (!props) return null

  props.flipped = flipped

  // Position shift using raw (signed, unclamped) values for smooth mouse tracking.
  // For types with variable centerOffset (e.g. hemisphere), scale proportionally.
  const rawCenterOffsetX = bbox.halfW !== 0
    ? bbox.centerOffsetX * rawHalfW / bbox.halfW
    : bbox.centerOffsetX
  const rawCenterOffsetY = bbox.halfH !== 0
    ? bbox.centerOffsetY * rawHalfH / bbox.halfH
    : bbox.centerOffsetY

  const anchorX = bbox.centerOffsetX + (-sx) * bbox.halfW
  const anchorY = bbox.centerOffsetY + (-sy) * bbox.halfH
  const newAnchorX = rawCenterOffsetX + (-sx) * rawHalfW
  const newAnchorY = rawCenterOffsetY + (-sy) * rawHalfH

  const localShiftX = anchorX - newAnchorX
  const localShiftY = anchorY - newAnchorY

  // Rotate to world coords (screen Y-down → world Y-up: flip Y)
  const angle = origBody.angle
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const worldDx = localShiftX * cos - (-localShiftY) * sin
  const worldDy = localShiftX * sin + (-localShiftY) * cos

  return {
    props,
    newPosition: {
      x: origBody.position.x + worldDx,
      y: origBody.position.y + worldDy,
    },
  }
}

/**
 * Compute rotation angle from mouse world position relative to body center.
 * Returns the angle so that the body's "up" direction points toward the mouse.
 */
export function computeRotation(
  mouseWorldX: number,
  mouseWorldY: number,
  bodyCenterX: number,
  bodyCenterY: number,
): number {
  const dx = mouseWorldX - bodyCenterX
  const dy = mouseWorldY - bodyCenterY
  // We want body's local Y-up to point at (dx, dy)
  // Body local Y-up in world = (-sin(angle), cos(angle))
  // So angle = atan2(-dx, dy)
  return Math.atan2(-dx, dy)
}

