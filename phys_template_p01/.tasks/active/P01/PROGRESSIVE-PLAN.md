# 🎯 P01 受力分析模块 渐进式开发计划

## 📌 版本目标

高中物理教师能从预设库加载 13 类受力分析典型场景（~23 个预设），通过参数调整复现物理题，并在受力/运动/能量三种视角下观察完整物理过程。

## 🔄 开发流程总览

```
阶段1：水平面场景补全（已有实体复用）
  → 阶段2：斜面体系（新实体 slope）
    → 阶段3：正交分解系统（交互 + 动画 + 通用分解逻辑）
      → 阶段4：运动视角（motion viewport，增强已有动态场景）
        → 阶段5：悬挂体系（新实体 rope/pivot/rod）
          → 阶段6：连接体 + 弹簧体系（新实体 spring）
            → 阶段7：圆周运动体系（复杂物理，复用已有实体）
              → 阶段8：能量视角 + 特殊模型收尾（pulley/buoyancy）
```

每个阶段产出可独立运行的预设，后续阶段复用前序阶段的实体和渲染器。

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

### 第3阶段：实体选择交互 + 正交分解系统 ⏱️ 5~6 天

**目标**：先建立实体选择交互基础（hover、点击选中、力箭头交互），再基于此实现正交分解功能（选择目标力、分解动画、通用分解逻辑）。

**需求来源**：
- 产品讨论记录 v2：「Phase 1 中的实体应该能点击选中。正确的交互方式是：画面上看到什么、点什么、改什么」
- PRD 验收标准：「正交分解动画流畅，分量箭头和数值实时更新」
- 产品方案：「点击"正交分解"按钮 → 分解动画播放，虚线箭头+直角标记，动画时长0.8s」

**⚠️ 公共代码协商提醒**：
本阶段涉及大量公共代码修改（`src/shell/`、`src/renderer/`、`src/store/`、`src/core/`），
根据 CLAUDE.md F2 目录归属声明，需要与开发者 B 协商后再动工。
建议：由开发者 A 主导实现，开发者 B review 公共层改动。

**⚠️ 交互设计待确认**：
下方的交互设计为初稿，阶段3正式启动时需要与用户再次确认交互方案，可能需要优化调整。
不要直接按当前方案执行，先做交互评审。

#### 3A：实体选择交互基础（前置子阶段）

**现状**：
- ✅ store 已有 `selectedEntityId` 和 `selectEntity()`
- ✅ render-loop 已有 `drawSelectionHighlight()`
- ✅ 每个实体注册时已提供 `hitTest` 函数
- ❌ CanvasContainer 没有绑定鼠标事件
- ❌ 没有屏幕坐标 → 物理坐标的反向转换
- ❌ 没有 hover 效果
- ❌ 选中实体后没有联动属性面板

**交互流程**：

```
画布交互：
  鼠标移动 → hitTest 检测 → 命中实体 → cursor 变手型 + hover 高亮
  鼠标点击 → hitTest 检测 → 命中实体 → 选中（蓝色边框高亮）
  点击空白区域 → 取消选中

选中实体后：
  左侧参数面板自动滚动到该实体的参数组
  或者在实体附近弹出浮动属性面板（轻量版）

选中物块后 → 可以进一步点击力箭头（见 3B）
```

**涉及文件（⚠️ 全部为公共代码）**：
- `src/shell/canvas/CanvasContainer.tsx` — 添加 onClick / onMouseMove 事件
- `src/renderer/coordinate.ts` — 新增 `screenToWorld()` 反向转换函数
- `src/renderer/render-loop.ts` — hover 高亮绘制
- `src/store/simulation-store.ts` — 新增 `hoveredEntityId`
- `src/shell/panels/ParamPanel.tsx` — 选中实体时高亮/滚动到对应参数组

**验收标准**：
- [ ] 鼠标 hover 到实体上，cursor 变手型，实体轻微高亮
- [ ] 点击实体，蓝色选中框出现，左侧面板联动
- [ ] 点击空白区域取消选中
- [ ] hitTest 能正确区分重叠实体（取最近的）

---

#### 3B：力箭头交互 + 正交分解

**基于 3A 的实体选择，进一步实现力的交互和正交分解**。

**核心交互流程**：

