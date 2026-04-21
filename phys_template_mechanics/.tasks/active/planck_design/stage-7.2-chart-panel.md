# 7.2 底部图表面板 UI 框架

## 状态：✅ 已完成（2026-03-27）

## 任务 ID
03-27-stage7-2-chart-panel

## 风险评估
- **任务类型**：新增 UI 层（布局+组件+图表库集成）
- **风险等级**：L1（常规风险）
  - 新增 4-5 个组件文件 + 布局修改
  - 引入新依赖 chart.js + react-chartjs-2
  - 不改已有业务逻辑，纯新增 UI
  - 与 analysisStore 连接（7.1 已就绪）
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

搭建底部可折叠面板框架，集成 Chart.js，实现数据源选择器和标签页切换。本步骤完成后，运动/能量/动量视角的图表可在此框架内渲染真实数据。

## 上游依赖
- 7.0 框选与多选 ✅
- 7.1 数据记录框架 + 分析 Store ✅
- analysisStore（frameHistory / activeViews / activeDataSourceIds）已可用 ✅

## 下游消费
- 7.3 运动分析视角：在此框架中添加 v-t / a-t / x-t 图表
- 7.4 能量分析视角：添加 E-t / E柱状图
- 7.5 动量分析视角：添加 p-t / p柱状图
- 7.6 分析组/子系统：数据源选择器中显示分析组

---

## 架构分析

### 布局结构

```
当前布局（EditorLayout.tsx）：
┌──────────────────────────────────────────┐
│ Toolbar                                  │
├───────┬──────────────────────┬───────────┤
│ Object│       Canvas         │ Property  │
│ Panel │                      │ Panel     │
│ (w-60)│                      │ (w-70)    │
└───────┴──────────────────────┴───────────┘

目标布局：
┌──────────────────────────────────────────┐
│ Toolbar                                  │
├───────┬──────────────────────┬───────────┤
│ Object│       Canvas         │ Property  │
│ Panel │                      │ Panel     │
│       │                      │           │
│       ├──────────────────────┤           │
│       │ AnalysisPanel（可折叠）│           │
│       │ [数据源] │ [图表区]   │           │
└───────┴──────────────────────┴───────────┘
```

- AnalysisPanel 仅占据 Canvas 区域底部（不跨左右面板）
- Canvas 与 AnalysisPanel 纵向分割，面板展开时 Canvas 高度缩小
- 折叠时只显示标签栏（约 32px 高）
- 展开时高度 200px，可拖拽调整（min 120px, max 400px）

### 组件结构

```
EditorLayout.tsx（修改）
 └─ 中间区域改为 flex-col
    ├─ Canvas（flex-1）
    └─ AnalysisPanel（固定高度/可折叠）
       ├─ PanelHeader
       │   ├─ 左侧：视角 checkbox（☐运动 ☐能量 ☐动量）
       │   └─ 右侧：TabButton × N（由 activeViews 决定）+ 折叠按钮
       ├─ PanelBody（flex 水平，折叠时隐藏）
       │   ├─ DataSourceSelector（左侧 120px）
       │   │   └─ checkbox + 颜色标 + 物体名称
       │   └─ ChartArea（flex-1）
       │       └─ TimeSeriesChart（Chart.js Line）
       └─ ResizeHandle（拖拽条）
```

### 数据流

```
analysisStore.frameHistory → 选中的 activeTab 决定字段 → 按 activeDataSourceIds 过滤 → Chart.js datasets
```

### 标签页映射

| 分析视角 | 可用标签页 | 数据字段（来自 BodyFrameData） |
|---------|-----------|---------------------------|
| 运动 motion | v-t, a-t, x-t | speed, accel, displacement |
| 能量 energy | E-t | ek, epGravity, epSpring |
| 动量 momentum | p-t | momentum |

多个视角同时勾选时标签页合并。

---

## 数据源选择器设计

### 数据源列表
- 遍历 `scene.bodies`，过滤掉 static 物体（ground/wall/slope 等）
- 每项显示：checkbox + 颜色圆点 + label
- 颜色自动分配（固定色板循环）
- 7.6 阶段再加入分析组条目

### 色板（8 色循环）
```typescript
const CHART_COLORS = [
  '#ef4444', // 红
  '#3b82f6', // 蓝
  '#22c55e', // 绿
  '#f59e0b', // 橙
  '#8b5cf6', // 紫
  '#06b6d4', // 青
  '#ec4899', // 粉
  '#6366f1', // 靛
]
```

