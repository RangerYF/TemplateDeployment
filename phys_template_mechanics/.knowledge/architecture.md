# 技术架构与代码规范

## 核心架构模式

### 1. Registry 模式
**原则**：新增物体/约束/力 = 1 个描述文件 + 1 行 import，删除 = 删 1 个文件。

**实现**：`src/models/bodyTypes/registry.ts` 维护 `Map<BodyType, BodyTypeDescriptor>`。

**约束系统已实现**：`src/models/jointTypes/` 目录，`JointTypeDescriptor` + `jointRegistry`，复用同一 Registry 模式。当场景 type 与引擎 Joint 类型不一致时（如 rod→DistanceJoint），通过 `sceneType` 字段桥接。

**力系统已实现**：`src/models/forceTypes/` 目录，`ForceTypeDescriptor` + `forceRegistry`，复用同一 Registry 模式。与约束系统的区别：SceneForce 只存用户外力，系统力由 ForceCollector 每帧计算不持久化。

### 2. Descriptor 模式
每种物体类型由一个 `BodyTypeDescriptor` 完整描述，包含物理、渲染、交互、属性的全部声明。

**设计动机**：将原本分散在 6 个文件 12+ 处 switch/case 中的物体逻辑，收敛到单一描述文件中，实现"一个物体一个文件"的内聚。

**接口定义**：见 `src/models/bodyTypes/descriptor.ts`。具体需要实现的接口清单见 `playbooks/add-body-type.md`。

### 3. InteractionCapability（交互能力声明式配置）
**设计动机**：消除 SelectTool 中的物体类型硬编码判断（如 `if (body.type === 'ground')`），改为声明式配置。

**接口定义**：见 `src/models/bodyTypes/descriptor.ts` 中的 `InteractionCapability` 类型。

**使用方式**：通过 `getInteraction(body)` 读取，合并 descriptor 声明与默认值。SelectTool 和 SelectionHandles 统一从此配置读取能力。

### 4. Tool/Command 模式
- **Tool 接口**：`src/core/tools/Tool.ts`，实现 onMouseDown/onMouseMove/onMouseUp
- **Command 模式**：可撤销操作，undo/redo 栈
- **pushExecuted()**：用于拖拽中已实时应用到 sceneStore 的操作，仅记录 undo 栈不重复执行
- **BatchPropertyCommand**：多属性同时修改（缩放=width+height+x+y 组合）
- **BatchMoveCommand**：多物体同时移动，一次 Ctrl+Z 全部撤销

### 4.1 多选架构
- **selectionStore**：`selected: SelectableObject[]`（空数组=无选中），`select()` 保留单选语义（清除+设置）
- **便捷 selector**：`selectedBodyIds(state)` / `selectedJointIds(state)` / `primarySelected(state)` 供消费端按需提取
- **CanvasRenderer**：`RenderOptions.selectedIds: string[]`（数组），用 `includes()` 判定高亮
- **框选**：SelectTool 在空白拖拽时进入 marquee 模式，AABB 交集判定，拖拽中实时 `setSelection()`
- **多选拖拽 snap**：对每个选中物体检测与非选中物体的 snap，取最近结果，偏移应用到整组

### 4.2 地面联动
- **触发**：拖拽 ground（vertical-only）或 PropertyPanel 编辑 ground Y
- **检测**：`getGroundContactBodyIds(groundY, allBodies)` — 递归检测直接和间接接触物体
- **递归逻辑**：先找 contact surface 与 ground rest surface 匹配的物体，再找在这些物体 rest surface 上的物体
- **动态纳入**：拖拽过程中每帧重检，地面碰到新物体时自动纳入联动集合
- **撤销**：ground + 所有联动物体用 `BatchMoveCommand` 打包，Ctrl+Z 一次性撤销
- **接触检测**：水平面检查 Y 距离 + X 重叠（>10m 宽面如 ground 跳过 X 检查），斜面检查法线距离 + 投影范围
- **文件**：`src/core/snap/SnapEngine.ts`（检测）、`SelectTool.ts`（拖拽）、`PropertyPanel.tsx`（面板）

### 4.3 Resize 翻转（flipped）
- **机制**：`computeResize` 中宽度越过零点时 toggle `SceneBody.flipped`，内部字段不暴露 UI
- **渲染（编辑）**：CanvasRenderer 对 flipped body 加 `ctx.scale(-1, 1)`
- **渲染（仿真）**：`ctx.scale(-1, 1)` **仅在 renderSim 自定义渲染路径**中应用。通用形状渲染（polygon/chain）的顶点已被 `mirrorShapeX` 镜像，不需要额外 ctx.scale
- **物理**：`sceneSync.mirrorShapeX` 镜像 polygon/chain 顶点 x 坐标 + reverse 保持 CCW
- **snap**：翻转时交换 rest surface 顶点顺序保持法线朝外
- **hitTest**：翻转时对输入 lx 取反（因为渲染已 scale(-1,1)）
- **userData.flipped**：传入仿真 BodyState，供 renderSim 的 `ctx.scale(-1,1)` 使用
- **文件**：`SelectionHandles.ts`（检测）、`CanvasRenderer.ts`（渲染）、`sceneSync.ts`（物理）、`slope.tsx`（snap/hitTest）

