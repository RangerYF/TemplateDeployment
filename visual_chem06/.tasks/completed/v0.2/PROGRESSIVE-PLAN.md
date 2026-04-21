# V0.2 编辑器架构重构 — 渐进式开发计划

## 版本目标

将 V0.1 的"功能堆叠式"代码重构为"3D 编辑器"七系统架构（Entity / Command / Event / Tool / Selection / Property / Renderer），用户体验与 V0.1 完全一致，但内部架构从"按功能组织"转变为"按编辑器核心概念组织"，为 V0.3 的功能扩展（角度度量、面交互、坐标系重构、新几何体等）建立统一底座。

## 重构策略

采用**方案 C：新目录开发 + 旧代码保持可运行**（详见 `推进方案.md`）：
1. 阶段 1-3：在 `src/editor/` 纯新增核心系统，不碰旧代码，旧应用始终可运行
2. 阶段 4-6：集中改造 `src/components/` 接入新系统，替换旧 store/hooks 引用
3. 阶段 7-8：删除旧代码，全面回归验证
4. 每步有验证手段（tsc 类型检查 + 浏览器运行），保持 Claude Code 的"改完即验证"反馈链

## 开发流程总览

```
阶段0: 整体架构设计（七系统接口契约 + 数据流 + 目录结构 → 架构蓝图文档）
  → 阶段1: Entity系统 + Event系统 + Store重构（数据+通信基础）           ┐
    → 阶段2: Command系统 + Undo/Redo（变更层）                          ├ 纯新增 src/editor/
      → 阶段3: Tool系统框架（交互层定义，纯新增）                        ┘
        → 阶段4: Renderer迁移 + Scene3D改造 + 交互接入（视觉+交互切换）  ┐
          → 阶段5: 辅助功能实体化（坐标系/外接球/外接圆→Entity+Renderer+Inspector）├ 改造 src/components/
            → 阶段6: Property系统 + 面板重构（呈现层）                    ┘
              → 阶段7: 展开图/三视图/度量迁移（读取EntityStore）          ┐
                → 阶段8: 回归验证 + 旧代码清理                           ┘ 清理旧代码
```

## 串行执行阶段

---

### 第0阶段：整体架构设计 ⏱️ 3-4天

**目标**：在写任何代码之前，产出一份完整的架构设计文档，统筹七个核心系统的接口契约、数据流向、模块边界、目录结构，作为后续所有实现阶段的蓝图。

**主要任务**：
1. 七系统职责边界与依赖关系：明确 Entity / Command / Event / Tool / Selection / Property / Renderer 各系统的职责、对外接口、系统间调用方向（谁依赖谁、谁不能直接引用谁），绘制系统依赖关系图
2. Entity 类型体系完整定义：所有实体类型（geometry / point / segment / face / coordinateSystem / circumSphere / circumCircle）的 properties 结构、实体间引用关系（含引用查询与级联删除）、Singleton 与普通实体的区分规则、builtIn 属性与 source 判别器设计
3. 数据流全链路设计：用户操作 → Tool 捕获 → Command 封装 → EntityStore 变更 → Event 广播 → Renderer 更新 / Inspector 刷新 的完整链路；连续操作（拖拽/滑块）的 Command 粒度控制方案
4. 系统间接口契约：Command 接口（execute/undo）、Tool 接口（onActivate/onDeactivate/onPointerDown/Move/Up/onKeyDown）、Renderer 注册接口、Inspector 注册接口、Signal 事件类型定义
5. 目录结构规范：`src/editor/` 下的模块组织方式、与现有 `src/engine/`（计算引擎，不动）和 `src/components/`（UI 层）的边界划分
6. 现有代码迁移映射：旧 Store 的 ~40 个字段分别映射到哪个 Entity 的 properties；现有组件分别在哪个阶段迁移、迁移方式（重写/适配/保留）
7. V0.3 扩展路径验证：用 2-3 个 V0.3 功能（如角度度量、面上取点、新几何体）走一遍"注册新实体类型 + 渲染器 + Tool"的路径，确认架构不阻塞
8. 风险点与决策记录：识别架构中的关键决策点和风险（如 BuilderResult 缓存策略、依赖更新时机、多几何体预留方式），给出明确决策

**涉及文件范围**：
- `.tasks/active/v0.2/ARCHITECTURE.md` - 架构设计文档（本阶段唯一产出）
- 不产出任何代码文件

**验收标准**：
- [ ] 架构设计文档覆盖七个核心系统的职责、接口、依赖关系
- [ ] 所有 Entity 类型的 properties 结构定义完整，字段名/类型/引用关系清晰
- [ ] 数据流全链路可追踪（从用户操作到渲染更新）
- [ ] 目录结构规范明确，与现有代码的边界清晰
- [ ] 旧代码迁移映射表完整（旧字段 → 新 Entity、旧组件 → 迁移阶段）
- [ ] V0.3 扩展路径走通，无架构阻塞点
- [ ] 用户审阅通过

