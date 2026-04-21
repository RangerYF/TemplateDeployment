# 🎯 P01 受力分析模块 渐进式开发计划

## 📌 版本目标

高中物理教师能从预设库加载受力分析典型场景（~14 个统一场景），在同一场景内通过选择约束条件（光滑/粗糙、有无外力、运动状态等）实时观察受力变化，并在受力/运动/能量三种视角下观察完整物理过程。

## 🔄 开发流程总览

```
阶段1~5：基础体系建设（已完成）
  → 阶段6：场景统一化整改（预设合并 + 参数联动 + 条件驱动求解）  ← 新插入
    → 阶段7：连接体 + 弹簧体系（按统一场景模式设计）
      → 阶段8：圆周运动体系（按统一场景模式设计）
        → 阶段9：能量视角 + 特殊模型补全（传送带/半球/滑轮/浮力）
```

**设计模式转变（阶段6起）**：从"每种条件组合=独立预设"改为"每类模型=1个统一场景+条件选择参数"，对齐需求文档"选模型→选条件→自动受力"的交互设想。

## 📋 串行执行阶段

---

### 第1阶段：水平面场景补全 ✅ 已完成（2026-03-18）

**目标**：补全水平面全部 4 个变体预设，覆盖"施加外力"和"加速运动"两种典型题型。

**子任务链路**：求解器（外力）→ 求解器（加速）→ 预设 JSON × 2 → 注册 + 验证

**主要任务**：
1. 实现"水平面施加外力"求解器 — 物块在水平面上受斜向外力 F，分析 G/N/f/F 四个力的平衡或非平衡（含外力角度分解）
2. 实现"水平面加速运动"求解器 — 物块受水平推力做匀加速运动，含摩擦
3. 编写 2 个预设 JSON（`horizontal-with-force.json`、`friction-acceleration.json`）
4. 在 `index.ts` 注册新求解器和预设

**涉及文件范围**：
- `src/domains/mechanics/solvers/` — 新增 2 个求解器文件
- `src/domains/mechanics/presets/` — 新增 2 个预设 JSON
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 4 个水平面预设均可加载，参数调整后力的箭头方向和大小正确
✅ 施加外力场景：斜向力正确分解为水平和竖直分量，N ≠ mg（当外力有竖直分量时）
✅ 加速运动场景：物块位移随时间正确变化，停止施力后因摩擦减速
✅ 手算验证：m=2kg, F=10N, θ=30°, μ=0.3 时各力数值与手算一致

**本阶段产出**：
- 水平面 4 个预设全部就绪（FM-001 × 2 + FM-002 × 2）
- 已验证的外力分解求解逻辑，可被后续斜面、连接体场景复用

---

### 第2阶段：斜面体系 ✅ 已完成（2026-03-19）

**目标**：新增 `slope` 实体及渲染器，实现 4 个斜面变体预设。

**子任务链路**：slope 实体注册 → slope 渲染器 → 斜面求解器（静/下滑/上冲/光滑）→ 预设 JSON × 4 → 注册 + 验证

**主要任务**：
1. ✅ 注册 `slope` 实体类型 — properties 包含 angle（角度）、length（斜面长度）、friction（动摩擦因数）
2. ✅ 实现 slope 渲染器 — 绘制倾斜面 + 底部斜线填充（教材风格）+ 角度标注
3. ✅ 实现斜面求解器 — 支持 4 种场景变体（静止平衡 / 自由下滑 / 冲上斜面 / 光滑无摩擦），通过 qualifier 区分
4. ✅ 编写 4 个斜面预设 JSON
5. ✅ 物块旋转支持（底边与斜面对齐）
6. ✅ 力方向修正（N 法线方向 bug 修复，见 stage-2.1）

**涉及文件范围**：
- `src/domains/mechanics/entities/slope.ts` — 新增实体
- `src/domains/mechanics/renderers/slope-renderer.ts` — 新增渲染器
- `src/domains/mechanics/solvers/block-on-slope.ts` — 新增求解器（含多 qualifier 变体）
- `src/domains/mechanics/presets/` — 新增 4 个预设 JSON
- `src/domains/mechanics/index.ts` — 追加注册
- `src/core/types.ts` — MotionState 追加 rotation 字段
- `src/renderer/render-loop.ts` — 支持从 MotionState 更新 rotation
- `src/domains/mechanics/renderers/block-renderer.ts` — 旋转绘制支持
- `src/domains/mechanics/viewports/force-viewport.ts` — 旋转实体的中心计算和边缘起点修正

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 斜面在画布上正确绘制（角度、长度与参数一致）
✅ 物块在斜面上正确定位，底边与斜面对齐，力箭头从实体边缘出发
✅ 手算验证：m=2kg, θ=30°, μ=0.7 静止场景合力≈0
✅ 自由下滑场景：物块位移沿斜面方向随时间正确变化
✅ 光滑斜面：摩擦力为零，加速度 = gsinθ

