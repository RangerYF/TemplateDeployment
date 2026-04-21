# 阶段4：运动视角

> 任务ID：03-19-16-00-P01-stage4-motion-viewport
> 风险等级：L1（常规风险，主要在力学域内新增代码，公共代码微量追加）
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 状态：**已完成** ✅（2026-03-19 验收通过）

## 目标

实现 motion viewport，让 6 个动态场景支持运动轨迹、速度/加速度箭头、v-t / x-t 图表显示。教师切换到运动视角后，能直观看到物块的运动过程。

## 前置依赖（阶段1~3产出）

- ✅ 6 个动态预设（摩擦减速、推力加速、施加外力、斜面下滑、冲上斜面、光滑斜面）
- ✅ 2 个静态预设（水平面静止、斜面静止）— 不需要运动视角
- ✅ MotionState 类型已有 position / velocity / acceleration / rotation / trajectory
- ✅ MotionViewportData 类型已有 `{ motionStates: MotionState[] }`
- ✅ render-loop `extractViewportData('motion', result)` 已实现基础提取
- ✅ ViewportRenderer 注册 API 已就绪
- ✅ 视角切换 UI（ViewportBar）已可用

## 关键技术问题

### 问题1：resultHistory 的传递

**现状**：
- `ViewportRenderer` 签名：`(data: ViewportData, entities, ctx: RenderContext) => void`
- `MotionViewportData` 只有当前帧的 `motionStates`
- v-t / x-t 图表需要**历史数据**（`resultHistory`）
- `resultHistory` 存在于 `simulationState.resultHistory`（store 中）

**方案选择**：

| 方案 | 改动 | 优缺点 |
|------|------|--------|
| A: 扩展 MotionViewportData | 追加 `trajectory` 到 types.ts + 修改 render-loop extractViewportData | 干净，类型安全 |
| B: 扩展 RenderContext | 追加 `resultHistory` 到 RenderContext | 所有视角都能用历史数据 |
| C: viewport 内直接读 store | 用 `useSimulationStore.getState()` | 无公共代码改动，但耦合 |

> **推荐方案 A**：扩展 `MotionViewportData`，让 `extractViewportData` 传入 resultHistory 生成图表数据。改动最小且类型安全。
>
> **但需注意**：`extractViewportData` 当前只接收 `result`，不接收 `resultHistory`。需要修改 render-loop 中的调用（⚠️ 公共代码微量修改）。

**具体方案**：

1. `core/types.ts` 追加字段（不改已有）：
```typescript
export interface MotionViewportData {
  motionStates: MotionState[];
  // 新增：历史轨迹数据（用于 v-t / x-t 图表）
  history?: Array<{
    time: number;
    states: Array<{
      entityId: EntityId;
      position: Vec2;
      velocity: Vec2;
      acceleration: Vec2;
    }>;
  }>;
}
```

2. `render-loop.ts` 修改 `extractViewportData` 签名，追加 `resultHistory` 参数（⚠️ 公共代码）：
```typescript
function extractViewportData(
  type: ViewportType,
  result: PhysicsResult,
  resultHistory?: PhysicsResult[], // 新增可选参数
): ViewportData | null {
  // ...
  case 'motion':
    return {
      type: 'motion',
      data: {
        motionStates: Array.from(result.motionStates.values()),
        history: resultHistory?.map(r => ({
          time: r.time,
          states: Array.from(r.motionStates.values()).map(m => ({
            entityId: m.entityId,
            position: m.position,
            velocity: m.velocity,
            acceleration: m.acceleration,
          })),
        })),
      },
    };
}
```

3. render-loop 中调用处传入 resultHistory（从 options 获取）。

---

## 子任务清单（串行）

---

### 子任务4.1：公共代码微量扩展

**文件**：
- `src/core/types.ts`（⚠️ 公共，只追加）
- `src/renderer/render-loop.ts`（⚠️ 公共，微量修改）