**本阶段产出**：
`ARCHITECTURE.md` 架构蓝图文档。后续阶段1-8严格按此文档实现，遇到需要偏离时先回到本文档修订。

**注意**：本阶段是纯设计阶段，不写任何代码。重点是把所有系统的接口和边界想清楚，避免后续阶段返工。

---

### 第1阶段：Entity 系统 + Event 系统 + Store 重构 ⏱️ 4-5天

**目标**：建立整个编辑器架构的数据基础和通信基础——统一实体模型（Entity）、实体管理容器（EntityStore）、类型安全的事件系统（Signal），替换现有 ~40 字段的单体 Store。

**主要任务**：
1. 设计 Entity 基础类型系统：统一的 `Entity` 接口（id, type, properties, visible）、实体分类（普通实体 vs Singleton 上下文实体）、实体间引用机制（id 引用，非指针）
2. 定义所有实体类型的 properties 结构：`geometry`（几何体参数）、`point`（统一点模型：顶点/棱上点/曲线上点/截面交点，builtIn 区分来源）、`segment`（统一线段模型：棱线/用户线段，builtIn 区分来源）、`face`（统一面模型：几何体面/截面，source 判别器区分来源）、`coordinateSystem`（坐标系）、`circumSphere`（外接球）、`circumCircle`（外接圆）
3. 实现 EntityStore（Zustand）：`entities: Map<string, Entity>`、CRUD 操作、按类型查询、`getCoordinateSystem()` 等快捷方法、引用查询（`getReferencingEntities`）、级联删除（`cascadeDelete`）
4. 实现 Event/Signal 系统：类型安全的发布-订阅、关键事件通道（entityCreated / entityUpdated / entityDeleted / selectionChanged）
5. 实现 ToolStore（Zustand）：`activeTool` 及工具状态管理
6. 实现 HistoryStore（Zustand）：undo/redo 栈结构（为阶段2的 Command 系统预留）
7. Entity properties 全部设计为可 JSON 序列化（纯数据，无函数/Three.js 对象）

**涉及文件范围**：
- `src/editor/entities/` - Entity 类型定义（types.ts）、各实体类型的 properties 结构定义
- `src/editor/store/` - EntityStore、SelectionStore、ToolStore、HistoryStore（Zustand）
- `src/editor/signals.ts` - Signal 类和全局 Signal 实例

**验收标准**：
- [ ] Entity 类型系统定义完整，覆盖 V0.1 所有数据概念
- [ ] EntityStore CRUD + 引用查询 + 级联删除可用，按类型查询正确
- [ ] Signal 系统可正常发布/订阅事件
- [ ] 所有 Entity properties 可通过 `JSON.stringify` / `JSON.parse` 往返
- [ ] 四个 Store（EntityStore / SelectionStore / ToolStore / HistoryStore）结构清晰，职责分离
- [ ] `pnpm tsc --noEmit` 通过

**本阶段产出**：
编辑器数据层 + 通信层基础设施。后续所有系统基于此构建。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第2阶段：Command 系统 + Undo/Redo ⏱️ 3-4天

**目标**：建立所有实体变更的统一入口——Command 模式，使每个用户操作都封装为可逆命令，支持完整的 Ctrl+Z / Ctrl+Y 撤销重做。

**主要任务**：
1. 设计 Command 基础接口：`execute()` + `undo()` 方法、命令元数据（描述、时间戳）
2. 实现 CommandProcessor：中央化命令执行、自动压栈、undo/redo 调度
3. 实现核心命令集：CreateEntityCommand、DeleteEntityCommand、UpdatePropertiesCommand、BatchCommand（组合多个命令为原子操作）
4. 实现连续操作的 Command 粒度控制：拖拽/滑块等连续操作以 mouseup 为提交点（mousedown 记录 before 状态，mousemove 实时更新渲染不产生 Command，mouseup 生成一个 Command 压入栈）
5. 实现 Ctrl+Z / Ctrl+Y 键盘快捷键绑定（放在 `src/editor/shortcuts.ts`，保持阶段1-3纯新增 src/editor/ 的约束）
6. 几何体类型切换等"重置性操作"用完整状态快照作为 Command 的 undo 数据
7. 历史栈边界处理：栈上限、清空策略

**涉及文件范围**：
- `src/editor/commands/` - Command 接口（types.ts）、各具体命令实现
- `src/editor/store/historyStore.ts` - HistoryStore 内嵌 CommandProcessor 逻辑
- `src/editor/shortcuts.ts` - 全局快捷键绑定（Ctrl+Z/Y/Escape）

**验收标准**：
- [ ] 通过 CommandProcessor 创建/删除/修改实体后，Ctrl+Z 可撤销、Ctrl+Y 可重做
- [ ] BatchCommand 可将多个操作合并为一个 undo 单元
- [ ] 连续操作（模拟 mousedown→mousemove→mouseup）只产生一个 Command
- [ ] 历史栈上限生效，不会无限增长
- [ ] `pnpm tsc --noEmit` 通过

