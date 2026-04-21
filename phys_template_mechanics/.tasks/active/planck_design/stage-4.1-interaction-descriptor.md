# 第4.1阶段：交互能力 Descriptor 化重构

## 背景与动机

阶段4实施过程中发现：每增加一个物体的特殊交互行为（如 ground 只能垂直拖拽），需要在 SelectTool、CanvasRenderer、hitTest 等 4-5 个文件中添加 `if (body.type === 'xxx')` 硬编码分支。随着物体类型增多，这些分支会像 Excalidraw 的 App.tsx 一样膨胀。

参考 tldraw 的 ShapeUtil 声明式模式，在现有 BodyTypeDescriptor 接口上增加 `interaction` 字段，让每种物体在自己的描述文件中声明交互能力，SelectTool 读取配置而非硬编码类型判断。

## 设计参考

- **tldraw ShapeUtil**：`canResize()`, `canSnap()`, `hideRotateHandle()`, `onResize()` 等声明式方法
- **Fabric.js**：`lockMovementX/Y`, `lockRotation` 等属性锁定
- **当前项目 Registry 模式**：新增物体 = 1个描述文件 + 1行 import，交互重构应保持此原则

## 目标

1. 在 `BodyTypeDescriptor` 接口上扩展 `interaction` 字段
2. 将 SelectTool / CanvasRenderer / hitTest 中的物体类型硬编码判断迁移为读取 descriptor
3. Ground 注册为正式 descriptor（消除特殊处理）
4. 新增物体的交互约束只需在描述文件中声明，不改 SelectTool

## 接口设计

```typescript
// descriptor.ts 扩展

export interface InteractionCapability {
  /** 是否可选中，默认 true */
  selectable?: boolean
  /** 移动约束：true=自由移动, false=不可移动, 'vertical-only'/'horizontal-only' */
  canMove?: boolean | 'vertical-only' | 'horizontal-only'
  /** 是否可缩放，默认 true */
  canResize?: boolean
  /** 是否可旋转，默认 true */
  canRotate?: boolean
  /** 是否显示旋转手柄，默认 true */
  showRotateHandle?: boolean
  /** 是否显示缩放手柄，默认 true */
  showResizeHandles?: boolean
  /** 是否可删除，默认 true */
  canDelete?: boolean
  /** 是否参与吸附（作为目标），默认 true */
  canSnap?: boolean
  /** hover 时的鼠标样式，默认 'move' */
  hoverCursor?: string
  /** 自定义拖拽位置约束回调 */
  constrainMove?(pos: { x: number; y: number }, body: SceneBody): { x: number; y: number }
  /** 自定义旋转约束回调（如吸附到15度整数倍）*/
  constrainRotation?(angle: number, body: SceneBody): number
}

export interface BodyTypeDescriptor {
  // ... 现有字段不变 ...

  /** 交互能力声明，SelectTool 读取此配置决定行为 */
  interaction?: InteractionCapability
}
```

所有字段可选，未声明时使用合理默认值：
- 非 static 物体：全部能力开启
- static 物体：`canMove: false`（除非显式覆盖）

## 任务拆分

### 4.1.1 扩展 Descriptor 接口 + 默认值工具函数

**文件**：`src/models/bodyTypes/descriptor.ts`

- 增加 `InteractionCapability` 接口定义
- 增加 `getInteraction(body): ResolvedInteractionCapability` 工具函数，合并 descriptor 声明与默认值

### 4.1.2 Ground 注册为正式 Descriptor

**新增文件**：`src/models/bodyTypes/ground.tsx`

```typescript
registerBodyType({
  type: 'ground',
  label: '地面',
  category: 'support',
  defaults: { ... },
  interaction: {
    canMove: 'vertical-only',
    canResize: false,
    canRotate: false,
    showRotateHandle: false,
    showResizeHandles: false,
    canDelete: false,
    hoverCursor: 'ns-resize',
  },
  renderEdit: (ctx, body, scale) => { /* 地面线 + hatching */ },
  getSelectionBounds: (body, scale) => ({ halfW: 9999, halfH: 0 }),
  hitTest: (lx, ly, body) => Math.abs(ly) < 0.15,
  getSnapSurfaces: (body) => [/* rest surface at body.position.y */],
  // ...
})
```

**清理**：删除 hitTest.ts、SnapEngine.ts、CanvasRenderer.ts 中的 ground 特殊处理代码。

### 4.1.3 SelectTool 读取 Descriptor 交互能力

**文件**：`src/core/tools/SelectTool.ts`

改动点：
- `onMouseDown`：用 `getInteraction(body).canMove` 替代 `!body.isStatic || body.type === 'ground'`
- `handleMoveDrag`：用 `getInteraction(body).canMove === 'vertical-only'` 替代 `body.type === 'ground'`
- `updateHoverState`：用 `getInteraction(body).hoverCursor` 替代 `body.type === 'ground' ? 'ns-resize' : 'move'`
- `startHandleDrag`：检查 `canResize` / `canRotate` 决定是否进入缩放/旋转模式

### 4.1.4 SelectionHandles 读取 Descriptor

**文件**：`src/core/handles/SelectionHandles.ts`

- `getHandles()`：根据 `showRotateHandle`、`showResizeHandles` 决定是否生成对应手柄
- `hitTestHandle()`：对应调整

