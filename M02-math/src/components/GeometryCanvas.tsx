import { useEffect, useRef, useState } from 'react';
import { Viewport } from '@/canvas/Viewport';
import { COLORS } from '@/styles/colors';
import { renderAxis } from '@/canvas/renderers/axisRenderer';
import { useCanvasToolStore } from '@/editor/store/canvasToolStore';
import { SelectTool } from '@/editor/tools/SelectTool';
import { PinPointTool } from '@/editor/tools/PinPointTool';
import { renderParametricCurve } from '@/canvas/renderers/conicRenderer';
import { renderEntityDerivedElements } from '@/canvas/renderers/derivedElementRenderer';
import {
  renderLine, renderChord, renderIntersectionPoints,
  renderFocalTriangle, renderFocalDistanceLabels,
  renderLatusRectumHighlight, renderAreaShading,
} from '@/canvas/renderers/lineRenderer';
import { renderM03Pins } from '@/canvas/renderers/m03PinRenderer';
import { renderLocusDemo } from '@/canvas/renderers/locusRenderer';
import { renderCircleLineDist } from '@/canvas/renderers/circleLineRenderer';
import { renderOpticalDemo } from '@/canvas/renderers/opticalRenderer';
import { computeOpticalRays } from '@/engine/opticalEngine';
import { sampleConicEntity } from '@/engine/parametricSampler';
import { compileImplicitCurve } from '@/engine/implicitCurveEngine';
import { sampleImplicitCurve } from '@/engine/implicitSampler';
import { renderImplicitCurve } from '@/canvas/renderers/implicitCurveRenderer';
import { renderMovablePoints } from '@/canvas/renderers/movablePointRenderer';
import { useMovablePointStore } from '@/editor/store/movablePointStore';
import { MovablePointDragTool } from '@/editor/tools/MovablePointDragTool';
import { intersectLineConic } from '@/engine/intersectionEngine';
import { findNearestOnAnyEntity } from '@/engine/nearestPoint';
import { useDualCanvas } from '@/hooks/useDualCanvas';
import { PanZoomTool } from '@/editor/tools/PanZoomTool';
import { PointOnCurveTool } from '@/editor/tools/PointOnCurveTool';
import { LineDragTool } from '@/editor/tools/LineDragTool';
import { TwoPointLineTool } from '@/editor/tools/TwoPointLineTool';
import { projectOntoEntity } from '@/engine/curveParameterization';
import { UpdateMovablePointCommand } from '@/editor/commands/UpdateMovablePointCommand';
import { executeM03Command } from '@/editor/commands/m03Execute';
import { useEntityStore } from '@/editor/store/entityStore';
import { useAnimationStore } from '@/editor/store/animationStore';
import { useM03InteractionStore } from '@/editor/store/m03InteractionStore';
import { useLocusStore } from '@/editor/store/locusStore';
import { useOpticalStore } from '@/editor/store/opticalStore';
import { DEFAULT_M03_VIEWPORT } from '@/types';
import type { LineEntity, ConicEntity, MovablePointEntity } from '@/types';
import { isConicEntity } from '@/types';

const M03_RESET = { xMin: -12, xMax: 12, yMin: -8, yMax: 8 };

/**
 * Dual-layer canvas for the M03 解析几何画板.
 *
 * Static layer  (staticRef):
 *   1. renderAxis (dark theme)
 *   2. Per visible entity: sampleConicEntity → renderParametricCurve
 *   3. Per visible entity: renderEntityDerivedElements (foci / directrices / asymptotes)
 *   4. Chord arrows + red intersection dots for each line × conic pair
 *
 * Dynamic layer (dynamicRef):
 *   PointOnCurveTool snap overlay, TwoPointLineTool P₁ dot + preview line.
 */