### 4.4 统一变换系统（Resize Architecture）
- **设计动机**：将 `computeResize` 中的 11 分支 switch/case（`getBodyDimensions`/`setBodyDimensions`/`circleR` 路径/hemisphere hack）下放到各 body descriptor
- **接口**：`BodyTypeDescriptor` 新增 `resizeMode`（'independent'|'uniform'|'radius'）、`getLocalBBox(body) → LocalBBox`、`applyResize(body, newHalfW, newHalfH) → Partial<SceneBody>`
- **LocalBBox**：`{ centerOffsetX, centerOffsetY, halfW, halfH }`，物理单位（米），centerOffset 是 body origin 到 bbox 中心的屏幕坐标偏移（Y-down）
- **位置计算**：anchor 公式保持对角不动 `localShift = anchor_old - anchor_new`，使用 rawHalfW（有符号、未钳制）保证翻转穿越时鼠标平滑跟踪
- **getSelectionBounds**：统一返回 `{ halfW, halfH }`，消除了 `corners` 分支；中心偏移由 `getSelectionBBox` 从 `getLocalBBox` 获取
- **文件**：`descriptor.ts`（接口）、各 `bodyTypes/*.tsx`（实现）、`SelectionHandles.ts`（消费）

### 4.5 编辑态渲染分层（本体层 vs 交互 overlay）
- **设计动机**：教材式黑色线稿与选中/hover 蓝色反馈属于两种不同语义，不能通过共享 `ctx.strokeStyle` 混在同一条绘制链中，否则自定义物体会互相污染
- **接口**：`BodyTypeDescriptor` 新增可选 `renderSelectionOutline(ctx, body, scale)`；`renderEdit()` 只负责绘制本体
- **CanvasRenderer 分层**：
  - 第一层：`renderEdit()` 绘制黑色本体
  - 第二层：`renderSelectionOutline()` 或默认 outline 回放，绘制蓝色 hover / selected overlay
  - 第三层：handles / rotate icon / snap / align 等交互反馈
- **适用对象**：`wall / half-sphere / anchor / pulley-mount / conveyor / ground` 这类有自定义局部装饰的物体，优先实现独立 selection outline，避免 overlay 复用本体颜色
- **扩展规则**：新增 body type 时，如果本体绘制内含固定颜色、hatching 或装饰线条，必须评估是否需要 `renderSelectionOutline`；不要依赖外层传入的 `strokeStyle` 改变本体颜色
- **文件**：`src/models/bodyTypes/descriptor.ts`、`src/renderer/CanvasRenderer.ts`、相关 `bodyTypes/*.tsx`

### 4.6 连接件创建入口状态机（拖拽 + 点击激活）
- **设计动机**：连接件创建不应只依赖 drop 后触发；用户在拖拽进入画布（加号阶段）或点击卡片后进入画布时，就应进入同一套引导流程
- **状态分层**：
  - `currentDragJointType`：连接件拖拽进行中（用于 dragEnter/dragOver 即时提示）
  - `pendingJointType`：连接件点击后待激活（鼠标首次进入画布时消费）
  - `JointTool` 内部状态：`IDLE → PICKING_PULLEY/PICKING_B`（实际创建步骤）
- **消费链路**：
  - `ObjectPanel` 写入拖拽态/待激活态
  - `Canvas` 在 `dragEnter/dragOver` 渲染引导提示，在 `mouseMove` 消费点击待激活态并切换到 `JointTool`
  - `JointTool` 统一负责步骤文案、错误提示和 `Esc` 退出
- **文件**：`src/components/panels/dragState.ts`、`src/components/panels/ObjectPanel.tsx`、`src/components/Canvas.tsx`、`src/core/tools/JointTool.ts`

### 5. 吸附面系统
- **SnapSurface**：`rest`（承载面，如地面顶部）和 `contact`（接触面，如方块底部）
- `getSnapSurfaces` 返回**世界坐标**面
- `createSnapSurface(type, localStart, localEnd, bodyX, bodyY, angle, normalDir?)` 自动从局部坐标转换到世界坐标
- `SnapSurface` 可携带 `localStart/localEnd/localNormal` 局部几何元数据；SnapEngine 可先根据局部切线/法线求目标姿态，再反推 body center，适用于锚点/滑轮座这类“固定面驱动”的吸附
- 当吸附语义由某条“固定面”主导时，`renderEdit` 与 `getSnapSurfaces` 必须共享同一套局部几何定义，否则会出现视觉固定面与实际吸附面错位
- SnapEngine 处理水平面吸附和斜面吸附（法线投影+旋转对齐）

### 6. ForceCollector 数据管道
**职责**：仿真时从 Planck.js 引擎收集所有力数据，输出 `ForceData[]` 供渲染消费。

**数据流**：`applyExternalForces → beginFrame → world.step (触发 post-solve) → collect → ForceData[]`

**力来源**：
- 重力：`body.getMass() × world.gravity`（直接计算）
- 接触力：`post-solve` 事件的 `ContactImpulse / dt`，拆分为法向（支持力）和切向（摩擦力）
- 约束力：`Joint.getReactionForce(1/dt)`（张力/弹簧力）；滑轮类型特殊处理——magnitude 取 reaction，方向沿绳段（锚点→groundAnchor）
- 用户外力：从 `scene.forces` 读取

