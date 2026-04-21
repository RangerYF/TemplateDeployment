# 阶段7：连接体 + 弹簧体系

> 任务ID：03-20-18-00-P01-stage7-connected-body-spring
> 风险等级：L2（高风险 — 新增实体类型、多物体耦合求解、公共代码可能需扩展）
> 流程路径：MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**待启动**
> 前置依赖：阶段6 场景统一化整改（已完成 ✅）

## 目标

新增 `spring`（弹簧）实体，实现连接体和弹簧两类受力分析场景（共 5 个预设）。按阶段6确立的统一场景模式设计，每类模型内的条件变体合并为统一场景，不同拓扑用独立预设 + group 分组。

## 需求文档分析

### 产品需求文档入口

需求文档模型选择菜单中有两个独立入口：

| 入口 | 说明 | 对应模型数据 |
|------|------|-------------|
| **连接体模型** | "两物体通过绳子/弹簧相连" | FM-031、FM-032 |
| **弹簧模型** | "弹簧悬挂物体" | FM-051、FM-033 |

### 模型数据文档定义

**FM-031 绳连水平面两物体**：
- 参数：m₁(2.0kg, 0.1~50), m₂(3.0kg, 0.1~50), F(10N, 0~500), μ(0.2, 0~1.0)
- 整体法：a = (F - μ(m₁+m₂)g) / (m₁+m₂)
- 隔离法：T = m₂a + μm₂g

**FM-032 绳连斜面-悬挂**：
- 参数：m₁(2.0kg, 斜面物体), m₂(3.0kg, 悬挂物体), θ(30°, 5~85), μ(0.2, 0~1.0)
- 斜面上物体经轻绳、定滑轮连悬挂物体

**FM-033 弹簧连接两物体**：
- 参数：k(100 N/m, 10~1000)
- 弹簧连接两物体，水平面上，系统受力与弹簧形变量相关

**FM-051 弹簧模型（单物体）**：
- 参数：k(100 N/m, 10~1000), m(1.0kg, 0.1~20), 方向(竖直悬挂/水平)
- 竖直悬挂平衡：kx₀ = mg → x₀ = mg/k

### 预设划分决策

按预设划分教训（同拓扑合并、不同拓扑分组）：

**连接体模型（group: "connected-body"）**：
- FM-031 → 独立预设「绳连水平面」（block×2 + surface + rope）
- FM-032 → 独立预设「绳连斜面-悬挂」（block×2 + slope + rope×2 + pivot）

**弹簧模型（group: "spring-model"）**：
- FM-051 竖直 → 独立预设「竖直弹簧」（pivot + spring + block）
- FM-051 水平 → 独立预设「水平弹簧连墙壁」（pivot-wall + spring + block + surface）
- FM-033 → 独立预设「水平弹簧连两物体」（block×2 + spring + surface）

### 整体法 / 隔离法交互

需求文档中 FM-031 明确提到整体法和隔离法。交互方案：

- 参数面板中增加 `analysisMethod` select 参数：「整体法 / 隔离法」
- **整体法**：将两物体视为整体，只显示外部力（F、总摩擦力、总重力、总法力），隐藏内力（绳张力 / 弹簧弹力）
- **隔离法**：分别显示每个物体的受力（含绳张力 T / 弹簧弹力 F弹），两个物体的力分析独立展示
- 求解器始终计算所有力（包括内力），由 `analysisMethod` 参数控制 force-viewport 显示哪些力

---

## 新增实体

### spring（弹簧）

- **类别**：`connector`（与 rope/rod 同类）
- **属性**：
  - `stiffness`（k，劲度系数，N/m）
  - `naturalLength`（自然长度，m）
  - `pivotEntityId` / `entityAId`（一端实体ID，根据场景不同）
  - `blockEntityId` / `entityBId`（另一端实体ID）
- **渲染**：锯齿波形（zigzag），拉伸/压缩时视觉长度跟随端点变化
- **hitTest**：线段碰撞检测（与 rope 类似）

### pivot 扩展

- 新增可选属性 `style: "pulley"`（FM-032 定滑轮，渲染为圆环而非三角标记）
- 新增可选属性 `orientation: "left" | "right" | "top"`（控制墙壁方向，默认 "top"）

---

## 预设详细设计

### 预设1：绳连水平面两物体（FM-031）

**预设 ID**：`P01-FM031-rope-connected-horizontal`
**group**：`connected-body`，groupLabel：`连接体模型`，groupOrder：`1`

```
  F → [A]——rope——[B]
  ______________________
        surface
```

#### 实体

| ref | type | properties | 说明 |
|-----|------|-----------|------|
| `surface` | `surface` | `length: 6` | 水平面 |
| `block-A` | `block` | `mass: 2, width: 0.5, height: 0.5` | 左侧物块（受外力） |
| `block-B` | `block` | `mass: 3, width: 0.5, height: 0.5` | 右侧物块（被拉） |
| `rope-1` | `rope` | `entityAId: "block-A", entityBId: "block-B"` | 轻绳，连接两物块 |

