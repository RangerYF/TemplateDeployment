/**
 * AngleDragTool — M04 Phase 1 (enhanced with pan / zoom / dblclick-reset)
 *
 * Interaction modes:
 *  - Left-click near the unit circle rim → angle drag (existing behaviour)
 *  - Left-click on empty space → viewport pan
 *  - Double-click → reset viewport to default
 *  - Scroll wheel → zoom at cursor (with bounds clamping)
 *
 * "Near the circle" = distance from origin within [0.5, 1.6] in math coords
 * (generous hit zone so teachers can easily grab point P).
 *
 * Snap logic (when snapEnabled):
 *  - lookupAngle() checks within ±3° of a special angle
 *  - If close, snaps to the exact angle and stores exact values
 */

import { Viewport } from '@/canvas/Viewport';
import type { Tool, ToolEvent } from '@/editor/tools/types';
import type { IEditor } from '@/editor/core/EditorInjectable';
import { useUnitCircleStore, DEFAULT_UNIT_CIRCLE_VIEWPORT } from '@/editor/store/unitCircleStore';
import { lookupAngle, normalizeAngle } from '@/engine/exactValueEngine';
import { UpdateAngleCommand } from '@/editor/commands/UpdateAngleCommand';

/** Distance-from-origin range that counts as "near the circle rim". */
const CIRCLE_HIT_MIN = 0.5;
const CIRCLE_HIT_MAX = 1.6;

/** Viewport range limits (math units). Prevents zooming in/out too far. */
const MIN_RANGE = 0.8;   // min visible range per axis
const MAX_RANGE = 20;    // max visible range per axis

/** Max panning offset from origin (math units). */
const MAX_PAN_OFFSET = 10;

type DragMode = 'angle' | 'pan' | null;

export class AngleDragTool implements Tool {
  readonly id = 'angle-drag';

  private editor:      IEditor | null = null;
  private dragMode:    DragMode = null;
  private prevAngle    = 0;
  // Pan state (canvas-pixel based for sub-pixel accuracy)
  private lastCanvasX  = 0;
  private lastCanvasY  = 0;

  onActivate(editor: IEditor): void {
    this.editor = editor;
  }

  onDeactivate(): void {
    this.dragMode = null;
    this.editor   = null;
  }

  onPointerDown(event: ToolEvent): void {
    // Decide drag mode based on distance from origin
    const dist = Math.hypot(event.mathX, event.mathY);
    if (dist >= CIRCLE_HIT_MIN && dist <= CIRCLE_HIT_MAX) {
      // Angle drag
      this.dragMode  = 'angle';
      this.prevAngle = useUnitCircleStore.getState().angleRad;
      useUnitCircleStore.getState().setDragging(true);
      this.applyAngle(event.mathX, event.mathY);
    } else {
      // Pan
      this.dragMode   = 'pan';
      this.lastCanvasX = event.canvasX;
      this.lastCanvasY = event.canvasY;
      useUnitCircleStore.getState().setDragging(true);
    }
  }

  onPointerMove(event: ToolEvent): void {
    if (this.dragMode === 'angle') {
      this.applyAngle(event.mathX, event.mathY);
    } else if (this.dragMode === 'pan') {
      this.applyPan(event);
    }
  }

  onPointerUp(): void {
    if (this.dragMode === 'angle') {
      this.commitAngleDrag();
    } else if (this.dragMode === 'pan') {
      useUnitCircleStore.getState().setDragging(false);
    }
    this.dragMode = null;
  }

  onPointerLeave(): void {
    if (this.dragMode === 'angle') {
      this.commitAngleDrag();
    } else if (this.dragMode === 'pan') {
      useUnitCircleStore.getState().setDragging(false);
    }
    this.dragMode = null;
  }

  /** Double-click: reset viewport to default centered view. */
  onDblClick(): void {
    if (!this.editor) return;
    const vp = this.editor.getViewport();
    const d  = DEFAULT_UNIT_CIRCLE_VIEWPORT;
    this.editor.setViewport(
      new Viewport(d.xMin, d.xMax, d.yMin, d.yMax, vp.width, vp.height),
    );
  }

  /** Scroll zoom with bounds clamping. */
  onWheel(event: ToolEvent & { deltaY: number }): void {
    if (!this.editor) return;
    const factor = event.deltaY > 0 ? 1.1 : 1 / 1.1;
    const zoomed = this.editor.getViewport().zoomAt(event.mathX, event.mathY, factor);
    this.editor.setViewport(clampViewport(zoomed));
  }

  // ── Private: angle drag ──────────────────────────────────────────────────

  private applyAngle(mathX: number, mathY: number): void {
    const rawRad = Math.atan2(mathY, mathX);
    const rad    = normalizeAngle(rawRad);

    const store = useUnitCircleStore.getState();
    if (store.snapEnabled) {
      const { snapped, snappedAngle, values } = lookupAngle(rad);
      store.setAngle(snappedAngle, snapped, values);
    } else {
      store.setAngle(rad, false, null);
    }
  }

  private commitAngleDrag(): void {
    useUnitCircleStore.getState().setDragging(false);

    const finalAngle = useUnitCircleStore.getState().angleRad;
    if (this.editor && Math.abs(finalAngle - this.prevAngle) > 1e-9) {
      this.editor.execute(new UpdateAngleCommand(this.prevAngle, finalAngle));
    }
  }

  // ── Private: pan ──────────────────────────────────────────────────────────

  private applyPan(event: ToolEvent): void {
    if (!this.editor) return;
    const vp = this.editor.getViewport();
    const dMathX =  (event.canvasX - this.lastCanvasX) / vp.width  * vp.xRange;
    const dMathY = -(event.canvasY - this.lastCanvasY) / vp.height * vp.yRange;
    this.editor.setViewport(clampViewport(vp.pan(dMathX, dMathY)));
    this.lastCanvasX = event.canvasX;
    this.lastCanvasY = event.canvasY;
  }
}

// ── Viewport bounds clamping ──────────────────────────────────────────────────

function clampViewport(vp: Viewport): Viewport {
  let { xMin, xMax, yMin, yMax } = vp;
  const xRange = xMax - xMin;
  const yRange = yMax - yMin;

  // Clamp zoom range
  if (xRange < MIN_RANGE || yRange < MIN_RANGE) {
    const cx = (xMin + xMax) / 2;
    const cy = (yMin + yMax) / 2;
    const r  = MIN_RANGE / 2;
    xMin = cx - r; xMax = cx + r;
    yMin = cy - r; yMax = cy + r;
  } else if (xRange > MAX_RANGE || yRange > MAX_RANGE) {
    const cx = (xMin + xMax) / 2;
    const cy = (yMin + yMax) / 2;
    const rx = Math.min(xRange, MAX_RANGE) / 2;
    const ry = Math.min(yRange, MAX_RANGE) / 2;
    xMin = cx - rx; xMax = cx + rx;
    yMin = cy - ry; yMax = cy + ry;
  }

  // Clamp pan offset (keep origin roughly visible)
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  if (Math.abs(cx) > MAX_PAN_OFFSET) {
    const shift = cx - Math.sign(cx) * MAX_PAN_OFFSET;
    xMin -= shift; xMax -= shift;
  }
  if (Math.abs(cy) > MAX_PAN_OFFSET) {
    const shift = cy - Math.sign(cy) * MAX_PAN_OFFSET;
    yMin -= shift; yMax -= shift;
  }

  if (xMin === vp.xMin && xMax === vp.xMax && yMin === vp.yMin && yMax === vp.yMax) {
    return vp;
  }
  return new Viewport(xMin, xMax, yMin, yMax, vp.width, vp.height);
}
