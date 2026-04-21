# 第5阶段：约束系统（Joint）

## 任务 ID
03-25-15-00-constraint-system

## 风险评估
- **任务类型**：新功能开发（新子系统）
- **风险等级**：L2（高风险）
  - 跨模块联动：涉及 models/engine/core/renderer/store/components 6 个模块
  - 新增 Joint 数据链路：SceneJoint → PhysicsBridge → Planck.js Joint
  - 新增 Registry 模式实例（JointTypeDescriptor）
- **流程路径**：MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 背景与动机

阶段4.1已完成交互能力 Descriptor 化重构，11种物体全部可用。下一步需要让物体之间建立物理连接——约束（Joint），这是物理编辑器的核心能力之一。

物理课本中常见的约束场景：
- **绳**：单摆、Atwood 机、物块通过绳连接
- **杆**：刚性连接两物体，保持固定距离和角度
- **弹簧**：弹簧振子、弹簧连接两物体
- **滑轮绳**：绳绕过定滑轮两端连物块（Atwood 机）

## 目标

1. 复用 Registry/Descriptor 模式建立 `JointTypeDescriptor` + `jointRegistry`
2. 实现 JointTool（点击两个/三个物体建立约束的交互流程）
3. 实现绳/杆/弹簧/滑轮绳四种约束类型
4. 约束渲染（编辑模式 + 仿真模式）
5. 约束选中 + 属性面板编辑
6. PhysicsBridge 扩展支持 Joint 同步

## 现有基础设施分析

### 已预留的接口
- `SceneJoint`（`src/models/types.ts:53`）：仅占位 `{ id, type: string }`，需扩展
- `Scene.joints[]`（`src/models/types.ts:67`）：已初始化为空数组
- `SelectableObject`（`src/store/selectionStore.ts:3`）：已支持 `{ type: 'joint', id }`
- `ToolName`（`src/store/toolStore.ts:5`）：已预留 `'joint'`
- `sceneStore.scene.joints`：已初始化 `[]`

### 需要新建的模块
- `src/models/jointTypes/` — Joint 描述符系统（Registry + Descriptor + 四种类型）
- `src/core/tools/JointTool.ts` — 约束创建工具
- `src/core/commands/AddJointCommand.ts` — 添加约束命令
- `src/core/commands/RemoveJointCommand.ts` — 删除约束命令
- `src/core/commands/ChangeJointPropertyCommand.ts` — 修改约束属性命令

### 需要扩展的模块
- `src/models/types.ts` — SceneJoint 接口扩展
- `src/engine/types.ts` — JointConfig / JointState 类型
- `src/engine/PhysicsBridge.ts` — addJoint / removeJoint / getJointStates
- `src/engine/sceneSync.ts` — syncJointAdd / syncJointRemove / syncSceneToWorld 扩展
- `src/store/sceneStore.ts` — addJoint / removeJoint / updateJoint actions
- `src/store/toolStore.ts` — createTool 添加 JointTool case
- `src/renderer/CanvasRenderer.ts` — renderJoint（编辑模式+仿真模式）
- `src/components/Canvas.tsx` — Joint 渲染调用 + hitTest
- `src/components/panels/PropertyPanel.tsx` — 约束属性面板
- `src/components/Toolbar.tsx` — JointTool 按钮

## Planck.js Joint API 分析

### 可用 Joint 类型映射

| 约束类型 | Planck.js Joint | 关键参数 | 物理行为 |
|---------|----------------|---------|---------|
| 绳 rope | `RopeJoint` | maxLength, localAnchorA/B | 最大距离约束，无弹性 |
| 杆 rod | `DistanceJoint`（frequencyHz=0） | length, localAnchorA/B | 固定距离，刚性 |
| 弹簧 spring | `DistanceJoint`（frequencyHz>0） | length, frequencyHz, dampingRatio | 弹性距离约束 |
| 滑轮绳 pulley | `PulleyJoint` | groundA/B, anchorA/B, ratio | 绳绕定滑轮，lengthA + ratio*lengthB = const |

