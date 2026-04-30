import type {
  Entity,
  EntityId,
  EntityType,
  PhysicsResult,
  RenderContext,
  ViewportData,
  ViewportType,
} from '../types';

// ─── 渲染层级（z-order） ───

export type RenderLayer =
  | 'background' // 背景层：网格、坐标轴
  | 'surface' // 表面层：斜面、水平面、导轨
  | 'field' // 场层：电场/磁场区域
  | 'object' // 物体层：物块、小球、导体棒
  | 'connector' // 连接件层：弹簧、绳、杆
  | 'overlay'; // 叠加层：力箭头、轨迹线、标注

const LAYER_ORDER: RenderLayer[] = [
  'background',
  'surface',
  'field',
  'object',
  'connector',
  'overlay',
];

// ─── 渲染器签名 ───

export type EntityRenderer = (
  entity: Entity,
  result: PhysicsResult | null,
  ctx: RenderContext,
) => void;

export type ViewportRenderer = (
  data: ViewportData,
  entities: Map<EntityId, Entity>,
  ctx: RenderContext,
) => void;

// ─── 实体渲染器注册信息 ───

export interface EntityRendererRegistration {
  entityType: EntityType;
  renderer: EntityRenderer;
  layer: RenderLayer;
}

// ─── RendererRegistry API ───

export interface IRendererRegistry {
  registerEntity(config: EntityRendererRegistration): void;
  registerViewport(
    viewportType: ViewportType,
    renderer: ViewportRenderer,
  ): void;
  getEntityRenderer(
    entityType: EntityType,
  ): EntityRendererRegistration | undefined;
  getViewportRenderer(viewportType: ViewportType): ViewportRenderer | undefined;
  getEntityRenderersSorted(): EntityRendererRegistration[];
}

// ─── RendererRegistry 实现 ───

export function createRendererRegistry(): IRendererRegistry {
  const entityRenderers = new Map<EntityType, EntityRendererRegistration>();
  const viewportRenderers = new Map<ViewportType, ViewportRenderer>();

  return {
    registerEntity(config: EntityRendererRegistration): void {
      if (entityRenderers.has(config.entityType)) {
        console.warn(
          `[RendererRegistry] 实体渲染器 "${config.entityType}" 已注册，跳过重复注册`,
        );
        return;
      }
      entityRenderers.set(config.entityType, config);
    },

    registerViewport(
      viewportType: ViewportType,
      renderer: ViewportRenderer,
    ): void {
      if (viewportRenderers.has(viewportType)) {
        console.warn(
          `[RendererRegistry] 视角渲染器 "${viewportType}" 已注册，跳过重复注册`,
        );
        return;
      }
      viewportRenderers.set(viewportType, renderer);
    },

    getEntityRenderer(
      entityType: EntityType,
    ): EntityRendererRegistration | undefined {
      return entityRenderers.get(entityType);
    },

    getViewportRenderer(
      viewportType: ViewportType,
    ): ViewportRenderer | undefined {
      return viewportRenderers.get(viewportType);
    },

    getEntityRenderersSorted(): EntityRendererRegistration[] {
      const all = Array.from(entityRenderers.values());
      return all.sort(
        (a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer),
      );
    },
  };
}

/** 全局默认实例 */
export const rendererRegistry = createRendererRegistry();