#### 关系

| type | sourceRef | targetRef | properties |
|------|-----------|-----------|------------|
| `contact` | `block-A` | `surface` | `{ friction: true }` |
| `contact` | `block-B` | `surface` | `{ friction: true }` |
| `connection` | `block-A` | `block-B` | `{ connector: "rope-1" }` |

#### 用户参数

| 参数组 | key | label | type | default | range | unit | targetEntityId | targetProperty | visibleWhen |
|--------|-----|-------|------|---------|-------|------|----------------|----------------|-------------|
| 物块A | `mass1` | 质量m₁ | slider | 2.0 | 0.5~20 | kg | block-A | mass | — |
| 物块B | `mass2` | 质量m₂ | slider | 3.0 | 0.5~20 | kg | block-B | mass | — |
| 外力 | `appliedForce` | 外力F | slider | 10 | 0~200 | N | — | — | — |
| 接触面 | `friction` | 动摩擦因数μ | slider | 0.2 | 0~1.0 | — | — | — | — |
| 分析方法 | `analysisMethod` | 分析方法 | select | "isolated" | overall/isolated | — | — | — | — |

#### 求解器

- qualifier：`{ connected: 'rope-horizontal' }`
- 整体法：a = (F - μ(m₁+m₂)g) / (m₁+m₂)
- 隔离法：T = m₂a + μm₂g
- F=0 且 μ=0 时：静止平衡（a=0, T=0）
- F=0 且 μ>0 时：静止平衡（a=0, T=0，无运动趋势则无摩擦力）
- a<0 时：F 不足以克服摩擦力，系统静止（a=0）

---

### 预设2：绳连斜面-悬挂（FM-032）

**预设 ID**：`P01-FM032-rope-connected-incline`
**group**：`connected-body`，groupLabel：`连接体模型`，groupOrder：`2`

```
        ○ pivot-top (定滑轮)
       /|
      / | rope-2 (竖直段)
     /  |
    /   [B] 悬挂物块
   / rope-1 (沿斜面段)
  [A] 斜面物块
 /____________
    slope
```

#### 实体

| ref | type | properties | 说明 |
|-----|------|-----------|------|
| `slope` | `slope` | `angle: 30, length: 4, friction: 0.2` | 斜面 |
| `block-A` | `block` | `mass: 2, width: 0.5, height: 0.5` | 斜面上的物块 |
| `block-B` | `block` | `mass: 3, width: 0.4, height: 0.4` | 悬挂的物块 |
| `pivot-top` | `pivot` | `radius: 0.08, style: "pulley"` | 斜面顶端定滑轮 |
| `rope-1` | `rope` | `pivotEntityId: "pivot-top", blockEntityId: "block-A"` | 沿斜面段绳 |
| `rope-2` | `rope` | `pivotEntityId: "pivot-top", blockEntityId: "block-B"` | 竖直段绳 |

> 物理上是同一根绳经定滑轮转向，数据上拆为两段 rope 方便分别渲染（沿斜面/竖直）。约束条件"两物体加速度大小相等"由求解器保证。

#### 关系

| type | sourceRef | targetRef | properties |
|------|-----------|-----------|------------|
| `contact` | `block-A` | `slope` | `{ friction: true }` |
| `connection` | `block-A` | `pivot-top` | `{ connector: "rope-1" }` |
| `connection` | `block-B` | `pivot-top` | `{ connector: "rope-2" }` |

#### 用户参数

| 参数组 | key | label | type | default | range | unit | targetEntityId | targetProperty | visibleWhen |
|--------|-----|-------|------|---------|-------|------|----------------|----------------|-------------|
| 斜面物体 | `mass1` | 质量m₁ | slider | 2.0 | 0.5~20 | kg | block-A | mass | — |
| 悬挂物体 | `mass2` | 质量m₂ | slider | 3.0 | 0.5~20 | kg | block-B | mass | — |
| 斜面 | `slopeAngle` | 斜面角度θ | slider | 30 | 5~85 | ° | slope | angle | — |
| 接触面 | `friction` | 动摩擦因数μ | slider | 0.2 | 0~1.0 | — | — | — | — |
| 分析方法 | `analysisMethod` | 分析方法 | select | "isolated" | overall/isolated | — | — | — | — |

#### 求解器

- qualifier：`{ connected: 'rope-incline-suspended' }`
- 绳不可伸长 → |a_A| = |a_B|（大小相等）
- 设 m₂ 下降（block-A 上行）为正方向：
  - block-A（沿斜面）：T - m₁g·sinθ - μm₁g·cosθ = m₁a
  - block-B（竖直）：m₂g - T = m₂a
  - 联立：a = (m₂g - m₁g·sinθ - μm₁g·cosθ) / (m₁+m₂)
  - T = m₂(g - a)
- a > 0：m₂ 下降，m₁ 上行；a < 0：反向运动（摩擦力方向也反转）；a = 0：平衡
- 需判断静摩擦力与滑动摩擦力的切换

