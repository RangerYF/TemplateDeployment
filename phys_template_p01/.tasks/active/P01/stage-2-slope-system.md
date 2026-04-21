# 阶段2：斜面体系

> 任务ID：03-18-20-00-P01-stage2-slope
> 风险等级：L1（常规风险，多文件新增，无跨模块联动）
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**已完成**（2026-03-19）

## 目标

新增 `slope` 实体及渲染器，实现 4 个斜面变体预设（静止平衡 / 自由下滑 / 冲上斜面 / 光滑无摩擦），含临时正交分解渲染。

## 前置依赖（阶段1产出）

- ✅ block 实体 + block-renderer
- ✅ force-viewport（含标签防重叠系统）
- ✅ 4 个求解器参考实现（静力/减速/外力/加速）

## 子任务清单（串行）

---

### 子任务2.1：注册 `slope` 实体类型

**文件**：`src/domains/mechanics/entities/slope.ts`

**实体定义**：
| 字段 | 值 | 说明 |
|------|------|------|
| type | `'slope'` | 实体类型标识 |
| category | `'surface'` | 表面类别 |
| label | `'斜面'` | 默认标签 |

**defaultProperties**：
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `angle` | number | 30 | 倾斜角度（度），与水平面的夹角 |
| `length` | number | 3 | 斜面长度（m），沿斜面方向 |
| `friction` | number | 0 | 动摩擦因数 μ |
| `baseWidth` | number | — | 计算得出：length × cos(angle)，用于渲染 |
| `height` | number | — | 计算得出：length × sin(angle)，用于渲染 |

> **注意**：`baseWidth` 和 `height` 是由 `angle` + `length` 计算的派生属性。渲染器和 hitTest 使用这些值。
> 求解器中不直接使用 slope 的 properties，而是从 paramValues 读取 angle/friction。

**hitTest 实现**：
- 斜面的三个顶点（物理坐标）：
  - 底左角：`position`（transform.position）
  - 底右角：`{ x: position.x + baseWidth, y: position.y }`
  - 顶角：`{ x: position.x, y: position.y + height }`
- 检测方式：使用 `pointOnLine()` 检测点是否在斜边线段上（阈值 0.1m），或者使用三角形内部检测
- 推荐方案：用 `pointOnLine()` 检测斜边（用户最可能点击斜边），复用 `geometry.ts` 中已有函数

**createEntity**：
```
id: `slope-${crypto.randomUUID().slice(0, 8)}`
type: 'slope'
category: 'surface'
```

**坐标约定**：
- `transform.position` = 斜面底部左端点（直角顶点）
- 斜面从左下角向右延伸底边，从左下角向上延伸高度
- 物块在斜面上的位置通过求解器计算，不由 slope 实体管理

```
       /|
      / |
     /  | height = length × sin(angle)
    /   |
   /θ___|
  position
     baseWidth = length × cos(angle)
```

---

### 子任务2.2：实现 slope 渲染器

**文件**：`src/domains/mechanics/renderers/slope-renderer.ts`

**渲染内容**：
1. **斜面主线**：从底左角到顶角的斜线（主线，粗）
2. **底边主线**：从底左角到底右角的水平线
3. **斜线填充**：斜面下方（三角形内部底边侧）的斜线填充，教材风格
4. **角度标记**：在底左角绘制角度弧线 + θ 标注
5. **可选：直角标记**：在底右角绘制小方块表示直角

**渲染参考**：
- 参考 `surface-renderer.ts` 的斜线填充风格（`HATCH_SPACING=8, HATCH_HEIGHT=12`）
- 颜色与 surface 保持一致（`LINE_COLOR='#4A5568'`，`HATCH_COLOR='#A0AEC0'`）
- 使用 `worldToScreen()` 转换坐标

**渲染层**：`'surface'`（与 surface-renderer 同层，确保物块渲染在斜面之上）

**关键渲染细节**：
- 斜线填充应在三角形区域内裁剪（使用 Canvas clip）
- 角度弧线半径约 20px，弧从水平方向到斜面方向
- θ 文本放在弧线外侧

---

### 子任务2.3：实现斜面求解器

**文件**：`src/domains/mechanics/solvers/block-on-slope.ts`

**物理模型**：
斜面坐标系以沿斜面方向为 x 轴（向下为正），垂直斜面方向为 y 轴（离开斜面为正）。

