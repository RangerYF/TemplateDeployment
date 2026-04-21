# 6.2 力的收集系统

## 状态：代码层完成，待功能验收

- 6 步计划全部执行，lint + tsc 通过
- 仿真模式下 dynamic 物体旁显示力调试文字（类型+大小+方向）
- 待验收：启动 pnpm dev 放物块在地面仿真，确认 G≈N、斜面三力、约束张力等数值正确

## 任务 ID
03-26-14-00-force-collection

## 风险评估
- **任务类型**：新功能（引擎层数据提取 + 新数据管道）
- **风险等级**：L2（高风险）
  - 涉及物理引擎数据提取（post-solve 事件、Joint.getReactionForce）
  - 新增数据链路：Planck.js → ForceCollector → ForceData[] → 渲染消费
  - 数值滤波需真实数据验证（接触力噪声大小未知）
  - 与 6.1 SceneForce（用户外力）和 6.3 渲染层对接
- **流程路径**：MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

建立每帧力数据的收集管道。本阶段完成后：
- 仿真时可获取每个物体受到的所有力（重力、接触力、约束力、用户外力）
- 用户外力在仿真时通过 `applyForce` 施加到物体上
- 接触力经过数值滤波，静态场景无抖动
- ForceData[] 可被 6.3 渲染层直接消费

## 上游依赖
- 6.1 基础设施 ✅（SceneForce 类型 + forceStore CRUD）

## 下游消费
- 6.3 力渲染：消费 ForceData[] 画力箭头
- 6.4 面板：消费 ForceData[] 显示力列表

---

## Planck.js API 调研结果

### 力的数据来源

| 力类型 | 来源 | API | 备注 |
|--------|------|-----|------|
| 重力 | 直接计算 | `body.getMass() × world.getGravity()` | 最简单，无噪声 |
| 用户外力 | SceneForce 记录 | `body.applyForceToCenter(force)` | 每帧施加 + 自己记录 |
| 接触力（支持力+摩擦力） | post-solve 事件 | `ContactImpulse.normalImpulses[]` / `.tangentImpulses[]` | 冲量/dt=力，有噪声 |
| 约束力（张力/弹簧力） | Joint API | `joint.getReactionForce(inv_dt)` | 返回 Vec2 |

### post-solve 接口

```typescript
world.on('post-solve', (contact: Contact, impulse: ContactImpulse) => {
  // contact.getFixtureA/B() → 获取碰撞双方
  // contact.getWorldManifold(null) → { normal: Vec2, points: Vec2[], pointCount }
  // impulse.normalImpulses → number[]（法向冲量，除以 dt 得法向力=支持力）
  // impulse.tangentImpulses → number[]（切向冲量，除以 dt 得切向力=摩擦力）
})
```

### getReactionForce 接口

```typescript
joint.getReactionForce(inv_dt: number): Vec2
// inv_dt = 1 / dt，返回约束反力向量
// RopeJoint → 张力（沿绳方向）
// DistanceJoint(freq=0) → 杆约束力
// DistanceJoint(freq>0) → 弹簧力
// PulleyJoint → 滑轮绳张力
```

---

## 执行计划（6 步）

### 步骤 1：定义 ForceData 类型

**文件**：`src/engine/types.ts`

```typescript
export type CollectedForceType =
  | 'gravity'      // 重力
  | 'normal'       // 支持力（接触法向）
  | 'friction'     // 摩擦力（接触切向）
  | 'tension'      // 张力/弹簧力（约束反力）
  | 'external'     // 用户外力

export interface ForceData {
  bodyId: string
  forceType: CollectedForceType
  vector: { x: number; y: number }  // 力向量（N）
  magnitude: number                  // 力大小（N）
  sourceId?: string                  // 来源 ID（jointId 或 forceId）
  contactNormal?: { x: number; y: number }  // 接触法线方向（仅接触力）
}
```

### 步骤 2：创建 ForceCollector 核心模块

**新建文件**：`src/engine/ForceCollector.ts`

**职责**：
- 每帧收集所有力
- 管理 post-solve 回调
- 对接触力进行数值滤波
- 施加用户外力
- 输出 ForceData[]

**核心结构**：
```typescript
class ForceCollector {
  private contactForces: Map<string, ForceData[]>  // bodyId → 本帧接触力
  private emaForces: Map<string, Map<string, ForceData>>  // bodyId → forceKey → 滤波后
  private readonly EMA_ALPHA = 0.3  // 指数移动平均系数

  // 生命周期
  attach(world: World): void        // 挂载 post-solve 回调
  detach(): void                     // 卸载回调

  // 每帧调用
  beginFrame(): void                 // 清空本帧接触力缓冲
  applyExternalForces(scene, bridge): void  // 施加用户外力
  collect(scene, bridge, dt): ForceData[]   // 收集所有力
}
```

