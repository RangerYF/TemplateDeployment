# 公共代码变更日志

> **谁维护**：任何开发者修改 `src/core/`、`src/shell/`、`src/renderer/`、`src/store/` 下的代码时，**必须**在本文件追加变更记录。
>
> **谁读**：所有开发者在开始新任务前**必须**读取本文件，确认公共代码是否有影响自己的变更。

---

## 阶段6.2：分组预设子类型选择器（2026-03-20，开发者 A）

### Shell 变更

#### PresetGallery.tsx

删除分组展开/折叠逻辑（`expandedGroup` state + 子卡片渲染）。分组卡片点击直接加载首个子类型预设进入场景。

#### ParamPanel.tsx

新增可选 props：

```typescript
groupPresets?: Array<{ id: string; name: string }>;  // 同 group 的预设列表
activePresetId?: string;                              // 当前激活的预设 ID
onSwitchPreset?: (presetId: string) => void;          // 切换子类型回调
```

当 `groupPresets.length > 1` 时，在"参数设置"标题下方渲染芯片切换器。无 `groupPresets` 时行为不变。

#### App.tsx（SimulatorView）

- 新增内部 `currentPresetId` 状态，支持子类型切换不重新挂载组件
- `handleSwitchPreset`：加载新预设 + 恢复同名参数 + `history.replaceState` 静默更新 URL hash
- 从 `presetRegistry` 按 `group` 字段筛选同组预设，传递给 ParamPanel

**影响**：仅 UI 交互变更，不影响数据层。无 group 的预设行为完全不变。

---

## 阶段6：场景统一化整改（2026-03-20，开发者 A）

### 新增 API

#### ParamSchemaBase.visibleWhen

`core/types.ts` 中 `ParamSchemaBase` 新增可选字段：

```typescript
/** 参数联动显隐：当指定的其他参数满足条件时才显示本参数（多 key 为 AND） */
visibleWhen?: Record<string, unknown>;
```

**影响**：新增可选字段，不影响已有代码。`ParamPanel.tsx` 渲染前检查此字段，不满足条件的参数自动隐藏。

#### PresetData.group / groupLabel / groupOrder

`core/types.ts` 中 `PresetData` 新增可选字段：

```typescript
group?: string;       // 预设分组标识
groupLabel?: string;  // 分组显示名称
groupOrder?: number;  // 组内排序权重
```

**影响**：新增可选字段，不影响已有代码。`PresetGallery.tsx` 按 group 合并显示。

### Shell 变更

#### ParamPanel.tsx

渲染前按 `visibleWhen` 过滤参数。无 `visibleWhen` 的已有参数行为不变。

#### PresetGallery.tsx

重构为支持分组显示：有 `group` 的预设合为一个入口卡片，点击后展开子类型选择。无 `group` 的预设行为不变。

---

## 阶段5：悬挂体系（2026-03-19，开发者 A）

### 新增 API

#### RenderContext.entities

`core/types.ts` 中 `RenderContext` 新增字段：

```typescript
/** 场景中所有实体（连接件渲染器需要引用关联实体的位置） */
entities: Map<EntityId, Entity>;
```

`renderer/render-loop.ts` 中构建 `renderCtx` 时传入 `entities` Map。

**影响**：新增必填字段。已有代码中所有构建 `RenderContext` 的位置（仅 `render-loop.ts`）已同步更新。EntityRenderer 签名不变，通过 `ctx.entities` 可访问场景中其他实体。

#### preset-loader：实体 properties 中的 ref 自动替换

`core/engine/preset-loader.ts` 在步骤②（创建实体）之后新增步骤②b：遍历所有实体的 `properties`，将值为 ref 字符串的字段替换为对应的实际 `entityId`。

**影响**：连接件（rope/rod）的 `pivotEntityId`、`blockEntityId` 等引用字段在预设加载后自动指向真实实体 ID。已有预设不受影响（无此类字段的实体不触发替换）。

---

## 阶段4：运动视角（2026-03-19，开发者 A）

### 新增 API

#### MotionViewportData 扩展

`core/types.ts` 中 `MotionViewportData` 新增可选字段：

```typescript
export interface MotionViewportData {
  motionStates: MotionState[];
  currentTime?: number;              // 新增
  history?: Array<{                  // 新增
    time: number;
    states: Array<{
      entityId: EntityId;
      position: Vec2;
      velocity: Vec2;
      acceleration: Vec2;
    }>;
  }>;
}
```

**影响**：新增可选字段，不影响已有代码。

#### RenderLoopOptions 扩展

`renderer/render-loop.ts` 中 `RenderLoopOptions` 新增可选回调：

```typescript
getResultHistory?: () => PhysicsResult[];
```

**影响**：新增可选字段，不影响已有调用。

#### extractViewportData 内部变更