**本阶段产出**：
完整的变更层。后续所有用户操作通过 Command 执行，天然获得 undo/redo 能力。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第3阶段：Tool 系统框架 ⏱️ 3-4天

**目标**：在 `src/editor/tools/` 中定义 Tool 接口并实现所有工具的核心逻辑，纯新增代码，不碰旧组件。本阶段完成后，四个 Tool 的逻辑就绪，等待阶段4接入 UI 事件。

**主要任务**：
1. 定义 Tool 基础接口：`onActivate` / `onDeactivate` / `onPointerDown` / `onPointerMove` / `onPointerUp` / `onKeyDown`、ToolPointerEvent 类型
2. 实现 SelectTool：点击选中 Entity（通过 hitEntityId）、拖拽移动 Point Entity（通过 MovePointCommand）、点击空白取消选中
3. 实现 DrawSegmentTool：两次点击 Point Entity 创建 Segment Entity（通过 CreateEntityCommand）
4. 实现 CrossSectionTool：多次点击 Point Entity 选定截面定义点 → 创建 Face(crossSection) + 交点 Points（通过 CreateCrossSectionCommand）
5. 实现 CoordSystemTool：点击 Point Entity 选择坐标系原点
6. 完善 ToolStore：工具注册/切换/互斥逻辑、Escape 统一回到 SelectTool
7. 工具间共享 SelectionStore（Tool 决定"何时选中"，SelectionStore 存储状态）
8. 实现本阶段 Tool 所需的 Command：MovePointCommand（SelectTool 拖拽）、RenameEntityCommand（SelectTool 双击重命名）、CreateCrossSectionCommand（CrossSectionTool 创建截面）

**涉及文件范围**：
- `src/editor/tools/types.ts` - Tool、ToolPointerEvent 接口
- `src/editor/tools/selectTool.ts` - SelectTool 实现
- `src/editor/tools/drawSegmentTool.ts` - DrawSegmentTool 实现
- `src/editor/tools/crossSectionTool.ts` - CrossSectionTool 实现
- `src/editor/tools/coordSystemTool.ts` - CoordSystemTool 实现
- `src/editor/tools/index.ts` - 导出
- `src/editor/store/toolStore.ts` - ToolStore 增强（注册/切换逻辑）
- `src/editor/commands/movePoint.ts` - MovePointCommand
- `src/editor/commands/renameEntity.ts` - RenameEntityCommand
- `src/editor/commands/createCrossSection.ts` - CreateCrossSectionCommand

**验收标准**：
- [ ] Tool 接口定义完整，四个工具的核心逻辑可编译
- [ ] ToolStore 支持工具注册、切换、互斥（同时只有一个活跃工具）
- [ ] 各 Tool 内部正确调用 Command 系统（依赖阶段2产出）
- [ ] 各 Tool 内部正确读写 SelectionStore / EntityStore
- [ ] `pnpm tsc --noEmit` 通过
- [ ] 不触碰 `src/components/` 和 `src/hooks/`，旧应用仍可正常运行

**本阶段产出**：
完整的 Tool 系统实现（纯逻辑层）。四个工具的交互逻辑就绪，阶段4接入 UI 事件后即可工作。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第4阶段：Renderer 迁移 + Scene3D 改造 + 交互接入 ⏱️ 6-8天

**目标**：这是"旧→新"的集中切换阶段。将渲染管线从旧 Store 切换到 EntityStore，将交互事件从 useInteraction 切换到 Tool 系统，完成视觉和交互两条线路的全面接入。