**关键设计**：
- 接触力使用 EMA 滤波（α=0.3）消除数值噪声
- 接触断开时力立即清零不做渐出
- 反向查找表 `_bodyIdLookup: Map<Body, string>` 由 PhysicsBridge 维护注入
- `ForceData` 定义在 `engine/types.ts`，与 Scene 层的 `SceneForce`（仅用户外力）是不同层级

**文件**：`src/engine/ForceCollector.ts`，集成入口在 `PhysicsBridge`

**编辑模式力探测**：`PhysicsBridge.probeForces(scene, steps=5)` 实现非仿真状态下的力计算。
- 流程：保存全部 body 状态(position/angle/velocity) → step N 次 → collect → 恢复状态 → resetEma
- 使用独立的 save/restore 逻辑，不干扰 saveSnapshot/restoreSnapshot（后者用于仿真入口/退出）
- Canvas 在编辑模式通过 scene 引用比较避免冗余 probe（`lastProbedSceneRef`）

### 7. ForceDisplayStore
**职责**：统一管理力的显隐状态，供 Canvas 渲染和 PropertyPanel 面板共用。

**状态**：
- `availableForces: ForceData[]` — Canvas 计算/收集后写入，Panel 读取展示
- `hiddenForceKeys: Set<string>` — 被隐藏的力标识集合
- `_manualOverrides: Set<string>` — 用户手动操作过的 key，不被支撑面自动隐藏覆盖
- `decomposedForceKeys: Set<string>` — 正在正交分解的力 key 集合

**key 格式**：`${bodyId}:${forceType}`（系统力）或 `${bodyId}:external:${sourceId}`（外力）

**数据流**：Canvas probe/collect → computeResultants → setAvailableForces(base+resultants, supportIds) → Panel 展示 → toggleForce → Canvas 渲染过滤

**支撑面默认隐藏**：`setAvailableForces` 接收 `supportIds`（category='support' 的物体），自动将其力加入 hiddenForceKeys（除非在 `_manualOverrides` 中）。Canvas 渲染过滤也检查 supportIds + manualOverrides 双重条件。

**合力处理**：Canvas 从全部基础力计算合力（`computeResultants`），合力作为 `forceType: 'resultant'` 的 ForceData 追加到 availableForces。ForceRenderer 检测输入中已有 resultant 时跳过内部合力计算。合力显隐独立于其组成力。

**仿真模式位置同步**：sim 渲染时需将 BodyState 实时位置合并到 sceneBodies，否则力箭头不跟随物体运动。

**文件**：`src/store/forceDisplayStore.ts`

### 8. 力选中独立于物体选中
**设计动机**：用户反馈"物体的选中和力的选中应该是2个东西"——在受力分析面板操作力时不应影响物体选中状态。

**实现**：`selectionStore` 中 `selected`(body/joint) 与 `selectedForceId`/`hoveredForceId` 独立管理。`SelectableObject` 不含 `'force'` 类型。画布和面板均从 `selectedForceId` 读取力高亮状态。

**文件**：`src/store/selectionStore.ts`

### 9. AnalysisRecorder 数据管道
**职责**：仿真时每帧记录物体物理量（位置、速度、加速度、动量、能量、位移），存入环形缓冲区供图表消费。

**数据流**：`Canvas 仿真循环 → physicsBridge.step(dt) → physicsBridge.getBodyStates() → AnalysisRecorder.recordFrame() → analysisStore.pushFrame()`

**关键设计**：
- 纯计算类（AnalysisRecorder），无副作用，不直接写 store
- 降采样：仿真 60fps，记录 30fps（每 2 帧记 1 次）
- 加速度通过速度差分计算：`(v_current - v_prev) / dt`
- 重力势能参考面：地面物体（type='ground'）的 Y 坐标
- 弹性势能：frequencyHz 需换算为 k（`k = m_eff × (2πf)²`），见 pitfalls.md
- 环形缓冲区上限 1800 帧（30fps × 60s），超限丢弃最早帧
- 仿真重新开始时清空历史，停止后保留供图表查看

**浮点噪声消除**：速度 < 1e-6 m/s 归零，加速度 < 1e-4 m/s² 归零（消除物理引擎对静止物体的数值抖动）

**文件**：`src/engine/AnalysisRecorder.ts`（记录器）、`src/store/analysisStore.ts`（状态）

### 9.1 分析组（AnalysisGroup）
**职责**：将多个物体组合为"系统"，计算系统级物理量（质心、总动量、总能量）。

**数据流**：`多选物体 → MultiSelectPanel "创建分析组" → analysisStore.addGroup() → AnalysisRecorder.recordFrame(groups) → FrameRecord.groups[groupId]`

**GroupFrameData**：质心位置/速度、系统总动量(Σmv)、系统总动能(Σ½mv²)、系统总势能、总机械能

**数据源 ID 约定**：单体用 `bodyId`，分析组用 `group:{groupId}` 前缀，图表组件据此从 `FrameRecord.bodies` 或 `FrameRecord.groups` 读取数据

**创建入口**：右侧面板 MultiSelectPanel（多选 ≥2 个非 static 物体时显示）
**重命名**：DataSourceSelector 中双击组名 inline 编辑
**删除联动**：`RemoveBodyCommand.execute()` 调用 `analysisStore.removeBodyFromGroups()`，成员清空时自动删除组

**文件**：`src/store/analysisStore.ts`（CRUD + 状态）

### 9.2 碰撞事件检测
**职责**：检测仿真中的碰撞事件，在图表上标注碰撞时刻，为 p 柱状图提供碰前/碰后快照。

