# V0.2 编辑器架构重构 — 背景文档

## 版本定位

V0.2 是一次**纯架构重构**，不新增用户可见功能。目标是将 V0.1 的"功能堆叠式"代码重构为"3D 编辑器"架构，为后续所有功能扩展建立统一底座。

重构完成后，用户体验与 V0.1 完全一致，但内部架构从"按功能组织"转变为"按编辑器核心概念组织"。

---

## 架构转型方向

### 核心认知

当前产品本质上是一个 **3D 几何编辑器**，具有特定的教育场景需求。应该按编辑器的通用架构来设计，而不是按"功能点"逐个堆叠。

### 从"功能堆叠"到"编辑器架构"

```
V0.1（当前）                              V0.2（目标）
─────────────                            ─────────────
按功能组织：                               按编辑器核心概念组织：
  坐标系 = 布尔开关 + 索引                   Entity 系统（统一实体模型 + 引用 + 依赖）
  截面 = 布尔开关 + 点列表                   Tool 系统（交互模式状态机）
  外接球 = 布尔开关                          Selection 系统（选中状态独立管理）
  线段 = 独立数组                            Command 系统（可逆操作 + undo/redo）
  标注 = 散落的 override 字段                Event 系统（系统间解耦通信）
  交互 = 布尔字段 + if-else                  Property 系统（选中实体→属性面板）
  Store = 40个字段的单体                     Renderer 系统（实体→视觉表达）
```

---

## 编辑器核心系统设计

> 以下系统设计基于 Blender、Three.js Editor、tldraw、Excalidraw、Unity、FreeCAD 等主流编辑器的架构调研。

### 架构分层总览

```
┌─────────────────────────────────────────────────────┐
│              呈现层                                   │
│    Renderer（实体→视觉）  Property（选中→属性面板）     │
├─────────────────────────────────────────────────────┤
│              交互层                                   │
│    Tool（交互模式）       Selection（选中管理）         │
├─────────────────────────────────────────────────────┤
│              通信层                                   │
│    Event/Signal（发布-订阅，系统间解耦）                │
├─────────────────────────────────────────────────────┤
│              变更层                                   │
│    Command（可逆操作 + undo/redo 栈）                  │
├─────────────────────────────────────────────────────┤
│              数据层                                   │
│    Entity（统一实体模型 + 实体间引用 + 依赖更新）       │
└─────────────────────────────────────────────────────┘

架构约束（贯穿所有层）：
  ● Entity properties 天然可序列化（为未来持久化预留）
  ● 实体间引用用 id，不用运行时指针
  ● Scene Graph 使用 Three.js 自带，不自建
```

### 1. Entity 系统（数据层）

**职责**：场景中所有对象的统一数据模型与生命周期管理。

**核心设计**：
- 场景中的一切都是实体（几何体、点、线段、坐标系、截面、外接球/圆、度量标注……）
- 每个实体有统一的 id、type、properties、visible
- **Entity ID 采用递增策略**（如 `1, 2, 3...`），天然表示创建顺序，无需额外字段
- 加新功能 = 注册新实体类型，不改框架代码

**实体分级**：
- **普通实体**：点、线段、截面、外接球/圆、度量标注等——可自由创建/删除，互不影响
- **场景级上下文实体（Singleton）**：坐标系——场景中最多一个，是"向量法解题"整条链路的基础设施（建系→显示坐标→输入坐标建点→向量运算）；删除时清除所有坐标依赖的派生信息；EntityStore 提供 `getCoordinateSystem()` 快捷方法直接访问，无需遍历查找
- 坐标系与截面/外接球的本质区别：截面/外接球是"观察辅助"（关了就没了，不影响其他操作），坐标系是"计算基础设施"（建系后解锁一系列坐标相关操作，其他实体可能依赖它）

**实体间引用机制**：
- 实体通过 id 引用其他实体，不使用运行时指针
- 引用关系举例：
  - 棱上的点 → 引用几何体 + 棱索引 + 参数 t
  - 面上的点 → 引用几何体 + 面索引 + 参数 (u, v)
  - 线段 → 引用两个端点实体
  - 截面 → 引用多个定义点实体
  - 坐标系 → 引用原点实体
  - 角度标注 → 引用相关点/线/面实体