**四种变体通过 qualifier 区分**：

#### 变体A：静止平衡 `{ surface: 'inclined', motion: 'static' }`
- 条件：mgsinθ ≤ μ·mgcosθ（tanθ ≤ μ，物块不滑）
- 力列表：G、N = mgcosθ、f = mgsinθ（沿斜面向上）
- 合力 = 0，物块不动
- duration = 0

#### 变体B：自由下滑 `{ surface: 'inclined', motion: 'sliding-down' }`
- 条件：mgsinθ > μ·mgcosθ（tanθ > μ）
- 力列表：G、N = mgcosθ、f = μ·mgcosθ（沿斜面向上，与运动方向相反）
- 加速度 a = g(sinθ − μcosθ)，沿斜面向下
- 位移 s(t) = ½at²（沿斜面），需转换为 x/y 分量
- duration = 5

#### 变体C：冲上斜面 `{ surface: 'inclined', motion: 'sliding-up' }`
- 物块以初速度 v₀ 沿斜面向上冲
- 上冲阶段：a = −g(sinθ + μcosθ)（减速），f 沿斜面向下
- 到 v=0 后如果 tanθ > μ，开始下滑（切换为变体B的加速度）；否则停在斜面上
- 需要事件检测：velocity-zero
- duration = 5

#### 变体D：光滑斜面 `{ surface: 'inclined', motion: 'smooth-slide' }`
- μ = 0，无摩擦力
- 力列表：G、N = mgcosθ
- a = gsinθ
- 本质是变体B的特例（μ=0），但作为独立预设更直观

**求解器实现策略**：

> **关键决策**：4 个变体注册为 4 个独立求解器（各自的 qualifier），还是 1 个求解器通过内部判断？
>
> **推荐方案**：注册为 **1 个统一求解器**，内部通过 qualifier.motion 分支。原因：
> 1. 物理模型高度相似，核心都是斜面分解
> 2. 共享 G/N 力的构建逻辑
> 3. 减少代码重复
>
> 但注册时需要注册 **4 次**（不同 qualifier），共用同一个 solve 函数。
>
> **实际做法**：注册 4 个 SolverRegistration，它们的 `solve` 字段指向同一个函数，函数内通过传入的 scene + qualifier 判断行为。
>
> **问题**：当前 `SolverFunction` 签名是 `(scene, time, dt, prevResult) => PhysicsResult`，没有传入 qualifier。求解器需要自行从场景中推断行为模式。
>
> **解决方案**：函数内部通过参数判断：
> - 有 `initialVelocity > 0` → sliding-up
> - `friction = 0` → smooth-slide（或从 frictionToggle 判断）
> - 其余看 tanθ vs μ：能静止 → static，不能 → sliding-down
>
> **最终方案**：写 1 个求解函数，注册 4 次。函数内通过 scene.paramValues 推断当前状态。这样即使用户调整参数（如增大角度超过 arctan(μ)），场景也能自动从"静止"变为"下滑"。

**正交分解输出**：

求解器在 `ForceAnalysis` 中填充 `decomposition` 字段：
```typescript
decomposition: {
  axis1: { x: cosθ, y: -sinθ },  // 沿斜面方向（向下为正）
  axis2: { x: sinθ, y: cosθ },   // 垂直斜面方向（离开斜面为正）
  components: [
    {
      force: gravity,             // 重力
      component1: mg * sinθ,      // 沿斜面分量
      component2: -mg * cosθ,     // 垂直斜面分量（指向斜面）
    },
  ],
}
```

> **注意**：只对重力做分解（N 和 f 已经沿坐标轴方向，无需分解）。

**物块在斜面上的位置计算**：
- 物块位置 = 斜面底端 + 沿斜面方向偏移
- 静止场景：物块在斜面中部（可调）
- 运动场景：物块位置随时间变化
  - 沿斜面位移 s(t) 转换为笛卡尔坐标：
  - `x(t) = x₀ + s(t) × cosθ`（水平位移，注意方向）
  - `y(t) = y₀ - s(t) × sinθ`（下滑时 y 减小）
  - **但对于"冲上"场景**：初始 s₀ 从斜面底部算起，向上为正

**手算验证用例**：