```
                  ┌─────────────────────────────────┐
                  │           画布场景               │
                  │                                  │
                  │      ╱│                          │
                  │     ╱ │   ← 斜面                │
                  │    ╱  │                          │
                  │   ╱ ■ │   ← 物块（可点击选中）  │
                  │  ╱____|                          │
                  │                                  │
                  │  选中物块后，力箭头变为可交互：   │
                  │  hover 到 G 箭头 → 高亮 + tooltip │
                  │  点击 G 箭头 → 弹出浮动菜单      │
                  │                                  │
                  └─────────────────────────────────┘

点击力箭头后弹出的浮动菜单：
  ┌───────────────────┐
  │ G = 19.6 N        │  ← 力的信息
  │ 方向：竖直向下     │
  │───────────────────│
  │ ☐ 正交分解        │  ← 勾选后播放分解动画
  │                   │
  │ 坐标系：          │
  │ ○ 沿斜面/垂直斜面 │  ← 当斜面场景时显示
  │ ○ 水平/竖直       │
  └───────────────────┘
```

**完整操作链路**：

```
  ① 点击画布中的物块
     ↓
  物块选中高亮，力箭头进入可交互状态
     ↓
  ② hover 某个力箭头
     ↓
  该力箭头加粗 + tooltip 显示力的名称和大小
     ↓
  ③ 点击该力箭头
     ↓
  弹出浮动菜单（力信息 + 分解选项）
     ↓
  ④ 勾选「正交分解」
     ↓
  播放 0.8s 分解动画：
  - 两个分量箭头从零长度渐变到目标长度（从实体边缘出发，虚线样式）
  - 从原力终点向分量终点画引导虚线渐入
  - 分量标签淡入（mgsinθ=9.8N, mgcosθ=17.0N）
     ↓
  ⑤ 调整参数（如改变角度、质量）
     ↓
  分量数值实时更新，无需重播动画
     ↓
  ⑥ 取消勾选 / 点击空白 / 选中其他实体
     ↓
  0.3s 反向动画消失
```

**力箭头 hitTest 设计**：
- 选中实体后，该实体的力箭头参与 hitTest
- 力箭头的碰撞区域 = 箭头线段 ± 8px 的矩形
- 优先级：力箭头 > 实体（因为力箭头在实体上方）
- 未选中实体时，力箭头不响应鼠标（避免误操作）

**浮动菜单设计**：
- 出现在被点击的力箭头终点附近
- 跟随力箭头位置（参数变化时实时更新位置）
- 点击菜单外部关闭
- 同一时间只显示一个浮动菜单

**分解判定逻辑**（自动判断是否显示分解选项）：
- 给定坐标系 (axis1, axis2)，计算力方向与两轴的夹角
- 力与某轴夹角 < 5° → 视为"沿该轴"，浮动菜单中不显示分解选项
- 两个轴都不沿 → 浮动菜单中显示分解选项
- 示例：斜面坐标系下，G 可分解（与两轴都不平行），N 不可分解（沿法线轴）

**动画系统**：
- per-force 动画状态：`{ progress: 0~1, direction: 'in' | 'out' }`
- requestAnimationFrame 驱动
- 渐入：0.8s ease-out，渐出：0.3s ease-in
- 分量箭头长度 = 目标长度 × progress
- 引导虚线透明度 = 0.35 × progress
- 标签透明度 = progress
- 参数变化时分量实时跟随（不触发动画）

**坐标系**：
- 求解器提供默认坐标系 + 可选坐标系列表
- 斜面场景默认「沿斜面/垂直斜面」，可切换「水平/竖直」
- 水平面外力场景默认「水平/竖直」
- 切换坐标系 → 分量重新计算 + 重播动画

**主要任务**：

1. **力箭头 hitTest**
   - 选中实体后，力箭头注册到 hitTest 系统
   - 碰撞区域为线段 ± 8px 矩形
   - hover 时高亮 + tooltip

2. **浮动菜单组件**
   - React 组件，绝对定位在力箭头终点附近
   - 显示力信息 + 分解选项
   - 坐标系切换（当有多个可选坐标系时）

3. **通用分解计算**
   - 渲染器根据坐标系自动对力做投影
   - 求解器只输出坐标系定义 `{ axis1, axis2, alternativeAxes? }`
   - 分量值 = 力在坐标轴上的投影，渲染器自动计算

4. **重构求解器分解数据**
   - 当前：求解器手动指定 `components: [{ force, component1, component2 }]`
   - 目标：求解器只输出 `decomposition: { axis1, axis2 }`
   - 渲染器自动计算所有力的分量