### 4.1.5 CanvasRenderer 清理硬编码

**文件**：`src/renderer/CanvasRenderer.ts`

- `renderScene()`：ground 走通用 `renderSceneBody` 路径，不再特殊跳过
- 删除 `renderGround()` 方法（ground 的渲染由其 descriptor.renderEdit 处理）
- 保留 `renderGroundHighlight` 或合并到通用选中高亮

### 4.1.6 hitTest 清理

**文件**：`src/core/hitTest.ts`

- 删除 ground 特殊处理分支（ground 现在有自己的 hitTest descriptor）

### 4.1.7 Canvas.tsx 清理

**文件**：`src/components/Canvas.tsx`

- Delete 键处理：用 `getInteraction(body).canDelete` 替代 `sel.id !== 'ground'`

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/models/bodyTypes/descriptor.ts` | 修改 | 扩展 InteractionCapability 接口 |
| `src/models/bodyTypes/ground.tsx` | **新增** | Ground 正式 descriptor |
| `src/models/bodyTypes/index.ts` | 修改 | import ground |
| `src/core/tools/SelectTool.ts` | 修改 | 读取 interaction 配置替代硬编码 |
| `src/core/handles/SelectionHandles.ts` | 修改 | 手柄生成读取配置 |
| `src/core/hitTest.ts` | 修改 | 删除 ground 特殊分支 |
| `src/core/snap/SnapEngine.ts` | 修改 | 删除 ground 特殊分支 |
| `src/renderer/CanvasRenderer.ts` | 修改 | 删除 renderGround，ground 走通用渲染 |
| `src/components/Canvas.tsx` | 修改 | canDelete 替代硬编码 |
| `src/models/defaults.ts` | 修改 | createGround 可简化 |

## 验收标准

1. Ground 可选中、可上下拖拽、不可旋转/缩放/删除 — 行为与重构前一致
2. 所有物体的选中/拖拽/缩放/旋转行为与重构前一致
3. SelectTool 中无 `body.type === 'xxx'` 硬编码判断
4. 新增一种物体类型时，交互约束只需在描述文件的 `interaction` 字段声明
5. `pnpm lint && pnpm tsc --noEmit` 通过

## 风险评估

- **风险等级**：L1（常规重构，1-3文件核心改动 + 多文件清理）
- **回退方案**：git revert，所有改动在一个 commit 中

## 执行记录 ✅ 已完成（2026-03-25）

### 实际改动文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/models/bodyTypes/descriptor.ts` | 修改 | +InteractionCapability 接口 +getInteraction() +_setDescriptorLookup() |
| `src/models/bodyTypes/registry.ts` | 修改 | 调用 _setDescriptorLookup 注入 lookup 函数 |
| `src/models/bodyTypes/ground.tsx` | **新增** | Ground 正式 descriptor（含 interaction/toShapeConfig/renderEdit/renderSim/hitTest/getSnapSurfaces/toUserData） |
| `src/models/bodyTypes/index.ts` | 修改 | +import ground +导出 getInteraction/InteractionCapability/ResolvedInteraction |
| `src/engine/sceneSync.ts` | 修改 | 删除 ground 硬编码分支，走通用 descriptor |
| `src/core/tools/SelectTool.ts` | 修改 | 3处 → getInteraction（canMove/vertical-only/hoverCursor） |
| `src/core/handles/SelectionHandles.ts` | 修改 | showResizeHandles/showRotateHandle 控制手柄生成 |
| `src/renderer/CanvasRenderer.ts` | 修改 | 删除 renderGround/renderGroundHighlight，ground 走通用路径；修复 body.type==='dynamic' bug |
| `src/core/hitTest.ts` | 修改 | hitTestPriority 排序替代 ground 跳过 |
| `src/components/Canvas.tsx` | 修改 | canDelete 替代 sel.id!=='ground' |
| `src/components/panels/PropertyPanel.tsx` | 修改 | 3处 ground 判断改为 getInteraction |
| `src/core/align/AlignEngine.ts` | 修改 | canAlign 替代 other.type==='ground' |
| `src/core/snap/SnapEngine.ts` | 修改 | 删除 ground 特殊分支 |

### 附带修复

- `CanvasRenderer.renderBody`: `body.type === 'dynamic'` → `body.type !== 'static'`（仿真模式静态物体颜色判断 bug）
- Ground 仿真渲染：需 `toUserData: () => ({ bodyType: 'ground' })` 才能走 renderSim 路径

### 设计决策

- **循环依赖处理**：descriptor.ts 通过 `_setDescriptorLookup` 注入机制获取 registry lookup，避免 descriptor↔registry 循环 import
- **ground 选中高亮**：保留为独立导出函数 `renderGroundHighlight`，因为 ground 的选中高亮本质不同于其他物体（全宽水平线 vs 矩形选中框）
- **defaults.ts 未改动**：`createGround()` 保持原样，因为它只设置 SceneBody 属性，与 descriptor 独立

### 验收结果

- [x] Ground 可选中、可上下拖拽、不可旋转/缩放/删除
- [x] 所有物体行为与重构前一致
- [x] SelectTool 中无 body.type 硬编码判断
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 仿真模式地面正常显示