---

### 预设3：竖直弹簧（FM-051 竖直）

**预设 ID**：`P01-FM051-spring-vertical`
**group**：`spring-model`，groupLabel：`弹簧模型`，groupOrder：`1`

```
  /////// (天花板)
    ● pivot-top
    |
    ⌇ spring-1
    ⌇
    |
   [A] block
```

#### 实体

| ref | type | properties | 说明 |
|-----|------|-----------|------|
| `pivot-top` | `pivot` | `radius: 0.05` | 顶部固定点（天花板） |
| `spring-1` | `spring` | `stiffness: 100, naturalLength: 1.0, pivotEntityId: "pivot-top", blockEntityId: "block-A"` | 弹簧 |
| `block-A` | `block` | `mass: 1, width: 0.5, height: 0.5` | 物块 |

> 结构与单绳悬挂（阶段5）同构，connector 从 rope 换成 spring。

#### 关系

| type | sourceRef | targetRef | properties |
|------|-----------|-----------|------------|
| `connection` | `block-A` | `pivot-top` | `{ connector: "spring-1" }` |

#### 用户参数

| 参数组 | key | label | type | default | range | unit | targetEntityId | targetProperty | visibleWhen |
|--------|-----|-------|------|---------|-------|------|----------------|----------------|-------------|
| 弹簧 | `stiffness` | 劲度系数k | slider | 100 | 10~1000 | N/m | spring-1 | stiffness | — |
| 物块 | `mass` | 质量m | slider | 1.0 | 0.1~20 | kg | block-A | mass | — |

#### 求解器

- qualifier：`{ spring: 'vertical' }`
- 平衡态：kx₀ = mg → x₀ = mg/k
- 力：重力 G = mg↓，弹簧弹力 F弹 = kx₀↑（拉力，方向向上）
- 物块位置 = pivot 位置 - (naturalLength + x₀)（向下偏移）
- 弹簧渲染长度 = naturalLength + x₀

---

### 预设4：水平弹簧连墙壁（FM-051 水平）

**预设 ID**：`P01-FM051-spring-wall`
**group**：`spring-model`，groupLabel：`弹簧模型`，groupOrder：`2`

```
  |
  |~~spring~~[A]  → F
  |
  wall      水平面
  _____________________
```

#### 实体

| ref | type | properties | 说明 |
|-----|------|-----------|------|
| `surface` | `surface` | `length: 5` | 水平面 |
| `pivot-wall` | `pivot` | `radius: 0.05, orientation: "left"` | 墙壁固定点（弹簧左端） |
| `spring-1` | `spring` | `stiffness: 100, naturalLength: 1.0, pivotEntityId: "pivot-wall", blockEntityId: "block-A"` | 弹簧 |
| `block-A` | `block` | `mass: 1, width: 0.5, height: 0.5` | 物块 |

> pivot 的 `orientation: "left"` 控制墙壁画在左侧（竖直墙），与默认的 "top"（天花板）区分。

#### 关系

| type | sourceRef | targetRef | properties |
|------|-----------|-----------|------------|
| `contact` | `block-A` | `surface` | `{ friction: true }` |
| `connection` | `block-A` | `pivot-wall` | `{ connector: "spring-1" }` |

#### 用户参数

| 参数组 | key | label | type | default | range | unit | targetEntityId | targetProperty | visibleWhen |
|--------|-----|-------|------|---------|-------|------|----------------|----------------|-------------|
| 弹簧 | `stiffness` | 劲度系数k | slider | 100 | 10~1000 | N/m | spring-1 | stiffness | — |
| 物块 | `mass` | 质量m | slider | 1.0 | 0.1~20 | kg | block-A | mass | — |
| 外力 | `appliedForce` | 外力F | slider | 5 | 0~100 | N | block-A | — | — |
| 外力 | `forceAngle` | 方向角θ | slider | 0 | -180~180 | ° | block-A | — | — |
| 接触面 | `friction` | 动摩擦因数μ | slider | 0 | 0~1.0 | — | — | — | — |

#### 求解器

- qualifier：`{ spring: 'horizontal-wall' }`
- 外力 F 向右推物块 → 弹簧被压缩（或拉伸），形变量 x = F/k（平衡态）
- 有摩擦时需判断：F > μmg 时弹簧有形变；F ≤ μmg 时静摩擦平衡，弹簧无形变
- 力：重力 G↓、法力 N↑、弹簧弹力 F弹←（恢复力，反对形变方向）、外力 F→、可能的摩擦力
- 物块位置 = pivot + naturalLength + x（向右偏移）
- 弹簧渲染长度 = naturalLength + x（x 为正=拉伸，x 为负=压缩）

---

### 预设5：水平弹簧连两物体（FM-033）

**预设 ID**：`P01-FM033-spring-connected-horizontal`
**group**：`spring-model`，groupLabel：`弹簧模型`，groupOrder：`3`

```
  F → [A]~~spring~~[B]
  __________________________
          surface
```