**本阶段产出**：
- `slope` 实体 + 渲染器（后续连接体·斜面+悬挂可复用）
- 物块旋转支持（`MotionState.rotation`，通用能力）
- 斜面 4 个预设就绪

**遗留项（移至阶段3）**：
- 正交分解的完整实现（交互、动画、通用分解逻辑）作为独立阶段3开发
- 当前 force-viewport 中有临时的分解渲染代码，阶段3将重构

---

### 第3阶段：交互系统 + 正交分解 + 布局重设计 ✅ 已完成（2026-03-19）

**目标**：建立画布交互体系（实体/力箭头选中、hover、浮动面板），实现正交分解交互，重设计布局系统。

**详细设计文档**：
- `.tasks/active/P01/stage-3-interaction-architecture.md` — 架构方案
- `.tasks/active/P01/stage-3-interaction-design.md` — 交互设计
- `.tasks/active/P01/stage-3.1-placement-system-redesign.md` — 布局系统重设计

#### 3A：实体选择交互

**实际完成内容**：
1. ✅ 统一选中模型 — `Selection { type, id, data }` 替换 `selectedEntityId`，支持实体/力箭头/未来扩展类型
2. ✅ CanvasContainer 鼠标事件 — onClick / onMouseMove / onMouseLeave，通过 hitTest 分发
3. ✅ screenToWorld 反向坐标转换
4. ✅ 实体 hover 高亮 — shadowBlur 发光效果
5. ✅ 实体选中高亮 — shadowBlur 强发光，通过 `EntityRegistration.drawOutline` 注册轮廓路径
6. ✅ 选中实体弹出浮动参数面板（EntityPopover）— 替代原计划的"左侧面板滚动联动"

**与原计划的偏差**：
- ~~左侧 ParamPanel 选中联动~~ → 改为浮动 EntityPopover（Phase 1 更轻量）
- store 用 `Selection` 而非 `hoveredEntityId`（更通用）

#### 3B：力箭头交互 + 正交分解

**实际完成内容**：
1. ✅ ViewportInteractionHandler 注册机制 — 域代码注册交互处理器，公共层分发事件
2. ✅ 力箭头 hitTest — 线段 ± 8px 矩形碰撞，**始终可交互**（不需要先选中实体）
3. ✅ 力箭头 hover 发光 — shadowBlur + 加粗
4. ✅ ForcePopover 浮动面板 — 显示力名称/数值/方向 + 正交分解勾选
5. ✅ 分解动画 — 0.8s ease-out 渐入，0.3s ease-in 渐出
6. ✅ 分量箭头 — 从实体边缘出发，虚线样式，与共线力自动垂直偏移
7. ✅ 引导虚线 + 直角标记 — 从原力终点向分量轴投影
8. ✅ 分量标签 — 淡入动画，局部防重叠
9. ✅ 分解判定 — 力与坐标轴夹角 < 5° 视为"沿轴"，不显示分解选项
10. ✅ 参数变化时分量实时更新（无需重播动画）

**与原计划的偏差**：
- ~~需先选中实体才能交互力箭头~~ → 力箭头始终可直接点击
- ~~hover tooltip 文字~~ → 仅发光效果，无文字气泡
- ~~坐标系切换~~ → 设计决策不做，统一用求解器默认坐标系
- ~~重构求解器分解数据（自动投影）~~ → 保留求解器手动输出 components
- ~~浮动组件放 shell/components/~~ → 放在 `domains/mechanics/components/`（域内管理）

#### 3.1：布局系统重设计

**实际完成内容**：
1. ✅ 删除全局 PlacementContext 障碍物系统 — 出发点就错了，Popover 不需要全局避让
2. ✅ 力标签改用局部 `placeLabel()` + `occupied[]` 数组防重叠
3. ✅ Popover 改用 `pickPopoverPosition()` — 4 方向试探，不出界即选
4. ✅ FloatingUIDescriptor 追加 `anchorHalfSize` + `preferredDirection`（域计算，公共层消费）
5. ✅ DraggablePopover 改为 `data-drag-handle` 标题行拖拽，删除顶部灰色指示条

**涉及文件范围（实际）**：