**检测逻辑**：ForceCollector 在 `collectContactForces` 中比较当前帧活跃接触对与上一帧（`_prevActiveContacts`），新出现的接触且法向冲量 > 阈值(0.5 N·s) = 碰撞事件

**数据存储**：`analysisStore.collisionEvents[]`（时刻+物体对+冲量）、`collisionSnapshot`（碰撞前一帧的 bodies 数据）

**图表标注**：p-t 图表用 `chartjs-plugin-annotation` 画红色竖虚线；MomentumBarChart 显示碰前/碰后对比柱 + Σp 参考线

**文件**：`src/engine/ForceCollector.ts`（检测）、`src/store/analysisStore.ts`（存储）

### 10. 图表面板架构
**职责**：底部可折叠面板，展示仿真数据的时序图表和柱状图。

**组件结构**：
```
EditorLayout → Canvas + AnalysisPanel（纵向分割）
AnalysisPanel → PanelHeader（标签页多选） + DataSourceSelector + 图表组件
```

**图表组件**：
- `TimeSeriesChart`：通用时序折线图（v-t/a-t/x-t/E-t/p-t），Chart.js Line，支持分析组数据源 + 碰撞竖线标注
- `EnergyBarChart`：能量柱状图（当前时刻 Ek/Ep重/Ep弹/Q），Chart.js Bar，支持分析组
- `MomentumBarChart`：动量柱状图，碰撞后自动切换碰前/碰后对比模式 + Σp 参考线
- 能量 E-t 特殊处理：每个数据源 × 5 条线（Ek/Ep重/Ep弹/E总/Q），Q = E总(初始) - E总(当前)

**标签页**：activeTabs（string[]，最多 2 个并排），toggleTab 逻辑：已选中→取消（至少保留 1 个），未选中→添加（超 2 个替换最早的）

**视口补偿**：面板折叠时 `pan(0, panelHeight)` 补偿 offset.y，展开时撤销，保持地面位置不变

**文件**：`src/components/panels/AnalysisPanel.tsx`、`src/components/panels/DataSourceSelector.tsx`、`src/components/charts/`

### 11. 播放控制与时间回溯解耦链路（8.5）
**设计动机**：播放控制 UI（Toolbar）与仿真主循环（Canvas）职责不同，若直接在 Toolbar 操作引擎会导致状态耦合、回溯分支难维护。

**状态拆分**：
- `Canvas` 负责真状态：快照采集、seek 回放、继续播放时未来分支裁剪、分析时间同步。
- `playbackControlStore` 负责桥接：暴露 handlers（play/pause/stop/reset/seek）与 timeline 状态（current/max/snapshotCount）。
- `Toolbar` 负责展示与输入：按钮、时间轴、刻度、吸附、跳转输入。

**关键接口**：
- `Canvas -> playbackControlStore.setHandlers(...)`
- `Canvas -> playbackControlStore.setTimeline(...)`
- `Toolbar -> handlers.seek(t)`（拖动/跳转）
- `PhysicsBridge.restoreFromBodyStates(states)`（按快照恢复）
- `analysisStore.seekToTime(t)`（非破坏性回放）与 `trimToTime(t)`（继续播放时裁剪未来）

**扩展规则**：
- 回放拖动必须非破坏；仅“从历史点继续播放”允许裁剪未来分支。
- UI 层不得直接持有或改写快照数组，快照生命周期统一在 Canvas 内维护。
- 新增播放控件时优先扩展 `playbackControlStore` 协议，不绕过桥接层直接互调。

### 12. 环境参数实时同步链路（8.6.1）
**设计动机**：环境参数（当前仅重力）是场景真值，不应挂在编辑器临时态；参数修改后需要即时作用到引擎，避免 UI 与仿真状态不一致。

**状态归属**：
- 场景真值：`scene.settings.gravity`（`sceneStore`）
- 引擎真值：`PhysicsBridge.world.gravity`

**关键接口**：
- `sceneStore.setGravity(gravity)`：统一写入场景重力配置
- `PhysicsBridge.setGravity(gravity)`：写入 Planck World 重力
- `Canvas` 监听 `scene.settings.gravity` 变化并调用 `physicsBridge.setGravity(...)`

**扩展规则**：
- 新增环境参数优先进入 `scene.settings`，不要放在 `editorStore` 的临时状态。
- UI 只改 scene store，桥接层负责把配置同步到引擎。
- 需要“下一帧生效”时优先增加桥接 setter，避免重建 world 带来的状态抖动。

### 13. 初始运动量链路（8.6.2）
**设计动机**：教学场景需要同时表达初速度与初始加速度，且二者应共享同一套可视化与数据更新链路，避免重复渲染系统和状态分叉。

**状态归属**：
- `SceneBody.initialVelocity: {x,y}` — 初速度真值
- `SceneBody.initialAcceleration: {x,y}` — 初始加速度真值

**关键接口与链路**：
- 属性面板：极坐标（大小+角度）与分量（x/y）双向换算，统一回写到 `sceneStore.updateBody(...)`
- 引擎施力：`ForceCollector.applyExternalForces()` 在每帧将初始加速度转为等效外力 `F = m * a` 并 `applyForceToCenter`
- 受力展示：`ForceCollector.collectExternalForces()` 同步产出 `label: 'a0'` 的外力项，保证面板/箭头可见
- 画布渲染：`CanvasRenderer.renderVelocityMarker(...)` 复用单一箭头层，标签按可用数据行显示 `v`/`a`