**post-solve 回调实现**：
1. 从 contact 获取 fixtureA/B → bodyA/B → bodyId
2. 从 WorldManifold 获取 normal 方向和 pointCount
3. 累加 normalImpulses（同一对物体可能多个接触点）
4. 累加 tangentImpulses
5. 存入 contactForces Map

**collect 方法**：
1. 收集重力：遍历所有 dynamic body，`mass × gravity`
2. 处理接触力：将 post-solve 累积的冲量 / dt 转为力，EMA 滤波
3. 收集约束力：遍历 joints，`getReactionForce(1/dt)`
4. 收集用户外力：从 scene.forces 读取（已在 applyExternalForces 中施加）
5. 合并输出 ForceData[]

### 步骤 3：实现接触力的 EMA 数值滤波

**策略**：指数移动平均（EMA）

```
filteredForce = α × currentForce + (1-α) × previousFilteredForce
```

- `α = 0.3`：平衡响应速度和平滑度
- 按 `bodyId + 方向类型(normal/friction) + 对方bodyId` 作为 key
- 力消失（接触断开）时立即清零，不做渐出
- 力大小 < 0.01N 时视为零，不输出

**接触力方向处理**：
- 法向力（支持力）：沿 WorldManifold.normal 方向，作用在被支撑的物体上方向取反（指向支撑面外）
- 切向力（摩擦力）：垂直于法线的切线方向，符号由 tangentImpulse 决定

### 步骤 4：实现用户外力施加

**在 applyExternalForces 中**：
1. 遍历 `scene.forces`（SceneForce[]）
2. 每个力：`magnitude × (cos(direction), sin(direction))` → 力向量
3. 调用 `body.applyForceToCenter(forceVec)` 施加到 Planck.js 物体
4. 生成对应的 ForceData 记录

**注意**：`applyForce` 必须在每帧 `step()` 之前调用（Planck.js 在 step 后清空外力）

### 步骤 5：集成到仿真循环

**文件**：`src/engine/PhysicsBridge.ts`

扩展：
- `forceCollector: ForceCollector` 成员
- `createWorld()` 时调用 `forceCollector.attach(world)`
- `destroyWorld()` 时调用 `forceCollector.detach()`
- 新增 `getForceData(): ForceData[]` 方法（供外部读取）

**文件**：`src/components/Canvas.tsx`

仿真循环改为：
```typescript
const loop = () => {
  // 1. 施加外力（step 前）
  physicsBridge.applyExternalForces(scene)
  // 2. beginFrame
  physicsBridge.beginForceFrame()
  // 3. step（触发 post-solve 回调收集接触力）
  physicsBridge.step(1 / 60)
  // 4. 收集所有力
  forceDataRef.current = physicsBridge.collectForces(scene, 1 / 60)
  // 5. 获取物体和约束状态
  bodiesRef.current = physicsBridge.getBodyStates()
  jointStatesRef.current = physicsBridge.getJointStates()
  // 6. 渲染
  renderFrame()
}
```

### 步骤 6：最小可观测验证

为避免 6.1 的教训（数据层无法验收），本步骤在 Canvas 中添加**临时调试渲染**：

- 仿真时在每个 dynamic 物体旁边显示力的文字列表（小字号、半透明）
- 格式：`G=19.6N↓ N=19.6N↑ f=0.0N`
- 用 `ctx.fillText` 直接绘制，无需完整力箭头（那是 6.3 的事）
- 确认数据正确后可移除或保留为调试模式

---

## 涉及文件清单

### 新建文件（1个）
| 文件 | 作用 |
|------|------|
| `src/engine/ForceCollector.ts` | 力收集核心模块 |

### 修改文件（3个）
| 文件 | 改动 |
|------|------|
| `src/engine/types.ts` | 新增 CollectedForceType + ForceData 类型 |
| `src/engine/PhysicsBridge.ts` | 集成 ForceCollector，暴露力数据 API |
| `src/components/Canvas.tsx` | 仿真循环集成力收集 + 临时调试渲染 |

---

## 验收标准

✅ 仿真时，静止在水平面上的物块：重力 ≈ 支持力（误差 < 0.5N）
✅ 仿真时，斜面上滑动的物块：能看到重力、支持力、摩擦力三个力
✅ 用户外力施加后，物体运动方向与力方向一致
✅ 约束力收集：挂在锚点的物块，张力 ≈ 重力
✅ 静止场景下力数值稳定，无明显抖动（EMA 滤波生效）
✅ 最小调试渲染可在画布上观测到力数据
✅ `pnpm lint && pnpm tsc --noEmit` 通过

## 不包含的内容（留给后续子阶段）
- 力箭头的正式 Canvas 渲染（6.3）
- 力标签的布局和防重叠（6.3）
- 属性面板力列表（6.4）
- viewMode 状态逻辑（6.4）
- 编辑模式下的力预览（6.3，非仿真状态显示外力箭头）
