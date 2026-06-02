import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Viewport, centerOriginViewport } from '@/canvas/Viewport';
import { initEditor, editorInstance } from '@/editor/core/Editor';
import type { Editor } from '@/editor/core/Editor';
import { PanZoomTool } from '@/editor/tools/PanZoomTool';
import { SelectTool } from '@/editor/tools/SelectTool';
import { PinPointTool } from '@/editor/tools/PinPointTool';
import type { ToolEvent } from '@/editor/tools/types';
import { useFunctionStore } from '@/editor/store/functionStore';
import { useInteractionStore } from '@/editor/store/interactionStore';
import type { HoveredPoint, IntersectionHover } from '@/editor/store/interactionStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { useCanvasToolStore, type CanvasMode } from '@/editor/store/canvasToolStore';
import { useAnimationTrajectoryStore } from '@/editor/store/animationTrajectoryStore';
import { renderAxis } from '@/canvas/renderers/axisRenderer';
import { renderCurve } from '@/canvas/renderers/curveRenderer';
import { renderDynamic } from '@/canvas/renderers/dynamicRenderer';
import { renderTangent } from '@/canvas/renderers/tangentRenderer';
import { renderFeaturePoints, renderSegmentEndpoints } from '@/canvas/renderers/featurePointRenderer';
import { renderIntersections } from '@/canvas/renderers/intersectionRenderer';
import { getVerticalAsymptoteXValues, renderFunctionAsymptotes } from '@/canvas/renderers/functionAsymptoteRenderer';
import { hiDpiClear } from '@/editor/tools/canvasUtils';
import { compileExpression, isParseError, compileDerivative } from '@/engine/expressionEngine';
import { buildFunctionScope, getKnownFunctionNames } from '@/engine/compositionEngine';
import { sampleWithTransform, sampleDerivativeWithDomain, evaluateStandard, getNumericalDerivative } from '@/engine/sampler';
import { evaluatePiecewiseRange } from '@/engine/piecewiseEvaluator';
import { findAllIntersections } from '@/engine/functionIntersection';
import { analyzeInverseFunction } from '@/engine/inverseFunction';
import type { FunctionIntersection } from '@/engine/functionIntersection';
import type { SamplePoint } from '@/engine/sampler';
import { AddFunctionCommand } from '@/editor/commands/AddFunctionCommand';
import {
  FUNCTION_COLORS,
  DEFAULT_TRANSFORM,
  DEFAULT_FUNCTION_DISPLAY_DOMAIN,
  DEFAULT_INVERSE_FUNCTION_DISPLAY,
  type FunctionEntry,
} from '@/types';
import { COLORS } from '@/styles/colors';
import { createId } from '@/lib/id';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Map canvas mode → CSS cursor style. */
const MODE_CURSORS: Record<CanvasMode, string> = {
  'pan-zoom':  'default',
  'select':    'default',
  'pin-point': 'crosshair',
};

/** Canvas-pixel radius within which the cursor snaps to a curve. */
const SNAP_PX = 20;

/** Canvas-pixel radius within which the cursor snaps to an intersection point.
 *  Intersection snap takes priority over curve snap. */
const INTERSECT_SNAP_PX = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskNearVerticalAsymptotes(
  points: SamplePoint[],
  asymptoteXs: number[],
  viewport: Viewport,
): SamplePoint[] {
  if (asymptoteXs.length === 0) return points;
  const exclusionRadius = (viewport.xMax - viewport.xMin) / 600;

  return points.map((pt) => {
    if (!pt.isValid) return pt;
    const tooClose = asymptoteXs.some((x0) => Math.abs(pt.x - x0) < exclusionRadius);
    return tooClose ? { ...pt, isValid: false, isBreak: false } : pt;
  });
}

function buildToolEvent(
  e: MouseEvent | WheelEvent,
  canvas: HTMLCanvasElement,
  vp: Viewport,
): ToolEvent {
  const rect = canvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const [mathX, mathY] = vp.toMath(canvasX, canvasY);
  return { canvasX, canvasY, mathX, mathY, nativeEvent: e };
}

// ─── Curve render helper ─────────────────────────────────────────────────────

/** Render a single function curve with optional style overrides. Returns the number of sample points rendered. */
function renderOneCurve(
  ctx: CanvasRenderingContext2D,
  fn: FunctionEntry,
  allFunctions: FunctionEntry[],
  vp: Viewport,
  steps: number,
  styleOpts?: { lineWidth?: number; lineDash?: number[]; alpha?: number; glow?: boolean; colorOverride?: string },
): number {
  const color = styleOpts?.colorOverride ?? fn.color;
  let pointCount = 0;
  if (fn.mode === 'piecewise') {
    const segmentResults = evaluatePiecewiseRange(fn.segments, vp, steps);
    for (const { segment, points } of segmentResults) {
      if (points.length === 0) continue;
      const samplePts: SamplePoint[] = points.map(([x, y]) => ({
        x, y, isValid: true, isBreak: false,
      }));
      pointCount += samplePts.length;
      renderCurve(ctx, samplePts, vp, color, styleOpts);
      renderSegmentEndpoints(ctx, segment, vp, color);
    }
  } else {
    const knownFns = getKnownFunctionNames(allFunctions, fn.id);
    const compiled = compileExpression(fn.exprStr, knownFns);
    if (isParseError(compiled)) return 0;

    const paramScope: Record<string, unknown> =
      fn.templateId === null && fn.namedParams.length > 0
        ? Object.fromEntries(fn.namedParams.map((p) => [p.name, p.value]))
        : {};
    const fnScope  = buildFunctionScope(allFunctions, fn.id);
    const scope    = { ...paramScope, ...fnScope };
    const hasScope = Object.keys(scope).length > 0;

    const pts = sampleWithTransform(
      compiled,
      vp,
      fn.transform,
      steps,
      hasScope ? scope : undefined,
      fn.displayDomain,
    );
    const asymptoteXs = getVerticalAsymptoteXValues(fn, vp);
    const maskedPts = maskNearVerticalAsymptotes(pts, asymptoteXs, vp);
    pointCount = maskedPts.length;
    renderCurve(ctx, maskedPts, vp, color, {
      ...styleOpts,
      lineDash: fn.lineStyle === 'dashed' ? [8, 6] : styleOpts?.lineDash,
    });
  }
  return pointCount;
}