**主要任务**：
1. 实现 BuilderResult 缓存机制（ARCH §8.4）：`geometry entity id → BuilderResult` 的运行时缓存，geometry params 变化时失效重算。本阶段渲染器和后续阶段的展开图/三视图均通过此缓存获取 BuilderResult
2. 设计 Renderer 注册机制：每种实体类型注册对应的 R3F 渲染组件（RendererRegistry），渲染器从 Entity properties + BuilderResult 读取数据
3. 实现 GeometryEntityRenderer：从 EntityStore 的 geometry 实体读取 BuilderResult，渲染几何体自身（曲面体 Three.js 几何体 + 母线/轮廓线），**不渲染面**（面统一由 FaceEntityRenderer 处理）
4. 实现 PointEntityRenderer：统一所有点类型（顶点/棱上点/曲面点/截面交点）渲染，保留选中高亮、标签显示、双击编辑（迁移自 VertexLabels + CustomPointsRenderer + CurveCustomPointsRenderer）
5. 实现 SegmentEntityRenderer：统一棱线和用户线段渲染，保留颜色/虚实/长度显示；包含不可见命中体积（迁移自 LineHitboxes，mesh userData 携带 entityId 供 Tool raycasting 命中识别）
6. 实现 FaceEntityRenderer：**统一渲染所有面**（builtIn 几何体面的半透明渲染 + crossSection 截面渲染），根据 source 类型区分样式（迁移自 GeometryRenderer 面渲染 + CrossSection.tsx）
7. Scene3D 重构：从组件堆叠改为遍历 EntityStore 实体、按类型分发渲染器
8. Tool → UI 事件接入：Canvas pointer 事件分发到 ToolStore 的活跃 Tool（替代 useInteraction）
9. Selection → 渲染高亮接入：SelectionStore 变更触发渲染器高亮更新
10. TopBar 改造：几何体类型切换通过 ChangeGeometryTypeCommand 执行
11. ContextMenu3D 改造：右键菜单操作通过 Command 执行，菜单状态改为组件局部状态
12. 顶点拖拽迁移：从 VertexLabels 的 DOM 事件迁移到 SelectTool 的 pointer 事件，通过 MovePointCommand 提交
13. 实现本阶段所需的 Command：ChangeGeometryTypeCommand（TopBar 几何体切换）、UpdateGeometryParamsCommand（参数滑块）、DeleteEntityCascadeCommand（右键菜单/Delete 键删除实体）、UpdateCrossSectionCommand（截面响应式更新）

**涉及文件范围**：
- `src/editor/builderCache.ts` - BuilderResult 运行时缓存（geometry entity id → BuilderResult）
- `src/editor/commands/changeGeometryType.ts` - ChangeGeometryTypeCommand
- `src/editor/commands/updateGeometryParams.ts` - UpdateGeometryParamsCommand
- `src/editor/commands/deleteEntityCascade.ts` - DeleteEntityCascadeCommand
- `src/editor/commands/updateCrossSection.ts` - UpdateCrossSectionCommand
- `src/components/scene/renderers/` - RendererRegistry（index.ts）、GeometryEntityRenderer / PointEntityRenderer / SegmentEntityRenderer / FaceEntityRenderer
- `src/components/scene/Scene3D.tsx` - 重构为遍历 EntityStore 实体
- `src/components/scene/ContextMenu3D.tsx` - 操作通过 Command 执行
- `src/components/layout/TopBar.tsx` - 几何体切换通过 Command

**验收标准**：
- [ ] 6 种几何体在新渲染管线下正确渲染（半透明面 + 棱线 + 顶点标签）
- [ ] 所有类型的点（顶点、棱上点、曲面点）渲染正确，选中高亮可用
- [ ] 自定义线段渲染正确（颜色/虚实/长度）
- [ ] 顶点标签双击编辑仍可用
- [ ] 工具栏可切换 Select / DrawSegment / CrossSection / CoordSystem 四种工具
- [ ] Escape 键在任何工具下回到 SelectTool
- [ ] SelectTool 下：点击选中顶点/棱线、拖拽移动顶点、右键菜单可用
- [ ] DrawSegmentTool 下：选两点画线段，线段通过 Command 创建（可 undo）
- [ ] CrossSectionTool 下：选点定义截面 → 创建 Face(crossSection) + 交点 Points（可 undo）
- [ ] 选中状态变更正确触发渲染高亮
- [ ] 新增实体类型只需注册渲染器组件，不需修改框架代码
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
实体驱动的渲染管线 + 完整的交互层。视觉效果与 V0.1 一致，数据来源和交互入口全面切换到新系统。

**注意**：本阶段工作量较大，是整个重构的关键切换点。具体实现细节将在执行本阶段时另建子任务文档，可按"渲染器迁移→Scene3D改造→交互接入→TopBar/ContextMenu改造"分步推进。

---

### 第5阶段：辅助功能实体化 + 渲染器 + Inspector ⏱️ 4-5天

**目标**：将坐标系、外接球、外接圆从"布尔开关 + 散落状态"迁移为标准 Entity，包括渲染器和属性面板，复用 Entity 系统的 CRUD + Command + Renderer + Inspector 全套能力。截面已在第4阶段作为 Face(crossSection) 实现。

**主要任务**：
1. 坐标系实体化：CoordinateSystem 作为 Singleton Entity，properties 包含原点引用（pointId）、关联几何体；渲染器迁移自 CoordinateAxes.tsx；创建/删除通过 Command
2. 外接球实体化：CircumSphere 作为 Singleton Entity，properties 包含关联几何体；运行时数据（球心、半径）由纯函数计算；渲染器迁移自 CircumSphere.tsx
3. 外接圆实体化：CircumCircle 作为普通 Entity，properties 包含 3 个 pointIds、关联几何体；运行时数据（圆心、半径、法向量）由纯函数计算；渲染器迁移自 CircumCircle.tsx
4. 实现辅助功能渲染器：CoordSystemRenderer（迁移自 CoordinateAxes.tsx）、CircumSphereRenderer（迁移自 CircumSphere.tsx）、CircumCircleRenderer（迁移自 CircumCircle.tsx）
5. 实现辅助功能 Inspector：CoordSystemInspector（原点重选按钮）、CircumSphereInspector（显示半径只读）、CircumCircleInspector（选择3点）
6. 各辅助功能的依赖更新：当被引用的点/几何体变化时，渲染器通过 useMemo 自动重算
7. 所有辅助功能的创建/删除/切换通过 Command 执行（可 undo）

