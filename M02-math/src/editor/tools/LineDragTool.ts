/**
 * LineDragTool — click and drag the active line to translate it,
 * or rotate it around a focus when focal-constraint mode is active.
 *
 * Normal mode:
 *   • Drag a non-vertical line → updates `b` (y-intercept), keeping slope k fixed.
 *   • Drag a vertical line     → updates `x`, keeping it vertical.
 *
 * Focal-constraint mode (`focalConstraint` set):
 *   • The line is pinned to the given focus (fx, fy).
 *   • Dragging rotates the line around the focus — slope k and intercept b
 *     are derived from the angle between the focus and the cursor.
 *   • Vertical ↔ non-vertical transitions happen seamlessly at α ≈ 90°.
 *
 * Common:
 *   • Click that misses the line → does nothing.
 *   • Scroll wheel → zoom (same as PanZoomTool).
 *   • Drag release commits a single UpdateLineParamCommand for Undo/Redo.
 */

import type { Editor } from '@/editor/core/Editor';
import type { Tool, ToolEvent } from '@/editor/tools/types';
import { useEntityStore } from '@/editor/store/entityStore';
import { updateLineParams } from '@/editor/entities/line';
import { UpdateLineParamCommand } from '@/editor/commands/UpdateLineParamCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import type { LineEntity } from '@/types';

/** Canvas-pixel radius that counts as "on the line". */
const HIT_PX = 12;

/** When |slope| exceeds this threshold, switch to vertical mode. */
const VERTICAL_SLOPE_THRESHOLD = 200;

export interface FocalConstraint {
  fx: number;
  fy: number;
}

export class LineDragTool implements Tool {
  readonly id = 'line-drag';

  private editor:    Editor | null = null;
  private dragging   = false;
  private startMathX = 0;
  private startMathY = 0;
  private snapB      = 0;
  private snapX      = 0;
  private before:    LineEntity | null = null;

  /** When set, the line rotates around this focus instead of translating. */
  public focalConstraint: FocalConstraint | null = null;

  onActivate(editor: Editor): void {
    this.editor = editor;
  }

  onDeactivate(): void {
    this.dragging = false;
    this.before   = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getActiveLine(): LineEntity | null {
    const s = useEntityStore.getState();
    const e = s.entities.find((en) => en.id === s.activeEntityId);
    return e?.type === 'line' ? e : null;
  }

  /**
   * Perpendicular distance from math point (mx, my) to the line,
   * expressed in canvas pixels using the current viewport x-scale.
   */
  private hitPixels(mx: number, my: number, line: LineEntity): number {
    if (!this.editor) return Infinity;
    const vp = this.editor.getViewport();
    const pxPerMathX = vp.width / vp.xRange;

    let mathDist: number;
    if (line.params.vertical) {
      mathDist = Math.abs(mx - line.params.x);
    } else {
      const { k, b } = line.params;
      mathDist = Math.abs(my - k * mx - b) / Math.sqrt(1 + k * k);
    }
    return mathDist * pxPerMathX;
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  onPointerDown(ev: ToolEvent): void {
    const line = this.getActiveLine();
    if (!line || this.hitPixels(ev.mathX, ev.mathY, line) > HIT_PX) return;

    this.dragging    = true;
    this.startMathX  = ev.mathX;
    this.startMathY  = ev.mathY;
    this.snapB       = line.params.b;
    this.snapX       = line.params.x;
    this.before      = { ...line, params: { ...line.params } };
  }

  onPointerMove(ev: ToolEvent): void {
    if (!this.dragging) return;
    const line = this.getActiveLine();
    if (!line) { this.dragging = false; return; }

    if (this.focalConstraint) {
      // Focal-constraint mode: rotate around focus
      this.applyFocalRotation(line, ev.mathX, ev.mathY);
    } else {
      // Normal translation mode
      if (line.params.vertical) {
        const dx = ev.mathX - this.startMathX;
        useEntityStore.getState().updateEntity(
          line.id, updateLineParams(line, { x: this.snapX + dx }),
        );
      } else {
        const dy = ev.mathY - this.startMathY;
        useEntityStore.getState().updateEntity(
          line.id, updateLineParams(line, { b: this.snapB + dy }),
        );
      }
    }
  }

  onPointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;

    const after = this.getActiveLine();
    if (!this.before || !after) { this.before = null; return; }

    const moved =
      Math.abs(after.params.b - this.before.params.b) > 1e-9 ||
      Math.abs(after.params.x - this.before.params.x) > 1e-9 ||
      Math.abs(after.params.k - this.before.params.k) > 1e-9 ||
      (after.params.vertical !== this.before.params.vertical);

    if (moved) {
      executeM03Command(new UpdateLineParamCommand(after.id, this.before, after));
    }
    this.before = null;
  }

  onPointerLeave(): void {
    this.dragging = false;
    this.before   = null;
  }

  onWheel(ev: ToolEvent & { deltaY: number }): void {
    if (!this.editor) return;
    const factor = ev.deltaY > 0 ? 1.1 : 1 / 1.1;
    this.editor.setViewport(
      this.editor.getViewport().zoomAt(ev.mathX, ev.mathY, factor),
    );
  }

  // ── Focal rotation ──────────────────────────────────────────────────────

  private applyFocalRotation(line: LineEntity, mx: number, my: number): void {
    const { fx, fy } = this.focalConstraint!;
    const dx = mx - fx;
    const dy = my - fy;

    // If cursor is very close to focus, don't update (avoid jitter)
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return;

    const slope = dy / dx;

    if (Math.abs(dx) < 1e-6 || Math.abs(slope) > VERTICAL_SLOPE_THRESHOLD) {
      // Near-vertical: switch to vertical line through focus
      useEntityStore.getState().updateEntity(
        line.id, updateLineParams(line, { vertical: true, x: fx }),
      );
    } else {
      // y = k·x + b  where line passes through (fx, fy):  b = fy - k·fx
      const k = slope;
      const b = fy - k * fx;
      useEntityStore.getState().updateEntity(
        line.id, updateLineParams(line, { vertical: false, k, b }),
      );
    }
  }
}
