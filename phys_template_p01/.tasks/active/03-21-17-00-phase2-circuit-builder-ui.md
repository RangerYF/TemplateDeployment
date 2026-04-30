# Phase 2：电路自由搭建模式 UI 实现计划

| 字段 | 值 |
|------|-----|
| 任务ID | 03-21-17-00-phase2-circuit-builder-ui |
| 风险等级 | **L3（关键风险）** — 公共代码大面积改动、新增交互范式、影响现有 SimulatorView 数据流 |
| 流程路径 | MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6 |
| 公共代码变更 | 涉及 `src/shell/`、`src/store/`、`src/renderer/`、`src/core/engine/`，需与开发者 A 协商 |

---

## 一、现状总结

### 当前页面流程
```
PresetGallery（选择预设） → SimulatorView（加载预设 → 参数微调 → 观察）
```

### 缺失能力
| 能力 | 状态 |
|------|------|
| 模式选择入口（实验模板/自由搭建） | ❌ |
| 元器件库侧边栏 | ❌ |
| 画布 drag & drop 拖入元件 | ❌ |
| 画布点击选中/拖拽移动实体 | ❌ |
| 用户连线（创建 connection 关系） | ❌ |
| 运行时动态添加/删除实体 | ❌ |
| 动态求解器匹配（场景变化时重新匹配） | ❌ |

### 可复用的基础设施
| 已有能力 | 位置 | 备注 |
|----------|------|------|
| `entityRegistry.getAll()` | `entity-registry.ts` | 可列出所有已注册元件类型 |
| `entityRegistry.get(type).createEntity()` | 同上 | 可动态创建实体实例 |
| `HitTestResult` 接口 | `types.ts` | 点击检测已定义类型 |
| `hitTest` 每个实体注册时提供 | 各实体文件 | 命中测试函数就绪 |
| `selectedEntityId` | `simulation-store.ts` | store 中已预留 |
| `selectEntity` action | 同上 | 已实现但未接 UI |
| `screenToWorld()` | `coordinate.ts` | 像素→物理坐标转换就绪 |
| `drawSelectionHighlight()` | `render-loop.ts` | 选中高亮骨架已有 |
| 所有电路元件实体 + 渲染器 | `domains/em/` | 14 个实体类型全部就绪 |
| `solverRegistry.match()` | `solver-registry.ts` | 支持动态重新匹配 |

---

## 二、目标架构

### 页面流程（新）
```
HomePage
  ├─ [实验模板] → PresetGallery → SimulatorView（现有流程不变）
  └─ [自由搭建] → CircuitBuilderView（新页面）
                    ├─ 左侧：ComponentPalette（元器件库）
                    ├─ 中央：BuilderCanvas（可交互画布）
                    ├─ 右侧：PropertyPanel（选中元件属性编辑）
                    └─ 底部：BuilderToolbar（运行/停止/清空/导出）
```

### 三个页面状态
```typescript
type AppPage = 'home' | 'simulator' | 'builder';
```

---

## 三、分阶段实现计划

### 阶段 A：HomePage + 页面路由重构（2 个文件）

**目标**：新增首页，提供"实验模板"和"自由搭建"两个入口。

#### A1. 重构 `App.tsx` 路由逻辑
- 将当前 `activePresetId` 状态扩展为 `AppPage` 枚举
- hash 路由：`#` → home，`#preset/{id}` → simulator，`#builder` → builder
- 页面切换不影响现有 SimulatorView 的 key 重挂载机制

```typescript
// 新路由逻辑
type AppPage = 'home' | 'simulator' | 'builder';

function parseHash(): { page: AppPage; presetId?: string } {
  const hash = window.location.hash.replace('#', '');
  if (hash.startsWith('preset/')) return { page: 'simulator', presetId: hash.slice(7) };
  if (hash === 'builder') return { page: 'builder' };
  return { page: 'home' };
}
```

**改动文件**：`src/shell/App.tsx`

