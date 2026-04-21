/**
 * MovablePointDragTool — create and drag movable points on curves.
 *
 * Behaviour:
 *  - onPointerMove (not dragging): magnetic snap preview on nearest curve
 *  - onPointerDown near an existing movable point → start drag
 *  - onPointerDown on a curve (no existing point nearby) → create new MovablePointEntity
 *  - onPointerMove during drag → projectOntoEntity → live update (no command)
 *  - onPointerUp → commit one UpdateMovablePointCommand
 *  - Dynamic layer: render dragged point / snap preview
 */

import type { Tool, ToolEvent } from '@/editor/tools/types';
import type { IEditor } from '@/editor/core/EditorInjectable';
import { useEntityStore } from '@/editor/store/entityStore';
import { useMovablePointStore } from '@/editor/store/movablePointStore';
import { findNearestOnAnyEntity } from '@/engine/nearestPoint';
import { projectOntoEntity } from '@/engine/curveParameterization';
import { createMovablePoint } from '@/editor/entities/movablePoint';
import { AddEntityCommand } from '@/editor/commands/AddEntityCommand';
import { UpdateMovablePointCommand } from '@/editor/commands/UpdateMovablePointCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { renderSnapPreview } from '@/canvas/renderers/movablePointRenderer';
import { hiDpiClear } from '@/editor/tools/canvasUtils';
import type { MovablePointEntity } from '@/types';

export class MovablePointDragTool implements Tool {
  readonly id = 'movable-point';

  private editor: IEditor | null = null;
  private dragging = false;
  private dragPointId: string | null = null;
  private beforeEntity: MovablePointEntity | null = null;

  constructor(
    private readonly getDynamic: () => HTMLCanvasElement | null,
  ) {}

  onActivate(editor: IEditor): void {
    this.editor = editor;
  }

  onDeactivate(): void {
    this.clearDynamic();
    this.editor = null;
    this.dragging = false;
    this.dragPointId = null;
    this.beforeEntity = null;
  }

  onPointerDown(event: ToolEvent): void {
    if (!this.editor) return;

    const store = useEntityStore.getState();
    const vp = this.editor.getViewport();
    const snapRadius = Math.min(vp.xRange, vp.yRange) * 0.08;

    // Check if clicking near an existing movable point
    const movablePoints = store.entities.filter(
      (e): e is MovablePointEntity => e.type === 'movable-point' && e.visible,
    );

    for (const pt of movablePoints) {
      const dx = event.mathX - pt.params.mathX;
      const dy = event.mathY - pt.params.mathY;
      if (Math.sqrt(dx * dx + dy * dy) < snapRadius) {
        this.dragging = true;
        this.dragPointId = pt.id;
        this.beforeEntity = { ...pt, params: { ...pt.params } };
        store.setActiveEntityId(pt.id);
        return;
      }
    }

    // Try to snap to a curve and create a new movable point
    const curveEntities = store.entities.filter(
      (e) => e.visible && e.type !== 'movable-point',
    );

    // First try conic / implicit snap
    const snap = findNearestOnAnyEntity(curveEntities, event.mathX, event.mathY, vp, snapRadius);
    if (snap) {
      const projected = projectOntoEntity(snap.entity, snap.x, snap.y, vp);
      if (projected) {
        const newPoint = createMovablePoint({
          constraintEntityId: snap.entity.id,
          t: projected.t,
          mathX: projected.mathX,
          mathY: projected.mathY,
          branch: projected.branch,
        }, { color: snap.entity.color });
        executeM03Command(new AddEntityCommand(newPoint));
        store.setActiveEntityId(newPoint.id);
        this.dragging = true;
        this.dragPointId = newPoint.id;
        this.beforeEntity = { ...newPoint, params: { ...newPoint.params } };
        return;
      }
    }

    // Try line projection
    for (const entity of curveEntities) {
      if (entity.type !== 'line') continue;
      const projected = projectOntoEntity(entity, event.mathX, event.mathY, vp);
      if (projected) {
        const dist = Math.sqrt(
          (projected.mathX - event.mathX) ** 2 + (projected.mathY - event.mathY) ** 2,
        );
        if (dist < snapRadius) {
          const newPoint = createMovablePoint({
            constraintEntityId: entity.id,
            t: projected.t,
            mathX: projected.mathX,
            mathY: projected.mathY,
            branch: projected.branch,
          }, { color: entity.color });
          executeM03Command(new AddEntityCommand(newPoint));
          store.setActiveEntityId(newPoint.id);
          this.dragging = true;
          this.dragPointId = newPoint.id;
          this.beforeEntity = { ...newPoint, params: { ...newPoint.params } };
          return;
        }
      }
    }
  }

