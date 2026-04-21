export interface Viewport {
  offset: { x: number; y: number }
  scale: number // pixels per meter
  canvasSize: { width: number; height: number }
}

/**
 * Physics world: origin at canvas bottom-center, y-up, unit = meters
 * Screen: origin at top-left, y-down, unit = pixels
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: Viewport,
): { x: number; y: number } {
  const { offset, scale, canvasSize } = viewport
  return {
    x: canvasSize.width / 2 + offset.x + worldX * scale,
    y: canvasSize.height - (offset.y + worldY * scale),
  }
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: Viewport,
): { x: number; y: number } {
  const { offset, scale, canvasSize } = viewport
  return {
    x: (screenX - canvasSize.width / 2 - offset.x) / scale,
    y: (canvasSize.height - screenY - offset.y) / scale,
  }
}
