# 第6阶段：Property 系统 + 面板重构

**任务ID**: 03-09-phase6-Property系统
**风险等级**: L1（常规风险：面板层改造，不改核心架构，数据源切换为 EntityStore + Command）
**流程路径**: MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**关联主计划**: `.tasks/active/v0.2/PROGRESSIVE-PLAN.md` 第6阶段
**关联架构文档**: `.tasks/active/v0.2/ARCHITECTURE.md` §7
**前置依赖**: 第1-5阶段全部完成
**状态**: 待启动

---

## 任务目标

将现有硬编码的多个面板（ParameterPanel、AuxiliaryTools、LabelingTools）重构为 ARCH §7.3 布局：
- **上半部分**：FixedPanel（几何体类型选择 + 参数滑块 + 辅助功能开关），始终可见
- **下半部分**：InspectorPanel（根据选中实体动态显示对应属性面板）

同时补充四个核心 Inspector（Geometry / Point / Segment / Face），使选中任意实体时都能在 Inspector 中查看/编辑属性。

---

## 验收标准

- [ ] 右侧面板上半部分始终显示固定面板（几何体选择、参数滑块、辅助功能开关）
- [ ] 选中实体时 → 下半部分显示对应 Inspector（几何体参数/点属性/线段属性/面属性/辅助功能属性）
- [ ] 未选中时 → 下半部分为空或显示提示
- [ ] 参数滑块修改通过 Command 执行，可 undo
- [ ] 3D 区域工具栏可切换工具，工具状态有视觉反馈
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 现有面板架构（阶段5完成后）

### 右侧面板（LeftPanel.tsx）当前结构

```
右侧面板 (280px)
├── PanelSection "参数设置" — ParameterPanel
│     数据源：useGeometryStore（旧系统，读 currentType + params）
│     交互：setParams() 直接修改 Store
├── PanelSection "辅助功能" — AuxiliaryTools
│     数据源：混合（展开图/三视图/画线用旧 Store；坐标系/外接球/外接圆已切到 EntityStore）
│     交互：辅助实体通过 Command 创建/删除
├── PanelSection "标注工具" — LabelingTools
│     数据源：useGeometryStore（旧系统，读 customPoints + edgeLabels）
│     交互：旧 Store dispatch
└── InspectorPanel（阶段5新增）
      数据源：SelectionStore.primaryId → EntityStore → inspectorRegistry
      已注册：CoordSystemInspector / CircumSphereInspector / CircumCircleInspector
```

### 目标结构（ARCH §7.3）

```
右侧面板 (280px)
├── FixedPanel（始终可见）
│   ├── 几何体类型选择（从 TopBar 移除？或保留在 TopBar）
│   ├── 参数滑块（迁移自 ParameterPanel，数据源切到 EntityStore + Command）
│   ├── 辅助功能开关（迁移自 AuxiliaryTools 的开关部分）
│   │   ├── 展开图 / 三视图开关
│   │   ├── 坐标系开关（已 Entity 化）
│   │   ├── 外接球开关（已 Entity 化）
│   │   └── 外接圆开关（已 Entity 化）
│   └── 画线 / 截面工具按钮（触发 Tool 切换）
│
├── 分隔线
│
└── InspectorPanel（动态，根据选中实体显示）
    ├── GeometryInspector    — 选中几何体时
    ├── PointInspector        — 选中点时
    ├── SegmentInspector      — 选中线段时
    ├── FaceInspector         — 选中面时
    ├── CoordSystemInspector  — 选中坐标系时（已实现）
    ├── CircumSphereInspector — 选中外接球时（已实现）
    └── CircumCircleInspector — 选中外接圆时（已实现）
```

---

## 子任务清单

### 批次A：ParameterPanel 数据源切换（核心）

#### T6.1 ParameterPanel 切到 EntityStore + Command

**目标**：参数编辑从 useGeometryStore 切到 EntityStore，修改通过 UpdateGeometryParamsCommand 执行（可 undo）。

**修改文件**：`src/components/panels/ParameterPanel.tsx`

**改造内容**：

