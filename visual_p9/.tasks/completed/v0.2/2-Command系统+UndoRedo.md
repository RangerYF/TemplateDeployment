# 第2阶段：Command 系统 + Undo/Redo

**任务ID**: 03-09-phase2-Command系统
**风险等级**: L1（常规风险：纯新增 src/editor/commands/ 文件，不碰旧代码）
**流程路径**: MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**关联主计划**: `.tasks/active/v0.2/PROGRESSIVE-PLAN.md` 第2阶段
**关联架构文档**: `.tasks/active/v0.2/ARCHITECTURE.md` §3
**前置依赖**: 第1阶段（Entity 系统 + Store 重构）已完成
**状态**: ✅ 已完成

---

## 任务目标

建立所有实体变更的统一入口——Command 模式，使每个用户操作都封装为可逆命令，支持完整的 Ctrl+Z / Ctrl+Y 撤销重做。实现 V0.2 所需的全部 Command + 全局快捷键绑定。

**约束**：纯新增 `src/editor/commands/` 和 `src/editor/shortcuts.ts`，不碰旧代码，旧应用始终可正常运行。

---

## 验收标准

- [x] 通过 CommandProcessor（HistoryStore.execute）创建/删除/修改实体后，Ctrl+Z 可撤销、Ctrl+Y 可重做
- [x] BatchCommand 可将多个操作合并为一个 undo 单元
- [x] 连续操作（模拟 mousedown→mousemove→mouseup）只产生一个 Command
- [x] 历史栈上限（50条）生效，不会无限增长
- [x] `pnpm tsc --noEmit` 通过
- [x] `pnpm lint` 通过
- [x] 不触碰 `src/components/`、`src/hooks/`、`src/store/`，旧应用正常运行

---

## 阶段1产出依赖（已就绪）

| 模块 | 文件 | 阶段2使用方式 |
|------|------|---------------|
| Command 接口 | `src/editor/commands/types.ts` | 已定义 `Command { type, label, execute(), undo() }`，各具体 Command 实现此接口 |
| HistoryStore | `src/editor/store/historyStore.ts` | 已实现 `execute(cmd)`/`undo()`/`redo()` + 50条栈上限，本阶段直接使用 |
| EntityStore | `src/editor/store/entityStore.ts` | 各 Command 内部调用 `createEntity`/`deleteEntity`/`updateProperties`/`cascadeDelete` 等方法 |
| Entity 类型 | `src/editor/entities/types.ts` | 各 Command 使用类型定义 |
| Signal | `src/editor/signals.ts` | HistoryStore 已接入 `commandExecuted` Signal |

---

## 子任务清单

### T2.1 CreateEntityCommand

**目标**：封装创建实体操作为可逆命令。

**产出文件**：`src/editor/commands/createEntity.ts`

**实现逻辑**：
- 构造参数：`type: EntityType`, `properties: EntityPropertiesMap[T]`
- `execute()`：调用 `useEntityStore.getState().createEntity(type, properties)`，记录返回的 `entity.id`
- `undo()`：调用 `useEntityStore.getState().deleteEntity(id)`
- `label`: `"创建${type}"`

---

### T2.2 DeleteEntityCommand

**目标**：封装删除单个实体操作（不含级联）为可逆命令。

**产出文件**：`src/editor/commands/deleteEntity.ts`

**实现逻辑**：
- 构造参数：`entityId: string`
- `execute()`：记录完整 entity 快照，调用 `deleteEntity(entityId)`
- `undo()`：调用 `createEntity` 恢复快照（需注意恢复原 ID，而非分配新 ID）
- **注意**：undo 恢复时需要特殊处理——直接写入 entities Record 而非走 createEntity（以保持原 ID）。考虑在 EntityStore 中添加 `restoreEntity(entity: Entity)` 辅助方法

---

### T2.3 UpdatePropertiesCommand

**目标**：封装属性更新操作为可逆命令（通用，适用于任何实体类型的 properties 修改）。

**产出文件**：`src/editor/commands/updateProperties.ts`

**实现逻辑**：
- 构造参数：`entityId: string`, `oldProperties: Partial<Properties>`, `newProperties: Partial<Properties>`
- `execute()`：调用 `updateProperties(entityId, newProperties)`
- `undo()`：调用 `updateProperties(entityId, oldProperties)`
- `label`: `"更新${entityType}属性"`

---

### T2.4 BatchCommand

**目标**：将多个 Command 组合为一个 undo 原子单元。

**产出文件**：`src/editor/commands/batch.ts`

**实现逻辑**：
- 构造参数：`label: string`, `commands: Command[]`
- `execute()`：按顺序执行所有子 Command
- `undo()`：按逆序撤销所有子 Command
- 用于截面创建（多个交点 Point + 一个 Face 作为原子操作）等场景

