# 第5.1阶段：约束系统基础设施

## 任务 ID
03-25-17-00-joint-infrastructure

## 风险评估
- **风险等级**：L1（常规风险）— 纯框架搭建，不涉及具体物理行为
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

搭建约束系统的全部框架代码（类型定义、Store、Command、Registry、JointTool 骨架、渲染入口、面板框架），但**不注册任何具体约束类型**。5.2 开始填充第一个约束（绳）。

完成后的状态：编译通过，JointTool 可从工具栏切换，但因 jointRegistry 为空，创建约束的功能暂不可用。

## 执行计划

按依赖顺序，共 14 个改动点，分 4 个批次串行执行。

---

### 批次 A：数据层（类型 + Store + Command）

#### A1. 扩展 SceneJoint 接口 + JointType 类型

**文件**：`src/models/types.ts`

**改动**：
- 新增 `JointType` 类型：`'rope' | 'rod' | 'spring' | 'pulley'`
- 扩展 `SceneJoint` 接口（替换现有占位定义）：
  ```typescript
  export type JointType = 'rope' | 'rod' | 'spring' | 'pulley'

  export interface SceneJoint {
    id: string
    type: JointType
    label: string
    bodyIdA: string
    bodyIdB: string
    anchorA: { x: number; y: number }  // 局部坐标
    anchorB: { x: number; y: number }  // 局部坐标
    // Rope
    maxLength?: number
    // Rod
    length?: number
    // Spring
    springLength?: number
    stiffness?: number       // frequencyHz
    damping?: number         // dampingRatio 0-1
    // Pulley
    pulleyMountId?: string
    ratio?: number
  }
  ```

#### A2. 新增 JointConfig / JointState 引擎类型

**文件**：`src/engine/types.ts`

**改动**：新增（追加到文件末尾）：
```typescript
export type JointConfigType = 'rope' | 'distance' | 'pulley'

export interface JointConfig {
  id: string
  type: JointConfigType
  bodyIdA: string
  bodyIdB: string
  anchorA: { x: number; y: number }  // 世界坐标
  anchorB: { x: number; y: number }  // 世界坐标
  maxLength?: number
  length?: number
  frequencyHz?: number
  dampingRatio?: number
  groundA?: { x: number; y: number }
  groundB?: { x: number; y: number }
  ratio?: number
}

export interface JointState {
  id: string
  type: JointConfigType
  anchorA: { x: number; y: number }
  anchorB: { x: number; y: number }
  groundA?: { x: number; y: number }
  groundB?: { x: number; y: number }
  reactionForce?: { x: number; y: number }
}
```

#### A3. 扩展 sceneStore

**文件**：`src/store/sceneStore.ts`

**改动**：在 `SceneActions` 接口和 store 实现中新增：
- `addJoint(joint: SceneJoint): void`
- `removeJoint(id: string): void`
- `updateJoint(id: string, partial: Partial<SceneJoint>): void`

实现模式与 addBody/removeBody/updateBody 完全对称。

#### A4. 新增三个 Command

**新建文件**：

1. `src/core/commands/AddJointCommand.ts`
   ```typescript
   // execute: sceneStore.addJoint(joint)
   // undo: sceneStore.removeJoint(joint.id) + deselect
   ```

2. `src/core/commands/RemoveJointCommand.ts`
   ```typescript
   // execute: sceneStore.removeJoint(joint.id) + deselect
   // undo: sceneStore.addJoint(joint)
   ```

3. `src/core/commands/ChangeJointPropertyCommand.ts`
   ```typescript
   // 与 ChangePropertyCommand 同模式，但操作 updateJoint
   // constructor(jointId, key, oldValue, newValue)
   ```

---

### 批次 B：Registry 框架

#### B1. JointTypeDescriptor 接口

**新建文件**：`src/models/jointTypes/descriptor.ts`

**内容**：定义 `JointTypeDescriptor` 接口和 `JointPropertyDef` 接口。