function renderMirrorLine(ctx: CanvasRenderingContext2D, vp: Viewport): void {
  const x0 = Math.max(vp.xMin, vp.yMin);
  const x1 = Math.min(vp.xMax, vp.yMax);
  const [cx0, cy0] = vp.toCanvas(x0, x0);
  const [cx1, cy1] = vp.toCanvas(x1, x1);

  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = COLORS.infoBlue;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx0, cy0);
  ctx.lineTo(cx1, cy1);
  ctx.stroke();
  ctx.restore();
}

// ─── Floating panel state ────────────────────────────────────────────────────

import { AnimationHUD } from '@/components/AnimationHUD';
import { CurveInspectorPanel } from '@/components/CurveInspectorPanel';
import type { InspectorTarget } from '@/components/CurveInspectorPanel';
import { DebugOverlay } from '@/components/DebugOverlay';
import type { DebugInfo } from '@/components/DebugOverlay';

interface ContextMenuState {
  /** Screen-pixel position for the menu overlay */
  x: number;
  y: number;
  /** The hovered point captured at the time of right-click */
  hoveredPoint: HoveredPoint | null;
  /** The hovered intersection captured at the time of right-click */
  hoveredIntersection: IntersectionHover | null;
}

// ─── Public handle ───────────────────────────────────────────────────────────

export interface FunctionCanvasHandle {
  getStaticCanvas: () => HTMLCanvasElement | null;
  getDynamicCanvas: () => HTMLCanvasElement | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const FunctionCanvas = forwardRef<FunctionCanvasHandle>(function FunctionCanvas(_props, ref) {
  const staticRef      = useRef<HTMLCanvasElement>(null);
  const dynamicRef     = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const editorRef      = useRef<Editor | null>(null);

  useImperativeHandle(ref, () => ({
    getStaticCanvas: () => staticRef.current,
    getDynamicCanvas: () => dynamicRef.current,
  }));

  // Prevent stacking more than one RAF per frame for the dynamic layer
  const rafPendingRef  = useRef(false);
  // Track pointer-drag so snap is suppressed during pan/zoom gestures
  const isDraggingRef  = useRef(false);

  // Cache of all pairwise function intersections in the current viewport.
  // Recomputed whenever functions or viewport changes (not during animation).
  const intersectionsRef = useRef<FunctionIntersection[]>([]);

  // Tracks canvas pixel dimensions so the static-layer render effect fires on resize
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Debug info ref — updated after each static render, consumed by DebugOverlay
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  // Context menu state (right-click)
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  // Floating inspector panel state (left-click on curve)
  const [inspector, setInspector] = useState<InspectorTarget | null>(null);
  const closeInspector = useCallback(() => setInspector(null), []);

  // Zustand subscriptions — drive static-layer redraws
  const functions        = useFunctionStore((s) => s.functions);
  const activeFunctionId = useFunctionStore((s) => s.activeFunctionId);
  const viewport         = useFunctionStore((s) => s.viewport);
  const features         = useFunctionStore((s) => s.features);
  const isAnimating      = useAnimationStore((s) => s.isAnyAnimating);
  const canvasMode       = useCanvasToolStore((s) => s.mode);
  const trajectoryFrames = useAnimationTrajectoryStore((s) => s.frames);

  // ── Init editor once ───────────────────────────────────────────────────
  useEffect(() => {
    editorRef.current = initEditor(new Viewport(-10, 10, -6, 6, 800, 600));
    editorRef.current.activateTool(new PanZoomTool());
  }, []);

  // ── Activate tool when canvas mode changes ─────────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
    const toolMap: Record<CanvasMode, () => import('@/editor/tools/types').Tool> = {
      'pan-zoom':  () => new PanZoomTool(),
      'select':    () => new SelectTool(),
      'pin-point': () => new PinPointTool(),
    };
    editorRef.current.activateTool(toolMap[canvasMode]());
  }, [canvasMode]);

  // ── ResizeObserver: sync canvas dims + Editor viewport ─────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncCanvasSize = (width?: number, height?: number) => {
      const rect = container.getBoundingClientRect();
      const cssW = Math.max(1, Math.floor(width ?? rect.width));
      const cssH = Math.max(1, Math.floor(height ?? rect.height));

      [staticRef, dynamicRef].forEach((ref) => {
        if (ref.current) {
          ref.current.style.width  = `${cssW}px`;
          ref.current.style.height = `${cssH}px`;
        }
      });