**设计决策**：
- **绳**用 `RopeJoint`：仅限制最大距离，松弛时无力，符合绳的物理语义
- **杆**用 `DistanceJoint(frequencyHz=0)`：严格固定距离，刚性约束
- **弹簧**用 `DistanceJoint(frequencyHz>0)`：弹性连接，可振动
- **滑轮绳**用 `PulleyJoint`：原生滑轮约束，绳总长守恒，配合已有 pulley-mount 物体

### Planck.js Joint 创建范式
```typescript
// RopeJoint
world.createJoint(new RopeJoint({ maxLength: 2.0 }, bodyA, bodyB, anchorA, anchorB))

// DistanceJoint（刚性杆）
world.createJoint(new DistanceJoint({ length: 2.0, frequencyHz: 0 }, bodyA, bodyB, anchorA, anchorB))

// DistanceJoint（弹簧）
world.createJoint(new DistanceJoint({ length: 1.5, frequencyHz: 4.0, dampingRatio: 0.5 }, bodyA, bodyB, anchorA, anchorB))

// PulleyJoint（滑轮绳）
world.createJoint(new PulleyJoint(
  { ratio: 1.0 },
  bodyA, bodyB,
  groundA,   // 滑轮A侧固定点（世界坐标，取 pulley-mount 顶部）
  groundB,   // 滑轮B侧固定点（同一滑轮则与 groundA 相同）
  anchorA,   // 物块A连接点
  anchorB,   // 物块B连接点
  ratio,     // 传动比（定滑轮=1）
))
```

**注意**：anchorA/anchorB 是世界坐标，Planck.js 内部转为 localAnchor。
**注意**：PulleyJoint 的 groundA/groundB 是滑轮固定点（世界坐标），对应 pulley-mount 物体的顶部位置。

## 接口设计

### SceneJoint（扩展后）

```typescript
export type JointType = 'rope' | 'rod' | 'spring' | 'pulley'

export interface SceneJoint {
  id: string
  type: JointType
  label: string
  bodyIdA: string          // 连接的物体A
  bodyIdB: string          // 连接的物体B
  anchorA: { x: number; y: number }  // 物体A上的锚点（局部坐标）
  anchorB: { x: number; y: number }  // 物体B上的锚点（局部坐标）
  // Rope 属性
  maxLength?: number       // 绳最大长度 (m)
  // Rod 属性
  length?: number          // 杆固定长度 (m)
  // Spring 属性
  springLength?: number    // 弹簧自然长度 (m)
  stiffness?: number       // 刚度 frequencyHz (Hz)
  damping?: number         // 阻尼比 (0-1)
  // Pulley 属性
  pulleyMountId?: string   // 滑轮座物体 ID
  ratio?: number           // 传动比（定滑轮=1，默认1）
}
```

### JointTypeDescriptor

```typescript
export interface JointTypeDescriptor {
  type: JointType
  label: string              // 显示名称（如 "绳"、"杆"、"弹簧"）
  icon: string               // 面板图标
  category: 'constraint'     // 分类

  // 默认属性
  defaults: Partial<SceneJoint>

  // 渲染
  renderEdit(
    ctx: CanvasRenderingContext2D,
    joint: SceneJoint,
    bodyA: SceneBody,
    bodyB: SceneBody,
    isSelected: boolean,
    isHovered: boolean,
    scale: number,
  ): void

  renderSim(
    ctx: CanvasRenderingContext2D,
    jointState: JointState,
    scale: number,
  ): void

  // hitTest：点击检测（判断点是否在约束连线附近）
  hitTest(
    worldPos: { x: number; y: number },
    joint: SceneJoint,
    bodyA: SceneBody,
    bodyB: SceneBody,
    threshold: number,
  ): boolean

  // 属性面板
  properties: JointPropertyDef[]

  // 转换为引擎配置
  toJointConfig(joint: SceneJoint): JointConfig
}

export interface JointPropertyDef {
  key: string
  label: string
  type: 'number' | 'select'
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: Array<{ value: string; label: string }>
}
```

### JointConfig / JointState（引擎层）

