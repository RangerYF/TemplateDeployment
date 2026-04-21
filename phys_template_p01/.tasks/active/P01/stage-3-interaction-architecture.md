# 阶段3：交互架构方案

> 状态：**方案已确认** — 2026-03-19 评审通过，进入实施阶段

## 1. 问题陈述

当前阶段3规划将大量力学业务逻辑写入公共代码，违反项目的注册机制设计原则：

| 问题项 | 当前规划位置 | 为什么不对 |
|--------|-------------|-----------|
| `hoveredForceIndex` / `selectedForceIndex` / `decompositionTarget` | 公共 `simulation-store.ts` | 力箭头交互是力学域概念，电磁域有场线交互，两者不应共用同一套状态字段 |
| 力箭头 hitTest 逻辑 | 公共 `CanvasContainer.tsx` | 力箭头是力学域的视角元素，未来电磁域有场线/电荷交互 |
| 力箭头 hover 加粗/发光 | 公共 `render-loop.ts` | 视觉效果绑定力学业务，不同域有不同的交互反馈 |
| `ForcePopover.tsx` | 公共 `shell/components/` | 纯力学业务组件，电磁域不需要 |

**根本矛盾**：项目已有成熟的四层注册系统（实体 / 求解器 / 渲染器 / 预设），但交互层要绕过这个模式把业务硬编码到公共层。

## 2. 设计原则

1. **公共层只提供机制，不包含业务** — 与实体/求解器/渲染器注册模式一致
2. **域代码注册自己的交互处理器** — 力学域注册力箭头交互，电磁域注册场线交互
3. **域特有状态留在域内** — 公共 store 只保留通用选中/hover 状态
4. **统一选中模型** — 画布上永远只有一个选中目标（实体、力箭头、场线……），互斥选中
5. **扩展已有注册接口，不新增注册器** — 视角交互是视角渲染的伴生物，附加在 renderer-registry 上
6. **不需要 SelectionManager / PropertyPanel 模块** — 我们不是通用编辑器，选中只为查看信息和触发分解，不涉及拖拽/缩放/删除

## 3. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│  CanvasContainer.tsx（公共）                              │
│  职责：捕获鼠标事件 → 坐标转换 → 分发到注册处理器链       │
│  ① viewport interaction hitTest（优先）→ 力箭头等视角元素  │
│  ② entity hitTest（其次）→ 实体本身                       │
│  ③ 空白 → 清除所有选中                                    │
│  结果统一写入 store.selection                              │
└─────────────────┬───────────────────────────────────────┘
                  │ 调用
                  ▼
┌─────────────────────────────────────────────────────────┐
│  renderer-registry.ts（公共，扩展）                       │
│  新增：registerViewportInteraction(type, handler)        │
│  新增：registerFloatingComponent(type, Component)        │
└─────────────────┬───────────────────────────────────────┘
                  │ 域代码注册
                  ▼
┌──────────────────────────────────┬──────────────────────┐
│  力学域                          │  电磁域（未来）       │
│  force-interaction-handler.ts    │  field-interaction... │
│  ForcePopover.tsx                │  FieldTooltip...      │
│  域内状态：decompositionTarget   │  域内状态：...        │
│  等分解相关状态                   │                      │
└──────────────────────────────────┴──────────────────────┘
```

## 4. 核心设计：统一选中模型

### 4.1 设计动机

画布上可交互的目标是一个统一的池子：实体（物块、斜面）、力箭头、未来的场线等。它们之间是**互斥选中**关系，任何时刻只有一个选中目标。

不需要"先选中实体再选中力"的两级选中。老师直接点击力箭头就是选中了力箭头，点击物块就是选中了物块。这样更自然，操作步骤也更少。

### 4.2 数据模型

替换现有的 `selectedEntityId: EntityId | null`：

```typescript
/** 统一选中目标 */
export interface Selection {
  /** 选中目标类型（'entity' | 域自定义类型如 'force-arrow'） */
  type: string;
  /** 唯一标识 */
  id: string;
  /** 类型特定数据（不透明，由域定义和解读） */
  data: unknown;
}
```

Store 中：

```typescript
// 替换 selectedEntityId
selection: Selection | null;