      if (editorRef.current) {
        editorRef.current.setViewport(
          editorRef.current.getViewport().withSize(cssW, cssH),
        );
      }
      setCanvasSize({ width: cssW, height: cssH });
    };

    const handleViewportResize = () => {
      syncCanvasSize();
    };

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      syncCanvasSize(width, height);
    });

    ro.observe(container);
    window.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    syncCanvasSize();

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  // ── Intersection cache: recompute on function / viewport change ─────────
  // Skipped entirely during animation to avoid O(N²·400) per RAF frame.
  // Debounced by 150ms to avoid burst recomputation during pan/zoom.
  const intersectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // During animation, don't recompute (stale cache is acceptable for snap)
    if (isAnimating) return;

    if (intersectTimerRef.current) clearTimeout(intersectTimerRef.current);
    intersectTimerRef.current = setTimeout(() => {
      const vp = new Viewport(
        viewport.xMin, viewport.xMax,
        viewport.yMin, viewport.yMax,
        canvasSize.width, canvasSize.height,
      );
      intersectionsRef.current = findAllIntersections(functions, vp);
    }, 150);

    return () => {
      if (intersectTimerRef.current) clearTimeout(intersectTimerRef.current);
    };
  }, [functions, viewport, canvasSize, isAnimating]);

  // ── Static layer: axes + curves ────────────────────────────────────────
  useEffect(() => {
    const canvas = staticRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cssW = canvasSize.width;
    const cssH = canvasSize.height;
    if (cssW <= 0 || cssH <= 0) return;

    // Set buffer size atomically with the draw — prevents ResizeObserver
    // from clearing the canvas between our draw and the browser paint.
    const dpr = window.devicePixelRatio || 1;
    const bufW = Math.floor(cssW * dpr);
    const bufH = Math.floor(cssH * dpr);
    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width  = bufW;
      canvas.height = bufH;
    }
    if (dynamicRef.current) {
      const dc = dynamicRef.current;
      if (dc.width !== bufW || dc.height !== bufH) {
        dc.width  = bufW;
        dc.height = bufH;
      }
    }

    const vp = new Viewport(
      viewport.xMin, viewport.xMax,
      viewport.yMin, viewport.yMax,
      cssW, cssH,
    );

    // Clear with HiDPI transform
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Switch x-axis to π-fraction labels when any visible function is trigonometric
    const hasTrig = functions.some(
      (fn) => fn.visible && /\b(sin|cos|tan|csc|sec|cot)\s*\(/.test(fn.exprStr),
    );
    renderAxis(ctx, vp, { showGrid: features.showGrid, showLabels: features.showAxisLabels, piMode: hasTrig });

    // Reduce sample density during animations to maintain ≥55fps
    const steps = isAnimating ? 400 : 800;

    // Wrap all curve rendering in try-catch to prevent canvas corruption
    // if any expression evaluation or path building throws unexpectedly.
    try {
      ctx.save();

      if (trajectoryFrames.length > 0) {
        trajectoryFrames.forEach((frame) => {
          renderCurve(ctx, frame.points, vp, frame.color, {
            alpha: 0.42,
            lineWidth: 2,
            lineDash: frame.lineStyle === 'dashed' ? [8, 6] : [],
          });
        });
      }

      for (const fn of functions) {
        if (!fn.visible || !fn.inverseDisplay.showMirrorLine) continue;
        renderMirrorLine(ctx, vp);
        break;
      }

      // Render inactive curves first, then the active curve on top with stronger emphasis.
      const activeId = useFunctionStore.getState().activeFunctionId;
      let activeFn: FunctionEntry | null = null;
      let totalPointsRendered = 0;

      console.log(`[Canvas] render: ${functions.length} fns, activeId=${activeId}, canvas=${canvas.width}x${canvas.height}`);
      for (const fn of functions) {
        if (!fn.visible) continue;
        if (fn.id === activeId) { activeFn = fn; continue; }
        const pts = renderOneCurve(ctx, fn, functions, vp, steps);
        totalPointsRendered += pts;
      }
      // Active curve: preserve its own colour but add glow + thicker stroke
      if (activeFn) {
        const pts = renderOneCurve(ctx, activeFn, functions, vp, steps, { lineWidth: 3, glow: true });
        totalPointsRendered += pts;
        console.log(`[Canvas] active "${activeFn.label}" rendered ${pts} pts`);
      }

      for (const fn of functions) {
        if (!fn.visible || !fn.inverseDisplay.showInverseCurve) continue;
        const inverse = analyzeInverseFunction(fn, functions, viewport, cssW, cssH, steps);
        renderCurve(ctx, inverse.reflectedPoints, vp, fn.color, {
          lineWidth: fn.id === activeId ? 3 : 2,
          alpha: inverse.isApproximatelyInjective ? 0.9 : 0.55,
          lineDash: inverse.isApproximatelyInjective ? [10, 0] : [7, 6],
        });
      }

      if (features.showAsymptotes) {
        for (const fn of functions) {
          renderFunctionAsymptotes(ctx, fn, vp);
        }
      }

      // T6.1 — derivative curves
      if (features.showDerivative) {
        for (const fn of functions) {
          if (!fn.visible || fn.mode !== 'standard') continue;
          const knownFns       = getKnownFunctionNames(functions, fn.id);
          const compiled       = compileExpression(fn.exprStr, knownFns);
          if (isParseError(compiled)) continue;
          const derivedCompiled = compileDerivative(compiled);
          if (isParseError(derivedCompiled)) continue;

          const paramScope: Record<string, unknown> =
            fn.templateId === null && fn.namedParams.length > 0
              ? Object.fromEntries(fn.namedParams.map((p) => [p.name, p.value]))
              : {};
          const fnScope = buildFunctionScope(functions, fn.id);
          const derivScope = { ...paramScope, ...fnScope };
          const hasScope   = Object.keys(derivScope).length > 0;

          const derivPoints = sampleDerivativeWithDomain(
            compiled, derivedCompiled, vp, fn.transform, steps,
            hasScope ? derivScope : undefined,
            fn.displayDomain,
          );
          const isActiveDerivative = fn.id === activeId;
          const derivColor = COLORS.derivativeCurve;
          renderCurve(ctx, derivPoints, vp, derivColor, {
            alpha: isActiveDerivative ? 0.95 : 0.85,
            lineDash: [10, 6],
            lineWidth: isActiveDerivative ? 2.6 : 2.2,
          });
        }
      }

      if (features.showFeaturePoints) {
        renderFeaturePoints(ctx, functions, vp);
      }

      if (features.showIntersections) {
        renderIntersections(ctx, intersectionsRef.current, functions, vp);
      }

      ctx.restore();

      // Update debug info for DebugOverlay
      setDebugInfo({
        pointsRendered: totalPointsRendered,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      });
    } catch (err) {
      console.error('[FunctionCanvas] render error:', err);
      // Restore canvas to a clean state so subsequent renders succeed
      ctx.restore();
      const dprRecover = window.devicePixelRatio || 1;
      ctx.setTransform(dprRecover, 0, 0, dprRecover, 0, 0);
    }

    // Clear dynamic layer when static layer redraws (hover coords are stale)
    if (dynamicRef.current) {
      const dynCtx = dynamicRef.current.getContext('2d');
      if (dynCtx) hiDpiClear(dynCtx, dynamicRef.current);
    }
    useInteractionStore.getState().setHoveredPoint(null);
    useInteractionStore.getState().setHoveredIntersection(null);
  }, [functions, activeFunctionId, viewport, features.showGrid, features.showAxisLabels, features.showDerivative, features.showFeaturePoints, features.showIntersections, features.showAsymptotes, canvasSize, isAnimating, trajectoryFrames]);

  // ── T6.4: Tangent line on dynamic layer ────────────────────────────────
  useEffect(() => {
    const dynCanvas = dynamicRef.current;
    if (!dynCanvas) return;
    const ctx = dynCanvas.getContext('2d');
    if (!ctx) return;

    const vp = new Viewport(
      viewport.xMin, viewport.xMax,
      viewport.yMin, viewport.yMax,
      canvasSize.width, canvasSize.height,
    );

    hiDpiClear(ctx, dynCanvas);

    // Render pinned points / intersections first (they share the dynamic layer)
    const { hoveredPoint, hoveredIntersection, pinnedPoints, pinnedIntersections } =
      useInteractionStore.getState();
    renderDynamic(ctx, hoveredPoint, pinnedPoints, functions, vp, hoveredIntersection, pinnedIntersections);

    // Highlight hovered curve with glow
    if (hoveredPoint?.isVisible && !hoveredIntersection) {
      const hovFn = functions.find((f) => f.id === hoveredPoint.functionId);
      if (hovFn) {
        renderOneCurve(ctx, hovFn, functions, vp, isAnimating ? 400 : 800, { lineWidth: 3, glow: true, colorOverride: COLORS.primary });
      }
    }

    if (!features.showTangent || features.tangentX === null) return;

    // Find the active function's colour
    const activeFn = functions.find(
      (f) => f.id === useFunctionStore.getState().activeFunctionId,
    );
    if (!activeFn) return;

    renderTangent(
      ctx,
      features.tangentX,
      features.tangentY,
      features.tangentSlope ?? NaN,
      vp,
      activeFn.color,
    );
  }, [
    features.showTangent,
    features.tangentX,
    features.tangentY,
    features.tangentSlope,
    functions,
    viewport,
    canvasSize,
  ]);

  // ── Pointer, wheel, snap & RAF ─────────────────────────────────────────
  useEffect(() => {
    const canvas = dynamicRef.current;
    if (!canvas) return;

    /** Always read the live viewport from the editor (never stale). */
    const getLiveVp = (): Viewport =>
      editorRef.current?.getViewport() ?? new Viewport(-10, 10, -6, 6, 800, 600);

    /**
     * Schedule exactly one RAF draw of the dynamic layer.
     * Guard prevents stacking calls within the same frame.
     */
    const scheduleRaf = () => {
      if (rafPendingRef.current) return;
      rafPendingRef.current = true;
      requestAnimationFrame(() => {
        rafPendingRef.current = false;
        const dynCanvas = dynamicRef.current;
        if (!dynCanvas) return;

        const ctx = dynCanvas.getContext('2d');
        if (!ctx) return;

        // Build Viewport from live store + CSS-pixel size
        const storeState = useFunctionStore.getState();
        const editorVp   = getLiveVp();
        const dpr = window.devicePixelRatio || 1;
        const cssW = dynCanvas.width / dpr;
        const cssH = dynCanvas.height / dpr;
        const vp = new Viewport(
          editorVp.xMin, editorVp.xMax,
          editorVp.yMin, editorVp.yMax,
          cssW, cssH,
        );

        hiDpiClear(ctx, dynCanvas);

        const { hoveredPoint, hoveredIntersection, pinnedPoints, pinnedIntersections } =
          useInteractionStore.getState();
        renderDynamic(
          ctx, hoveredPoint, pinnedPoints, storeState.functions, vp,
          hoveredIntersection, pinnedIntersections,
        );

        // Highlight hovered curve with glow
        if (hoveredPoint?.isVisible && !hoveredIntersection) {
          const hovFn = storeState.functions.find((f) => f.id === hoveredPoint.functionId);
          if (hovFn) {
            const isAnim = useAnimationStore.getState().isAnyAnimating;
            renderOneCurve(ctx, hovFn, storeState.functions, vp, isAnim ? 400 : 800, { lineWidth: 3, glow: true, colorOverride: COLORS.primary });
          }
        }

        // Also render tangent on dynamic layer so RAF doesn't wipe it
        const { features: ft } = storeState;
        if (ft.showTangent && ft.tangentX !== null) {
          const activeFn = storeState.functions.find(
            (f) => f.id === storeState.activeFunctionId,
          );
          if (activeFn) {
            renderTangent(ctx, ft.tangentX, ft.tangentY, ft.tangentSlope ?? NaN, vp, activeFn.color);
          }
        }
      });
    };

    /**
     * Compute the nearest snap target for (canvasX, canvasY).
     *
     * Priority order (highest first):
     *  1. Intersection point within INTERSECT_SNAP_PX pixels
     *  2. Curve point within SNAP_PX pixels
     *
     * Writes to interactionStore and schedules a RAF draw.
     */
    const updateSnap = (canvasX: number, canvasY: number) => {
      const vp      = getLiveVp();
      const [mathX] = vp.toMath(canvasX, 0);
      const { functions: fns } = useFunctionStore.getState();

      // ── Priority 1: intersection snap ──────────────────────────────────
      const snapDpr = window.devicePixelRatio || 1;
      const snapVp = new Viewport(
        vp.xMin, vp.xMax, vp.yMin, vp.yMax,
        canvas.width / snapDpr, canvas.height / snapDpr,
      );

      let bestXsect: { ix: FunctionIntersection; dist: number } | null = null;
      for (const ix of intersectionsRef.current) {
        const [cx, cy] = snapVp.toCanvas(ix.mathX, ix.mathY);
        const dist = Math.hypot(canvasX - cx, canvasY - cy);
        if (dist < INTERSECT_SNAP_PX && (bestXsect === null || dist < bestXsect.dist)) {
          bestXsect = { ix, dist };
        }
      }

      if (bestXsect !== null) {
        const { ix } = bestXsect;
        const [cx, cy] = snapVp.toCanvas(ix.mathX, ix.mathY);
        useInteractionStore.getState().setHoveredIntersection({
          mathX:  ix.mathX,
          mathY:  ix.mathY,
          canvasX: cx,
          canvasY: cy,
          fnId1:  ix.fnId1,
          fnId2:  ix.fnId2,
        });
        useInteractionStore.getState().setHoveredPoint(null);
        scheduleRaf();
        return;
      }

      // No intersection nearby — clear intersection hover
      useInteractionStore.getState().setHoveredIntersection(null);

      // ── Priority 2: curve snap ──────────────────────────────────────────
      let best: { fnId: string; mathX: number; mathY: number; dist: number } | null = null;

      for (const fn of fns) {
        if (!fn.visible || fn.mode !== 'standard') continue;
        const mathY = evaluateStandard(fn, mathX);
        if (mathY === null) continue;

        const [, curveCanvasY] = vp.toCanvas(mathX, mathY);
        const dist = Math.abs(canvasY - curveCanvasY);

        if (dist < SNAP_PX && (best === null || dist < best.dist)) {
          best = { fnId: fn.id, mathX, mathY, dist };
        }
      }

      if (best !== null) {
        const [snapCx, snapCy] = snapVp.toCanvas(best.mathX, best.mathY);
        const fn = fns.find((f) => f.id === best!.fnId)!;
        const slope = getNumericalDerivative(fn, best.mathX);

        useInteractionStore.getState().setHoveredPoint({
          mathX:      best.mathX,
          mathY:      best.mathY,
          canvasX:    snapCx,
          canvasY:    snapCy,
          functionId: best.fnId,
          slope,
          isVisible:  true,
        });
      } else {
        useInteractionStore.getState().setHoveredPoint(null);
      }

      scheduleRaf();
    };

    const updateTangentHover = (canvasX: number) => {
      const vp = getLiveVp();
      const [mathX] = vp.toMath(canvasX, 0);
      const store = useFunctionStore.getState();
      const activeFn = store.functions.find((f) => f.id === store.activeFunctionId);
      if (!activeFn || activeFn.mode !== 'standard' || !activeFn.visible) {
        store.setTangentPoint(null, 0, null);
        return;
      }

      const mathY = evaluateStandard(activeFn, mathX);
      if (mathY === null) {
        store.setTangentPoint(null, 0, null);
        return;
      }

      const slope = getNumericalDerivative(activeFn, mathX);
      store.setTangentPoint(mathX, mathY, slope);
      scheduleRaf();
    };

    // ── Event handlers ──────────────────────────────────────────────────

    // Track pointer-down position to distinguish click from drag (for pin feature)
    let downX = 0;
    let downY = 0;
    let downOnCanvas = false;   // true only when pointerdown fires on the canvas element
    // *** BUG FIX: capture hover state at pointerdown BEFORE clearing it.
    // Previously, onPointerDown cleared hoveredPoint and onPointerUp read null.
    let downHoveredPoint:        HoveredPoint | null        = null;
    let downHoveredIntersection: IntersectionHover | null   = null;

    const onPointerDown = (e: MouseEvent) => {
      setCtxMenu(null);     // dismiss context menu on any pointer down
      setInspector(null);
      downOnCanvas = true;
      // Only set dragging for pan-zoom mode (other tools handle their own state)
      isDraggingRef.current = useCanvasToolStore.getState().mode === 'pan-zoom';
      if (isDraggingRef.current) canvas.style.cursor = 'grabbing';
      const pointerId = (e as PointerEvent).pointerId;
      if (typeof pointerId === 'number') {
        try { canvas.setPointerCapture(pointerId); } catch { /* ignore */ }
      }
      const rect = canvas.getBoundingClientRect();
      downX = e.clientX - rect.left;
      downY = e.clientY - rect.top;

      // Capture current hover state before we clear it for the drag phase
      const store = useInteractionStore.getState();
      downHoveredPoint        = store.hoveredPoint;
      downHoveredIntersection = store.hoveredIntersection;

      editorRef.current?.dispatchPointerDown(buildToolEvent(e, canvas, getLiveVp()));

      // Clear hover during drag in pan-zoom mode
      if (useCanvasToolStore.getState().mode === 'pan-zoom') {
        store.setHoveredPoint(null);
        store.setHoveredIntersection(null);
      }
      scheduleRaf();
    };

    const onPointerMove = (e: MouseEvent) => {
      const vp = getLiveVp();
      editorRef.current?.dispatchPointerMove(buildToolEvent(e, canvas, vp));

      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const showTangentNow = useFunctionStore.getState().features.showTangent;

      if (!isDraggingRef.current && showTangentNow) {
        updateTangentHover(canvasX);
      }

      // Snap only when not panning/zooming and tangent mode is off
      // Enable snap in pan-zoom, select, and pin-point modes
      const currentMode = useCanvasToolStore.getState().mode;
      const snapModes = ['pan-zoom', 'select', 'pin-point'];
      if (!isDraggingRef.current && !showTangentNow && snapModes.includes(currentMode)) {
        updateSnap(canvasX, canvasY);
      }
    };

    const onPointerUp = (e: MouseEvent) => {
      if (isDraggingRef.current) canvas.style.cursor = MODE_CURSORS[useCanvasToolStore.getState().mode];
      isDraggingRef.current = false;
      editorRef.current?.dispatchPointerUp(buildToolEvent(e, canvas, getLiveVp()));

      // Only process click logic if pointerdown actually fired on this canvas
      if (!downOnCanvas) return;
      downOnCanvas = false;

      const currentMode = useCanvasToolStore.getState().mode;

      // Left-click-to-select: if the pointer barely moved, treat as a click.
      const rect  = canvas.getBoundingClientRect();
      const upX   = e.clientX - rect.left;
      const upY   = e.clientY - rect.top;
      const moved = Math.hypot(upX - downX, upY - downY);

      if (moved < 5 && e.button === 0) {
        const rect2 = canvas.getBoundingClientRect();

        if (currentMode === 'pin-point') {
          // Pin-point mode: toggle pinned points directly on left-click
          if (downHoveredPoint?.isVisible) {
            useInteractionStore.getState().togglePinnedPoint({
              mathX: downHoveredPoint.mathX,
              mathY: downHoveredPoint.mathY,
              functionId: downHoveredPoint.functionId,
            });
          } else if (downHoveredIntersection) {
            useInteractionStore.getState().togglePinnedIntersection({
              mathX: downHoveredIntersection.mathX,
              mathY: downHoveredIntersection.mathY,
              fnId1: downHoveredIntersection.fnId1,
              fnId2: downHoveredIntersection.fnId2,
            });
          }
        } else {
          // pan-zoom / select mode: click to select + open inspector
          if (downHoveredIntersection) {
            useInteractionStore.getState().togglePinnedIntersection({
              mathX: downHoveredIntersection.mathX,
              mathY: downHoveredIntersection.mathY,
              fnId1: downHoveredIntersection.fnId1,
              fnId2: downHoveredIntersection.fnId2,
            });
            useFunctionStore.getState().setActiveFunctionId(downHoveredIntersection.fnId1);
            setInspector(null);
          } else if (downHoveredPoint?.isVisible) {
            useFunctionStore.getState().setActiveFunctionId(downHoveredPoint.functionId);
            setInspector({
              x: e.clientX - rect2.left,
              y: e.clientY - rect2.top,
              functionId: downHoveredPoint.functionId,
              mathX: downHoveredPoint.mathX,
              mathY: downHoveredPoint.mathY,
            });
          } else {
            // Click on empty canvas: deselect active function
            useFunctionStore.getState().setActiveFunctionId(null);
            setInspector(null);
          }
        }
      }

      // Reset captured state
      downHoveredPoint        = null;
      downHoveredIntersection = null;
    };

    const onPointerLeave = () => {
      if (isDraggingRef.current) canvas.style.cursor = MODE_CURSORS[useCanvasToolStore.getState().mode];
      isDraggingRef.current = false;
      useInteractionStore.getState().setHoveredPoint(null);
      useInteractionStore.getState().setHoveredIntersection(null);
      if (useFunctionStore.getState().features.showTangent) {
        useFunctionStore.getState().setTangentPoint(null, 0, null);
      }
      scheduleRaf();
    };

    const onDblClick = (e: MouseEvent) => {
      editorRef.current?.dispatchDblClick(buildToolEvent(e, canvas, getLiveVp()));
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const base = buildToolEvent(e, canvas, getLiveVp());
      editorRef.current?.dispatchWheel({ ...base, deltaY: e.deltaY });
    };

    /** Right-click on curve → open context menu with "取点" option. */
    const onContextMenu = (e: MouseEvent) => {
      // Compute snap at click position to decide whether to show menu
      const rect    = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const vp      = getLiveVp();
      const [mathX] = vp.toMath(canvasX, 0);
      const { functions: fns } = useFunctionStore.getState();

      // Check intersection snap first
      const ctxDpr = window.devicePixelRatio || 1;
      const snapVp = new Viewport(
        vp.xMin, vp.xMax, vp.yMin, vp.yMax,
        canvas.width / ctxDpr, canvas.height / ctxDpr,
      );

      let bestXsect: { ix: FunctionIntersection; dist: number } | null = null;
      for (const ix of intersectionsRef.current) {
        const [cx, cy] = snapVp.toCanvas(ix.mathX, ix.mathY);
        const dist = Math.hypot(canvasX - cx, canvasY - cy);
        if (dist < INTERSECT_SNAP_PX && (bestXsect === null || dist < bestXsect.dist)) {
          bestXsect = { ix, dist };
        }
      }

      if (bestXsect) {
        e.preventDefault();
        const { ix } = bestXsect;
        const [cx, cy] = snapVp.toCanvas(ix.mathX, ix.mathY);
        setCtxMenu({
          x: e.clientX, y: e.clientY,
          hoveredPoint: null,
          hoveredIntersection: {
            mathX: ix.mathX, mathY: ix.mathY,
            canvasX: cx, canvasY: cy,
            fnId1: ix.fnId1, fnId2: ix.fnId2,
          },
        });
        return;
      }

      // Check curve snap
      let best: { fnId: string; mathX: number; mathY: number; dist: number } | null = null;
      for (const fn of fns) {
        if (!fn.visible || fn.mode !== 'standard') continue;
        const mathY = evaluateStandard(fn, mathX);
        if (mathY === null) continue;
        const [, curveCanvasY] = vp.toCanvas(mathX, mathY);
        const dist = Math.abs(canvasY - curveCanvasY);
        if (dist < SNAP_PX && (best === null || dist < best.dist)) {
          best = { fnId: fn.id, mathX, mathY, dist };
        }
      }

      if (best) {
        e.preventDefault();
        const fn = fns.find((f) => f.id === best!.fnId)!;
        const slope = getNumericalDerivative(fn, best.mathX);
        const [snapCx, snapCy] = snapVp.toCanvas(best.mathX, best.mathY);
        setCtxMenu({
          x: e.clientX, y: e.clientY,
          hoveredPoint: {
            mathX: best.mathX, mathY: best.mathY,
            canvasX: snapCx, canvasY: snapCy,
            functionId: best.fnId, slope, isVisible: true,
          },
          hoveredIntersection: null,
        });
      }
      // If not near any curve, let the default context menu show
    };

    canvas.addEventListener('pointerdown',  onPointerDown  as EventListener);
    canvas.addEventListener('pointermove',  onPointerMove  as EventListener);
    canvas.addEventListener('pointerup',    onPointerUp    as EventListener);
    canvas.addEventListener('pointerleave', onPointerLeave as EventListener);
    canvas.addEventListener('dblclick',     onDblClick     as EventListener);
    canvas.addEventListener('wheel',        onWheel,        { passive: false });
    canvas.addEventListener('contextmenu',  onContextMenu  as EventListener);

    return () => {
      canvas.removeEventListener('pointerdown',  onPointerDown  as EventListener);
      canvas.removeEventListener('pointermove',  onPointerMove  as EventListener);
      canvas.removeEventListener('pointerup',    onPointerUp    as EventListener);
      canvas.removeEventListener('pointerleave', onPointerLeave as EventListener);
      canvas.removeEventListener('dblclick',     onDblClick     as EventListener);
      canvas.removeEventListener('wheel',        onWheel);
      canvas.removeEventListener('contextmenu',  onContextMenu  as EventListener);
    };
  }, []);

  // ── Viewport helpers ──────────────────────────────────────────────────
  const handleCenterOrigin = () => {
    const current = editorRef.current?.getViewport();
    if (!current) return;
    editorRef.current?.setViewport(centerOriginViewport(current));
  };

  const handleResetViewport = () => {
    const vp = new Viewport(-10, 10, -6, 6, canvasSize.width, canvasSize.height);
    editorRef.current?.setViewport(vp);
    useFunctionStore.getState().setViewport({ xMin: -10, xMax: 10, yMin: -6, yMax: 6 });
  };

  // Close context menu when clicking anywhere outside
  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = () => setCtxMenu(null);
    window.addEventListener('pointerdown', dismiss);
    window.addEventListener('wheel', dismiss, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('wheel', dismiss);
    };
  }, [ctxMenu]);

  // Close floating inspector on scroll/zoom (viewport change)
  const prevVpRef = useRef(viewport);
  useEffect(() => {
    if (prevVpRef.current !== viewport && inspector) {
      setInspector(null);
    }
    prevVpRef.current = viewport;
  }, [viewport, inspector]);

  // Close inspector when active function changes from sidebar
  useEffect(() => {
    if (inspector && activeFunctionId !== inspector.functionId) {
      setInspector(null);
    }
  }, [activeFunctionId, inspector]);

  /** Handle "取点" (pin point) from the context menu. */
  const handleCtxPin = useCallback(() => {
    if (!ctxMenu) return;
    if (ctxMenu.hoveredIntersection) {
      useInteractionStore.getState().togglePinnedIntersection({
        mathX: ctxMenu.hoveredIntersection.mathX,
        mathY: ctxMenu.hoveredIntersection.mathY,
        fnId1: ctxMenu.hoveredIntersection.fnId1,
        fnId2: ctxMenu.hoveredIntersection.fnId2,
      });
    } else if (ctxMenu.hoveredPoint) {
      useInteractionStore.getState().togglePinnedPoint({
        mathX:      ctxMenu.hoveredPoint.mathX,
        mathY:      ctxMenu.hoveredPoint.mathY,
        functionId: ctxMenu.hoveredPoint.functionId,
      });
    }
    setCtxMenu(null);
  }, [ctxMenu]);

  /** Handle "添加切线" from the context menu.
   *  Creates a tangent line y = slope*(x - x0) + y0 as an independent function. */
  const handleCtxAddTangent = useCallback(() => {
    if (!ctxMenu?.hoveredPoint) return;
    const { mathX: x0, mathY: y0, slope, functionId } = ctxMenu.hoveredPoint;
    if (slope === null || !isFinite(slope)) { setCtxMenu(null); return; }

    // Find parent function for label context
    const store = useFunctionStore.getState();
    const parent = store.functions.find((f) => f.id === functionId);
    const count  = store.functions.length;
    const LABELS = ['f(x)', 'g(x)', 'h(x)', 'p(x)', 'q(x)', 'r(x)', 's(x)', 't(x)'];

    // Build tangent expression: slope*(x - x0) + y0
    const s  = slope.toFixed(6);
    const x0s = x0.toFixed(6);
    const y0s = y0.toFixed(6);
    const exprStr = `${s} * (x - (${x0s})) + ${y0s}`;

    const entry: FunctionEntry = {
      id:          createId(),
      label:       LABELS[count] ?? `t${count}(x)`,
      mode:        'standard',
      exprStr,
      segments:    [],
      color:       parent?.color ?? (FUNCTION_COLORS[count % FUNCTION_COLORS.length] as string),
      lineStyle:   parent?.lineStyle ?? 'solid',
      visible:     true,
      transform:   { ...DEFAULT_TRANSFORM },
      displayDomain: { ...DEFAULT_FUNCTION_DISPLAY_DOMAIN },
      inverseDisplay: { ...DEFAULT_INVERSE_FUNCTION_DISPLAY },
      templateId:  null,
      namedParams: [],
    };

    editorInstance?.execute(new AddFunctionCommand(entry));
    if (parent) store.setActiveFunctionId(parent.id);
    setCtxMenu(null);
  }, [ctxMenu]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Bottom layer: axes + curves (low-frequency redraws) */}
      <canvas
        ref={staticRef}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      {/* Top layer: snap indicator + tangent (RAF-driven) */}
      <canvas
        ref={dynamicRef}
        style={{ position: 'absolute', top: 0, left: 0, cursor: MODE_CURSORS[canvasMode] }}
      />
      {/* Canvas toolbar removed — tools controlled from TopBar */}
      {/* Animation HUD — shows live parameter values during playback */}
      <AnimationHUD />
      {/* Debug overlay — Ctrl+Shift+D in dev mode */}
      <DebugOverlay debugInfo={debugInfo} />
      {/* Viewport quick actions — bottom-right, light card style */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 10,
          display: 'flex',
          gap: 6,
          zIndex: 10,
        }}
      >
        <ViewportActionButton
          onClick={handleCenterOrigin}
          title="保持当前缩放比例，将原点移到画布中心"
        >
          原点居中
        </ViewportActionButton>
        <ViewportActionButton
          onClick={handleResetViewport}
          title="重置视图到默认范围"
        >
          重置视图
        </ViewportActionButton>
      </div>

      {/* Right-click context menu */}
      {ctxMenu && (
        <CurveContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          containerRef={containerRef}
          hoveredPoint={ctxMenu.hoveredPoint}
          hoveredIntersection={ctxMenu.hoveredIntersection}
          onPin={handleCtxPin}
          onAddTangent={handleCtxAddTangent}
          onClose={closeCtxMenu}
        />
      )}

      {/* Floating inspector panel (left-click on curve) */}
      {inspector && containerRef.current && (
        <CurveInspectorPanel
          target={inspector}
          containerRect={containerRef.current.getBoundingClientRect()}
          onClose={closeInspector}
        />
      )}
    </div>
  );
});

function ViewportActionButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
          padding: '5px 12px',
          fontSize: '11px',
          fontWeight: 500,
          background: COLORS.surface,
          color: COLORS.textSecondary,
          border: `1px solid ${COLORS.border}`,
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          transition: 'background 0.12s, color 0.12s',
          lineHeight: '1.5',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.surfaceAlt; e.currentTarget.style.color = COLORS.textPrimary; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = COLORS.surface; e.currentTarget.style.color = COLORS.textSecondary; }}
      >
      {children}
    </button>
  );
}

// ─── Context menu overlay ────────────────────────────────────────────────────

const ctxItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  fontSize: '14px',
  color: '#1A1A2E',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  transition: 'background 0.1s',
};

const ctxItemDisabledStyle: React.CSSProperties = {
  ...ctxItemStyle,
  color: '#9CA3AF',
  cursor: 'not-allowed',
};

function CurveContextMenu({
  x,
  y,
  containerRef,
  hoveredPoint,
  hoveredIntersection,
  onPin,
  onAddTangent,
  onClose,
}: {
  x: number;
  y: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredPoint: HoveredPoint | null;
  hoveredIntersection: IntersectionHover | null;
  onPin: () => void;
  onAddTangent: () => void;
  onClose: () => void;
}) {
  const rect = containerRef.current?.getBoundingClientRect();
  const left = rect ? x - rect.left : x;
  const top  = rect ? y - rect.top  : y;

  const hasCurveHit = hoveredPoint?.isVisible ?? false;
  const canTangent  = hasCurveHit && hoveredPoint?.slope !== null && isFinite(hoveredPoint?.slope ?? NaN);

  return (
    <div
      style={{
        position: 'absolute',
        left, top,
        zIndex: 50,
        minWidth: 140,
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        padding: '4px 0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Section header */}
      {hasCurveHit && (
        <div style={{
          padding: '6px 12px 6px',
          fontSize: 12,
          fontWeight: 600,
          color: '#6B7280',
          borderBottom: '1px solid #E5E7EB',
          marginBottom: 2,
        }}>
          曲线操作
        </div>
      )}

      {/* 取点 */}
      <button
        onClick={() => { onPin(); onClose(); }}
        style={ctxItemStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#F0F0F0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        📌 取点
      </button>

      {/* 添加切线 */}
      {hasCurveHit && (
        <>
          <button
            onClick={canTangent ? () => { onAddTangent(); onClose(); } : undefined}
            style={canTangent ? ctxItemStyle : ctxItemDisabledStyle}
            title={canTangent
              ? `斜率 k = ${hoveredPoint!.slope!.toFixed(4)}`
              : '此点斜率不存在'
            }
            onMouseEnter={canTangent ? (e) => { e.currentTarget.style.background = '#F0F0F0'; } : undefined}
            onMouseLeave={canTangent ? (e) => { e.currentTarget.style.background = 'transparent'; } : undefined}
          >
            📐 添加切线
          </button>
        </>
      )}

      {/* Slope info */}
      {hasCurveHit && hoveredIntersection === null && hoveredPoint?.slope !== null && (
        <div style={{
          padding: '4px 12px 2px',
          fontSize: 12, fontFamily: 'monospace',
          color: '#9CA3AF', userSelect: 'all',
          borderTop: '1px solid #E5E7EB',
          marginTop: 2,
        }}>
          k = {hoveredPoint!.slope!.toFixed(4)}
        </div>
      )}
    </div>
  );
}
