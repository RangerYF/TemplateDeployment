import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useSimulationStore } from '@/store';
import { entityRegistry, rendererRegistry } from '@/core/registries';
import { screenToWorld, worldToScreen } from '@/renderer/coordinate';
import { pickPopoverPosition } from '@/renderer/placement';
import { DraggablePopover } from './DraggablePopover';
import { ViewportBar } from './ViewportBar';
import { MotionCharts } from './MotionCharts';
import type { CoordinateTransform, Selection, Vec2 } from '@/core/types';
import type { FloatingComponentProps } from '@/core/registries';

export interface CanvasContainerProps {
  onContextReady?: (ctx: CanvasRenderingContext2D) => void;
  getCoordinateTransform?: () => CoordinateTransform;
}

/**
 * 中央画布容器
 * 管理 Canvas 元素、处理 resize、鼠标事件分发和浮动 UI
 */
export function CanvasContainer({ onContextReady, getCoordinateTransform }: CanvasContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    // 设置 Canvas 物理尺寸（高分屏）
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // 设置 CSS 显示尺寸
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // 缩放上下文以匹配 DPR
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      onContextReady?.(ctx);
    }
  }, [onContextReady]);

  useEffect(() => {
    handleResize();

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [handleResize]);

  // ─── 坐标转换工具 ───

  /** 从鼠标事件获取 canvas CSS 坐标（不含 DPR） */
  const getCanvasPoint = useCallback((e: React.MouseEvent): Vec2 => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // ─── hitTest 分发 ───

  const performHitTest = useCallback((screenPoint: Vec2): Selection | null => {
    if (!getCoordinateTransform) return null;
    const ct = getCoordinateTransform();
    const worldPoint = screenToWorld(screenPoint, ct);

    const store = useSimulationStore.getState();
    const viewport = store.viewportState;

    // 1. 视角交互 handler hitTest（优先级最高）
    const interactionHandler = rendererRegistry.getViewportInteraction(viewport.primary);
    if (interactionHandler) {
      const result = interactionHandler.hitTest(screenPoint, worldPoint, {
        selection: store.selection,
        hoveredTarget: store.hoveredTarget,
        entities: store.simulationState.scene.entities,
        result: store.simulationState.currentResult,
        coordinateTransform: ct,
      });
      if (result) return result;
    }

    // 2. 实体 hitTest（使用 MotionState 位置做检测，与渲染一致）
    const entities = store.simulationState.scene.entities;
    const result = store.simulationState.currentResult;
    const savedTransforms = new Map<string, { x: number; y: number; rotation: number }>();

    // 临时应用 MotionState 位置
    if (result) {
      for (const [entityId, motion] of result.motionStates) {
        const entity = entities.get(entityId);
        if (entity) {
          savedTransforms.set(entityId, {
            ...entity.transform.position,
            rotation: entity.transform.rotation,
          });
          entity.transform.position = { ...motion.position };
          if (motion.rotation != null) {
            entity.transform.rotation = motion.rotation;
          }
        }
      }
    }

    let bestHit: { entityId: string; distance: number } | null = null;
    for (const entity of entities.values()) {
      const reg = entityRegistry.get(entity.type);
      if (!reg) continue;
      const hit = reg.hitTest(entity, worldPoint, ct);
      if (hit && (!bestHit || hit.distance < bestHit.distance)) {
        bestHit = { entityId: hit.entityId, distance: hit.distance };
      }
    }

    // 恢复原始 transform
    for (const [entityId, saved] of savedTransforms) {
      const entity = entities.get(entityId);
      if (entity) {
        entity.transform.position = { x: saved.x, y: saved.y };
        entity.transform.rotation = saved.rotation;
      }
    }

    if (bestHit) {
      return { type: 'entity', id: bestHit.entityId, data: { entityId: bestHit.entityId } };
    }

    // 3. 空白
    return null;
  }, [getCoordinateTransform]);

  // ─── 鼠标事件处理 ───

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const screenPoint = getCanvasPoint(e);
    const hit = performHitTest(screenPoint);
    const store = useSimulationStore.getState();
    const canvas = canvasRef.current;
    const viewport = store.viewportState;
    const interactionHandler = rendererRegistry.getViewportInteraction(viewport.primary);

    if (hit) {
      if (hit.type !== 'entity' && interactionHandler) {
        interactionHandler.onHover(hit);
        if (canvas) canvas.style.cursor = interactionHandler.getCursor(hit);
      } else {
        interactionHandler?.onHover(null);
        if (canvas) canvas.style.cursor = 'pointer';
      }
      store.setHovered(hit);
    } else {
      interactionHandler?.onHover(null);
      store.setHovered(null);
      if (canvas) canvas.style.cursor = 'default';
    }
  }, [getCanvasPoint, performHitTest]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const screenPoint = getCanvasPoint(e);
    const hit = performHitTest(screenPoint);
    const store = useSimulationStore.getState();
    const viewport = store.viewportState;
    const interactionHandler = rendererRegistry.getViewportInteraction(viewport.primary);

    store.select(hit);
    interactionHandler?.onSelectionChange(hit);
  }, [getCanvasPoint, performHitTest]);

  const handleMouseLeave = useCallback(() => {
    const store = useSimulationStore.getState();
    const viewport = store.viewportState;
    const interactionHandler = rendererRegistry.getViewportInteraction(viewport.primary);

    store.setHovered(null);
    interactionHandler?.onHover(null);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'default';
  }, []);

  // ─── 浮动 UI（位置只在 selection 变化时计算一次，之后锁定） ───

  const selection = useSimulationStore((s) => s.selection);
  const viewport = useSimulationStore((s) => s.viewportState);

  // selection.id 变化时重新计算初始位置（useMemo 依赖 selection?.id）
  const selectionId = selection?.id ?? null;

  const popoverInitialPos = useMemo(() => {
    if (!selection) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    if (selection.type === 'force-arrow') {
      const handler = rendererRegistry.getViewportInteraction(
        useSimulationStore.getState().viewportState.primary,
      );
      if (!handler) return null;
      const descriptor = handler.getFloatingUI();
      if (!descriptor) return null;
      const anchor = descriptor.anchorScreenPos;
      const half = descriptor.anchorHalfSize;
      return pickPopoverPosition(
        anchor.x, anchor.y, 220, 100, cw, ch, 12,
        half?.w ?? 0, half?.h ?? 0, descriptor.preferredDirection,
      );
    }

    if (selection.type === 'entity' && getCoordinateTransform) {
      const entityId = (selection.data as { entityId: string }).entityId;
      const store = useSimulationStore.getState();
      const entity = store.simulationState.scene.entities.get(entityId);
      if (!entity) return null;
      const ct = getCoordinateTransform();
      const result = store.simulationState.currentResult;
      const motion = result?.motionStates.get(entityId);
      const entityPos = motion?.position ?? entity.transform.position;
      const entityH = (entity.properties.height as number) ?? 0;
      const rot = motion?.rotation ?? entity.transform.rotation ?? 0;
      const center = {
        x: entityPos.x + (-Math.sin(rot)) * (entityH / 2),
        y: entityPos.y + Math.cos(rot) * (entityH / 2),
      };
      const screenPos = worldToScreen(center, ct);
      const entityW = (entity.properties.width as number) ?? 0;
      const cosR = Math.abs(Math.cos(rot));
      const sinR = Math.abs(Math.sin(rot));
      const halfSW = (entityW * cosR + entityH * sinR) * ct.scale / 2;
      const halfSH = (entityW * sinR + entityH * cosR) * ct.scale / 2;
      return pickPopoverPosition(screenPos.x, screenPos.y, 220, 140, cw, ch, 12, halfSW, halfSH);
    }

    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionId]);

  let floatingUI: React.ReactNode = null;

  if (selection && popoverInitialPos) {
    if (selection.type === 'force-arrow') {
      const handler = rendererRegistry.getViewportInteraction(viewport.primary);
      const descriptor = handler?.getFloatingUI();
      if (descriptor) {
        const FloatingComp = rendererRegistry.getFloatingComponent(descriptor.componentType) as
          React.ComponentType<FloatingComponentProps> | undefined;
        if (FloatingComp) {
          floatingUI = (
            <DraggablePopover
              key={selectionId}
              initialLeft={popoverInitialPos.left}
              initialTop={popoverInitialPos.top}
            >
              <FloatingComp
                data={descriptor.data}
                onClose={() => useSimulationStore.getState().select(null)}
              />
            </DraggablePopover>
          );
        }
      }
    } else if (selection.type === 'entity') {
      const EntityComp = rendererRegistry.getFloatingComponent('entity-popover') as
        React.ComponentType<FloatingComponentProps> | undefined;
      if (EntityComp) {
        const entityId = (selection.data as { entityId: string }).entityId;
        floatingUI = (
          <DraggablePopover
            key={selectionId}
            initialLeft={popoverInitialPos.left}
            initialTop={popoverInitialPos.top}
          >
            <EntityComp
              data={{ entityId }}
              onClose={() => useSimulationStore.getState().select(null)}
            />
          </DraggablePopover>
        );
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      style={{ backgroundColor: '#FAFAFA' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />
      <ViewportBar />
      <MotionCharts />
      {floatingUI}
    </div>
  );
}
