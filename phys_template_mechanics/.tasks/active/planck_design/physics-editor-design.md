# 物理编辑器架构设计

---

## 一、产品定位

为中国初高中物理教师构建的 **2D 物理编辑器**，所属 EduMind AI 互动课件平台 · 物理学科教具。

**核心使用流程**：
1. 从物体面板拖出物体到画布（或加载预设配置）
2. 选中物体，设置属性（质量、摩擦系数、初速度等）
3. 建立关系（绳/杆/弹簧/滑轮等约束）
4. 设置外力（大小、方向）
5. 点击"播放"，观看实时物理仿真
6. 切换视角（受力/运动/能量/动量），叠加教学信息

**目标设备**：1920×1080 投影仪为主，兼容 1280×720 和 iPad，全部 2D。

---

## 二、技术栈

| 层       | 技术                  | 说明                                                                                                      |
| -------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| 物理引擎 | **Planck.js v1.4.x**  | Box2D 的 JS/TS 移植，原生丰富约束（Revolute/Pulley/Rope/Prismatic/Gear/Weld），纯 JS 无 WASM，周下载 104K |
| UI 框架  | React 18 + TypeScript |                                                                                                           |
| 渲染     | Canvas 2D（原生 API） |                                                                                                           |
| 状态管理 | Zustand（待定）       |                                                                                                           |
| 构建     | Vite + pnpm           |                                                                                                           |

---

## 三、画布交互设计

### 3.1 编辑模式 vs 仿真模式

|           | 编辑模式（Edit）             | 仿真模式（Simulate）                   |
| --------- | ---------------------------- | -------------------------------------- |
| 触发      | 默认状态 / 点击"停止"        | 点击"播放"                             |
| 画布行为  | 可选中、拖拽、添加、删除物体 | 只读，物理引擎驱动，物体按物理规律运动 |
| 物体交互  | 选中→属性面板编辑            | 仅观看，不可交互                       |
| Undo/Redo | ✅ 可用                       | ❌ 不可用                               |
| 参数修改  | ✅ 自由修改                   | ❌ 不可修改                             |
| 视角切换  | ✅ 可切换                     | ✅ 可切换（仅改变显示，不改物理）       |
| 播放控制  | —                            | 播放 / 暂停 / 停止（停止=回到编辑态）  |

### 3.2 选中系统（Selection）

初版只支持**单选**（教学场景物体少，2-5 个，单选足够）。架构预留 `selected: SelectableObject[]` 数组，后续扩展多选只需改交互逻辑。

支持选中三类对象：

| 选中对象          | 触发方式                       | 选中后行为                                 |
| ----------------- | ------------------------------ | ------------------------------------------ |
| **物体（Body）**  | 点击画布上的物体               | 右侧属性面板显示该物体属性                 |
| **关系（Joint）** | 点击连接线/约束标记            | 右侧面板显示关系类型+参数                  |
| **力（Force）**   | 点击力箭头（仅受力视角下可见） | 右侧面板显示力属性（大小、方向、是否分解） |

- 点击空白区域 / ESC 取消选中

### 3.3 拖拽放置物体

1. 用户从左侧物体面板拖出缩略图
2. 拖到画布上松手
3. 系统创建对应的 Planck.js Body
4. **碰撞处理**：如果放置位置与已有物体重叠，自动推开到最近无重叠位置
5. **重力响应**：如果放在空中，物体自由下落直到碰到地面/其他物体（编辑模式下也有重力，让摆放更直觉）

### 3.4 物体角度处理

| 物体类型                         | 角度策略                                     | Planck.js 实现        |
| -------------------------------- | -------------------------------------------- | --------------------- |
| **静态体**（地面、斜面、墙壁等） | 用户在编辑模式设置角度，仿真时不变           | `type: 'static'`      |
| **动态体**（物块、球）           | 仿真时自由旋转                               | 默认行为              |
| **动态体但锁定旋转**             | 仿真时平移但不旋转（如物块沿斜面下滑不翻滚） | `fixedRotation: true` |

- 停止仿真回到编辑态，角度恢复到编辑时的值（仿真不修改编辑态数据）

### 3.5 画布基础设施

