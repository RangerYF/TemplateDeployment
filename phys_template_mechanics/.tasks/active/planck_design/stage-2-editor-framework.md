# 第2阶段：编辑器框架（交互系统 + 面板）

- **所属计划**：PROGRESSIVE-PLAN.md
- **预计耗时**：4天
- **风险等级**：L1（多文件改动，编辑器核心架构建立）
- **状态**：已完成
- **前置阶段**：第1阶段（已完成）

---

## 目标
实现 Tool/Selection/Command 三大系统 + 左侧物体面板拖拽 + 右侧属性面板，形成完整的编辑器交互闭环。

---

## 阶段1现状（依赖分析）

当前已有：
- `PhysicsBridge`：直接管理 Body（`addBody/removeBody/getBodyStates`），使用 `BodyConfig` 硬编码创建
- `editorStore`：`mode`/`simState`/`gravity`
- `viewportStore`：`offset`/`scale`/`canvasSize`
- `CanvasRenderer`：渲染 `BodyState[]`（box/circle/edge），无 hitTest
- `Canvas.tsx`：直接调用 `physicsBridge.setupDefaultScene()`，无 Scene Model 概念
- `Toolbar.tsx`：播放/暂停/停止

本阶段核心变更：
- 引入 **Scene Model** 作为编辑器"真相源"，替代 PhysicsBridge 直接管理
- Scene Model → PhysicsBridge 单向同步（编辑模式）
- 所有用户操作通过 **Command 系统** 修改 Scene Model（可撤销）
- **Tool 系统** 处理画布交互，**Selection 系统** 管理选中状态

---

## 子任务链路（串行）

```
T2.1 Scene Model 数据层 + sceneStore
→ T2.2 Scene Model → PhysicsBridge 同步层
→ T2.3 编辑器布局（三栏）
→ T2.4 Selection 系统 + hitTest
→ T2.5 Tool 系统（SelectTool）
→ T2.6 Command 系统（Undo/Redo）
→ T2.7 左侧物体面板（拖拽放置）
→ T2.8 右侧属性面板（选中编辑）
→ T2.9 集成验证与提交
```

---

## T2.1 Scene Model 数据层 + sceneStore

**目标**：定义独立于物理引擎的场景数据结构，建立 Zustand store 管理场景状态

**任务**：
1. 创建 `src/models/types.ts` — 场景数据类型（参考设计文档 4.2）：
   ```typescript
   // 物体类型（本阶段只实现 block 和 ball，其余第3阶段扩展）
   type BodyType = 'block' | 'ball' | 'ground'

   interface SceneBody {
     id: string
     type: BodyType
     label: string               // 显示名称，如"物块 #1"
     position: { x: number; y: number }
     angle: number
     isStatic: boolean
     fixedRotation: boolean
     // 公共物理属性
     mass: number                // kg
     friction: number            // 0-1
     restitution: number         // 0-1
     initialVelocity: { x: number; y: number }
     // 形状属性（按类型不同）
     width?: number              // block
     height?: number             // block
     radius?: number             // ball
   }

   interface SceneSettings {
     gravity: { x: number; y: number }
   }

   interface Scene {
     id: string
     name: string
     bodies: SceneBody[]
     joints: SceneJoint[]      // 本阶段为空数组，第4阶段实现
     forces: SceneForce[]      // 本阶段为空数组，第5阶段实现
     settings: SceneSettings
   }
   ```
2. 创建 `src/models/defaults.ts` — 物体类型默认值工厂：
   - `createDefaultBlock()` → 返回默认物块配置（1m×1m, mass=1, friction=0.3 等）
   - `createDefaultBall()` → 返回默认球体配置（radius=0.5, mass=1 等）
   - `generateId()` → 生成唯一 ID
   - `generateLabel(type, existingBodies)` → 自动生成标签（"物块 #1", "球体 #2"）