```typescript
import type { SceneBody, SceneJoint, JointType } from '@/models/types'
import type { JointConfig, JointState } from '@/engine/types'

export interface JointPropertyDef {
  key: keyof SceneJoint
  label: string
  type: 'number' | 'select'
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: Array<{ value: string; label: string }>
}

export interface JointTypeDescriptor {
  type: JointType
  label: string
  icon: string
  category: 'constraint'
  defaults: Partial<SceneJoint>

  /** 编辑模式渲染 — 需要 bodyA/bodyB 位置计算锚点世界坐标 */
  renderEdit(
    ctx: CanvasRenderingContext2D,
    joint: SceneJoint,
    bodyA: SceneBody,
    bodyB: SceneBody,
    scale: number,
    isSelected: boolean,
    isHovered: boolean,
  ): void

  /** 仿真模式渲染 — 从 JointState 读取实时锚点 */
  renderSim(
    ctx: CanvasRenderingContext2D,
    jointState: JointState,
    scale: number,
  ): void

  /** 点击检测 */
  hitTest(
    worldPos: { x: number; y: number },
    joint: SceneJoint,
    bodyA: SceneBody,
    bodyB: SceneBody,
    threshold: number,
  ): boolean

  /** 属性面板字段定义 */
  properties: JointPropertyDef[]

  /** 转换为引擎配置 — 需要 bodyA/bodyB 做局部→世界坐标转换 */
  toJointConfig(joint: SceneJoint, bodyA: SceneBody, bodyB: SceneBody): JointConfig

  /** 是否需要三步交互（pulley 用），默认 false */
  needsPulleyStep?: boolean
}
```

#### B2. jointRegistry 注册表

**新建文件**：`src/models/jointTypes/registry.ts`

```typescript
import type { JointType } from '@/models/types'
import type { JointTypeDescriptor } from './descriptor'

const registry = new Map<JointType, JointTypeDescriptor>()

export function registerJointType(desc: JointTypeDescriptor): void {
  registry.set(desc.type, desc)
}

export function getJointDescriptor(type: JointType): JointTypeDescriptor {
  const desc = registry.get(type)
  if (!desc) throw new Error(`Unknown joint type: ${type}`)
  return desc
}

export function getAllJointDescriptors(): JointTypeDescriptor[] {
  return Array.from(registry.values())
}
```

#### B3. index.ts 导出

**新建文件**：`src/models/jointTypes/index.ts`

```typescript
export { registerJointType, getJointDescriptor, getAllJointDescriptors } from './registry'
export type { JointTypeDescriptor, JointPropertyDef } from './descriptor'

// Joint type descriptors will be imported here as they are implemented:
// import './rope'   (5.2)
// import './rod'    (5.3)
// import './spring' (5.4)
// import './pulley' (5.5)
```

---

### 批次 C：引擎层 + JointTool

#### C1. PhysicsBridge 扩展

**文件**：`src/engine/PhysicsBridge.ts`

**改动**：
- 新增 `private joints: Map<string, { joint: Joint; config: JointConfig }>` 成员
- `addJoint(config: JointConfig): void` — 框架方法，根据 config.type switch 创建 Planck.js Joint（各分支在 5.2-5.5 填充，当前留空或 console.warn）
- `removeJoint(id: string): void` — `world.destroyJoint(entry.joint)`
- `getJointStates(): JointState[]` — 读取每个 joint 的 anchorA/anchorB 世界坐标
- `destroyWorld()` 中清理 joints Map
- `saveSnapshot()` / `restoreSnapshot()` 中处理 joint（重建同步由 sceneSync 负责，snapshot 无需特殊处理）

**import 新增**：从 planck-js 导入 `Joint`（基类，用于类型标注）

#### C2. sceneSync 扩展

**文件**：`src/engine/sceneSync.ts`

**改动**：
- 新增 `syncJointAdd(joint: SceneJoint, scene: Scene, bridge: PhysicsBridge): void`
  - 从 scene.bodies 查找 bodyA/bodyB
  - 调用 descriptor 的 `toJointConfig(joint, bodyA, bodyB)` 转换
  - 调用 `bridge.addJoint(config)`
- 新增 `syncJointRemove(id: string, bridge: PhysicsBridge): void`
  - 调用 `bridge.removeJoint(id)`
- `syncSceneToWorld` 扩展：在 body 同步完成后，遍历 `scene.joints` 调用 `syncJointAdd`

#### C3. JointTool 骨架

**新建文件**：`src/core/tools/JointTool.ts`

**内容**：
```typescript
import type { Tool, CanvasMouseEvent } from './Tool'
import type { Viewport } from '@/renderer/CoordinateSystem'
import type { JointType } from '@/models/types'

type JointToolState = 'idle' | 'picking_pulley' | 'picking_b'

export class JointTool implements Tool {
  name = 'joint'
  cursor = 'crosshair'

  /** 当前选择的约束子类型 */
  jointSubType: JointType = 'rope'

  private state: JointToolState = 'idle'
  private bodyIdA: string | null = null
  private pulleyMountId: string | null = null

  onMouseDown(e: CanvasMouseEvent): void {
    // 5.2 实现：hitTest 找物体 → 按状态机推进
  }

  onMouseMove(e: CanvasMouseEvent): void {
    // 5.2 实现：hover 高亮 + 预览线位置更新
  }

  onMouseUp(_e: CanvasMouseEvent): void {
    // JointTool 主要在 onMouseDown 处理点击
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.reset()
    }
  }

  render(_ctx: CanvasRenderingContext2D, _viewport: Viewport): void {
    // 5.2 实现：预览线渲染
  }

  private reset(): void {
    this.state = 'idle'
    this.bodyIdA = null
    this.pulleyMountId = null
  }
}
```