- 画布平移：鼠标中键拖拽 / 空格+拖拽
- 画布缩放：滚轮
- 网格参考线（可选显示）
- 默认场景：地面（一条水平静态边界）

---

## 四、架构设计

### 4.1 核心分层

```
┌─────────────────────────────────────────────┐
│  UI 层（React）                              │
│  - 物体面板 / 属性面板 / 工具栏 / 视角切换   │
├─────────────────────────────────────────────┤
│  编辑器核心（Editor Core）                    │
│  - Tool / Selection / Command(Undo/Redo)    │
│  - 拖拽放置 / 属性编辑 / 关系管理            │
├─────────────────────────────────────────────┤
│  场景模型（Scene Model）                      │
│  - 物体定义 / 关系定义 / 力定义              │
│  - 预设配置加载 / 场景序列化                  │
├─────────────────────────────────────────────┤
│  物理引擎桥接层（Physics Bridge）             │
│  - Scene Model ↔ Planck.js World 双向同步    │
│  - 编辑模式：Model → World（单向）           │
│  - 仿真模式：World → Model（每帧同步状态）   │
├─────────────────────────────────────────────┤
│  Planck.js（物理仿真）                        │
│  - World / Body / Joint / Contact            │
├─────────────────────────────────────────────┤
│  渲染层（Canvas Renderer）                    │
│  - 物体渲染 / 连接件渲染                     │
│  - 教学叠加层（力箭头/速度/轨迹/能量条）     │
│  - 选中高亮 / 拖拽预览 / 网格                │
└─────────────────────────────────────────────┘
```

### 4.2 场景模型（Scene Model）

场景模型是**独立于物理引擎的**数据描述层，是编辑器的"真相源"：

```typescript
interface Scene {
  id: string;
  name: string;
  bodies: SceneBody[];
  joints: SceneJoint[];
  forces: SceneForce[];
  settings: SceneSettings;       // 全局设置（重力方向/大小等）
}

interface SceneBody {
  id: string;
  type: BodyType;                // 'block' | 'ball' | 'surface' | 'slope' | ...
  position: Vec2;
  angle: number;
  properties: BodyProperties;    // 质量、摩擦系数、弹性系数等（按类型不同）
  initialVelocity?: Vec2;
  isStatic: boolean;
  fixedRotation?: boolean;
}

interface SceneJoint {
  id: string;
  type: JointType;               // 'rope' | 'rod' | 'spring' | 'hinge' | 'pulley' | ...
  bodyA: string;                 // body id
  bodyB: string;                 // body id
  anchorA?: Vec2;                // 连接点（相对于 bodyA）
  anchorB?: Vec2;
  properties: JointProperties;   // 绳长、弹簧刚度、阻尼等
}

interface SceneForce {
  id: string;
  targetBody: string;            // body id
  type: ForceType;               // 'external' | 'gravity' | 'friction' | ...
  magnitude: number;
  direction: number;             // 角度（弧度）
  applicationPoint?: Vec2;
  decompose?: boolean;           // 是否显示分解
  isUserDefined: boolean;        // 用户主动施加 vs 系统自动计算
}
```

### 4.3 编辑器核心（Editor Core）

#### Tool 系统

用 State 模式实现，编辑器同一时刻只有一个活跃 Tool：

```typescript
interface Tool {
  name: string;
  onMouseDown(e: CanvasMouseEvent): void;
  onMouseMove(e: CanvasMouseEvent): void;
  onMouseUp(e: CanvasMouseEvent): void;
  onKeyDown(e: KeyboardEvent): void;
  render(ctx: CanvasRenderingContext2D): void;  // 工具自身的视觉反馈
}
```

| Tool                   | 快捷键 | 行为                                 |
| ---------------------- | ------ | ------------------------------------ |
| **SelectTool**（默认） | V      | 点击选中物体/关系/力，拖拽移动物体   |
| **JointTool**          | J      | 点击物体A → 点击物体B → 创建关系     |
| **ForceTool**          | F      | 点击物体 → 拖拽方向和长度 → 创建外力 |

> 物体创建不需要 Tool——从面板拖入画布是 drag-and-drop，不走 Tool 系统。

