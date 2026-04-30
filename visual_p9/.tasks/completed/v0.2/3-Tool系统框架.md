# 第3阶段：Tool 系统框架

**任务ID**: 03-09-phase3-Tool系统
**风险等级**: L1（常规风险：纯新增 src/editor/tools/ 文件，不碰旧代码）
**流程路径**: MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**关联主计划**: `.tasks/active/v0.2/PROGRESSIVE-PLAN.md` 第3阶段
**关联架构文档**: `.tasks/active/v0.2/ARCHITECTURE.md` §5
**前置依赖**: 第1阶段（Entity + Store）+ 第2阶段（Command + Undo/Redo）已完成
**状态**: ✅ 已完成

---

## 任务目标

在 `src/editor/tools/` 中定义 Tool 接口并实现所有工具的核心逻辑，纯新增代码，不碰旧组件。本阶段完成后，四个 Tool 的逻辑就绪，等待阶段4接入 UI 事件。

**约束**：纯新增 `src/editor/tools/` 文件，不碰 `src/components/`、`src/hooks/`、`src/store/` 等旧代码，旧应用始终可正常运行。

---

## 验收标准

- [x] Tool 接口定义完整，四个工具的核心逻辑可编译
- [x] ToolStore 支持工具注册、切换、互斥（同时只有一个活跃工具）
- [x] 各 Tool 内部正确调用 Command 系统（CreateEntityCommand / MovePointCommand / CreateCrossSectionCommand 等）
- [x] 各 Tool 内部正确读写 SelectionStore / EntityStore
- [x] `pnpm tsc --noEmit` 通过
- [x] `pnpm lint` 通过
- [x] 不触碰 `src/components/` 和 `src/hooks/`，旧应用仍可正常运行

---

## 阶段1-2产出依赖（已就绪）

| 模块 | 文件 | 本阶段使用方式 |
|------|------|---------------|
| Tool 接口 | `src/editor/tools/types.ts` | 已定义 `Tool { id, label, onActivate?, onDeactivate?, onPointerDown/Move/Up?, onKeyDown?, renderOverlay? }` + `ToolPointerEvent` |
| ToolStore | `src/editor/store/toolStore.ts` | 已实现 `registerTool`/`setActiveTool`/`getActiveTool`，本阶段注册四个 Tool |
| EntityStore | `src/editor/store/entityStore.ts` | Tool 内部读取实体 / 调用 updateProperties |
| SelectionStore | `src/editor/store/selectionStore.ts` | Tool 内部调用 select/deselect/clear |
| HistoryStore | `src/editor/store/historyStore.ts` | Tool 内部调用 execute(command) 提交 Command |
| Command 系列 | `src/editor/commands/*.ts` | Tool 构造并提交 Command：CreateEntity / MovePoint / RenameEntity / CreateCrossSection / DeleteEntityCascade 等 |

---

## 子任务清单

### T3.1 SelectTool

**目标**：默认工具，负责选中、拖拽、重命名。

**产出文件**：`src/editor/tools/selectTool.ts`

**实现内容**（严格遵循 ARCH §5.3 + §9.2.1）：

**状态（Tool 私有）**：
- `isDragging: boolean`
- `dragPointId: string | null`
- `dragBeforeState: [number,number,number] | undefined`（拖拽前 positionOverride）

**onActivate()**：
- 无特殊操作

**onDeactivate()**：
- 如果正在拖拽，取消拖拽（不提交 Command）
- 清除内部状态

**onPointerDown(event: ToolPointerEvent)**：
- 如果 `hitEntityId` 存在：
  - 调用 `SelectionStore.select(hitEntityId)` 选中该实体
  - 如果命中的是 Point Entity：进入拖拽预备状态（记录 `dragPointId`、`dragBeforeState = point.positionOverride`）
- 如果 `hitEntityId` 不存在（点击空白）：
  - 调用 `SelectionStore.clear()` 取消选中

