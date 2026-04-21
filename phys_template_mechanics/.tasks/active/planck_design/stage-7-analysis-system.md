# 阶段7：物理分析系统（框选 + 运动/能量/动量分析）

> 任务ID：03-26-stage7-analysis-system
> 风险等级：L2（跨模块联动，新增依赖 Chart.js，selectionStore 重构）
> 状态：待执行
> 设计文档：`stage-7-analysis-system-design.md`

---

## 任务概述

在已有受力分析视角基础上，扩展为完整的物理分析系统：
- 实现框选/多选（分析组的前置能力）
- 实现底部图表面板（Chart.js）
- 实现运动/能量/动量三个分析视角
- 实现分析组/子系统（多体系统分析）

覆盖需求模块：P-02 运动模拟、P-12 动量守恒、P-14 机械能守恒。

---

## 执行链路

```
7.0 框选与多选
 → 7.1 数据记录框架 + 分析 Store
 → 7.2 底部图表面板 UI 框架
 → 7.3 运动分析视角
 → 7.4 能量分析视角
 → 7.5 动量分析视角
 → 7.6 分析组/子系统
```

---

## 7.0 框选与多选

### 目标
实现框选和 Shift+点击多选，为分析组创建提供基础交互。

### 改动范围

**selectionStore 扩展**：
- `selected: SelectableObject | null` → `selected: SelectableObject[]`
- 新增 `addToSelection(obj)` / `removeFromSelection(obj)` / `toggleSelection(obj)`
- 现有消费端适配（PropertyPanel、Canvas、SelectTool 等读取 selected 的地方）

**SelectTool 扩展**：
- 空白区域左键拖拽 → 绘制框选矩形
- 松手时 hitTest 框内所有物体，全部加入 selected
- Shift+点击物体 → toggleSelection
- 点击空白（非拖拽）→ clearSelection
- 点击单个物体（不按 Shift）→ 仅选中该物体

**多选状态下的行为**：
- 属性面板：显示共有属性，值不同时显示"—"
- 拖拽移动：整体移动所有选中物体（保持相对位置）
- Delete 键：删除所有选中物体
- 多选时工具栏出现"创建分析组"按钮（7.6 实现）

**视觉反馈**：
- 框选矩形：蓝色半透明填充 + 蓝色虚线边框
- 多选物体：每个都显示选中高亮边框

### 验收标准
- [ ] 空白区域拖拽出现框选矩形，松手选中框内物体
- [ ] Shift+点击追加/移除选中
- [ ] 多选后拖拽整体移动
- [ ] 多选后 Delete 删除全部
- [ ] 点击空白取消全部选中
- [ ] 单击物体（不按Shift）仅选中该物体
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 7.1 数据记录框架 + 分析 Store

### 目标
每帧记录所有物体的物理量（位置、速度、加速度、动量、能量），供图表消费。

### 新增文件

**`src/engine/AnalysisRecorder.ts`**：
- 挂载在 PhysicsBridge.step() 中，每帧调用
- 记录每个 body 的：位置(x,y)、速度(vx,vy,|v|)、加速度(ax,ay,|a|)、动量(px,py,|p|)、Ek、Ep_gravity、Ep_spring
- 加速度通过速度差分计算（当前帧 v - 上帧 v）/ dt
- 弹性势能通过遍历弹簧 Joint 获取
- 环形缓冲区存储，最多 1800 帧（60秒 × 30fps 降采样）

**`src/store/analysisStore.ts`**：
- `analysisGroups: AnalysisGroup[]` — 分析组管理
- `dataSources: DataSource[]` — 当前可用数据源列表（所有物体 + 所有分析组）
- `activeDataSources: Set<string>` — 用户勾选的数据源 ID
- `activeViews: Set<'force'|'motion'|'energy'|'momentum'>` — 激活的分析视角
- `frameHistory: FrameRecord[]` — 历史帧数据

### 数据类型