**依赖更新**：
- 当被引用的实体变化时，引用方需要重算（如棱变化 → 棱上的点位置重算）
- 当前场景中实体数量少（几何体 + 几十个附属元素），不需要 Blender 那样的 Depsgraph，全量重算即可
- 坐标系作为上下文实体，被删除时需级联清理依赖它的信息（如通过坐标输入创建的点的坐标显示）

**不需要自建 Scene Graph 的理由**：
- 调研结论：CAD/几何编辑器中有三种层级结构——Scene Graph（空间层级）、B-Rep 拓扑（几何体内部结构）、实体引用（依赖关系）——不能混为一谈
- Scene Graph 的核心职责是变换继承（移动父节点→子节点跟随），Three.js 的 Object3D 已提供
- 我们的场景扁平（几何体 + 同级的附属元素），不存在嵌套空间层级
- "点在棱上"不是 parent-child 关系，是参数化引用——点通过 `{ edgeRef, t: 0.3 }` 引用棱，位置从棱的几何数据计算而来
- 几何体的顶点/棱/面是 BuilderResult 的内部数据（从参数计算），不是独立的场景图节点

**点的统一模型**：
- 所有类型的点（几何体顶点、棱上点、面上点、坐标输入点）统一为同一种实体
- 所有点具备相同的可操作性：选中态、右键菜单、可作为坐标系原点、约束拖拽
- 拖拽带约束：几何体顶点自由移动，棱上点沿棱滑动（改变 t），面上点面内移动（改变 u, v）

**序列化设计约束**：
- Entity 的 properties 必须是纯数据（可 JSON 序列化），不能存函数、Three.js 对象等运行时引用
- 引用用实体 id（`{ originRef: "point-001" }`）而非对象指针
- 为未来持久化（保存/加载场景）预留接口：整个 `Map<string, Entity>` 可直接序列化/反序列化

### 2. Command 系统（变更层）

**职责**：所有对实体的变更封装为可逆操作，支持完整的 undo/redo。

**核心设计**：
- Command 是实体中心的（CreateEntity、DeleteEntity、UpdateProperty、MovePoint……）
- 每个 Command 实现 `execute()` + `undo()`
- CommandProcessor 中央化执行与历史管理

**粒度规则**：
- 连续操作（拖拽顶点、拖拽滑块、沿棱滑动点）以 **mouseup 为 Command 提交点**——mousedown 记录 before 状态，mousemove 实时更新渲染（不产生 Command），mouseup 生成一个 Command 压入栈
- 非连续操作（点击按钮切换几何体、双击重命名、右键菜单操作）立即生成一个 Command
- 几何体类型切换等"重置性操作"用完整状态快照作为 Command 的 undo 数据

**覆盖范围**：
- 所有用户操作都要能 undo：参数变化、创建/删除点/线段/截面等实体、修改实体属性（名称、位置等）、坐标系开关、外接球开关……

### 3. Event/Signal 系统（通信层）

**职责**：系统间的解耦通信，避免系统间直接引用。

**核心设计**：
- 发布-订阅模式（Pub/Sub）
- 每种事件类型一个 Signal 实例（类型安全）
- 典型事件：实体变更 → 渲染器更新、选中变更 → 属性面板刷新、Command 执行 → 历史栈更新

**业界参考**：
- Three.js Editor 的 Signals：`sceneGraphChanged`、`objectSelected`、`geometryChanged` 等
- Godot 的 Signal 系统：类型安全的事件通道

### 4. Tool 系统（交互层）

**职责**：封装用户与场景的交互模式，每个工具有独立的交互状态机。

**核心设计**：
- 每个工具封装自己的事件处理（pointerDown/Move/Up、keyDown）
- 工具之间天然互斥（同一时刻只有一个活跃工具）
- Escape 统一回到 SelectTool
- 加新交互方式 = 写一个 Tool 实现 + 注册