5. **分解动画系统**
   - 动画状态管理 + requestAnimationFrame 驱动
   - 渐入/渐出动画

6. **force-viewport 渲染重构**
   - 分量箭头从物体边缘出发，虚线样式
   - 引导虚线 + 直角标记
   - 分量标签参与统一防重叠系统
   - 清理阶段2遗留的临时分解代码

**涉及文件范围**：
- ⚠️ `src/shell/canvas/CanvasContainer.tsx` — 鼠标事件绑定（公共）
- ⚠️ `src/renderer/coordinate.ts` — screenToWorld 反向转换（公共）
- ⚠️ `src/renderer/render-loop.ts` — hover 高亮（公共）
- ⚠️ `src/store/simulation-store.ts` — hoveredEntityId、力交互状态（公共）
- ⚠️ `src/core/types.ts` — 调整 OrthogonalDecomposition 接口（公共）
- ⚠️ `src/shell/panels/ParamPanel.tsx` — 选中联动（公共）
- ⚠️ `src/shell/components/` — 新增浮动菜单组件（公共）
- `src/domains/mechanics/viewports/force-viewport.ts` — 分解渲染重构 + 动画（力学域）
- `src/domains/mechanics/solvers/*.ts` — 简化分解数据输出（力学域）
- `src/domains/mechanics/presets/` — 相关预设配置（力学域）

**验收标准**：
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过
- [ ] 鼠标 hover 实体有高亮反馈，点击可选中
- [ ] 选中物块后，hover 力箭头有视觉反馈
- [ ] 点击力箭头弹出浮动菜单，显示力信息
- [ ] 勾选正交分解后，0.8s 分解动画流畅播放
- [ ] 不沿坐标轴的力显示分解选项，沿轴的力不显示
- [ ] 取消分解时 0.3s 反向消失
- [ ] 参数调整后分量数值实时更新（无动画）
- [ ] 切换坐标系后分量正确重算 + 重播动画
- [ ] 分量箭头从物体边缘出发，与其他力视觉一致
- [ ] 手算验证：m=2kg, θ=30° 时 mgsinθ=9.8N, mgcosθ=17.0N

**本阶段产出**：
- 实体选择交互系统（hover + 选中 + 联动面板）— 全产品受益
- 力箭头交互能力（hover + 点击 + 浮动菜单）
- 通用正交分解系统（选择力 → 动画 → 分量显示）
- 分解动画引擎
- 坐标系切换能力

---

### 第4阶段：运动视角 ⏱️ 3 天

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

### 第5阶段：悬挂体系 ⏱️ 4 天

**目标**：新增 rope、pivot、rod 三种实体，实现 3 个悬挂场景预设（单绳、双绳、绳+杆）。

**子任务链路**：pivot 实体 → rope 实体 + 渲染器 → rod 实体 + 渲染器 → 单绳求解器 + 预设 → 双绳求解器 + 预设 → 绳+杆求解器 + 预设 → 验证

**主要任务**：
1. 注册 `pivot` 实体类型 — 固定悬挂点，category 为 `constraint`，渲染为实心圆点 + 三角固定标记
2. 注册 `rope` 实体类型 — 轻绳（不可伸长），category 为 `connector`，properties 含 length；渲染为直线段
3. 注册 `rod` 实体类型 — 轻杆（可承压/拉），category 为 `connector`，properties 含 length；渲染为粗直线段
4. 实现单绳悬挂求解器 — G + T 二力平衡
5. 实现双绳悬挂求解器 — G + T₁ + T₂ 三力平衡，通过角度解方程
6. 实现绳+杆混合悬挂求解器 — 绳提供拉力、杆提供压力或拉力
7. 编写 4 个预设 JSON（单绳、对称双绳、不对称双绳、绳+杆）

**涉及文件范围**：
- `src/domains/mechanics/entities/` — 新增 `pivot.ts`、`rope.ts`、`rod.ts`
- `src/domains/mechanics/renderers/` — 新增 `pivot-renderer.ts`、`rope-renderer.ts`、`rod-renderer.ts`
- `src/domains/mechanics/solvers/` — 新增 3 个悬挂求解器
- `src/domains/mechanics/presets/` — 新增 4 个预设 JSON
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 绳/杆从悬挂点到物块的线段正确渲染，长度与参数一致
✅ 单绳悬挂：T = mg，张力箭头沿绳向上
✅ 双绳悬挂：调整角度后 T₁、T₂ 实时更新，三力平衡（合力为零）
✅ 手算验证：m=1kg, θ₁=30°, θ₂=60° 时 T₁、T₂ 与拉密定理一致
✅ 绳+杆场景：杆力方向正确（可能为压力，即方向反转）