**数据源切换**：
- 旧：`useGeometryStore` 读取 `currentType` + `params`
- 新：`useEntityStore` 读取 `getActiveGeometry()` → `properties.geometryType` + `properties.params`

**参数修改（连续操作模式，ARCH §3.4）**：
- 旧：`store.setParams(currentType, newParams)` 直接修改 Store
- 新：
  - 滑块 `onValueChange`（mousemove 持续触发）：首次触发时记录 `beforeParams`，直接 `EntityStore.updateProperties(geometryId, { params: newParams })` 实时更新渲染
  - 滑块 `onValueCommit`（mouseup）：构造 `UpdateGeometryParamsCommand(geometryId, beforeParams, afterParams, topologyChanged, ...)` → `HistoryStore.execute(cmd)`
  - 数字输入框 `onBlur` / `Enter`：直接构造 Command 并 execute

**拓扑变化检测**：
- 棱锥 `sides` 参数变化 → `topologyChanged = true` → Command 内部调用 `rebuildBuiltInEntities()`
- 其他参数（长/宽/高/半径等）→ `topologyChanged = false`

**保持不变**：
- `PARAM_FIELDS` 配置表结构
- 滑块 + 数字输入框 UI 样式

---

#### T6.2 几何体类型切换统一

**目标**：确认几何体类型切换完全通过 Command，ParameterPanel 正确响应类型变化。

**验证内容**：
- TopBar 切换几何体类型 → `ChangeGeometryTypeCommand` → EntityStore 更新 → ParameterPanel 响应式刷新参数
- ParameterPanel 的 `PARAM_FIELDS[geometryType]` 正确切换
- undo 后 ParameterPanel 回到旧类型参数

---

### 批次B：四个核心 Inspector

#### T6.3 GeometryInspector

**目标**：选中几何体时显示的属性面板。

**产出文件**：`src/components/panels/inspectors/GeometryInspector.tsx`

**实现内容**：
- 显示几何体类型名称
- 显示当前参数值（只读，参数编辑在 FixedPanel 的 ParameterPanel 中进行）
- 显示实体统计（builtIn 点/线/面数量）
- 注册：`registerInspector('geometry', GeometryInspector)`

**注意**：几何体参数的编辑仍在 FixedPanel 中（始终可见），GeometryInspector 不重复提供参数编辑滑块。

---

#### T6.4 PointInspector

**目标**：选中点时显示的属性面板。

**产出文件**：`src/components/panels/inspectors/PointInspector.tsx`

**实现内容**：
- **通用信息**：
  - 标签编辑（通过 RenameEntityCommand）
  - 类型标识：builtIn 顶点 / 棱上点 / 曲线上点 / 截面交点
  - 3D 位置坐标（只读，从 usePointPosition 读取）
- **约束信息**（根据 constraint.type 区分显示）：
  - `vertex`：显示顶点索引
  - `edge`：显示所在棱 + t 值（滑块可编辑 → UpdatePropertiesCommand）
  - `curve`：显示所在曲线 + t 值（滑块可编辑）
- **操作**：
  - 删除按钮（仅 builtIn=false 的点可删除 → DeleteEntityCascadeCommand）
- 注册：`registerInspector('point', PointInspector)`

---

#### T6.5 SegmentInspector

**目标**：选中线段时显示的属性面板。

**产出文件**：`src/components/panels/inspectors/SegmentInspector.tsx`

**实现内容**：
- **通用信息**：
  - 标签编辑（通过 RenameEntityCommand）
  - 类型标识：builtIn 棱线 / 用户线段
  - 长度显示（从两端点位置计算）
- **样式编辑**（仅 builtIn=false 用户线段）：
  - 颜色选择（预设颜色列表 → UpdatePropertiesCommand）
  - 虚实线切换（Switch → UpdatePropertiesCommand）
- **端点信息**：
  - 起点 / 终点标签（只读）
- **操作**：
  - 删除按钮（仅 builtIn=false → DeleteEntityCascadeCommand）
- 注册：`registerInspector('segment', SegmentInspector)`

---

#### T6.6 FaceInspector

**目标**：选中面时显示的属性面板。

**产出文件**：`src/components/panels/inspectors/FaceInspector.tsx`