**V0.2 需要的工具**（迁移现有交互）：
- SelectTool（默认）：选中顶点/棱线/曲面线，拖拽移动
- DrawSegmentTool：画自定义线段
- CrossSectionTool：选点定义截面
- CoordSystemTool：选原点建坐标系

**工具接口**：
- `onActivate()` / `onDeactivate()`：工具切换时的初始化/清理
- `onPointerDown/Move/Up(event)`：鼠标/触屏事件
- `onKeyDown(event)`：键盘事件（Escape 等）
- `render?(): ReactNode`：工具的临时可视化（如画线时的预览线）

### 5. Selection 系统（交互层）

**职责**：选中状态的独立管理，从 Tool 系统中分离出来。

**核心设计**：
- 选中状态是全局的，不属于某个 Tool
- 支持选中任何实体类型（点、线段、面、坐标系……）
- 选中变更触发 Event → 属性面板刷新
- 未来可扩展：多选、框选

**从 Tool 中分离的理由**：
- 调研发现几乎所有编辑器（Blender、Unity、Three.js Editor）都有独立的 Selection 系统
- 多个 Tool 都需要读取选中状态（如 SelectTool 设置选中、DrawSegmentTool 读取选中点）
- 选中状态的变更需要通知多个系统（属性面板、右键菜单、渲染高亮）

### 6. Property/Inspector 系统（呈现层）

**职责**：选中实体 → 侧边栏显示可编辑属性。

**核心设计**：
- 选中任何实体 → 自动显示该实体类型对应的属性面板
- 属性编辑通过 Command 系统执行，天然支持 undo
- 替代当前硬编码的多个面板（参数面板、标注工具面板、辅助功能面板）

### 7. Renderer 系统（呈现层）

**职责**：将实体数据转化为 Three.js 可视化。

**核心设计**：
- 每种实体类型注册自己的渲染器组件
- 渲染器从 Entity 数据读取，输出 R3F 组件
- 加新视觉元素 = 注册新渲染器

**V0.2 需要的渲染器**（迁移现有渲染）：
- GeometryRenderer（多面体/曲面体）
- PointRenderer（各类点的可视化）
- SegmentRenderer（自定义线段）
- CoordinateAxesRenderer（坐标系）
- CircumSphereRenderer（外接球）
- CircumCircleRenderer（外接圆）
- CrossSectionRenderer（截面）

### 可选系统：Constraint（数据层）

**职责**：实体间的运动约束关系（点在棱上只能沿棱滑动、面上的点只能面内移动）。

**当前状态**：V0.1 已有简单的约束逻辑——棱上的 `CustomPoint` 通过 `t` 参数约束在棱上。

**V0.2 策略**：沿用现有的简单约束逻辑（作为 Entity properties 的一部分），不建立独立的 Constraint 系统。V0.3 引入面上点、动点等更复杂约束时，再考虑是否需要独立系统。

---

## 重构后的 Store 结构

从 ~40 个散落字段 → 3 个核心 Store：

| Store | 职责 |
|-------|------|
| EntityStore | `entities: Map<string, Entity>`，场景中所有实体的集合；提供 `getCoordinateSystem()` 等上下文实体快捷访问 |
| ToolStore | `activeTool: Tool`，当前激活的工具及其状态 |
| HistoryStore | `undoStack / redoStack`，命令历史 |

Selection 状态可以是 EntityStore 的一部分（`selectedIds: Set<string>`），也可以是独立的 SelectionStore，在详细设计时决定。

**多几何体扩展性约束**：
- V0.2 仍为单几何体场景，但 EntityStore、Builder 流程、Renderer 管线不应硬编码"只有一个几何体"的假设
- 几何体本身也是 Entity（`type: 'geometry'`），通过 `activeGeometryId` 标识当前操作的几何体，而非 `currentType` 全局单例
- 未来可能出现组合体场景（如正方体内切球、柱锥组合），架构不应阻塞这一扩展方向

---

## V0.1 已实现功能清单

以下功能在 V0.1 中已完整实现，V0.2 重构后必须全部保持可用：