3. 创建 `src/store/sceneStore.ts` — 场景 Zustand store：
   - `scene`: `Scene` 对象
   - `addBody(body)` — 添加物体
   - `removeBody(id)` — 删除物体
   - `updateBody(id, partial)` — 更新物体属性
   - `moveBody(id, position)` — 移动物体
   - 初始场景：一个地面（内置，不可删除）

**设计决策**：
- SceneBody 使用扁平属性（`width`/`height`/`radius` 直接放在 body 上），不用 `ShapeConfig` 嵌套，简化属性面板绑定
- `ground` 是特殊物体类型，默认存在，不在物体面板中列出

**产出**：Scene Model 类型定义 + sceneStore + 默认值工厂

**验收**：`pnpm tsc --noEmit` 通过，类型完整

---

## T2.2 Scene Model → PhysicsBridge 同步层

**目标**：建立 Scene Model 到 PhysicsBridge 的单向同步，替代硬编码的 `setupDefaultScene()`

**任务**：
1. 创建 `src/engine/sceneSync.ts` — 同步逻辑：
   - `syncSceneToWorld(scene, bridge)` — 将 Scene Model 完整同步到 PhysicsBridge
     - 遍历 `scene.bodies`，转换为 `BodyConfig`，调用 `bridge.addBody()`
     - SceneBody 的 `mass` 转为 `density`（`density = mass / (width * height)` 对 box，`density = mass / (π * r²)` 对 circle）
   - `syncBodyUpdate(body, bridge)` — 单个物体属性变更时增量同步
   - `syncBodyAdd(body, bridge)` — 添加物体时同步
   - `syncBodyRemove(id, bridge)` — 删除物体时同步
2. 修改 `Canvas.tsx`：
   - 移除 `physicsBridge.setupDefaultScene()` 调用
   - 改为监听 `sceneStore` 变化 → 调用同步函数
   - 渲染数据来源：编辑模式从 sceneStore 读取，仿真模式从 PhysicsBridge.getBodyStates() 读取
3. 修改 `CanvasRenderer`：
   - 编辑模式下直接从 SceneBody 渲染（不走 PhysicsBridge）
   - 仿真模式下从 BodyState 渲染（保持现有逻辑）
   - 新增 `renderSceneBody(ctx, body, viewport)` 方法，接受 SceneBody 类型

**数据流变更**：
```
之前：PhysicsBridge.setupDefaultScene() → getBodyStates() → render
之后：sceneStore(Scene Model) → syncSceneToWorld → PhysicsBridge
      编辑模式：sceneStore → renderSceneBody
      仿真模式：PhysicsBridge.getBodyStates() → renderBody
```

**产出**：Scene Model 驱动的渲染和物理同步

**验收**：
- 画布仍能正确显示地面 + 物块（数据来源从 PhysicsBridge 改为 sceneStore）
- 播放/停止仍正常工作

---

## T2.3 编辑器布局（三栏）

**目标**：搭建左面板 + 画布 + 右面板 + 顶部工具栏的编辑器整体布局

**任务**：
1. 创建 `src/components/layout/EditorLayout.tsx` — 编辑器整体布局：
   ```
   ┌─────────────────────────────────────────────┐
   │  Toolbar（顶部工具栏）                        │
   ├────────┬─────────────────────┬───────────────┤
   │ 左面板  │      Canvas         │    右面板      │
   │ 240px  │      flex-1         │    280px      │
   │        │                     │               │
   │ 物体库  │                     │  属性面板      │
   │        │                     │  （选中时显示） │
   └────────┴─────────────────────┴───────────────┘
   ```
   - 左面板固定宽度 240px
   - 右面板固定宽度 280px（无选中时显示空状态提示）
   - Canvas 占据剩余空间
   - 面板使用设计系统的边框色和背景色
2. 创建 `src/components/panels/ObjectPanel.tsx` — 左面板容器（T2.7 填充内容）
3. 创建 `src/components/panels/PropertyPanel.tsx` — 右面板容器（T2.8 填充内容）
4. 更新 `App.tsx`：使用 `EditorLayout` 替代当前简单布局

