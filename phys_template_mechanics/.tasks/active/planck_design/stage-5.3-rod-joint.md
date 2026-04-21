# 5.3 杆约束 rod — 刚性距离约束

## 任务 ID
03-25-stage5.3-rod-joint

## 风险评估
- **任务类型**：新功能开发（复用 5.2 全链路，仅新增 descriptor + 引擎分支）
- **风险等级**：L1（常规风险）
  - 涉及 3 个文件，框架已完备
  - 复用 rope.tsx 中 localToWorld / pointToSegmentDistance / drawLine 模式
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

新增杆约束，复用全链路框架。杆 = DistanceJoint(frequencyHz=0)，刚性保持固定距离。

## 前置依赖

- 5.1 基础设施 ✅
- 5.2 绳约束 ✅（提供参考模式）

## 与绳的差异

| 维度 | 绳 rope | 杆 rod |
|------|---------|--------|
| Planck Joint | RopeJoint | DistanceJoint(frequencyHz=0) |
| 物理行为 | 最大距离约束，松弛时无力 | 严格固定距离，不可压缩不可拉伸 |
| 渲染 | 细线 1.5px + 松弛下垂 | 粗线 3px，始终直线 |
| 颜色 | `#555` | `#333` |
| 属性 | maxLength | length |
| 松弛渲染 | 有（贝塞尔下垂） | 无 |
| 编辑约束 | 钳制/联动（maxLength） | 钳制/联动（length，严格等于） |

## 任务清单

### 1. 实现 `rod.tsx` descriptor

**文件**：`src/models/jointTypes/rod.tsx`（新建）

从 rope.tsx 复制模式，修改：
- `type: 'rod'`，`label: '杆'`
- `defaults: { length: 2 }`
- **renderEdit**：粗直线 lineWidth=3，颜色 `#333`（选中蓝色）。无松弛渲染，始终直线。锚点圆点同绳。
- **renderSim**：同 renderEdit 逻辑，从 JointState 读锚点。
- **hitTest**：同绳（pointToSegmentDistance）。
- **properties**：`[{ key: 'length', label: '杆长', type: 'number', min: 0.1, step: 0.1, unit: 'm' }]`
- **toJointConfig**：返回 `{ type: 'distance', length, frequencyHz: 0, dampingRatio: 0 }`

### 2. PhysicsBridge.addJoint 添加 distance 分支

**文件**：`src/engine/PhysicsBridge.ts`

在 switch(config.type) 中添加 `case 'distance'`：
```typescript
case 'distance': {
  const localA = this.worldToLocal(bodyEntryA.body, config.anchorA)
  const localB = this.worldToLocal(bodyEntryB.body, config.anchorB)
  joint = this.world.createJoint(new DistanceJoint({
    length: config.length ?? 2.0,
    frequencyHz: config.frequencyHz ?? 0,
    dampingRatio: config.dampingRatio ?? 0,
    localAnchorA: localA,
    localAnchorB: localB,
    bodyA: bodyEntryA.body,
    bodyB: bodyEntryB.body,
  }))
  break
}
```

注意：需要在文件顶部 import `DistanceJoint`。

此分支同时服务 5.3 杆（freq=0）和 5.4 弹簧（freq>0）。

### 3. 在 index.ts 注册

**文件**：`src/models/jointTypes/index.ts`

添加 `import './rod'`

### 4. 编辑约束（拖拽钳制/联动）

SelectTool 的 `applyRopeConstraints` 当前只检查 `joint.type === 'rope'`。需要扩展为也检查 `'rod'` 类型，使用 `joint.length` 作为约束距离。

PropertyPanel 的 `enforceRopeLength` 同理需要扩展支持 rod 的 length 属性。

## 涉及文件

| 文件 | 操作 |
|------|------|
| `src/models/jointTypes/rod.tsx` | 新建 |
| `src/models/jointTypes/index.ts` | 添加 import |
| `src/engine/PhysicsBridge.ts` | 添加 DistanceJoint import + distance 分支 |
| `src/core/tools/SelectTool.ts` | applyRopeConstraints 扩展支持 rod |
| `src/components/panels/PropertyPanel.tsx` | enforceRopeLength 扩展支持 rod |

## 验收标准

- [x] 用 JointTool 选"杆" → 连接两物体 → 课本风格（矩形条+铰链圆圈）显示
- [x] 仿真模式：两物体保持固定距离，不可压缩不可拉伸
- [x] 选中杆，属性面板显示 length 可编辑
- [x] 编辑模式拖拽物体受杆长钳制/联动
- [ ] Delete 删除杆，Ctrl+Z 撤销（待验收）
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 实施记录

### Bug 修复
- **仿真时杆消失**：toJointConfig 返回 type='distance'（引擎层），但 descriptor 注册为 'rod'。JointState 继承了 'distance'，渲染器 getJointDescriptor('distance') 查不到。修复：新增 sceneType 字段贯穿 JointConfig → PhysicsBridge → JointState → CanvasRenderer。

### 视觉优化
- **课本风格渲染**：从 3px 粗线改为矩形条（圆端 + 浅灰 `#d4d4d4` 填充 + `#555` 描边）+ 两端铰链圆圈（白底空心 + 圆心点）。选中态蓝色 `#3b82f6` 描边 + `#dbeafe` 填充。

## 技术备注

### Planck.js DistanceJoint API
```typescript
import { DistanceJoint } from 'planck-js'
world.createJoint(new DistanceJoint({
  length: 2.0,         // 固定距离
  frequencyHz: 0,      // 0 = 刚性，>0 = 弹性（5.4 弹簧用）
  dampingRatio: 0,     // 0 = 无阻尼
  localAnchorA: Vec2,  // body-local 坐标
  localAnchorB: Vec2,
  bodyA: Body,
  bodyB: Body,
}))
```

### 工具函数复用
`localToWorld` 和 `pointToSegmentDistance` 在 rope.tsx 中已实现。rod.tsx 需要自己复制一份（各 descriptor 独立）或考虑提取到共享模块。建议暂时复制，后续有 3+ 处使用再提取。
