/**
 * FunctionGraphCanvas — M04 Phase 2
 *
 * Dual-layer canvas that renders the active trig function curve and syncs
 * with the unit circle via the angle trace point.
 *
 *  StaticRef  (bottom): axes (π-mode labels) + trig curve
 *  DynamicRef (top):    ghost-trail history, vertical/horizontal dashed guides,
 *                       highlighted trace point + value label
 *
 * Pushes the trace point's canvas-pixel-y to syncLineStore each frame so that
 * M04Layout can draw the divider sync marker at the correct height.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { Viewport } from '@/canvas/Viewport';
import { useDualCanvas } from '@/hooks/useDualCanvas';
import { useM04FunctionStore } from '@/editor/store/m04FunctionStore';
import { useUnitCircleStore } from '@/editor/store/unitCircleStore';
import { useSyncLineStore } from '@/editor/store/syncLineStore';
import { PanZoomTool } from '@/editor/tools/PanZoomTool';
import { renderAxis } from '@/canvas/renderers/axisRenderer';
import { hiDpiClear } from '@/editor/tools/canvasUtils';
import { sampleTrigFunction, evalTrig } from '@/engine/trigSampler';
import { computeFivePoints } from '@/engine/fivePointEngine';
import { synthesizeAuxiliaryAngle } from '@/engine/auxiliaryAngleEngine';
import { renderFivePoints } from '@/canvas/renderers/fivePointRenderer';
import { COLORS } from '@/styles/colors';
import { LabelPlacer } from '@/canvas/renderers/labelStrategy';
import type { FnType } from '@/types';

// ─── Colour map ───────────────────────────────────────────────────────────────

const FN_COLOR: Record<FnType, string> = {
  sin: COLORS.sinColor,
  cos: COLORS.cosColor,
  tan: COLORS.tanColor,
};

const FN_LABEL: Record<FnType, string> = {
  sin: 'sin θ',
  cos: 'cos θ',
  tan: 'tan θ',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FunctionGraphCanvas() {
  const {
    containerRef,
    staticRef,
    dynamicRef,
    canvasSize,
    editorRef,
    buildToolEvent,
    scheduleRaf,
  } = useDualCanvas({
    initialViewport: useM04FunctionStore.getState().viewport,
    setViewportFn:   useM04FunctionStore.getState().setViewport,
    onInit: (editor) => editor.activateTool(new PanZoomTool()),
  });

  // ── Store subscriptions ──────────────────────────────────────────────────
  const viewport      = useM04FunctionStore((s) => s.viewport);
  const ucViewport    = useUnitCircleStore((s) => s.viewport);
  const traceX        = useM04FunctionStore((s) => s.traceX);
  const fnType        = useM04FunctionStore((s) => s.fnType);
  const transform     = useM04FunctionStore((s) => s.transform);
  const traceHistory  = useM04FunctionStore((s) => s.traceHistory);
  const showReference = useM04FunctionStore((s) => s.showReference);
  // Phase 4
  const fivePointStep = useM04FunctionStore((s) => s.fivePointStep);
  const showAuxiliary = useM04FunctionStore((s) => s.showAuxiliary);
  const auxiliaryA    = useM04FunctionStore((s) => s.auxiliaryA);
  const auxiliaryB    = useM04FunctionStore((s) => s.auxiliaryB);
  const auxShowC1     = useM04FunctionStore((s) => s.auxShowC1);
  const auxShowC2     = useM04FunctionStore((s) => s.auxShowC2);
  const auxShowCR     = useM04FunctionStore((s) => s.auxShowCR);

  // Pre-compute five-point data (memoised — only recalc when transform/fnType changes)
  const fivePoints = useMemo(
    () => computeFivePoints(transform, fnType),
    [transform, fnType],
  );

  // Pre-compute auxiliary synthesis result
  const auxResult = useMemo(
    () => synthesizeAuxiliaryAngle(auxiliaryA, auxiliaryB),
    [auxiliaryA, auxiliaryB],
  );

  // ── Static layer: axes + curve ───────────────────────────────────────────
  useEffect(() => {
    const canvas = staticRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const showRef = useM04FunctionStore.getState().showReference;

    const vp = new Viewport(
      viewport.xMin, viewport.xMax, viewport.yMin, viewport.yMax,
      canvasSize.width, canvasSize.height,
    );

    hiDpiClear(ctx, canvas);
    renderAxis(ctx, vp, { showGrid: true, piMode: true });

    // ── Helper: draw a sampled curve ─────────────────────────────────────
    function drawCurve(
      fn: FnType, tr: typeof transform,
      strokeColor: string, lineW: number, dash: number[],
    ) {
      const pts = sampleTrigFunction(
        fn, tr,
        viewport.xMin, viewport.xMax,
        viewport.yMin, viewport.yMax,
        600,
      );
      ctx!.save();
      ctx!.strokeStyle = strokeColor;
      ctx!.lineWidth   = lineW;
      ctx!.setLineDash(dash);
      ctx!.beginPath();
      let pen = false;
      for (const pt of pts) {
        if (pt.isBreak) { pen = false; }
        const [cx, cy] = vp.toCanvas(pt.x, pt.y);
        if (!pen) { ctx!.moveTo(cx, cy); pen = true; }
        else      { ctx!.lineTo(cx, cy); }
      }
      ctx!.stroke();
      ctx!.restore();
    }

    if (showAuxiliary) {
      // ── Auxiliary mode: 3-curve overlay ────────────────────────────────
      // C1: a·sin x
      if (auxShowC1) {
        drawCurve('sin', { A: auxiliaryA, omega: 1, phi: 0, k: 0 },
          COLORS.auxiliaryCurve1, 1.5, [5, 4]);
      }
      // C2: b·cos x
      if (auxShowC2) {
        drawCurve('cos', { A: auxiliaryB, omega: 1, phi: 0, k: 0 },
          COLORS.auxiliaryCurve2, 1.5, [5, 4]);
      }
      // CR: R·sin(x + φ)
      if (auxShowCR) {
        drawCurve('sin', { A: auxResult.R, omega: 1, phi: auxResult.phi, k: 0 },
          COLORS.primary, 2, []);
      }
    } else {
      // ── Normal mode: main trig curve ────────────────────────────────────
      const pts = sampleTrigFunction(
        fnType, transform,
        viewport.xMin, viewport.xMax,
        viewport.yMin, viewport.yMax,
        800,
      );

      const color = FN_COLOR[fnType];
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();

      let penDown = false;
      for (const pt of pts) {
        if (pt.isBreak) { penDown = false; }
        const [cx, cy] = vp.toCanvas(pt.x, pt.y);
        if (!penDown) { ctx.moveTo(cx, cy); penDown = true; }
        else          { ctx.lineTo(cx, cy); }
      }
      ctx.stroke();

      // ── Reference curve: y = fn(x) with identity transform ────────────
      if (showRef) {
        drawCurve(fnType, { A: 1, omega: 1, phi: 0, k: 0 },
          'rgba(255,255,255,0.15)', 1.5, [5, 4]);
      }

      ctx.restore();
    }
  }, [
    viewport, canvasSize, fnType, transform, showReference,
    showAuxiliary, auxiliaryA, auxiliaryB, auxShowC1, auxShowC2, auxShowCR,
    auxResult,
    staticRef,
  ]);

  // ── Dynamic layer: history trail + guides + trace point ─────────────────
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

      const traceY = evalTrig(fnType, transform, traceX);
      const color  = FN_COLOR[fnType];

      // Shared label placer for this frame
      const placer = new LabelPlacer(vp.width, vp.height);

      // ── Ghost trail (lighter, skip every other for density) ────────
      if (traceHistory.length > 1) {
        ctx.save();
        // Only draw every 2nd point when trail is dense
        const step = traceHistory.length > 100 ? 2 : 1;
        for (let i = 0; i < traceHistory.length; i += step) {
          const pt    = traceHistory[i];
          const frac  = i / traceHistory.length;
          const alpha = frac * 0.35;        // reduced max opacity (was 0.55)
          const r     = 1.0 + frac * 1.2;   // slightly smaller dots
          const [hx, hy] = vp.toCanvas(pt.x, pt.y);
          ctx.beginPath();
          ctx.arc(hx, hy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100,116,139,${alpha.toFixed(2)})`;
          ctx.fill();
        }
        ctx.restore();
      }

      if (!isFinite(traceY)) {
        useSyncLineStore.getState().setSyncY(null);
        return;
      }

      const [cx, cy] = vp.toCanvas(traceX, traceY);

      // ── Guides (subtler) ───────────────────────────────────────────
      ctx.save();
      ctx.strokeStyle = `${color}35`;  // was 55 → lighter
      ctx.lineWidth   = 0.8;
      ctx.setLineDash([4, 5]);

      // Vertical guide
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, vp.height);
      ctx.stroke();

      // Horizontal guide
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(vp.width, cy);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.restore();

      // Reserve the trace point area
      placer.reserve(cx, cy, 10, 10);

      // ── Trace point ────────────────────────────────────────────────
      ctx.save();

      // Outer glow (smaller)
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);   // was 13
      ctx.fillStyle = `${color}20`;            // was 25
      ctx.fill();

      // Filled circle
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);    // was 7
      ctx.fillStyle   = color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Value label — smart placement via LabelPlacer
      {
        const labelText = `${FN_LABEL[fnType]} = ${traceY.toFixed(4)}`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(labelText).width;
        const th = 12;

        // Prefer top-right, but adapt
        const prefDir = cx > vp.width * 0.75 ? 3 : 1;  // top-left or top-right
        const result = placer.place({
          text: labelText,
          anchorX: cx,
          anchorY: cy,
          textWidth: tw,
          textHeight: th,
          offset: 10,
          preferredDir: prefDir,
        });
        if (result) {
          ctx.fillStyle    = color;
          ctx.font         = 'bold 12px monospace';
          ctx.textAlign    = result.textAlign;
          ctx.textBaseline = result.textBaseline;
          ctx.fillText(labelText, result.x, result.y);
        }
      }

      ctx.restore();

      // ── Publish sync pixel-y for divider marker ────────────────────
      {
        const ucYRange = ucViewport.yMax - ucViewport.yMin;
        const syncPixelY = canvasSize.height - (traceY - ucViewport.yMin) / ucYRange * canvasSize.height;
        useSyncLineStore.getState().setSyncY(syncPixelY);
      }

      // ── Five-point markers ─────────────────────────────────────────
      if (fivePointStep > 0) {
        renderFivePoints(ctx, fivePoints, fivePointStep, vp, placer);
      }
    });
  }, [
    traceX, traceHistory,
    viewport, ucViewport, canvasSize,
    fnType, transform,
    fivePointStep, fivePoints,
    dynamicRef, scheduleRaf,
  ]);

  // ── Event handlers ───────────────────────────────────────────────────────
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
      {/* Static: axes + curve */}
      <canvas
        ref={staticRef}
        style={{ position: 'absolute', inset: 0 }}
      />
      {/* Dynamic: history, guides, trace point */}
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
