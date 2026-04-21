# 🎯 物理编辑器 MVP 渐进式开发计划

## 📌 版本目标
为中国初高中物理教师构建 2D 物理编辑器 MVP：能拖拽物体到画布、设置属性和关系、运行物理仿真、查看受力分析，并加载预设场景。

## 🔄 开发流程总览
```
项目脚手架 → 引擎+画布 → 编辑器框架 → 物体类型 → 编辑交互优化 → 约束系统 → 力的体系 → 分析系统 → 打磨交付
```

阶段0产出（可运行空项目 + 设计系统）
→ 阶段1产出（Planck.js 集成 + Canvas 渲染 + 编辑/仿真切换）
→ 阶段2产出（Tool/Selection/Command 系统 + 面板拖拽）
→ 阶段3产出（7种基础物体类型可创建）
→ 阶段3.2产出（+4种扩展物体，共11种物体全部可用）
→ 阶段3.3产出（Body Type Registry 重构，消除 switch 耦合）
→ 阶段4产出（选中手柄旋转/缩放 + 表面吸附系统 + 对齐辅助线）✅
→ 阶段4.1产出（交互能力 Descriptor 化重构，Ground 正式注册）✅
→ 阶段5产出（绳/杆/弹簧/滑轮绳约束可用）✅
→ 阶段6产出（受力分析视角完整可用）✅
→ 阶段7.0产出（框选多选）✅
→ 阶段7.1产出（数据记录框架 + 分析 Store）✅
→ 阶段7.2产出（图表面板 + 全部时序图表 + 能量柱状图 + Q摩擦热）✅
→ 阶段7.3产出（分析组 + p柱状图 + 碰撞检测）
→ 阶段8产出（视觉打磨 + 可交付版本）✅

---

## 📋 串行执行阶段

### 第0阶段：项目脚手架与设计系统集成 ✅ 已完成

**目标**：搭建可运行的空项目，集成 EduMind 设计系统，确保开发环境就绪。

**主要任务**：
1. 使用 Vite + React 18 + TypeScript 初始化项目
2. 配置 pnpm、ESLint、Prettier、Tailwind CSS
3. 将 `design_guid/` 中的设计系统文件搬移到正式项目目录（`src/styles/`、`src/components/ui/`、`src/lib/utils/`）
4. 配置 Tailwind 集成 EduMind 色彩 token
5. 安装设计系统所需依赖（class-variance-authority、clsx、tailwind-merge、lucide-react 等）
6. 安装 Planck.js 和 Zustand
7. 验证设计系统组件可正常渲染

**涉及文件范围**：
- `package.json` - 项目依赖配置
- `vite.config.ts` - Vite 构建配置
- `tsconfig.json` - TypeScript 配置
- `tailwind.config.ts` - Tailwind 配置（从 design_guid 搬移并适配）
- `src/styles/` - 设计 token（从 design_guid/styles/ 搬移）
- `src/components/ui/` - UI 基础组件（从 design_guid/ui/ 搬移）
- `src/lib/utils/` - 工具函数（cn.ts）
- `src/App.tsx` - 入口组件（空壳）
- `.eslintrc` / `.prettierrc` - 代码风格配置

**验收标准**：
✅ `pnpm dev` 启动成功，浏览器可见空白页面
✅ 设计系统 Button 组件可正常渲染
✅ Tailwind `eduMind-*` 类名生效
✅ `import planck from 'planck'` 不报错
✅ ESLint + TypeScript 检查通过

**本阶段产出**：
可运行的空项目 + 完整设计系统 + 所有依赖就绪。后续阶段在此基础上逐步构建编辑器功能。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第1阶段：物理引擎集成与画布渲染 ✅ 已完成

**目标**：Planck.js 物理引擎跑通，Canvas 能渲染物体，实现编辑/仿真模式切换。

**主要任务**：
1. 创建 Planck.js World 封装层（Physics Bridge 基础）
   - 初始化 World + 全局重力配置
   - 创建/销毁 Body 的基本接口