**实现内容**：
- **根据 source.type 区分显示**：
  - `source.type='geometry'`（builtIn 几何体面）：
    - 显示面索引（只读）
    - 显示构成顶点标签列表
  - `source.type='crossSection'`（截面）：
    - 显示定义点标签列表
    - 显示交点标签列表（从 pointIds 读取）
    - 显示面积（如果可计算）
    - 删除按钮 → DeleteEntityCascadeCommand
- 注册：`registerInspector('face', FaceInspector)`

---

### 批次C：FixedPanel 重构

#### T6.7 FixedPanel 组件

**目标**：将 ParameterPanel + AuxiliaryTools 的固定部分合并为 FixedPanel。

**产出文件**：`src/components/panels/FixedPanel.tsx`

**实现内容**：

**Section 1：参数设置**
- 内嵌改造后的 ParameterPanel（T6.1 产出）
- 或直接将参数滑块逻辑内联

**Section 2：辅助功能**
- 展开图 / 三视图开关（保持 UI 局部状态）
- 画线按钮 → `ToolStore.setActiveTool('drawSegment')`
- 截面按钮 → `ToolStore.setActiveTool('crossSection')`
- 坐标系开关（Entity 创建/删除，已在阶段5实现）
- 外接球开关（Entity 创建/删除，已在阶段5实现）
- 外接圆按钮 → `ToolStore.setActiveTool('circumCircle')`

**注意**：FixedPanel 可以是将现有 ParameterPanel + AuxiliaryTools 合并/重组，也可以保持现有两个 PanelSection 结构不变、只做数据源切换。视 UI 复杂度选择最小改动方案。

---

#### T6.8 LabelingTools 数据源切换

**目标**：将标注工具面板的数据源从 useGeometryStore 切到 EntityStore。

**修改文件**：`src/components/panels/LabelingTools.tsx`

**改造内容**：

**自定义点列表**：
- 旧：`useGeometryStore.customPoints` 数组
- 新：`useEntityStore.getEntitiesByType('point').filter(p => !p.properties.builtIn)` — 所有用户创建的点

**命名线段列表**：
- 旧：`useGeometryStore.edgeLabels` Record
- 新：`useEntityStore.getEntitiesByType('segment').filter(s => s.properties.label)` — 所有有标签的线段

**删除操作**：
- 旧：`store.removeCustomPoint(id)` / `store.removeEdgeLabel(key)`
- 新：`HistoryStore.execute(new DeleteEntityCascadeCommand(entityId))`

---

### 批次D：面板布局整合 + 验证

#### T6.9 右侧面板布局重构

**目标**：实现 FixedPanel + InspectorPanel 的上下分区布局。

**修改文件**：`src/components/layout/LeftPanel.tsx`（右侧面板容器）

**改造内容**：
```
右侧面板
├── FixedPanel（固定高度或自适应，始终可见）
│   ├── ParameterPanel（参数滑块）
│   └── AuxiliaryTools（辅助功能开关）
├── 分隔线
└── InspectorPanel（flex:1，可滚动）
    └── 根据 SelectionStore.primaryId 动态显示 Inspector
```

**LabelingTools 处理**：
- 方案A：保留为独立 PanelSection 在 FixedPanel 内
- 方案B：合并到 InspectorPanel 中（选中点/线段时自动显示）
- 推荐方案B：用户创建的点/线段信息在 PointInspector / SegmentInspector 中展示更自然

---

#### T6.10 旧 Store 引用清理

**目标**：确保面板层不再直接读取 useGeometryStore 的已迁移字段。

**检查内容**：
- ParameterPanel → 不再读 `useGeometryStore.currentType` / `params`
- AuxiliaryTools → 不再读 `coordinateSystemEnabled` / `circumSphereEnabled` 等
- LabelingTools → 不再读 `customPoints` / `edgeLabels`
- 保留对旧 Store 的引用：`unfoldingEnabled` / `threeViewEnabled`（这些在阶段7迁移）

**注意**：不删除旧 Store 文件（阶段8清理），只确保面板层不再引用已迁移的字段。

---

