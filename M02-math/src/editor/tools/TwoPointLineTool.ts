/**
 * TwoPointLineTool — define the active line by clicking two canvas points.
 *
 * Interaction flow:
 *   1st click  → records P₁; draws a green dot + instruction hint on the dynamic canvas.
 *   Pointer move (after P₁) → draws a dashed preview line P₁→cursor on dynamic canvas.
 *   2nd click  → computes line params (slope or vertical), updates the active LineEntity,
 *                commits one UpdateLineParamCommand, clears dynamic canvas, switches
 *                active tool back to 'pan-zoom'.
 *   Escape key → handled externally in GeometryCanvas via activeTool store reset;
 *                onDeactivate() clears the overlay.
 *   Wheel      → zoom (same as PanZoomTool) so teacher can pan/zoom mid-interaction.
 */

import type { Editor } from '@/editor/core/Editor';
import type { Tool, ToolEvent } from '@/editor/tools/types';
import { useEntityStore } from '@/editor/store/entityStore';
import { updateLineParams } from '@/editor/entities/line';
import { UpdateLineParamCommand } from '@/editor/commands/UpdateLineParamCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { hiDpiClear } from '@/editor/tools/canvasUtils';
import type { LineEntity, LineParams } from '@/types';

const SNAP_COLOR = '#32D583';  // M03 primary green
const DOT_RADIUS = 6;

export class TwoPointLineTool implements Tool {
  readonly id = 'line-two-point';

  private editor:      Editor | null = null;
  private getDynamic:  () => HTMLCanvasElement | null;
  private firstPt:     [number, number] | null = null;

  constructor(getDynamic: () => HTMLCanvasElement | null) {
    this.getDynamic = getDynamic;
  }

  onActivate(editor: Editor): void {
    this.editor   = editor;
    this.firstPt  = null;
    this.clearCanvas();
  }

  onDeactivate(): void {
    this.clearCanvas();
    this.firstPt = null;
  }

  // ── Canvas helpers ─────────────────────────────────────────────────────────

  private clearCanvas(): void {
    const c = this.getDynamic();
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  }

  /** Draw P₁ dot + coordinate pill + instruction banner. */
  private drawFirstPointOverlay(mx: number, my: number): void {
    const canvas = this.getDynamic();
    if (!canvas || !this.editor) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vp = this.editor.getViewport();
    hiDpiClear(ctx, canvas);

    // Instruction banner at top of canvas
    const hint = '点击第二个点以确定直线';
    ctx.font = '12px sans-serif';
    const htw = ctx.measureText(hint).width;
    const bx  = canvas.width / 2 - htw / 2 - 10;
    const by  = 10;
    ctx.fillStyle   = 'rgba(50,213,131,0.15)';
    ctx.strokeStyle = SNAP_COLOR;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, htw + 20, 24, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle    = SNAP_COLOR;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hint, canvas.width / 2, by + 12);