**onPointerMove(event: ToolPointerEvent)**：
- 如果 `dragPointId` 存在且鼠标已移动足够距离：
  - `isDragging = true`
  - 实时更新 Point Entity 的 `positionOverride`（直接调用 `EntityStore.updateProperties`，不产生 Command）
  - **注意**：positionOverride 的计算需要从 `event.intersection` 提取 3D 坐标，具体计算逻辑在阶段4接入 R3F 后实现，本阶段仅做框架预留

**onPointerUp(event: ToolPointerEvent)**：
- 如果 `isDragging`：
  - 获取当前 positionOverride 作为 afterState
  - 构造 `MovePointCommand(dragPointId, dragBeforeState, afterState)`
  - 调用 `HistoryStore.execute(command)`
- 重置拖拽状态

**onKeyDown(event: KeyboardEvent)**：
- `Delete` / `Backspace`：
  - 如果有选中实体且该实体 `builtIn=false`：
  - 构造 `DeleteEntityCascadeCommand(selectedId)` 并 execute
  - 清除选中

---

### T3.2 DrawSegmentTool

**目标**：两次点击 Point Entity 创建 Segment Entity。

**产出文件**：`src/editor/tools/drawSegmentTool.ts`

**实现内容**（严格遵循 ARCH §9.2.2）：

**状态（Tool 私有）**：
- `startPointId: string | null`

**onActivate()**：
- 清除 `startPointId`

**onDeactivate()**：
- 清除 `startPointId`

**onPointerDown(event: ToolPointerEvent)**：
- 如果 `hitEntityId` 存在且命中的是 Point Entity：
  - 第一次点击（`startPointId === null`）：
    - 记录 `startPointId = hitEntityId`
    - 选中该点（`SelectionStore.select(hitEntityId)`）
  - 第二次点击（`startPointId !== null`）：
    - 如果 `hitEntityId === startPointId`：忽略（不能自连）
    - 获取 start Point 和 end Point 的 geometryId
    - 构造 `CreateEntityCommand('segment', { builtIn: false, geometryId, startPointId, endPointId: hitEntityId, style: { color: '#ff0000', dashed: false } })`
    - 调用 `HistoryStore.execute(command)`
    - 重置 `startPointId = null`，准备下一条线段
- 如果命中非 Point 实体或空白：忽略

**onKeyDown(event: KeyboardEvent)**：
- `Escape`：清除 `startPointId`，回到 SelectTool（通过 `ToolStore.setActiveTool('select')`）

**renderOverlay()**：
- 如果 `startPointId` 存在：返回预览线的描述（起点 → 鼠标当前位置）
- 具体渲染在阶段4实现，本阶段返回 `null` 或标记数据

---

### T3.3 CrossSectionTool

**目标**：多次点击 Point Entity 选定截面定义点，创建 Face(crossSection) + 交点 Points。

**产出文件**：`src/editor/tools/crossSectionTool.ts`

**实现内容**（严格遵循 ARCH §9.2.6）：

**状态（Tool 私有）**：
- `definingPointIds: string[]`（已选定的定义点）

**onActivate()**：
- 清除 `definingPointIds`

**onDeactivate()**：
- 清除 `definingPointIds`

**onPointerDown(event: ToolPointerEvent)**：
- 如果 `hitEntityId` 存在且命中的是 Point Entity：
  - 如果该点已在 `definingPointIds` 中：忽略（不重复选）
  - 将 `hitEntityId` 加入 `definingPointIds`
  - 选中该点
  - 如果 `definingPointIds.length >= 3`：
    - 获取 geometry Entity 和 BuilderResult
    - 调用 `computeCrossSection(definingPoints, builderResult)` 计算截面交点
    - 如果计算成功（交点 ≥ 3）：
      - 构造 `CreateCrossSectionCommand(geometryId, definingPointIds, intersections)`
      - 调用 `HistoryStore.execute(command)`
      - 清除 `definingPointIds`
    - 如果计算失败（交点 < 3 或不合法）：
      - 提示错误（预留，阶段4实现 UI 提示）
      - 清除 `definingPointIds`