#### T6.11 门禁验证

**验证内容**：

1. **编译检查**：`pnpm lint && pnpm tsc --noEmit`
2. **FixedPanel 验证**（浏览器）：
   - 参数滑块拖拽 → 几何体实时更新 → 松开后可 undo
   - 数字输入框修改 → 确认后可 undo
   - 棱锥边数变化（拓扑变化）→ builtIn 重建正确
   - 辅助功能开关正常工作
3. **Inspector 验证**：
   - 点击顶点 → PointInspector 显示（标签、位置、类型）
   - 点击棱线 → SegmentInspector 显示（标签、长度、端点）
   - 点击用户线段 → SegmentInspector 显示 + 颜色/虚实可编辑
   - 点击截面面 → FaceInspector 显示（定义点、交点列表）
   - 未选中 → Inspector 区域为空或显示提示
   - PointInspector 编辑标签 → RenameEntityCommand → 可 undo
   - PointInspector 棱上点 t 值滑块 → UpdatePropertiesCommand → 可 undo
   - SegmentInspector 颜色/虚实切换 → UpdatePropertiesCommand → 可 undo
4. **面板布局**：
   - FixedPanel 始终可见，不随选中状态变化
   - InspectorPanel 区域可滚动
   - 整体视觉风格与 V0.1 一致

---

## 涉及文件范围

**新增文件**：

```
src/components/panels/
├── FixedPanel.tsx                            # T6.7（或保留现有组件只做数据源切换）
└── inspectors/
    ├── GeometryInspector.tsx                 # T6.3
    ├── PointInspector.tsx                    # T6.4
    ├── SegmentInspector.tsx                  # T6.5
    └── FaceInspector.tsx                     # T6.6
```

**修改文件**：

```
src/components/panels/ParameterPanel.tsx      # T6.1: 数据源切到 EntityStore + Command
src/components/panels/AuxiliaryTools.tsx       # T6.7: 整合到 FixedPanel（或保留）
src/components/panels/LabelingTools.tsx        # T6.8: 数据源切到 EntityStore
src/components/layout/LeftPanel.tsx            # T6.9: 面板布局重构
src/components/panels/inspectors/index.ts     # 新增 4 个 Inspector 的 side-effect import
```

**不修改的文件**：
- `src/editor/` — 核心系统已完成，本阶段不改
- `src/engine/` — 计算引擎不变
- `src/store/useGeometryStore.ts` — 不删除（阶段8清理），仅减少面板层对它的引用

---

## 依赖关系

```
批次A（ParameterPanel 切换）：
  T6.1 ParameterPanel 数据源 ─┐
  T6.2 几何体切换验证 ────────┘
    ↓
批次B（四个 Inspector，彼此独立）：
  T6.3 GeometryInspector ──┐
  T6.4 PointInspector ─────┤
  T6.5 SegmentInspector ───┤
  T6.6 FaceInspector ──────┘
    ↓
批次C（面板重构）：
  T6.7 FixedPanel 组件（依赖 T6.1）
  T6.8 LabelingTools 数据源切换
    ↓
批次D（集成 + 验证）：
  T6.9 面板布局重构（依赖 T6.7 + 批次B）
  T6.10 旧 Store 引用清理
  T6.11 门禁验证
```

批次B 四个 Inspector 彼此独立可并行。

---

## 技术要点

### 参数滑块的连续操作处理（ARCH §3.4）

```
滑块操作流程：
  首次 onValueChange → 记录 beforeParams（模块级变量）
  后续 onValueChange → EntityStore.updateProperties(geometryId, { params }) — 实时渲染，不产生 Command
  onValueCommit → 构造 UpdateGeometryParamsCommand(beforeParams, afterParams) → HistoryStore.execute()
```

数字输入框：
```
onBlur / Enter → 构造 UpdateGeometryParamsCommand → execute
```

### 拓扑变化检测

棱锥的 `sides` 参数变化时顶点/棱线/面数量改变，需要 `rebuildBuiltInEntities`：

```typescript
function isTopologyChange(geometryType: GeometryType, oldParams: any, newParams: any): boolean {
  if (geometryType === 'pyramid') {
    return oldParams.sides !== newParams.sides;
  }
  return false;
}
```