```
验证1（静止平衡）：
m = 2 kg, θ = 20°, μ = 0.5
→ tanθ = tan20° = 0.364, μ = 0.5 → tanθ < μ → 静止
→ G = 19.6 N
→ N = mgcosθ = 19.6 × cos20° = 18.41 N
→ f = mgsinθ = 19.6 × sin20° = 6.70 N（静摩擦，沿斜面向上）
→ 合力 = 0

验证2（自由下滑）：
m = 2 kg, θ = 45°, μ = 0.3
→ tanθ = 1.0 > μ = 0.3 → 下滑
→ N = mgcosθ = 19.6 × cos45° = 13.86 N
→ f = μN = 0.3 × 13.86 = 4.16 N
→ mgsinθ = 19.6 × sin45° = 13.86 N
→ a = g(sinθ − μcosθ) = 9.8(sin45° − 0.3cos45°) = 9.8(0.707 − 0.212) = 4.85 m/s²
→ t=1s: s = ½ × 4.85 × 1 = 2.43 m（沿斜面）

验证3（光滑斜面）：
m = 1 kg, θ = 30°, μ = 0
→ N = mgcos30° = 8.49 N
→ a = gsin30° = 4.9 m/s²
→ t=2s: v = 9.8 m/s, s = 9.8 m（沿斜面）
```

**参数面板**（各变体共用，部分参数按需隐藏）：

| key | label | type | min | max | step | default | unit | 说明 |
|-----|-------|------|-----|-----|------|---------|------|------|
| `mass` | 质量 | slider | 0.5 | 10 | 0.1 | 2 | kg | |
| `slopeAngle` | 倾斜角 | slider | 5 | 85 | 1 | 30 | ° | |
| `frictionToggle` | 表面摩擦 | toggle | — | — | — | true | — | 光滑变体默认 false |
| `friction` | 摩擦因数 | slider | 0.05 | 1.0 | 0.05 | 0.3 | — | toggle=false 时隐藏 |
| `initialVelocity` | 初速度 | slider | 0.5 | 8 | 0.1 | 3 | m/s | 仅冲上斜面变体 |

---

### 子任务2.4：增强 force-viewport 正交分解渲染

**文件**：`src/domains/mechanics/viewports/force-viewport.ts`

**渲染内容**：当 `ForceAnalysis.decomposition` 存在时，额外绘制：

1. **坐标轴虚线**：沿 axis1 和 axis2 方向从实体中心画出坐标轴参考线（浅灰虚线）
2. **分解虚线**：对每个被分解的力（如重力），从力箭头终点向两个坐标轴方向画虚线投影
3. **分量标注**：在分量虚线终点标注分量大小（如 `mgsinθ=9.8N`、`mgcosθ=17.0N`）

**视觉风格**：
- 分解虚线颜色：与原力颜色相同但降低透明度（opacity 0.5）
- 虚线样式：`setLineDash([4, 3])`
- 分量标注字号：11px（比力标注 12px 略小）
- 坐标轴参考线：`#CBD5E0`（浅灰），虚线，延伸约 200px

**实现策略**：
- 在现有独立力循环之后、合力绘制之前，加一段分解渲染逻辑
- 分解标注也需要参与标签防重叠系统（加入 labelItems 和 arrowBoxes）
- 分解虚线的 box 也加入 arrowBoxes，让主力标签避开分解线

**示意图**（θ=30° 斜面上物块重力分解）：
```
         N ↑
         │
    ─────●───── (沿斜面轴)
        /│\
       / │ \
    f /  │  \ G
     /   │   \
    /  G·cosθ \
         │
       G·sinθ → (沿斜面向下)
```

---

### 子任务2.5：编写 4 个斜面预设 JSON

**文件目录**：`src/domains/mechanics/presets/`

#### 预设1：`slope-static.json`
```
id: "P01-FM011-slope-static"
name: "斜面·静止平衡"
description: "物块静止在粗糙斜面上，分析重力、支持力和摩擦力的平衡"
supportedViewports: ["force"]
defaultViewport: "force"
solverQualifier: { "surface": "inclined", "motion": "static" }
duration: 0
实体：block-A (mass=2), slope-1 (angle=30, length=3, friction=0.5)
关系：contact, block-A → slope-1, { friction: 0.5 }
参数：mass, slopeAngle, frictionToggle(true), friction(0.5)
```