---

### T2.5 ChangeGeometryTypeCommand

**目标**：封装几何体类型切换（重置性操作，需完整状态快照）。

**产出文件**：`src/editor/commands/changeGeometryType.ts`

**实现逻辑**（严格遵循 ARCH §3.5）：
- 构造参数：`geometryId: string`, `newGeometryType: GeometryType`, `newParams: GeometryParams`, `newBuilderResult: BuilderResult`
- `execute()`：
  1. 快照当前 geometry 实体的 `geometryType` + `params`
  2. 快照所有关联实体（`getRelatedEntities(geometryId)`，不含 geometry 自身）
  3. 删除所有关联实体
  4. 更新 geometry 实体的 `geometryType` + `params`
  5. 调用 `createBuiltInEntities(geometryId, newBuilderResult)` 创建新 builtIn 子实体
- `undo()`：
  1. 删除当前所有关联实体（新 builtIn 子实体）
  2. 恢复 geometry 实体的旧 `geometryType` + `params`
  3. 恢复所有快照的关联实体
- **注意**：快照恢复需要保持原 ID → 使用 `restoreEntity()` 方法

---

### T2.6 UpdateGeometryParamsCommand

**目标**：封装几何体参数修改（滑块调参，连续操作以 mouseup 为提交点）。

**产出文件**：`src/editor/commands/updateGeometryParams.ts`

**实现逻辑**（严格遵循 ARCH §9.2.5）：
- 构造参数：`geometryId: string`, `oldParams: GeometryParams`, `newParams: GeometryParams`, `topologyChanged: boolean`, `oldBuiltInSnapshot?: Entity[]`, `newBuilderResult?: BuilderResult`
- `execute()`：
  1. 更新 geometry 实体的 params
  2. 如果 `topologyChanged`：调用 `rebuildBuiltInEntities(geometryId, newBuilderResult)`
- `undo()`：
  1. 恢复 geometry 实体的旧 params
  2. 如果 `topologyChanged`：恢复 `oldBuiltInSnapshot`
- **连续操作处理**：Command 本身不负责"合并 mousemove"，由调用方（阶段3的 Tool 或阶段4的滑块组件）在 mouseup 时构造一个 Command

---

### T2.7 MovePointCommand

**目标**：封装顶点拖拽操作。

**产出文件**：`src/editor/commands/movePoint.ts`

**实现逻辑**（严格遵循 ARCH §9.2.1）：
- 构造参数：`pointId: string`, `oldPositionOverride: [number,number,number] | undefined`, `newPositionOverride: [number,number,number] | undefined`
- `execute()`：调用 `updateProperties(pointId, { positionOverride: newPositionOverride })`
- `undo()`：调用 `updateProperties(pointId, { positionOverride: oldPositionOverride })`
- **说明**：连续拖拽期间直接更新 EntityStore（不产生 Command），mouseup 时构造本 Command

---

### T2.8 RenameEntityCommand

**目标**：封装实体重命名操作（统一适用于所有带 label 的实体）。

**产出文件**：`src/editor/commands/renameEntity.ts`

**实现逻辑**：
- 构造参数：`entityId: string`, `oldLabel: string`, `newLabel: string`
- `execute()`：调用 `updateProperties(entityId, { label: newLabel })`
- `undo()`：调用 `updateProperties(entityId, { label: oldLabel })`

---

### T2.9 CreateCrossSectionCommand

**目标**：封装截面创建（Face + 交点 Points 打包为原子操作）。

**产出文件**：`src/editor/commands/createCrossSection.ts`

**实现逻辑**（严格遵循 ARCH §9.2.6）：
- 构造参数：`geometryId: string`, `definingPointIds: string[]`, `intersections: Array<{ edgeStart: number; edgeEnd: number; t: number }>`, 各交点 label
- 内部使用 `BatchCommand` 封装：
  1. 为每个交点创建 `CreateEntityCommand('point', { builtIn: false, geometryId, constraint: { type: 'edge', edgeStart, edgeEnd, t }, label })`
  2. 创建 `CreateEntityCommand('face', { builtIn: false, geometryId, pointIds: 交点IDs, source: { type: 'crossSection', definingPointIds } })`
- `execute()` / `undo()` 委托给内部 `BatchCommand`

---

### T2.10 UpdateCrossSectionCommand

**目标**：封装截面响应式更新（定义点移动/几何体参数变化时，交点 t 值和 pointIds 变化）。

**产出文件**：`src/editor/commands/updateCrossSection.ts`

**实现逻辑**（严格遵循 ARCH §2.13）：
- 构造参数：`faceId: string`, `oldIntersectionSnapshot: Entity[]`, `newIntersections: Array<{...}>`, 新交点 label
- `execute()`：
  1. 删除旧交点 Point Entity
  2. 创建新交点 Point Entity
  3. 更新 Face Entity 的 pointIds
