# 5.2 绳约束 rope — 跑通全链路

## 任务 ID
03-25-stage5.2-rope-joint

## 风险评估
- **任务类型**：新功能开发（约束系统第一个具体类型）
- **风险等级**：L1（常规风险）
  - 框架已在 5.1 搭好，本阶段仅填充 1 个 descriptor + 1 个引擎分支
  - 涉及 3 个文件，无跨模块联动风险
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

实现第一个约束类型——绳，**跑通全链路**：创建 → 渲染 → 仿真 → 选中 → 编辑 → 删除 → 撤销。

## 前置依赖

5.1 基础设施 ✅ 已完成，提供：
- `JointTypeDescriptor` 接口 + `jointRegistry`
- `JointTool` 状态机（IDLE → PICKING_B → 创建）
- `PhysicsBridge.addJoint()` 框架（待填充具体 Joint 创建逻辑）
- `sceneSync.syncJointAdd()` → `descriptor.toJointConfig()` → `bridge.addJoint()`
- `CanvasRenderer.renderJoints()` → `descriptor.renderEdit()`
- `SelectTool` joint hitTest → `descriptor.hitTest()`
- `PropertyPanel` JointPropertyPanel → `descriptor.properties`
- Delete 键 → `RemoveJointCommand`

## 任务清单

### 1. 实现 `rope.tsx` descriptor

**文件**：`src/models/jointTypes/rope.tsx`（新建）

```typescript
registerJointType({
  type: 'rope',
  label: '绳',
  icon: '—',
  category: 'constraint',
  defaults: { maxLength: 2 },
  renderEdit(ctx, joint, bodyA, bodyB, isSelected, isHovered, scale),
  renderSim(ctx, jointState, scale),
  hitTest(worldPos, joint, bodyA, bodyB, threshold),
  properties: [{ key: 'maxLength', label: '最大长度', type: 'number', min: 0.1, step: 0.1, unit: 'm' }],
  toJointConfig(joint, bodyA, bodyB),
})
```

**renderEdit 细节**：
- 计算锚点世界坐标：bodyA.position + rotate(joint.anchorA, bodyA.angle)，bodyB 同理
- worldToScreen 转屏幕坐标
- 直线 lineWidth=1.5，颜色：选中 `#3b82f6`，hover `#3b82f680`，默认 `#555`
- 锚点处画小圆点（半径 3px）

**renderSim 细节**：
- 从 JointState.anchorA/B 读取世界坐标（已由 PhysicsBridge.getJointStates 计算）
- worldToScreen 转屏幕坐标
- 同 renderEdit 画直线

**hitTest 细节**：
- 计算锚点世界坐标（同 renderEdit）
- pointToSegmentDistance(worldPos, anchorAWorld, anchorBWorld) < threshold

**toJointConfig 细节**：
- 局部锚点 → 世界坐标
- 返回 `{ id, type: 'rope', bodyIdA, bodyIdB, anchorA: worldA, anchorB: worldB, maxLength }`

### 2. PhysicsBridge.addJoint 实现 RopeJoint 分支

**文件**：`src/engine/PhysicsBridge.ts`

替换当前的占位逻辑，按 `config.type` 分支创建实际 Planck.js Joint：
- `type === 'rope'`：`world.createJoint(new RopeJoint({ maxLength }, bodyA, bodyB, anchorA, anchorB))`

注意：anchorA/B 是世界坐标，Planck.js RopeJoint 构造函数接受世界坐标锚点。

### 3. 在 index.ts 注册

**文件**：`src/models/jointTypes/index.ts`

添加 `import './rope'`

## 涉及文件

| 文件 | 操作 |
|------|------|
| `src/models/jointTypes/rope.tsx` | 新建 |
| `src/models/jointTypes/index.ts` | 添加 import |
| `src/engine/PhysicsBridge.ts` | addJoint 填充 RopeJoint 分支 |

## 验收标准

- [x] 用 JointTool 选"绳" → 点击物体A → 点击物体B → 绳创建成功，画布显示直线
- [x] 仿真模式：物块挂在锚点下方，像单摆摆动，绳线跟随运动
- [x] 点击绳线可选中，属性面板显示绳长可编辑
- [x] Delete 删除绳，Ctrl+Z 撤销创建/删除
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 松弛渲染：物体靠近时绳下垂弧线，弧度与绳长匹配
- [x] 编辑约束：拖拽物体受绳长钳制（static端）或联动（dynamic端）
- [x] 改绳长自动调整物体位置（缩短时拉近）
- [x] 改绳长画布立即刷新