```typescript
interface BodyFrameData {
  x: number; y: number;
  vx: number; vy: number; speed: number;
  ax: number; ay: number; accel: number;
  px: number; py: number; momentum: number;
  ek: number;
  epGravity: number;
  epSpring: number;
}

interface GroupFrameData {
  cmX: number; cmY: number;
  cmVx: number; cmVy: number; cmSpeed: number;
  totalPx: number; totalPy: number; totalMomentum: number;
  totalEk: number;
  totalEpGravity: number;
  totalEpSpring: number;
  totalE: number;
}

interface FrameRecord {
  t: number;
  bodies: Record<string, BodyFrameData>;
  groups: Record<string, GroupFrameData>;
}

interface AnalysisGroup {
  id: string;
  name: string;
  bodyIds: string[];
  color: string;
}
```

### 验收标准
- [ ] 仿真运行时 AnalysisRecorder 每帧记录数据
- [ ] analysisStore 正确维护 frameHistory
- [ ] 停止仿真时清空历史数据
- [ ] 内存不超限（环形缓冲区生效）
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 7.2 底部图表面板 UI 框架

### 目标
实现底部可折叠面板，集成 Chart.js，搭建数据源选择器和标签页切换。

### 新增依赖
- `chart.js` + `react-chartjs-2`

### 新增文件

**`src/components/panels/AnalysisPanel.tsx`**：
- 底部可折叠面板容器
- 高度约 200-250px，可拖拽调整
- 折叠时只显示一行标签栏

**`src/components/panels/DataSourceSelector.tsx`**：
- 左侧数据源列表（~120px）
- 列出所有物体 + 所有分析组
- 每项前有 checkbox + 颜色标记
- 勾选/取消控制图表显示

**`src/components/charts/TimeSeriesChart.tsx`**：
- 通用时间序列折线图组件（复用于 v-t、a-t、x-t、E-t、p-t）
- 支持多数据集（多条曲线不同颜色）
- 实时更新 + 自动 Y 轴缩放
- 鼠标悬停 tooltip

**`src/components/charts/BarChart.tsx`**：
- 通用柱状图组件（复用于 E柱状、p柱状）
- 支持堆叠/分组柱状

**布局集成**：
- 修改主布局，在画布和右侧面板之间插入底部面板
- 视角 checkbox 渲染在画布底部地面以下区域

### 验收标准
- [ ] 底部面板可折叠/展开
- [ ] 数据源选择器列出场景中所有物体
- [ ] 标签页切换正常
- [ ] Chart.js 图表可渲染（静态测试数据）
- [ ] 勾选运动/能量/动量时面板自动展开
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 7.3 运动分析视角

### 目标
实现 v-t、a-t、x-t 三个图表 + 可选轨迹渲染。

### 图表内容
- **v-t**：纵轴=速度标量|v|，横轴=时间
- **a-t**：纵轴=加速度标量|a|，横轴=时间
- **x-t**：纵轴=位移（相对初始位置的距离），横轴=时间

### 轨迹渲染（画布叠加）
- 每 N 帧记一个点，渲染在画布上
- 颜色同物体颜色，透明度渐变（越早越淡）
- 可在视角设置中开关

### 验收标准
- [ ] 自由落体：v-t 为直线（匀加速验证）
- [ ] 斜面滑动：x-t 为抛物线
- [ ] 单摆：v-t 为正弦波形
- [ ] 多个物体勾选时同一图上多条曲线
- [ ] 轨迹点阵正确显示运动路径
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 7.4 能量分析视角

### 目标
实现 E-t 时间曲线 + E柱状图。

### 图表内容
- **E-t 曲线**：多条线 — Ek（红#F44336）、Ep_重（蓝#2196F3）、Ep_弹（绿#4CAF50）、E总（灰#9E9E9E 虚线）
  - 有摩擦时 E总 递减
  - Q 摩擦热（橙#FF9800）= 初始E总 - 当前E总