**改动**：
1. `MotionViewportData` 追加 `history?` 字段
2. `RenderLoopOptions` 追加 `getResultHistory?: () => PhysicsResult[]`
3. `extractViewportData` 追加 `resultHistory` 参数，仅在 `case 'motion'` 中使用
4. render-loop 调用 `extractViewportData` 时传入 `options.getResultHistory?.()`

**公共代码变更日志**：
修改完成后必须更新 `docs/public-api-changelog.md`。

**影响评估**：
- `MotionViewportData.history` 为可选字段，不影响已有代码
- `RenderLoopOptions.getResultHistory` 为可选字段，不影响已有调用
- `extractViewportData` 追加可选参数，不影响已有调用

---

### 子任务4.2：实现 motion-viewport 渲染器 — 运动箭头

**文件**：`src/domains/mechanics/viewports/motion-viewport.ts`（新增）

**渲染内容（画布主区域）**：

#### 速度箭头
- 颜色：`#2563EB`（蓝色）
- 起点：从实体中心出发（使用 MotionState.position 转换为屏幕坐标）
- 长度：速度大小 → 像素长度（对数映射，与 force-viewport 同类函数）
- 方向：MotionState.velocity 的单位方向
- 标注：`v=3.2m/s`

#### 加速度箭头
- 颜色：`#DC2626`（红色）
- 起点：从实体中心出发（与速度箭头同起点，但用偏移避免重叠）
- 长度：加速度大小 → 像素长度
- 方向：MotionState.acceleration 的单位方向
- 标注：`a=4.9m/s²`
- 样式：虚线（与速度箭头实线区分）

#### 运动轨迹
- 颜色：`#93C5FD`（浅蓝色）
- 从 `history` 中提取每个时刻的 position，绘制连接点的虚线
- 线宽：1.5px，虚线 `[4, 4]`
- 每隔固定间距在轨迹上画小圆点（等时间间隔标记）

**速度/加速度为零时**：
- 速度为零：不画速度箭头
- 加速度为零：不画加速度箭头
- 两者都为零：只显示轨迹（静止预设不显示运动视角，所以这个情况不会出现）

**标签防重叠**：
- 复用 `renderer/placement.ts` 中的 `placeLabel()` 函数
- 速度和加速度标签需要互相避让

**斜面场景的特殊处理**：
- 速度和加速度沿斜面方向，箭头自然沿斜面
- 轨迹沿斜面绘制（从 history positions 自然获得）
- 无需特殊逻辑，MotionState 中已是笛卡尔坐标

---

### 子任务4.3：实现 v-t / x-t 图表小窗口

**文件**：`src/domains/mechanics/viewports/motion-viewport.ts`（同文件）

**图表位置**：画布右上角，叠加在主渲染之上

**图表布局**：
```
┌─────────────────────────────┐
│                             │
│     主渲染区域              │
│     （速度/加速度箭头+轨迹）│
│                             │
│              ┌────────────┐ │
│              │  v-t 图    │ │
│              │            │ │
│              ├────────────┤ │
│              │  x-t 图    │ │
│              │            │ │
│              └────────────┘ │
└─────────────────────────────┘
```

**每个图表尺寸**：约 200×120 px（含坐标轴标注）

**v-t 图**：
- 横轴：时间 t (s)，范围 [0, duration]
- 纵轴：速度 v (m/s)（沿运动方向分量，有正负），自动缩放
- 数据：从 `history` 提取每个时刻的速度分量（水平运动取 vx，斜面运动取沿斜面方向的速度投影）
- 线条颜色：`#2563EB`（蓝色，与速度箭头一致）
- 当前时刻标记：竖线 + 圆点
- 教学意义：冲上斜面场景中，v 从正值线性减到 0 再变为负值，图像为穿过时间轴的直线

**x-t 图**（位移-时间图）：
- 横轴：时间 t (s)，范围 [0, duration]
- 纵轴：位移 x (m)（相对初始位置，有正负），自动缩放
- 数据：从 `history` 提取每个时刻的位移
- 线条颜色：`#059669`（绿色）
- 当前时刻标记：竖线 + 圆点
- 教学意义：冲上斜面场景中，x 先增后减，图像为开口向下的抛物线