**产出**：三栏编辑器布局

**验收**：
- 页面显示三栏布局，左右面板宽度固定
- Canvas 自适应中间区域，缩放/平移不受影响
- 面板有合适的边框和背景

---

## T2.4 Selection 系统 + hitTest

**目标**：实现点击画布选中物体、hover 高亮、取消选中

**任务**：
1. 创建 `src/store/selectionStore.ts` — 选中状态 store：
   ```typescript
   type SelectableObject =
     | { type: 'body'; id: string }
     | { type: 'joint'; id: string }   // 第4阶段使用
     | { type: 'force'; id: string }   // 第5阶段使用

   interface SelectionState {
     selected: SelectableObject | null    // 当前选中（单选）
     hovered: SelectableObject | null     // 当前 hover
   }
   ```
   - `select(obj)` — 选中对象
   - `deselect()` — 取消选中
   - `setHovered(obj | null)` — 设置 hover
2. 创建 `src/core/hitTest.ts` — 点击检测：
   - `hitTestBodies(worldPos, bodies): string | null` — 检测世界坐标点击了哪个物体
     - box：检查点是否在旋转后的矩形内
     - circle：检查点到圆心距离是否 < 半径
     - 返回命中物体的 id，未命中返回 null
     - 多个物体重叠时返回最上层（动态体优先于静态体）
3. 扩展 `CanvasRenderer`：
   - 选中高亮：选中物体描边加粗 + 颜色变化 + 4个角手柄
   - hover 高亮：hover 物体描边变亮
   - 新增参数 `selectedId` 和 `hoveredId`
4. 在 `Canvas.tsx` 中集成：
   - `onMouseMove`：screenToWorld → hitTestBodies → setHovered
   - `onMouseDown`（左键，非 panning）：screenToWorld → hitTestBodies → select/deselect
   - 点击空白区域 → deselect
   - ESC 键 → deselect

**产出**：选中/hover 交互完整可用

**验收**：
- ✅ 鼠标悬停物体时出现 hover 高亮
- ✅ 点击物体选中，显示选中高亮
- ✅ 点击空白区域取消选中
- ✅ ESC 取消选中
- ✅ 编辑模式下选中有效，仿真模式下不可交互

---

## T2.5 Tool 系统（SelectTool）

**目标**：实现 Tool 抽象和 SelectTool（选中 + 拖拽移动物体）

**任务**：
1. 创建 `src/core/tools/Tool.ts` — Tool 接口（参考设计文档 4.3）：
   ```typescript
   interface CanvasMouseEvent {
     screenPos: { x: number; y: number }
     worldPos: { x: number; y: number }
     button: number
     shiftKey: boolean
     ctrlKey: boolean
   }

   interface Tool {
     name: string
     cursor: string           // CSS cursor
     onMouseDown(e: CanvasMouseEvent): void
     onMouseMove(e: CanvasMouseEvent): void
     onMouseUp(e: CanvasMouseEvent): void
     onKeyDown(e: KeyboardEvent): void
     render(ctx: CanvasRenderingContext2D, viewport: Viewport): void
   }
   ```
2. 创建 `src/core/tools/SelectTool.ts` — 选择工具：
   - 左键点击：hitTest → 选中物体（复用 T2.4 的 Selection 系统）
   - 左键拖拽已选中物体：移动物体位置
     - mouseDown 记录起始位置
     - mouseMove 计算偏移量，实时更新物体位置（sceneStore.moveBody）
     - mouseUp 生成 MoveBodyCommand（用于 Undo）
   - hover：更新 hovered 状态
3. 创建 `src/store/toolStore.ts` — 工具状态 store：
   - `activeTool`: `Tool` 实例
   - `activeToolName`: `string`（'select' | 'joint' | 'force'）
   - `setTool(name)` — 切换工具
   - 默认激活 SelectTool
