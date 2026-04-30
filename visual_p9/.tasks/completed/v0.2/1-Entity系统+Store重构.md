# 第1阶段：Entity 系统 + Event 系统 + Store 重构

**任务ID**: 03-09-phase1-Entity系统
**风险等级**: L1（常规风险：纯新增 src/editor/ 目录，不碰旧代码，旧应用始终可运行）
**流程路径**: MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**关联主计划**: `.tasks/active/v0.2/PROGRESSIVE-PLAN.md` 第1阶段
**关联架构文档**: `.tasks/active/v0.2/ARCHITECTURE.md`
**前置依赖**: 第0阶段（架构设计文档）已完成
**状态**: ✅ 已完成

---

## 任务目标

建立整个编辑器架构的数据基础和通信基础——统一实体模型（Entity）、实体管理容器（EntityStore）、选中管理（SelectionStore）、工具状态（ToolStore）、历史栈（HistoryStore）、类型安全的事件系统（Signal），替换现有 ~40 字段的单体 Store。

**约束**：纯新增 `src/editor/` 目录，不碰 `src/store/`、`src/hooks/`、`src/components/` 等旧代码，旧应用始终可正常运行。

---

## 验收标准

- [ ] Entity 类型系统定义完整，覆盖 V0.1 所有数据概念（geometry / point / segment / face / coordinateSystem / circumSphere / circumCircle）
- [ ] EntityStore CRUD + 引用查询 + 级联删除可用，按类型查询正确
- [ ] Signal 系统可正常发布/订阅事件
- [ ] 所有 Entity properties 可通过 `JSON.stringify` / `JSON.parse` 往返
- [ ] 四个 Store（EntityStore / SelectionStore / ToolStore / HistoryStore）结构清晰，职责分离
- [ ] `pnpm tsc --noEmit` 通过
- [ ] 不触碰 `src/components/`、`src/hooks/`、`src/store/`，旧应用正常运行

---

## 子任务清单

### T1.1 Entity 类型系统定义

**目标**：在 `src/editor/entities/types.ts` 中定义完整的 Entity 类型体系。

**产出文件**：`src/editor/entities/types.ts`

**实现内容**（严格遵循 ARCH §2）：

1. `Entity` 基础接口：`id: string`, `type: EntityType`, `properties: EntityProperties`, `visible: boolean`
2. `EntityType` 联合类型：`'geometry' | 'point' | 'segment' | 'face' | 'coordinateSystem' | 'circumSphere' | 'circumCircle'`
3. `GeometryProperties`：`geometryType` + `params`（复用 `src/types/geometry.ts` 的 GeometryType / GeometryParams）
4. `PointProperties`：`builtIn`, `geometryId`, `constraint`（vertex / edge / curve / coordinate / free）, `label`, `positionOverride?`
5. `SegmentProperties`：`builtIn`, `geometryId`, `startPointId`, `endPointId`, `style: { color, dashed }`, `label?`
6. `FaceProperties`：`builtIn`, `geometryId`, `pointIds: string[]`, `source`（geometry / crossSection / custom）
7. `CoordinateSystemProperties`：`originPointId`, `geometryId`
8. `CircumSphereProperties`：`geometryId`
9. `CircumCircleProperties`：`pointIds: [string, string, string]`, `geometryId`
10. 类型映射：`EntityType → Properties` 的映射类型（`EntityPropertiesMap`），确保类型安全
11. 类型守卫辅助函数：`isPointEntity()`, `isSegmentEntity()` 等

**约束**：
- 所有 properties 必须为纯数据，可 JSON 序列化（无函数、无 Three.js 对象）
- 引用统一使用 Entity ID（string），不引入 PointRef 联合类型
- 导入 `src/types/geometry.ts` 中的 GeometryType 和各 Params 类型

**产出**：`src/editor/entities/types.ts` + `src/editor/entities/index.ts`

---

### T1.2 Signal 事件系统

**目标**：实现轻量的类型安全的发布-订阅系统。

**产出文件**：`src/editor/signals.ts`

**实现内容**（严格遵循 ARCH §4）：

1. `Signal<T>` 类：
   - `subscribe(listener: (data: T) => void): () => void` — 返回取消订阅函数
   - `emit(data: T): void`
   - `clear(): void`