// 替换 selectEntity
select(target: Selection | null): void;
```

### 4.3 互斥规则

| 操作 | 结果 |
|------|------|
| 点击力箭头 G | `selection = { type: 'force-arrow', id: 'entity-1/0', data: { entityId, forceIndex } }` |
| 点击物块 | `selection = { type: 'entity', id: 'entity-1', data: { entityId } }` |
| 点击另一个力 N | `selection` 切换到 N，旧选中自动清除 |
| 点击空白 | `selection = null` |

**永远只有一个选中目标**，不存在"选中了 A 的力但实体选中状态是 B"的矛盾态。

### 4.4 向后兼容

现有代码通过 `selectedEntityId` 读取选中实体。迁移策略：

```typescript
// 便捷 getter（从 selection 派生）
get selectedEntityId(): EntityId | null {
  if (!this.selection) return null;
  if (this.selection.type === 'entity') return (this.selection.data as { entityId: EntityId }).entityId;
  // force-arrow 选中时也能返回关联的 entityId（如果 handler 在 data 中提供了）
  const data = this.selection.data as { entityId?: EntityId };
  return data?.entityId ?? null;
}
```

这样 InfoPanel 等依赖 `selectedEntityId` 的已有代码不需要改。

### 4.5 为什么不需要 SelectionManager / PropertyPanel

| 通用编辑器需要 | 我们不需要的原因 |
|---------------|-----------------|
| SelectionManager（多选、框选） | Phase 1 只支持单选，一个 `selection` 字段足够 |
| PropertyPanel（选中什么显示什么的属性编辑） | 实体属性 → 已有 ParamPanel（schema 驱动）；力信息 → ForcePopover（域内组件）。两者 UI 差异大，走同一套 property schema 反而是强行统一 |
| TransformGizmo（拖拽/缩放手柄） | Phase 1 不可移动实体 |
| HitTestPipeline（z-order 遍历） | 已有 entity-registry.hitTest + 新增 interaction handler，够用 |

## 5. 公共层接口设计

### 5.1 ViewportInteractionHandler 接口

在 `renderer-registry.ts` 中追加（只追加不改已有）：

```typescript
/** 视角交互处理器 — 域代码实现并注册 */
export interface ViewportInteractionHandler {
  /**
   * 视角元素的 hitTest（如力箭头、场线）
   * 在实体 hitTest 之前调用。返回非 null 时，实体 hitTest 跳过。
   *
   * @returns 命中结果（包含 Selection），null 表示未命中
   */
  hitTest(
    screenPoint: Vec2,
    worldPoint: Vec2,
    context: InteractionContext,
  ): Selection | null;

  /**
   * 命中时的 cursor 样式
   */
  getCursor(selection: Selection): string;

  /**
   * hover 状态变更回调
   * handler 内部维护自己的 hover 状态
   * @param selection — null 表示鼠标离开所有视角元素
   */
  onHover(selection: Selection | null): void;

  /**
   * 选中状态变更回调
   * 当 store.selection 变化且 type 属于本 handler 时调用
   */
  onSelectionChange(selection: Selection | null): void;

  /**
   * 渲染交互视觉反馈（hover 高亮、选中效果等）
   * 在主视角渲染之后调用，绘制在最上层
   */
  renderOverlay(ctx: RenderContext): void;

  /**
   * 获取浮动 UI 描述符（弹出菜单、tooltips 等）
   * CanvasContainer 每帧读取，有值时渲染对应的已注册 React 组件
   * @returns null 表示无浮动 UI
   */
  getFloatingUI(): FloatingUIDescriptor | null;
}

/** 浮动 UI 描述符 */
export interface FloatingUIDescriptor {
  /** 锚点屏幕坐标（菜单定位用） */
  anchorScreenPos: Vec2;
  /** 组件类型标识（与 registerFloatingComponent 对应） */
  componentType: string;
  /** 传递给组件的数据（不透明，由 handler 和组件约定） */
  data: unknown;
}

