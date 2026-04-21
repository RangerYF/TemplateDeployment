import type { Editor } from '@/editor/core/Editor';
import type { Tool, ToolEvent } from '@/editor/tools/types';
import { applyWheelZoom } from '@/editor/tools/zoomHelper';
import { Viewport } from '@/canvas/Viewport';
import { useAnimationStore } from '@/editor/store/animationStore';
import { startMultiAnimation, easeOut } from '@/engine/animationEngine';

/**
 * Pin-point tool — left-click on a curve to toggle a pinned point.
 * No pan on drag.  Click handling is done in FunctionCanvas (reads mode from canvasToolStore).
 */
export class PinPointTool implements Tool {
  readonly id = 'pin-point';
  private editor: Editor | null = null;

  onActivate(editor: Editor): void {
    this.editor = editor;
  }

  onWheel(e: ToolEvent & { deltaY: number }): void {
    applyWheelZoom(this.editor, e);
  }

  onDblClick(): void {
    if (!this.editor) return;
    const currentVp = this.editor.getViewport();
    let xMin = currentVp.xMin, xMax = currentVp.xMax;
    let yMin = currentVp.yMin, yMax = currentVp.yMax;
    const sync = () => {
      this.editor!.setViewport(
        new Viewport(xMin, xMax, yMin, yMax, currentVp.width, currentVp.height),
      );
    };
    useAnimationStore.getState().setIsAnimating(true);
    startMultiAnimation(
      [
        { from: currentVp.xMin, to: -10, onFrame: (v) => { xMin = v; sync(); } },
        { from: currentVp.xMax, to: 10,  onFrame: (v) => { xMax = v; sync(); } },
        { from: currentVp.yMin, to: -6,  onFrame: (v) => { yMin = v; sync(); } },
        { from: currentVp.yMax, to: 6,   onFrame: (v) => { yMax = v; sync(); } },
      ],
      easeOut, 400,
      () => { useAnimationStore.getState().setIsAnimating(false); },
    );
  }
}