2. 创建 Canvas 渲染层基础
   - React Canvas 组件，自适应容器尺寸
   - 坐标系转换（屏幕坐标 ↔ 物理世界坐标）
   - 渲染矩形和圆形（基本物体外观）
   - 背景网格线渲染
3. 实现编辑/仿真模式切换（Zustand 状态管理）
   - 编辑模式：静态展示物体
   - 仿真模式：`world.step()` 循环 + 每帧更新渲染
   - 播放/暂停/停止控制
4. 实现画布基础交互
   - 画布平移（中键拖拽 / 空格+拖拽）
   - 画布缩放（滚轮）
5. 创建默认地面（水平静态边界）

**涉及文件范围**：
- `src/engine/` - 物理引擎桥接层
- `src/renderer/` - Canvas 渲染层
- `src/store/` - Zustand 状态管理
- `src/components/Canvas.tsx` - 画布 React 组件
- `src/components/Toolbar.tsx` - 播放控制工具栏

**验收标准**：
✅ 画布上能看到一个方块从空中自由落体
✅ 方块落到地面后弹起（碰撞检测工作）
✅ 点击"播放"开始仿真，点击"停止"回到初始位置
✅ 画布可平移和缩放
✅ 网格线正常显示

**本阶段产出**：
Planck.js + Canvas 渲染 + 编辑/仿真切换的基础框架。后续阶段在此框架上构建编辑器交互。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第2阶段：编辑器框架（交互系统 + 面板） ✅ 已完成

**目标**：实现 Tool/Selection/Command 三大系统 + 左侧物体面板拖拽 + 右侧属性面板，形成完整的编辑器交互闭环。

**主要任务**：
1. 搭建编辑器整体布局（左面板 + 画布 + 右面板 + 顶部工具栏）
2. 实现 Scene Model 数据层
   - SceneBody / SceneJoint / SceneForce 数据结构定义
   - Zustand store 管理场景数据
   - Scene Model → Physics Bridge 单向同步
3. 实现 Selection 系统
   - Canvas hitTest（点击检测物体）
   - 单选物体 + 选中高亮
   - 点击空白/ESC 取消选中
   - hover 高亮
4. 实现 Tool 系统基础
   - Tool 接口定义
   - SelectTool（选中 + 拖拽移动物体）
   - 工具切换机制
5. 实现 Command 系统（Undo/Redo）
   - Command 接口 + CommandHistory
   - AddBodyCommand / RemoveBodyCommand / MoveBodyCommand / ChangePropertyCommand
   - Ctrl+Z / Ctrl+Shift+Z 快捷键
6. 实现左侧物体面板
   - 物体缩略图列表（分组：基础物体 / 支撑面）
   - 拖拽放置到画布（drag-and-drop）
   - 放置碰撞处理（自动推开到无重叠位置）
7. 实现右侧属性面板
   - 根据选中物体类型动态显示属性
   - 属性编辑（质量、摩擦系数、弹性系数、初速度等）
   - 属性修改通过 Command 系统执行（可撤销）

**涉及文件范围**：
- `src/core/` - 编辑器核心（Tool、Selection、Command）
- `src/models/` - Scene Model 数据结构与类型定义
- `src/store/` - Zustand store 扩展（场景数据、选中状态、工具状态）
- `src/components/layout/` - 编辑器布局组件
- `src/components/panels/` - 左侧物体面板、右侧属性面板
- `src/components/Toolbar.tsx` - 工具栏扩展（工具切换 + Undo/Redo）

**验收标准**：
✅ 从左侧面板拖出物块/球体到画布，物体正确显示
✅ 点击画布上物体可选中，右侧面板显示属性
✅ 可在属性面板修改质量、摩擦系数等，物理行为相应变化
✅ 选中物体可拖拽移动
✅ Ctrl+Z 撤销操作，Ctrl+Shift+Z 重做操作
✅ 点击空白取消选中，面板清空