**位移计算**：
- 水平运动：x = x(t) − x(0)，取运动初始方向为正方向
- 斜面运动：x = 沿斜面方向的位移投影（取初始运动方向为正），即 `(pos(t) - pos(0))` 在斜面方向上的有符号投影

**图表绘制细节**：
- 半透明背景：`rgba(255, 255, 255, 0.9)`
- 圆角矩形边框：`#E2E8F0`
- 坐标轴：灰色细线，刻度标注
- 网格线：浅灰虚线（可选）
- 字体：11px Inter

**空数据处理**：
- 如果 `history` 为空或 undefined：只画空白图表框架 + "播放后显示" 提示文字
- 如果只有 1 个数据点：画单个点

---

### 子任务4.4：更新动态预设 — 追加 motion 视角

**文件**：`src/domains/mechanics/presets/` 下 6 个动态预设 JSON

**改动**：将 `"supportedViewports": ["force"]` 改为 `"supportedViewports": ["force", "motion"]`

| 预设文件 | 当前 | 改为 |
|----------|------|------|
| `friction-deceleration.json` | `["force"]` | `["force", "motion"]` |
| `friction-acceleration.json` | `["force"]` | `["force", "motion"]` |
| `horizontal-with-force.json` | `["force"]` | `["force", "motion"]` |
| `slope-sliding-down.json` | `["force"]` | `["force", "motion"]` |
| `slope-sliding-up.json` | `["force"]` | `["force", "motion"]` |
| `slope-smooth.json` | `["force"]` | `["force", "motion"]` |

**不改的预设**（静态，duration=0）：
- `horizontal-block.json` — 静止不动，运动视角无意义
- `slope-static.json` — 静止平衡，运动视角无意义

---

### 子任务4.5：注册 + 回归验证

**文件**：`src/domains/mechanics/index.ts`

**新增注册**：
```typescript
import { registerMotionViewport } from './viewports/motion-viewport';
// ...
registerMotionViewport();
```

**App.tsx 或 shell 层**：
- 确认 `getResultHistory` 回调已传入 render-loop options
- 如需修改 `src/shell/App.tsx`（⚠️ 公共代码），记录变更

**回归门禁**：
```bash
pnpm lint && pnpm tsc --noEmit
```

---

## 手算验证用例

### 验证1：摩擦减速
```
m=2kg, v₀=3m/s, μ=0.3（取初始运动方向为正）
→ a = −μg = −2.94 m/s²
→ t_stop = v₀/|a| = 1.02s
→ v-t 图：直线从 (0, 3) 到 (1.02, 0)，之后 v=0
→ x-t 图：开口向下抛物线，最终位移 x = v₀²/(2|a|) = 1.53m
```

### 验证2：斜面下滑
```
m=2kg, θ=45°, μ=0.3（取沿斜面向下为正）
→ a = g(sinθ − μcosθ) = 9.8(0.707 − 0.212) = 4.85 m/s²
→ t=1s: v = 4.85 m/s, x = 2.43 m
→ v-t 图：直线从 (0, 0) 经过 (1, 4.85)
→ x-t 图：开口向上抛物线 x = ½at²
```

### 验证3：冲上斜面
```
m=2kg, θ=30°, μ=0.2, v₀=5m/s（取沿斜面向上为正）
→ 上冲阶段 a = −g(sinθ + μcosθ) = −9.8(0.5 + 0.173) = −6.60 m/s²
→ t_stop = v₀/|a| = 0.76s
→ v-t 图：直线从 (0, +5) 线性降到 (0.76, 0)
    若反向下滑：a' = −g(sinθ − μcosθ) = −9.8(0.5 − 0.173) = −3.20 m/s²
    v 继续为负值（向下），图像穿过时间轴
→ x-t 图：先增后减的抛物线（最高点 x_max = v₀²/(2|a|) = 1.89m）
```

---

## 文件变更清单