#### 实体

| ref | type | properties | 说明 |
|-----|------|-----------|------|
| `surface` | `surface` | `length: 6` | 水平面 |
| `block-A` | `block` | `mass: 2, width: 0.5, height: 0.5` | 左侧物块（受外力） |
| `block-B` | `block` | `mass: 3, width: 0.5, height: 0.5` | 右侧物块 |
| `spring-1` | `spring` | `stiffness: 100, naturalLength: 1.0, entityAId: "block-A", entityBId: "block-B"` | 弹簧，连接两物块 |

> 与绳连水平面（预设1）结构几乎相同，connector 从 rope 换成 spring。区别：弹簧有 stiffness 可调，弹簧力 F=kx 而非绳只传递拉力。

#### 关系

| type | sourceRef | targetRef | properties |
|------|-----------|-----------|------------|
| `contact` | `block-A` | `surface` | `{ friction: true }` |
| `contact` | `block-B` | `surface` | `{ friction: true }` |
| `connection` | `block-A` | `block-B` | `{ connector: "spring-1" }` |

#### 用户参数

| 参数组 | key | label | type | default | range | unit | targetEntityId | targetProperty | visibleWhen |
|--------|-----|-------|------|---------|-------|------|----------------|----------------|-------------|
| 物块A | `mass1` | 质量m₁ | slider | 2.0 | 0.5~20 | kg | block-A | mass | — |
| 物块B | `mass2` | 质量m₂ | slider | 3.0 | 0.5~20 | kg | block-B | mass | — |
| 弹簧 | `stiffness` | 劲度系数k | slider | 100 | 10~1000 | N/m | spring-1 | stiffness | — |
| 物块A | `forceA` | 外力Fᴬ | slider | 10 | 0~200 | N | block-A | — | — |
| 物块A | `forceAngleA` | 方向角θᴬ | slider | 0 | -180~180 | ° | block-A | — | — |
| 物块B | `forceB` | 外力Fᴮ | slider | 0 | 0~200 | N | block-B | — | — |
| 物块B | `forceAngleB` | 方向角θᴮ | slider | 0 | -180~180 | ° | block-B | — | — |
| 接触面 | `friction` | 动摩擦因数μ | slider | 0 | 0~1.0 | — | — | — | — |
| 分析方法 | `analysisMethod` | 分析方法 | select | "isolated" | overall/isolated | — | — | — | — |

#### 求解器

- qualifier：`{ spring: 'horizontal-connected' }`
- 弹簧连接 ≠ 绳连接：两物体加速度不一定相等（弹簧可形变）
- **平衡态分析**（Phase 1 先做静力学）：
  - 整体法：F - μ(m₁+m₂)g = 0（平衡条件）或 = (m₁+m₂)a
  - 隔离 block-B：F弹 - μm₂g = m₂a → F弹 = m₂a + μm₂g
  - 弹簧形变量 x = F弹/k
- 整体法/隔离法 select 控制显示

---

## 分组汇总

### 连接体模型（group: "connected-body"）

| 预设 | groupOrder | 实体数 | 子类型名 |
|------|-----------|-------|---------|
| 绳连水平面两物体 | 1 | 4 | 水平绳连 |
| 绳连斜面-悬挂 | 2 | 6 | 斜面绳连 |

### 弹簧模型（group: "spring-model"）

| 预设 | groupOrder | 实体数 | 子类型名 |
|------|-----------|-------|---------|
| 竖直弹簧 | 1 | 3 | 竖直悬挂 |
| 水平弹簧连墙壁 | 2 | 4 | 水平连墙 |
| 水平弹簧连两物体 | 3 | 4 | 水平连物 |

---

## 连接件属性模式

rope 和 spring 都需要支持两种连接模式：

| 连接模式 | 属性 | 使用场景 |
|---------|------|---------|
| pivot↔block（已有） | `pivotEntityId`, `blockEntityId` | 悬挂、斜面绳连、竖直弹簧、墙壁弹簧 |
| block↔block（新增） | `entityAId`, `entityBId` | 绳连水平面、弹簧连两物体 |

渲染器需根据属性名动态查找两端实体位置。preset-loader 的 ref 自动替换（阶段5已有）同样适用于新属性名。

---

## 新增实体详细设计

### spring 实体

**文件**：`src/domains/mechanics/entities/spring.ts`

```typescript
entityRegistry.register({
  type: 'spring',
  category: 'connector',
  label: '弹簧',
  defaultProperties: {
    stiffness: 100,        // N/m
    naturalLength: 1.0,    // m
    pivotEntityId: '',     // 固定端（pivot↔block 模式）
    blockEntityId: '',     // 自由端（pivot↔block 模式）
    entityAId: '',         // A 端（block↔block 模式）
    entityBId: '',         // B 端（block↔block 模式）
  },
  paramSchemas: [],
  hitTest: /* 线段碰撞，与 rope 类似 */,
  drawOutline: /* 路径沿两端点连线 */,
});
```

### spring 渲染器