**本阶段产出**：
完整的编辑器交互框架。后续阶段在此框架上扩展物体类型、约束类型和力的体系。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第3阶段：物体类型扩展 ✅ 已完成（阶段3.0 基础物体）

**目标**：实现基础物体类型，每种物体有正确的物理形状和渲染外观。

**已完成（阶段3.0）— 7 种基础物体**：
- block（物块）、ball（球体）、bar（杆件）— 动态体
- slope（斜面）、wall（墙壁）、anchor（固定锚点）— 用户设定 static/dynamic
- ground（地面）— 内置静态体

**验收标准**：
✅ 可从面板拖出斜面、墙壁、固定锚点、球体、杆件到画布
✅ 斜面显示为三角形，可设置底边长度和高度
✅ 物块放在斜面上能沿斜面下滑（仿真模式）
✅ 球体在斜面上能滚动
✅ 固定锚点显示为小圆点

---

### 第3.2阶段：扩展物体类型 ✅ 已完成

**目标**：实现扩展物体类型，补全物体库。

**已完成 — 新增 4 种物体**：
- groove（V形槽）— 两个凸 Polygon Fixture，多 fixture 支持
- hemisphere（半球面）— ChainShape 弧线采样
- pulley-mount（滑轮座）— Circle Shape + 滑轮渲染，阶段4 PulleyJoint 固定点
- conveyor（传送带）— Box Shape + pre-solve setTangentSpeed，动画履带效果

**已移除**：turntable（转盘）— 2D 侧视图引擎无法模拟俯视图水平圆周运动

**引擎层新增能力**：
- ShapeConfig 增加 `chain` 类型（弧线）
- BodyConfig 支持多 Fixture（V形槽左右壁）+ `userData`（传送带）
- PhysicsBridge：ChainShape 创建、pre-solve conveyor 机制
- BodyState 增加 `shapes`（多 fixture）+ `userData`

**验收标准**：
✅ 11 种物体类型全部可从面板拖出
✅ 传送带仿真时带动物块移动（动画履带效果）
✅ 半球面上球体能沿弧面滑动
✅ V形槽能支撑球体
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**详细任务文档**：`stage-3.2-extended-objects.md`

---

### 第3.3阶段：Body Type Registry 重构 ✅ 已完成

**目标**：引入物体类型注册表，消除 6 文件 12+ 处 switch/case 耦合。

**已完成**：
- BodyTypeDescriptor 接口 + Registry 注册表模块
- 10 种物体全部迁移到独立描述文件（`src/models/bodyTypes/*.tsx`）
- 消费端全部改造：sceneSync、hitTest、CanvasRenderer、PropertyPanel、ObjectPanel、Canvas、defaults
- 共享工具抽取：`hexToRgba` → `src/lib/utils/color.ts`，`pointInTriangle/pointInPolygon` → `src/core/geometry.ts`

**效果**：
- 新增物体 = 写 1 个描述文件 + 在 index.ts 添加 1 行 import
- 删除物体 = 删 1 个文件 + 删 1 行 import
- 各系统 switch/case 全部消除，PropertyPanel 10 个条件渲染块 → 数据驱动

**详细任务文档**：`stage-3.3-body-registry-refactor.md`

---

### 第4阶段：编辑交互优化 ✅ 已完成

**目标**：提升编辑模式下的场景搭建体验，使教师能直观地将物体放在地面上、斜面上，能旋转和缩放物体，能对齐排列多个物体。

**已完成 — 三个子任务**：

**4.1 选中手柄系统**：
- SelectionHandles 模块（手柄位置计算 + hitTest + computeResize/Rotation）
- 4 个角手柄（非等比缩放）+ 边框 hover 检测（单轴缩放）+ 左上角弧形箭头旋转柄
- SelectTool 三种拖拽模式（move/resize/rotate），通过 BatchPropertyCommand 可撤销
- 缩放基于 dragStart 快照 + 总增量，拖拽点的对角锚点固定