| 操作 | 文件路径 | 归属 | 说明 |
|------|----------|------|------|
| 修改 | `src/core/types.ts` | ⚠️ 公共 | MotionViewportData 追加 currentTime? + history? 字段 |
| 修改 | `src/core/engine/simulator.ts` | ⚠️ 公共 | 追加 getResultHistory()；analytical 模式也记录 resultHistory |
| 修改 | `src/renderer/render-loop.ts` | ⚠️ 公共 | RenderLoopOptions 追加 getResultHistory；extractViewportData 追加参数 |
| 修改 | `src/shell/App.tsx` | ⚠️ 公共 | 传入 getResultHistory + supportedViewports |
| 修改 | `src/store/simulation-store.ts` | ⚠️ 公共 | 追加 supportedViewports 状态 |
| 新增 | `src/shell/canvas/ViewportBar.tsx` | ⚠️ 公共 | 视角切换栏 |
| 新增 | `src/shell/canvas/MotionCharts.tsx` | ⚠️ 公共 | 运动图表面板（v-t / a-t / x-t） |
| 修改 | `src/shell/canvas/CanvasContainer.tsx` | ⚠️ 公共 | 引入 ViewportBar + MotionCharts |
| 新增 | `src/domains/mechanics/viewports/motion-viewport.ts` | 力学域 | 运动视角渲染器（速度/加速度箭头） |
| 修改 | `src/domains/mechanics/solvers/block-on-slope.ts` | 力学域 | 修复上冲阶段加速度方向 bug |
| 修改 | `src/domains/mechanics/presets/*.json` × 6 | 力学域 | 追加 `"motion"` 到 supportedViewports |
| 修改 | `src/domains/mechanics/index.ts` | 力学域 | 追加注册 |
| 修改 | `docs/public-api-changelog.md` | — | 记录公共代码变更 |

## 验收标准

- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 6 个动态预设切换到运动视角正常显示
- [x] 速度箭头方向和大小随时间正确变化（蓝色实线）
- [x] 加速度箭头方向正确（红色虚线）
- [x] ~~运动轨迹~~ — 当前阶段全为直线运动，轨迹与路径重合无信息增量，暂不绘制
- [x] v-t / a-t / x-t 图表可切换，芯片选择，支持多选
- [x] 图表旁标注正方向说明（如「沿斜面向上为正」）
- [x] 摩擦减速场景：v 从 v₀ 线性减至 0（手算验证通过）
- [x] 冲上斜面：v-t 图穿过时间轴，a-t 图两段不同负值
- [x] 播放前图表显示空框架 + 提示
- [x] 2 个静态预设不显示运动视角选项
- [x] 切换回 force 视角不影响已有功能（无回归）
- [x] 公共代码变更日志已更新

## 关键决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| resultHistory 传递方式 | 扩展 MotionViewportData + extractViewportData | 类型安全，改动最小 |
| 位移计算方式 | 沿运动方向的有符号位移 | 符合高中 x-t 图标准，与 v-t 图积分一致 |
| 图表位置 | 画布右上角叠加 | 不遮挡物块和力箭头（通常在中下部） |
| 速度/加速度箭头起点 | 实体中心 | 与 force-viewport 统一风格 |
| 图表数据为空时 | 显示空框架 + 提示 | 比隐藏图表更直观 |
| 静态预设 | 不加 motion 视角 | duration=0，无运动数据 |
| 图表实现方式 | React 覆盖组件（MotionCharts） | 支持交互切换芯片，canvas 绘制不易做交互 |
| 图表类型选择 | v-t / a-t / x-t 芯片多选 | 用户按需查看，默认只显示 v-t |
| 正方向标注 | 芯片栏旁灰色文字 | 有正负值的图必须说明参考方向 |
| 运动轨迹 | 暂不绘制 | 当前阶段全为直线运动，与路径重合无信息增量 |
| analytical resultHistory | 移除 solveMode 条件，始终记录 | 原仅 numerical 模式记录，analytical 模式历史为空 |
| 上冲加速度方向 | 修复 accelAlongSlope 符号 | 原 -aUp 导致箭头和 a-t 图方向反转 |