- **E柱状图**：当前时刻各能量分量的高度，实时更新

### 能量计算
- Ek = ½mv²
- Ep_gravity = mgy（y 为物体质心相对地面的高度）
- Ep_spring = 从弹簧 Joint 获取（½k·Δx²，Δx = 当前长度 - 自然长度）
- Q = E总_初始 - E总_当前（摩擦耗散）

### 验收标准
- [ ] 自由落体：Ek↑ + Ep↓ = E总 恒定
- [ ] 弹簧振子：Ek 和 Ep_弹 交替变化，E总 守恒
- [ ] 有摩擦斜面：E总 递减，Q 递增
- [ ] 柱状图实时反映当前时刻能量分布
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 7.5 动量分析视角

### 目标
实现 p-t 时间曲线 + p柱状图 + 碰撞事件标记。

### 图表内容
- **p-t 曲线**：纵轴=动量标量|p|=m|v|，横轴=时间
  - 碰撞时刻单体动量突变，系统总动量水平线
- **p柱状图**：碰撞前后各物体动量对比 + 系统总动量
  - 直观验证 Σp_before = Σp_after

### 碰撞事件检测
- 利用已有 post-solve 事件的 ContactImpulse
- 当冲量超过阈值时标记为碰撞事件
- 在图表上用竖线标注碰撞时刻
- 柱状图自动捕获碰撞前/后的快照

### 验收标准
- [ ] 两物体碰撞：各自 p-t 曲线在碰撞时刻突变
- [ ] 勾选分析组时：系统总动量 p-t 为水平线（守恒验证）
- [ ] 碰撞时刻在图表上有竖线标记
- [ ] p柱状图显示碰前/碰后对比
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 7.6 分析组/子系统

### 目标
多选物体后创建分析组，作为图表数据源，显示系统级汇总数据。

### 交互流程
1. 框选或 Shift+点击选中多个物体
2. 工具栏出现"创建分析组"按钮
3. 点击后创建分析组，自动命名（"系统1"），可修改
4. 分析组出现在数据源选择器中
5. 勾选后图表显示系统汇总数据

### 系统级数据计算
- 质心位置：Σ(mi·ri) / Σmi
- 质心速度：Σ(mi·vi) / Σmi
- 系统总动量：Σ(mi·vi)
- 系统总动能：Σ(½mi·vi²)
- 系统总势能：Σ(mi·g·yi) + Σ(½k·Δx²)
- 系统总机械能：总动能 + 总势能

### 管理
- 数据源选择器中可删除分析组
- 物体被删除时自动从所属分析组移除
- 分析组内只剩 0-1 个物体时提示用户

### 验收标准
- [ ] 多选后可创建分析组
- [ ] 分析组出现在数据源选择器中
- [ ] 勾选分析组后图表显示系统汇总数据
- [ ] Atwood 机：系统总动量守恒、系统机械能守恒（无摩擦时）
- [ ] 碰撞场景：系统总动量守恒
- [ ] 删除物体时分析组自动更新
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 用户原始决策记录

| 决策项 | 结论 | 来源 |
|--------|------|------|
| 分析对象选择 | 数据源选择器，单体和子系统平级，用户自由勾选 | 用户 |
| 图表位置 | 底部可折叠面板 | 用户 |
| 视角共存 | 可叠加（checkbox 独立控制） | 用户 |
| 框选交互 | SelectTool 下左键拖拽空白=框选 | 用户 |
| 多选交互 | Shift+点击追加/移除 | 用户 |
| 画布矢量 | 只保留力箭头，运动/能量/动量不画箭头 | 用户确认 |
| 视角控制位置 | 画布底部地面以下区域 | 用户 |
| 图表库 | Chart.js | 用户确认 |
| 数据显示 | 默认标量（\|v\|、\|a\|、\|p\|），不做分量切换 | 用户确认 |
| P-09 天体运动 | 不在本阶段考虑 | 用户 |
