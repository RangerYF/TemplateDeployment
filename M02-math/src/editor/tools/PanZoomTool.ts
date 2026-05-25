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
  private latestCanvasX = 0;
  private latestCanvasY = 0;
  private editor: Editor | null = null;
  private readonly resetTo: PanZoomResetViewport;
  private rafId: number | null = null;

  constructor(resetViewport?: PanZoomResetViewport) {
    this.resetTo = resetViewport ?? DEFAULT_RESET;
  }

  onActivate(editor: Editor): void {
    this.editor = editor;
  }

  onDeactivate(): void {
    this.isDragging = false;
    this.cancelPendingFrame();
  }

  onPointerDown(e: ToolEvent): void {
    this.isDragging  = true;
    this.lastCanvasX = e.canvasX;
    this.lastCanvasY = e.canvasY;
    this.latestCanvasX = e.canvasX;
    this.latestCanvasY = e.canvasY;
  }

  onPointerMove(e: ToolEvent): void {
    if (!this.isDragging || !this.editor) return;
    this.latestCanvasX = e.canvasX;
    this.latestCanvasY = e.canvasY;
    this.schedulePanFrame();
  }

  onPointerUp(): void {
    this.flushPan();
    this.isDragging = false;
  }

  onPointerLeave(): void {
    this.flushPan();
    this.isDragging = false;
  }

  private cancelPendingFrame(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private schedulePanFrame(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flushPan();
      if (
        this.isDragging &&
        (this.latestCanvasX !== this.lastCanvasX || this.latestCanvasY !== this.lastCanvasY)
      ) {
        this.schedulePanFrame();
      }
    });
  }

  private flushPan(): void {
    if (!this.editor) return;
    if (this.latestCanvasX === this.lastCanvasX && this.latestCanvasY === this.lastCanvasY) {
      this.cancelPendingFrame();
      return;
    }

    const vp = this.editor.getViewport();
    // Canvas-pixel deltas → math deltas (Y axis is flipped)
    const dMathX =  (this.latestCanvasX - this.lastCanvasX) / vp.width  * vp.xRange;
    const dMathY = -(this.latestCanvasY - this.lastCanvasY) / vp.height * vp.yRange;
    this.editor.setViewport(vp.pan(dMathX, dMathY));
    this.lastCanvasX = this.latestCanvasX;
    this.lastCanvasY = this.latestCanvasY;
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
