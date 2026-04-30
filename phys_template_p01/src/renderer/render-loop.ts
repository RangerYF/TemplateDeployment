import type {
  CoordinateTransform,
  Entity,
  EntityId,
  PhysicsResult,
  Rect,
  RenderContext,
  ViewportData,
  ViewportState,
  ViewportType,
} from '@/core/types';
import {
  rendererRegistry,
  type RenderLayer,
} from '@/core/registries';
import { isSourcePointCharge } from '@/domains/em/logic/point-charge-role';
import { worldToScreen, worldLengthToScreen } from './coordinate';

/**
 * 渲染循环管理器
 *
 * 按 RenderLayer 枚举顺序绘制实体，处理选中高亮和叠加层透明度。
 * 阶段5只提供骨架，具体渲染器由域注册后生效。
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
  getSelectedEntityId: () => EntityId | null;
  getCoordinateTransform: () => CoordinateTransform;
  /** 每帧渲染前回调（用于驱动 simulator.step） */
  onFrame?: (dt: number) => void;
  /** 获取连线关系列表（builder 模式用） */
  getRelations?: () => import('@/core/types').Relation[];
  /** 自定义连线渲染（builder 模式用） */
  onRenderWires?: (
    ctx: CanvasRenderingContext2D,
    entities: Map<EntityId, Entity>,
    relations: import('@/core/types').Relation[],
    transform: CoordinateTransform,
  ) => void;
}

export function createRenderLoop(options: RenderLoopOptions) {
  let rafId: number | null = null;
  let lastTime = 0;
  const reportedErrors = new Set<string>();

  function reportRenderError(scope: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const key = `${scope}:${message}`;
    if (reportedErrors.has(key)) return;
    reportedErrors.add(key);
    console.error(`[RenderLoop] ${scope} 渲染失败:`, error);
  }

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
    const selectedEntityId = options.getSelectedEntityId();
    const coordinateTransform = options.getCoordinateTransform();
    const relations = options.getRelations?.();

    const renderCtx: RenderContext = {
      ctx,
      canvas,
      coordinateTransform,
      viewport,
      selectedEntityId,
      relations,
      dt,
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
            try {
              ctx.save();
              reg.renderer(entity, result, renderCtx);
            } catch (error) {
              reportRenderError(`entity:${reg.entityType}`, error);
            } finally {
              ctx.restore();
            }

            // 选中高亮
            if (entity.id === selectedEntityId) {
              drawSelectionHighlight(ctx, entity, coordinateTransform);
            }
          }
        }
      }
    }

    // 主视角渲染
    const primaryRenderer = rendererRegistry.getViewportRenderer(viewport.primary);
    if (primaryRenderer) {
      // field/circuit 视角不依赖 result，允许 result 为 null
      const viewportData = result
        ? extractViewportData(viewport.primary, result, entities)
        : extractViewportDataWithoutResult(viewport.primary, entities);
      if (viewportData) {
        try {
          ctx.save();
          ctx.globalAlpha = 1;
          primaryRenderer(viewportData, entities, renderCtx);
        } catch (error) {
          reportRenderError(`viewport:${viewport.primary}`, error);
        } finally {
          ctx.restore();
        }
      }
    }

    // 叠加视角渲染（globalAlpha = 0.3）
    for (const overlayType of viewport.overlays) {
      const overlayRenderer = rendererRegistry.getViewportRenderer(overlayType as ViewportType);
      if (overlayRenderer) {
        const viewportData = result
          ? extractViewportData(overlayType as ViewportType, result, entities)
          : extractViewportDataWithoutResult(overlayType as ViewportType, entities);
        if (viewportData) {
          try {
            ctx.save();
            ctx.globalAlpha = 0.3;
            overlayRenderer(viewportData, entities, renderCtx);
          } catch (error) {
            reportRenderError(`overlay:${overlayType}`, error);
          } finally {
            ctx.restore();
          }
        }
      }
    }

    // 连线渲染（builder 模式）
    if (options.onRenderWires && relations) {
      try {
        ctx.save();
        options.onRenderWires(ctx, entities, relations, coordinateTransform);
      } catch (error) {
        reportRenderError('builder-wires', error);
      } finally {
        ctx.restore();
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
 * 无 PhysicsResult 时提取视角数据（仅 field/circuit 等不依赖求解结果的视角）
 */
function extractViewportDataWithoutResult(
  type: ViewportType,
  entities?: Map<EntityId, Entity>,
): ViewportData | null {
  switch (type) {
    case 'field':
      return extractFieldViewportData(entities);
    case 'circuit':
      return extractCircuitViewportData(entities);
    default:
      return null;
  }
}

/**
 * 从 PhysicsResult（及 scene entities）中提取指定视角类型所需的数据
 */
function extractViewportData(
  type: ViewportType,
  result: PhysicsResult,
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
          analyses: Array.from(result.forceAnalyses.values()),
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

  // 即使没有匀强场实体，场景中有 point-charge 时仍需返回数据
  // （field-viewport 内部检测 point-charge 并绘制电场线/等势线）
  if (fieldEntities.length === 0) {
    let hasPointCharge = false;
    for (const entity of entities.values()) {
      if (isSourcePointCharge(entity)) { hasPointCharge = true; break; }
    }
    if (!hasPointCharge) return null;
  }

  return {
    type: 'field',
    data: { fieldEntities },
  };
}

/**
 * 选中实体的高亮描边（根据实体几何形状适配）
 */
function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  coordinateTransform: CoordinateTransform,
): void {
  const { position } = entity.transform;
  const radius = entity.properties.radius as number | undefined;
  const width = entity.properties.width as number | undefined;
  const height = entity.properties.height as number | undefined;

  ctx.save();
  ctx.strokeStyle = '#00C06B';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  if (radius != null) {
    // 圆形实体（仪表类）：position 是圆心
    const center = worldToScreen(position, coordinateTransform);
    const screenR = worldLengthToScreen(radius, coordinateTransform) + 6;
    ctx.beginPath();
    ctx.arc(center.x, center.y, screenR, 0, Math.PI * 2);
    ctx.stroke();
  } else if (width != null && height != null) {
    // 矩形实体：position 是左下角
    const topLeft = worldToScreen(
      { x: position.x - 0.05, y: position.y + height + 0.05 },
      coordinateTransform,
    );
    const w = worldLengthToScreen(width + 0.1, coordinateTransform);
    const h = worldLengthToScreen(height + 0.1, coordinateTransform);
    ctx.strokeRect(topLeft.x, topLeft.y, w, h);
  } else {
    // 兜底
    const center = worldToScreen(position, coordinateTransform);
    ctx.beginPath();
    ctx.arc(center.x, center.y, 25, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