#### 跨层通信

采用**单向数据流 + 事件通知**：

```
UI 层 → Editor Core：用户操作 → 调用 Command
Editor Core → Scene Model：Command.execute() 修改 Scene Model
Scene Model → Physics Bridge：Model 变更 → Bridge 同步到 Planck.js World
Physics Bridge → 渲染层：每帧提供物体位置/角度/力信息
渲染层 → UI 层：Canvas 点击事件 → hitTest → 通知 Selection 变更
```

实现方式：
- **Scene Model 变更通知**：Zustand store，Model 变更时 React 自动响应
- **Physics Bridge**：订阅 Model 变更，同步 World；仿真时每帧推送状态
- **渲染层**：每帧从 Bridge 读取最新状态（pull 模式）

#### Command 系统（Undo/Redo）

```typescript
interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

// 示例命令
class AddBodyCommand implements Command { ... }
class RemoveBodyCommand implements Command { ... }
class MoveBodyCommand implements Command { ... }
class ChangePropertyCommand implements Command { ... }
class AddJointCommand implements Command { ... }
class RemoveJointCommand implements Command { ... }
class AddForceCommand implements Command { ... }
```

#### Selection 系统

```typescript
type SelectableObject =
  | { type: 'body'; id: string }
  | { type: 'joint'; id: string }
  | { type: 'force'; id: string };

interface SelectionState {
  selected: SelectableObject[];
  hovered: SelectableObject | null;
}
```

### 4.4 物理引擎桥接层（Physics Bridge）

```
编辑模式：
  用户修改 Scene Model → Bridge 重建/更新 Planck.js World
  （单向：Model → World）

仿真模式：
  每帧 world.step() → Bridge 读取 Body 状态 → 更新运行时状态副本
  （单向：World → 运行时副本，不修改编辑态数据）

停止仿真：
  丢弃运行时状态，恢复到编辑态的 Scene Model
```

### 4.5 渲染层

分三层渲染（从下到上）：

1. **背景层**：网格线、坐标轴（可选）
2. **物体层**：根据 Scene Model + 物理引擎状态，画物体/连接件
3. **教学叠加层**：力箭头、速度矢量、轨迹、能量条、临界状态提示

---

## 五、物体类型体系

### 5.1 物体分类

```
物体（Body）
├── 自由体（Dynamic）
│   ├── 矩形物块（block）     — 最常用，默认物体
│   ├── 球体（ball）           — 圆形，有滚动
│   └── 杆件（bar）            — 细长矩形，杠杆/杆模型
│
├── 固定体（Static）
│   ├── 地面（ground）         — 水平面
│   ├── 斜面（slope）          — 三角形
│   ├── 墙壁（wall）           — 竖直面
│   ├── 半球面（hemisphere）   — 圆弧（Chain 形状）
│   ├── V形槽（groove）        — 两条边组成V形
│   ├── 固定锚点（anchor）     — 墙上/天花板上的固定点，可连出绳/杆/弹簧
│   ├── 滑轮座（pulley-mount） — 固定在墙/天花板上的滑轮支架
│   └── 传送带（conveyor）     — 矩形 + 表面运动速度
│
├── 运动学体（Kinematic）
│   └── 转盘（turntable）      — 匀速旋转
│
└── 复合体（由多个 Body + Joint 组装）
    ├── 滑轮（pulley）         — 滑轮座 + PulleyJoint + 两根绳
    └── 杠杆（lever）          — 支点(anchor+RevoluteJoint) + 杆件(bar)
```

### 5.2 物体公共属性

| 属性          | 类型    | 说明                 |
| ------------- | ------- | -------------------- |
| position      | Vec2    | 位置                 |
| angle         | number  | 旋转角度             |
| mass          | number  | 质量（静态体无质量） |
| friction      | number  | 摩擦系数             |
| restitution   | number  | 弹性系数（碰撞恢复） |
| fixedRotation | boolean | 是否锁定旋转         |

### 5.3 物体特有属性