**扩展规则**：
- 新增“初始运动参数”优先挂在 `SceneBody`，不要拆到 editor 临时状态。
- 若后续增加初始角加速度等参数，优先复用当前“向量真值 + 面板双表示 + 单箭头多行标签”模式。
- 仿真模式若需读取 scene 级初始参数，渲染入口需保证可拿到 `sceneBodies` 上下文。

### 14. 视觉统一 Token 分层（8.6.3）
**设计动机**：8.6.3 前，面板、工具栏、约束渲染、交互反馈存在多处硬编码色值与线宽，导致视觉语义不一致且维护成本高。

**分层方案**（`src/styles/tokens.ts`）：
- `EDITOR_CHROME`：编辑器外壳参数（顶栏高度、面板内边距、圆形控件尺寸/边框/阴影）
- `FEEDBACK_VISUAL`：交互反馈参数（selected/hover 颜色、填充、虚线模式、线宽等级）
- `CONSTRAINT_VISUAL`：约束渲染参数（rope/rod/spring/pulley 颜色、线宽、rod 填充、锚点半径）

**消费链路**：
- `Toolbar` 与 `Canvas` 左下控制按钮统一读取 `EDITOR_CHROME`
- `CanvasRenderer`、`ground`、`SelectTool` 统一读取 `FEEDBACK_VISUAL`
- `jointTypes/*`（rope/rod/spring/pulley）统一读取 `CONSTRAINT_VISUAL`

**扩展规则**：
- 新增交互反馈样式，优先扩展 `FEEDBACK_VISUAL`，避免在 renderer/tool 中写硬编码。
- 新增约束类型时，默认复用 `CONSTRAINT_VISUAL`，只有确有教材语义差异时才新增局部常量。
- 顶栏或面板控件改版时，优先改 `EDITOR_CHROME`，保持 Toolbar 与画布浮层控件一致。

### 15. 响应式与仿真渲染性能收敛（8.6.4）
**设计动机**：`1280×720` 下顶栏与双侧栏固定宽度会挤压中心画布；仿真帧内存在重复状态读取与对象构造，20+ 物体场景下容易放大卡顿。

**核心模式**：
- 布局弹性宽度：左右面板统一使用 `clamp(...)` 控制上下界，保证窄屏优先保住中心交互区。
- 位姿覆盖渲染：仿真态不再克隆 `sceneBodies`，改为在力渲染链路注入 `bodyPoseOverrides`（`id -> position/angle`）覆盖实时位姿。
- 帧内状态复用：`Canvas` 仿真循环只取一次 `bodyStates`，并复用给 `collectForces` 的重力收集路径，避免同帧重复 `getBodyStates()`。
- 派生集合缓存：`autoHiddenForceBodyIds` 按 scene 引用缓存，减少每帧重复 `Set` 构建。

**关键接口**：
- `PhysicsBridge.collectForces(scene, dt, bodyStates?)`
- `ForceCollector.collect(scene, bridge, dt, bodyStates?)`
- `renderForces(..., { bodyPoseOverrides })`

**扩展规则**：
- 仿真态所有“依赖 SceneBody 几何但需要实时位置”的渲染模块，优先走“静态几何 + 位姿覆盖”模式，不要每帧克隆场景对象。
- 同一仿真帧内若多个模块依赖刚体状态，统一复用一份 `bodyStates`。
- 若新增基于 scene 派生的过滤集合（如默认显隐、分组映射），优先按 scene 引用做缓存，避免渲染帧重复构造。

### 16. 边界异常收口基线（8.6.5）
**设计动机**：边界输入与仿真异常会直接导致 NaN 扩散、循环中断或“静默失败”，需要统一的安全收口链路，且不能给教学用户增加额外操作负担。

**核心模式**：
- 仿真熔断链路：`step/collect/render` 外包 `try/catch`，并对 `BodyState/ForceData` 做 finite 校验；异常时执行 `stopAtCurrent` 保留当前画面，再通过节流 toast 给一次可读提示。
- 删除级联命令：`RemoveBodyCommand` 删除 body 时同步移除关联 joints/forces；`undo` 一并恢复，避免悬挂引用残留。
- 力显示状态回收：`setAvailableForces` 以当前 active force keys 过滤 `hidden/_manualOverrides/decomposed`，防止长会话积累失效 key。

**关键接口**：
- `Canvas.notifyWithCooldown(key, variant, title, description)`
- `RemoveBodyCommand.execute()/undo()`（body + joints + forces）
- `useForceDisplayStore.setAvailableForces(...)`（active key compaction）

**扩展规则**：
- 新增仿真帧逻辑时，先考虑“异常停机 + 状态可见 + 低频提示”三件套，避免只 `console.error`。
- 任意“主对象删除”场景都应检查是否需要级联清理（并保证 undo 对称恢复）。
- 缓存类 `Set/Map` 状态如果 key 来自运行时数据，更新入口必须带失效回收逻辑。

### 17. 模板工作台路由与场景注入链路（T0）
**设计动机**：模板工作台是编辑器入口层，必须支持“默认工作台 → 模板点击进编辑器 → 按模板 ID 注入场景”的轻量闭环，且保留开发专用 `#thumbnails` 入口。