**4.2 表面吸附系统**：
- SnapSurface（rest 承载面 / contact 接触面）+ SnapEngine（水平面 + 斜面吸附）
- 6 种物体实现 getSnapSurfaces（block/ball/slope/wall/conveyor/bar），ground 特殊处理
- 集成到 SelectTool（移动拖拽时）和 Canvas.tsx（handleDrop 新物体时）
- 视觉反馈：目标面蓝色高亮，Alt 键禁用吸附

**4.3 对齐辅助线**：
- AlignEngine（6 种对齐：中心/顶/底 × 水平 + 中心/左/右 × 垂直）
- 蓝色虚线穿越视口，松手后消失
- 与吸附叠加：先吸附修正，再对齐微调

**Bug 修复记录**：
1. 旋转方向与鼠标不一致 → `atan2(dx,dy)` 改为 `atan2(-dx,dy)`
2. 缩放灵敏度过高 → 改为基于原始快照计算，消除累积误差
3. 缩放从中心等比 → 改为角手柄独立双轴+对角锚点固定
4. 旋转柄样式 → 从顶部圆形改为左上角弧形双向箭头 + 自定义 SVG 旋转光标

**验收标准**：
✅ 选中手柄可缩放/旋转物体（4角+边框hover+弧形旋转柄）
✅ 物体能吸附到地面、斜面（含旋转对齐）
✅ 拖拽时出现对齐辅助线
✅ 所有操作可 Ctrl+Z 撤销
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**详细任务文档**：`stage-4-interaction-optimization.md`

---

### 第5阶段：约束系统（关系/Joint） ✅ 已完成

**目标**：实现 JointTool + 绳/杆/弹簧/滑轮绳四种约束，物体之间可建立物理连接。

**执行策略**：先搭框架，用"绳"跑通全链路，再逐个追加约束类型。

**子阶段串行链路**：
```
5.1 基础设施（框架）→ 5.2 绳（跑通全链路）→ 5.3 杆 → 5.4 弹簧 → 5.5 滑轮绳
```

| 子阶段 | 内容 | 预计 |
|--------|------|------|
| 5.1 基础设施 | 类型定义 + Store + Command + Registry框架 + JointTool骨架 + 渲染入口 + 面板框架 | 1天 |
| 5.2 绳 rope | 第一个 descriptor，RopeJoint，跑通创建→渲染→仿真→选中→编辑→删除→撤销 | 1天 |
| 5.3 杆 rod | DistanceJoint(freq=0)，粗直线渲染，复用全部框架 | 半天 |
| 5.4 弹簧 spring | DistanceJoint(freq>0)，锯齿线渲染算法，属性面板"恢复自然长度"按钮 | 半天 |
| 5.5 滑轮绳 pulley | PulleyJoint，JointTool 三步交互，A→滑轮顶→B 折线渲染 | 1天 |

**涉及文件范围**：
- `src/models/types.ts` - SceneJoint 扩展
- `src/models/jointTypes/` - Joint Registry + 四种 Descriptor（新建目录）
- `src/engine/` - PhysicsBridge Joint 支持 + sceneSync 扩展
- `src/core/tools/` - JointTool 实现
- `src/core/commands/` - AddJoint / RemoveJoint / ChangeJointProperty Command
- `src/renderer/` - 约束渲染（直线、粗线、锯齿线、折线）
- `src/store/` - sceneStore Joint CRUD + toolStore 扩展
- `src/components/` - Toolbar + PropertyPanel + Canvas 集成

**验收标准**：
✅ 用 JointTool 在两个物体间创建绳/杆/弹簧
✅ 绳约束：物块挂在锚点下方，仿真时像单摆摆动
✅ 杆约束：两物体保持固定距离
✅ 弹簧约束：仿真时弹簧振动，渲染为锯齿线
✅ 滑轮绳约束：Atwood 机效果，重物下沉轻物上升
✅ 可选中约束，属性面板显示并可编辑参数
✅ 删除约束（选中后 Delete 键）

