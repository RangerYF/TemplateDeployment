import type {
  CoordinateTransform,
  Entity,
  EntityId,
  EntityType,
  PhysicsResult,
  RenderContext,
  Selection,
  Vec2,
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

// ─── 视角交互处理器 ───

/** 交互上下文 — 公共层传给 handler 的只读信息 */
export interface InteractionContext {
  selection: Selection | null;
  hoveredTarget: Selection | null;
  entities: Map<EntityId, Entity>;
  result: PhysicsResult | null;
  coordinateTransform: CoordinateTransform;
}

/** 浮动 UI 描述符 */
export interface FloatingUIDescriptor {
  /** 锚点屏幕坐标（菜单定位用） */
  anchorScreenPos: Vec2;
  /** 锚点区域半尺寸（popover 从此边缘外开始放置） */
  anchorHalfSize?: { w: number; h: number };
  /** 偏好方向：0=上 1=右 2=下 3=左（由域根据上下文决定） */
  preferredDirection?: 0 | 1 | 2 | 3;
  /** 组件类型标识（与 registerFloatingComponent 对应） */
  componentType: string;
  /** 传递给组件的数据（不透明，由 handler 和组件约定） */
  data: unknown;
}

/** 浮动组件的 Props 约定 */
export interface FloatingComponentProps {
  data: unknown;
  onClose: () => void;
}

/** 视角交互处理器 — 域代码实现并注册 */
export interface ViewportInteractionHandler {
  /** 视角元素的 hitTest（如力箭头、场线）。返回非 null 时，实体 hitTest 跳过。 */
  hitTest(
    screenPoint: Vec2,
    worldPoint: Vec2,
    context: InteractionContext,
  ): Selection | null;

  /** 命中时的 cursor 样式 */
  getCursor(selection: Selection): string;

  /** hover 状态变更回调。null 表示鼠标离开所有视角元素 */
  onHover(selection: Selection | null): void;

  /** 选中状态变更回调 */
  onSelectionChange(selection: Selection | null): void;

  /** 渲染交互视觉反馈（hover 高亮、选中效果等），在主视角渲染之后调用 */
  renderOverlay(ctx: RenderContext): void;

  /** 获取浮动 UI 描述符。null 表示无浮动 UI */
  getFloatingUI(): FloatingUIDescriptor | null;
}

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

  /** 注册视角交互处理器 */
  registerViewportInteraction(
    viewportType: ViewportType,
    handler: ViewportInteractionHandler,
  ): void;

  /** 获取视角交互处理器 */
  getViewportInteraction(
    viewportType: ViewportType,
  ): ViewportInteractionHandler | undefined;

  /** 注册浮动 UI 组件（React 组件） */
  registerFloatingComponent(
    componentType: string,
    component: React.ComponentType<FloatingComponentProps>,
  ): void;

  /** 获取浮动 UI 组件 */
  getFloatingComponent(
    componentType: string,
  ): React.ComponentType<FloatingComponentProps> | undefined;
}

// ─── RendererRegistry 实现 ───

export function createRendererRegistry(): IRendererRegistry {
  const entityRenderers = new Map<EntityType, EntityRendererRegistration>();
  const viewportRenderers = new Map<ViewportType, ViewportRenderer>();
  const viewportInteractions = new Map<ViewportType, ViewportInteractionHandler>();
  const floatingComponents = new Map<string, React.ComponentType<FloatingComponentProps>>();

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

    registerViewportInteraction(
      viewportType: ViewportType,
      handler: ViewportInteractionHandler,
    ): void {
      if (viewportInteractions.has(viewportType)) {
        console.warn(
          `[RendererRegistry] 视角交互处理器 "${viewportType}" 已注册，跳过重复注册`,
        );
        return;
      }
      viewportInteractions.set(viewportType, handler);
    },

    getViewportInteraction(
      viewportType: ViewportType,
    ): ViewportInteractionHandler | undefined {
      return viewportInteractions.get(viewportType);
    },

    registerFloatingComponent(
      componentType: string,
      component: React.ComponentType<FloatingComponentProps>,
    ): void {
      if (floatingComponents.has(componentType)) {
        console.warn(
          `[RendererRegistry] 浮动组件 "${componentType}" 已注册，跳过重复注册`,
        );
        return;
      }
      floatingComponents.set(componentType, component);
    },

    getFloatingComponent(
      componentType: string,
    ): React.ComponentType<FloatingComponentProps> | undefined {
      return floatingComponents.get(componentType);
    },
  };
}

/** 全局默认实例 */
export const rendererRegistry = createRendererRegistry();
