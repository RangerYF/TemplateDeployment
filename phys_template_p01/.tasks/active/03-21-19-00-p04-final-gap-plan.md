# P-04 最终缺口合并计划（Phase 2 UI + U-I 图 + 实物图）

| 字段 | 值 |
|------|-----|
| 任务ID | 03-21-19-00-p04-final-gap-plan |
| 风险等级 | **L3（关键风险）** — Phase 2 涉及公共代码大面积改动 |
| 前置计划 | `03-21-17-00-phase2-circuit-builder-ui.md`（Phase 2 UI 详细方案） |

---

## 一、当前完成度总览

### ✅ 已完成（无需再动）

| 维度 | 完成项 |
|------|--------|
| 元件实体 | 14 个全部就绪（含 bulb、motor、capacitor、resistance-box、galvanometer） |
| 渲染器 | 14 个全部就绪（含故障叠加、发光效果、旋钮显示、功率标注） |
| 求解器 | 12 个全部就绪（含非线性灯泡、电动机功率分解、半偏法/欧姆表/电桥） |
| 预设 | 13 个电磁域预设 |
| 功能 1：自动电路分析 | ✅ 电流/电压/功率实时计算 |
| 功能 2：动态电路分析 | ✅ 调参实时重算 + 导线电流方向箭头 |
| 功能 3：量程超限提示 | ✅ 变红 + 超量程警告 |
| 功能 4：故障模拟 | ✅ 断路/短路 + 高亮 + 求解器联动 |
| 功能 5：内/外接法对比 | ✅ 一键切换 + 误差原因 + 对比表 + 推荐接法 |
| 五大实验 | ✅ 全部 5 个实验模板（含步骤引导、公式、误差分析） |
| 实验模板模式 | ✅ PresetGallery 选择预设 |

### ❌ 缺失（本计划覆盖）

| # | 缺失项 | 归属 | 优先级 |
|---|--------|------|--------|
| GAP-1 | Phase 2 自由搭建 UI（拖拽元件 + 连线 + 运行） | Phase 2 | P0 |
| GAP-2 | U-I 图表可视化（测 EMF 实验的散点图 + 拟合线） | 教学增强 | P1 |
| GAP-3 | 电路图↔实物图切换 | 视觉增强 | P2 |

---

## 二、GAP-1：Phase 2 自由搭建 UI（详见前置计划）

> 完整方案已在 `03-21-17-00-phase2-circuit-builder-ui.md` 中定义，此处仅列执行摘要。

### 架构

```
HomePage（新首页）
  ├─ [实验模板] → PresetGallery → SimulatorView（不变）
  └─ [自由搭建] → CircuitBuilderView（全新）
                    ├─ ComponentPalette（元器件库侧边栏）
                    ├─ BuilderCanvas（可交互画布：拖入/选中/移动/连线）
                    ├─ PropertyPanel（选中元件属性编辑）
                    └─ BuilderToolbar（运行/停止/清空）
```

### 文件清单

**新增 8 个文件**：
1. `src/shell/pages/HomePage.tsx` — 首页（两个入口卡片）
2. `src/shell/pages/CircuitBuilderView.tsx` — 搭建模式主页面
3. `src/shell/panels/ComponentPalette.tsx` — 元器件库（从 entityRegistry 动态获取）
4. `src/shell/panels/PropertyPanel.tsx` — 选中元件属性面板
5. `src/shell/canvas/BuilderCanvas.tsx` — 搭建模式专用画布（drag/drop/click/wire）
6. `src/shell/timeline/BuilderToolbar.tsx` — 底部工具栏（运行/停止/清空）
7. `src/store/builder-store.ts` — 搭建模式独立 Zustand store
8. `src/core/engine/scene-builder.ts` — 动态场景构建（entities+relations → SceneDefinition → 匹配求解器）

**修改 3 个公共文件**：
9. `src/shell/App.tsx` — 路由扩展（home/simulator/builder 三页面）
10. `src/renderer/render-loop.ts` — 选中高亮增强（矩形/圆形适配）+ 可选连线渲染钩子
11. `src/store/index.ts` — 追加导出 builder-store

### 执行批次