#### A2. 新增 `HomePage` 组件
- 两张大卡片入口：实验模板模式 / 自由搭建模式
- 点击"实验模板" → `#` 跳转到 PresetGallery（或直接内嵌）
- 点击"自由搭建" → `#builder`
- 简洁设计，复用现有 `COLORS` tokens

**新增文件**：`src/shell/pages/HomePage.tsx`

---

### 阶段 B：Store 扩展 — BuilderStore（1 个新文件）

**目标**：独立的 builder 状态管理，与现有 `simulation-store` 平行。

#### B1. 新增 `builder-store.ts`

```typescript
interface BuilderStoreState {
  // 画布中的实体（动态增删）
  entities: Map<EntityId, Entity>;
  // 实体间的连接关系
  relations: Relation[];
  // 当前选中实体 ID
  selectedEntityId: EntityId | null;
  // 交互状态
  interaction: BuilderInteraction;
  // 画布变换（平移、缩放）
  canvasTransform: CoordinateTransform;
  // 求解结果（运行时）
  currentResult: PhysicsResult | null;
  // 运行状态
  isRunning: boolean;
}

type BuilderInteraction =
  | { type: 'idle' }
  | { type: 'dragging-new'; entityType: string; position: Vec2 }
  | { type: 'moving'; entityId: EntityId; offset: Vec2 }
  | { type: 'wiring'; fromEntityId: EntityId; mousePos: Vec2 }
  | { type: 'selecting' };

interface BuilderStoreActions {
  // 实体操作
  addEntity(type: string, position: Vec2): EntityId;
  removeEntity(id: EntityId): void;
  moveEntity(id: EntityId, position: Vec2): void;
  updateEntityProperty(id: EntityId, key: string, value: unknown): void;

  // 连线操作
  addConnection(sourceId: EntityId, targetId: EntityId): void;
  removeConnection(relationId: RelationId): void;

  // 选择操作
  selectEntity(id: EntityId | null): void;

  // 交互状态
  setInteraction(interaction: BuilderInteraction): void;

  // 运行控制
  runCircuit(): void;   // 构建 SceneDefinition → 匹配求解器 → 求解
  stopCircuit(): void;
  clearAll(): void;

  // 画布
  setCanvasTransform(transform: CoordinateTransform): void;
}
```

**关键设计决策**：
- `addEntity` 调用 `entityRegistry.get(type).createEntity()`，自动生成 ID
- `runCircuit` 将 `entities + relations` 打包为临时 `SceneDefinition`，调用 `solverRegistry.match()` 尝试匹配求解器，匹配成功则求解并渲染结果
- 不修改现有 `simulation-store.ts`，两个 store 完全独立

**新增文件**：`src/store/builder-store.ts`

---

### 阶段 C：元器件库面板（1 个新文件）

**目标**：左侧可拖拽的元器件列表。

#### C1. 新增 `ComponentPalette` 组件

```
┌─────────────────┐
│  元器件库        │
│─────────────────│
│  📦 电源         │  ← 分类折叠面板
│  ├ 直流电源      │  ← 拖拽手柄
│  📦 电阻类       │
│  ├ 定值电阻      │
│  ├ 滑动变阻器    │
│  ├ 电阻箱       │
│  📦 仪表类       │
│  ├ 电流表       │
│  ├ 电压表       │
│  ├ 灵敏电流计    │
│  📦 其他         │
│  ├ 开关         │
│  ├ 电容器       │
│  ├ 灯泡         │
│  ├ 电动机       │
└─────────────────┘
```

**实现方式**：
- 从 `entityRegistry.getAll()` 动态获取所有已注册电路元件
- 按 `category` 分组（`object` → 按类型细分，`instrument` → 仪表类）
- 每个条目使用 HTML5 Drag API（`draggable + onDragStart`）
- `onDragStart` 时在 `dataTransfer` 中设置 `entityType`
- 元件图标：简笔画 SVG 或文字符号（复用渲染器风格的颜色）

**过滤规则**：只显示电路类元件（排除 `point-charge`、`uniform-bfield`、`wire-frame` 等非电路实体）