| 物体类型  | 特有属性                   |
| --------- | -------------------------- |
| block     | width, height              |
| ball      | radius                     |
| bar       | length, thickness          |
| slope     | baseLength, height         |
| conveyor  | width, beltSpeed           |
| turntable | radius, angularVelocity    |
| anchor    | mountSide (top/left/right) |

---

## 六、关系（约束）类型体系

### 6.1 Planck.js Joint 对照表

| 教学概念  | Planck.js Joint                          | 关键参数                                  |
| --------- | ---------------------------------------- | ----------------------------------------- |
| 绳        | RopeJoint + DistanceJoint                | maxLength（只拉不推）                     |
| 刚性杆    | WeldJoint 或 DistanceJoint(stiffness=高) | length                                    |
| 弹簧      | DistanceJoint(frequencyHz>0)             | stiffness, damping, naturalLength         |
| 铰链/枢轴 | RevoluteJoint                            | anchor, enableMotor, motorSpeed           |
| 滑轮      | PulleyJoint                              | groundAnchorA/B, lengthA/B, ratio         |
| 滑轨      | PrismaticJoint                           | axis, enableLimit, lowerLimit, upperLimit |
| 齿轮      | GearJoint                                | joint1, joint2, ratio                     |
| 焊接      | WeldJoint                                | referenceAngle                            |

### 6.2 关系的建立方式

采用 **JointTool 先后选中模式**：

1. 切换到 JointTool（按 J 或点击工具栏）
2. 从工具栏子选项选择关系类型（绳/杆/弹簧/滑轮等）
3. 点击物体 A（高亮，提示"选择第二个物体"）
4. 点击物体 B
5. 系统自动创建 Joint，连接 A 和 B
6. 自动切换回 SelectTool，选中新关系，属性面板显示参数

### 6.3 设计决策：绳/杆/弹簧是关系，不是物体

**绳/杆/弹簧都是关系（Joint），不是独立物体。**
- 在 Planck.js 中它们是 Joint，没有质量、没有碰撞体积
- 渲染时画连接线，视觉上像实体，物理上是约束
- 例外：如果未来需要"有质量的绳"（下垂绳），可用多段 Body + Joint 串联，但初版不做

### 6.4 接触关系是自动的

| 情况           | 实现方式                        | 用户操作               |
| -------------- | ------------------------------- | ---------------------- |
| 物块放在地面上 | Planck.js 自动碰撞检测 → 支持力 | 拖到地面附近，自动落下 |
| 物块放在斜面上 | 同上，自动产生法向力+摩擦力     | 拖到斜面上即可         |
| 物块固定在墙上 | 需手动创建 WeldJoint            | 用 JointTool 连接      |
| 物块挂在天花板 | 需手动创建绳/杆关系             | 用 JointTool 连接      |

**接触 = 自动碰撞检测，固定/连接 = 手动建 Joint。**

---

## 七、力的体系

### 7.1 力的分类

```
力（Force）
├── 系统自动力（仿真时由引擎计算，不可手动设置）
│   ├── 重力（gravity）        — world.gravity × mass
│   ├── 支持力（normal）       — 接触力的法向分量
│   ├── 摩擦力（friction）     — 接触力的切向分量
│   ├── 张力（tension）        — Joint 的反作用力
│   ├── 弹簧力（spring）       — 弹簧 Joint 的恢复力
│   └── 浮力（buoyancy）       — 自定义力（液体区域检测）
│
└── 用户主动力（可手动设置大小/方向）
    ├── 外力（external）       — 任意方向的恒力
    └── 冲量（impulse）        — 瞬间力（碰撞/爆炸）
```

### 7.2 力信息的获取方式（从 Planck.js）

| 力                      | 获取方式                                    |
| ----------------------- | ------------------------------------------- |
| 重力                    | `mass × world.gravity`（已知，直接计算）    |
| 用户外力                | 我们施加的，自己记录                        |
| 接触力（支持力+摩擦力） | `post-solve` 事件中的 `ContactImpulse` / dt |
| 约束力（张力、弹簧力）  | `Joint.getReactionForce(inv_dt)`            |

### 7.3 力的可视化

受力视角下，选中物体后属性面板显示力列表：