2. 全局 Signal 实例（按 ARCH §4.2）：
   - `entityCreated: Signal<{ entity: Entity }>`
   - `entityUpdated: Signal<{ entity: Entity; changes: string[] }>`
   - `entityDeleted: Signal<{ entity: Entity }>`
   - `selectionChanged: Signal<{ selectedIds: Set<string>; primaryId: string | null }>`
   - `toolChanged: Signal<{ toolId: string }>`
   - `commandExecuted: Signal<{ command: Command; direction: 'do' | 'undo' | 'redo' }>`
   - `geometryRebuilt: Signal<{ geometryId: string }>`

**注意**：`commandExecuted` 引用的 `Command` 类型此处用前向声明或 `unknown` 占位，阶段2实现 Command 后回补。

**产出**：`src/editor/signals.ts`

---

### T1.3 EntityStore 实现

**目标**：用 Zustand 实现 Entity 的统一管理容器。

**产出文件**：`src/editor/store/entityStore.ts`

**实现内容**（严格遵循 ARCH §2.11 + §2.12）：

1. **状态**：
   - `entities: Map<string, Entity>`
   - `nextId: number`（递增 ID 策略）
   - `activeGeometryId: string | null`

2. **CRUD 方法**：
   - `createEntity(type, properties) → Entity`：分配递增 ID，加入 Map，发射 `entityCreated` Signal
   - `deleteEntity(id)`：从 Map 移除，发射 `entityDeleted` Signal
   - `updateProperties(id, patch)`：浅合并 properties，发射 `entityUpdated` Signal
   - `getEntity(id) → Entity | undefined`

3. **查询快捷方法**：
   - `getActiveGeometry()`：返回 `activeGeometryId` 对应的 geometry 实体
   - `getCoordinateSystem()`：查找唯一的 coordinateSystem 实体
   - `getCircumSphere()`：查找唯一的 circumSphere 实体
   - `getEntitiesByType(type)`：过滤指定类型的所有实体
   - `getBuiltInEntities(geometryId)`：返回 geometryId 匹配且 builtIn=true 的所有 point/segment/face
   - `getRelatedEntities(geometryId)`：返回 geometryId 匹配的所有实体（含 builtIn + 用户创建）

4. **引用查询**：
   - `getReferencingEntities(entityId)`：遍历所有实体，检查 properties 中是否包含目标 ID（检查字段见 ARCH §2.12）

5. **级联删除**：
   - `cascadeDelete(entityId) → Entity[]`：删除实体并级联清理孤立子实体（见 ARCH §2.12 流程）

6. **批量操作**：
   - `createBuiltInEntities(geometryId, builderResult)`：根据 BuilderResult 创建 builtIn 的 Point/Segment/Face 实体
   - `rebuildBuiltInEntities(geometryId, builderResult)`：拓扑变化时重建（删除旧 builtIn + 级联清理 + 创建新 builtIn）

**约束**：
- Zustand Store，使用 `immer` 中间件或手动不可变更新
- Map 序列化注意：Zustand devtools 需要 Map → 普通对象的转换，考虑是否使用 `Record<string, Entity>` 代替 `Map`
- 发射 Signal 时机：在状态实际变更后

**产出**：`src/editor/store/entityStore.ts`

---

### T1.4 SelectionStore 实现

**目标**：独立的选中状态管理。

**产出文件**：`src/editor/store/selectionStore.ts`

**实现内容**（严格遵循 ARCH §6）：

1. **状态**：
   - `selectedIds: Set<string>`（V0.2 单选，但数据结构预留多选）
   - `primaryId: string | null`

2. **方法**：
   - `select(entityId)`：设置 selectedIds = {entityId}，primaryId = entityId，发射 `selectionChanged` Signal
   - `deselect(entityId)`：从 selectedIds 移除，更新 primaryId
   - `clear()`：清空 selectedIds 和 primaryId
   - `toggle(entityId)`：切换选中状态

**约束**：
- 独立 Zustand Store，不与 EntityStore 耦合
- Set 序列化注意：考虑是否内部使用 `string[]` 代替 `Set<string>` 以兼容 Zustand devtools

**产出**：`src/editor/store/selectionStore.ts`

---

### T1.5 ToolStore 实现

**目标**：工具状态管理框架。