4. 修改 `Canvas.tsx`：
   - 鼠标事件先判断是否 panning，否则委托给 `activeTool.onMouseDown/Move/Up`
   - 构造 `CanvasMouseEvent`（含 screenPos 和 worldPos）
   - 光标样式由 activeTool.cursor 决定（panning 时覆盖为 grab/grabbing）
5. 扩展 `Toolbar.tsx`：
   - 预留工具切换按钮位置（本阶段只有 SelectTool，按钮禁用状态）
   - 快捷键 V 切换到 SelectTool

**产出**：Tool 系统架构 + SelectTool 可用

**验收**：
- ✅ 点击物体选中
- ✅ 拖拽选中的物体可移动位置
- ✅ 拖拽时物体实时跟随鼠标
- ✅ 仿真模式下工具不响应（只读）

---

## T2.6 Command 系统（Undo/Redo）

**目标**：实现 Command 模式的 Undo/Redo，所有编辑操作可撤销

**任务**：
1. 创建 `src/core/commands/Command.ts` — Command 接口：
   ```typescript
   interface Command {
     execute(): void
     undo(): void
     description: string
   }
   ```
2. 创建 `src/core/commands/CommandHistory.ts` — 命令历史管理：
   - `undoStack`: `Command[]`
   - `redoStack`: `Command[]`
   - `execute(command)` — 执行命令并压入 undoStack，清空 redoStack
   - `undo()` — 弹出 undoStack 执行 undo，压入 redoStack
   - `redo()` — 弹出 redoStack 执行 execute，压入 undoStack
   - `canUndo` / `canRedo` 状态
3. 创建具体 Command 实现：
   - `src/core/commands/AddBodyCommand.ts` — 添加物体
   - `src/core/commands/RemoveBodyCommand.ts` — 删除物体
   - `src/core/commands/MoveBodyCommand.ts` — 移动物体（记录起始和结束位置）
   - `src/core/commands/ChangePropertyCommand.ts` — 修改属性（记录属性键、旧值、新值）
4. 创建 `src/store/commandStore.ts`（或集成到 editorStore）：
   - 暴露 `commandHistory` 实例
   - `canUndo` / `canRedo` 响应式状态
5. 绑定快捷键：
   - `Ctrl+Z` → undo
   - `Ctrl+Shift+Z` / `Ctrl+Y` → redo
6. 修改 SelectTool：
   - 拖拽移动物体完成后，创建 `MoveBodyCommand` 并通过 `commandHistory.execute()` 执行
7. 扩展 Toolbar：
   - Undo/Redo 按钮（使用 lucide-react 的 Undo2/Redo2 图标）
   - 按钮 disabled 状态与 canUndo/canRedo 联动

**产出**：完整的 Undo/Redo 系统

**验收**：
- ✅ 移动物体后 Ctrl+Z 撤销，物体回到原位
- ✅ Ctrl+Shift+Z 重做
- ✅ 工具栏 Undo/Redo 按钮可用
- ✅ 添加物体后可撤销（物体消失）

---

## T2.7 左侧物体面板（拖拽放置）

**目标**：实现物体库面板，支持拖拽物体到画布创建

**任务**：
1. 实现 `src/components/panels/ObjectPanel.tsx`：
   - 分组列表：
     ```
     ▼ 基础物体
       [□] 物块
       [○] 球体
     ▼ 支撑面
       （第3阶段扩展：斜面、墙壁、锚点）
     ```
   - 每个物体项显示：图标 + 名称
   - 使用设计系统样式（间距、字体、颜色）
2. 实现 HTML5 Drag & Drop：
   - 物体项设置 `draggable`，`onDragStart` 设置物体类型到 `dataTransfer`
   - `Canvas.tsx` 监听 `onDragOver`（允许放置）和 `onDrop`
   - `onDrop` 时：
     - 从 `dataTransfer` 获取物体类型
     - 将放置点的屏幕坐标转为世界坐标
     - 使用 defaults 工厂创建 SceneBody
     - 通过 `AddBodyCommand` 添加到 sceneStore