#### 预设2：`slope-sliding-down.json`
```
id: "P01-FM011-slope-sliding-down"
name: "斜面·自由下滑"
description: "物块从斜面顶端由静止开始下滑，分析运动过程中的受力"
supportedViewports: ["force"]
defaultViewport: "force"
solverQualifier: { "surface": "inclined", "motion": "sliding-down" }
duration: 5
实体：block-A (mass=2), slope-1 (angle=45, length=4, friction=0.3)
关系：contact, block-A → slope-1, { friction: 0.3 }
参数：mass, slopeAngle(45), frictionToggle(true), friction(0.3)
```

#### 预设3：`slope-sliding-up.json`
```
id: "P01-FM011-slope-sliding-up"
name: "斜面·冲上斜面"
description: "物块以初速度沿斜面向上冲，先减速后可能反向下滑"
supportedViewports: ["force"]
defaultViewport: "force"
solverQualifier: { "surface": "inclined", "motion": "sliding-up" }
duration: 5
实体：block-A (mass=2, initialVelocity=5), slope-1 (angle=30, length=5, friction=0.2)
关系：contact, block-A → slope-1, { friction: 0.2 }
参数：mass, slopeAngle(30), frictionToggle(true), friction(0.2), initialVelocity(5)
eventActions: [{ eventType: "velocity-zero", action: { type: "mark-state", label: "最高点" } }]
```

#### 预设4：`slope-smooth.json`
```
id: "P01-FM011-slope-smooth"
name: "斜面·光滑无摩擦"
description: "物块在光滑斜面上由静止下滑，仅受重力和支持力"
supportedViewports: ["force"]
defaultViewport: "force"
solverQualifier: { "surface": "inclined", "motion": "smooth-slide" }
duration: 5
实体：block-A (mass=2), slope-1 (angle=30, length=4, friction=0)
关系：contact, block-A → slope-1, { friction: 0 }
参数：mass, slopeAngle(30), frictionToggle(false)
```

---

### 子任务2.6：注册 + 回归验证

**文件**：`src/domains/mechanics/index.ts`

**改动**：
1. import `registerSlopeEntity` from `./entities/slope`
2. import `registerSlopeRenderer` from `./renderers/slope-renderer`
3. import 斜面求解器注册函数（如果注册 4 次需要 export 4 个函数，或 1 个函数内调用 4 次 `solverRegistry.register`）
4. import 4 个预设 JSON
5. 在 `registerMechanicsDomain()` 中调用全部注册

**回归门禁**：
```bash
pnpm lint && pnpm tsc --noEmit
```

---

## 物块在斜面上的位置与渲染协调

**关键问题**：物块在斜面上如何正确渲染？

**方案**：
1. **物块的 transform.position** 由求解器通过 MotionState.position 更新
2. 求解器计算物块沿斜面的位移 s(t)，转换为笛卡尔坐标 (x, y)
3. **物块旋转**：物块在斜面上旋转 θ 角度（`MotionState.rotation = -angleRad`），底边与斜面对齐
4. **已实现**：block-renderer 支持 `transform.rotation`，通过 Canvas translate+rotate 绘制；render-loop 从 MotionState.rotation 临时更新实体旋转

> **决策变更**：原计划"Phase 1 不旋转"被推翻。水平矩形无法与斜面贴合，视觉效果不可接受。已实现旋转支持（MotionState.rotation → render-loop → block-renderer）。

---

## getEdgeStart 适配

**现状**：`getEdgeStart()` 用实体的 `width`+`height` 计算矩形边界偏移。物块在斜面上时，力的方向不再是纯水平/竖直，而是沿斜面/垂直斜面。

**已解决**：物块旋转后，force-viewport 中的 center 计算已更新为考虑旋转：`center = pos + R(rotation) * (0, height/2)`。getEdgeStart 仍用 width/height 做射线交点计算，对于旋转后的物块，力方向在物体局部坐标系中的分量仍然正确映射到矩形边界。

---