    // P₁ dot
    const [cx, cy] = vp.toCanvas(mx, my);
    renderDot(ctx, cx, cy, mx, my, 'P₁');
  }

  /** Clear and redraw P₁ dot + dashed preview line + ghost P₂ at cursor. */
  private drawPreview(hx: number, hy: number): void {
    const canvas = this.getDynamic();
    if (!canvas || !this.editor || !this.firstPt) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vp = this.editor.getViewport();
    hiDpiClear(ctx, canvas);

    // Instruction banner
    const hint = '点击第二个点以确定直线';
    ctx.font = '12px sans-serif';
    const htw = ctx.measureText(hint).width;
    ctx.fillStyle   = 'rgba(50,213,131,0.15)';
    ctx.strokeStyle = SNAP_COLOR;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(canvas.width / 2 - htw / 2 - 10, 10, htw + 20, 24, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle    = SNAP_COLOR;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hint, canvas.width / 2, 22);

    // Dashed preview line P₁ → cursor
    const [cx1, cy1] = vp.toCanvas(this.firstPt[0], this.firstPt[1]);
    const [cx2, cy2] = vp.toCanvas(hx, hy);
    ctx.save();
    ctx.strokeStyle = SNAP_COLOR;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([7, 4]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
    ctx.stroke();
    ctx.restore();

    // P₁ dot
    renderDot(ctx, cx1, cy1, this.firstPt[0], this.firstPt[1], 'P₁');

    // Ghost P₂ at cursor
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx2, cy2, DOT_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle   = SNAP_COLOR + 'AA';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // ── Store helper ───────────────────────────────────────────────────────────

  private getActiveLine(): LineEntity | null {
    const s = useEntityStore.getState();
    const e = s.entities.find((en) => en.id === s.activeEntityId);
    return e?.type === 'line' ? e : null;
  }

  // ── Tool events ────────────────────────────────────────────────────────────

  onPointerDown(ev: ToolEvent): void {
    if (!this.firstPt) {
      // First click: record P₁
      this.firstPt = [ev.mathX, ev.mathY];
      this.drawFirstPointOverlay(ev.mathX, ev.mathY);
      return;
    }

    // Second click: compute line from P₁ → P₂
    const [x1, y1] = this.firstPt;
    const  x2 = ev.mathX, y2 = ev.mathY;

    // Ignore if points coincide
    if (Math.abs(x1 - x2) < 1e-6 && Math.abs(y1 - y2) < 1e-6) return;

    const prev = this.getActiveLine();
    if (!prev) { this.finish(); return; }

    let patch: Partial<LineParams>;
    if (Math.abs(x1 - x2) < 1e-6) {
      patch = { vertical: true, x: x1 };
    } else {
      const k = (y2 - y1) / (x2 - x1);
      patch = { vertical: false, k, b: y1 - k * x1 };
    }

    const after = updateLineParams(prev, patch);
    useEntityStore.getState().updateEntity(prev.id, after);
    executeM03Command(new UpdateLineParamCommand(prev.id, prev, after));
    this.finish();
  }

  onPointerMove(ev: ToolEvent): void {
    if (this.firstPt) {
      this.drawPreview(ev.mathX, ev.mathY);
    }
  }

  onPointerLeave(): void {
    // Keep state — teacher may re-enter the canvas
  }

  onWheel(ev: ToolEvent & { deltaY: number }): void {
    if (!this.editor) return;
    const factor = ev.deltaY > 0 ? 1.1 : 1 / 1.1;
    this.editor.setViewport(
      this.editor.getViewport().zoomAt(ev.mathX, ev.mathY, factor),
    );
  }

  /** Commit successful second-click or cancel: clear overlay → pan-zoom. */
  private finish(): void {
    this.clearCanvas();
    this.firstPt = null;
    useEntityStore.getState().setActiveTool('pan-zoom');
  }
}

// ── Shared canvas helper ─────────────────────────────────────────────────────

function renderDot(
  ctx:    CanvasRenderingContext2D,
  cx:     number,
  cy:     number,
  mx:     number,
  my:     number,
  label:  string,
): void {
  // Glow
  ctx.beginPath();
  ctx.arc(cx, cy, DOT_RADIUS + 4, 0, 2 * Math.PI);
  ctx.fillStyle = SNAP_COLOR + '33';
  ctx.fill();

  // Filled dot
  ctx.beginPath();
  ctx.arc(cx, cy, DOT_RADIUS, 0, 2 * Math.PI);
  ctx.fillStyle   = SNAP_COLOR;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Letter label
  ctx.font         = 'bold 12px monospace';
  ctx.fillStyle    = SNAP_COLOR;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, cx + 9, cy);

  // Coordinate pill
  const coord = `(${mx.toFixed(2)}, ${my.toFixed(2)})`;
  ctx.font = '10px monospace';
  const tw  = ctx.measureText(coord).width;
  const PAD = 3;
  const px  = cx + 8;
  const py  = cy + 3;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(px, py, tw + PAD * 2, 14, 3);
  ctx.fill();
  ctx.fillStyle    = '#374151';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(coord, px + PAD, py + 2);
}
