/**
 * TriangleCanvas — M04 Phase 5
 *
 * Static-only dual-layer canvas that renders the triangle solver result.
 * Re-renders whenever triangleSolverStore.result changes.
 *
 * Viewport is fixed at xMin=-12, xMax=12, yMin=-7, yMax=7.
 */

import { useEffect, useCallback } from 'react';
import { Viewport }  from '@/canvas/Viewport';
import { useDualCanvas } from '@/hooks/useDualCanvas';
import { PanZoomTool }   from '@/editor/tools/PanZoomTool';
import { renderAxis } from '@/canvas/renderers/axisRenderer';
import { hiDpiClear } from '@/editor/tools/canvasUtils';
import { useTriangleSolverStore } from '@/editor/store/triangleSolverStore';
import {
  renderSingleTriangle,
  renderSSADualSolutions,
} from '@/canvas/renderers/triangleRenderer';

const TRIANGLE_VIEWPORT = {
  xMin: -12, xMax: 12, yMin: -7, yMax: 7,
};

export function TriangleCanvas() {
  const {
    containerRef,
    staticRef,
    dynamicRef,
    canvasSize,
    editorRef,
    buildToolEvent,
  } = useDualCanvas({
    initialViewport: TRIANGLE_VIEWPORT,
    setViewportFn:   () => { /* viewport is fixed */ },
    onInit: (editor) => editor.activateTool(new PanZoomTool()),
  });

  const result = useTriangleSolverStore((s) => s.result);

  // ── Static layer: axes + triangle ──────────────────────────────────────
  useEffect(() => {
    const canvas = staticRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const vp = new Viewport(
      TRIANGLE_VIEWPORT.xMin, TRIANGLE_VIEWPORT.xMax,
      TRIANGLE_VIEWPORT.yMin, TRIANGLE_VIEWPORT.yMax,
      canvasSize.width, canvasSize.height,
    );

    hiDpiClear(ctx, canvas);
    renderAxis(ctx, vp, { showGrid: true });

    if (!result || !result.valid) {
      // Prompt text when no triangle yet
      ctx.save();
      ctx.font         = '14px monospace';
      ctx.fillStyle    = '#4B5563';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        result?.valid === false
          ? result.reason
          : '请在右侧输入参数并点击「解算」',
        vp.width / 2,
        vp.height / 2,
      );
      ctx.restore();
      return;
    }

    if (result.case === 'unique') {
      renderSingleTriangle(ctx, result.triangle, vp);
    } else {
      renderSSADualSolutions(ctx, result.triangle1, result.triangle2, vp);
    }
  }, [result, canvasSize, staticRef]);

  // ── Dynamic layer: kept empty (no interactive elements) ─────────────────
  useEffect(() => {
    const canvas = dynamicRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    hiDpiClear(ctx, canvas);
  }, [canvasSize, dynamicRef]);

  // ── Event handlers (pan/zoom only) ──────────────────────────────────────
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

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    editorRef.current?.dispatchWheel({
      ...buildToolEvent(e.nativeEvent as WheelEvent),
      deltaY: e.deltaY,
    });
  }, [editorRef, buildToolEvent]);

  const dynCursor = 'grab';

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
        onWheel={onWheel}
      />
    </div>
  );
}