公共代码：
- `src/core/types.ts` — 追加 Selection 接口、RenderContext 追加 selection/hoveredTarget、删除 placementContext
- `src/core/registries/renderer-registry.ts` — 追加 ViewportInteractionHandler + FloatingUIDescriptor + FloatingComponent 注册
- `src/core/registries/entity-registry.ts` — 追加可选 drawOutline
- `src/core/registries/index.ts` — 导出更新
- `src/core/physics/geometry.ts` — 追加几何工具函数
- `src/store/simulation-store.ts` — selection + hoveredTarget + select()/setHovered()
- `src/shell/App.tsx` — createRenderLoop 参数更新
- `src/shell/canvas/CanvasContainer.tsx` — hitTest 分发 + Popover 渲染
- `src/shell/canvas/DraggablePopover.tsx` — 新增
- `src/renderer/render-loop.ts` — drawOutline 高亮 + 交互 overlay 钩子
- `src/renderer/placement.ts` — 重写（placeLabel + pickPopoverPosition）

力学域：
- `src/domains/mechanics/interactions/force-interaction-handler.ts` — 新增
- `src/domains/mechanics/interactions/force-interaction-state.ts` — 新增
- `src/domains/mechanics/components/ForcePopover.tsx` — 新增
- `src/domains/mechanics/components/EntityPopover.tsx` — 新增
- `src/domains/mechanics/viewports/force-viewport.ts` — 力箭头缓存 + 标签局部防重叠
- `src/domains/mechanics/entities/block.ts` — 追加 drawOutline
- `src/domains/mechanics/entities/slope.ts` — 追加 drawOutline
- `src/domains/mechanics/entities/surface.ts` — 追加 drawOutline
- `src/domains/mechanics/solvers/block-on-slope.ts` — 分解标签
- `src/domains/mechanics/solvers/block-with-applied-force.ts` — 分解标签
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 鼠标 hover 实体有发光高亮，点击可选中
- [x] 力箭头可直接点击（不需要先选中实体），hover 有发光效果
- [x] 点击力箭头弹出 ForcePopover，显示力信息 + 分解选项
- [x] 勾选正交分解后，0.8s 分解动画流畅播放（分量箭头+引导线+直角标记+标签）
- [x] 不沿坐标轴的力显示分解选项，沿轴的力不显示
- [x] 取消分解时 0.3s 反向消失
- [x] 参数调整后分量数值实时更新（无动画）
- [x] 分量箭头从物体边缘出发，与独立力视觉一致
- [x] 点击空白区域取消选中
- [x] Popover 可通过标题行拖拽
- [x] Popover 方向跟随力方向（向下的力 → Popover 出现在下方）

**未实现（设计决策暂不做）**：
- 坐标系切换（统一用求解器默认坐标系）
- 重构求解器分解数据为自动投影（保留手动 components）
- 左侧 ParamPanel 选中联动滚动
- 力箭头 hover tooltip 文字气泡

**本阶段产出**：
- 统一选中模型（Selection）— 全产品受益
- ViewportInteractionHandler 注册机制 — 电磁域可复用
- 实体 drawOutline 注册 — 未来新实体自动适配选中高亮
- FloatingUIDescriptor + 浮动组件注册 — 通用浮动 UI 机制
- 力箭头交互 + ForcePopover + 正交分解动画
- 布局系统简化（删除 PlacementContext，标签局部防重叠，Popover 简单方向选择）
- 公共代码变更日志机制（`docs/public-api-changelog.md` + CLAUDE.md J7 规则）

---

### 第4阶段：运动视角 ✅ 已完成（2026-03-19）

**目标**：实现 motion viewport，让所有动态场景（摩擦减速、加速运动、斜面下滑/上冲）支持运动轨迹和 v-t / s-t 图显示。

**子任务链路**：MotionViewportData 提取逻辑 → motion-viewport 渲染器（轨迹 + 速度箭头 + 图表）→ 已有动态预设追加 motion 视角支持 → 验证

**前置依赖**：阶段2（斜面体系）产出的动态场景

**主要任务**：
1. 实现 motion-viewport 渲染器 — 绘制运动轨迹（虚线）、速度箭头（蓝色）、加速度箭头（红色）
2. 实现 v-t 图和 s-t 图的小窗口绘制 — 在画布右上角叠加运动学图表，基于 resultHistory 数据
3. 将已有动态预设的 `supportedViewports` 追加 `"motion"` — 摩擦减速、加速运动、斜面下滑/上冲
4. 在 `index.ts` 注册 motion viewport

**涉及文件范围**：
- `src/domains/mechanics/viewports/motion-viewport.ts` — 新增视角渲染器
- `src/domains/mechanics/presets/` — 修改已有动态预设 JSON，追加 motion 视角
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 切换到运动视角后，速度箭头方向和大小随时间正确变化
✅ v-t 图线性（匀变速），s-t 图抛物线形状正确
✅ 摩擦减速场景：速度从 v₀ 线性减至 0，位移曲线正确
✅ 斜面下滑场景：速度沿斜面方向增大，轨迹沿斜面绘制