**本阶段产出**：
四种约束可用（含单滑轮 Atwood 机）。完整滑轮组（多轮多绳段）放在 MVP 后。

**详细任务文档**：`stage-5-constraint-system.md`

---

### 第6阶段：力的体系与受力分析视角 ✅ 已完成

**目标**：实现力的收集、显示、分解，完成受力分析视角，选中物体可看到完整受力图。

**主要任务**：
1. 实现 ForceTool
   - 点击物体 → 拖拽方向和长度 → 创建用户外力
   - AddForceCommand
2. 实现力的收集系统
   - 从 Planck.js 提取系统自动力：
     - 重力：`mass × world.gravity`
     - 接触力（支持力+摩擦力）：`post-solve` 事件的 ContactImpulse / dt
     - 约束力（张力、弹簧力）：`Joint.getReactionForce(inv_dt)`
   - 用户主动力记录（外力大小/方向）
   - 数值滤波处理（接触力噪声）
3. 实现力的可视化渲染
   - 力箭头渲染（方向 + 长度与大小成比例）
   - 力标签（力名称 + 数值 + 单位）
   - 合力显示
   - 力箭头防重合策略（偏移处理）
   - 力标签防重叠（局部偏移）
4. 实现力的正交分解
   - 选中一个力 → "分解"按钮 → 显示两个分量
   - 分解方向默认为水平/竖直，可切换为沿斜面/垂直斜面
5. 实现受力分析视角
   - 视角切换 UI（工具栏按钮）
   - 受力视角下：所有物体显示力箭头
   - 选中物体显示详细力列表（面板中）
6. 扩展属性面板
   - 力列表显示（勾选显隐、可编辑主动力、分解操作）
   - SceneForce 数据管理

**涉及文件范围**：
- `src/core/tools/` - ForceTool 实现
- `src/engine/` - 力的收集与计算
- `src/renderer/` - 力箭头、标签、分解线渲染
- `src/models/` - SceneForce 类型
- `src/store/` - 视角状态管理
- `src/components/panels/` - 力列表面板

**验收标准**：
✅ 用 ForceTool 给物体施加外力，仿真时物体受力运动
✅ 切换到受力分析视角，物体上显示力箭头和标签
✅ 选中物体，面板显示完整力列表（重力、支持力、摩擦力、外力等）
✅ 力的数值正确（如静止在水平面上的物块，支持力=重力）
✅ 可对力进行正交分解，显示分量箭头
✅ 力箭头不重叠，标签可读

**本阶段产出**：
完整的受力分析能力。后续阶段添加运动分析视角。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第7阶段：物理分析系统（框选 + 运动/能量/动量分析） ⏱️ 5-6天

**目标**：实现框选多选、分析组/子系统、底部图表面板，完成运动/能量/动量三个分析视角，支持单体和系统分析。

**执行策略**：先做框选和数据基础设施，再逐个视角实现。

**子阶段串行链路**：
```
7.0 框选与多选 → 7.1 数据记录框架 → 7.2 图表面板+全部图表 → 7.3 分析组+碰撞检测
```

| 子阶段 | 内容 | 状态 |
|--------|------|------|
| 7.0 框选与多选 | selectionStore 多选扩展 + SelectTool 框选交互 + Shift+点击追加 | ✅ |
| 7.1 数据记录框架 | AnalysisRecorder + analysisStore + PhysicsBridge 集成 | ✅ |
| 7.2 图表面板+全部图表 | 底部面板 + 数据源选择器 + v-t/a-t/x-t/E-t/p-t 时序图 + E柱状图 + Q摩擦热 | ✅ |
| 7.3 分析组+碰撞检测 | 多选→创建分析组 + 系统级汇总 + p柱状图 + 碰撞事件标记 | ✅ |