```typescript
// src/engine/types.ts 新增

export type JointConfigType = 'rope' | 'distance' | 'pulley'

export interface JointConfig {
  id: string
  type: JointConfigType
  bodyIdA: string
  bodyIdB: string
  anchorA: { x: number; y: number }  // 世界坐标
  anchorB: { x: number; y: number }  // 世界坐标
  // RopeJoint
  maxLength?: number
  // DistanceJoint
  length?: number
  frequencyHz?: number
  dampingRatio?: number
  // PulleyJoint
  groundA?: { x: number; y: number }  // 滑轮A侧固定点（世界坐标）
  groundB?: { x: number; y: number }  // 滑轮B侧固定点（世界坐标）
  ratio?: number                       // 传动比
}

export interface JointState {
  id: string
  type: JointConfigType
  anchorA: { x: number; y: number }  // 世界坐标（仿真时更新）
  anchorB: { x: number; y: number }  // 世界坐标
  groundA?: { x: number; y: number } // 滑轮固定点（pulley 用）
  groundB?: { x: number; y: number }
  reactionForce?: { x: number; y: number }  // 预留：阶段6力收集用
}
```

## JointTool 交互流程

### 状态机

**绳/杆/弹簧（两体约束）**：
```
IDLE → (点击物体A) → PICKING_B → (点击物体B) → 创建Joint → 切回SelectTool
                                  ↓
                              (按ESC/右键) → 取消 → IDLE
```

**滑轮绳（三体约束）**：
```
IDLE → (点击物体A) → PICKING_PULLEY → (点击滑轮座) → PICKING_B → (点击物体B) → 创建Joint → 切回SelectTool
                                        ↓                          ↓
                                    (按ESC/右键)              (按ESC/右键)
                                        ↓                          ↓
                                    取消 → IDLE               取消 → IDLE
```

### 交互细节

**通用流程（绳/杆/弹簧）**：
1. **选择 JointTool**：工具栏点击约束按钮，展开子菜单选择约束类型（绳/杆/弹簧/滑轮绳）
2. **IDLE 状态**：鼠标在物体上 hover 时高亮提示"点击选择第一个物体"
3. **点击物体A**：
   - 记录 bodyIdA
   - 锚点默认为物体中心（position）
   - 物体A 高亮（蓝色描边）
   - 状态变为 PICKING_B
4. **PICKING_B 状态**：
   - 鼠标到物体A之间画一条预览线（虚线）
   - hover 其他物体时高亮提示
   - 不允许选同一个物体
5. **点击物体B**：
   - 自动计算两锚点间距离作为默认长度
   - 创建 SceneJoint，执行 AddJointCommand
   - 自动切回 SelectTool，选中新创建的约束
6. **取消**：ESC 键或右键 → 回到 IDLE，清除高亮

**滑轮绳专用流程**：
1. **点击物体A**（同上）→ 状态变为 PICKING_PULLEY
2. **PICKING_PULLEY 状态**：
   - 提示"点击滑轮座"
   - 仅允许点击 `pulley-mount` 类型物体，其他物体点击无效
   - 预览线：物体A → 鼠标位置（虚线）
3. **点击滑轮座**：
   - 记录 pulleyMountId
   - 滑轮座高亮
   - 状态变为 PICKING_B
4. **PICKING_B 状态**：
   - 预览线：物体A → 滑轮顶部 → 鼠标位置（折线虚线）
   - 仅允许点击非 pulley-mount 且非物体A 的物体
5. **点击物体B**：
   - groundA = groundB = 滑轮座顶部世界坐标
   - 默认 ratio = 1（定滑轮）
   - 创建 SceneJoint，执行 AddJointCommand

### 锚点策略

- 默认锚点：物体中心（localAnchor = {0, 0}）
- 滑轮固定点：pulley-mount 的顶部（position.y + pulleyRadius）
- 后续可扩展：点击物体时记录具体点击位置作为锚点

## 约束渲染

### 编辑模式渲染

| 约束类型 | 渲染方式 | 颜色 | 选中态 |
|---------|---------|------|-------|
| 绳 | 直线，lineWidth=1.5 | 深灰 `#555` | 蓝色 `#3b82f6` |
| 杆 | 粗直线，lineWidth=3 | 深灰 `#333` | 蓝色 |
| 弹簧 | 锯齿线（zigzag） | 深灰 `#555` | 蓝色 |
| 滑轮绳 | A→滑轮顶→B 折线，lineWidth=1.5 | 深灰 `#555` | 蓝色 |