**涉及文件范围**：
- `src/editor/entities/` - coordinateSystem、circumSphere、circumCircle 实体定义（已在阶段1定义，本阶段实际启用）
- `src/components/scene/renderers/` - CoordSystemRenderer、CircumSphereRenderer、CircumCircleRenderer
- `src/components/panels/inspectors/` - CoordSystemInspector、CircumSphereInspector、CircumCircleInspector
- `src/editor/commands/` - 辅助功能相关的 Command
- `src/engine/math/` - 计算逻辑保持不变，只调整调用入口

**验收标准**：
- [ ] 坐标系：选顶点为原点 → XYZ 轴 + 坐标值显示，与 V0.1 效果一致
- [ ] 外接球：开关切换 → 半透明球面 + 半径值显示
- [ ] 外接圆：选 3 个点 → 平面外接圆 + 半径
- [ ] 选中坐标系/外接球/外接圆时，侧边栏显示对应 Inspector
- [ ] 以上所有操作可 Ctrl+Z 撤销
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
所有辅助功能统一为 Entity，享受 Entity 系统的全套能力（CRUD、Command、Event、Renderer、Inspector）。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第6阶段：Property 系统 + 面板重构 ⏱️ 3-4天

**目标**：将现有硬编码的多个面板（ParameterPanel、AuxiliaryTools、LabelingTools）重构为"选中实体 → 自动显示对应属性面板"的 Property/Inspector 系统。

**主要任务**：
1. 设计 Property 系统框架：InspectorRegistry（实体类型 → Inspector 组件映射），选中实体变更时自动切换面板
2. 几何体 Inspector：参数编辑面板（迁移自 ParameterPanel），参数修改通过 Command 执行
3. 点 Inspector：点名称编辑、位置显示、约束信息（棱上点显示 t 值等）
4. 线段 Inspector：颜色/虚实切换、长度显示
5. 面 Inspector：source=geometry 时显示面索引（只读）；source=crossSection 时显示定义点、面积、交点列表
6. 工具栏重构：3D 区域顶部增加工具栏，提供 Tool 切换按钮（选择/画线/截面/坐标系）
7. 辅助功能面板重构：坐标系/外接球/外接圆/截面的开关统一通过 Entity 创建/删除来控制
8. 右侧面板整体重构（遵循 ARCH §7.3 布局）：**上半部分**为固定面板 FixedPanel（几何体类型选择 + 参数滑块 + 辅助功能开关，始终可见），**下半部分**为动态 InspectorPanel（根据选中实体显示对应属性面板）

**涉及文件范围**：
- `src/components/panels/inspectors/` - InspectorRegistry（index.ts）、核心 Inspector 组件（GeometryInspector / PointInspector / SegmentInspector / FaceInspector）
- `src/components/panels/` - FixedPanel（迁移自 ParameterPanel + AuxiliaryTools + LabelingTools）、InspectorPanel 容器
- `src/components/layout/` - 布局调整（工具栏、面板区域）

**验收标准**：
- [ ] 右侧面板上半部分始终显示固定面板（几何体选择、参数滑块、辅助功能开关）
- [ ] 选中实体时 → 下半部分显示对应 Inspector（几何体参数/点属性/线段属性/面属性/辅助功能属性）
- [ ] 未选中时 → 下半部分为空或显示提示
- [ ] 修改参数可 undo
- [ ] 3D 区域工具栏可切换工具，工具状态有视觉反馈
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
完整的呈现层。固定面板 + 动态 Inspector 的面板布局就位，面板不再硬编码。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第7阶段：展开图 / 三视图 / 度量迁移 ⏱️ 2-3天

**目标**：将展开图、三视图、体积/表面积度量模块从旧 Store 切换到 EntityStore 数据源，确保这些"只读"模块正确工作。

**主要任务**：
1. 展开图迁移：UnfoldingPanel 从 EntityStore 的 geometry 实体读取几何体类型和参数，调用展开算法
2. 三视图迁移：ThreeViewPanel 同理从 EntityStore 读取数据
3. 度量显示迁移：MeasurementDisplay 从 EntityStore 读取几何体参数，调用计算引擎
4. CalcStepsModal 适配：计算步骤弹窗从 EntityStore 获取数据
5. 导出功能验证：PNG 导出功能在新架构下正常工作
6. engine/ 目录（builders、math、unfolding、projection）保持不变，只调整调用入口