---

## 新增依赖

```bash
pnpm add chart.js react-chartjs-2
```

---

## 执行计划（6 步串行）

### 步骤 1：安装依赖
```bash
pnpm add chart.js react-chartjs-2
```

### 步骤 2：实现 analysisStore 的 activeViews 和 activeDataSourceIds

**修改**：`src/store/analysisStore.ts`

完善之前的空实现：
- `toggleView(view)`: 切换 activeViews 中对应视角
- `toggleDataSource(id)`: 切换 activeDataSourceIds 中对应 ID
- 新增 `getAvailableTabs()`: 根据 activeViews 返回可用标签页列表
- 新增 `activeTab: string`: 当前选中的标签页
- 新增 `setActiveTab(tab)`: 设置当前标签页

### 步骤 3：新建 AnalysisPanel 组件

**新建**：`src/components/panels/AnalysisPanel.tsx`

**职责**：
- 可折叠面板容器（展开/折叠动画）
- 顶部行左侧：视角 checkbox（☐运动 ☐能量 ☐动量），React 组件
- 顶部行右侧：标签页按钮（根据 activeViews 动态显示）+ 折叠按钮
- 左侧：DataSourceSelector
- 右侧：图表渲染区（根据 activeTab 选择图表组件）
- 底部拖拽条调整高度
- 无 activeViews 勾选时面板折叠（只保留 checkbox 行）

### 步骤 4：新建 DataSourceSelector 组件

**新建**：`src/components/panels/DataSourceSelector.tsx`

**职责**：
- 列出场景中所有 dynamic 物体
- 每行：checkbox + 颜色圆点 + 物体 label
- 勾选/取消控制 `analysisStore.activeDataSourceIds`
- 颜色按物体在 scene.bodies 中的 index 从色板取

### 步骤 5：新建 TimeSeriesChart 组件

**新建**：`src/components/charts/TimeSeriesChart.tsx`

**职责**：
- 通用时间序列折线图（Chart.js Line chart）
- Props: `dataKey: keyof BodyFrameData`（决定读哪个字段）、`label: string`（Y 轴标签）
- 从 analysisStore.frameHistory 读数据
- 按 activeDataSourceIds 过滤，每个数据源一条曲线
- 实时更新（仿真中 frameHistory 变化时刷新）
- Y 轴自动缩放
- 鼠标悬停 tooltip 显示精确值
- 注册 Chart.js 组件（CategoryScale, LinearScale, PointElement, LineElement 等）

### 步骤 6：修改布局集成

**修改**：`src/components/layout/EditorLayout.tsx`

- Canvas 区域改为 flex-col
- Canvas 下方插入 AnalysisPanel
- 面板展开时 Canvas flex-1 自适应缩小

### 步骤 7：门禁检查

- `pnpm lint && pnpm tsc --noEmit`
- 验证：面板展开/折叠、标签切换、数据源勾选、图表渲染

---

## 验收标准

- [ ] 安装 chart.js + react-chartjs-2 成功
- [ ] 底部面板可折叠/展开，折叠时只有标签栏
- [ ] 面板高度可拖拽调整（120-400px）
- [ ] 数据源选择器列出场景中所有 dynamic 物体
- [ ] 勾选数据源后图表中出现对应曲线
- [ ] 标签页根据 activeViews 动态显示
- [ ] 仿真运行时图表实时更新（v-t 曲线可见增长）
- [ ] Y 轴自动缩放，tooltip 显示精确值
- [ ] 面板不影响已有功能（Canvas 交互、属性面板等）
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 已决策项

1. **视角 checkbox 位置**：React 组件，放在图表区域顶部（AnalysisPanel 内，标签页行的左侧）。不在 Canvas 内渲染。
2. **能量 E-t 图表**：Ek / Ep_重 / Ep_弹 / E总 四条线画在**同一张图**上。理由：高考原题（2020 全国卷 I）就是同一坐标系画 Ek+Ep，核心教学价值在于看到"此消彼长 + E总守恒"的对比效果。PhET Energy Skate Park 同理。

## 不在本步骤做的事

- 柱状图组件（7.4 能量柱状图、7.5 动量柱状图时再加）
- 轨迹渲染（7.3）
- 分析组在数据源选择器中的展示（7.6）
- 图表暂停后拖拽回看 / 时间指示线（后续优化）