**本阶段产出**：
- `motion` 视角渲染器（后续所有动态场景自动受益）
- v-t / s-t 图表绘制能力
- 已有动态预设增强为双视角（force + motion）

---

### 第5阶段：悬挂体系 ✅ 已完成（2026-03-19）

**目标**：新增 rope、pivot、rod 三种实体，实现 4 个悬挂场景预设（单绳、对称双绳、不对称双绳、绳+杆）。

**实际完成内容**：
1. ✅ 注册 `pivot` 实体类型 — 固定悬挂点，实心圆点 + 三角固定标记 + 斜线墙壁
2. ✅ 注册 `rope` 实体类型 — 轻绳，直线段渲染，从 pivot 到物块边缘
3. ✅ 注册 `rod` 实体类型 — 轻杆，双平行线 + 两端封口 + 空心铰接圆点（教材风格）
4. ✅ 单绳悬挂求解器 — G + T 二力平衡
5. ✅ 双绳悬挂求解器 — 拉密定理，三力平衡
6. ✅ 绳+杆混合悬挂求解器 — 绳只拉、杆可拉可压
7. ✅ 4 个预设 JSON + 角度参数绑定到绳/杆实体（点击可调）

**涉及文件范围**：

公共代码：
- `src/core/types.ts` — RenderContext 追加 `entities` 字段
- `src/renderer/render-loop.ts` — 构建 renderCtx 时传入 entities
- `src/core/engine/preset-loader.ts` — 步骤②b：实体 properties 中 ref 自动替换为 entityId

力学域：
- `src/domains/mechanics/entities/` — 新增 `pivot.ts`、`rope.ts`、`rod.ts`
- `src/domains/mechanics/renderers/` — 新增 `pivot-renderer.ts`、`rope-renderer.ts`、`rod-renderer.ts`、`connector-utils.ts`
- `src/domains/mechanics/solvers/` — 新增 3 个悬挂求解器
- `src/domains/mechanics/presets/` — 新增 4 个预设 JSON
- `src/domains/mechanics/viewports/force-viewport.ts` — 张力箭头垂直偏移（避开绳/杆）+ 标签偏移
- `src/domains/mechanics/components/EntityPopover.tsx` — 无参数时显示"无可调参数"
- `src/domains/mechanics/index.ts` — 追加全部注册

**验收标准**：
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] pivot 渲染为实心圆点 + 三角固定标记
- [x] rope 渲染为直线段，从 pivot 到物块边缘
- [x] rod 渲染为双平行线 + 铰接圆点，与 rope 视觉区分明显
- [x] 单绳悬挂：T = mg，合力=0
- [x] 双绳对称/不对称：角度调整后实时更新，拉密定理验证通过
- [x] 绳+杆：杆力方向正确
- [x] 张力箭头与绳/杆平行但不重合（垂直偏移 10px）
- [x] 点击绳/杆弹出浮动菜单可调角度
- [x] 已有 8 个预设无回归
- [x] 公共代码变更日志已更新

**本阶段产出**：
- `pivot`、`rope`、`rod` 三种实体 + 渲染器（后续连接体、滑轮场景复用）
- `getConnectorAttachPoint()` 工具函数 — 绳/杆端点与力箭头起点精确对齐
- 悬挂 4 个预设就绪（总预设 12 个）
- `connection` 关系类型的求解逻辑范例
- preset-loader 增强：实体 properties 中的 ref 自动替换
- 张力箭头偏移机制（force-viewport 增强）

---

### 第6阶段：场景统一化整改 ⏱️ 3~4 天

**目标**：将同类预设合并为"统一场景+条件选择"模式，对齐需求文档"选模型→设条件→自动受力"的交互设想。

**背景**：审查发现当前"每种条件组合=独立预设"的模式与需求文档存在根本偏差。需求期望老师在同一场景内通过切换条件（光滑/粗糙、静止/运动、有无外力）来观察力的变化，而非切换预设。现有架构已具备实现条件的基础设施（`select` 参数、`toggle` 参数、求解器多分支），只需重组预设和求解器。

**子任务链路**：ParamSchema 扩展 `visibleWhen` → 水平面 4 预设合并为 1 → 斜面 4 预设合并为 1 → 悬挂预设优化（合并对称/不对称） → 旧预设清理 + 注册更新 → 全量回归验证