**新增文件**：`src/shell/panels/ComponentPalette.tsx`

---

### 阶段 D：可交互画布（2 个文件改动 + 1 个新文件）

**目标**：画布支持拖入元件、点击选中、拖拽移动、连线。

#### D1. 增强 `CanvasContainer.tsx`

追加事件监听：
- `onDragOver` + `onDrop` — 接收从元器件库拖入的新元件
- `onMouseDown` — 点击检测（遍历 entities 调用 hitTest）
- `onMouseMove` — 拖拽移动实体 / 连线预览
- `onMouseUp` — 结束拖拽 / 完成连线
- `onContextMenu` — 右键菜单（删除元件/断开连线）

**坐标转换**：
```typescript
// 鼠标事件 → 物理坐标
const rect = canvas.getBoundingClientRect();
const pixelX = (e.clientX - rect.left);
const pixelY = (e.clientY - rect.top);
const worldPos = screenToWorld({ x: pixelX, y: pixelY }, coordinateTransform);
```

**命中检测**：
```typescript
function findEntityAtPoint(point: Vec2): HitTestResult | null {
  for (const entity of entities.values()) {
    const reg = entityRegistry.get(entity.type);
    if (!reg) continue;
    const hit = reg.hitTest(entity, point);
    if (hit) return hit;
  }
  return null;
}
```

**改动文件**：`src/shell/canvas/CanvasContainer.tsx`（追加 props 和事件）

#### D2. 新增 `BuilderCanvas` 包装组件

将 CanvasContainer 包装为 builder 专用版本：
- 注入 `builderStore` 的 entities/result
- 管理独立的 render loop（builder 模式下用 builder store 的数据）
- 处理 drag & drop 事件与 builder store 的交互
- 绘制连线预览（wiring 交互态时画一条跟随鼠标的虚线）

**新增文件**：`src/shell/canvas/BuilderCanvas.tsx`

#### D3. 增强 render-loop 选中高亮

`drawSelectionHighlight` 当前是固定半径圆圈，需要改为：
- 矩形实体 → 虚线矩形边框（读取 `width/height`）
- 圆形实体 → 虚线圆环（读取 `radius`）
- 加上 4 个角落的拖拽手柄小方块

**改动文件**：`src/renderer/render-loop.ts`（改进 `drawSelectionHighlight`）

---

### 阶段 E：连线系统（渲染 + 交互）

**目标**：用户可以在两个元件之间画导线（创建 connection 关系）。

#### E1. 连线渲染

在 render-loop 中追加一步：在 overlay 层之后，遍历 `relations` 绘制导线。

```typescript
// 连线绘制逻辑（在 render 函数最后追加）
for (const relation of relations) {
  if (relation.type !== 'connection') continue;
  const source = entities.get(relation.sourceEntityId);
  const target = entities.get(relation.targetEntityId);
  if (!source || !target) continue;

  // 计算元件边缘连接点（非中心）
  const sourceCenter = getEntityCenter(source);
  const targetCenter = getEntityCenter(target);
  const sourceScreen = worldToScreen(sourceCenter, transform);
  const targetScreen = worldToScreen(targetCenter, transform);

  // 绘制导线（灰色实线，转角走正交路径）
  drawWire(ctx, sourceScreen, targetScreen);
}
```

**导线绘制样式**：
- 正常导线：`#666` 灰色实线 2px
- 通电导线（运行时）：`#27AE60` 绿色 + 电流方向箭头
- 故障导线：`#E74C3C` 红色虚线

#### E2. 连线交互

- 从元件边缘开始拖拽 → 进入 `wiring` 交互态
- 鼠标跟随画虚线
- 松开鼠标时检测目标元件 → 创建 connection
- 判定：不允许自连接、不允许重复连接

**改动文件**：
- `src/renderer/render-loop.ts` — 追加连线渲染
- `src/shell/canvas/BuilderCanvas.tsx` — 连线交互逻辑

---

### 阶段 F：属性面板（1 个新文件）