锯齿线渲染算法：
1. 计算 A→B 方向向量和垂直向量
2. 沿 A→B 方向均匀分 N 段（N = length * coilsPerMeter，约10段/米）
3. 奇数段沿垂直方向偏移 +amplitude，偶数段偏移 -amplitude
4. amplitude = 0.08m（固定，不随弹簧长度变化）

### 仿真模式渲染

仿真时从 `JointState.anchorA/B` 读取实时世界坐标，渲染方式同编辑模式。

### 锚点标记

在锚点位置画小圆点（半径 3px），编辑模式可见，仿真模式可选。

## 约束 hitTest

点到线段距离 < threshold（5px / scale）则命中。滑轮绳检测两段线段（A→滑轮顶、滑轮顶→B），任一命中即选中。

```typescript
function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  // 标准点到线段距离算法
}
```

## 任务拆分（逐类型串行）

策略：先搭框架，用"绳"跑通全链路，再逐个追加约束类型。每个子阶段独立验收。

```
5.1 基础设施（框架搭建，无具体约束）
 → 5.2 绳 rope（第一个约束，跑通全链路）
  → 5.3 杆 rod（复用链路，换 Joint + 渲染）
   → 5.4 弹簧 spring（加锯齿线渲染）
    → 5.5 滑轮绳 pulley（三步交互 + 折线渲染）
```

---

### 5.1 基础设施 ✅ 已完成

**目标**：搭建约束系统的全部框架代码，但不注册任何具体约束类型。5.2 开始填充第一个约束。

**任务**：
1. 扩展 `SceneJoint` 接口 + `JointType` 类型
2. 新增 `JointConfig` / `JointState` 到引擎类型
3. 扩展 `sceneStore`：addJoint / removeJoint / updateJoint
4. 新增 Command：AddJointCommand / RemoveJointCommand / ChangeJointPropertyCommand
5. 定义 `JointTypeDescriptor` 接口 + `jointRegistry` 注册表（空）
6. PhysicsBridge 扩展：addJoint / removeJoint / getJointStates 框架
7. sceneSync 扩展：syncJointAdd / syncJointRemove / syncSceneToWorld 加入 Joint 同步
8. JointTool 框架：IDLE → PICKING_B 状态机骨架 + toolStore 集成
9. CanvasRenderer 扩展：renderJoints / renderSimJoints 调用入口（委托给 descriptor）
10. Canvas.tsx 集成 Joint 渲染调用
11. PropertyPanel 扩展：选中 joint 时从 descriptor 读取属性渲染
12. Toolbar 扩展：JointTool 按钮（约束类型子选择 UI）
13. SelectTool 扩展：joint hitTest 集成（委托给 descriptor.hitTest）
14. Delete 键删除约束

**涉及文件**：
- `src/models/types.ts` — SceneJoint 扩展 + JointType
- `src/engine/types.ts` — JointConfig + JointState
- `src/store/sceneStore.ts` — addJoint / removeJoint / updateJoint
- `src/core/commands/AddJointCommand.ts` — 新建
- `src/core/commands/RemoveJointCommand.ts` — 新建
- `src/core/commands/ChangeJointPropertyCommand.ts` — 新建
- `src/models/jointTypes/descriptor.ts` — JointTypeDescriptor 接口（新建）
- `src/models/jointTypes/registry.ts` — jointRegistry（新建）
- `src/models/jointTypes/index.ts` — 导出（新建）
- `src/engine/PhysicsBridge.ts` — addJoint / removeJoint / getJointStates
- `src/engine/sceneSync.ts` — syncJointAdd / syncJointRemove
- `src/core/tools/JointTool.ts` — 新建（框架）
- `src/store/toolStore.ts` — createTool 添加 JointTool case
- `src/renderer/CanvasRenderer.ts` — renderJoints 入口
- `src/core/hitTest.ts` — hitTestJoints
- `src/components/Canvas.tsx` — Joint 渲染调用 + 事件
- `src/components/panels/PropertyPanel.tsx` — joint 属性分支
- `src/components/Toolbar.tsx` — JointTool 按钮
- `src/core/tools/SelectTool.ts` — joint hitTest

**验收标准**：
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 框架代码编译无错，但因无注册约束类型，功能暂不可用
- [x] JointTool 可从工具栏切换激活（光标变化）
- [x] jointRegistry 为空，调用 getJointDescriptor 返回 undefined

