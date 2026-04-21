import type {
  CoordinateTransform,
  Entity,
  EntityId,
  PhysicsResult,
  Rect,
  RenderContext,
  Selection,
  ViewportData,
  ViewportState,
  ViewportType,
} from '@/core/types';
import {
  entityRegistry,
  rendererRegistry,
  type RenderLayer,
} from '@/core/registries';
import { worldToScreen } from '@/renderer/coordinate';

/**
 * 渲染循环管理器
 *
 * 按 RenderLayer 枚举顺序绘制实体，处理选中高亮和叠加层透明度。
 */

const LAYER_ORDER: RenderLayer[] = [
  'background',
  'surface',
  'field',
  'object',
  'connector',
  'overlay',
];

export interface RenderLoopOptions {
  canvas: HTMLCanvasElement;
  getEntities: () => Map<EntityId, Entity>;
  getResult: () => PhysicsResult | null;
  getViewport: () => ViewportState;
  getSelection: () => Selection | null;
  getHoveredTarget: () => Selection | null;
  getCoordinateTransform: () => CoordinateTransform;
  /** 获取历史结果（运动视角图表需要） */
  getResultHistory?: () => PhysicsResult[];
  /** 每帧渲染前回调（用于驱动 simulator.step） */
  onFrame?: (dt: number) => void;
}

/** 从 Selection 中提取 entityId */
function selectionToEntityId(selection: Selection | null): EntityId | null {
  if (!selection) return null;
  if (selection.type === 'entity') {
    return (selection.data as { entityId: EntityId }).entityId;
  }
  const data = selection.data as { entityId?: EntityId };
  return data?.entityId ?? null;
}

export function createRenderLoop(options: RenderLoopOptions) {
  let rafId: number | null = null;
  let lastTime = 0;

  function render(timestamp: number): void {
    const dt = lastTime === 0 ? 0 : (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // 渲染前回调（驱动物理模拟）
    if (dt > 0) {
      options.onFrame?.(dt);
    }

    const { canvas } = options;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const entities = options.getEntities();
    const result = options.getResult();
    const viewport = options.getViewport();
    const selection = options.getSelection();
    const hoveredTarget = options.getHoveredTarget();
    const selectedEntityId = selectionToEntityId(selection);
    const coordinateTransform = options.getCoordinateTransform();

    const renderCtx: RenderContext = {
      ctx,
      canvas,
      coordinateTransform,
      viewport,
      selectedEntityId,
      selection,
      hoveredTarget,
      dt,
      entities,
    };

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 用 MotionState 临时更新实体的位置和旋转（运动中实体跟随物理计算）
    const savedTransforms = new Map<EntityId, { x: number; y: number; rotation: number }>();
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

    // 按层级顺序绘制实体
    const sortedRenderers = rendererRegistry.getEntityRenderersSorted();

    for (const layer of LAYER_ORDER) {
      const layerRenderers = sortedRenderers.filter((r) => r.layer === layer);
      for (const reg of layerRenderers) {
        for (const entity of entities.values()) {
          if (entity.type === reg.entityType) {
            ctx.save();
            reg.renderer(entity, result, renderCtx);
            ctx.restore();

            // 实体 hover 高亮
            if (
              hoveredTarget?.type === 'entity' &&
              (hoveredTarget.data as { entityId: string }).entityId === entity.id &&
              selectedEntityId !== entity.id
            ) {
              drawEntityHoverHighlight(ctx, entity, coordinateTransform);
            }

            // 实体选中高亮（仅 selection.type === 'entity' 时绘制）
            if (
              selection?.type === 'entity' &&
              (selection.data as { entityId: string }).entityId === entity.id
            ) {
              drawEntitySelectionHighlight(ctx, entity, coordinateTransform);
            }
          }
        }
      }
    }

    // 主视角渲染
    const primaryRenderer = rendererRegistry.getViewportRenderer(viewport.primary);
    if (primaryRenderer && result) {
      const resultHistory = options.getResultHistory?.();
      const viewportData = extractViewportData(viewport.primary, result, resultHistory, entities);
      if (viewportData) {
        ctx.save();
        ctx.globalAlpha = 1;
        primaryRenderer(viewportData, entities, renderCtx);
        ctx.restore();
      }
    }

    // 交互 overlay（在主视角渲染之后调用）
    const interactionHandler = rendererRegistry.getViewportInteraction(viewport.primary);
    if (interactionHandler) {
      ctx.save();
      interactionHandler.renderOverlay(renderCtx);
      ctx.restore();
    }

    // 叠加视角渲染（globalAlpha = 0.3）
    for (const overlayType of viewport.overlays) {
      const overlayRenderer = rendererRegistry.getViewportRenderer(overlayType as ViewportType);
      if (overlayRenderer && result) {
        const viewportData = extractViewportData(overlayType as ViewportType, result, undefined, entities);
        if (viewportData) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          overlayRenderer(viewportData, entities, renderCtx);
          ctx.restore();
        }
      }
    }

    // 恢复实体原始 transform（不污染 scene 数据）
    for (const [entityId, saved] of savedTransforms) {
      const entity = entities.get(entityId);
      if (entity) {
        entity.transform.position = { x: saved.x, y: saved.y };
        entity.transform.rotation = saved.rotation;
      }
    }

    rafId = requestAnimationFrame(render);
  }

  return {
    start(): void {
      if (rafId !== null) return;
      lastTime = 0;
      rafId = requestAnimationFrame(render);
    },

    stop(): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
        lastTime = 0;
      }
    },

    isRunning(): boolean {
      return rafId !== null;
    },
  };
}