**核心设计决策**：
- 数据源选择器：单体和子系统平级，用户自由勾选组合
- 图表位置：底部可折叠面板（Chart.js）
- 视角：checkbox 可叠加，放在画布底部地面以下区域
- 画布矢量：只保留受力分析力箭头，运动/能量/动量不画箭头（图表已充分表达）
- 图表数据：默认显示标量（|v|、|a|、|p|）

**验收标准**：
✅ 框选多个物体 + Shift+点击追加/移除
✅ 勾选运动分析，底部面板展开，v-t/a-t/x-t 图表实时更新
✅ 自由落体 v-t 直线、斜面 x-t 抛物线、单摆 v-t 正弦波
✅ 能量柱状图显示 Ek/Ep 此消彼长，无摩擦时 E总 守恒
✅ 碰撞场景 p-t 图：单体动量突变，系统总动量水平线
✅ 创建分析组后，图表可显示系统汇总数据

**详细设计文档**：`stage-7-analysis-system-design.md`

---

### 第8阶段：打磨与交付 ⏱️ 7-9天

**目标**：修复已知 Bug、完善物体库与拖放体验、统一视觉风格、优化交互细节，产出可交付给教师使用的版本。

**执行策略**：先修 Bug 打稳基础，再做体验增强和视觉统一，最后性能与边界收尾。

**子阶段串行链路**：
```
8.0 Bug修复 → 8.1 交互增强 → 8.2 物体库重构 → 8.3 渲染优化 → 8.4 UX打磨 → 8.5 控制区重排与时间回溯 → 8.6 收尾交付（合并原8.5/8.6/8.7剩余）
```

| 子阶段 | 内容 | 预计 | 状态 |
|--------|------|------|------|
| 8.0 Bug修复 | 地面穿透、吸附回正、球体手柄、Delete键冲突 | 1天 | ✅ |
| 8.1 物体交互增强 | 斜面拖拽自然翻转、地面联动物体上移 | 1天 | ✅ |
| 8.2 物体库重构与拖放 | 卡片面板、默认大小、拖放预览 | 1天 | ✅ |
| 8.3 物体渲染优化 | 半球面、滑轮、锚点、滑轮座、传送带样式 | 1天 | ✅ |
| 8.4 UX提示与交互打磨 | 连接件引导、快捷键、光标、Tooltip | 1天 | ✅ |
| 8.5 控制区重排与时间回溯 | 去顶部选择/约束；播放控制+时间轨道回溯 | 1天 | ✅ |
| 8.6 收尾交付（合并原8.5/8.6/8.7剩余） | 视觉统一剩余、响应式性能、边界处理与最终验收（含环境参数与速度可视化教学增强） | 1-2天 | ✅ |

**详细任务清单、涉及文件、验收标准**见：`stage-8-polish-delivery.md`

**验收标准**：
✅ 在 1920×1080 投影仪上界面美观、可读
✅ 在 1280×720 上布局不破碎
✅ 常用操作流程顺畅，无明显卡顿
✅ 完整流程（加载预设 → 修改参数 → 仿真 → 查看受力分析）可走通
✅ 教师可独立完成基本教学演示操作

---

## 🎯 当前焦点

**第8阶段：打磨与交付**

执行链路：`8.0 Bug修复 → 8.1 交互增强 → 8.2 物体库重构 → 8.3 渲染优化 → 8.4 UX提示 → 8.5 控制区重排与时间回溯 → 8.6 收尾交付`

