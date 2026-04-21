/**
 * UnitCircleCanvas — M04 Phase 1
 *
 * Dual-layer canvas for the interactive unit circle.
 *
 *  StaticRef  (bottom): coordinate axes, unit circle outline, special-angle dots
 *  DynamicRef (top):    draggable point P, projections, angle arc, labels
 *
 * Interactions:
 *  - Left-click near circle rim → angle drag (via AngleDragTool)
 *  - Left-click on empty space  → viewport pan
 *  - Double-click               → reset viewport to default
 *  - Scroll wheel               → zoom at cursor
 *
 * Uses `useDualCanvas` with the unit-circle viewport injected into
 * `useUnitCircleStore`. The active tool is AngleDragTool.
 */

import { useEffect, useCallback } from 'react';
import { Viewport } from '@/canvas/Viewport';
import { useDualCanvas } from '@/hooks/useDualCanvas';
import { useUnitCircleStore } from '@/editor/store/unitCircleStore';
import { AngleDragTool } from '@/editor/tools/AngleDragTool';
import { renderAxis } from '@/canvas/renderers/axisRenderer';
import { hiDpiClear } from '@/editor/tools/canvasUtils';
import {
  renderStaticUnitCircle,
  renderDynamicAngle,
  type UnitCircleRenderOptions,
} from '@/canvas/renderers/unitCircleRenderer';

export function UnitCircleCanvas() {
  // ── Dual canvas setup ──────────────────────────────────────────────────────
  const {
    containerRef,
    staticRef,
    dynamicRef,
    canvasSize,
    editorRef,
    buildToolEvent,
    scheduleRaf,
  } = useDualCanvas({
    initialViewport: useUnitCircleStore.getState().viewport,
    setViewportFn:   useUnitCircleStore.getState().setViewport,
    onInit: (editor) => editor.activateTool(new AngleDragTool()),
  });

  // ── Store subscriptions ────────────────────────────────────────────────────
  const viewport      = useUnitCircleStore((s) => s.viewport);
  const angleRad      = useUnitCircleStore((s) => s.angleRad);
  const isSnapped     = useUnitCircleStore((s) => s.isSnapped);
  const snappedValues = useUnitCircleStore((s) => s.snappedValues);
  const isDragging    = useUnitCircleStore((s) => s.isDragging);
  const showProjections   = useUnitCircleStore((s) => s.showProjections);
  const showAngleArc      = useUnitCircleStore((s) => s.showAngleArc);
  const showLabels        = useUnitCircleStore((s) => s.showLabels);
  const showQuadrantHints = useUnitCircleStore((s) => s.showQuadrantHints);

  // ── Static layer: axes + circle outline + special-angle dots ──────────────
  useEffect(() => {
    const canvas = staticRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const vp = new Viewport(
      viewport.xMin, viewport.xMax, viewport.yMin, viewport.yMax,
      canvasSize.width, canvasSize.height,
    );

    hiDpiClear(ctx, canvas);
    renderAxis(ctx, vp, { showGrid: false });
    renderStaticUnitCircle(ctx, vp);
  }, [viewport, canvasSize, staticRef]);

  // ── Dynamic layer: point P, projections, arc, labels ──────────────────────
  useEffect(() => {
    scheduleRaf(() => {
      const canvas = dynamicRef.current;
      const ctx    = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const vp = new Viewport(
        viewport.xMin, viewport.xMax, viewport.yMin, viewport.yMax,
        canvasSize.width, canvasSize.height,
      );

      hiDpiClear(ctx, canvas);

      const opts: UnitCircleRenderOptions = {
        showProjections,
        showAngleArc,
        showLabels,
        showQuadrantHints,
        isSnapped,
      };

      renderDynamicAngle(ctx, angleRad, vp, opts, snappedValues);
    });
  }, [
    angleRad, viewport, canvasSize,
    showProjections, showAngleArc, showLabels, showQuadrantHints,
    isSnapped, snappedValues,
    dynamicRef, scheduleRaf,
  ]);

  // ── Event handlers ─────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    editorRef.current?.dispatchPointerDown(buildToolEvent(e.nativeEvent as MouseEvent));
  }, [editorRef, buildToolEvent]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    editorRef.current?.dispatchPointerMove(buildToolEvent(e.nativeEvent as MouseEvent));
  }, [editorRef, buildToolEvent]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    editorRef.current?.dispatchPointerUp(buildToolEvent(e.nativeEvent as MouseEvent));
  }, [editorRef, buildToolEvent]);

  const onPointerLeave = useCallback(() => {
    editorRef.current?.dispatchPointerLeave();
  }, [editorRef]);

  const onDblClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    editorRef.current?.dispatchDblClick(buildToolEvent(e.nativeEvent));
  }, [editorRef, buildToolEvent]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    editorRef.current?.dispatchWheel({
      ...buildToolEvent(e.nativeEvent as WheelEvent),
      deltaY: e.deltaY,
    });
  }, [editorRef, buildToolEvent]);

  const dynCursor = isDragging ? 'grabbing' : 'crosshair';

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <canvas ref={staticRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas
        ref={dynamicRef}
        style={{ position: 'absolute', inset: 0, cursor: dynCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDblClick}
        onWheel={onWheel}
      />
    </div>
  );
}