**涉及文件范围**：
- `src/components/views/` - UnfoldingPanel、ThreeViewPanel 的数据源切换
- `src/components/info/` - MeasurementDisplay、CalcStepsModal 适配
- `src/hooks/useGeometryBuilder.ts` - 重构为从 EntityStore 读取几何体参数，内部调用阶段4已实现的 BuilderResult 缓存机制（`src/editor/builderCache.ts`）

**验收标准**：
- [ ] 6 种几何体的展开图正确渲染，SVG 缩放/平移/导出可用
- [ ] 6 种几何体的三视图正确渲染，标注线/虚实线/导出可用
- [ ] 体积/表面积数值与 V0.1 一致，含 π/根号/分数的精确值显示正确
- [ ] 计算步骤弹窗可正常展开
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
所有"只读"展示模块迁移完成，全部从 EntityStore 读取数据。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第8阶段：回归验证 + 旧代码清理 + 序列化验证 ⏱️ 2-3天

**目标**：全面回归验证 V0.1 所有功能无回退，清理旧代码，验证架构质量目标（序列化、扩展性）。

**主要任务**：
1. 全功能回归测试：对照 BACKGROUND.md 中"V0.1 已实现功能清单"逐项验证
2. 旧代码清理：删除旧 `useGeometryStore.ts`、旧 `useInteraction.ts` 等已被替代的文件
3. 序列化验证：EntityStore 整体 `JSON.stringify` → `JSON.parse` 往返，数据完整性校验
4. Undo/Redo 全覆盖验证：所有用户操作（参数变化、创建/删除点/线段/截面Face、坐标系开关、外接球开关、顶点重命名、顶点拖拽、级联删除）均可 undo/redo
5. 构建验证：`pnpm lint && pnpm tsc --noEmit && pnpm build` 全部通过
6. 触屏/视角按钮/UI 体验回归：确保阶段6（体验打磨）的成果不丢失
7. 清理不再使用的类型定义和工具函数

**涉及文件范围**：
- 全项目 `src/` - 删除旧文件、清理未使用导入
- `src/store/useGeometryStore.ts` - 移除或归档
- `src/hooks/useInteraction.ts` - 移除或归档

**验收标准**：
- [ ] V0.1 功能清单全部逐项通过（基础建模 / 标注编辑 / 度量计算 / 辅助分析 / 高级功能 / 交互体验）
- [ ] Ctrl+Z / Ctrl+Y 覆盖所有用户操作
- [ ] EntityStore 序列化/反序列化往返成功
- [ ] `pnpm lint && pnpm tsc --noEmit && pnpm build` 全部通过
- [ ] 无残留旧代码（旧 Store、旧交互 Hook）
- [ ] 触屏操作、视角按钮、UI 字体/间距与 V0.1 一致

**本阶段产出**：
完成 V0.2 交付。架构重构完毕，可开始 V0.3 功能开发。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

## 当前焦点

第 8 阶段：回归验证 + 旧代码清理 — ✅ 已完成

**已完成**：
- 第 0 阶段：架构设计文档（ARCHITECTURE.md）完成并审阅通过
- 第 1 阶段：Entity 系统 + Event 系统 + Store 重构完成（详见 `1-Entity系统+Store重构.md`）
- 第 2 阶段：Command 系统 + Undo/Redo 完成（详见 `2-Command系统+UndoRedo.md`）
- 第 3 阶段：Tool 系统框架完成（详见 `3-Tool系统框架.md`）
- 第 4 阶段：Renderer 迁移 + Scene3D 改造 + 交互接入完成（详见 `4-Renderer迁移+Scene3D改造+交互接入.md`）
- 第 4.1 阶段：验收 + Bug修复完成（详见 `4.1-验收+Bug修复.md`）— 6个Bug修复 + 截面逻辑重设计
- 第 4.1.2 阶段：截面生成逻辑重设计完成（详见 `4.1.2-截面生成逻辑重设计.md`）— 点复用 + 方案C面分割 + Segment创建
- 第 5 阶段：辅助功能实体化完成（详见 `5-辅助功能实体化.md`）— 三个 Renderer + CircumCircleTool + AuxiliaryTools 数据源切换 + InspectorRegistry + 三个 Inspector
- 第 6 阶段：Property 系统 + 面板重构完成（详见 `6-Property系统+面板重构.md`）— ParameterPanel/LabelingTools 数据源切换 + 四个 Inspector（Geometry/Point/Segment/Face）+ 面板上下分区布局
- 第 7 阶段：展开图/三视图/度量迁移完成（详见 `7-展开图-三视图-度量迁移.md`）— 三个展示组件数据源切到 EntityStore + uiStore 面板状态迁移 + useGeometryBuilder 替换

**V0.2 重构全部完成** 🎉

所有 8 个阶段均已完成，可开始 V0.3 功能开发。

## 阶段检查点