3. 放置碰撞处理（简化版）：
   - 放置时检查是否与已有物体重叠
   - 如果重叠，向上移动直到不重叠（简单的 y 轴偏移）
4. 放置视觉反馈：
   - 拖拽到画布上时显示放置预览（半透明物体轮廓）

**产出**：物体面板 + 拖拽放置

**验收**：
- ✅ 左面板显示物块和球体两种物体
- ✅ 拖拽物块到画布，松手后画布上出现新物块
- ✅ 拖拽球体到画布，松手后画布上出现新球体
- ✅ 新物体可选中、可移动
- ✅ 添加操作可 Undo

---

## T2.8 右侧属性面板（选中编辑）

**目标**：选中物体后右侧面板显示并可编辑物体属性

**任务**：
1. 实现 `src/components/panels/PropertyPanel.tsx`：
   - 无选中：显示空状态提示（"选中物体查看属性"）
   - 选中物体：显示属性表单
2. 物体属性表单（根据选中物体类型动态显示）：
   - **公共属性**：
     - 标签（文本输入）
     - 位置 x, y（数字输入）
     - 角度（数字输入 + 滑块，度数显示，内部存弧度）
     - 质量 kg（数字输入）
     - 摩擦系数（滑块 0-1）
     - 弹性系数（滑块 0-1）
     - 初速度 vx, vy（数字输入）
     - 锁定旋转（开关）
   - **物块特有**：宽度、高度（数字输入）
   - **球体特有**：半径（数字输入）
3. 使用设计系统 UI 组件：
   - `Input` — 数字/文本输入
   - `Slider` — 摩擦系数、弹性系数、角度
   - `Switch` — 锁定旋转、是否静态
   - `Label` — 属性标签
4. 属性变更通过 Command 系统：
   - 输入框 `onBlur` 或 `onChange`（防抖）时创建 `ChangePropertyCommand`
   - 滑块 `onValueCommit`（松手时）创建 Command
   - 确保属性变更可 Undo
5. 删除物体：
   - 面板底部"删除"按钮 或 选中后按 Delete/Backspace 键
   - 通过 `RemoveBodyCommand` 执行
   - 地面（ground）不可删除

**产出**：属性面板完整可编辑

**验收**：
- ✅ 选中物块，右面板显示：标签、位置、角度、质量、摩擦、弹性、宽度、高度等
- ✅ 选中球体，右面板显示半径（无宽高）
- ✅ 修改质量为 5kg，播放仿真，物理行为正确变化
- ✅ 修改摩擦系数为 0，物块在地面上不受摩擦
- ✅ 属性修改可 Undo
- ✅ Delete 键删除选中物体
- ✅ 无选中时面板显示空状态

---

## T2.9 集成验证与提交

**目标**：全量验证阶段2产出，确保编辑器交互闭环完整

**任务**：
1. 完整交互流程验证：
   - 从面板拖出物块 → 放到画布 → 选中 → 属性面板编辑质量/摩擦 → 再拖出球体 → 播放仿真 → 物块落地弹起、球体滚动 → 停止回到编辑态
   - Undo/Redo 全流程：添加物体 → Undo → 物体消失 → Redo → 物体恢复
   - 拖拽移动物体 → Undo → 物体回到原位
2. 代码质量检查：
   - `pnpm lint` 通过
   - `pnpm tsc --noEmit` 通过
3. 更新 `README.md`：
   - 新增编辑器框架说明（Tool/Selection/Command 系统）
   - 操作指南（拖拽放置、选中编辑、快捷键列表）
4. Git 提交（用户确认后）

