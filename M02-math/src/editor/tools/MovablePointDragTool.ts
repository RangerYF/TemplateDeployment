/**
 * MovablePointDragTool — create and drag movable points on curves.
 *
 * Behaviour:
 *  - onPointerMove (not dragging): magnetic snap preview on nearest curve
 *  - only one MovablePointEntity is kept in the scene
 *  - click an existing movable point → enter/exit mouse-follow mode
 *  - click a curve → move the single movable point there, creating one only if absent
 *  - drag is still supported as a fallback for hold-and-move interaction
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
  private floatingPointId: string | null = null;
  private beforeEntity: MovablePointEntity | null = null;

  constructor(
    private readonly getDynamic: () => HTMLCanvasElement | null,
  ) {}

  onActivate(editor: IEditor): void {
    this.editor = editor;
    this.pruneDuplicateMovablePoints();
  }

  onDeactivate(): void {
    this.clearDynamic();
    this.editor = null;
    this.dragging = false;
    this.dragPointId = null;
    this.floatingPointId = null;
    this.beforeEntity = null;
  }

  onPointerDown(event: ToolEvent): void {
    if (!this.editor) return;

    const store = useEntityStore.getState();
    const vp = this.editor.getViewport();
    const snapRadius = Math.min(vp.xRange, vp.yRange) * 0.08;

    this.pruneDuplicateMovablePoints();

    const existingPoint = this.getSingleMovablePoint();
    const hitPoint = existingPoint
      ? this.isNearPoint(event.mathX, event.mathY, existingPoint, snapRadius)
      : false;

    if (existingPoint && hitPoint) {
      if (this.floatingPointId === existingPoint.id) {
        this.commitFloatingPoint();
      } else {
        this.beginFloatingPoint(existingPoint);
      }
      return;
    }

    // Try to snap to a curve and place/move the single movable point.
    const curveEntities = store.entities.filter(
      (e) => e.visible && e.type !== 'movable-point',
    );

    // First try conic / implicit snap
    const snap = findNearestOnAnyEntity(curveEntities, event.mathX, event.mathY, vp, snapRadius);
    if (snap) {
      const projected = projectOntoEntity(snap.entity, snap.x, snap.y, vp);
      if (projected) {
        this.placeSinglePoint(snap.entity.id, projected, snap.entity.color);
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
          this.placeSinglePoint(entity.id, projected, entity.color);
          return;
        }
      }
    }
  }

  onPointerMove(event: ToolEvent): void {
    if (!this.editor) return;

    // ── Dragging mode ─────────────────────────────────────────────────────
    const activeMoveId = this.dragPointId ?? this.floatingPointId;
    if ((this.dragging || this.floatingPointId) && activeMoveId) {
      const store = useEntityStore.getState();
      const point = store.entities.find(
        (e): e is MovablePointEntity => e.id === activeMoveId && e.type === 'movable-point',
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
    if (this.floatingPointId) return;

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
    if (!this.floatingPointId) this.clearDynamic();
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

    // Coordinate label — light card style
    const label = `(${mx.toFixed(2)}, ${my.toFixed(2)})`;
    ctx.font = '700 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width;
    const lx = Math.round(cx + 14);
    const ly = Math.round(cy - 16);
    const pw = tw + 14;
    const ph = 22;

    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(lx - 7, ly - ph / 2, pw, ph, 8);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = '#1A1A2E';
    ctx.fillText(label, lx, ly);
    ctx.restore();
  }

  private clearDynamic(): void {
    const canvas = this.getDynamic();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) hiDpiClear(ctx, canvas);
  }

  private getSingleMovablePoint(): MovablePointEntity | null {
    return useEntityStore.getState().entities.find(
      (e): e is MovablePointEntity => e.type === 'movable-point' && e.visible,
    ) ?? null;
  }

  private isNearPoint(
    mathX: number,
    mathY: number,
    point: MovablePointEntity,
    radius: number,
  ): boolean {
    const dx = mathX - point.params.mathX;
    const dy = mathY - point.params.mathY;
    return Math.sqrt(dx * dx + dy * dy) < radius;
  }

  private beginFloatingPoint(point: MovablePointEntity): void {
    this.dragging = false;
    this.dragPointId = null;
    this.floatingPointId = point.id;
    this.beforeEntity = { ...point, params: { ...point.params } };
    useEntityStore.getState().setActiveEntityId(point.id);
  }

  private commitFloatingPoint(): void {
    if (!this.floatingPointId || !this.beforeEntity) {
      this.floatingPointId = null;
      this.beforeEntity = null;
      this.clearDynamic();
      return;
    }

    const afterEntity = useEntityStore.getState().entities.find(
      (e): e is MovablePointEntity => e.id === this.floatingPointId && e.type === 'movable-point',
    );
    if (afterEntity) {
      const dx = afterEntity.params.mathX - this.beforeEntity.params.mathX;
      const dy = afterEntity.params.mathY - this.beforeEntity.params.mathY;
      if (dx * dx + dy * dy > 1e-10) {
        executeM03Command(
          new UpdateMovablePointCommand(this.floatingPointId, this.beforeEntity, afterEntity),
        );
      }
    }

    this.floatingPointId = null;
    this.beforeEntity = null;
    this.clearDynamic();
  }

  private placeSinglePoint(
    constraintEntityId: string,
    projected: { t: number; mathX: number; mathY: number; branch?: 'right' | 'left' },
    color: string,
  ): void {
    const store = useEntityStore.getState();
    const point = this.getSingleMovablePoint();

    if (point) {
      const before = { ...point, params: { ...point.params } };
      const updated: MovablePointEntity = {
        ...point,
        color,
        params: {
          ...point.params,
          constraintEntityId,
          t: projected.t,
          mathX: projected.mathX,
          mathY: projected.mathY,
          branch: projected.branch,
        },
      };
      store.updateEntity(point.id, updated);
      store.setActiveEntityId(point.id);
      this.floatingPointId = null;
      this.beforeEntity = null;
      const dx = updated.params.mathX - before.params.mathX;
      const dy = updated.params.mathY - before.params.mathY;
      if (dx * dx + dy * dy > 1e-10 || before.params.constraintEntityId !== constraintEntityId) {
        executeM03Command(new UpdateMovablePointCommand(point.id, before, updated));
      }
      return;
    }

    const newPoint = createMovablePoint({
      constraintEntityId,
      t: projected.t,
      mathX: projected.mathX,
      mathY: projected.mathY,
      branch: projected.branch,
    }, { color, label: 'P' });
    executeM03Command(new AddEntityCommand(newPoint));
    store.setActiveEntityId(newPoint.id);
  }

  private pruneDuplicateMovablePoints(keepId?: string): void {
    const store = useEntityStore.getState();
    const movablePoints = store.entities.filter(
      (e): e is MovablePointEntity => e.type === 'movable-point',
    );
    if (movablePoints.length <= 1) return;

    const activeId = store.activeEntityId;
    const keep =
      movablePoints.find((p) => p.id === keepId) ??
      movablePoints.find((p) => p.id === activeId) ??
      movablePoints[0];

    for (const point of movablePoints) {
      if (point.id !== keep.id) {
        store.removeEntity(point.id);
        useMovablePointStore.getState().clearTrajectory(point.id);
      }
    }
    store.setActiveEntityId(keep.id);
  }
}