**核心模式**：
- 路由状态机：`App.parseHash()` 将 hash 映射为 `workbench | editor(templateId) | thumbnails` 三态。
- 页面切换：默认 `#workbench`；卡片点击写入 `#editor?template=<id>`；`#thumbnails` 分支保持最高优先级。
- 场景注入：进入 `editor + templateId` 时，通过 `loadTemplateById()` 获取模板；若模板含 `scene` 才调用 `sceneStore.replaceScene(scene)`。
- 数据隔离：`replaceScene` 对 `scene/settings/bodies/joints/forces` 做深拷贝，避免编辑过程污染模板目录中的原始对象引用。
- 数据策略（2026-04-01 更新）：`catalog` 默认仅承载模板 `meta`，不再手工内置场景；模板场景由后续指令系统统一生成并回填。

**关键接口**：
- `src/App.tsx`：`parseHash()`、`openTemplate()`、按 route 分支渲染
- `src/templates/loader.ts`：`loadTemplateById()`
- `src/templates/index.ts`：`templateRegistry`、`getTemplateById()`、`listTemplates()`
- `src/templates/catalog.ts`：`templateCatalog`（模块分组与模板元信息）
- `src/store/sceneStore.ts`：`replaceScene(scene: Scene)` + `cloneScene()`
- `src/components/TopBarMeta.tsx`：返回工作台入口（`#workbench`）

**扩展规则**：
- 新增入口页面优先继续扩展 hash 状态机，不引入重型路由依赖。
- 模板注入必须走 `replaceScene`（或等价深拷贝接口），禁止直接共享 catalog 中的对象引用。
- `T2/T3` 指令系统落地后，新增模板优先走“生成态 `commandProgram` -> 产物 scene JSON -> 运行态 catalog+scene 加载”链路，避免回退到手工估值场景。
- 编辑器返回工作台入口保持“纯导航语义”（不附带隐式数据写回）。

### 18. 模板指令 DSL 与 JSON 资产双轨链路（T2，C4后）
**设计动机**：模板场景需要“可复用生成逻辑 + 可部署静态资产 + 清晰运行时消费边界”三者同时满足，避免生成态与运行态职责耦合。

**核心模式**：
- 指令真值：模板定义通过 `commandProgram`（`setGravity/addBody/snapTo/addJoint/addForce`）表达教学场景关系。
- 资产落地：用 `templates:generate-json` 将指令程序批量生成到 `public/templates/scenes/*.json`，运行时优先加载 JSON。
- 运行时加载：`loadTemplateById` 只依赖 `catalog-data + scene`，不直接消费 `commandProgram`。
- 一致性校验：`commandProgram vs scene` 差异校验迁移到生成阶段执行，运行时仅保留 scene sanity gate。

**关键接口**：
- `src/templates/commands/schema.ts`：指令模型与 API 分类清单
- `src/templates/commands/executor.ts`：指令执行器（`descriptor defaults + computeSnap`）
- `src/templates/commands/validator.ts`：场景结构化 diff 校验
- `src/templates/presets/*/*.json`：生成态命令输入源（`commandProgram`）
- `src/templates/catalog-data/modules.json`：运行态模块元信息
- `src/templates/catalog-data/templates.json`：运行态模板元信息与来源标记
- `src/templates/catalog.ts`：解析 `catalog-data` 并构建分组汇总
- `src/templates/commands/examples.ts`：从 `presets` 聚合命令映射
- `scripts/generate-template-scene-json.mjs`：JSON 生成脚本
- `src/templates/loader.ts`：JSON 加载 + sanity 校验

**扩展规则**：
- 新增模板时，运行态条目先写入 `catalog-data/templates.json`，不要在 TS 文件中新增硬编码模板对象。
- 新增 `ready + sceneSource=command` 模板时，需在 `catalog-data` 提供 `sceneJsonPath`，并在 `presets` 提供 `commandProgram`。
- 新增 `ready + sceneSource=manual` 模板时，仅保证 `sceneJsonPath` 可用并标记 `sceneSource='manual'`，生成脚本不得覆盖。
- 模板命令里统一使用逻辑 `ref`（如 `bodyRef/jointRef`），不要手写运行时 ID。
- 涉及 `snapTo` 的模板，初始位姿应先落在吸附阈值附近（默认 0.3m），避免生成脚本因无可吸附目标失败。

### 19. 模板场景健全性门禁与锚点几何真值（T3.1）
**设计动机**：T3.1 验收暴露出同类系统性问题（支撑体压入地面、开仿真后约束长度突变、编辑态与仿真态受力不一致、圆周模板初值不足）。单模板修补无法防止复发，需要把“几何真值 + 健全性校验 + 生成门禁 + 加载门禁”做成统一机制。

**核心模式**：
- 约束真值统一：`rope/rod/spring/pulley` 默认参数从**世界锚点几何**推导，不再使用 body center distance。
- 时刻对齐统一：编辑态 `probeForces` 默认采样 1 步并重置 EMA，确保与仿真首帧受力一致。
- 模板放置统一：支撑体（slope/conveyor/hemisphere/groove）必须显式经过 `snapTo -> ground`，禁止手填“看起来差不多”的 y 值。
- 健全性门禁：新增 `validateSceneSanity`，覆盖地面穿透、约束长度几何一致性、pulley 参数合法性、竖直圆周最小初速度约束。
- 双门禁接入：
  - 生成门禁：`templates:generate-json` 在写盘前强制跑 sanity，失败即中断生成。
  - 运行门禁：`loader` 在 JSON 加载后执行 sanity，失败返回结构化摘要。