---

### 5.2 绳约束 rope ✅ 已完成

**目标**：实现第一个约束类型——绳，**跑通全链路**：创建→渲染→仿真→选中→编辑→删除→撤销。

**已完成**：
1. `rope.tsx` descriptor（renderEdit/renderSim/hitTest/properties/toJointConfig）
2. PhysicsBridge.addJoint RopeJoint 分支（RopeJointDef + localAnchor）
3. 松弛渲染（贝塞尔下垂曲线，sag=√(L²-d²)/2）
4. 编辑模式绳约束拖拽（static端钳制，dynamic端联动）
5. 改绳长自动调整物体位置

**修复的 5.1 遗留问题**：descriptor 接口 scale→Viewport、JointTool 导入缺失、anchor defaults 缺 isStatic、RopeJoint API 误用、getJointStates 坐标混淆、Canvas 渲染链路闭包问题

**验收标准**：
- [x] 用 JointTool 选"绳" → 点击锚点 → 点击物块 → 绳创建成功
- [x] 仿真模式：物块挂在锚点下方，像单摆摆动，绳线跟随运动
- [x] 点击绳线可选中，属性面板显示绳长可编辑
- [x] Delete 删除绳，Ctrl+Z 撤销创建/删除
- [x] 松弛渲染 + 拖拽约束 + 绳长联动
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

---

### 5.3 杆约束 rod ⏱️ 半天

**目标**：新增杆约束，复用全链路框架，仅新增 descriptor + 引擎分支。

**任务**：
1. 实现 `rod.tsx` descriptor：
   - renderEdit：粗直线 lineWidth=3，深灰 `#333`
   - renderSim：从 JointState 读取实时锚点
   - hitTest：同绳（点到线段距离）
   - properties：length（固定长度）
   - toJointConfig：转为 DistanceJoint(frequencyHz=0) 配置
   - defaults：length = 两锚点间距
2. PhysicsBridge.addJoint 实现 DistanceJoint 创建分支
3. 在 index.ts 注册 rod descriptor

**涉及文件**：
- `src/models/jointTypes/rod.tsx` — 新建
- `src/models/jointTypes/index.ts` — 添加 rod import
- `src/engine/PhysicsBridge.ts` — addJoint 实现 DistanceJoint 分支

**验收标准**：
- [ ] 用 JointTool 选"杆" → 连接两物体 → 粗直线显示
- [ ] 仿真模式：两物体保持固定距离
- [ ] 选中杆，属性面板显示 length 可编辑
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

### 5.4 弹簧约束 spring ⏱️ 半天

**目标**：新增弹簧约束，重点是锯齿线渲染算法。

**任务**：
1. 实现 `spring.tsx` descriptor：
   - renderEdit：锯齿线（zigzag），深灰 `#555`
     - 算法：沿 A→B 方向分 N 段，奇偶段交替偏移 ±amplitude
     - N = length * 10（10段/米），amplitude = 0.08m
   - renderSim：从 JointState 读取实时锚点渲染锯齿线
   - hitTest：同绳（点到线段距离，用 A→B 直线段判断）
   - properties：springLength（自然长度）、stiffness（刚度 Hz）、damping（阻尼比）
   - toJointConfig：转为 DistanceJoint(frequencyHz=stiffness, dampingRatio=damping) 配置
2. 在 index.ts 注册 spring descriptor
3. PhysicsBridge.addJoint 的 DistanceJoint 分支已在 5.3 实现，此处复用（通过 frequencyHz 区分刚性/弹性）

**涉及文件**：
- `src/models/jointTypes/spring.tsx` — 新建
- `src/models/jointTypes/index.ts` — 添加 spring import

**验收标准**：
- [ ] 用 JointTool 选"弹簧" → 连接两物体 → 锯齿线显示
- [ ] 仿真模式：弹簧振动，锯齿线跟随伸缩
- [ ] 选中弹簧，属性面板显示 springLength / stiffness / damping 可编辑
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

### 5.5 滑轮绳约束 pulley ⏱️ 1天

**目标**：新增滑轮绳约束，重点是三步交互流程和折线渲染。