| 阶段 | 检查项 | 约束 | 状态 |
|------|--------|------|------|
| 0 | 架构蓝图文档（ARCHITECTURE.md）完成并审阅通过 | — | ✅ |
| 1 | Entity + Event + Store 三大基础设施 | 纯新增 src/editor/ | ✅ |
| 2 | Command + Undo/Redo 可用 | 纯新增 src/editor/ | ✅ |
| 3 | Tool 系统框架（四个 Tool 逻辑就绪） | 纯新增 src/editor/ | ✅ |
| 4 | Renderer迁移 + Scene3D改造 + 交互接入 | 改造 src/components/ | ✅ |
| 5 | 辅助功能实体化 + 渲染器 + Inspector | 改造 src/components/ | ✅ |
| 6 | Property 面板（固定面板+动态Inspector）+ 工具栏 | 改造 src/components/ | ✅ |
| 7 | 展开图/三视图/度量迁移 | 清理旧代码 | ✅ |
| 8 | 全面回归 + 清理 + 序列化验证 | 清理旧代码 | ✅ |

## V0.3 扩展性验证清单

重构完成后，以下 V0.3 功能应可通过"注册新实体类型 + 注册渲染器 + 编写 Tool"实现，无需修改框架代码：

- [ ] 新增几何体（正四面体、墙角四面体）→ 注册新 Builder + geometry 实体子类型
- [ ] 角度度量 → 注册 angleMeasurement 实体类型 + 渲染器 + AngleTool
- [ ] 面交互 → Selection 系统扩展支持面类型选中
- [ ] 面上取点 → point 实体新增 faceRef 约束类型
- [ ] 坐标输入点 → point 实体新增 coordinateInput 约束类型
- [ ] Hover 高亮 → Renderer 层扩展 hover 状态
- [ ] 距离度量 → 注册 distanceMeasurement 实体类型
- [ ] 动点 → point 实体新增 animated 约束类型 + 参数化滑块

## 暂时不考虑

- 不新增任何用户可见功能
- 不新增几何体类型
- 不做坐标系重构（交互式建系归 V0.3）
- 不做角度度量
- 不做 hover 高亮 / 面交互
- 不建立独立的 Constraint 系统
- 不实现实际的保存/加载功能（只确保数据结构可序列化）
- 不写单元测试框架
- 以上功能全部在 V0.3 中实现

## 技术决策记录

- **推进方案**：方案 C（新目录开发 + 旧代码保持可运行），详见 `推进方案.md`
- **Entity ID 策略**：递增整数（1, 2, 3...），天然表示创建顺序
- **引用机制**：实体间通过 id 引用，不用运行时指针，确保可序列化
- **统一实体模型**：几何体顶点/棱线/面全部创建为 Entity（builtIn=true 区分），一个属性换全局交互统一
- **截面合并为 Face**：截面不再是独立 EntityType，而是 Face(source.type='crossSection')，交点为显式 Point Entity
- **级联删除**：引用查询级联删除（getReferencingEntities + cascadeDelete），不多删不遗漏
- **Scene Graph**：不自建，使用 Three.js 自带的 Object3D 层级
- **依赖更新**：全量重算（场景实体少，不需要 Depsgraph）
- **Store 结构**：EntityStore + SelectionStore + ToolStore + HistoryStore 四个独立 Zustand Store
- **engine/ 目录**：计算引擎（builders/math/unfolding/projection）保持不变，只调整调用入口
- **多几何体预留**：几何体本身也是 Entity，通过 activeGeometryId 标识，不硬编码"只有一个"

## 开发笔记