```
╔══════════════════════════╗
║ 物块 #1 · 受力列表       ║
╠══════════════════════════╣
║ [全部显示] [全部隐藏]    ║
╠──────────────────────────╣
║ ☑ 重力 G    19.6N  ↓    ║
║ ☑ 支持力 N  19.6N  ↑    ║
║ ☑ 摩擦力 f   5.9N  ←    ║
║ ☑ 外力 F    10.0N  →  ✎ ║  ← 可编辑
║ ☐ 合力 F合   4.1N  →    ║
╠──────────────────────────╣
║ 选中力的操作：            ║
║  [分解] [取消分解]       ║
╚══════════════════════════╝
```

- 每个力可单独开关显隐
- 主动力（外力）可编辑大小和角度
- 系统力只读
- 选中某个力可设置正交分解

---

## 八、面板设计

### 8.1 物体面板（左侧）

缩略图列表，分组显示：

```
╔══════════════════╗
║ 物体库           ║
╠══════════════════╣
║ ▼ 基础物体       ║
║  [□] 物块        ║
║  [○] 球体        ║
║  [━] 杆件        ║
╠──────────────────╣
║ ▼ 支撑面         ║
║  [▬] 地面        ║
║  [△] 斜面        ║
║  [│] 墙壁        ║
║  [⌒] 半球面      ║
║  [∨] V形槽       ║
║  [•] 固定锚点    ║
╠──────────────────╣
║ ▼ 机构           ║
║  [≈] 传送带      ║
║  [◎] 转盘        ║
║  [⊙] 滑轮        ║
║  [⚖] 杠杆        ║
╠══════════════════╣
║ ▼ 预设场景       ║
║  水平面受力      ║
║  斜面滑动        ║
║  单摆            ║
║  弹性碰撞        ║
║  ...             ║
╚══════════════════╝
```

预设 = 预组装好的 Scene 配置，加载后用户可自由修改。

### 8.2 属性面板（右侧）

根据选中对象类型动态显示对应属性。

---

## 九、视角系统

| 视角     | 叠加显示                         | 数据来源                            |
| -------- | -------------------------------- | ----------------------------------- |
| 受力分析 | 力箭头 + 标签 + 分解             | post-solve + Joint.getReactionForce |
| 运动分析 | 速度/加速度箭头 + v-t/a-t/x-t 图 | getLinearVelocity + 历史记录        |
| 能量分析 | 动能/势能/总能量柱状图           | ½mv² + mgh + ½kx²                   |
| 动量分析 | 动量矢量 + 碰撞前后对比          | m×v                                 |

---

## 十、模块覆盖能力

| 模块            | Planck.js 支持 | 实现方式                                                    |
| --------------- | -------------- | ----------------------------------------------------------- |
| P-01 受力分析   | ✅              | 碰撞+约束，力从引擎状态提取                                 |
| P-02 运动模拟   | ✅              | 引擎实时仿真，记录历史画图表                                |
| P-05 简谐运动   | ✅              | DistanceJoint(frequencyHz) = 弹簧振子，RevoluteJoint = 单摆 |
| P-09 天体运动   | ✅              | 每帧 applyForce 施加引力 F=GMm/r²                           |
| P-12 动量守恒   | ✅              | 原生碰撞 + restitution 控制弹性                             |
| P-14 机械能守恒 | ✅              | 从引擎状态计算 Ek+Ep                                        |
| P-03 光学       | ❌              | 需独立实现（射线追踪），与引擎并行共存                      |
| P-06 波动       | ❌              | 用数学公式 y=A·sin(kx-ωt) 驱动，独立于引擎                  |
| P-07 热力学     | ❌              | 分子运动模拟，独立实现                                      |

---

## 十一、历史教训（须避免）

### 架构
1. **预设不应是封闭孤岛** — 每个场景独立求解器导致 bug 多、维护成本高。用统一物理引擎
2. **不要枚举条件组合** — 条件变体用参数切换，不做独立配置

### 物理渲染
3. **力方向要用向量点乘验证垂直性** — 手算角度容易出错
4. **力箭头防重合需要多层策略** — 张力偏移、合力偏移、独立力共线偏移
5. **力标签用局部防重叠** — 不要用全局障碍物系统
6. **UI 控件要与画布比例协调** — 面板控件过大会喧宾夺主