  onPointerMove(event: ToolEvent): void {
    if (!this.editor) return;

    // ── Dragging mode ─────────────────────────────────────────────────────
    if (this.dragging && this.dragPointId) {
      const store = useEntityStore.getState();
      const point = store.entities.find(
        (e): e is MovablePointEntity => e.id === this.dragPointId && e.type === 'movable-point',
      );
      if (!point) return;

      const constraint = store.entities.find((e) => e.id === point.params.constraintEntityId);
      if (!constraint) return;

      const vp = this.editor.getViewport();
      const projected = projectOntoEntity(constraint, event.mathX, event.mathY, vp);
      if (!projected) return;

      const updated: MovablePointEntity = {
        ...point,
        params: {
          ...point.params,
          t: projected.t,
          mathX: projected.mathX,
          mathY: projected.mathY,
          branch: projected.branch,
        },
      };
      store.updateEntity(point.id, updated);

      if (point.params.showTrajectory) {
        useMovablePointStore.getState().pushTracePoint(point.id, projected.mathX, projected.mathY);
      }

      this.renderDynamicPoint(projected.mathX, projected.mathY, point.color);
      return;
    }

    // ── Hover mode: magnetic snap preview ─────────────────────────────────
    const canvas = this.getDynamic();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    hiDpiClear(ctx, canvas);

    const store = useEntityStore.getState();
    const vp = this.editor.getViewport();
    const snapRadius = Math.min(vp.xRange, vp.yRange) * 0.10;

    const curveEntities = store.entities.filter(
      (e) => e.visible && e.type !== 'movable-point',
    );

    // Try conic/implicit snap
    const snap = findNearestOnAnyEntity(curveEntities, event.mathX, event.mathY, vp, snapRadius);
    if (snap) {
      renderSnapPreview(ctx, vp, snap.x, snap.y, snap.entity.color);
      return;
    }

    // Try line snap
    for (const entity of curveEntities) {
      if (entity.type !== 'line') continue;
      const projected = projectOntoEntity(entity, event.mathX, event.mathY, vp);
      if (projected) {
        const dist = Math.sqrt(
          (projected.mathX - event.mathX) ** 2 + (projected.mathY - event.mathY) ** 2,
        );
        if (dist < snapRadius) {
          renderSnapPreview(ctx, vp, projected.mathX, projected.mathY, entity.color);
          return;
        }
      }
    }
  }

  onPointerUp(): void {
    if (!this.dragging || !this.dragPointId || !this.beforeEntity) {
      this.dragging = false;
      return;
    }

    const store = useEntityStore.getState();
    const afterEntity = store.entities.find(
      (e): e is MovablePointEntity => e.id === this.dragPointId && e.type === 'movable-point',
    );

    if (afterEntity && this.beforeEntity) {
      const dx = afterEntity.params.mathX - this.beforeEntity.params.mathX;
      const dy = afterEntity.params.mathY - this.beforeEntity.params.mathY;
      if (dx * dx + dy * dy > 1e-10) {
        executeM03Command(
          new UpdateMovablePointCommand(this.dragPointId, this.beforeEntity, afterEntity),
        );
      }
    }

    this.dragging = false;
    this.dragPointId = null;
    this.beforeEntity = null;
    this.clearDynamic();
  }

  onPointerLeave(): void {
    this.clearDynamic();
  }

  onWheel(event: ToolEvent & { deltaY: number }): void {
    if (!this.editor) return;
    const factor = event.deltaY > 0 ? 1.1 : 1 / 1.1;
    this.editor.setViewport(
      this.editor.getViewport().zoomAt(event.mathX, event.mathY, factor),
    );
  }

  private renderDynamicPoint(mx: number, my: number, color: string): void {
    const canvas = this.getDynamic();
    if (!canvas || !this.editor) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const vp = this.editor.getViewport();

    hiDpiClear(ctx, canvas);

    const [cx, cy] = vp.toCanvas(mx, my);

    // Glow + filled dot
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Coordinate label — large, crisp, high-contrast
    const label = `(${mx.toFixed(2)}, ${my.toFixed(2)})`;
    ctx.font = '700 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    const lx = cx + 14;
    const ly = cy - 16;
    const pw = tw + 14;
    const ph = 22;

    ctx.fillStyle = 'rgba(20,20,30,0.90)';
    ctx.beginPath();
    ctx.roundRect(lx - 7, ly - ph / 2, pw, ph, 8);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, lx, ly);
    ctx.restore();
  }

  private clearDynamic(): void {
    const canvas = this.getDynamic();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) hiDpiClear(ctx, canvas);
  }
}