**主要任务**：
1. **ParamSchema 扩展 `visibleWhen`**（公共代码）— 支持参数联动显隐，如选"光滑"时自动隐藏 μ 滑块，选"无外力"时隐藏 F/θ 参数。ParamPanel 组件适配条件渲染
2. **水平面统一场景** — 合并 4 个预设为 1 个「水平面受力」预设 + 1 个统一求解器，条件参数：接触面（光滑/粗糙 toggle）、有无外力（toggle）、初速度（slider，0=静止）。求解器根据条件组合自动推导力集合（含"先减后加速"等原本缺失的场景）
3. **斜面统一场景** — 合并 4 个预设为 1 个「斜面受力」预设，条件参数：接触面（toggle）、初速度（slider，0=从静止开始）、有无沿斜面外力（toggle + F slider）。求解器已基本统一（`block-on-slope.ts` 内有 4 条分支），微调即可
4. **悬挂预设优化** — 保持单绳/双绳/绳杆 3 种不同拓扑为独立预设（实体组成不同，不适合合并），但将对称/不对称双绳合并为 1 个预设（仅 α/β 默认值不同）
5. **清理旧预设和求解器** — 删除被合并的旧预设 JSON 和不再需要的旧求解器文件，更新 `index.ts` 注册

**涉及文件范围**：

公共代码（需与开发者 B 协商）：
- `src/core/types.ts` — `ParamSchema` 追加可选 `visibleWhen` 字段
- `src/shell/canvas/ParamPanel.tsx`（或对应组件）— 适配 `visibleWhen` 条件渲染

力学域：
- `src/domains/mechanics/solvers/` — 合并水平面 4 个求解器为 1 个统一求解器；斜面求解器微调（追加外力分支）
- `src/domains/mechanics/presets/` — 删除旧预设，新建统一预设 JSON
- `src/domains/mechanics/index.ts` — 更新注册（减少求解器和预设数量）

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 水平面统一场景：切换"光滑↔粗糙"，摩擦力箭头自动出现/消失
✅ 水平面统一场景：同时设置初速度和反向外力，实现"先减后加速"
✅ 水平面统一场景：选"无外力"后，F/θ 参数自动隐藏
✅ 斜面统一场景：切换"有无外力"，沿斜面外力箭头自动出现/消失
✅ 斜面统一场景：μ 调至临界值 tanθ 时，从"静止"自动过渡到"匀速下滑"
✅ 双绳悬挂：单预设内调整 α/β 可覆盖对称和不对称情况
✅ 所有运动场景的 motion 视角仍正常（图表、箭头无回归）
✅ 手算验证：与整改前相同参数组合的结果完全一致

**预设变化**：
| 整改前 | 整改后 |
|--------|--------|
| horizontal-block（静止无外力） | → 合并为 1 个「水平面受力」 |
| horizontal-with-force（有外力） | → |
| friction-deceleration（减速） | → |
| friction-acceleration（加速） | → |
| slope-static（静止） | → 合并为 1 个「斜面受力」 |
| slope-sliding-down（下滑） | → |
| slope-sliding-up（上冲） | → |
| slope-smooth（光滑） | → |
| single-rope-suspension | → 保留 |
| double-rope-symmetric | → 合并为 1 个「双绳悬挂」 |
| double-rope-asymmetric | → |
| rope-rod-suspension | → 保留 |
| **12 个预设** | **→ 5 个预设** |

**本阶段产出**：
- 统一场景模式确立 — 后续所有新场景按此模式设计
- `visibleWhen` 参数联动显隐能力 — 通用基础设施
- 预设数量精简（12→5），但覆盖场景反而更多（自动支持"先减后加速"、"斜面+外力"等原本缺失的条件组合）
- 用户体验对齐需求文档：同一场景内切换条件，无需换预设

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第7阶段：连接体 + 弹簧体系 ⏱️ 3~4 天

**目标**：新增 spring 实体，按统一场景模式实现连接体和弹簧场景。

**前置依赖**：阶段6（统一场景模式 + `visibleWhen`）

**子任务链路**：spring 实体 + 渲染器 → 水平连接体统一求解器 + 预设 → 斜面悬挂连接体求解器 + 预设 → 弹簧统一求解器 + 预设 → 验证

**主要任务**：
1. 注册 `spring` 实体类型 — category 为 `connector`，properties 含 stiffness（k）和 naturalLength；渲染为锯齿波形
2. 实现「水平连接体」统一场景 — 绳连两物体，条件参数：接触面（光滑/粗糙）、有无外力、显示模式（整体法/隔离法 select）。1 个统一求解器处理所有条件组合
3. 实现「斜面-悬挂连接体」统一场景 — 斜面物体经绳/定滑轮连悬挂物体，条件参数：斜面光滑/粗糙。复用阶段2 slope + 阶段5 rope/pulley
4. 实现「弹簧模型」统一场景 — 条件参数：方向（竖直悬挂/水平 select）、连接方式（弹簧连物体/弹簧连墙壁 select）。F=kx 弹性力，支持拉伸和压缩

