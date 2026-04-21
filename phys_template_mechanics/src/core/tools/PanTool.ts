import type { Tool, CanvasMouseEvent } from './Tool'
import type { Viewport } from '@/renderer/CoordinateSystem'

export class PanTool implements Tool {
  name = 'pan'
  cursor = 'grab'

  onMouseDown(_e: CanvasMouseEvent): void {
    void _e
  }

  onMouseMove(_e: CanvasMouseEvent): void {
    void _e
  }

  onMouseUp(_e: CanvasMouseEvent): void {
    void _e
  }

  onKeyDown(_e: KeyboardEvent): void {
    void _e
  }

  render(_ctx: CanvasRenderingContext2D, _viewport: Viewport): void {
    void _ctx
    void _viewport
  }
}