/** 交互上下文 — 公共层传给 handler 的只读信息 */
export interface InteractionContext {
  selection: Selection | null;
  hoveredTarget: Selection | null;
  entities: Map<EntityId, Entity>;
  result: PhysicsResult | null;
  coordinateTransform: CoordinateTransform;
}
```

### 5.2 Registry 扩展

在 `IRendererRegistry` 中追加（不改已有）：

```typescript
export interface IRendererRegistry {
  // ... 已有方法不变 ...

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

/** 浮动组件的 Props 约定 */
export interface FloatingComponentProps {
  data: unknown;
  onClose: () => void;
}
```

### 5.3 Store 变更

**替换**（非追加）：

```typescript
// 替换 selectedEntityId: EntityId | null
selection: Selection | null;
hoveredTarget: Selection | null;  // 新增

// 替换 selectEntity(id)
select(target: Selection | null): void;
setHovered(target: Selection | null): void;  // 新增

// 向后兼容 getter（派生）
get selectedEntityId(): EntityId | null;  // 从 selection 中提取
```

**不在公共 store 中添加**：
- ~~hoveredForceIndex~~ → 力学域内部状态
- ~~selectedForceIndex~~ → 已统一到 selection
- ~~decompositionTarget~~ → 力学域内部状态

### 5.4 render-loop 扩展

在现有渲染循环中追加一个钩子点：

```typescript
// 在主视角渲染之后、叠加视角渲染之前，调用交互 overlay
const interactionHandler = rendererRegistry.getViewportInteraction(viewport.primary);
if (interactionHandler) {
  ctx.save();
  interactionHandler.renderOverlay(renderCtx);
  ctx.restore();
}
```

同时改进 `drawSelectionHighlight`：
- 从固定 20px 圆环 → 读取实体的 `width/height` 绘制贴合边框
- 只在 `selection.type === 'entity'` 时绘制（选中力箭头时不画实体边框）

hover 高亮同理：只在 `hoveredTarget.type === 'entity'` 时绘制实体 hover 效果。

### 5.5 CanvasContainer 事件分发

```
onMouseMove(e):
  1. 屏幕坐标 → Canvas 坐标（考虑 DPR）→ 物理坐标
  2. 视角 handler hitTest（优先级最高）：
     result = handler.hitTest(screenPoint, worldPoint, context)
     if (result) → handler.onHover(result) → cursor = handler.getCursor(result) → return
  3. 实体 hitTest：
     entityHit = entityRegistry 遍历
     if (entityHit) → store.setHovered({ type:'entity', ... }) → cursor = 'pointer' → return
  4. 空白 → store.setHovered(null) → handler.onHover(null) → cursor = 'default'

onClick(e):
  1. 坐标转换（同上）
  2. 视角 handler hitTest（优先级最高）：
     result = handler.hitTest(...)
     if (result) → store.select(result) → handler.onSelectionChange(result) → return
  3. 实体 hitTest：
     entityHit → store.select({ type:'entity', id:entityId, data:{ entityId } })
  4. 空白 → store.select(null) → handler.onSelectionChange(null)

onMouseLeave:
  store.setHovered(null)
  handler?.onHover(null)
```

**关键点**：力箭头直接可点击，不需要先选中实体。点击力箭头直接 `store.select({ type: 'force-arrow', ... })`。

浮动 UI 渲染：

```tsx
// CanvasContainer 内
const floatingUI = interactionHandler?.getFloatingUI();
if (floatingUI) {
  const FloatingComponent = rendererRegistry.getFloatingComponent(floatingUI.componentType);
  if (FloatingComponent) {
    return <FloatingComponent data={floatingUI.data} onClose={() => store.select(null)} />;
  }
}
```

### 5.6 types.ts 扩展

新增 `Selection` 接口 + 对 `OrthogonalDecomposition` 追加可选字段（只追加不改）：

```typescript
/** 统一选中目标（新增） */
export interface Selection {
  type: string;
  id: string;
  data: unknown;
}

/** 正交分解结果（追加可选字段） */
export interface OrthogonalDecomposition {
  axis1: Vec2;
  axis2: Vec2;
  axis1Label?: string;      // 新增：如 "沿斜面"
  axis2Label?: string;      // 新增：如 "垂直斜面"
  components: Array<{
    force: Force;
    component1: number;
    component2: number;
    label1?: string;         // 新增：如 "mgsinθ"
    label2?: string;         // 新增：如 "mgcosθ"
  }>;
}
```

## 6. 域代码设计（力学域）

### 6.1 目录结构

```
src/domains/mechanics/
├── interactions/                       # 新增目录
│   ├── force-interaction-handler.ts    # ViewportInteractionHandler 实现
│   └── force-interaction-state.ts      # 域内交互状态（分解相关）
├── components/                         # 新增目录
│   └── ForcePopover.tsx                # 力浮动菜单（域内组件）
├── viewports/
│   └── force-viewport.ts              # 修改：力箭头缓存 + 读取交互状态渲染
├── solvers/
│   └── block-on-slope.ts              # 修改：分解数据标签增强
└── index.ts                           # 修改：注册交互 handler + 浮动组件
```

### 6.2 force-interaction-state.ts（域内状态）

```typescript
/**
 * 力学域交互状态 — 模块级变量，不进公共 store
 * 管理正交分解相关状态（选中哪个力、分解动画进度等）
 *
 * 注意：选中和 hover 状态已统一到公共 store.selection / store.hoveredTarget
 * 这里只存分解相关的域内业务状态
 */

export interface ForceInteractionState {
  /** 正交分解目标 */
  decompositionTarget: {
    entityId: EntityId;
    forceIndex: number;
    progress: number;         // 动画进度 0~1
    direction: 'in' | 'out';
  } | null;
}

// 模块级单例
let state: ForceInteractionState = {
  decompositionTarget: null,
};

export function getForceInteractionState(): Readonly<ForceInteractionState> {
  return state;
}

export function setDecompositionTarget(...): void { ... }
export function updateDecompositionProgress(dt: number): void { ... }
export function resetForceInteraction(): void { ... }
```

### 6.3 force-interaction-handler.ts（核心）

实现 `ViewportInteractionHandler` 接口，注册到 renderer-registry：

```typescript
const forceInteractionHandler: ViewportInteractionHandler = {
  hitTest(screenPoint, worldPoint, context) {
    // 直接检测所有力箭头，无需先选中实体
    return getForceArrowAtPoint(screenPoint);
    // 返回 Selection: { type: 'force-arrow', id: `${entityId}/${forceIndex}`, data: { entityId, forceIndex, force } }
  },

  getCursor(selection) {
    return 'pointer';
  },

  onHover(selection) {
    // handler 内部可缓存 hover 的力箭头信息，供 renderOverlay 使用
  },

  onSelectionChange(selection) {
    // 选中变化时：
    // - 如果选中了力箭头 → 准备 ForcePopover 数据
    // - 如果选中了其他东西或 null → 清除分解状态
    if (!selection || selection.type !== 'force-arrow') {
      resetForceInteraction();
    }
  },

  renderOverlay(ctx) {
    // 1. hover 的力箭头画加粗/发光
    // 2. 选中的力箭头保持加粗，其他力降低透明度
    // 3. 正交分解的分量箭头 + 引导线 + 动画
  },

  getFloatingUI() {
    // 从公共 store 读取 selection
    const selection = useSimulationStore.getState().selection;
    if (!selection || selection.type !== 'force-arrow') return null;

    const { entityId, forceIndex } = selection.data as { entityId: EntityId; forceIndex: number };
    return {
      anchorScreenPos: getForceArrowTip(entityId, forceIndex),
      componentType: 'force-popover',
      data: { entityId, forceIndex, /* 分解状态等 */ },
    };
  },
};
```

### 6.4 force-viewport.ts 修改

核心修改：**增加力箭头屏幕坐标缓存**，供 hitTest 读取：

```typescript
// 模块级缓存，每帧渲染时更新
let cachedForceArrows: Array<{
  entityId: EntityId;
  forceIndex: number;
  screenFrom: Vec2;
  screenTo: Vec2;
  force: Force;
}> = [];

// 导出查询函数（供 force-interaction-handler 调用）
export function getForceArrowAtPoint(screenPoint: Vec2):
  Selection | null {
  // 遍历 cachedForceArrows，检测 screenPoint 是否在某个箭头的 ±8px 矩形内
  // 返回 { type: 'force-arrow', id: `${entityId}/${forceIndex}`, data: { entityId, forceIndex, force } }
}

export function getForceArrowTip(entityId: EntityId, forceIndex: number): Vec2 {
  // 从缓存中查找并返回箭头终点屏幕坐标
}
```

### 6.5 ForcePopover.tsx（域内组件）

放在 `domains/mechanics/components/` 而非公共 `shell/components/`。

### 6.6 注册入口

在 `domains/mechanics/index.ts` 中追加：

```typescript
export function registerMechanicsDomain(): void {
  // ... 已有注册 ...

  // 交互
  registerForceInteraction();      // → rendererRegistry.registerViewportInteraction('force', handler)
  registerForcePopoverComponent(); // → rendererRegistry.registerFloatingComponent('force-popover', ForcePopover)
}
```

## 7. 公共代码变更清单

| 文件 | 变更类型 | 变更内容 | 影响评估 |
|------|---------|---------|---------|
| `src/core/types.ts` | 追加 | 新增 `Selection` 接口 + `OrthogonalDecomposition` 追加可选字段 | 纯追加 |
| `src/core/registries/renderer-registry.ts` | 追加 | 新增 `ViewportInteractionHandler` 接口 + 2 个注册/获取方法 | 纯追加，不改已有代码 |
| `src/core/registries/index.ts` | 追加 | 导出新增类型 | 纯追加 |
| `src/store/simulation-store.ts` | 修改 | `selectedEntityId` → `selection: Selection \| null` + 新增 `hoveredTarget` + 向后兼容 getter | 语义升级 |
| `src/shell/canvas/CanvasContainer.tsx` | 修改 | 新增鼠标事件 → 坐标转换 → 分发到注册 handler | 公共事件分发逻辑，不含业务 |
| `src/renderer/render-loop.ts` | 修改 | 追加 interaction overlay 钩子 + 改进选中/hover 高亮 | 插入 1 个钩子调用 + 改善已有高亮 |

**对比原方案减少的公共改动**：
- ❌ 不在 store 中写 `hoveredForceIndex`、`selectedForceIndex`、`decompositionTarget`（5 个字段 + 5 个 action）
- ❌ 不在 CanvasContainer 中写力箭头 hitTest 逻辑
- ❌ 不在 render-loop 中写力箭头 hover 发光效果
- ❌ 不在 `shell/components/` 中新建 `ForcePopover.tsx`

## 8. 事件分发优先级

```
鼠标事件到达 CanvasContainer
  │
  ├─► 1. 视角交互 handler.hitTest（最高优先级）
  │     命中力箭头 → store.select({ type:'force-arrow', ... })
  │
  ├─► 2. 实体 hitTest（entity-registry）
  │     命中实体 → store.select({ type:'entity', ... })
  │
  └─► 3. 空白区域
        → store.select(null) — 清除所有选中
```

**关键变化**：力箭头无需先选中实体即可交互。hitTest 优先级保证力箭头在实体之上（因为力箭头视觉上画在实体上方）。

## 9. 与开发者 B 的协商要点

**公共代码修改范围明确且最小化**：

| 协商项 | 说明 |
|--------|------|
| types.ts 新增 `Selection` 接口 | 通用选中抽象，电磁域也用 |
| store `selectedEntityId` → `selection` | 语义升级，提供向后兼容 getter |
| renderer-registry 追加接口 | 纯追加，不改已有的 registerEntity / registerViewport |
| CanvasContainer 鼠标事件 | 通用分发机制，电磁域受益（未来可直接注册 handler） |
| render-loop 追加钩子 | 1 行代码，调用已注册的 renderOverlay |
| types.ts OrthogonalDecomposition 追加字段 | 纯追加可选字段，不影响已有 |

**开发者 B 的收益**：
- 未来电磁域需要场线交互时，同样可以通过 `registerViewportInteraction('field', handler)` 注册
- `Selection` 模型通用，电磁域可定义 `{ type: 'field-line', ... }`
- 不需要改公共代码，直接在 `domains/em/` 中实现

## 10. 方案对比

| 维度 | 原方案（业务写公共） | 新方案（统一选中 + 注册机制） |
|------|--------------------|-----------------------------|
| 选中模型 | `selectedEntityId` + `selectedForceIndex` 两套 | 统一 `selection` 一套 |
| 力箭头交互前提 | 必须先选中实体 | 直接可交互 |
| 公共 store 新增业务字段 | 5 个 | 0 个（只做语义升级） |
| CanvasContainer 业务代码 | 力箭头 hitTest 硬编码 | 通用分发，0 业务代码 |
| render-loop 业务代码 | 力箭头 hover 效果硬编码 | 1 行钩子调用 |
| 新增公共组件 | ForcePopover.tsx | 无 |
| 电磁域复用性 | 无（需重改公共代码） | 直接注册 handler |
| 与已有架构一致性 | 割裂 | 一致（注册模式） |