| 批次 | 内容 | 文件 |
|------|------|------|
| P2-B1 | builder-store（独立 store，addEntity/removeEntity/addConnection/runCircuit） | 1 新 |
| P2-B2 | scene-builder（entities+relations → SceneDefinition → solverRegistry.match） | 1 新 |
| P2-B3 | App.tsx 路由重构（三页面 hash 路由） + HomePage | 1 新 + 1 改 |
| P2-B4 | ComponentPalette（entityRegistry.getAll → 分类列表 → HTML5 Drag） | 1 新 |
| P2-B5 | BuilderCanvas（drag/drop 接收 + mouseDown 命中检测 + 拖拽移动 + 连线交互） | 1 新 |
| P2-B6 | render-loop 增强（选中高亮适配 + 可选连线渲染） | 1 改 |
| P2-B7 | PropertyPanel（从 entityRegistry.paramSchemas 生成控件） | 1 新 |
| P2-B8 | CircuitBuilderView + BuilderToolbar（组装页面 + 运行/停止/清空） | 2 新 |
| P2-B9 | store/index 导出 + 集成回归 | 1 改 |

### 公共代码协商

| 文件 | 改动性质 | 向后兼容 |
|------|----------|----------|
| `App.tsx` | 路由扩展，SimulatorView 内部零改动 | ✅ 旧 hash 格式兼容 |
| `render-loop.ts` | 选中高亮改进 + 追加 optional 钩子 | ✅ 新参数全 optional |
| `store/index.ts` | 追加一行导出 | ✅ |

---

## 三、GAP-2：U-I 图表可视化

### 需求
测电源 EMF 实验中，用户调节滑动变阻器时：
- 自动在画布上绘制 U-I 散点
- 每次调参记录一个 (I, U) 数据点
- 用最小二乘法拟合直线 U = ε - Ir
- 显示拟合结果：ε（截距）和 r（斜率绝对值）

### 设计方案

**不引入图表库**，直接用 Canvas 2D 在画布右侧空白区绘制。

#### 文件改动

**新增 1 个文件**：
- `src/domains/em/viewports/ui-chart.ts` — U-I 图绘制工具函数

**修改 2 个文件**：
- `src/domains/em/viewports/circuit-viewport.ts` — 当 `circuitType === 'measure-emf-r'` 时调用 U-I 图绘制
- `src/domains/em/solvers/measure-emf-r.ts` — 追加数据点记录逻辑

#### 数据流设计

```typescript
// measure-emf-r 求解器追加：
// 将当前 (I, U) 写入 source.properties.dataPoints
// dataPoints 是一个数组，每次 sliderRatio 变化时追加新点
source.properties.lastI = I_A;
source.properties.lastU = U_terminal;
```

```typescript
// circuit-viewport 中追加 U-I 图渲染：
// 从 source.properties 读取当前 (I, U)
// 在画布右侧 200×150 区域绘制坐标轴 + 散点 + 拟合线

function renderUIChart(c, canvas, dpr, source) {
  const I = source.properties.lastI;
  const U = source.properties.lastU;
  const emf = source.properties.emf;
  const r = source.properties.internalResistance;

  // 坐标轴：X=I(0~0.6A), Y=U(0~6V)
  // 当前点：红色实心圆
  // 理论线：U = emf - I*r（蓝色虚线）
  // 标注：ε=截距, r=|斜率|
}
```

**简化方案**：不做历史数据点记录（避免 store 复杂度），仅显示：
1. 理论 U-I 直线（蓝色虚线）
2. 当前工作点（红色实心圆，随滑片移动）
3. 坐标标注

#### 执行批次

| 批次 | 内容 |
|------|------|
| UI-B1 | 新增 `ui-chart.ts` 绘制函数 |
| UI-B2 | 改动 `circuit-viewport.ts`，`measure-emf-r` 场景追加图表渲染 |
| UI-B3 | 改动 `measure-emf-r.ts` 追加 lastI/lastU 写入 |

---

## 四、GAP-3：电路图↔实物图切换

### 需求
一键切换标准电路图 ↔ 实物连线图，帮助学生建立对应关系。

### 设计方案

**这是最大工作量的功能**，需要：
- 全新的实物图渲染模式（逼真器件外观：电池、导线接线柱、表盘刻度盘）
- 实物图布局算法（器件不再沿水平排列，而是模拟实验桌面布局）
- 连线从接线柱出发，可弯折

#### 分步策略

**Phase 2a（最小可用）**：仅对简单串联电路实现
- 新增渲染模式标记 `viewMode: 'schematic' | 'realistic'`
- 实物图渲染器：为 5 种核心元件（电源/电阻/开关/电流表/电压表）各绘制一套逼真外观
- 实物图布局：预计算固定位置（桌面布局，电源左上、电阻中间、仪表右侧）
- 连线：从接线柱位置出发画导线