`renderer/render-loop.ts` 中 `extractViewportData` 新增可选 `resultHistory` 参数，仅在 `case 'motion'` 分支使用。

**影响**：内部函数，不对外暴露。

#### ISimulator.getResultHistory()

`core/engine/simulator.ts` 中 `ISimulator` 新增方法：

```typescript
getResultHistory(): PhysicsResult[];
```

返回解析模式下的预计算结果（`precomputedResults`）或数值模式下的 `resultHistory`。

**影响**：新增方法，不影响已有 API。

#### App.tsx 变更

`shell/App.tsx` 中 `createRenderLoop` 调用新增 `getResultHistory` 回调。

**影响**：仅追加参数，不影响已有行为。

---

## 阶段3：交互系统 + 布局重设计（2026-03-19，开发者 A）

### 破坏性变更

#### store API 变更

`store/simulation-store.ts` 中选中相关 API 已替换：

```typescript
// 已删除
selectedEntityId: EntityId | null;
selectEntity(id: EntityId | null): void;

// 新 API
selection: Selection | null;
hoveredTarget: Selection | null;
select(selection: Selection | null): void;
setHovered(target: Selection | null): void;
```

#### RenderContext 字段变更

`core/types.ts` 中 `RenderContext`：

```typescript
// 已删除
placementContext: unknown;

// 新增
selection: Selection | null;
hoveredTarget: Selection | null;

// 保留（从 selection 自动提取，兼容旧代码）
selectedEntityId: EntityId | null;
```

#### render-loop 接口变更

`RenderLoopOptions` 参数变更：

```typescript
// 已删除
getSelectedEntityId: () => EntityId | null;

// 新增
getSelection: () => Selection | null;
getHoveredTarget: () => Selection | null;
```

#### placement.ts 重写

旧 API 全部删除：`PlacementContext`、`createPlacementContext`、`setLatestPlacementContext`、`getLatestPlacementContext`、`popoverCandidates`、`entityToBox`、`labelCandidates`。

新 API：

```typescript
// 标签局部防重叠
placeLabel(candidates, width, height, occupied: PlacementBox[]): { left, top }

// Popover 简单方向选择
pickPopoverPosition(anchorX, anchorY, panelW, panelH, canvasW, canvasH, gap?, halfW?, halfH?, preferredDir?): { left, top }

// 工具函数（保留）
segmentToBox(from, to, lineWidth): PlacementBox
measureText(text, fontSize, ctx): number
directionToPreferred(dx, dy): PopoverDirection
```

---

### 新增 API

#### Selection 类型

```typescript
// core/types.ts
interface Selection {
  type: string;   // 'entity' | 域自定义类型如 'force-arrow'
  id: string;
  data: unknown;  // 不透明，由域定义
}
```

#### ViewportInteractionHandler

域代码可注册视角交互处理器，接管该视角下的 hitTest、hover、选中交互：

```typescript
// core/registries/renderer-registry.ts
rendererRegistry.registerViewportInteraction('force', {
  hitTest(screenPoint, worldPoint, context): Selection | null { ... },
  onHover(target: Selection | null): void { ... },
  onSelectionChange(selection: Selection | null): void { ... },
  getCursor(target: Selection): string { ... },
  renderOverlay(ctx: RenderContext): void { ... },
  getFloatingUI(): FloatingUIDescriptor | null { ... },
});
```

#### FloatingUIDescriptor + 浮动组件注册

域代码注册 React 浮动组件：

```typescript
rendererRegistry.registerFloatingComponent('force-popover', ForcePopover);
```

`getFloatingUI()` 返回值：

```typescript
interface FloatingUIDescriptor {
  anchorScreenPos: Vec2;
  anchorHalfSize?: { w: number; h: number };
  preferredDirection?: 0 | 1 | 2 | 3;  // 0=上 1=右 2=下 3=左
  componentType: string;
  data: unknown;
}

interface FloatingComponentProps {
  data: unknown;
  onClose: () => void;
}
```

浮动组件由 `shell/canvas/DraggablePopover` 包装。标题行加 `data-drag-handle` 属性即可拖拽：

```tsx
<div data-drag-handle style={{ cursor: 'grab', borderBottom: '1px solid #E2E8F0' }}>
  标题
</div>
```

#### EntityRegistration.drawOutline

实体注册时可提供轮廓绘制函数，用于选中/hover 高亮（shadowBlur 发光描边）：

```typescript
entityRegistry.register({
  // ...
  drawOutline: (entity, ctx, coordinateTransform) => {
    // 只构建路径，不 stroke/fill。render-loop 统一描边。
    ctx.beginPath();
    ctx.moveTo(...);
    ctx.lineTo(...);
    ctx.closePath();
  },
});
```

未提供时 fallback 为 20px 圆环。
