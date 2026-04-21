import { Viewport } from '@/canvas/Viewport';
import type { Editor } from '@/editor/core/Editor';
import type { Tool, ToolEvent } from '@/editor/tools/types';
import { applyWheelZoom } from '@/editor/tools/zoomHelper';
import { useAnimationStore } from '@/editor/store/animationStore';
import { startMultiAnimation, easeOut } from '@/engine/animationEngine';

/** Math-coordinate bounds to animate back to on double-click. */
export interface PanZoomResetViewport {
  xMin: number; xMax: number; yMin: number; yMax: number;
}

const DEFAULT_RESET: PanZoomResetViewport = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };

export class PanZoomTool implements Tool {
  readonly id = 'pan-zoom';
  private isDragging   = false;
  private lastCanvasX  = 0;
  private lastCanvasY  = 0;
  private editor: Editor | null = null;
  private readonly resetTo: PanZoomResetViewport;

  constructor(resetViewport?: PanZoomResetViewport) {
    this.resetTo = resetViewport ?? DEFAULT_RESET;
  }

  onActivate(editor: Editor): void {
    this.editor = editor;
  }

  onDeactivate(): void {
    this.isDragging = false;
  }

  onPointerDown(e: ToolEvent): void {
    this.isDragging  = true;
    this.lastCanvasX = e.canvasX;
    this.lastCanvasY = e.canvasY;
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.isDragging || !this.editor) return;
    const vp = this.editor.getViewport();
    // Canvas-pixel deltas → math deltas (Y axis is flipped)
    const dMathX =  (e.canvasX - this.lastCanvasX) / vp.width  * vp.xRange;
    const dMathY = -(e.canvasY - this.lastCanvasY) / vp.height * vp.yRange;
    this.editor.setViewport(vp.pan(dMathX, dMathY));
    this.lastCanvasX = e.canvasX;
    this.lastCanvasY = e.canvasY;
  }

  onPointerUp(): void {
    this.isDragging = false;
  }

  onPointerLeave(): void {
    this.isDragging = false;
  }

  /** Double-click smoothly animates the viewport back to the default ±10 / ±6 range. */
  onDblClick(): void {
    if (!this.editor) return;
    const currentVp = this.editor.getViewport();

    // Mutable working values shared across the four onFrame callbacks
    let xMin = currentVp.xMin;
    let xMax = currentVp.xMax;
    let yMin = currentVp.yMin;
    let yMax = currentVp.yMax;

    const sync = () => {
      this.editor!.setViewport(
        new Viewport(xMin, xMax, yMin, yMax, currentVp.width, currentVp.height),
      );
    };

    useAnimationStore.getState().setIsAnimating(true);

    startMultiAnimation(
      [
        { from: currentVp.xMin, to: this.resetTo.xMin, onFrame: (v) => { xMin = v; sync(); } },
        { from: currentVp.xMax, to: this.resetTo.xMax, onFrame: (v) => { xMax = v; sync(); } },
        { from: currentVp.yMin, to: this.resetTo.yMin, onFrame: (v) => { yMin = v; sync(); } },
        { from: currentVp.yMax, to: this.resetTo.yMax, onFrame: (v) => { yMax = v; sync(); } },
      ],
      easeOut,
      400,
      () => { useAnimationStore.getState().setIsAnimating(false); },
    );
  }

  onWheel(e: ToolEvent & { deltaY: number }): void {
    applyWheelZoom(this.editor, e);
  }
}