**onKeyDown(event: KeyboardEvent)**：
- `Escape`：清除 `definingPointIds`，回到 SelectTool
- `Backspace`：撤销最后一个选定的定义点

**renderOverlay()**：
- 如果 `definingPointIds.length > 0`：返回已选定义点的高亮标记
- 本阶段返回 `null` 或标记数据

**注意**：
- `computeCrossSection` 来自 `src/engine/math/crossSection.ts`，本阶段直接引用
- 截面计算需要 BuilderResult，本阶段通过 `getBuilderResult()` 获取（阶段4实现缓存，本阶段暂用直接调用 `buildGeometry()`）

---

### T3.4 CoordSystemTool

**目标**：点击 Point Entity 选择坐标系原点。

**产出文件**：`src/editor/tools/coordSystemTool.ts`

**实现内容**（严格遵循 ARCH §5.3）：

**状态（Tool 私有）**：无

**onActivate()**：
- 无特殊操作

**onDeactivate()**：
- 无特殊操作

**onPointerDown(event: ToolPointerEvent)**：
- 如果 `hitEntityId` 存在且命中的是 Point Entity：
  - 检查当前是否已存在 CoordinateSystem Entity：
    - 如果存在：构造 `UpdatePropertiesCommand(coordSystemId, oldProps, { originPointId: hitEntityId })`
    - 如果不存在：构造 `CreateEntityCommand('coordinateSystem', { originPointId: hitEntityId, geometryId })`
  - 调用 `HistoryStore.execute(command)`
  - 自动退回 SelectTool（`ToolStore.setActiveTool('select')`）
- 如果命中非 Point 或空白：忽略

**onKeyDown(event: KeyboardEvent)**：
- `Escape`：回到 SelectTool

---

### T3.5 ToolStore 增强：工具注册初始化

**目标**：提供统一的工具注册入口，确保四个 Tool 可被注册到 ToolStore。

**产出文件**：`src/editor/tools/index.ts`（更新）

**实现内容**：
- 导出所有 Tool 实现
- 提供 `registerAllTools()` 函数：将四个 Tool 注册到 ToolStore，设置默认 activeTool 为 'select'
- 阶段4调用 `registerAllTools()` 完成初始化

---

### T3.6 类型检查 + 验证

**目标**：确保所有代码通过编译。

**验证内容**：
1. `pnpm tsc --noEmit` 通过
2. `pnpm lint` 通过
3. 确认旧应用 `pnpm dev` 仍可正常运行（不碰旧代码）

---

## 涉及文件范围

**新增文件**：

```
src/editor/tools/
├── types.ts                  # 已存在（阶段1创建）
├── selectTool.ts             # T3.1
├── drawSegmentTool.ts        # T3.2
├── crossSectionTool.ts       # T3.3
├── coordSystemTool.ts        # T3.4
└── index.ts                  # T3.5: 更新导出 + registerAllTools
```

**可能修改的文件**：
- `src/editor/index.ts` — 更新导出（添加 tools 模块）

**不修改的文件**：
- `src/store/` — 旧 Store 保持不动
- `src/hooks/` — 旧 Hook 保持不动
- `src/components/` — 旧组件保持不动
- `src/engine/` — 计算引擎保持不动（仅 import 使用）

---

## 依赖关系

```
T3.1 SelectTool ──────┐
T3.2 DrawSegmentTool ──┤ 四个 Tool 彼此独立，可并行实现
T3.3 CrossSectionTool ─┤
T3.4 CoordSystemTool ──┘
  ↓
T3.5 工具注册（依赖 T3.1~T3.4 全部完成）
  ↓
T3.6 验证
```

---

## 技术要点

### Tool 与 UI 的分离