## 执行记录

### 计划内改动（3 文件）
1. 新建 `src/models/jointTypes/rope.tsx` — rope descriptor
2. 修改 `src/engine/PhysicsBridge.ts` — RopeJoint 创建分支
3. 修改 `src/models/jointTypes/index.ts` — 注册 rope

### 发现并修复的 Bug（7 个）

| # | 现象 | 根因 | 修复 | 文件 |
|---|------|------|------|------|
| 1 | descriptor 接口只传 scale，无法 worldToScreen | 5.1 接口设计遗漏 | scale→Viewport | descriptor.ts, CanvasRenderer.ts |
| 2 | JointTool 缺少 worldToScreen 导入 + 签名错误 | 5.1 遗留 | 补导入，修签名 | JointTool.ts |
| 3 | 锚点仿真时掉落 | anchor defaults 缺 isStatic:true | 添加 defaults | anchor.tsx |
| 4 | 绳与物体脱离 + 仿真时位置错误 | getJointStates 把世界坐标当局部坐标变换 | 改用 joint.getAnchorA/B() | PhysicsBridge.ts |
| 5 | 绳仍然断开 | RopeJoint 构造函数误用（传了两个世界坐标锚点） | 改用 RopeJointDef + localAnchor | PhysicsBridge.ts |
| 6 | 松弛曲线弧长不匹配绳长 | sag 用任意系数 0.4 | 改用 V 形公式 √(L²-d²)/2 | rope.tsx |
| 7 | UI 改绳长画布不刷新 | renderFrame useCallback 闭包链路不可靠 | renderFrame 改为稳定函数，内部 getState() 读最新值 | Canvas.tsx |

### 超出计划的增强（3 个）
1. 绳松弛渲染（贝塞尔下垂曲线） — rope.tsx
2. 编辑模式绳约束拖拽（钳制 + 联动） — SelectTool.ts
3. 改绳长自动调整物体位置 — PropertyPanel.tsx

### 探索后搁置的需求（2 个）

**1. 锚点从中心改为表面连接**
- 用户反馈绳从物体中心连出不够真实
- 实现了 `surfaceAnchor.ts`（射线与矩形/圆交点算法）并集成到 JointTool
- 发现问题：圆形物体旋转时表面锚点跟着晃动；固定顶部策略不适用斜面+滑轮场景
- 探索了三种方案：朝向对方表面点 / 固定顶部 / 混合策略（圆形中心+矩形表面）
- 决策：回退到中心锚点，等教师用户反馈后再优化。已记录到 TODO.md

**2. 绳碰撞（搭在斜面角上）**
- 用户反馈绳穿透斜面而非搭在角上
- 根因：RopeJoint 是距离约束，无碰撞体积
- 实现方案：链式模拟（多段小刚体串联），复杂度高
- 决策：暂不实现，已记录到 TODO.md

## 技术备注

### Planck.js RopeJoint API
```typescript
import { RopeJoint, Vec2 } from 'planck-js'
world.createJoint(new RopeJoint(
  { maxLength: 2.0 },
  bodyA,        // Planck Body
  bodyB,        // Planck Body
  anchorA,      // Vec2 世界坐标
  anchorB,      // Vec2 世界坐标
))
```

### 局部锚点 → 世界坐标转换
```typescript
function localToWorld(
  local: { x: number; y: number },
  bodyPos: { x: number; y: number },
  bodyAngle: number,
): { x: number; y: number } {
  const cos = Math.cos(bodyAngle)
  const sin = Math.sin(bodyAngle)
  return {
    x: bodyPos.x + local.x * cos - local.y * sin,
    y: bodyPos.y + local.x * sin + local.y * cos,
  }
}
```

### 点到线段距离算法
```typescript
function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const abx = bx - ax, aby = by - ay
  const apx = px - ax, apy = py - ay
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)))
  const projX = ax + t * abx, projY = ay + t * aby
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}
```