**产出文件**：`src/editor/store/toolStore.ts`

**实现内容**（严格遵循 ARCH §5.2）：

1. **状态**：
   - `activeToolId: string`（默认 'select'）
   - `tools: Map<string, Tool>`

2. **方法**：
   - `registerTool(tool: Tool)`：注册工具到 tools Map
   - `setActiveTool(toolId)`：先调用当前工具 `onDeactivate()`，再设置 activeToolId，再调用新工具 `onActivate()`，发射 `toolChanged` Signal
   - `getActiveTool() → Tool`

**注意**：`Tool` 接口定义放在 `src/editor/tools/types.ts`（本阶段先定义接口，阶段3实现具体 Tool）。本阶段 ToolStore 只需 Tool 接口的类型引用。

**产出**：`src/editor/store/toolStore.ts` + `src/editor/tools/types.ts`（Tool 接口定义）

---

### T1.6 HistoryStore 实现

**目标**：undo/redo 栈结构（为阶段2 Command 系统预留）。

**产出文件**：`src/editor/store/historyStore.ts`

**实现内容**（严格遵循 ARCH §3.2）：

1. **状态**：
   - `undoStack: Command[]`
   - `redoStack: Command[]`
   - `canUndo: boolean`（derived）
   - `canRedo: boolean`（derived）

2. **方法（CommandProcessor 职责）**：
   - `execute(command: Command)`：调用 `command.execute()`，压入 undoStack，清空 redoStack，发射 `commandExecuted` Signal
   - `undo()`：弹出 undoStack 顶部，调用 `command.undo()`，压入 redoStack
   - `redo()`：弹出 redoStack 顶部，调用 `command.execute()`，压入 undoStack

3. **边界处理**：
   - 栈深度上限：50 条（ARCH §3.2）
   - 超出上限时丢弃最旧的 Command

**注意**：`Command` 接口定义放在 `src/editor/commands/types.ts`（本阶段先定义接口，阶段2实现具体 Command）。

**产出**：`src/editor/store/historyStore.ts` + `src/editor/commands/types.ts`（Command 接口定义）

---

### T1.7 Store 导出 + 编辑器入口

**目标**：统一导出所有 Store 和模块，建立 `src/editor/` 的入口文件。

**产出文件**：
- `src/editor/store/index.ts` — 导出四个 Store
- `src/editor/index.ts` — 编辑器模块总入口
- `src/editor/tools/index.ts` — Tool 导出（本阶段仅导出类型）
- `src/editor/commands/index.ts` — Command 导出（本阶段仅导出类型）

---

### T1.8 类型检查 + 序列化验证

**目标**：确保所有代码通过编译，Entity properties 可 JSON 序列化。

**验证内容**：

1. `pnpm tsc --noEmit` 通过
2. 编写验证脚本或在入口文件中添加类型断言：
   - 创建一个 geometry Entity，JSON.stringify → JSON.parse → 验证字段完整
   - 创建 point/segment/face Entity，验证序列化往返
3. 确认旧应用 `pnpm dev` 仍可正常运行（不碰旧代码）

---

## 涉及文件范围

**新增文件（全部在 `src/editor/` 下）**：

```
src/editor/
├── entities/
│   ├── types.ts              # T1.1: Entity 类型体系
│   └── index.ts              # T1.1: 导出
├── store/
│   ├── entityStore.ts        # T1.3: EntityStore
│   ├── selectionStore.ts     # T1.4: SelectionStore
│   ├── toolStore.ts          # T1.5: ToolStore
│   ├── historyStore.ts       # T1.6: HistoryStore
│   └── index.ts              # T1.7: Store 导出
├── commands/
│   ├── types.ts              # T1.6: Command 接口定义
│   └── index.ts              # T1.7: 导出
├── tools/
│   ├── types.ts              # T1.5: Tool/ToolPointerEvent 接口定义
│   └── index.ts              # T1.7: 导出
├── signals.ts                # T1.2: Signal 系统
└── index.ts                  # T1.7: 总入口
```

**不修改的文件**：
- `src/store/` — 旧 Store 保持不动
- `src/hooks/` — 旧 Hook 保持不动
- `src/components/` — 旧组件保持不动
- `src/engine/` — 计算引擎保持不动
- `src/types/` — 仅 import，不修改

---