本阶段的 Tool 是**纯逻辑层**——它们接收 `ToolPointerEvent`（由阶段4的 Canvas 事件分发填充）并调用 Store/Command。Tool 不直接操作 DOM 或 Three.js 对象。

```
阶段3完成后的数据流（逻辑层就绪）：
  ToolPointerEvent → Tool.onPointerDown() → Command → EntityStore

阶段4接入后的完整数据流：
  Canvas pointer event → 构造 ToolPointerEvent（含 raycasting hitEntityId）→ Tool → Command → EntityStore → Renderer 重渲染
```

### 连续操作（拖拽）的处理

SelectTool 的拖拽遵循 ARCH §3.4：
- `onPointerDown`：记录 beforeState
- `onPointerMove`：直接 `EntityStore.updateProperties`（不产生 Command）
- `onPointerUp`：构造 `MovePointCommand(before, after)` 并 execute

**本阶段 positionOverride 的 3D 坐标计算暂为占位**——实际的 raycasting → 世界坐标转换在阶段4接入 R3F 后实现。

### CrossSectionTool 的截面计算

- `computeCrossSection()` 来自 `src/engine/math/crossSection.ts`
- 需要 BuilderResult 输入，本阶段通过直接调用 `buildGeometry()` 获取
- 阶段4将引入 `builderResultCache`，届时改为从缓存获取

### 工具互斥（ARCH §5.4）

- ToolStore 已实现互斥逻辑（`setActiveTool` 先 deactivate 旧工具再 activate 新工具）
- Escape 回到 SelectTool 由 `src/editor/shortcuts.ts` 处理（阶段2已实现）
- CoordSystemTool 在原点选定后自动退回 SelectTool

---

## 注意事项

1. **不引入外部依赖**：所有 Tool 实现为纯 TypeScript 对象（实现 Tool 接口）
2. **renderOverlay 预留**：DrawSegmentTool 和 CrossSectionTool 的 `renderOverlay()` 本阶段返回 null，阶段4实现实际渲染
3. **raycasting 预留**：`ToolPointerEvent.intersection` 和 `hitEntityId` 由阶段4的事件分发层填充，本阶段 Tool 逻辑假设这些字段已正确填充
4. **engine 引用**：CrossSectionTool 引用 `src/engine/math/crossSection.ts` 的 `computeCrossSection`，需确认函数签名兼容
5. **向后兼容**：所有新增代码不影响旧应用运行

---

## 执行记录

### 2026-03-09 执行完成

**新增文件**：
- `src/editor/tools/selectTool.ts` — SelectTool 实现（选中/拖拽/删除）
- `src/editor/tools/drawSegmentTool.ts` — DrawSegmentTool 实现（两点画线段）
- `src/editor/tools/crossSectionTool.ts` — CrossSectionTool 实现（截面计算+创建）
- `src/editor/tools/coordSystemTool.ts` — CoordSystemTool 实现（选择坐标系原点）

**修改文件**：
- `src/editor/tools/index.ts` — 导出 4 个 Tool + `registerAllTools()`
- `src/editor/index.ts` — 添加 tools 模块导出

**技术决策**：
- CrossSectionTool 截面计算桥接：由于 `computeCrossSection()` 返回 `polygon: Vec3[]` 而非边交点信息，但 `CreateCrossSectionCommand` 需要 `CrossSectionIntersection[]`（edgeStart, edgeEnd, t），在 Tool 内实现了自己的平面拟合 + 边交点计算逻辑，避免修改 engine
- SelectTool 拖拽的 positionOverride 3D 坐标计算在阶段4接入 R3F 后实现，本阶段仅做框架预留
- Tool 状态使用模块级变量（let），符合纯对象 Tool 的设计模式

**门禁验证**：
- `pnpm tsc --noEmit` ✅ 通过
- `pnpm lint` ✅ 通过
- 不触碰 `src/components/` / `src/hooks/` / `src/store/` ✅