**目标**：右侧面板显示选中元件的可编辑属性。

#### F1. 新增 `PropertyPanel` 组件

```
┌─────────────────┐
│  属性面板        │
│─────────────────│
│  定值电阻        │  ← 元件类型 + 标签
│                 │
│  电阻 R         │
│  [====|====] Ω  │  ← slider（从 paramSchemas 生成）
│                 │
│  故障模拟        │
│  [正常 ▼]       │  ← select
│                 │
│  位置           │
│  x: 1.5  y: 0.3│  ← 只读显示
│                 │
│  [🗑 删除元件]   │  ← 删除按钮
└─────────────────┘
```

**数据驱动**：
- 读取 `entityRegistry.get(type).paramSchemas` 生成控件
- 复用 `ParamPanel.tsx` 中的 `ParamControl` 渲染逻辑（提取为共用组件）
- `onChange` → `builderStore.updateEntityProperty(id, key, value)`
- 无选中时显示"点击元件查看属性"提示

**新增文件**：`src/shell/panels/PropertyPanel.tsx`

---

### 阶段 G：CircuitBuilderView 主页面（1 个新文件）

**目标**：组装所有 builder 子组件。

```typescript
function CircuitBuilderView({ onBack }) {
  return (
    <MainLayout
      leftPanel={<ComponentPalette />}
      canvas={<BuilderCanvas />}
      rightPanel={<PropertyPanel />}
      timeline={<BuilderToolbar onBack={onBack} />}
    />
  );
}
```

#### G1. BuilderToolbar（底部工具栏）

替代 TimelineBar，提供：
- [← 返回] — 回首页
- [▶ 运行] / [■ 停止] — 构建场景 → 匹配求解器 → 求解 → 渲染结果
- [🗑 清空画布] — 清除所有实体和连线
- [📋 导出预设] — 将当前画布内容导出为 PresetData JSON（Phase 3 增强）
- [💾 加载模板] — 从预设库加载电路到画布（可编辑）

**新增文件**：
- `src/shell/pages/CircuitBuilderView.tsx`
- `src/shell/timeline/BuilderToolbar.tsx`

---

### 阶段 H：动态求解桥接

**目标**：用户点击"运行"时，将 builder 画布内容转换为可求解的场景。

#### H1. SceneBuilder 工具函数

```typescript
// src/core/engine/scene-builder.ts

/**
 * 从 builder store 的 entities + relations 构建 SceneDefinition
 * 并尝试匹配求解器
 */
export function buildSceneFromEntities(
  entities: Map<EntityId, Entity>,
  relations: Relation[],
): { scene: SceneDefinition; solver: SolverRegistration | null } {
  // 1. 构建 paramGroups：从每个实体的 paramSchemas 自动生成
  // 2. 构建 paramValues：从实体当前 properties 读取
  // 3. 组装 SceneDefinition
  // 4. solverRegistry.match(scene) 尝试匹配
  //    - 匹配成功：返回求解器
  //    - 匹配失败：返回 null（画布仍可渲染，但无计算结果）

  return { scene, solver };
}
```

**求解策略**：
- 自由搭建模式下，求解器匹配可能失败（用户搭建了非标准电路）
- 失败时：仅渲染元件，不显示电流/电压，底部提示"电路不完整或无法求解"
- 成功时：运行求解器，电表显示读数，导线颜色变为通电色

**新增文件**：`src/core/engine/scene-builder.ts`

---

## 四、文件变更总清单

### 新增文件（8 个）
| # | 文件路径 | 说明 |
|---|----------|------|
| 1 | `src/shell/pages/HomePage.tsx` | 首页（模式选择入口） |
| 2 | `src/shell/pages/CircuitBuilderView.tsx` | 搭建模式主页面 |
| 3 | `src/shell/panels/ComponentPalette.tsx` | 元器件库侧边栏 |
| 4 | `src/shell/panels/PropertyPanel.tsx` | 选中元件属性面板 |
| 5 | `src/shell/canvas/BuilderCanvas.tsx` | 搭建模式画布包装 |
| 6 | `src/shell/timeline/BuilderToolbar.tsx` | 搭建模式底部工具栏 |
| 7 | `src/store/builder-store.ts` | 搭建模式独立 store |
| 8 | `src/core/engine/scene-builder.ts` | 动态场景构建工具 |

