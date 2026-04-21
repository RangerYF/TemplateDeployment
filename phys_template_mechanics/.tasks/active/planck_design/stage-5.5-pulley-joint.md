# 5.5 滑轮绳约束 pulley — 定滑轮 Atwood 机

## 任务 ID
03-25-stage5.5-pulley-joint

## 风险评估
- **任务类型**：新功能开发（descriptor + 引擎分支 + 折线渲染）
- **风险等级**：L1（常规风险）
  - 涉及 3-4 个文件，大部分基础设施已预留
  - JointTool 三步交互已有框架，PhysicsBridge 预留了注释
  - 主要工作量在 descriptor 渲染和 PhysicsBridge pulley 分支
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

新增滑轮绳约束，实现 Atwood 机效果。滑轮绳 = PulleyJoint(ratio=1)，两段绳子通过滑轮座连接，总绳长守恒。

## 前置依赖

- 5.1 基础设施 ✅（JointTool 三步交互、JointConfig/SceneJoint pulley 字段已预留）
- 5.2 绳约束 ✅（提供渲染参考）
- pulley-mount 物体 ✅（阶段 3.2 已实现）

## 已预留的基础设施

| 组件 | 状态 | 位置 |
|------|------|------|
| `JointConfigType` 包含 `'pulley'` | ✅ | `src/engine/types.ts` |
| `JointConfig.groundA/groundB/ratio` 字段 | ✅ | `src/engine/types.ts` |
| `JointType` 包含 `'pulley'` | ✅ | `src/models/types.ts` |
| `SceneJoint.pulleyMountId/ratio` 字段 | ✅ | `src/models/types.ts` |
| JointTool 三步状态机 `PICKING_PULLEY` | ✅ | `src/core/tools/JointTool.ts` |
| JointTool pulley 渲染（虚线折线预览） | ✅ | `src/core/tools/JointTool.ts` |
| PhysicsBridge `// pulley branch will be added in 5.5` | ✅ 注释占位 | `src/engine/PhysicsBridge.ts` |
| `getJointStates()` 传递 `groundA/groundB` | ✅ | `src/engine/PhysicsBridge.ts` |
| pulley-mount 物体类型 | ✅ | `src/models/bodyTypes/pulleyMount.tsx` |

## 与绳/杆/弹簧的差异

| 维度 | 绳 rope | 杆 rod | 弹簧 spring | 滑轮绳 pulley |
|------|---------|--------|-------------|---------------|
| Planck Joint | RopeJoint | DistanceJoint(freq=0) | DistanceJoint(freq>0) | PulleyJoint |
| 物理行为 | 最大距离约束 | 刚性固定距离 | 弹性恢复 | 总绳长守恒 |
| 交互步骤 | 2步(A→B) | 2步(A→B) | 2步(A→B) | 3步(A→滑轮→B) |
| 渲染 | 细线+松弛下垂 | 矩形条+铰链 | 锯齿线 | A→轮顶→B 折线 |
| 颜色 | `#555` | `#555`/`#d4d4d4` | `#e67e22` | `#555` |
| 属性 | maxLength | length | springLength/stiffness/damping | ratio |

## 任务清单

### 1. 实现 PhysicsBridge `case 'pulley'` 分支

**文件**：`src/engine/PhysicsBridge.ts`

在 `addJoint()` 的 switch 中添加 `case 'pulley'` 分支：

```typescript
case 'pulley': {
  const joint = this.world.createJoint(new PulleyJoint({
    bodyA: pBodyA,
    bodyB: pBodyB,
    groundAnchorA: Vec2(config.groundA!.x, config.groundA!.y),
    groundAnchorB: Vec2(config.groundB!.x, config.groundB!.y),
    localAnchorA: worldToLocal(config.anchorA, pBodyA),
    localAnchorB: worldToLocal(config.anchorB, pBodyB),
    lengthA: dist(config.anchorA, config.groundA!),
    lengthB: dist(config.anchorB, config.groundB!),
    ratio: config.ratio ?? 1,
  }))
  // ...存储 entry
}
```

注意：`lengthA/lengthB` 由锚点到滑轮顶的实际距离计算，不需要用户手动输入。

### 2. 实现 `pulley.tsx` descriptor

**文件**：`src/models/jointTypes/pulley.tsx`（新建）

关键点：
- `type: 'pulley'`，`label: '滑轮绳'`
- `defaults: { ratio: 1 }`
- **renderEdit**：A→滑轮顶→B 折线渲染
  - 从 `joint.pulleyMountId` 找到滑轮座物体，计算轮顶位置（滑轮座中心 + 半径向上偏移）
  - A 锚点 → 轮顶左侧切点，轮顶右侧切点 → B 锚点（简化为直接连到轮顶）
  - 线样式同绳（细线 `#555`，选中蓝色）
  - 两端锚点圆点
- **renderSim**：从 JointState 读 `anchorA/anchorB/groundA/groundB`
  - groundA 和 groundB 即滑轮两侧出绳点（PulleyJoint 的 groundAnchor）
  - 渲染 anchorA→groundA + groundB→anchorB 两段线
- **hitTest**：检测点到两段线段的最小距离
- **properties**：
  - `{ key: 'ratio', label: '传动比', type: 'number', min: 0.1, max: 10, step: 0.1, unit: '' }`