**文件**：`src/domains/mechanics/renderers/spring-renderer.ts`

- 获取两端点位置（从关联实体动态读取）
- 在两端点之间绘制锯齿波形（zigzag）
- 波形参数：固定圈数（如 8~12 个锯齿），振幅随弹簧长度自适应
- 拉伸时锯齿间距增大，压缩时间距减小，视觉上直观

### pivot 渲染器扩展

现有 pivot 渲染为"实心圆点 + 三角固定标记 + 斜线墙壁"（朝上，天花板）。需扩展：
- `style: "pulley"`（FM-032）：渲染为圆环（小圆盘），表示定滑轮
- `orientation: "left"/"right"`（FM-051 水平）：墙壁竖直绘制在左/右侧

---

## 子任务拆分

### 7.1：spring 实体 + 渲染器

**新增文件**：
- `src/domains/mechanics/entities/spring.ts`
- `src/domains/mechanics/renderers/spring-renderer.ts`

**要点**：
- 渲染为锯齿波形（zigzag），类似教材中的弹簧符号
- 端点位置从关联实体（pivotEntityId/blockEntityId 或 entityAId/entityBId）动态获取
- 拉伸/压缩时锯齿间距变化
- hitTest：线段碰撞（与 rope 类似）
- drawOutline：路径沿两端点连线

### 7.2：pivot 渲染器扩展（pulley + orientation）

**修改文件**：
- `src/domains/mechanics/renderers/pivot-renderer.ts`

**要点**：
- `style: "pulley"` 时渲染为圆环代替三角标记
- `orientation: "left"/"right"` 时墙壁竖直绘制

### 7.3：绳连水平面求解器 + 预设（FM-031）

**新增文件**：
- `src/domains/mechanics/solvers/rope-connected-horizontal.ts`
- `src/domains/mechanics/presets/rope-connected-horizontal.json`

**要点**：
- 两物块并排在水平面上，绳连接
- 整体法/隔离法 select 控制力的显示方式
- 支持 force + motion 视角
- rope 使用 block↔block 连接模式（entityAId/entityBId）

### 7.4：绳连斜面-悬挂求解器 + 预设（FM-032）

**新增文件**：
- `src/domains/mechanics/solvers/rope-connected-incline.ts`
- `src/domains/mechanics/presets/rope-connected-incline.json`

**要点**：
- 复用已有 slope + rope + pivot 实体
- 绳拆为两段（rope-1 沿斜面，rope-2 竖直），经定滑轮（pivot, style: "pulley"）转向
- 两物体耦合求解（约束：加速度大小相等）
- 运动方向判断 + 摩擦力方向随运动趋势

### 7.5：弹簧模型求解器 + 3 个预设（FM-051 + FM-033）

**新增文件**：
- `src/domains/mechanics/solvers/spring-vertical.ts`
- `src/domains/mechanics/solvers/spring-horizontal-wall.ts`
- `src/domains/mechanics/solvers/spring-connected-horizontal.ts`
- `src/domains/mechanics/presets/spring-vertical.json`
- `src/domains/mechanics/presets/spring-wall.json`
- `src/domains/mechanics/presets/spring-connected-horizontal.json`

**要点**：
- 竖直：平衡态 kx₀ = mg，显示 G + F弹
- 墙壁：外力推物块 → 弹簧形变 x = F/k，含摩擦力判断
- 连两物体：整体法/隔离法 + 弹簧弹力 F=kx

### 7.6：注册 + 回归验证

**修改文件**：
- `src/domains/mechanics/index.ts` — 追加所有新注册
- `src/core/visual-constants.ts` — 弹簧力颜色（如需追加）
- `docs/public-api-changelog.md` — 如有公共代码变更

---

## 实施问题记录

### 7.3.0 绳张力方向错误（2026-03-20）

**现象**：水平绳连隔离法中，T 在 block-A 上指向左（向外推），T 在 block-B 上指向右（向外推），视觉效果像"杆在推物体"。

**正确行为**：
- T 在 block-A（左）上 → 右（绳拉 A 朝向 B）
- T 在 block-B（右）上 → 左（绳拉 B 朝向 A）
- 绳只能提供拉力，力的方向从物体指向绳的连接点

**根因**：`rope-connected-horizontal.ts` 中张力 direction 写反了

```typescript
// 错误：T 方向从物体向外推
forcesA: direction: { x: -1, y: 0 }  // A 上向左
forcesB: direction: { x: 1, y: 0 }   // B 上向右

// 修正：T 方向从物体指向绳（教学惯例"指向绳"）
forcesA: direction: { x: 1, y: 0 }   // A 上向右（朝 B）
forcesB: direction: { x: -1, y: 0 }  // B 上向左（朝 A）
```

**关键澄清**：求解器中的力学方程是标量方程，T 大小和加速度计算本身正确，只是 `direction` 字段（用于箭头渲染）需要翻转。

**影响范围**：`rope-connected-horizontal.ts`，同理需检查 `rope-connected-incline.ts` 和 `spring-connected-horizontal.ts`

