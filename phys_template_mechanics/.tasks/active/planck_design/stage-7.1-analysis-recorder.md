# 7.1 数据记录框架 + 分析 Store

## 状态：✅ 已完成（2026-03-27）

## 任务 ID
03-27-stage7-1-analysis-recorder

## 风险评估
- **任务类型**：新增基础设施（引擎层+Store层）
- **风险等级**：L1（常规风险）
  - 新增 2 个文件 + PhysicsBridge 集成点
  - 不改已有业务逻辑，纯新增
  - 不涉及数据库或外部接口
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

每帧记录所有物体的物理量（位置、速度、加速度、动量、能量），存入环形缓冲区，供后续图表面板消费。

## 上游依赖
- 7.0 框选与多选 ✅
- PhysicsBridge 仿真循环已可用 ✅
- ForceCollector 已可用（弹簧力等数据源） ✅

## 下游消费
- 7.2 底部图表面板 UI：读取 frameHistory 渲染图表
- 7.6 分析组：读取 analysisGroups 计算系统级汇总

---

## 架构分析

### 数据流

```
Canvas 仿真循环（每帧）
  → PhysicsBridge.step(dt)
  → physicsBridge.getBodyStates()     // 位置、速度、角度
  → AnalysisRecorder.recordFrame()    // 计算全部物理量，写入缓冲区
  → analysisStore.pushFrame(record)   // 通知 store
```

### 集成点

**Canvas.tsx 仿真循环**（`src/components/Canvas.tsx:326-347`）：
```typescript
// 现有循环
physicsBridge.beginForceFrame()
physicsBridge.step(dt)
forceDataRef.current = physicsBridge.collectForces(currentScene, dt)
bodiesRef.current = physicsBridge.getBodyStates()
// ← 在此处插入：recorder.recordFrame(...)
```

### 关键计算公式

| 物理量 | 计算方式 |
|--------|---------|
| 速度 (vx, vy) | 直接从 `BodyState.linearVelocity` 读取 |
| 速率 \|v\| | `Math.hypot(vx, vy)` |
| 加速度 (ax, ay) | `(v_current - v_prev) / dt`，第一帧为 0 |
| 加速度大小 \|a\| | `Math.hypot(ax, ay)` |
| 动量 (px, py) | `mass × vx`, `mass × vy` |
| 动量大小 \|p\| | `mass × speed` |
| 动能 Ek | `½ × mass × speed²` |
| 重力势能 Ep | `mass × g × y`（y = 物体质心 Y 坐标，g = 9.8）|
| 弹性势能 Ep_spring | `½ × k × Δx²`（Δx = 当前长度 - 自然长度，遍历弹簧 Joint） |
| 位移 | `distance(pos_current, pos_initial)` |

### 重力势能参考面

- 使用地面物体（type='ground'）的 Y 坐标作为零势能面
- 若无地面，默认 y=0

### 弹性势能获取

- 遍历 `scene.joints` 中 `type === 'spring'` 的约束
- 计算当前锚点间距 vs `springLength`（自然长度）
- `Ep_spring = ½ × stiffness × (dist - springLength)²`
- 注意：弹性势能归属到弹簧两端物体（各分一半）

---

## 数据类型定义

```typescript
// src/engine/AnalysisRecorder.ts

interface BodyFrameData {
  x: number; y: number           // 位置
  vx: number; vy: number         // 速度分量
  speed: number                  // 速率 |v|
  ax: number; ay: number         // 加速度分量
  accel: number                  // 加速度大小 |a|
  px: number; py: number         // 动量分量
  momentum: number               // 动量大小 |p|
  ek: number                     // 动能
  epGravity: number              // 重力势能
  epSpring: number               // 弹性势能
  displacement: number           // 位移（相对初始位置）
}

interface FrameRecord {
  t: number                                 // 仿真时间（秒）
  bodies: Record<string, BodyFrameData>     // bodyId → 数据
}
```

```typescript
// src/store/analysisStore.ts

interface AnalysisGroup {
  id: string
  name: string           // 用户可修改，默认"系统1"
  bodyIds: string[]      // 包含的物体 ID 列表
  color: string          // 图表中的显示颜色
}

type AnalysisView = 'force' | 'motion' | 'energy' | 'momentum'

interface AnalysisState {
  // 分析组管理（7.6 使用，此处先定义）
  analysisGroups: AnalysisGroup[]

  // 视角控制（7.2 使用，此处先定义）
  activeViews: Set<AnalysisView>

  // 数据源勾选（7.2 使用，此处先定义）
  activeDataSourceIds: Set<string>

  // 帧历史（核心）
  frameHistory: FrameRecord[]
  maxFrames: number              // 环形缓冲区上限，默认 1800

  // 仿真时间
  simTime: number

  // 初始位置快照（用于计算位移）
  initialPositions: Record<string, { x: number; y: number }>
}
```

---

## 执行计划（4 步串行）

### 步骤 1：新增 AnalysisRecorder

**新建**：`src/engine/AnalysisRecorder.ts`

**职责**：
- `startRecording(scene)`: 记录初始位置快照 + 重置状态
- `recordFrame(t, bodyStates, scene, dt)`: 计算并返回 FrameRecord
- 内部维护上一帧速度用于加速度差分
- 不直接写 store，返回 FrameRecord 由调用方写入

**要点**：
- 纯计算类，无副作用
- 降采样：仿真 60fps，记录 30fps（每 2 帧记 1 次）
- 质量从 scene.bodies 中读取（不从引擎层）

### 步骤 2：新增 analysisStore

**新建**：`src/store/analysisStore.ts`

**Actions**：
```typescript
pushFrame: (record: FrameRecord) => void      // 追加帧，超限时移除最早帧
clearHistory: () => void                       // 清空历史
setInitialPositions: (pos: Record<string, {x:number,y:number}>) => void
// 以下 7.2/7.6 使用，此处先提供空实现
toggleView: (view: AnalysisView) => void
toggleDataSource: (id: string) => void
addGroup: (group: AnalysisGroup) => void
removeGroup: (id: string) => void
```

### 步骤 3：集成到 Canvas 仿真循环

**修改**：`src/components/Canvas.tsx`

在仿真循环中插入记录调用：
1. 仿真开始时（`mode === 'simulate' && simState === 'playing'`）调用 `startRecording`
2. 每帧 `step()` 后调用 `recordFrame()`，降采样后 `pushFrame()`
3. 仿真停止/重置时调用 `clearHistory()`

### 步骤 4：门禁检查

- `pnpm lint && pnpm tsc --noEmit`
- 验证：添加临时 console.log 确认帧数据正确记录（验收后移除）

---

## 验收标准

- [x] 仿真运行时 AnalysisRecorder 每 2 帧记录一次 FrameRecord
- [x] analysisStore.frameHistory 正确增长
- [x] 仿真重新开始时 frameHistory 被清空（改为重新开始时清空，停止后保留供图表查看）
- [x] 环形缓冲区生效（超过 1800 帧时丢弃最早帧）
- [x] 加速度差分计算正确（自由落体 ay ≈ -9.8）
- [x] 弹性势能计算正确（弹簧场景，含 frequencyHz→k 换算）
- [x] 重力势能以地面为参考面
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

> 注：功能验收需 7.2 图表面板完成后统一进行，当前仅通过门禁检查

---

## 不在本步骤做的事

- 图表面板 UI（7.2）
- 视角 checkbox 控制（7.2）
- 分析组创建/管理 UI（7.6）
- 系统级汇总数据计算（GroupFrameData，7.6 实现时加入 Recorder）