- **toJointConfig**：
  - 从 `pulleyMountId` 查找滑轮座，计算轮顶世界坐标作为 `groundA` 和 `groundB`
  - 简化：定滑轮 groundA = groundB = 轮顶位置
  - 返回 `{ type: 'pulley', groundA, groundB, ratio }`

### 3. 在 index.ts 注册

**文件**：`src/models/jointTypes/index.ts`

添加 `import './pulley'`

### 4. 渲染细节

**编辑模式**：
```
anchorA ──── 轮顶 ──── anchorB
  (绳A段)    (滑轮)    (绳B段)
```
- 两段直线，颜色同绳
- 轮顶位置 = pulley-mount 物体中心 y + pulleyRadius

**仿真模式**：
```
anchorA ──── groundA    groundB ──── anchorB
               (滑轮固定点)
```
- groundA/B 来自 JointState（PhysicsBridge 已传递）
- anchorA/B 来自 JointState（物体上的锚点世界坐标）

## 涉及文件

| 文件 | 操作 |
|------|------|
| `src/models/jointTypes/pulley.tsx` | 新建 |
| `src/models/jointTypes/index.ts` | 添加 import |
| `src/engine/PhysicsBridge.ts` | 添加 `case 'pulley'` 分支 |

## 实施变更记录

- ratio 属性从面板移除，改为 totalLength（总绳长）可编辑，MVP 固定 ratio=1
- SceneJoint 新增 `totalLength` 字段，JointConfig 同步新增
- PulleyJoint 参数名为 `groundAnchorA/B`（非 groundA/B）
- pulley-mount defaults 添加 `isStatic: true, fixedRotation: true`
- groundAnchorA/B 分左右放置在滑轮圆上（120°/60°），避免物体摆动时交叉
- SelectTool 拖拽约束新增 pulley 分支（totalLength = distA + distB 守恒）
- 渲染改为：A→groundA 直线 + groundA→groundB 圆弧 + groundB→B 直线
- 切点跳变根因：出绳侧是拓扑离散选择（路径依赖），每帧重算会在边界跳变
- 修复：SceneJoint 新增 `sideA: 'left'|'right'`，创建时确定并持久化，渲染只读取不重算
- 恢复真实切点计算（θ ± acos(r/d)），替代固定 120°/60° 出绳角
- renderSim 也用当前锚点位置动态计算切点（侧面固定、切点随摆动变化）
- enforceConstraintLength 新增 pulley 分支（沿各自到滑轮顶方向按比例移动物体）
- pulley-mount 默认半径从 0.15m 改为 0.3m
- 视口默认 offset.y 从 480 改为 380（地面下移）

## 未解决问题

- **groundAnchor 偏移对物理精度的影响**：切点作为 groundAnchor 传给 PulleyJoint，物体摆动后实际接触点变化但物理 groundAnchor 固定，误差在可接受范围

## 验收标准

- [x] 用 JointTool 选"滑轮绳" → 点击物体A → 点击滑轮座 → 点击物体B → 折线显示
- [x] 仿真模式：Atwood 机效果，重物下沉、轻物上升，总绳长守恒
- [x] 选中滑轮绳，属性面板显示 totalLength 可编辑，调整时画布实时更新
- [x] 仿真时两段绳随物体运动实时更新，切点动态变化
- [x] 创建时绳不交叉（sideA 持久化）
- [x] 仿真摆动时绳不跳变（侧面固定）
- [ ] Delete 删除滑轮绳，Ctrl+Z 撤销
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 技术备注

### Planck.js PulleyJoint
```typescript
// 约束公式：lengthA + ratio * lengthB == constant
world.createJoint(new PulleyJoint({
  bodyA: Body,
  bodyB: Body,
  groundAnchorA: Vec2,  // 滑轮侧A固定点（世界坐标）
  groundAnchorB: Vec2,  // 滑轮侧B固定点（世界坐标）
  localAnchorA: Vec2,   // A物体局部锚点
  localAnchorB: Vec2,   // B物体局部锚点
  lengthA: number,      // A段初始绳长
  lengthB: number,      // B段初始绳长
  ratio: 1.0,           // 传动比（1=定滑轮，2=动滑轮省力）
}))
```

### 定滑轮 vs 动滑轮
- **定滑轮**（ratio=1）：改变力的方向，不省力。groundA = groundB = 轮顶。Atwood 机。
- **动滑轮**（ratio=2）：省一半力。MVP 阶段只实现定滑轮，动滑轮/滑轮组放 MVP 后。

### groundAnchor 的计算
定滑轮场景下，groundAnchorA 和 groundAnchorB 都设为滑轮座顶部：
```typescript
const mount = scene.bodies.find(b => b.id === joint.pulleyMountId)
const groundY = mount.position.y + (mount.pulleyRadius ?? 0.15)
const ground = { x: mount.position.x, y: groundY }
// groundA = groundB = ground（定滑轮共点）
```

### 复用已有设施
- JointTool 三步交互状态机已实现（IDLE → PICKING_PULLEY → PICKING_B）
- JointConfig `groundA/groundB/ratio` 字段已预留
- SceneJoint `pulleyMountId/ratio` 字段已预留
- `getJointStates()` 已传递 `groundA/groundB` 到 JointState
- 工具函数 localToWorld / pointToSegmentDistance 各 descriptor 独立复制