**详细文档**：`.tasks/active/P01/stage-7.1-fix-tension-direction.md`

---

### 7.3.1 水平绳连外力改造（2026-03-20）

**需求**：外力可施加在任意物块 + 点击弹出力参数

**方案**：每个物块独立拥有 toggle+F+θ 参数组（`hasForceA/forceA/forceAngleA` + `hasForceB/forceB/forceAngleB`），利用 `targetEntityId` + `visibleWhen` 机制，零公共代码修改。

**问题1：visibleWhen 格式错误**
- 现象：开启施加外力 toggle 后，力的大小和方向 slider 不显示
- 原因：JSON 中写成 `{ "param": "hasForceA", "equals": true }`，但 ParamPanel 消费格式为 `{ "hasForceA": true }`（key=参数名，value=期望值）
- 修复：改为 `{ "hasForceA": true }`

**问题2：绳不是水平的**
- 现象：两物块间的绳有微小倾斜
- 原因：rope-renderer 在 block↔block 模式下用 `entityA.transform.position`（底边中心 y=0）作为方向参考点，而非 `getBlockCenter()`（几何中心 y=0.25），导致方向计算有斜度
- 修复：改用 `getBlockCenter()` 作为方向参考点

**问题3：外力箭头与绳完全重叠**
- 现象：外力 θ=0° 时方向水平向右（A→B），与绳线完全重合
- 初始应对：默认角度改为 180°（向左拉），但用户调回 0° 还是会重合
- 根因：force-viewport 的防重叠机制未覆盖 custom 力与连接件的共线

**问题4：合力箭头与绳完全重合**
- 现象：修复外力后合力仍然与绳重合
- 根因：合力的共线偏移只检测了与独立力的共线，未检测与连接件的共线

**问题5：摩擦力箭头与绳完全重合**
- 现象：修复外力和合力后摩擦力仍然与绳重合
- 根因：防重叠逻辑按 force.type 分散处理（custom 单独、tension/spring 单独），摩擦力从未覆盖

### 系统性修复：统一连接件防重叠机制

**根本原因**：原有防重叠按 type 逐个处理（tension 无条件偏移、custom 检测连接件、摩擦力无处理），每修一个类型又发现下一个遗漏。

**解决方案**：统一轨道（slot）机制
1. **connectorDirs 检测范围**扩大为 `rope / rod / spring`（原来只有 rope/rod）
2. **删除所有 type-specific 偏移块**（② custom 专用、③ tension/spring 无条件偏移）
3. **统一逻辑**：任何 force type 与连接件共线（`|dot| > 0.87`）时偏移
4. **slot 递增机制**：`connSlot` 计数器，每个共线力偏移 `connSlot * 10px`，避免多个共线力偏移后互相重合
5. **合力偏移取负方向**：独立力往正方向轨道，合力往负方向轨道（-14px），天然分离

**偏移方向**：用屏幕坐标下力箭头的垂直方向 `(-sdy, sdx) / slen`，不依赖重力或坐标系 → 斜面场景同样适用

**影响范围**：所有有连接件的场景（水平绳连、斜面绳连、悬挂模型、弹簧模型）自动受益

**修改文件**：
- `force-viewport.ts` — 统一偏移逻辑
- `rope-renderer.ts` — block↔block 模式用 getBlockCenter() + 导入 getBlockCenter
- `rope-connected-horizontal.json` — 双物块独立外力参数 + visibleWhen 格式修正
- `rope-connected-horizontal.ts` — 双物块独立外力求解 + 通用绳松弛判定

### 7.x 全场景外力统一改造（2026-03-20）

**用户反馈**：
- 斜面绳连、弹簧模型也存在类似水平绳连的问题 — 外力没有跟随物体（缺少 `targetEntityId`），点击物块时 popover 不显示力参数
- 每个物块都应该可以独立施加外力
- 不需要"施加外力"toggle 开关，F=0 就是不施加外力，更简洁

**决策**：
1. 所有连接体/弹簧场景中，每个物块独立拥有 F+θ 参数，绑定 `targetEntityId`
2. 去掉所有 `hasForce` / `hasAppliedForce` toggle，slider min=0 即可，F=0 = 无外力
3. 求解器统一用 `F > 0` 判断是否有外力，不再读 toggle
4. 水平绳连的 `hasForceA/hasForceB` toggle 也一并去掉
5. 水平面、斜面两个基础预设的 toggle 也一并去掉

**涉及范围**：全部 7 个预设 + 7 个求解器

**状态**：✅ 已完成（2026-03-20）

#### 执行摘要