#### C4. toolStore 集成

**文件**：`src/store/toolStore.ts`

**改动**：
- import `JointTool`
- `createTool` switch 添加 `case 'joint': return new JointTool()`

---

### 批次 D：渲染 + UI + 选中

#### D1. CanvasRenderer 扩展

**文件**：`src/renderer/CanvasRenderer.ts`

**改动**：
- import `getJointDescriptor` from `@/models/jointTypes`
- import `SceneJoint`, `JointState` types
- `RenderOptions` 新增 `joints?: SceneJoint[]`
- `renderScene` 方法中，在 body 渲染之前（约束线在物体之下），新增：
  ```typescript
  // Render joints (below bodies)
  if (options.joints) {
    for (const joint of options.joints) {
      this.renderJoint(ctx, joint, bodies, viewport, options)
    }
  }
  ```
- 新增 `renderJoint` 私有方法：
  ```typescript
  private renderJoint(ctx, joint, bodies, viewport, options): void {
    const bodyA = bodies.find(b => b.id === joint.bodyIdA)
    const bodyB = bodies.find(b => b.id === joint.bodyIdB)
    if (!bodyA || !bodyB) return
    try {
      const desc = getJointDescriptor(joint.type)
      const isSelected = options.selectedId === joint.id  // 需扩展 selectedId 支持
      const isHovered = options.hoveredId === joint.id
      desc.renderEdit(ctx, joint, bodyA, bodyB, viewport.scale, isSelected, isHovered)
    } catch {
      // Unknown joint type, skip
    }
  }
  ```
- `render`（仿真模式）方法新增 `jointStates?: JointState[]` 参数，遍历调用 `desc.renderSim`
- `RenderOptions` 扩展：`selectedJointId?: string | null`、`hoveredJointId?: string | null`

#### D2. hitTest 扩展

**文件**：`src/core/hitTest.ts`

**改动**：新增 `hitTestJoints` 函数：
```typescript
import type { SceneJoint, SceneBody } from '@/models/types'
import { getJointDescriptor } from '@/models/jointTypes'

export function hitTestJoints(
  worldPos: { x: number; y: number },
  joints: SceneJoint[],
  bodies: SceneBody[],
  threshold: number,
): string | null {
  // 反向遍历（后创建的优先）
  for (let i = joints.length - 1; i >= 0; i--) {
    const joint = joints[i]
    const bodyA = bodies.find(b => b.id === joint.bodyIdA)
    const bodyB = bodies.find(b => b.id === joint.bodyIdB)
    if (!bodyA || !bodyB) continue
    try {
      const desc = getJointDescriptor(joint.type)
      if (desc.hitTest(worldPos, joint, bodyA, bodyB, threshold)) {
        return joint.id
      }
    } catch {
      // Unknown type, skip
    }
  }
  return null
}
```

#### D3. Canvas.tsx 集成

**文件**：`src/components/Canvas.tsx`

**改动**：
- `renderFrame` 编辑模式：传 `joints: scene.joints` 到 `renderScene` 的 options
- `renderFrame` 编辑模式：扩展 `selectedId` / `hoveredId` 支持 joint 选中
  ```typescript
  const selectedId = selected?.type === 'body' ? selected.id : null
  const selectedJointId = selected?.type === 'joint' ? selected.id : null
  const hoveredId = hovered?.type === 'body' ? hovered.id : null
  const hoveredJointId = hovered?.type === 'joint' ? hovered.id : null
  ```
- `renderFrame` 仿真模式：传 `physicsBridge.getJointStates()` 给 renderer
- Delete 键处理：扩展支持删除选中的 joint
  ```typescript
  if (sel?.type === 'joint') {
    const joint = useSceneStore.getState().scene.joints.find(j => j.id === sel.id)
    if (joint) {
      const cmd = new RemoveJointCommand(joint)
      useCommandStore.getState().execute(cmd)
      useSelectionStore.getState().deselect()
    }
  }
  ```

#### D4. SelectTool 扩展

**文件**：`src/core/tools/SelectTool.ts`

**改动**：
- import `hitTestJoints` from `@/core/hitTest`
- `onMouseDown`：在 body hitTest 之后，如果没命中 body，尝试 hitTestJoints
  ```typescript
  if (!hitId) {
    const jointHitId = hitTestJoints(e.worldPos, joints, bodies, 5 / scale)
    if (jointHitId) {
      useSelectionStore.getState().select({ type: 'joint', id: jointHitId })
      return  // joint 不支持拖拽移动
    }
  }
  ```