**关键接口**：
- `src/templates/commands/executor.ts`：`applyJointDerivedDefaults`（锚点距离推导）
- `src/engine/PhysicsBridge.ts`：`probeForces(scene, steps = 1)` + EMA reset
- `src/templates/commands/validator.ts`：`validateSceneSanity / formatSceneSanityIssues`
- `scripts/generate-template-scene-json.mjs`：生成前 sanity gate
- `src/templates/loader.ts`：`sanity_failed` 错误分支（仅 sanity）

**扩展规则**：
- 新模板若出现约束长度 patch，优先复核是否真有教学意图；否则应依赖执行器几何默认推导。
- 所有支撑体默认姿态都应通过 `snapTo` 生成，不允许直接手写“贴地坐标”。
- 若模板含“竖直圆周”语义，初速度应按 `rope: sqrt(5gR)` / `rod: sqrt(4gR)`（可加安全系数）设置。
- `templates:generate-json` 与 `loader` 的 sanity gate 不得绕过；异常模板应阻断并返回结构化摘要。

### 20. 模板程序级策略位与可读性门禁（T3.1-C1）
**设计动机**：同一套 `validateSceneSanity` 需要同时服务“普通模板”（默认严格）和“特殊模板”（确需初速度/尺寸偏离）。如果只靠全局规则，会在可读性治理与教学场景之间产生冲突。

**核心模式**：
- 程序级策略位：在 `TemplateCommandProgram` 声明
  - `allowNonZeroInitialVelocity?: boolean`
  - `allowCustomBodySize?: boolean`
- 校验默认从严：
  - 未声明 `allowNonZeroInitialVelocity` 时，动态体 `initialVelocity` 必须为零。
  - 未声明 `allowCustomBodySize` 时，`block/ball` 必须使用默认尺寸基线。
- 可读性门禁（用户决策阈值）：
  - 固定锚点高度：`anchor.position.y > 9`
  - 静止悬挂链路（anchor-dynamic 的 rope/rod）：`锚点距 d > 4`
- 生成/加载统一执行：脚本与 loader 都将策略位传入 `validateSceneSanity`，避免“生成通过、运行失败”或反向漂移。

**关键接口**：
- `src/templates/commands/schema.ts`：策略位定义
- `src/templates/commands/validator.ts`：策略位消费 + 可读性门禁
- `scripts/generate-template-scene-json.mjs`：生成阶段策略透传
- `src/templates/loader.ts`：运行时加载阶段策略透传

**扩展规则**：
- 新模板默认不应开启策略豁免；只有存在明确教学语义时才设置 `allowNonZeroInitialVelocity/allowCustomBodySize`。
- “画面紧凑”优先通过布局几何（锚点高度/间距/净空）解决，不应以 rope slack 作为默认补偿手段。
- 当模板为“锚点悬挂且初始静止”语义时，必须满足 `anchor.y > 9` 与 `d > 4` 两项硬门禁。

### 21. 模板教学元信息最小化与步骤自动推导（T3.1-C2）
**设计动机**：教学元信息初版包含过多同质字段（`curriculumContext/usageGuide/knowledgePoints`），维护成本高且信息增益低；同时手写 `constructionSteps` 易与 `commandProgram` 漂移。

**核心模式**：
- 教学元信息收敛为最小必要集：`teachingObjective + constructionSteps`。
- `constructionSteps` 由 `commandProgram.commands` 在 catalog 装载阶段自动推导，避免人工同步。
- `planned` 模板因暂无命令序列，统一使用占位步骤，待接入命令后自动替换。
- 工作台卡片信息密度收敛：卡片展示 `name + id + status`，不承载长文本教学描述。

**关键接口**：
- `src/templates/schema.ts`：`TemplateTeachingMeta` 最小字段定义
- `src/templates/catalog.ts`：`normalizeTeachingMeta()`、`describeCommandProgram()`
- `src/components/workbench/WorkbenchPage.tsx`：卡片信息密度控制

**扩展规则**：
- 不要在模板 JSON 中手写与命令无关的冗长 `constructionSteps` 文案；ready 模板以命令推导结果为准。
- 若后续需要新增教学字段，必须满足“跨模板有明显差异且可用于筛选/教学动作”，否则不入 schema。

### 22. 模板运行态/生成态拆分与手工资产保护（T3.1-C3/C4）
**设计动机**：将“模板运行时消费链路”与“命令生成链路”彻底解耦，降低心智负担并避免脚本覆盖手工回写资产。

**核心模式**：
- 运行态只消费 `catalog + scene`：
  - `src/templates/catalog-data/modules.json`
  - `src/templates/catalog-data/templates.json`
  - `public/templates/scenes/*.json`
- 生成态只消费 `preset(commandProgram)`：
  - `src/templates/presets/*/*.json` 作为命令输入源，不再承担运行态目录职责。
- `sceneSource` 仍作为模板来源标记：
  - `command`：由命令生成 scene；
  - `manual`：以手工回写 scene 为真值。