**涉及文件范围**：
- `src/domains/mechanics/entities/spring.ts` — 新增实体
- `src/domains/mechanics/renderers/spring-renderer.ts` — 新增渲染器
- `src/domains/mechanics/solvers/` — 新增 3 个统一求解器
- `src/domains/mechanics/presets/` — 新增 3 个统一场景预设 JSON
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 弹簧渲染为锯齿形，拉伸/压缩时视觉长度变化
✅ 水平连接体：切换光滑/粗糙，摩擦力自动出现/消失；整体法/隔离法切换显示
✅ 斜面-悬挂连接体：两物体加速度大小相等，绳张力耦合正确
✅ 弹簧模型：切换竖直/水平，弹簧和物块布局自动变化
✅ 手算验证：m₁=2kg, m₂=3kg, F=10N, μ=0.2 时连接体 a 和 T 正确

**本阶段产出**：
- `spring` 实体 + 渲染器
- 3 个统一场景预设（水平连接体、斜面-悬挂连接体、弹簧模型）
- 多物体耦合求解逻辑

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第8阶段：圆周运动体系 ⏱️ 3~4 天

**目标**：按统一场景模式实现圆周运动场景，含水平圆周和竖直圆周，支持临界条件分析。

**前置依赖**：阶段7（连接体中绳连逻辑可复用）

**子任务链路**：圆周轨迹辅助渲染 → 水平圆周统一求解器 + 预设 → 竖直圆周统一求解器 + 预设 → 验证

**主要任务**：
1. 实现圆周轨迹辅助渲染 — 在 force viewport 中绘制参考圆（虚线圆弧），标注半径和圆心
2. 实现「水平圆周」统一场景 — 条件参数：向心力来源（摩擦力/绳拉力 select），质量、半径、角速度 slider。求解器统一处理临界条件（摩擦：ω_max；绳：断裂）
3. 实现「竖直圆周」统一场景 — 条件参数：连接方式（绳连/杆连 select），质量、半径、速度、观察位置（最高/最低/任意角度 slider）。求解器统一处理绳的最高点临界 v=√(gr) 和杆的推拉判定
4. 支持拖动角度观察不同位置的受力（角度参数 slider）

**涉及文件范围**：
- `src/domains/mechanics/solvers/` — 新增 2 个统一求解器
- `src/domains/mechanics/presets/` — 新增 2 个统一场景预设 JSON
- `src/domains/mechanics/viewports/force-viewport.ts` — 增强圆周辅助线渲染
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 圆周轨迹辅助线正确绘制，半径标注正确
✅ 水平圆周：切换摩擦/绳连，向心力来源和临界条件自动变化
✅ 水平圆周·摩擦：调整 ω 超过临界值时，提示"滑出"
✅ 竖直圆周：切换绳/杆，最高点受力分析结论不同
✅ 竖直圆周·绳：最高点 v < √(gr) 时绳松弛
✅ 竖直圆周·杆：最高点 v=0 时杆提供推力 = mg
✅ 手算验证：m=0.5kg, r=1m, v_顶=3m/s 时绳张力 = mv²/r - mg = 0.6N

**本阶段产出**：
- 2 个统一场景预设（水平圆周、竖直圆周）
- 圆周辅助线渲染能力
- 临界条件检测与提示逻辑

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第9阶段：能量视角 + 特殊模型补全 ⏱️ 4~5 天

**目标**：实现 energy viewport，补全传送带、半球、滑轮、浮力等需求文档中要求但未覆盖的模型，P01 模块交付。

**前置依赖**：阶段6~8 所有场景就绪

**子任务链路**：已有求解器补充 energyStates → energy-viewport 实现 → 动态预设追加 energy 视角 → 传送带实体 + 求解器 + 预设 → 半球求解器 + 预设 → 滑轮实体 + 求解器 + 预设 → 浮力求解器 + 预设 → 全量验证