**任务**：
1. 实现 `pulley.tsx` descriptor：
   - renderEdit：A→滑轮顶→B 折线 lineWidth=1.5，深灰 `#555`
     - 需从 sceneStore 查询 pulleyMountId 对应物体位置计算滑轮顶部坐标
   - renderSim：从 JointState.groundA 读取滑轮顶部实时坐标 + anchorA/B 渲染折线
   - hitTest：两段线段（A→滑轮顶、滑轮顶→B），任一命中即选中
   - properties：ratio（传动比，默认1）
   - toJointConfig：转为 PulleyJoint 配置（groundA=groundB=滑轮顶部世界坐标）
2. PhysicsBridge.addJoint 实现 PulleyJoint 创建分支
3. JointTool 扩展：pulley 模式三步交互
   - IDLE → 点击物体A → PICKING_PULLEY
   - PICKING_PULLEY → 仅允许点击 pulley-mount → PICKING_B
   - PICKING_B → 点击物体B → 创建 Joint
   - render 方法：PICKING_PULLEY 时画 A→鼠标虚线，PICKING_B 时画 A→滑轮顶→鼠标折线虚线
4. 在 index.ts 注册 pulley descriptor

**涉及文件**：
- `src/models/jointTypes/pulley.tsx` — 新建
- `src/models/jointTypes/index.ts` — 添加 pulley import
- `src/engine/PhysicsBridge.ts` — addJoint 实现 PulleyJoint 分支
- `src/core/tools/JointTool.ts` — PICKING_PULLEY 状态 + 三步交互

**验收标准**：
- [ ] 用 JointTool 选"滑轮绳" → 点击物块A → 点击滑轮座 → 点击物块B → 折线显示
- [ ] 仿真模式：Atwood 机效果，重物下沉轻物上升，折线跟随运动
- [ ] PICKING_PULLEY 状态只能点击 pulley-mount，点其他物体无效
- [ ] 选中滑轮绳，属性面板显示 ratio 可编辑
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 执行顺序

```
5.1 基础设施（1天）
 → 5.2 绳 rope — 跑通全链路（1天）
  → 5.3 杆 rod — 复用框架（半天）
   → 5.4 弹簧 spring — 锯齿线渲染（半天）
    → 5.5 滑轮绳 pulley — 三步交互（1天）
```

总计：约 4 天

每个子阶段完成后执行门禁：`pnpm lint && pnpm tsc --noEmit`

## 总验收标准

- [ ] 用 JointTool 在两个物体间创建绳/杆/弹簧
- [ ] 绳约束：物块挂在锚点下方，仿真时像单摆摆动
- [ ] 杆约束：两物体保持固定距离
- [ ] 弹簧约束：仿真时弹簧振动，渲染为锯齿线
- [ ] 滑轮绳约束：物块A → 滑轮座 → 物块B，仿真时 Atwood 机效果（重的下沉轻的上升）
- [ ] 滑轮绳渲染为 A→滑轮顶→B 折线
- [ ] 可选中约束，属性面板显示并可编辑参数
- [ ] 删除约束（选中后 Delete 键）
- [ ] Ctrl+Z 撤销创建/删除约束
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 绳的 Joint 类型 | RopeJoint | 仅限制最大距离，松弛时无力，符合物理语义 |
| 杆的 Joint 类型 | DistanceJoint(freq=0) | 刚性固定距离，比 WeldJoint 更适合（不锁角度） |
| 弹簧的 Joint 类型 | DistanceJoint(freq>0) | 同一类型不同参数，弹性连接 |
| 滑轮绳的 Joint 类型 | PulleyJoint | Planck.js 原生支持，绳总长守恒 |
| 滑轮绳范围 | 仅单滑轮（定滑轮） | 完整滑轮组（多轮多绳段）涉及绳路由渲染和动滑轮随动，复杂度高，放在 MVP 后 |
| 默认锚点 | 物体中心 | 探索了表面连接（朝向对方/固定顶部/混合），均有场景局限性，暂保持中心，待用户反馈驱动 |
| 绳碰撞 | 暂不实现 | 需链式模拟（多段刚体串联），复杂度高，教学演示可接受穿透 |
| Registry 模式 | 复用 bodyTypes 模式 | architecture.md 明确建议约束系统复用此模式 |
| 约束渲染层级 | 物体之下 | 约束线不遮挡物体，在物体渲染之前绘制 |