**本阶段产出**：
- `pivot`、`rope`、`rod` 三种实体 + 渲染器（后续连接体、滑轮场景复用）
- 悬挂 4 个预设就绪
- `connection` 关系类型的求解逻辑范例

---

### 第6阶段：连接体 + 弹簧体系 ⏱️ 3~4 天

**目标**：新增 spring 实体，实现 3 个连接体预设 + 2 个弹簧预设。

**子任务链路**：spring 实体 + 渲染器 → 连接体·水平求解器 + 预设 → 连接体·斜面+悬挂求解器 + 预设 → 弹簧连接求解器 + 预设 → 弹簧平衡/拉伸预设 → 验证

**主要任务**：
1. 注册 `spring` 实体类型 — category 为 `connector`，properties 含 stiffness（劲度系数 k）和 naturalLength（原长）；渲染为锯齿波形
2. 实现连接体·水平求解器 — 绳连两物体在水平面上受力拉动，支持整体法和隔离法切换显示
3. 实现连接体·斜面+悬挂求解器 — 斜面上物体经绳连定滑轮连另一物体（使用阶段2的 slope 和阶段5的 rope）
4. 实现弹簧连接求解器 — F = kx 弹性力，支持拉伸和压缩
5. 编写 5 个预设 JSON

**涉及文件范围**：
- `src/domains/mechanics/entities/spring.ts` — 新增实体
- `src/domains/mechanics/renderers/spring-renderer.ts` — 新增渲染器
- `src/domains/mechanics/solvers/` — 新增 3~4 个求解器
- `src/domains/mechanics/presets/` — 新增 5 个预设 JSON
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 弹簧渲染为锯齿形，拉伸/压缩时视觉长度变化
✅ 连接体·水平：两物体加速度一致，绳张力 = m₂ × a
✅ 连接体·斜面+悬挂：斜面物体和悬挂物体通过绳力耦合，加速度正确
✅ 弹簧场景：F = kx，调整 k 或位移后弹力实时更新
✅ 手算验证：m₁=2kg, m₂=3kg, F=10N, μ=0.2 时连接体加速度和绳张力正确

**本阶段产出**：
- `spring` 实体 + 渲染器
- 连接体 3 个 + 弹簧 2 个预设就绪
- 多物体耦合求解逻辑（为圆周运动中的绳连圆周做准备）

---

### 第7阶段：圆周运动体系 ⏱️ 4~5 天

**目标**：实现 4 个圆周运动预设，含水平圆周和竖直圆周（绳/杆），支持临界条件分析。

**子任务链路**：圆周轨迹渲染（辅助虚线圆）→ 水平圆周·摩擦求解器 + 预设 → 水平圆周·绳连求解器 + 预设 → 竖直圆周·绳求解器 + 预设 → 竖直圆周·杆求解器 + 预设 → 验证

**主要任务**：
1. 实现圆周轨迹辅助渲染 — 在 force viewport 中绘制参考圆（虚线圆弧），标注半径和圆心
2. 实现水平圆周·摩擦提供向心力求解器 — 物块在转台上做匀速圆周运动，临界条件 f_max = μmg = mω²r
3. 实现水平圆周·绳连求解器 — 绳拉物块做水平圆周运动，T = mω²r
4. 实现竖直圆周·绳求解器 — 最高点最低点受力分析，最高点临界条件 mg = mv²/r
5. 实现竖直圆周·杆求解器 — 与绳的区别：最高点杆力可为零或推力，无最小速度限制
6. 编写 4 个预设 JSON，支持拖动角度观察不同位置的受力

**涉及文件范围**：
- `src/domains/mechanics/solvers/` — 新增 4 个圆周运动求解器
- `src/domains/mechanics/presets/` — 新增 4 个预设 JSON
- `src/domains/mechanics/viewports/force-viewport.ts` — 增强圆周辅助线渲染
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 圆周轨迹辅助线正确绘制，半径标注正确
✅ 水平圆周·摩擦：调整 ω 超过临界值时，提示"滑出"
✅ 竖直圆周·绳：最高点 v < √(gr) 时绳松弛（力消失）
✅ 竖直圆周·杆：最高点 v=0 时杆提供推力 = mg
✅ 手算验证：m=0.5kg, r=1m, v_顶=3m/s 时绳张力 = mv²/r - mg = 0.6N