/**
 * 从 PhysicsResult（及 scene entities）中提取指定视角类型所需的数据
 */
function extractViewportData(
  type: ViewportType,
  result: PhysicsResult,
  resultHistory?: PhysicsResult[],
  entities?: Map<EntityId, Entity>,
): ViewportData | null {
  switch (type) {
    case 'force':
      return {
        type: 'force',
        data: { analyses: Array.from(result.forceAnalyses.values()) },
      };
    case 'motion':
      return {
        type: 'motion',
        data: {
          motionStates: Array.from(result.motionStates.values()),
          currentTime: result.time,
          history: resultHistory?.map((r) => ({
            time: r.time,
            states: Array.from(r.motionStates.values()).map((m) => ({
              entityId: m.entityId,
              position: { ...m.position },
              velocity: { ...m.velocity },
              acceleration: { ...m.acceleration },
            })),
          })),
        },
      };
    case 'energy':
      return result.energyStates
        ? {
            type: 'energy',
            data: {
              energyStates: Array.from(result.energyStates.values()),
            },
          }
        : null;
    case 'field':
      return extractFieldViewportData(entities);
    case 'circuit':
      return extractCircuitViewportData(entities);
    default:
      return null;
  }
}

/**
 * 从 scene entities 中提取 circuit 视角数据
 * 电路视角数据来源于 wire-frame 实体的运行时 properties（emf/current）
 */
function extractCircuitViewportData(
  entities?: Map<EntityId, Entity>,
): ViewportData | null {
  if (!entities) return null;

  // 查找场景中的 wire-frame 实体
  let emf: number | undefined;
  let current: number | undefined;

  for (const entity of entities.values()) {
    if (entity.type === 'wire-frame') {
      emf = (entity.properties.emf as number) ?? 0;
      current = (entity.properties.current as number) ?? 0;
      break; // Phase 1 只支持单个线框
    }
  }

  // 即使没有线框也返回数据（渲染器自行判断）
  return {
    type: 'circuit',
    data: {
      emf,
      current,
    },
  };
}

/**
 * 从 scene entities 中提取 field 视角数据
 * field 视角数据来源于 scene 中 category='field' 的实体属性，而非求解器输出
 */
function extractFieldViewportData(
  entities?: Map<EntityId, Entity>,
): ViewportData | null {
  if (!entities) return null;

  const fieldEntities: Array<{
    entityId: EntityId;
    fieldType: string;
    region: Rect;
    direction: { x: number; y: number };
    magnitude: number;
  }> = [];

  for (const entity of entities.values()) {
    if (entity.category !== 'field') continue;

    const pos = entity.transform.position;
    const width = (entity.properties.width as number) ?? 0;
    const height = (entity.properties.height as number) ?? 0;
    const magnitude = (entity.properties.magnitude as number) ?? 0;

    // 根据实体类型推断 fieldType
    let fieldType = 'unknown';
    if (entity.type === 'uniform-bfield') {
      fieldType = 'magnetic';
    } else if (entity.type === 'uniform-efield') {
      fieldType = 'electric';
    }

    // 场方向：磁场用 (0,0) 表示垂直纸面，电场用 direction 向量
    const direction = (entity.properties.direction as { x: number; y: number }) ?? { x: 0, y: 0 };
    const directionVec = typeof direction === 'string'
      ? { x: 0, y: 0 }  // 磁场 'into'/'out' 在 2D 平面无方向向量
      : direction;

    fieldEntities.push({
      entityId: entity.id,
      fieldType,
      region: { x: pos.x, y: pos.y, width, height },
      direction: directionVec,
      magnitude,
    });
  }

  if (fieldEntities.length === 0) return null;

  return {
    type: 'field',
    data: { fieldEntities },
  };
}

/**
 * 实体 hover 高亮 — 发光描边
 */
function drawEntityHoverHighlight(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  coordinateTransform: CoordinateTransform,
): void {
  drawEntityBorder(ctx, entity, coordinateTransform, {
    strokeStyle: 'rgba(59, 130, 246, 0.5)',
    lineWidth: 2,
    lineDash: [],
    shadowColor: 'rgba(59, 130, 246, 0.6)',
    shadowBlur: 6,
  });
}

/**
 * 实体选中高亮 — 强发光描边
 */
function drawEntitySelectionHighlight(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  coordinateTransform: CoordinateTransform,
): void {
  drawEntityBorder(ctx, entity, coordinateTransform, {
    strokeStyle: 'rgba(59, 130, 246, 0.8)',
    lineWidth: 2.5,
    lineDash: [],
    shadowColor: 'rgba(59, 130, 246, 0.8)',
    shadowBlur: 10,
  });
}

/**
 * 绘制实体边框（通过实体注册的 drawOutline 绘制轮廓路径，统一描边）
 */
function drawEntityBorder(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  coordinateTransform: CoordinateTransform,
  style: { strokeStyle: string; lineWidth: number; lineDash: number[]; shadowColor?: string; shadowBlur?: number },
): void {
  const reg = entityRegistry.get(entity.type);

  ctx.save();
  ctx.strokeStyle = style.strokeStyle;
  ctx.lineWidth = style.lineWidth;
  ctx.setLineDash(style.lineDash);
  if (style.shadowColor) ctx.shadowColor = style.shadowColor;
  if (style.shadowBlur) ctx.shadowBlur = style.shadowBlur;

  if (reg?.drawOutline) {
    reg.drawOutline(entity, ctx, coordinateTransform);
    ctx.stroke();
  } else {
    // fallback：圆环
    const pos = entity.transform.position;
    const screen = worldToScreen(pos, coordinateTransform);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
