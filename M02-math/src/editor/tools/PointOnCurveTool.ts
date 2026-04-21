/**
 * PointOnCurveTool — hover snap to nearest conic entity + click to pin.
 *
 * Behaviour:
 *  - onPointerMove: find nearest visible entity point, render on dynamic canvas
 *  - onPointerDown: toggle pinned point/intersection on click
 *  - onPointerLeave / onDeactivate: clear dynamic canvas
 *  - onWheel: zoom (so the user can explore while snapping)
 *
 * The tool does NOT handle panning (onPointerDown/Up).
 * The user switches back to PanZoomTool via the TopBar toggle to pan.
 */

import type { Tool, ToolEvent } from '@/editor/tools/types';
import { hiDpiClear } from '@/editor/tools/canvasUtils';
import type { IEditor } from '@/editor/core/EditorInjectable';
import { useEntityStore } from '@/editor/store/entityStore';
import { useM03InteractionStore } from '@/editor/store/m03InteractionStore';
import { findNearestOnAnyEntity } from '@/engine/nearestPoint';
import { intersectLineConic } from '@/engine/intersectionEngine';
import { renderCurvePoint } from '@/canvas/renderers/pointRenderer';
import type { CurvePointRenderOptions } from '@/canvas/renderers/pointRenderer';
import type { LineEntity, ConicEntity } from '@/types';
import { isConicEntity } from '@/types';

export class PointOnCurveTool implements Tool {
  readonly id = 'point-on-curve';

  private editor: IEditor | null = null;

  /**
   * @param getDynamic  Returns the dynamic canvas element.
   *   Passed as a getter so the tool always gets the current DOM reference
   *   (the canvas element may not exist yet when the tool is constructed).
   */
  constructor(
    private readonly getDynamic: () => HTMLCanvasElement | null,
  ) {}

  onActivate(editor: IEditor): void {
    this.editor = editor;
  }

  onDeactivate(): void {
    this.clearDynamic();
    this.editor = null;
  }

  onPointerDown(event: ToolEvent): void {
    if (!this.editor) return;

    const vp       = this.editor.getViewport();
    const entities = useEntityStore.getState().entities;
    const store    = useM03InteractionStore.getState();

    // 1. Check proximity to intersection points first (higher priority)
    const snapRadius = Math.min(vp.xRange, vp.yRange) * 0.10;

    const lineEntities:  LineEntity[]  = [];
    const conicEntities: ConicEntity[] = [];
    for (const e of entities) {
      if (!e.visible) continue;
      if (e.type === 'line') lineEntities.push(e);
      else if (isConicEntity(e)) conicEntities.push(e);
    }

    // Check intersection points
    for (const line of lineEntities) {
      for (const conic of conicEntities) {
        const result = intersectLineConic(line.params, conic);
        for (const [ix, iy] of result.pts) {
          const dist = Math.sqrt((event.mathX - ix) ** 2 + (event.mathY - iy) ** 2);
          if (dist < snapRadius) {
            store.togglePinnedIntersection({ mathX: ix, mathY: iy, lineId: line.id, conicId: conic.id });
            return;
          }
        }
      }
    }

    // 2. Otherwise, try curve snap
    const snap = findNearestOnAnyEntity(entities, event.mathX, event.mathY, vp, snapRadius);
    if (snap) {
      store.togglePinnedPoint({ mathX: snap.x, mathY: snap.y, entityId: snap.entity.id });
    }
  }

  onPointerMove(event: ToolEvent): void {
    const canvas = this.getDynamic();
    if (!canvas || !this.editor) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vp       = this.editor.getViewport();
    const entities = useEntityStore.getState().entities;

    // Snap radius: 10% of the shorter viewport axis (scales naturally with zoom)
    const snapRadius = Math.min(vp.xRange, vp.yRange) * 0.10;

    const snap = findNearestOnAnyEntity(entities, event.mathX, event.mathY, vp, snapRadius);

    hiDpiClear(ctx, canvas);

    if (snap) {
      const { displayOptions } = useEntityStore.getState();
      const opts: CurvePointRenderOptions = {
        showTangent:    displayOptions.showTangent,
        showNormal:     displayOptions.showNormal,
        showFocalChord: displayOptions.showFocalChord,
      };
      renderCurvePoint(ctx, snap, vp, opts);
    }
  }

  onPointerLeave(): void {
    this.clearDynamic();
  }

  /** Pass wheel events through for zoom support while snapping. */
  onWheel(event: ToolEvent & { deltaY: number }): void {
    if (!this.editor) return;
    const factor = event.deltaY > 0 ? 1.1 : 1 / 1.1;
    this.editor.setViewport(
      this.editor.getViewport().zoomAt(event.mathX, event.mathY, factor),
    );
  }

  private clearDynamic(): void {
    const canvas = this.getDynamic();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) hiDpiClear(ctx, canvas);
  }
}