### 开发流程
7. **依赖要实际验证** — 不要假设"已可用"
8. **并行 worktree 不能同时创建** — git config 锁竞争

---

## 十二、初版 MVP 范围

### 必须有
- [ ] Planck.js 集成 + 全局重力 + 碰撞
- [ ] Canvas 渲染（物体 + 连接件）
- [ ] 物体面板（拖拽放置）
- [ ] 属性面板（选中编辑）
- [ ] Tool 系统（Select / Joint / Force）
- [ ] Selection 系统（单选）
- [ ] Command 系统（Undo/Redo）
- [ ] 编辑/仿真模式切换
- [ ] 基础物体类型：物块、球、地面、斜面、固定锚点
- [ ] 基础关系类型：绳、杆、弹簧
- [ ] 受力分析视角（力箭头+标签+分解）
- [ ] 预设配置加载（至少 3 个演示预设）

### 暂不做
- 能量/动量视角
- 电磁域 / 光学 / 波动
- 滑轮/杠杆复合体
- 预设导入导出
- 多选/框选
- 3D

---

## 十三、开发阶段规划

| 阶段               | 内容                                             | 交付物                             |
| ------------------ | ------------------------------------------------ | ---------------------------------- |
| **S1: 引擎+画布**  | Planck.js 集成、Canvas 渲染、编辑/仿真切换       | 物块在重力下自由落体，碰到地面弹起 |
| **S2: 编辑器框架** | Tool、Selection、Command、属性面板、物体面板拖拽 | 能拖出物块到画布，选中编辑属性     |
| **S3: 物体类型**   | 实现全部基础物体类型 + 特有属性                  | 斜面、墙壁、传送带等都可创建       |
| **S4: 约束系统**   | JointTool + 全部 Joint 类型                      | 绳、杆、弹簧都能用                 |
| **S5: 力的体系**   | 力的收集/显示/分解 + 受力分析视角                | 选中物体可看到完整受力图           |
| **S6: 预设系统**   | 预设配置格式 + 加载 + 首批预设                   | 老师可加载预设场景并微调           |
| **S7: 运动视角**   | 速度/加速度箭头 + 图表 + 轨迹                    | v-t、a-t、x-t 图表                 |
| **S8: 打磨**       | 视觉风格、教学标注、性能优化                     | 可交付给老师使用的版本             |

---

## 附录 A：Planck.js 关键 API 速查

```typescript
// 创建世界
const world = new World({ gravity: Vec2(0, -9.8) });

// 创建物体
const body = world.createBody({ type: 'dynamic', position: Vec2(0, 5) });
body.createFixture({ shape: Box(0.5, 0.3), density: 1, friction: 0.3 });

// 创建关系
const joint = world.createJoint(RevoluteJoint({}, bodyA, bodyB, anchor));

// 仿真步进
world.step(1/60);

// 获取状态
body.getPosition();        // Vec2
body.getAngle();           // number
body.getLinearVelocity();  // Vec2
body.getMass();             // number

// 施加力
body.applyForce(Vec2(10, 0), body.getWorldCenter());
body.applyLinearImpulse(Vec2(5, 0), body.getWorldCenter());

// 获取约束力
joint.getReactionForce(1/dt);  // Vec2

// 碰撞事件
world.on('begin-contact', (contact) => { ... });
world.on('post-solve', (contact, impulse) => { ... });
```

## 附录 B：待深入设计的问题

1. **浮力实现**：Planck.js 无原生浮力——检测物体是否在液体区域内，计算浸没体积，施加向上的力
2. **传送带实现**：在 pre-solve 中修改接触的切线速度
3. **电磁力**：每帧计算 F=qE 和 F=qv×B，然后 applyForce（开发者B负责）
4. **受力分析精度**：post-solve 给的是冲量，需除以 dt 转换，可能有数值噪声需滤波
5. **确定性回放**：固定时间步 + 相同初始条件 = 相同结果，可用于"倒带重放"
6. **序列化格式**：Scene Model 的 JSON 格式需详细设计，要支持版本迁移