### 修改文件（4 个）
| # | 文件路径 | 改动说明 |
|---|----------|----------|
| 9 | `src/shell/App.tsx` | 路由扩展：三页面状态 |
| 10 | `src/shell/canvas/CanvasContainer.tsx` | 追加 drag/drop + mouse 事件 props |
| 11 | `src/renderer/render-loop.ts` | 改进选中高亮 + 连线渲染 |
| 12 | `src/store/index.ts` | 导出 builder-store |

### 不修改的文件
- `src/store/simulation-store.ts` — 保持不变，两个 store 独立
- `src/core/types.ts` — 已有类型足够用，不需扩展
- `src/domains/em/**` — 实体/求解器/渲染器层不变
- `src/shell/panels/ParamPanel.tsx` — 预设模式专用，不改动
- `src/shell/pages/PresetGallery.tsx` — 保持不变

---

## 五、执行批次排序

| 批次 | 阶段 | 内容 | 依赖 | 预计文件数 |
|------|------|------|------|-----------|
| **B1** | A | HomePage + App.tsx 路由重构 | 无 | 2（1 新 + 1 改） |
| **B2** | B | builder-store.ts | 无 | 1 新 |
| **B3** | C | ComponentPalette.tsx | B2 | 1 新 |
| **B4** | D | CanvasContainer 增强 + BuilderCanvas | B2 | 2（1 新 + 1 改） |
| **B5** | E | 连线渲染 + 交互 | B4 | 1 改（render-loop） |
| **B6** | F | PropertyPanel.tsx | B2 | 1 新 |
| **B7** | G | CircuitBuilderView + BuilderToolbar | B3+B4+B6 | 2 新 |
| **B8** | H | scene-builder.ts + 运行桥接 | B2+B7 | 1 新 |
| **B9** | — | 集成测试 + store/index 导出 + 回归 | 全部 | 1 改 |

---

## 六、公共代码协商清单

以下改动涉及公共代码，需与开发者 A 确认：

| 文件 | 改动类型 | 影响范围 | 向后兼容 |
|------|----------|----------|----------|
| `src/shell/App.tsx` | 路由扩展 | 全局页面入口 | ✅ 现有 preset 路由不变 |
| `src/shell/canvas/CanvasContainer.tsx` | 追加 props | 画布容器 | ✅ 新 props 全部 optional |
| `src/renderer/render-loop.ts` | 选中高亮改进 | 渲染循环 | ✅ 向后兼容 |
| `src/store/index.ts` | 追加导出 | store 入口 | ✅ 只追加 |

**原则**：所有改动都是追加式（新增 optional props、新增导出），不修改已有行为。

---

## 七、风险评估

| 风险点 | 等级 | 缓解措施 |
|--------|------|----------|
| builder 与 simulator 的 store 状态隔离 | 中 | 完全独立的两个 Zustand store |
| 画布事件与渲染循环的线程安全 | 中 | 事件处理只写 store，渲染循环只读 store |
| 自由搭建的电路无法匹配求解器 | 中 | 优雅降级：无求解器时仅渲染元件 |
| CanvasContainer 改动影响现有 SimulatorView | 低 | 新 props 全部 optional，默认行为不变 |
| 拖拽性能（大量元件时） | 低 | Phase 2 场景规模有限（<30 元件） |

---

## 八、与 Phase 1 的关系

- Phase 1 的 PresetGallery → SimulatorView 流程**完全不变**
- Phase 2 新增一条独立路径：HomePage → CircuitBuilderView
- 两条路径共享底层（实体注册 + 渲染器 + 求解器），但 UI 层完全独立
- builder 模式的"导出预设"功能可将用户搭建的电路转为 Phase 1 格式的 PresetData，实现两种模式互通