- [x] 8.0 Bug 修复（地面穿透、吸附旋转、球体手柄、Delete键冲突）
- [x] 8.1 物体交互增强（斜面拖拽自然翻转、地面联动物体上移）
- [x] 8.2 物体库重构与拖放（卡片面板、默认大小、拖放预览）
- [x] 8.3 物体渲染优化（半球面、滑轮、锚点、滑轮座、传送带）
- [x] 8.4 UX 提示与交互打磨（连接件引导、快捷键、光标、Tooltip）
- [x] 8.5 控制区重排与时间回溯（独立文档：stage-8.5-control-replay.md）
- [x] 8.6 收尾交付（独立文档：stage-8.6-environment-and-velocity.md，已完成）
- [x] 8.6.1 环境配置面板（独立文档：stage-8.6.1-environment-panel.md）
- [x] 8.6.2 初速度双表示与可视化（独立文档：stage-8.6.2-velocity-ux.md）
- [x] 8.6.3 视觉统一收敛（独立文档：stage-8.6.3-visual-unification.md，含右栏 Tab 顶栏迁移与 Tooltip 防溢出续作）
- [x] 8.6.4 响应式与性能（独立文档：stage-8.6.4-responsive-performance.md）
- [x] 8.6.5 边界与异常处理（独立文档：stage-8.6.5-boundary-exception.md，P0+P1 与空态视觉迭代已完成）

---

## ✅ 阶段检查点

| 阶段 | 检查项 | 状态 |
|------|--------|------|
| 第0阶段 | `pnpm dev` 正常启动 + 设计系统生效 | ✅ |
| 第1阶段 | 物块自由落体 + 碰撞弹起 + 编辑/仿真切换 | ✅ |
| 第2阶段 | 拖拽放置物体 + 选中编辑属性 + Undo/Redo | ✅ |
| 第3阶段 | 7种基础物体可创建 + 斜面滑动可用 | ✅ |
| 第3.2阶段 | +4种扩展物体（滑轮座/传送带/半球面/V形槽），共11种 | ✅ |
| 第3.3阶段 | Body Type Registry 重构，消除 switch 耦合 | ✅ |
| 第4阶段 | 选中手柄旋转/缩放 + 表面吸附 + 对齐辅助线 | ✅ |
| 第4.1阶段 | 交互能力 Descriptor 化重构 + Ground 正式注册 | ✅ |
| 第5阶段 | 绳/杆/弹簧/滑轮绳约束可用 + 单摆 + Atwood机 | ✅ |
| 第6阶段 | 受力分析视角完整 + 力分解可用 | ✅ |
| 第7阶段 | 框选多选 + 运动/能量/动量分析 + 图表面板 + 分析组 | ✅ |
| 第8阶段 | 视觉打磨完成 + 教师可独立使用 | ✅ |

---

## 🚫 暂时不考虑

- 电磁域 / 光学 / 波动模块
- 天体运动（P-09）：暂不纳入 planck_design 任务
- 预设场景系统：先完成编辑器核心，预设独立于编辑器后续单独规划
- 预设导入导出
- 3D 功能
- 用户认证与权限
- 部署与 CI/CD
- 国际化
- 协同编辑

---

## 📝 开发笔记

### 技术栈确认
- 物理引擎：Planck.js v1.3.0（Box2D JS/TS 移植，npm 最新版）
- UI：React 19 + TypeScript
- 渲染：Canvas 2D 原生 API
- 状态管理：Zustand
- 构建：Vite + pnpm
- 设计系统：EduMind 设计系统（已在 design_guid/ 准备就绪）

### 设计文档参考
- 整体架构设计：`.tasks/active/planck_design/physics-editor-design.md`
- 设计系统指南：`design_guid/DESIGN_SYSTEM_GUIDE.md`
- 需求文档：`docs/需求文档md/`

### 每阶段通用交付要求
- 每个阶段执行完成后，必须同步更新 `README.md`，反映当前已实现的功能、项目结构变化和使用说明

### 历史教训（来自设计文档）
1. 预设不应是封闭孤岛 — 用统一物理引擎
2. 不要枚举条件组合 — 用参数切换
3. 力方向要用向量点乘验证垂直性
4. 力箭头防重合需要多层策略
5. 力标签用局部防重叠
6. UI 控件要与画布比例协调
7. 依赖要实际验证
