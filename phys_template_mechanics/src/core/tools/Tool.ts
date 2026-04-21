import type { Viewport } from '@/renderer/CoordinateSystem'

export interface CanvasMouseEvent {
  screenPos: { x: number; y: number }
  worldPos: { x: number; y: number }
  button: number
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
}

export interface Tool {
  name: string
  cursor: string
  onMouseDown(e: CanvasMouseEvent): void
  onMouseMove(e: CanvasMouseEvent): void
  onMouseUp(e: CanvasMouseEvent): void
  onKeyDown(e: KeyboardEvent): void
  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void
}