### 2026-03-09
- **阶段 0 完成**：产出 ARCHITECTURE.md 架构蓝图，覆盖七系统接口契约、数据流、目录结构、迁移映射
- **阶段 1 完成**：Entity 类型系统 + Signal 事件系统 + 四个 Store（EntityStore/SelectionStore/ToolStore/HistoryStore）全部实现。技术决策：Record 替代 Map、string[] 替代 Set（Zustand devtools 兼容性）。`pnpm tsc --noEmit` + `pnpm lint` 通过
- **阶段 2 完成**：Command 系统 + Undo/Redo 全部实现。11 个 Command（CreateEntity/DeleteEntity/UpdateProperties/Batch/ChangeGeometryType/UpdateGeometryParams/MovePoint/RenameEntity/CreateCrossSection/UpdateCrossSection/DeleteEntityCascade）+ EntityStore restoreEntity/restoreEntities + 全局快捷键（Ctrl+Z/Y/Escape）。`pnpm tsc --noEmit` + `pnpm lint` 通过
- **阶段 3 完成**：Tool 系统框架全部实现。4 个 Tool（SelectTool/DrawSegmentTool/CrossSectionTool/CoordSystemTool）+ `registerAllTools()` 注册入口。CrossSectionTool 内实现了平面拟合+边交点计算桥接逻辑。`pnpm tsc --noEmit` + `pnpm lint` 通过
- **阶段 4 完成**：Renderer 迁移 + Scene3D 改造 + 交互接入全部实现。16 个子任务（T4.1-T4.16）分 4 批执行完毕。新增：BuilderResult 缓存（builderCache.ts）、RendererRegistry + 4 个实体渲染器（Geometry/Point/Segment/Face）、ToolEventDispatcher 事件分发、ToolBar 工具栏、contextMenuStore 解耦、initEditor + useEditorInit 初始化。改造：Scene3D.tsx（实体遍历渲染）、TopBar.tsx（Command 驱动）、ContextMenu3D.tsx（Command 驱动）。`pnpm lint` + `pnpm tsc --noEmit` + `pnpm build` 通过
- **阶段 4.1 完成**：浏览器验收 + 6个Bug修复。#1 无限更新循环（Zustand selector 引用不稳定）、#2 工具点击无反应（Html DOM 覆盖层拦截事件）、#3 键盘快捷键失效（StrictMode 监听器丢失）、#4 截面选点高亮+渲染错乱（单选替换+交点未排序）、#5 builtIn删除无提示（新建 notificationStore）、#6 拖拽卡住（R3F group 事件改为 window 级监听）。新增设计决策：截面实体统一原则（所有截面产生的点/线/面都是一等公民 Entity）
- **阶段 4.1.2 完成**：截面生成逻辑重设计。实现交点复用（不重复创建已有顶点）、方案C无重叠子面分割（定义点三角形 + 延伸部分三角扇）、截面边自动创建 Segment Entity（已有棱线复用）。entityStore 新增 findPointAtVertex/findPointOnEdge/findSegmentByPoints 查找方法
- **阶段 5 完成**：辅助功能实体化。新增 9 个文件 + 修改 6 个文件。批次A：CoordSystemRenderer/CircumSphereRenderer/CircumCircleRenderer 三个渲染器（复用旧 CoordinateAxes/CircumSphere/CircumCircle 组件）。批次B：CircumCircleTool 选点工具 + AuxiliaryTools 面板数据源从 useGeometryStore 切换到 EntityStore+Command。批次C：InspectorRegistry 框架（registry.ts 解决循环依赖）+ CoordSystemInspector/CircumSphereInspector/CircumCircleInspector。批次D：Scene3D side-effect import + LeftPanel 集成 InspectorPanel + ToolBar 添加外接圆按钮。Bug修复：Zustand selector 返回新引用导致无限循环（改为 selector 取 entitiesMap + useMemo 派生）。延迟到后续阶段：辅助实体场景内点击选中（需加不可见命中 mesh）
- **阶段 6 完成**：Property 系统 + 面板重构。新增 4 文件 + 修改 6 文件。批次A：ParameterPanel 数据源切到 EntityStore + Command（Slider 增加 onValueCommit，连续操作模式）。批次B：四个 Inspector（GeometryInspector 只读展示 / PointInspector 标签+t值+删除 / SegmentInspector 颜色虚实+删除 / FaceInspector 截面详情+删除）。批次C：LabelingTools 切到 EntityStore，AuxiliaryTools sphereData 切到 EntityStore，采用最小改动方案保留现有面板结构。批次D：RightPanel flex 上下分区。Bug修复：Zustand selector 返回新对象/数组导致无限循环（ParameterPanel/LabelingTools/GeometryInspector/FaceInspector）
- **阶段 7 完成**：展开图/三视图/度量迁移。新增 1 文件（uiStore.ts）+ 修改 7 文件。批次A：UnfoldingPanel/ThreeViewPanel/MeasurementDisplay 数据源从 useGeometryStore 切到 useEntityStore（标准 entities+useMemo 模式）。UnfoldingPanel 新增 getVertexLabelMap() 从 Entity point 构建顶点标签映射替代旧 labelOverrides。批次B：新增 uiStore（unfoldingEnabled/threeViewEnabled），AppLayout + AuxiliaryTools 面板开关切到 useUIStore。批次C：AuxiliaryTools 中 useGeometryBuilder 替换为 useBuilderResult。`pnpm lint` + `pnpm tsc --noEmit` 通过。浏览器验收通过
- **阶段 8 完成**：回归验证 + 旧代码清理 + 序列化验证。删除 15 个旧文件（~2500+ 行），清理 2 个空目录。批次A：三个渲染器内联化（CoordSystemRenderer/CircumSphereRenderer/CircumCircleRenderer 移除对旧组件的 import，将渲染逻辑直接内联）。批次B：AuxiliaryTools 完全重写（移除全部 useGeometryStore 引用，画线/截面改为 ToolStore 驱动）。批次C：删除旧渲染组件 8 个 + 旧 Hook 2 个 + 旧 Store + 旧类型 + 旧工具函数 + 旧 engine 截面函数 2 个。序列化验证：EntityStore 新增 getSnapshot/loadSnapshot + AuxiliaryTools 新增导出/导入按钮。`pnpm lint` + `pnpm tsc --noEmit` + `pnpm build` 全部通过。浏览器验收通过