## 依赖关系

```
T1.1 Entity 类型定义
  ↓
T1.2 Signal 系统（依赖 Entity 类型 + Command 类型占位）
  ↓
T1.3 EntityStore（依赖 Entity 类型 + Signal）
T1.4 SelectionStore（依赖 Signal）
T1.5 ToolStore（依赖 Tool 类型定义 + Signal）
T1.6 HistoryStore（依赖 Command 类型定义 + Signal）
  ↓
T1.7 导出整合（依赖 T1.1~T1.6）
  ↓
T1.8 验证（依赖 T1.7）
```

可并行执行：T1.3 / T1.4 / T1.5 / T1.6（都依赖 T1.1 + T1.2，但彼此独立）

---

## 技术决策参考

从 ARCHITECTURE.md 中提取的本阶段相关决策：

| 决策 | 结论 | 来源 |
|------|------|------|
| Entity ID 策略 | 递增整数字符串（"1", "2", "3"...） | ARCH §2.2 |
| 引用机制 | 统一 Entity ID，不用 PointRef | ARCH 附录A |
| Store 架构 | 四个独立 Zustand Store | ARCH §1.3, D4 |
| 事件通信 | Zustand subscribe 为主 + 轻量 Signal 补充 | ARCH D5 |
| Map vs Record | 需评估 Zustand devtools 兼容性，决定使用 Map 还是 Record | 执行时决定 |
| Set vs Array | SelectionStore 内部实现需评估 Set vs string[] | 执行时决定 |

---

## 注意事项

1. **不引入外部依赖**：除 Zustand（已在项目中）外，不新增第三方库
2. **类型先行**：T1.1 Entity 类型是基础中的基础，务必与 ARCHITECTURE.md 对齐
3. **序列化约束**：所有 Entity properties 禁止包含不可序列化的值（函数、Symbol、Three.js 对象等）
4. **builtIn 实体生命周期**：`createBuiltInEntities` 需要从 `BuilderResult` 派生 Point/Segment/Face 数量和属性，注意不同几何体类型的差异（多面体 vs 曲面体，见 ARCH §2.13-§2.14）
5. **级联删除复杂度**：`cascadeDelete` 的递归逻辑需仔细处理，避免删除仍被引用的实体
6. **向后兼容**：所有新增代码不影响旧应用运行，`pnpm dev` 必须正常

---

## 执行记录

### 2026-03-09 执行完成

**技术决策（执行时确定）**：
- Map vs Record → 选用 `Record<string, Entity>`，Zustand devtools 兼容性好、JSON 序列化简单
- Set vs Array → SelectionStore 内部使用 `string[]`，同理兼容性

**T1.1 Entity 类型系统** ✅
- `src/editor/entities/types.ts`：完整定义 Entity/EntityType/7 种 Properties/EntityPropertiesMap/类型守卫
- `src/editor/entities/index.ts`：统一导出

**T1.2 Signal 事件系统** ✅
- `src/editor/signals.ts`：Signal<T> 类 + 7 个全局 Signal 实例
- Command 类型用 `CommandLike` 占位，阶段2回补

**T1.3 EntityStore** ✅
- `src/editor/store/entityStore.ts`：CRUD + 6 个查询快捷方法 + 引用查询 + 级联删除 + createBuiltInEntities/rebuildBuiltInEntities

**T1.4 SelectionStore** ✅
- `src/editor/store/selectionStore.ts`：select/deselect/clear/toggle + Signal 广播

**T1.5 ToolStore** ✅
- `src/editor/store/toolStore.ts`：registerTool/setActiveTool/getActiveTool
- `src/editor/tools/types.ts`：Tool + ToolPointerEvent 接口

**T1.6 HistoryStore** ✅
- `src/editor/store/historyStore.ts`：execute/undo/redo + 50 条栈深度上限
- `src/editor/commands/types.ts`：Command 接口

**T1.7 导出整合** ✅
- `src/editor/store/index.ts`、`src/editor/commands/index.ts`、`src/editor/tools/index.ts`、`src/editor/index.ts`

**T1.8 验证** ✅
- `pnpm tsc --noEmit` 通过
- `pnpm lint` 通过
- 未触碰 src/components/、src/hooks/、src/store/，旧应用不受影响

**状态**: ✅ 已完成