### Inspector 中的属性编辑模式

Inspector 内的属性编辑统一通过 Command：
- 标签编辑 → `RenameEntityCommand`
- 样式修改（颜色/虚实）→ `UpdatePropertiesCommand`
- t 值修改 → `UpdatePropertiesCommand`（连续操作用 onValueCommit 模式）
- 删除 → `DeleteEntityCascadeCommand`

### FixedPanel vs 保留现有结构

**最小改动方案**：不创建新的 FixedPanel 组件，而是：
1. 将 ParameterPanel 数据源切换到 EntityStore（T6.1）
2. AuxiliaryTools 已在阶段5完成部分切换，本阶段补充剩余
3. LabelingTools 数据源切换（T6.8）
4. 调整 LeftPanel.tsx 的 PanelSection 顺序，在底部放 InspectorPanel

**完整重构方案**：创建 FixedPanel 合并 ParameterPanel + AuxiliaryTools 核心开关。

推荐**最小改动方案**：保持用户熟悉的面板结构，避免 UI 大改带来的回退风险。

---

## 注意事项

1. **数据源切换是核心**：本阶段的核心价值是将面板层从旧 Store 切到 EntityStore + Command，UI 布局变化是次要的
2. **保持 UI 一致性**：参数滑块、开关、按钮的样式必须与 V0.1 一致
3. **useGeometryStore 不删除**：`unfoldingEnabled` / `threeViewEnabled` 等 UI 状态仍在旧 Store 中，阶段7迁移
4. **Inspector 注册已有框架**：阶段5建立的 `inspectorRegistry` + `InspectorPanel` + `registerInspector()` 直接使用
5. **颜色编辑**：SegmentInspector 的颜色选择使用预设颜色列表（红/蓝/绿/黑等），不需要完整的 ColorPicker

---

## 执行记录

### 2026-03-09 — 阶段6完成

**执行批次**：

- **批次A（T6.1-T6.2）**：ParameterPanel 数据源切到 EntityStore + Command。Slider 组件增加 `onValueCommit` 事件。滑块拖拽采用连续操作模式（onValueChange 实时渲染 + onValueCommit 发 Command）。数字输入框 onChange 直接发 Command。拓扑变化检测（pyramid sides）已实现。
- **批次B（T6.3-T6.6）**：四个 Inspector 并行实现。GeometryInspector（只读：类型+参数+子实体统计）、PointInspector（标签编辑+坐标+约束+t值滑块+删除）、SegmentInspector（标签+端点+长度+颜色/虚实+删除）、FaceInspector（几何体面/截面区分+定义点/交点+删除）。
- **批次C（T6.7-T6.8）**：采用最小改动方案，保留 ParameterPanel + AuxiliaryTools 现有 PanelSection 结构。LabelingTools 完全切到 EntityStore，通过 DeleteEntityCascadeCommand 删除。AuxiliaryTools 的 sphereData 计算切到 EntityStore。
- **批次D（T6.9-T6.11）**：RightPanel 改为 flex 上下分区（固定面板区 + InspectorPanel 可滚动区）。旧 Store 引用清理完成（保留 unfoldingEnabled/threeViewEnabled 和旧绘制系统引用）。门禁通过。

**Bug修复**：
- Zustand selector 返回新对象/数组引用导致无限循环（Maximum update depth exceeded）。修复：selector 只取 `s.entities` 引用，派生数据用 `useMemo` 计算。涉及 ParameterPanel、LabelingTools、GeometryInspector、FaceInspector。

**变更文件**：
- 新增 4 文件：`inspectors/GeometryInspector.tsx`、`PointInspector.tsx`、`SegmentInspector.tsx`、`FaceInspector.tsx`
- 修改 6 文件：`slider.tsx`（onValueCommit）、`ParameterPanel.tsx`、`LabelingTools.tsx`、`AuxiliaryTools.tsx`、`inspectors/index.ts`、`LeftPanel.tsx`

**验收结果**：`pnpm lint && pnpm tsc --noEmit` 通过 + 浏览器验收通过