**本阶段产出**：
- 圆周运动 4 个预设就绪
- 圆周辅助线渲染能力
- 临界条件检测逻辑

---

### 第8阶段：能量视角 + 特殊模型收尾 ⏱️ 4 天

**目标**：实现 energy viewport，补全滑轮和浮力特殊模型，P01 模块全部预设交付。

**子任务链路**：已有求解器补充 energyStates 输出 → energy-viewport 实现 → 动态预设追加 energy 视角 → pulley 实体 + 渲染器 + 求解器 + 预设 → 浮力求解器 + 预设 → 全量验证

**主要任务**：
1. 为已有动态求解器补充 `energyStates` 输出 — Ek、Ep_gravity、Ep_elastic、总机械能
2. 实现 energy-viewport 渲染器 — 画布侧边绘制能量条形图（动能/重力势能/弹性势能/总能），随时间动态变化
3. 将已有动态预设的 `supportedViewports` 追加 `"energy"`
4. 注册 `pulley` 实体类型 + 渲染器 — 定滑轮，绘制为圆 + 轴心，category 为 `connector`
5. 实现定滑轮求解器 — 两端悬挂物体，加速度 a = (m₁-m₂)g/(m₁+m₂)
6. 实现浮力求解器 — 浮力 F_buoy = ρ_液gV_排，与重力平衡或不平衡
7. 编写 2 个特殊模型预设 JSON（定滑轮、浮力）

**涉及文件范围**：
- `src/domains/mechanics/viewports/energy-viewport.ts` — 新增视角渲染器
- `src/domains/mechanics/entities/pulley.ts` — 新增实体
- `src/domains/mechanics/renderers/pulley-renderer.ts` — 新增渲染器
- `src/domains/mechanics/solvers/` — 修改已有求解器 + 新增 2 个求解器
- `src/domains/mechanics/presets/` — 修改已有预设 + 新增 2 个预设 JSON
- `src/domains/mechanics/index.ts` — 追加注册

**验收标准**：
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ 能量视角：条形图高度与物理量成正比，总能守恒（摩擦场景总能递减）
✅ 斜面下滑场景：Ep 减小 + Ek 增大，能量守恒可视化
✅ 定滑轮：两端物体加速度大小相等方向相反，绳张力相等
✅ 浮力场景：调整液体密度后浮力实时更新
✅ 手算验证：定滑轮 m₁=3kg, m₂=1kg 时 a=4.9m/s², T=14.7N

**本阶段产出**：
- `energy` 视角渲染器
- `pulley` 实体 + 渲染器
- P01 模块全部 ~23 个预设交付完成
- 三种视角（force / motion / energy）全面可用
- 正交分解系统完整可用（通用分解 + 动画）

---

## 🎯 当前焦点

**第3阶段：实体选择交互 + 正交分解系统**（待启动，需与开发者 B 协商公共代码）

**已完成**：
- [x] 第1阶段：水平面场景补全（4 个预设全部就绪）
- [x] 第2阶段：斜面体系（slope 实体/渲染器/求解器 + 4 预设 + 物块旋转 + 力方向修正 + 角度标记修复 + 分量偏移防重叠）

## ✅ 阶段检查点

| 阶段 | 检查项                                                                 |
| ---- | ---------------------------------------------------------------------- |
| 1 ✅ | 4 个水平面预设全部可加载 + 力箭头正确 + 手算验证通过                   |
| 2 ✅ | 斜面渲染正确 + 4 个斜面预设 + 物块旋转对齐 + 力方向手算验证            |
| 3    | 实体选择交互 + 力箭头浮动菜单 + 正交分解动画(0.8s) + 多场景验证       |
| 4    | 运动视角切换正常 + v-t/s-t 图表显示 + 轨迹渲染                        |
| 5    | 3 种悬挂场景力平衡正确 + 绳/杆渲染正确                                |
| 6    | 连接体加速度一致 + 弹簧渲染变形 + 5 个预设                            |
| 7    | 圆周运动临界条件正确 + 辅助圆绘制 + 4 个预设                          |
| 8    | 能量条形图正确 + 滑轮/浮力预设 + 全量 ~23 预设通过                     |

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