**验收**：
- ✅ 从左侧面板拖出物块/球体到画布，物体正确显示
- ✅ 点击画布上物体可选中，右侧面板显示属性
- ✅ 可在属性面板修改质量、摩擦系数等，物理行为相应变化
- ✅ 选中物体可拖拽移动
- ✅ Ctrl+Z 撤销操作，Ctrl+Shift+Z 重做操作
- ✅ 点击空白取消选中，面板清空
- ✅ `pnpm lint && pnpm tsc --noEmit` 通过
- ✅ README.md 已更新

---

## 涉及文件范围汇总

```
src/
├── models/
│   ├── types.ts                  # 场景数据类型（SceneBody/Scene 等）
│   └── defaults.ts               # 物体默认值工厂 + ID/标签生成
├── engine/
│   ├── sceneSync.ts              # Scene Model → PhysicsBridge 同步
│   └── PhysicsBridge.ts          # (修改) 可能需微调接口
├── core/
│   ├── hitTest.ts                # 点击检测
│   ├── tools/
│   │   ├── Tool.ts               # Tool 接口定义
│   │   └── SelectTool.ts         # 选择/移动工具
│   └── commands/
│       ├── Command.ts            # Command 接口
│       ├── CommandHistory.ts     # 命令历史管理
│       ├── AddBodyCommand.ts     # 添加物体
│       ├── RemoveBodyCommand.ts  # 删除物体
│       ├── MoveBodyCommand.ts    # 移动物体
│       └── ChangePropertyCommand.ts # 修改属性
├── store/
│   ├── sceneStore.ts             # 场景数据 store
│   ├── selectionStore.ts         # 选中状态 store
│   ├── toolStore.ts              # 工具状态 store
│   └── commandStore.ts          # 命令历史 store
├── renderer/
│   └── CanvasRenderer.ts         # (修改) 增加 SceneBody 渲染 + 选中/hover 高亮
├── components/
│   ├── layout/
│   │   └── EditorLayout.tsx      # 三栏编辑器布局
│   ├── panels/
│   │   ├── ObjectPanel.tsx       # 左侧物体面板
│   │   └── PropertyPanel.tsx     # 右侧属性面板
│   ├── Canvas.tsx                # (修改) 集成 Tool/Selection/DnD
│   └── Toolbar.tsx               # (修改) 工具切换 + Undo/Redo 按钮
└── App.tsx                       # (修改) 使用 EditorLayout
```

新增约 15 个文件，修改 4 个文件。

---

## 技术注意事项

1. **Scene Model 是真相源**：编辑模式下所有数据从 sceneStore 读取，PhysicsBridge 只在仿真时提供运行时状态。切勿让 PhysicsBridge 成为数据的唯一来源。
2. **Command 的原子性**：每个 Command 的 execute/undo 必须完全对称。MoveBodyCommand 的 undo 要精确恢复到原始位置，不是"反向移动"。
3. **hitTest 精度**：矩形 hitTest 需考虑物体旋转（点坐标要先做逆旋转变换到物体局部坐标系）。
4. **拖拽移动 vs 画布平移**：两者都是鼠标拖拽，需优先级判断：
   - 中键 / 空格+左键 → 画布平移（最高优先级）
   - 左键在物体上 → 拖拽移动物体
   - 左键在空白处 → 取消选中
5. **属性面板防抖**：数字输入框不要每次 onChange 都创建 Command，应在 onBlur 或防抖后统一提交。
6. **density 计算**：用户输入的是质量（kg），Planck.js 需要 density。同步层负责转换：`density = mass / area`。

## 下一阶段依赖

第3阶段将在此基础上：
- 在 `models/types.ts` 中扩展 BodyType（slope/wall/anchor/bar）
- 在 `models/defaults.ts` 中添加新类型默认值
- 在 `engine/sceneSync.ts` 中添加新 Shape 类型的 Planck.js 映射
- 在 `CanvasRenderer` 中添加新类型渲染
- 在 `ObjectPanel` 中添加新物体到面板
- 在 `PropertyPanel` 中添加新类型特有属性