- 运行时 `loader` 统一执行 scene sanity gate，不再做运行时 `commandProgram vs scene` diff。
- 生成脚本按 `catalog-data/templates.json` 过滤 `ready + sceneSource=command`，并显式跳过 `manual`，保护手工模板。
- 开发态保存动作回写两处：
  - `src/templates/catalog-data/templates.json`（更新 `sceneSource='manual'`、`updatedAt`）
  - `public/templates/scenes/<TEMPLATE_ID>.json`

**关键接口**：
- `src/templates/schema.ts`：`TemplateSceneSource` 与 `TemplateDefinition`（运行态无 `commandProgram`）
- `src/templates/catalog.ts`：仅解析 `catalog-data`
- `src/templates/loader.ts`：scene 加载 + sanity 校验
- `scripts/generate-template-scene-json.mjs`：`catalog-data` 过滤 + `presets` 命令读取 + manual 保护
- `src/templates/commands/examples.ts`：从 `presets` 聚合 `commandProgram`
- `vite.template-preset-save-plugin.ts`：`POST /__template/preset/save` 回写 `catalog-data + scene`
- `src/templates/presetPersistence.ts`、`src/components/layout/TemplateDevActions.tsx`：开发态保存/导出入口

**扩展规则**：
- 运行态新增模板时，先更新 `catalog-data/templates.json`，再提供对应 `sceneJsonPath` 资产。
- 命令模板迭代时，仅修改 `presets` 与生成脚本，不把命令字段回灌到运行态 catalog。
- `sceneSource=manual` 模板必须视为受保护资产，`templates:generate-json` 不得覆盖。
- 生产环境不暴露本地写盘接口，开发动作保持 DEV only。

### 23. 受约束拖拽统一收敛链路（T3.1 交互回归）
**设计动机**：绳/杆/滑轮场景中，若把吸附、长度约束、地面防穿透拆在不同分支，容易出现“吸附失效”“可穿地”“绳长漂移”等相互打架问题。

**核心模式**：
- 单拖与多拖统一采用顺序：
  1. 计算候选位姿（可含 `computeSnap`）；
  2. 执行连接件长度约束回收（rope/rod/pulley）；
  3. 执行地面防穿透钳制（直接拖拽体 + 联动体）。
- 约束求解中，所有 `moveBody` 写回都走“先 clamp 再写入”。
- `pulleyMount` 拖拽必须纳入 `totalLength` 守恒回收，避免只动滑轮座不回收两端导致的视觉变长。

**关键接口**：
- `src/core/tools/SelectTool.ts`
  - `handleMoveDrag` / `handleMultiMoveDrag`
  - `applyRopeConstraints`
  - `clampPositionAboveGround`

**扩展规则**：
- 不要通过“整体禁用受约束体吸附”规避约束冲突；应保留吸附并在后置回收里统一收敛。
- 新增连接件类型时，必须接入同一收敛链路（候选位姿 -> 约束回收 -> 地面钳制），避免分支特例漂移。

## 坐标系约定

```
世界坐标：原点画布底部中心，Y↑，单位=米
屏幕坐标：原点左上角，Y↓，单位=像素
转换函数：worldToScreen / screenToWorld

Canvas 变换序列：
  ctx.translate(screenPos) → ctx.rotate(-body.angle)
  → 物体局部坐标：X→右，Y→下（屏幕方向）

局部→世界：rotate(+angle) + Y翻转
```

## 循环依赖处理
`descriptor.ts` 通过 `_setDescriptorLookup` 注入机制获取 registry lookup，避免 descriptor.ts ↔ registry.ts 循环导入。registry.ts 在模块加载时调用注入。

## 关键文件路径

| 模块 | 路径 |
|------|------|
| 物体描述符 | `src/models/bodyTypes/*.tsx` |
| 注册表 | `src/models/bodyTypes/registry.ts` |
| Descriptor 接口 | `src/models/bodyTypes/descriptor.ts` |
| 选择工具 | `src/core/tools/SelectTool.ts` |
| 手柄系统 | `src/core/handles/SelectionHandles.ts` |
| 吸附引擎 | `src/core/snap/SnapEngine.ts` |
| 对齐引擎 | `src/core/align/AlignEngine.ts` |
| 渲染器 | `src/renderer/CanvasRenderer.ts` |
| 画布组件 | `src/components/Canvas.tsx` |
| 场景 store | `src/store/sceneStore.ts` |
| 约束描述符 | `src/models/jointTypes/*.tsx` |
| 约束注册表 | `src/models/jointTypes/registry.ts` |
| 力收集器 | `src/engine/ForceCollector.ts` |
| 力描述符 | `src/models/forceTypes/*.ts` |
| 力渲染器 | `src/renderer/ForceRenderer.ts` |
| 力显示 store | `src/store/forceDisplayStore.ts` |
| 分析记录器 | `src/engine/AnalysisRecorder.ts` |
| 分析 store | `src/store/analysisStore.ts` |
| 图表面板 | `src/components/panels/AnalysisPanel.tsx` |
| 数据源选择器 | `src/components/panels/DataSourceSelector.tsx` |
| 时序图表 | `src/components/charts/TimeSeriesChart.tsx` |
| 能量柱状图 | `src/components/charts/EnergyBarChart.tsx` |
| 图表色板 | `src/components/charts/chartColors.ts` |
| 可分析物体判定 | `src/components/charts/chartUtils.ts` |
| 动量柱状图 | `src/components/charts/MomentumBarChart.tsx` |
| Tip 组件 | `src/components/ui/Tip.tsx` |
