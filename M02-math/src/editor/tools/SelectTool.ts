import type { Editor } from '@/editor/core/Editor';
import type { Tool, ToolEvent } from '@/editor/tools/types';
import { applyWheelZoom } from '@/editor/tools/zoomHelper';
import { Viewport } from '@/canvas/Viewport';
import { useAnimationStore } from '@/editor/store/animationStore';
import { startMultiAnimation, easeOut } from '@/engine/animationEngine';

/**
 * Select tool — click to select a function curve.
 * Does NOT pan on drag (unlike PanZoomTool).
 */
export class SelectTool implements Tool {
  readonly id = 'select';
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