## 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 新增 | `src/domains/mechanics/entities/slope.ts` | 斜面实体注册 |
| 新增 | `src/domains/mechanics/renderers/slope-renderer.ts` | 斜面渲染器（三角形+填充+角度标记） |
| 新增 | `src/domains/mechanics/solvers/block-on-slope.ts` | 斜面求解器（4 变体统一函数） |
| 新增 | `src/domains/mechanics/presets/slope-static.json` | 静止平衡预设（θ=30°, μ=0.7） |
| 新增 | `src/domains/mechanics/presets/slope-sliding-down.json` | 自由下滑预设（θ=45°, μ=0.3） |
| 新增 | `src/domains/mechanics/presets/slope-sliding-up.json` | 冲上斜面预设（θ=30°, μ=0.2, v₀=5） |
| 新增 | `src/domains/mechanics/presets/slope-smooth.json` | 光滑斜面预设（θ=30°, μ=0） |
| 修改 | `src/domains/mechanics/viewports/force-viewport.ts` | 旋转实体中心计算、边缘起点修正、临时分解渲染、分量偏移 |
| 修改 | `src/domains/mechanics/renderers/block-renderer.ts` | 旋转绘制支持 |
| 修改 | `src/domains/mechanics/index.ts` | 追加注册（实体+渲染器+求解器×4+预设×4） |
| 修改 | `src/core/types.ts` | MotionState 追加 rotation 字段（追加，不改已有） |
| 修改 | `src/renderer/render-loop.ts` | 从 MotionState 更新实体 rotation |

## 验收标准

- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 斜面在画布上正确绘制（三角形 + 斜线填充 + 角度标记）
- [x] 物块在斜面上正确定位（底边与斜面对齐，旋转支持）
- [x] 静止平衡：合力≈0，摩擦力 = mgsinθ（手算验证通过）
- [x] 自由下滑：物块沿斜面方向移动，位移正确
- [x] 冲上斜面：先减速后停止（或反向），速度零事件触发
- [x] 光滑斜面：无摩擦力箭头，a = gsinθ
- [x] 临时正交分解渲染正确（分量从边缘出发，引导虚线，防重叠偏移）
- [x] 分解标注参与防重叠系统
- [x] 调整角度参数后，力方向/大小实时更新，物块位置无跳变
- [x] N 方向 (sinθ, cosθ) 手算验证：垂直斜面，合力为零

## 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 求解器数量 | 1 个函数 + 4 次注册 | 物理模型高度相似，减少代码重复 |
| 物块旋转 | **旋转 θ 角度**（已实现） | 不旋转时水平矩形无法与斜面贴合，视觉效果不可接受。block-renderer 已支持 rotation |
| 正交分解范围 | 临时实现，仅分解重力 | 完整正交分解系统（交互+动画+选择力）移至阶段3 |
| slope 坐标约定 | position = 底部左端点（直角顶点） | 与 surface 的 position 约定一致 |
| getEdgeStart | 旋转适配 | 力方向旋转到局部坐标系后再做射线交点 |
| 冲上后下滑 | 求解器内自动切换 | v=0 后判断 tanθ vs μ 决定是否下滑 |
| N 方向 | (sinθ, cosθ) | 原 (-sinθ, cosθ) 不垂直斜面，点积验证修复（见 stage-2.1） |
| 物块初始位置 | d0 = slopeLength × 0.65 | 所有分支统一，避免 static/sliding 切换时位置跳变 |

## 修复记录

### 2.1 力方向修复（独立子任务）
- 详见 `stage-2.1-force-direction-fix.md`
- N direction: `(-sinA, cosA)` → `(sinA, cosA)`
- axis2: 同步修正

### Bug 修复清单
| Bug | 根因 | 修复 |
|-----|------|------|
| 物块不在斜面上 | 位置计算用错方向 | `slopeBlockPos()` 从 bottomRight 沿斜边向上偏移 |
| 物块不与斜面对齐 | 无旋转支持 | 实现 MotionState.rotation + block-renderer 旋转 |
| N 方向错误，合力≠0 | 法线用了逆时针旋转 | 改为顺时针旋转 (sinθ, cosθ) |
| 斜面角度弧线画成整圆 | arc 参数 counterclockwise 方向错误 | 用 atan2 精确计算斜边方向 |
| 直角标记位置错误 | 画在 bottomRight（θ角处） | 移到 bottomLeft（直角处） |
| 调角度时物块跳位 | 不同分支 d0 不同 | 统一 d0 = slopeLength × 0.65 |
| 分量箭头与其他力重叠 | 共线力从同一边缘出发 | 检测近共线后垂直偏移 10px |