export function GeometryCanvas() {
  const {
    containerRef, staticRef, dynamicRef,
    canvasSize, editorRef, buildToolEvent,
  } = useDualCanvas({
    initialViewport: DEFAULT_M03_VIEWPORT,
    setViewportFn:   useEntityStore.getState().setViewport,
    onInit: (editor) => {
      editor.activateTool(new PanZoomTool(M03_RESET));
    },
  });

  const entities          = useEntityStore((s) => s.entities);
  const viewport          = useEntityStore((s) => s.viewport);
  const displayOptions    = useEntityStore((s) => s.displayOptions);
  const activeTool        = useEntityStore((s) => s.activeTool);
  const focalConstraint   = useEntityStore((s) => s.focalConstraint);
  const activeEntityId    = useEntityStore((s) => s.activeEntityId);
  const hoveredEntityId   = useEntityStore((s) => s.hoveredEntityId);
  const isAnimating       = useAnimationStore((s) => s.isAnyAnimating);

  // Track dragging state to suppress hover during pan gestures
  const isDraggingRef = useRef(false);
  // Track current hoveredEntityId in a ref for cursor without re-render
  const [cursorHovered, setCursorHovered] = useState(false);
  const [cursorMode, setCursorMode] = useState<'none' | 'curve' | 'point'>('none');

  // M03 pinned points
  const pinnedPoints        = useM03InteractionStore((s) => s.pinnedPoints);
  const pinnedIntersections = useM03InteractionStore((s) => s.pinnedIntersections);

  // Locus demo state (use renderTick for throttled redraws)
  const locusRenderTick   = useLocusStore((s) => s.renderTick);
  const locusPreset       = useLocusStore((s) => s.activePreset);
  const locusEntityId     = useLocusStore((s) => s.activeEntityId);

  // Optical demo state
  const opticalEnabled    = useOpticalStore((s) => s.enabled);
  const opticalRayCount   = useOpticalStore((s) => s.rayCount);
  const opticalRenderTick = useOpticalStore((s) => s.renderTick);

  // Canvas tool mode subscriptions
  const canvasMode   = useCanvasToolStore((s) => s.mode);

  // ── Canvas tool mode → activate appropriate tool ──────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const navModes: Record<string, () => import('@/editor/tools/types').Tool> = {
      'select':    () => new SelectTool(),
      'pin-point': () => new PinPointTool(),
    };
    if (canvasMode in navModes) {
      editor.activateTool(navModes[canvasMode]());
    }
    // 'pan-zoom' is handled by M03's own activeTool effect
  }, [canvasMode, editorRef]);

  // ── Static layer: full render loop ────────────────────────────────────────
  useEffect(() => {
    const canvas = staticRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HiDPI: canvas buffer = CSS size × dpr; scale context so drawing uses CSS coords
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    const vp = new Viewport(
      viewport.xMin, viewport.xMax, viewport.yMin, viewport.yMax,
      cssW, cssH,
    );

    // 1. Clear + axes (dark theme)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    renderAxis(ctx, vp, { showGrid: displayOptions.showGrid });

    // Reduce sample density during animations to maintain ≥55fps
    const steps = isAnimating ? 400 : 800;

    // 2–3. Curves + derived elements per entity
    // Keep each entity's own color; active entities get a primary glow.
    const ACTIVE_COLOR = COLORS.primary;

    const lineEntities:  LineEntity[]  = [];
    const conicEntities: ConicEntity[] = [];
    const movablePoints: MovablePointEntity[] = [];

    for (const entity of entities) {
      if (!entity.visible) continue;

      const isActive  = entity.id === activeEntityId;
      const drawColor = entity.color;

      if (entity.type === 'line') {
        if (isActive) {
          ctx.save();
          ctx.shadowColor = ACTIVE_COLOR;
          ctx.shadowBlur = 8;
        }
        renderLine(ctx, { ...entity, color: drawColor }, vp);
        if (isActive) ctx.restore();
        lineEntities.push(entity);
      } else if (entity.type === 'implicit-curve') {
        const compiled = compileImplicitCurve(entity.params);
        if (compiled) {
          const gridSize = isAnimating ? 200 : 400;
          const result = sampleImplicitCurve(
            compiled.evaluator,
            vp.xMin, vp.xMax, vp.yMin, vp.yMax,
            gridSize,
          );
          if (isActive) {
            ctx.save();
            ctx.shadowColor = ACTIVE_COLOR;
            ctx.shadowBlur = 10;
          }
          renderImplicitCurve(ctx, result, vp, drawColor, isActive ? { lineWidth: 3.5 } : undefined);
          if (isActive) ctx.restore();
        }
      } else if (entity.type === 'movable-point') {
        movablePoints.push(entity);
      } else {
        const curveOpts = isActive
          ? { lineWidth: 3.5 }
          : undefined;

        if (isActive) {
          ctx.save();
          ctx.shadowColor = ACTIVE_COLOR;
          ctx.shadowBlur = 10;
        }

        const result = sampleConicEntity(entity, vp, steps);
        if (Array.isArray(result)) {
          renderParametricCurve(ctx, result, vp, drawColor, curveOpts);
        } else {
          renderParametricCurve(ctx, result.right, vp, drawColor, curveOpts);
          renderParametricCurve(ctx, result.left,  vp, drawColor, curveOpts);
        }

        if (isActive) ctx.restore();
        renderEntityDerivedElements(ctx, entity, vp, {
          showFoci:           displayOptions.showFoci,
          showDirectrices:    displayOptions.showDirectrices,
          showAsymptotes:     displayOptions.showAsymptotes,
          showLabels:         displayOptions.showLabels,
          showVertices:       displayOptions.showVertices,
          showAxesOfSymmetry: displayOptions.showAxesOfSymmetry,
        });
        conicEntities.push(entity);
      }
    }

    // 4. Chord arrows + intersection dots: each line × each visible conic
    if (displayOptions.showIntersections) {
      for (const line of lineEntities) {
        for (const conic of conicEntities) {
          const result = intersectLineConic(line.params, conic);
          if (result.pts.length > 0) {
            // Area shading (back layer)
            renderAreaShading(ctx, result, conic, vp);
            // Focal triangle fill (behind chord)
            renderFocalTriangle(ctx, result, vp);
            // Latus rectum highlight glow
            renderLatusRectumHighlight(ctx, result, vp);
            // Chord double-arrow + |AB| label
            renderChord(ctx, result, vp);
            // |AF|, |BF| distance labels on focal chord segments
            renderFocalDistanceLabels(ctx, result, vp);
            // Intersection dots with anti-overlap coordinates
            renderIntersectionPoints(ctx, result, line.color, vp, conic);
          }
        }
      }
    }

    // 5. Circle-line distance visualization
    for (const conic of conicEntities) {
      if (conic.type === 'circle') {
        for (const line of lineEntities) {
          renderCircleLineDist(ctx, conic, line, vp);
        }
      }
    }

    // 6. Optical property rays + photons
    if (opticalEnabled) {
      for (const conic of conicEntities) {
        if (conic.type === 'ellipse' || conic.type === 'parabola') {
          const rays = computeOpticalRays(conic, opticalRayCount);
          if (rays) {
            const photons = useOpticalStore.getState().photons;
            renderOpticalDemo(ctx, vp, rays, photons, conic.color);
          }
        }
      }
    }

    // 7. Locus demo overlay
    if (locusPreset && locusEntityId) {
      const locusEntity = entities.find((e) => e.id === locusEntityId);
      if (locusEntity && isConicEntity(locusEntity)) {
        const locusState = useLocusStore.getState();
        renderLocusDemo(
          ctx, vp, locusEntity,
          locusPreset, locusState.currentPoint, locusState.tracePoints,
        );
      }
    }

    // 8. Pinned points/intersections
    renderM03Pins(ctx, vp, entities, pinnedPoints, pinnedIntersections);

    // 9. Movable points
    const trajectories = useMovablePointStore.getState().trajectories;
    renderMovablePoints(ctx, vp, movablePoints, trajectories, activeEntityId);

  }, [entities, viewport, displayOptions, canvasSize, staticRef, isAnimating,
      activeEntityId, pinnedPoints, pinnedIntersections, locusRenderTick, locusPreset, locusEntityId,
      opticalEnabled, opticalRayCount, opticalRenderTick]);

  // ── Dynamic layer: hovered entity glow ──────────────────────────────────────
  useEffect(() => {
    // Only draw hover glow in pan-zoom mode
    if (activeTool !== 'pan-zoom') return;

    const canvas = dynamicRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    // Clear the dynamic layer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!hoveredEntityId) return;

    const entity = entities.find((e) => e.id === hoveredEntityId);
    if (!entity || !entity.visible) return;

    const vp = new Viewport(
      viewport.xMin, viewport.xMax, viewport.yMin, viewport.yMax,
      cssW, cssH,
    );

    const glowColor = COLORS.primary;
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 14;

    if (entity.type === 'line') {
      renderLine(ctx, { ...entity, color: glowColor }, vp);
    } else if (entity.type === 'implicit-curve') {
      const compiled = compileImplicitCurve(entity.params);
      if (compiled) {
        const result = sampleImplicitCurve(
          compiled.evaluator,
          vp.xMin, vp.xMax, vp.yMin, vp.yMax,
          200,
        );
        renderImplicitCurve(ctx, result, vp, glowColor, { lineWidth: 3.5 });
      }
    } else if (entity.type === 'movable-point') {
      // Hover glow for movable point: highlight ring + coordinate label
      const [pcx, pcy] = vp.toCanvas(entity.params.mathX, entity.params.mathY);
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pcx, pcy, 12, 0, 2 * Math.PI);
      ctx.stroke();

      // Light card label
      const ptLabel = `(${entity.params.mathX.toFixed(2)}, ${entity.params.mathY.toFixed(2)})`;
      ctx.font = '700 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
      ctx.textBaseline = 'middle';
      const ptw = ctx.measureText(ptLabel).width;
      const plx = Math.round(pcx + 14);
      const ply = Math.round(pcy - 16);
      const ppw = ptw + 14;
      const pph = 22;

      ctx.shadowColor = 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.roundRect(plx - 7, ply - pph / 2, ppw, pph, 8);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.fillStyle = '#1A1A2E';
      ctx.fillText(ptLabel, plx, ply);
    } else {
      const result = sampleConicEntity(entity, vp, 400);
      if (Array.isArray(result)) {
        renderParametricCurve(ctx, result, vp, glowColor, { lineWidth: 3.5 });
      } else {
        renderParametricCurve(ctx, result.right, vp, glowColor, { lineWidth: 3.5 });
        renderParametricCurve(ctx, result.left,  vp, glowColor, { lineWidth: 3.5 });
      }
    }

    ctx.restore();
  }, [hoveredEntityId, entities, viewport, activeTool, dynamicRef]);

  // ── Tool switching ─────────────────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const clearDyn = () => {
      const c = dynamicRef.current;
      if (!c) return;
      const dctx = c.getContext('2d');
      if (!dctx) return;
      const dpr = window.devicePixelRatio || 1;
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.clearRect(0, 0, c.width, c.height);
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    if (activeTool === 'movable-point') {
      editor.activateTool(new MovablePointDragTool(() => dynamicRef.current));
    } else if (activeTool === 'point-on-curve') {
      editor.activateTool(new PointOnCurveTool(() => dynamicRef.current));
    } else if (activeTool === 'line-drag') {
      clearDyn();
      const tool = new LineDragTool();
      tool.focalConstraint = focalConstraint;
      editor.activateTool(tool);
    } else if (activeTool === 'line-two-point') {
      editor.activateTool(new TwoPointLineTool(() => dynamicRef.current));
    } else {
      clearDyn();
      editor.activateTool(new PanZoomTool(M03_RESET));
    }
  }, [activeTool, focalConstraint, editorRef, dynamicRef]);

  // ── Pointer event forwarding ───────────────────────────────────────────────

  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingPointRef = useRef<{ id: string; before: MovablePointEntity } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dynamicRef.current?.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    downPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    isDraggingRef.current = true;

    // In pan-zoom mode, check if clicking a movable point to start drag
    const tool = useEntityStore.getState().activeTool;
    if (tool === 'pan-zoom') {
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const vp = useEntityStore.getState().viewport;
      const vpObj = new Viewport(vp.xMin, vp.xMax, vp.yMin, vp.yMax, rect.width, rect.height);
      const [mx, my] = vpObj.toMath(cx, cy);
      const HIT_PX = 10;
      const mathPerPx = (vp.xMax - vp.xMin) / rect.width;
      const hitRadius = HIT_PX * mathPerPx;

      const store = useEntityStore.getState();
      const movablePoints = store.entities.filter(
        (ent): ent is MovablePointEntity => ent.type === 'movable-point' && ent.visible,
      );
      for (const pt of movablePoints) {
        const dx = mx - pt.params.mathX;
        const dy = my - pt.params.mathY;
        if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
          draggingPointRef.current = { id: pt.id, before: { ...pt, params: { ...pt.params } } };
          store.setActiveEntityId(pt.id);
          return; // don't forward to PanZoomTool
        }
      }
    }

    editorRef.current?.dispatchPointerDown(buildToolEvent(e.nativeEvent));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const tool = useEntityStore.getState().activeTool;

    // ── Pan-zoom drag of a movable point ────────────────────────────
    if (draggingPointRef.current && tool === 'pan-zoom') {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const vp = useEntityStore.getState().viewport;
      const vpObj = new Viewport(vp.xMin, vp.xMax, vp.yMin, vp.yMax, rect.width, rect.height);
      const [mx, my] = vpObj.toMath(cx, cy);

      const store = useEntityStore.getState();
      const point = store.entities.find(
        (ent): ent is MovablePointEntity => ent.id === draggingPointRef.current!.id && ent.type === 'movable-point',
      );
      if (point) {
        const constraint = store.entities.find((ent) => ent.id === point.params.constraintEntityId);
        if (constraint) {
          const projected = projectOntoEntity(constraint, mx, my, vpObj);
          if (projected) {
            const updated: MovablePointEntity = {
              ...point,
              params: { ...point.params, t: projected.t, mathX: projected.mathX, mathY: projected.mathY, branch: projected.branch },
            };
            store.updateEntity(point.id, updated);
            if (point.params.showTrajectory) {
              useMovablePointStore.getState().pushTracePoint(point.id, projected.mathX, projected.mathY);
            }
          }
        }
      }
      return;
    }

    editorRef.current?.dispatchPointerMove(buildToolEvent(e.nativeEvent));

    // Hover snap in pan-zoom mode (suppress during drag)
    if (tool !== 'pan-zoom' || isDraggingRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const vp = useEntityStore.getState().viewport;
    const cssW = rect.width;
    const cssH = rect.height;
    const vpObj = new Viewport(vp.xMin, vp.xMax, vp.yMin, vp.yMax, cssW, cssH);

    const [mx, my] = vpObj.toMath(cx, cy);

    // Convert snap radius to math units
    const mathPerPx = (vp.xMax - vp.xMin) / cssW;

    // 1. Check movable points first (10px hit radius)
    const HIT_PX = 10;
    const hitRadius = HIT_PX * mathPerPx;
    const currentEntities = useEntityStore.getState().entities;
    const movablePoints = currentEntities.filter(
      (ent): ent is MovablePointEntity => ent.type === 'movable-point' && ent.visible,
    );
    let hitPointId: string | null = null;
    for (const pt of movablePoints) {
      const dx = mx - pt.params.mathX;
      const dy = my - pt.params.mathY;
      if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
        hitPointId = pt.id;
        break;
      }
    }

    if (hitPointId) {
      const prevId = useEntityStore.getState().hoveredEntityId;
      if (hitPointId !== prevId) {
        useEntityStore.getState().setHoveredEntityId(hitPointId);
        setCursorHovered(true);
        setCursorMode('point');
      }
      return;
    }

    // 2. Fallback: curve snap
    const SNAP_PX = 20;
    const snapRadius = SNAP_PX * mathPerPx;
    const snap = findNearestOnAnyEntity(currentEntities, mx, my, vpObj, snapRadius);

    const newId = snap ? snap.entity.id : null;
    const prevId = useEntityStore.getState().hoveredEntityId;
    if (newId !== prevId) {
      useEntityStore.getState().setHoveredEntityId(newId);
      setCursorHovered(newId !== null);
      setCursorMode(newId !== null ? 'curve' : 'none');
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dynamicRef.current?.releasePointerCapture(e.pointerId);

    // Commit movable point drag if active
    if (draggingPointRef.current) {
      const store = useEntityStore.getState();
      const afterEntity = store.entities.find(
        (ent): ent is MovablePointEntity => ent.id === draggingPointRef.current!.id && ent.type === 'movable-point',
      );
      if (afterEntity && draggingPointRef.current.before) {
        const dx = afterEntity.params.mathX - draggingPointRef.current.before.params.mathX;
        const dy = afterEntity.params.mathY - draggingPointRef.current.before.params.mathY;
        if (dx * dx + dy * dy > 1e-10) {
          executeM03Command(
            new UpdateMovablePointCommand(draggingPointRef.current.id, draggingPointRef.current.before, afterEntity),
          );
        }
      }
      draggingPointRef.current = null;
      isDraggingRef.current = false;
      downPosRef.current = null;
      return;
    }

    editorRef.current?.dispatchPointerUp(buildToolEvent(e.nativeEvent));
    isDraggingRef.current = false;

    // Click detection → select hovered entity or deselect
    if (downPosRef.current && e.button === 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const dx = (e.clientX - rect.left) - downPosRef.current.x;
      const dy = (e.clientY - rect.top) - downPosRef.current.y;
      if (Math.hypot(dx, dy) < 5) {
        const tool = useEntityStore.getState().activeTool;
        if (tool === 'pan-zoom') {
          const hovered = useEntityStore.getState().hoveredEntityId;
          if (hovered) {
            useEntityStore.getState().setActiveEntityId(hovered);
          } else {
            useEntityStore.getState().setActiveEntityId(null);
          }
        }
      }
    }
    downPosRef.current = null;
  };

  const handlePointerLeave = () => {
    editorRef.current?.dispatchPointerLeave();
    useEntityStore.getState().setHoveredEntityId(null);
    setCursorHovered(false);
    setCursorMode('none');
  };

  const handleDblClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    editorRef.current?.dispatchDblClick(buildToolEvent(e.nativeEvent));
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    editorRef.current?.dispatchWheel({ ...buildToolEvent(e.nativeEvent), deltaY: e.deltaY });
  };

  const NAV_CURSORS: Record<string, string> = {
    'select': 'default',
    'pin-point': 'crosshair',
  };
  const cursor =
    canvasMode in NAV_CURSORS ? NAV_CURSORS[canvasMode] :
    activeTool === 'point-on-curve' ? 'crosshair' :
    activeTool === 'movable-point'  ? 'crosshair' :
    activeTool === 'line-drag'      ? 'move'       :
    activeTool === 'line-two-point' ? 'crosshair'  :
    (activeTool === 'pan-zoom' && cursorHovered && cursorMode === 'point') ? 'grab' :
    (activeTool === 'pan-zoom' && cursorHovered) ? 'pointer' : 'grab';

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
      tabIndex={-1}
    >
      <canvas
        ref={staticRef}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      <canvas
        ref={dynamicRef}
        style={{ position: 'absolute', top: 0, left: 0, cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDblClick}
        onWheel={handleWheel}
      />
    </div>
  );
}