- `undo()`：
  1. 删除新交点 Point Entity
  2. 恢复旧交点 Point Entity
  3. 恢复 Face Entity 的旧 pointIds

---

### T2.11 DeleteEntityCascadeCommand

**目标**：封装带级联清理的实体删除操作。

**产出文件**：`src/editor/commands/deleteEntityCascade.ts`

**实现逻辑**（严格遵循 ARCH §9.2.7）：
- 构造参数：`entityId: string`
- `execute()`：
  1. 调用 `cascadeDelete(entityId)` 获取所有被删除的实体列表
  2. 保存为快照（用于 undo）
- `undo()`：
  1. 按创建顺序（ID 升序）恢复所有快照实体
- **注意**：恢复顺序很重要——先恢复被引用的实体（如 Point），再恢复引用方（如 Segment/Face）

---

### T2.12 EntityStore 补充：restoreEntity 方法

**目标**：为 undo 恢复场景提供"按原 ID 恢复实体"的能力。

**修改文件**：`src/editor/store/entityStore.ts`

**实现内容**：
- 新增 `restoreEntity(entity: Entity): void`：将实体以原 ID 写回 entities Record，不分配新 ID
- 新增 `restoreEntities(entities: Entity[]): void`：批量恢复（按数组顺序）
- 两个方法都发射对应的 `entityCreated` Signal

**注意**：`restoreEntity` 不更新 `nextId`，但需确保 `nextId` 始终大于所有已存在实体 ID（避免 ID 冲突）

---

### T2.13 全局快捷键绑定

**目标**：实现 Ctrl+Z / Ctrl+Y / Escape 快捷键。

**产出文件**：`src/editor/shortcuts.ts`

**实现内容**（严格遵循 ARCH 附录C）：
- `Ctrl+Z` / `Cmd+Z` → `useHistoryStore.getState().undo()`
- `Ctrl+Y` / `Cmd+Shift+Z` → `useHistoryStore.getState().redo()`
- `Escape` → `useToolStore.getState().setActiveTool('select')` + `useSelectionStore.getState().clear()`
- 提供 `setupShortcuts()` / `teardownShortcuts()` 函数（绑定/解绑 document keydown 事件）
- **注意**：本阶段只定义绑定函数，不自动执行（阶段4接入 UI 时调用 `setupShortcuts()`）

---

### T2.14 导出更新 + 类型检查

**目标**：更新 `src/editor/commands/index.ts` 导出所有 Command，确保编译通过。

**验证内容**：
1. 更新 `src/editor/commands/index.ts` 导出所有 Command 类
2. 更新 `src/editor/index.ts` 导出 shortcuts
3. `pnpm tsc --noEmit` 通过
4. `pnpm lint` 通过
5. 旧应用 `pnpm dev` 仍可正常运行

---

## 涉及文件范围

**新增文件**：

```
src/editor/
├── commands/
│   ├── types.ts                  # 已存在（阶段1创建）
│   ├── createEntity.ts           # T2.1
│   ├── deleteEntity.ts           # T2.2
│   ├── updateProperties.ts       # T2.3
│   ├── batch.ts                  # T2.4
│   ├── changeGeometryType.ts     # T2.5
│   ├── updateGeometryParams.ts   # T2.6
│   ├── movePoint.ts              # T2.7
│   ├── renameEntity.ts           # T2.8
│   ├── createCrossSection.ts     # T2.9
│   ├── updateCrossSection.ts     # T2.10
│   ├── deleteEntityCascade.ts    # T2.11
│   └── index.ts                  # T2.14: 更新导出
├── shortcuts.ts                  # T2.13
└── index.ts                      # T2.14: 更新导出
```

**修改文件**：
- `src/editor/store/entityStore.ts` — T2.12: 新增 `restoreEntity()` / `restoreEntities()` 方法

**不修改的文件**：
- `src/store/` — 旧 Store 保持不动
- `src/hooks/` — 旧 Hook 保持不动
- `src/components/` — 旧组件保持不动
- `src/engine/` — 计算引擎保持不动

---

## 依赖关系

```
T2.12 restoreEntity（EntityStore 补充）
  ↓
T2.1 CreateEntityCommand ─┐
T2.2 DeleteEntityCommand ─┤ 基础 Command（互相独立）
T2.3 UpdatePropertiesCommand ┤
T2.4 BatchCommand ────────┘
  ↓
T2.5 ChangeGeometryTypeCommand（依赖 T2.12 restoreEntity）
T2.6 UpdateGeometryParamsCommand（依赖 T2.12 restoreEntity）
T2.7 MovePointCommand（依赖 T2.3 的模式）
T2.8 RenameEntityCommand（依赖 T2.3 的模式）
T2.9 CreateCrossSectionCommand（依赖 T2.1 + T2.4 BatchCommand）
T2.10 UpdateCrossSectionCommand（依赖 T2.12 restoreEntity）
T2.11 DeleteEntityCascadeCommand（依赖 T2.12 restoreEntity）
  ↓
T2.13 全局快捷键
  ↓
T2.14 导出 + 验证
```