**第一组（去掉 toggle）**：
| 预设 | 删除参数 | 其他变更 |
|------|---------|---------|
| `horizontal-surface.json` | `hasAppliedForce` toggle + `visibleWhen` | F min 1→0，默认 F=0 |
| `inclined-surface.json` | `hasAppliedForce` toggle + `visibleWhen` | F min 1→0，默认 F=0, θ=45° |
| `rope-connected-horizontal.json` | `hasForceA/B` toggle + `visibleWhen` | B 默认 F=0 |
| `spring-wall.json` | `hasAppliedForce` toggle + `visibleWhen` | 追加 `forceAngle` + `targetEntityId` |
| `spring-connected-horizontal.json` | `hasAppliedForce` toggle + 全局 `force-params` 组 | 改为每物块独立 F+θ |

**第二组（新增每物块独立 F+θ）**：
| 预设 | 新增参数 | 默认值 |
|------|---------|-------|
| `rope-connected-incline.json` | `forceA/forceAngleA` + `forceB/forceAngleB` | 全部 0 |
| `spring-vertical.json` | `appliedForce` + `forceAngle` | 全部 0 |

**求解器变更**：7 个求解器全部删除 toggle 读取，直接读 F 值。新增场景追加角度分解逻辑：
- `rope-connected-incline.ts`：FA 分解到沿斜面/垂直斜面，影响 NA 和运动方程；FB 竖直分量参与悬挂物块方程
- `spring-vertical.ts`：外力竖直分量影响平衡 `kx₀ = mg - Fy`
- `spring-horizontal-wall.ts`：外力分解为水平/竖直分量，竖直影响 N，水平影响弹簧形变
- `spring-connected-horizontal.ts`：每物块外力独立分解，影响各自法力和整体运动方程

**默认值汇总**：
| 预设 | 物块 | F默认 | θ默认 |
|------|------|-------|-------|
| 水平绳连 | A | 10N | 180° |
| 水平绳连 | B | 0N | 0° |
| 斜面绳连 | A/B | 0N | 0° |
| 竖直弹簧 | A | 0N | 0° |
| 弹簧连墙 | A | 5N | 0° |
| 弹簧连物 | A | 10N | 0° |
| 弹簧连物 | B | 0N | 0° |
| 水平面 | A | 0N | 0° |
| 斜面 | A | 0N | 45° |

**验证**：`pnpm lint` ✅ + `pnpm tsc --noEmit` ✅

### 7.x.1 弹簧连物求解器三连修复（2026-03-20）

**状态**：✅ 已修复

#### Bug 1：弹簧形变方向反转

**现象**：水平连物场景，给物块A施加外力（向右，朝弹簧方向），弹簧渲染为拉伸（变长），物理上应被压缩（变短）。

**根因**：`springDeformation = springForce / k`，但 `springForce` 定义为弹簧对 B 的力。物理关系 `F = -kx` → `x = -F/k`，缺少负号。

**修复**：`springDeformation = -springForce / k`（第95行）

#### Bug 2：弹力箭头方向反转

**现象**：压缩时弹力箭头指向错误方向。

**根因**：`springDirOnA = springForce > 0 ? 1 : -1`。弹力对 A 的方向应与 `springForce`（对 B 的力）相反，符号写反了。

**修复**：`springDirOnA = springForce > 0 ? -1 : 1`（第102行）

#### Bug 3：调参时"错误的物块在动"

**现象**：调物块 A 的外力，视觉上物块 B 在移动；调物块 B 的外力，也是 B 在移动。用户直觉期望"谁受力谁动"。

**根因**：`motionB` 的位置从 A 反推（`blockA.x + halfA + naturalLength + springDeformation + halfB`），A 固定不动。弹簧形变只体现在 B 的位置上，无论外力施加在哪个物块。

**修复**：两物块都锚定初始位置，弹簧形变按质量比分配到两侧（质心系原理）：
```
ratioA = m₂ / (m₁+m₂)
ratioB = m₁ / (m₁+m₂)
offsetA = -springDeformation × ratioA  // 压缩时 A 右移(+)
offsetB =  springDeformation × ratioB  // 压缩时 B 左移(-)
motionA.x = blockA.initialX + dx + offsetA
motionB.x = blockB.initialX + dx + offsetB
```

质量轻的一侧位移更大，符合物理直觉。

#### 预设位置修正

`spring-connected-horizontal.json` 中 blockB 的 x 从 1.8 → 1.5，使初始间距与几何一致：`halfA(0.25) + naturalLength(1.0) + halfB(0.25) = 1.5`。

#### 手算验证

| 场景 | FA | springForce | deformation | offsetA | offsetB | dirOnA | dirOnB |
|------|-----|-------------|-------------|---------|---------|--------|--------|
| A向右推(压缩) | 10N θ=0° | +6 | -0.06 | +0.036 | -0.024 | ← | → |
| A向左拉(拉伸) | 10N θ=180° | -6 | +0.06 | -0.036 | +0.024 | → | ← |
| 无外力 | 0 | 0 | 0 | 0 | 0 | — | — |

（m₁=2kg, m₂=3kg, k=100N/m, μ=0）

#### 教训

- 连接体场景中**位置计算不能只锚定一侧**，否则"谁受力谁动"的直觉会被破坏
- 形变分配用质量比（质心系原理）是物理正确且视觉直觉一致的方案
- `springForce` 定义为"对 B 的力"时，形变量和对 A 的力方向都需要取反，三处符号容易遗漏