**主要任务**：
1. 为已有动态求解器补充 `energyStates` 输出 — Ek、Ep_gravity、Ep_elastic、总机械能
2. 实现 energy-viewport 渲染器 — 画布侧边绘制能量条形图（动能/重力势能/弹性势能/总能），随时间动态变化
3. 将已有动态预设的 `supportedViewports` 追加 `"energy"`
4. **实现「传送带」统一场景**（FM-054，高考高频）— 新增 conveyor-belt 实体 + 渲染器，条件参数：传送带速度 v_belt、物体初速度 v₀、μ。求解器自动判断摩擦力方向（v₀ < v_belt 向前加速 / v₀ > v_belt 向后减速 / v₀ = v_belt 无摩擦）
5. **实现「半球模型」场景**（FM-053）— 新增 hemisphere 实体 + 渲染器，物体在半球面顶部，N=mgcosθ，支持调整角度观察受力变化和滑落临界条件
6. **实现「滑轮」统一场景**（FM-062）— 新增 pulley 实体 + 渲染器，条件参数：类型（定滑轮/动滑轮 select），定滑轮 a=(m₁-m₂)g/(m₁+m₂)，动滑轮 F=G/2
7. **实现「浮力」场景**（FM-061）— 浮力 F_buoy=ρ液gV排，条件参数：物体密度、液体密度，自动判断沉浮状态

**涉及文件范围**：
- `src/domains/mechanics/viewports/energy-viewport.ts` — 新增视角渲染器
- `src/domains/mechanics/entities/` — 新增 conveyor-belt、hemisphere、pulley 实体
- `src/domains/mechanics/renderers/` — 新增对应渲染器
- `src/domains/mechanics/solvers/` — 修改已有求解器（energyStates）+ 新增 4 个求解器
- `src/domains/mechanics/presets/` — 修改已有预设 + 新增 4 个统一场景预设 JSON
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 能量视角：条形图高度与物理量成正比，总能守恒（摩擦场景总能递减）
✅ 传送带：v₀ < v_belt 时摩擦力向前，v₀ > v_belt 时摩擦力向后，切换自动变化
✅ 半球模型：角度增大时 N 减小，滑落临界条件正确
✅ 定滑轮：两端物体加速度大小相等方向相反
✅ 动滑轮：省力一半，F=G/2
✅ 浮力场景：ρ物 < ρ液 时漂浮，ρ物 > ρ液 时沉底
✅ 手算验证：定滑轮 m₁=3kg, m₂=1kg 时 a=4.9m/s², T=14.7N

**本阶段产出**：
- `energy` 视角渲染器
- 传送带、半球、滑轮、浮力 4 个新场景
- P01 模块全部预设交付完成
- 三种视角（force / motion / energy）全面可用

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

## 🎯 当前焦点

**第6阶段：场景统一化整改**（待启动）

**已完成**：
- [x] 第1阶段：水平面场景补全（4 个预设全部就绪）
- [x] 第2阶段：斜面体系（slope 实体/渲染器/求解器 + 4 预设 + 物块旋转 + 力方向修正 + 角度标记修复 + 分量偏移防重叠）
- [x] 第3阶段：实体选择交互 + 正交分解系统（统一选中模型 + 力箭头交互 + 分解动画 + Popover）
- [x] 第3.1阶段：布局系统重设计（删除全局 PlacementContext + 简化 Popover 定位 + 实体 drawOutline 注册 + 发光高亮）
- [x] 第4阶段：运动视角（motion viewport + v-t/a-t/x-t 图表 + ViewportBar 视角切换）
- [x] 第5阶段：悬挂体系（pivot/rope/rod 实体 + 4 预设 + 张力偏移 + preset-loader ref 替换）

## ✅ 阶段检查点

| 阶段 | 检查项                                                                      |
| ---- | --------------------------------------------------------------------------- |
| 1 ✅ | 4 个水平面预设全部可加载 + 力箭头正确 + 手算验证通过                        |
| 2 ✅ | 斜面渲染正确 + 4 个斜面预设 + 物块旋转对齐 + 力方向手算验证                 |
| 3 ✅ | 实体选择交互 + 力箭头浮动菜单 + 正交分解动画(0.8s) + 布局系统简化          |
| 4 ✅ | 运动视角切换正常 + v-t/a-t/x-t 图表 + 速度/加速度箭头                      |
| 5 ✅ | 4 种悬挂场景力平衡正确 + 绳/杆教材风格渲染 + 角度可调                      |
| 6    | 预设合并 12→5 + visibleWhen 联动 + 条件切换无需换预设 + 全量回归            |
| 7    | 连接体统一场景 + 弹簧渲染变形 + 整体法/隔离法切换 + 3 个预设               |
| 8    | 圆周运动统一场景 + 临界条件提示 + 绳/杆切换 + 2 个预设                     |
| 9    | 能量条形图 + 传送带 + 半球 + 滑轮 + 浮力 + 全量验证                        |

## 📊 预设数量规划