**Phase 2b（增强）**：扩展到复杂电路

#### 文件清单

**新增文件**：
1. `src/domains/em/renderers/realistic/` 目录 — 实物图渲染器集合
   - `realistic-dc-source.ts` — 电池外观（干电池/电池组）
   - `realistic-resistor.ts` — 色环电阻外观
   - `realistic-switch.ts` — 刀闸开关外观
   - `realistic-ammeter.ts` — 表盘式电流表外观（含刻度盘）
   - `realistic-voltmeter.ts` — 表盘式电压表外观
   - `realistic-wires.ts` — 实物导线（从接线柱出发，可弯折）
2. `src/domains/em/viewports/realistic-viewport.ts` — 实物图视角渲染器

**修改文件**：
- `src/core/types.ts` — ViewportType 追加 `'realistic'`（需协商）
- 预设 JSON — supportedViewports 追加 `'realistic'`

#### 执行批次

| 批次 | 内容 | 优先级 |
|------|------|--------|
| RV-B1 | ViewportType 追加 + realistic-viewport 骨架 | P2 |
| RV-B2 | 5 个核心元件的实物图渲染器 | P2 |
| RV-B3 | 实物图布局算法 + 导线绘制 | P2 |
| RV-B4 | 预设 JSON 追加 supportedViewports + UI 切换按钮 | P2 |

---

## 五、总执行顺序

### 第一阶段：Phase 2 自由搭建（P0）

| 序号 | 批次 | 内容 | 新/改 |
|------|------|------|-------|
| 1 | P2-B1 | builder-store | 1 新 |
| 2 | P2-B2 | scene-builder | 1 新 |
| 3 | P2-B3 | App.tsx 路由 + HomePage | 1 新 + 1 改 |
| 4 | P2-B4 | ComponentPalette | 1 新 |
| 5 | P2-B5 | BuilderCanvas | 1 新 |
| 6 | P2-B6 | render-loop 增强 | 1 改 |
| 7 | P2-B7 | PropertyPanel | 1 新 |
| 8 | P2-B8 | CircuitBuilderView + BuilderToolbar | 2 新 |
| 9 | P2-B9 | 集成回归 | 1 改 |

**小计**：8 新 + 3 改 = 11 文件

### 第二阶段：U-I 图表（P1）

| 序号 | 批次 | 内容 | 新/改 |
|------|------|------|-------|
| 10 | UI-B1 | ui-chart.ts 绘制函数 | 1 新 |
| 11 | UI-B2 | circuit-viewport 追加图表渲染 | 1 改 |
| 12 | UI-B3 | measure-emf-r 追加数据点输出 | 1 改 |

**小计**：1 新 + 2 改 = 3 文件

### 第三阶段：实物图渲染（P2）

| 序号 | 批次 | 内容 | 新/改 |
|------|------|------|-------|
| 13 | RV-B1 | ViewportType + realistic-viewport 骨架 | 1 新 + 1 改 |
| 14 | RV-B2 | 5 个实物图渲染器 | 5 新 |
| 15 | RV-B3 | 布局算法 + 导线 | 1 新 |
| 16 | RV-B4 | 预设 JSON + UI 切换 | 多改 |

**小计**：7 新 + 多改

### 总计

| 阶段 | 新文件 | 修改文件 | 公共代码 |
|------|--------|----------|----------|
| 阶段一（Phase 2 UI） | 8 | 3 | 3（App/render-loop/store-index） |
| 阶段二（U-I 图表） | 1 | 2 | 0 |
| 阶段三（实物图） | 7 | 多 | 1（types.ts 追加 ViewportType） |
| **合计** | **16** | **多** | **4** |

---

## 六、风险与决策点

| 决策点 | 选项 | 推荐 |
|--------|------|------|
| Phase 2 builder store 与 simulation store 的关系 | A: 合并 B: 独立 | **B 独立**（互不干扰） |
| U-I 图实现方式 | A: Canvas 2D 手绘 B: 引入 Recharts | **A 手绘**（不新增依赖） |
| 实物图实现时机 | A: 与 Phase 2 同步 B: 延后 | **B 延后**（工作量最大，优先级 P2） |
| CanvasContainer 是否改动 | A: 改动追加 props B: BuilderCanvas 独立实现 | **B 独立**（减少公共改动） |