### 基础建模
- 6 种几何体：长方体、正方体、棱锥（3~8边）、圆锥、圆柱、球
- 参数实时调节（滑块拖动，模型实时更新）
- 3D 旋转/缩放/平移（鼠标 + 触屏）
- 预设视角切换（重置/正视/俯视/侧视，平滑动画）

### 标注与编辑
- 顶点重命名（双击标签编辑）
- 线段命名（右键菜单→命名）
- 棱上取中点/任意点（可命名，可沿棱滑动）
- 曲面体取点（母线/底圆上）
- 顶点拖拽移动（多面体顶点自由拖拽，关联线段面跟随）

### 度量计算
- 体积/表面积：始终显示，参数变化实时更新
- 精确值显示：含 π/根号/分数的 LaTeX 表达式
- 计算步骤：点击可展开完整推导过程
- 线段长度：自定义线段自动显示长度

### 辅助分析
- 坐标系：选顶点为原点，自动生成 XYZ 轴 + 各顶点坐标值
- 外接球：半透明球面 + 半径值（5种几何体支持）
- 外接圆：选 3+ 顶点，在所在平面画外接圆 + 半径
- 截面：选 3+ 点定义截面，半透明渲染 + 截面面积
- 球截面：球体截面渲染截面圆（大圆/小圆）+ 截面半径

### 高级功能
- 自定义线段：选两点画线，5 种颜色 + 虚实切换
- 展开图：5 种几何体的 2D 展开图
- 三视图：6 种几何体的正视/俯视/侧视投影（含虚实线）
- PNG 导出：展开图/三视图可导出图片

### 交互体验
- 选中高亮（顶点/线段选中态）
- 右键菜单（棱线/曲面线→重命名、取中点、取自由点）
- UI 主色调 #00C06B，按钮大、字体 ≥14px

### 已知待完善项（V0.1 遗留，归入 V0.3）
- Escape 键退出绘制模式
- 3D 区域模式提示条
- 画线起点高亮
- 切换几何体时清理旧状态

---

## V0.2 重构范围边界

### 做什么
- 建立 Entity / Command / Event / Tool / Selection / Property / Renderer 七个核心系统
- 将 V0.1 所有已实现功能迁移到新架构上
- 统一点模型（所有点具备相同的可操作性：选中、右键菜单、坐标系原点、约束拖拽）
- 实现 undo/redo（覆盖所有用户操作，连续操作 mouseup 提交）
- Entity properties 设计为可序列化（为未来持久化预留接口）

### 不做什么
- 不新增任何用户可见功能
- 不新增几何体类型
- 不做坐标系重构（交互式建系）
- 不做角度度量
- 不做 hover 高亮 / 面交互
- 不建立独立的 Constraint 系统
- 不实现实际的保存/加载功能（只确保数据结构可序列化）
- 以上功能全部在 V0.3 中实现

### 验收标准
- 用户体验与 V0.1 完全一致（所有功能可用，无回归）
- `pnpm lint && pnpm tsc --noEmit && pnpm build` 全部通过
- Ctrl+Z / Ctrl+Y 撤销重做可用（覆盖所有用户操作）
- 内部架构符合编辑器七系统设计
- 所有 Entity 数据可通过 `JSON.stringify` / `JSON.parse` 往返

---

## 当前技术架构速览（V0.1）

```
src/
├── engine/                        # 计算引擎（纯函数）
│   ├── types.ts                   # BuilderResult = PolyhedronResult | SurfaceResult
│   ├── builders/                  # 6 个几何体 Builder + 工厂函数
│   ├── math/                      # 体积/表面积 Calculator + 坐标系/截面/外接球
│   │   ├── calculators/           # 6 个计算器
│   │   ├── coordinates.ts         # 坐标系（纯函数自动推断）
│   │   ├── crossSection.ts        # 截面计算
│   │   ├── circumscribedSphere.ts # 外接球
│   │   ├── circumscribedCircle.ts # 外接圆
│   │   └── symbolic.ts            # 符号化计算
│   ├── unfolding/                 # 展开图算法
│   └── projection/                # 三视图投影
├── components/
│   ├── scene/                     # 3D 场景（R3F Canvas + 渲染器 + 叠加层）
│   ├── panels/                    # 侧边栏控制面板
│   ├── info/                      # 度量信息显示
│   ├── layout/                    # 布局容器
│   ├── views/                     # 展开图/三视图面板
│   └── ui/                        # UI 基础组件
├── store/
│   └── useGeometryStore.ts        # Zustand 单体 Store（~40 个状态字段）
├── hooks/
│   ├── useGeometryBuilder.ts      # Store → Builder 连接
│   └── useInteraction.ts          # 交互逻辑（if-else 分发）
├── types/
│   └── scene.ts                   # PointRef / CustomPoint / SelectionTarget 等类型
└── utils/
    └── pointRef.ts                # 点引用解析工具函数
```