| 阶段 | 场景预设 | 累计 |
|------|---------|------|
| 阶段1~5（已完成） | 12 个（整改前） | 12 |
| 阶段6（统一化整改） | 12→5（合并） | 5 |
| 阶段7（连接体+弹簧） | +3（水平连接体、斜面悬挂连接体、弹簧） | 8 |
| 阶段8（圆周运动） | +2（水平圆周、竖直圆周） | 10 |
| 阶段9（能量+特殊模型） | +4（传送带、半球、滑轮、浮力） | 14 |

> 虽然预设数量从原计划的 ~23 降至 ~14，但每个统一场景覆盖的条件组合远多于原来的单一预设，**实际覆盖的物理场景数量反而增加**。

## 🚫 暂时不考虑

- 性能优化（Canvas 重绘优化、求解缓存）
- 用户自定义实体拖拽（Phase 2）
- 3D 渲染
- 通用碰撞检测引擎
- 动量视角（属于 P-12 模块）
- 电磁域相关功能（属于开发者 B）
- 国际化 / 多语言
- 移动端适配优化
- 预设导入/导出功能
- 凹槽模型 FM-055（Phase 2）
- 杠杆模型 FM-063（Phase 2，初中内容）
- 导出图片功能（Phase 2）
- 多物体对比模式（Phase 2）
- 时间轴高级控制——单步/倒放/调速（Phase 2）

## 📝 开发笔记

> 此区域在开发过程中记录关键发现、技术决策和问题。

- **坐标系约定**：物理 Y 向上，Canvas Y 向下，`worldToScreen` 中 `y: origin.y - point.y * scale`
- **Block 定位**：底边中心在 `transform.position`，向上延伸 `height`
- **力箭头起点**：由 `getEdgeStart()` 统一处理，支持矩形（width+height）和圆形（radius）
- **参数优先级**：求解器应优先读取 `scene.paramValues`，其次读取关系属性/实体属性
- **已有 4 个求解器参考实现**：
  - `block-on-surface.ts` — 静力平衡
  - `block-friction-deceleration.ts` — 动力学解析解（匀减速）
  - `block-with-applied-force.ts` — 斜向外力分解（含 toggle 联动、N≤0 边界处理）
  - `block-friction-acceleration.ts` — 水平推力加速（简化版，无角度分解）
- **外力 ForceType**：Phase 1 使用 `custom`（灰色 #7F8C8D），不修改 core/types.ts
- **外力标签命名**：使用 `F外`（非 `F`），与 `F合` 风格一致
- **toggle 联动模式**：求解器读取 `scene.paramValues[toggleKey]` 判断是否启用，预设 JSON 中 toggle 和关联 slider 放同一 paramGroup
- **标签防重叠系统**（force-viewport.ts）：
  - 每个标签生成 4 个候选位置（终点上/下、中点左/右等）
  - 贪心评分：对每个候选计算与已放置标签 + 其他箭头的重叠面积，选最小
  - 标签跳过自己所属的箭头（通过 arrowIndex 配对），只避开其他力的箭头
  - 合力箭头与独立力夹角 < 30° 时自动垂直偏移（isNearlyCollinear 点积判定）
- **合力为零**：画布不显示 F合=0 标签，InfoPanel 文案"合力为零，受力平衡"已足够
- **物块旋转支持**（阶段2新增）：
  - `MotionState.rotation` 新增可选字段（core/types.ts 追加）
  - `render-loop.ts` 从 motionState 临时更新实体 rotation（与 position 同机制）
  - `block-renderer.ts` 当 rotation ≠ 0 时用 Canvas translate+rotate 绘制
  - force-viewport center 计算：`center = pos + R(rotation) * (0, height/2)`
  - 斜面求解器输出 `rotation = -angleRad`，物块底边与斜面对齐
- **斜面位置计算**（阶段2修正）：
  - 斜面斜边从 bottomRight 到 topCorner，方向 (-cosθ, sinθ)
  - `slopeBlockPos(slopePos, slopeLength, d, cosA, sinA)` 统一计算物块在斜面上的位置
  - `d` = 从斜面底端（bottomRight）沿斜边向上的距离
- **场景统一化设计原则**（阶段6决策）：
  - 同一物理模型的条件变体合并为 1 个预设，用 `select`/`toggle` 参数切换条件
  - 求解器根据 `paramValues` 动态决定力的集合（哪些力出现/消失/方向改变）
  - `ParamSchema.visibleWhen` 实现参数联动显隐（如"光滑"时隐藏 μ）
  - 不同拓扑结构的场景（如单绳 vs 双绳）仍为独立预设（实体组成不同）
  - 统一场景的 qualifier 简化为 1 个，不再按条件变体注册多个 qualifier