#### 修改文件

- `src/domains/mechanics/solvers/spring-connected-horizontal.ts` — 3 处符号修正 + 位置分配重写
- `src/domains/mechanics/presets/spring-connected-horizontal.json` — blockB.x 1.8→1.5

**验证**：`pnpm lint` ✅ + `pnpm tsc --noEmit` ✅

---

### 7.x.2 外力作用时间调研（2026-03-20）

**起因**：7.x 改造后所有外力均为持续恒定力，用户提出"高中物理很多场景外力有作用时间"。

**需求文档现状**：仅 P12 动量定理（MOM-041 冲量演示）有"作用时间 t"参数，P01/P02 未提及。

**调研结论**："施力→撤力"是高考力学计算题的核心模板，频率极高（水平面撤力、斜向力撤力、斜面撤力、板块模型撤力、连接体断绳等）。v-t 图折线（斜率在撤力时刻突变）是高频考法。

**处置**：作为 BACKLOG-001 记录到 `.tasks/active/P01/backlog.md`，暂不排期。

---

## 开放问题（需研究模式确认）

1. **整体法/隔离法的 force-viewport 渲染**：整体法时如何在视觉上表示"两物体视为整体"？建议：简单隐藏内力（绳张力/弹簧力）箭头，不做合并包围框。
2. **弹簧力颜色**：当前 `FORCE_COLORS` 是否有弹簧力（elastic/spring）？可能需要在 visual-constants.ts 追加。
3. **多物块 force-viewport 兼容性**：当前 force-viewport 是否支持多物块力分析同时显示？需验证已有渲染逻辑对多 block 的兼容性。
4. **rope block↔block 模式的渲染器适配**：rope-renderer 当前通过 `pivotEntityId`/`blockEntityId` 查找端点，需兼容 `entityAId`/`entityBId`。

---

## 验证要点

1. `pnpm lint && pnpm tsc --noEmit` 通过
2. 弹簧渲染为锯齿形，拉伸/压缩时视觉长度变化
3. 绳连水平面：整体法只显示外力，隔离法显示绳张力 T
4. 绳连水平面：手算验证 m₁=2kg, m₂=3kg, F=10N, μ=0.2 → a=0.04m/s², T=6.6N
5. 绳连斜面-悬挂：两物体加速度大小相等，绳张力耦合正确
6. 竖直弹簧：kx₀ = mg → x₀ = mg/k，弹簧力等于重力
7. 水平弹簧连墙壁：F=kx 平衡，有摩擦时静摩擦判断正确
8. 水平弹簧连两物体：整体法/隔离法切换正确
9. 定滑轮（pivot style: "pulley"）渲染为圆环
10. 墙壁固定点（pivot orientation: "left"）墙壁朝左
11. 已有 5 个预设无回归
12. 公共代码变更日志已更新（如有变更）

---

## 文件变更清单（预估）

| 操作 | 文件 |
|------|------|
| 新增 | `src/domains/mechanics/entities/spring.ts` |
| 新增 | `src/domains/mechanics/renderers/spring-renderer.ts` |
| 修改 | `src/domains/mechanics/renderers/pivot-renderer.ts` — pulley + orientation |
| 新增 | `src/domains/mechanics/solvers/rope-connected-horizontal.ts` |
| 新增 | `src/domains/mechanics/solvers/rope-connected-incline.ts` |
| 新增 | `src/domains/mechanics/solvers/spring-vertical.ts` |
| 新增 | `src/domains/mechanics/solvers/spring-horizontal-wall.ts` |
| 新增 | `src/domains/mechanics/solvers/spring-connected-horizontal.ts` |
| 新增 | `src/domains/mechanics/presets/rope-connected-horizontal.json` |
| 新增 | `src/domains/mechanics/presets/rope-connected-incline.json` |
| 新增 | `src/domains/mechanics/presets/spring-vertical.json` |
| 新增 | `src/domains/mechanics/presets/spring-wall.json` |
| 新增 | `src/domains/mechanics/presets/spring-connected-horizontal.json` |
| 修改 | `src/domains/mechanics/index.ts` — 追加注册 |
| 可能修改 | `src/core/visual-constants.ts` — 弹簧力颜色 |
| 可能修改 | `src/domains/mechanics/viewports/force-viewport.ts` — 多物块力分析 |
| 可能修改 | `src/domains/mechanics/renderers/rope-renderer.ts` — block↔block 模式 |
| 修改 | `docs/public-api-changelog.md` — 如有公共代码变更 |

---

## 预设数量变化

| 阶段 | 变化 | 累计 | Gallery 入口 |
|------|------|------|-------------|
| 阶段1~6（已完成） | 5 | 5 | 水平面、斜面、悬挂模型 = 3 个入口 |
| 阶段7（本阶段） | +5 | 10 | +连接体模型、弹簧模型 = **5 个入口** |