### 架构痛点
1. **Store 单体膨胀**：~40 个字段混在一个 store，坐标系/截面/外接球各自用布尔开关+数据字段
2. **无统一实体概念**：几何体顶点、自定义点、特征点是三套系统；不同类型的点有不同的可操作性
3. **交互模式隐式管理**：`drawingMode` + 散落布尔字段 + useInteraction 中大 if-else
4. **无操作历史**：所有 store 变更直接 set()，无法撤销
5. **度量类型硬编码**：`CalculationResult` 只有 volume + surfaceArea，无法扩展角度/距离
6. **加新功能 = 改多处**：每个新功能需要 store 加字段 + 组件加逻辑 + 交互加分支
7. **数据不可序列化**：store 中混合了运行时状态和持久化数据，无法直接导出/恢复场景

---

## 业界调研参考

本架构设计基于以下编辑器的调研：

| 编辑器 | 关键架构模式 | 我们借鉴的点 |
|--------|------------|-------------|
| **Blender** | DNA/RNA 元数据、Depsgraph 依赖图、Operator 系统 | Operator = 我们的 Command；Depsgraph 概念简化为全量重算 |
| **Three.js Editor** | Signals 发布订阅、Command 模式全覆盖、Editor 单一数据源 | Signal 系统设计、Command 模式实现方式 |
| **tldraw** | 无头画布引擎、Store 与 UI 分离、Shape 注册机制 | Shape 注册 = 我们的 Entity 类型注册 |
| **Excalidraw** | 双 Canvas 渲染、包依赖层级强制、元素统一模型 | 元素统一模型 = 我们的 Entity 统一模型 |
| **Unity** | GameObject-Component、ECS、Inspector 系统 | Inspector = 我们的 Property 系统 |
| **FreeCAD / OpenCASCADE** | B-Rep 拓扑、TopoDS 层级、Constraint Solver | 拓扑与场景图分离的认知；约束概念 |

### 关键调研结论

**Scene Graph 不需要自建**：
- CAD 中有三种层级：Scene Graph（空间变换）、B-Rep 拓扑（几何体结构）、实体引用（依赖关系）
- "点在棱上"是参数化引用（`edgeRef + t`），不是 parent-child 空间层级
- Three.js 自带的 Object3D 层级足够我们使用

**Dependency Graph 不需要**：
- Blender 用 Depsgraph 是因为场景有上万对象需要增量更新
- 我们的场景中实体数量极少（几何体 + 几十个附属元素），全量重算无性能问题

**Serialization 不是独立系统而是设计约束**：
- 只要 Entity properties 是纯数据（可 JSON 序列化），整个场景的保存/加载就是自然的
- 这是数据结构设计时的约束，不需要单独的序列化框架

---

## 需求来源档案

- 原始 PRD：`docs/需求.md`
- 产品经理+老师反馈：`docs/反馈.txt`
- 已提炼补充需求：`docs/需求补充.md`
- V0.1 功能演示清单：`docs/功能演示清单.md`
- V0.1 实施记录：`.tasks/active/init/PROGRESSIVE-PLAN.md`
- V0.1 曾规划的需求清单（已移至 V0.3）：`.tasks/active/v0.1/PROGRESSIVE-PLAN.md`
- V0.3 功能备忘录：`.tasks/active/v0.3/BACKLOG.md`