可并行执行：T2.1 / T2.2 / T2.3 / T2.4（基础 Command，彼此独立）
可并行执行：T2.5 / T2.6 / T2.7 / T2.8 / T2.9 / T2.10 / T2.11（复合 Command，彼此独立，但都依赖基础 Command 和 T2.12）

---

## 技术要点

### 连续操作的 Command 粒度（ARCH §3.4）

```
拖拽/滑块操作：
  mousedown → 记录 beforeState（由调用方负责）
  mousemove → 实时更新 EntityStore.updateProperties（不产生 Command）
  mouseup   → 构造 Command(beforeState, afterState)，调用 HistoryStore.execute(cmd)

非连续操作（按钮点击等）：
  直接构造 Command 并 execute
```

Command 本身不感知连续操作——它只描述 "从 A 状态到 B 状态"。连续操作的合并逻辑由调用方（Tool / UI 组件）处理。

### undo 恢复的 ID 一致性

undo 时必须恢复实体原始 ID，否则其他实体的引用关系会断裂。因此不能用 `createEntity()`（它分配新 ID），而要用 `restoreEntity()`（写入原 ID）。

### ChangeGeometryTypeCommand 的快照策略

几何体类型切换涉及大量实体删除和重建，是最复杂的 Command：
- execute 时：快照所有关联实体 → 删除 → 更新 geometry → 重建 builtIn
- undo 时：删除新 builtIn → 恢复 geometry → 恢复所有关联实体快照
- 快照使用 `JSON.parse(JSON.stringify(entities))` 深拷贝（properties 全部可序列化）

---

## 注意事项

1. **不引入外部依赖**：所有 Command 实现为纯 TypeScript 类
2. **Command 构造时机**：Command 在构造时不执行，调用 `HistoryStore.execute(cmd)` 时才执行
3. **Signal 已在 HistoryStore 中接入**：`execute()`/`undo()`/`redo()` 后自动发射 `commandExecuted` Signal，各 Command 不需额外发射
4. **EntityStore 的 Signal 已接入**：`createEntity`/`deleteEntity`/`updateProperties` 已自动发射 `entityCreated/Updated/Deleted` Signal
5. **快捷键仅定义不激活**：`shortcuts.ts` 只导出 `setupShortcuts()`，在阶段4接入 UI 时才调用
6. **向后兼容**：所有新增代码不影响旧应用运行

---

## 执行记录

### 2026-03-09 执行完成

**T2.12** EntityStore 补充 `restoreEntity`/`restoreEntities` ✅
- 新增 `restoreEntity(entity)`: 按原 ID 写回实体，确保 nextId 一致性
- 新增 `restoreEntities(entities[])`: 批量恢复，单次 set 优化性能

**T2.1** CreateEntityCommand ✅
- 支持首次 execute 分配新 ID，redo 时通过 restoreEntity 恢复原 ID

**T2.2** DeleteEntityCommand ✅
- execute 时深拷贝完整快照，undo 时 restoreEntity 恢复

**T2.3** UpdatePropertiesCommand ✅
- 通用属性更新，支持自定义 label

**T2.4** BatchCommand ✅
- 顺序 execute，逆序 undo

**T2.5** ChangeGeometryTypeCommand ✅
- 完整状态快照策略：关联实体快照 + geometry 属性快照

**T2.6** UpdateGeometryParamsCommand ✅
- 支持 topologyChanged 标志控制是否重建 builtIn

**T2.7** MovePointCommand ✅
- positionOverride 更新/撤销

**T2.8** RenameEntityCommand ✅
- label 更新/撤销

**T2.9** CreateCrossSectionCommand ✅
- 内部 BatchCommand 封装：交点 Points + Face 原子操作

**T2.10** UpdateCrossSectionCommand ✅
- 旧交点删除 + 新交点创建 + Face pointIds 更新

**T2.11** DeleteEntityCascadeCommand ✅
- 委托 cascadeDelete，undo 时按 ID 升序恢复

**T2.13** 全局快捷键 ✅
- Ctrl+Z/Cmd+Z → undo
- Ctrl+Y/Cmd+Shift+Z → redo
- Escape → SelectTool + 清除选中

**T2.14** 导出 + 验证 ✅
- `pnpm tsc --noEmit` 通过
- `pnpm lint` 通过
- 旧代码无改动，旧应用不受影响