- `updateHoverState`：同理，body 没命中时尝试 joint hover
- joint 选中后不进入拖拽模式（约束不可拖拽）

#### D5. PropertyPanel 扩展

**文件**：`src/components/panels/PropertyPanel.tsx`

**改动**：
- import `getJointDescriptor` from `@/models/jointTypes`
- import `SceneJoint` type
- 在 body 查找逻辑之后，新增 joint 查找：
  ```typescript
  const joint = selected?.type === 'joint'
    ? scene.joints.find(j => j.id === selected.id)
    : null
  ```
- 当 `joint` 非空时，渲染约束属性面板：
  - 标题：`属性 - {joint.label}`
  - 从 `getJointDescriptor(joint.type).properties` 读取字段定义
  - 渲染每个 JointPropertyDef 为 NumberInput（复用现有 NumberInput 组件）
  - 提交时创建 `ChangeJointPropertyCommand`
  - 删除按钮：`RemoveJointCommand`
- 当 body 和 joint 都为空时，显示"选中物体查看属性"占位

#### D6. Toolbar 扩展

**文件**：`src/components/Toolbar.tsx`

**改动**：
- import `useToolStore` + `Link2` icon from lucide-react
- 在 Undo/Redo 按钮之后，增加工具切换区域：
  - "选择" 按钮（MousePointer icon）— 激活 SelectTool
  - "约束" 按钮（Link2 icon）— 激活 JointTool
  - 按钮样式：当前激活工具高亮
- 约束按钮点击后，展开子类型选择（下拉或 popover），列出 `getAllJointDescriptors()` 中注册的类型
  - 当前 registry 为空时，按钮可点击但下拉列表为空（5.2 开始有内容）
  - 选择子类型后：`setTool('joint')` + 设置 JointTool 的 jointSubType

---

## 涉及文件汇总

| 文件 | 操作 | 批次 |
|------|------|------|
| `src/models/types.ts` | 修改 | A |
| `src/engine/types.ts` | 修改 | A |
| `src/store/sceneStore.ts` | 修改 | A |
| `src/core/commands/AddJointCommand.ts` | 新建 | A |
| `src/core/commands/RemoveJointCommand.ts` | 新建 | A |
| `src/core/commands/ChangeJointPropertyCommand.ts` | 新建 | A |
| `src/models/jointTypes/descriptor.ts` | 新建 | B |
| `src/models/jointTypes/registry.ts` | 新建 | B |
| `src/models/jointTypes/index.ts` | 新建 | B |
| `src/engine/PhysicsBridge.ts` | 修改 | C |
| `src/engine/sceneSync.ts` | 修改 | C |
| `src/core/tools/JointTool.ts` | 新建 | C |
| `src/store/toolStore.ts` | 修改 | C |
| `src/renderer/CanvasRenderer.ts` | 修改 | D |
| `src/core/hitTest.ts` | 修改 | D |
| `src/components/Canvas.tsx` | 修改 | D |
| `src/core/tools/SelectTool.ts` | 修改 | D |
| `src/components/panels/PropertyPanel.tsx` | 修改 | D |
| `src/components/Toolbar.tsx` | 修改 | D |

共 **19 个文件**（7 新建 + 12 修改）

## 验收标准

- [ ] `pnpm lint && pnpm tsc --noEmit` 通过
- [ ] JointTool 可从工具栏切换激活（光标变为 crosshair）
- [ ] 工具栏显示"选择"和"约束"两个工具按钮，可切换
- [ ] jointRegistry 为空，约束子类型列表为空（预期行为）
- [ ] Delete 键逻辑已支持 joint 类型（当前不会触发，因为无法创建 joint）
- [ ] PropertyPanel 已有 joint 分支（当前不会触发）
- [ ] SelectTool 已有 joint hitTest 调用（当前不会触发）
- [ ] sceneSync.syncSceneToWorld 包含 joint 同步循环（当前 joints 为空跳过）
- [ ] 现有功能不受影响（物体拖放、选中、编辑、仿真等正常工作）

## 注意事项

1. **不引入任何具体 Joint 类型**：rope/rod/spring/pulley 的 descriptor 文件在 5.2-5.5 创建
2. **PhysicsBridge.addJoint 的 switch 分支留空**：各类型的 Planck.js Joint 创建代码在 5.2-5.5 填充
3. **保持现有功能不破坏**：所有新增代码路径在 joints 为空时自动跳过
4. **JointTool 的交互逻辑是骨架**：onMouseDown/onMouseMove/render 留空或最小实现，5.2 填充
