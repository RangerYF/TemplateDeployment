# 第3.3阶段：Body Type Registry 重构

- **所属计划**：PROGRESSIVE-PLAN.md
- **预计耗时**：1天
- **风险等级**：L1（纯重构，不改行为，不涉数据链路）
- **状态**：✅ 已完成
- **前置阶段**：第3.2阶段（已完成 11 种物体类型）

---

## 问题描述

当前架构按功能层分文件，每个文件内部用 switch/case 按 `body.type` 分发。新增或删除一个物体类型需要修改 **6 个文件、12+ 处代码**：

| 文件 | 耦合处数 | 职责 |
|------|---------|------|
| `models/types.ts` | 1 | BodyType 联合类型 |
| `models/defaults.ts` | 2 | LABEL_PREFIX + 工厂函数 |
| `engine/sceneSync.ts` | 2 | switch case + 特殊处理 if |
| `core/hitTest.ts` | 1 | switch case |
| `renderer/CanvasRenderer.ts` | 3 | renderSceneBody switch + renderSelectionHandles if 链 + renderBody |
| `panels/ObjectPanel.tsx` | 2 | icon switch + 分组数组 |
| `panels/PropertyPanel.tsx` | 1 | 条件渲染块 |
| `components/Canvas.tsx` | 1 | onDrop factories map |

根因：一个物体类型的完整描述（形状、物理、渲染、hitTest、默认值、属性面板、图标）分散在 6 个模块中，靠 switch/case 做"隐式注册"。

---

## 目标

引入 **Body Type Registry**（物体类型注册表），将每种物体的所有关注点收敛到一个描述对象中。各系统从注册表查询，不再做 switch。

**效果**：
- 新增物体 = 写 1 个描述文件 + 注册 1 行
- 删除物体 = 删 1 个文件 + 注销 1 行
- TS 接口强制实现全部方法，遗漏风险为零

---

## 设计方案

### BodyTypeDescriptor 接口

```typescript
// src/models/bodyTypes/descriptor.ts

interface PropertyDef {
  key: keyof SceneBody        // 对应 SceneBody 字段名
  label: string               // 面板显示标签，如 "宽度 (m)"
  type: 'number' | 'select'   // 控件类型
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string }>  // select 类型用
}

interface SelectionBounds {
  halfW: number
  halfH: number
}

interface SelectionCorners {
  corners: number[][]
}

interface BodyTypeDescriptor {
  type: BodyType
  label: string
  category: 'basic' | 'support' | 'mechanism' | 'surface'

  // --- 默认值 ---
  defaults: Partial<SceneBody>

  // --- 物理映射 (sceneSync) ---
  toShapeConfig(body: SceneBody): ShapeConfig | ShapeConfig[]
  toDensity(body: SceneBody): number
  toPhysicsType?(body: SceneBody): 'static' | 'dynamic'  // 不提供则走 isStatic 逻辑
  toUserData?(body: SceneBody): BodyConfig['userData']     // conveyor 等需要

  // --- 渲染 (CanvasRenderer) ---
  renderEdit(ctx: CanvasRenderingContext2D, body: SceneBody, scale: number): void
  renderSim?(ctx: CanvasRenderingContext2D, bodyState: BodyState, scale: number): void  // 不提供则走 shape 通用渲染

  // --- 选中框 ---
  getSelectionBounds(body: SceneBody, scale: number): SelectionBounds | SelectionCorners

  // --- hitTest ---
  hitTest(localX: number, localY: number, body: SceneBody): boolean

  // --- 属性面板 ---
  properties: PropertyDef[]

  // --- 图标 ---
  icon: React.FC<{ size: number }>
}
```

### 注册表

```typescript
// src/models/bodyTypes/registry.ts

const registry = new Map<BodyType, BodyTypeDescriptor>()

export function registerBodyType(desc: BodyTypeDescriptor): void {
  registry.set(desc.type, desc)
}

export function getBodyDescriptor(type: BodyType): BodyTypeDescriptor {
  const desc = registry.get(type)
  if (!desc) throw new Error(`Unknown body type: ${type}`)
  return desc
}

export function getAllDescriptors(): BodyTypeDescriptor[] {
  return Array.from(registry.values())
}

export function getDescriptorsByCategory(cat: string): BodyTypeDescriptor[] {
  return getAllDescriptors().filter(d => d.category === cat)
}
```

### 单个物体描述文件示例

```typescript
// src/models/bodyTypes/conveyor.ts

import { registerBodyType } from './registry'

function ConveyorIcon({ size }: { size: number }) { /* SVG */ }

registerBodyType({
  type: 'conveyor',
  label: '传送带',
  category: 'surface',

  defaults: {
    conveyorWidth: 5.0,
    conveyorHeight: 0.3,
    beltSpeed: 2.0,
    mass: 10,
    friction: 0.5,
    restitution: 0.2,
  },

  toShapeConfig: (body) => ({
    type: 'box',
    width: body.conveyorWidth ?? 5.0,
    height: body.conveyorHeight ?? 0.3,
  }),

  toDensity: (body) => {
    const w = body.conveyorWidth ?? 5.0
    const h = body.conveyorHeight ?? 0.3
    return body.isStatic ? 0 : body.mass / (w * h)
  },

  toUserData: (body) => ({
    bodyType: 'conveyor',
    beltSpeed: body.beltSpeed ?? 2.0,
  }),

  renderEdit: (ctx, body, scale) => {
    // 完整绘制逻辑（滚筒 + 纹理 + 箭头）
  },

  renderSim: (ctx, bodyState, scale) => {
    // 仿真模式动画绘制
  },

  getSelectionBounds: (body, scale) => ({
    halfW: ((body.conveyorWidth ?? 5.0) * scale) / 2,
    halfH: ((body.conveyorHeight ?? 0.3) * scale) / 2,
  }),

  hitTest: (lx, ly, body) => {
    const halfW = (body.conveyorWidth ?? 5.0) / 2
    const halfH = (body.conveyorHeight ?? 0.3) / 2
    return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH
  },

  properties: [
    { key: 'conveyorWidth', label: '宽度 (m)', type: 'number', min: 1, step: 0.5 },
    { key: 'conveyorHeight', label: '厚度 (m)', type: 'number', min: 0.1, step: 0.05 },
    { key: 'beltSpeed', label: '皮带速度 (m/s)', type: 'number', step: 0.5 },
  ],

  icon: ConveyorIcon,
})
```

---

## 消费端改造

### sceneSync.ts（消除 switch）

```typescript
// 改造前：60 行 switch
// 改造后：
function sceneBodyToBodyConfig(body: SceneBody): BodyConfig | null {
  if (body.type === 'ground') {
    // ground 保持特殊处理（内置物体）
    return { ... }
  }

  const desc = getBodyDescriptor(body.type)
  const shape = desc.toShapeConfig(body)
  const density = desc.toDensity(body)
  const physType = desc.toPhysicsType?.(body)
    ?? (body.isStatic ? 'static' : 'dynamic')
  const userData = desc.toUserData?.(body)

  return {
    id: body.id,
    type: physType,
    position: body.position,
    angle: body.angle,
    shape,
    density,
    friction: body.friction,
    restitution: body.restitution,
    fixedRotation: body.fixedRotation,
    userData,
  }
}
```

### hitTest.ts（消除 switch）

```typescript
function hitTestBody(worldPos, body): boolean {
  // ... 坐标变换到 local ...
  const desc = getBodyDescriptor(body.type)
  return desc.hitTest(localX, localY, body)
}
```

### CanvasRenderer.ts（消除 2 个 switch + 1 个 if 链）

```typescript
renderSceneBody(ctx, body, viewport, options): void {
  // ... 通用变换、颜色、描边设置 ...
  const desc = getBodyDescriptor(body.type)
  desc.renderEdit(ctx, body, scale)
  // ... 选中框 ...
  if (isSelected) {
    const bounds = desc.getSelectionBounds(body, scale)
    this.renderSelectionHandlesFromBounds(ctx, bounds)
  }
}

renderBody(ctx, bodyState, viewport): void {
  // ... 通用变换、颜色 ...
  // 先尝试自定义渲染
  if (bodyState.userData?.bodyType) {
    const desc = getBodyDescriptor(bodyState.userData.bodyType as BodyType)
    if (desc.renderSim) {
      desc.renderSim(ctx, bodyState, scale)
      ctx.restore()
      return
    }
  }
  // 否则走 shape 通用渲染（box/circle/polygon/chain）
  this.renderShape(ctx, bodyState.shape, scale)
}
```

### PropertyPanel.tsx（数据驱动，消除 10 个条件块）

```tsx
// 改造前：10 个 {body.type === 'xxx' && (...)} 块
// 改造后：
const desc = getBodyDescriptor(body.type)
{desc.properties.map(prop => (
  prop.type === 'select' ? (
    <PropertyRow key={prop.key} label={prop.label}>
      <select value={body[prop.key]} onChange={...}>
        {prop.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </PropertyRow>
  ) : (
    <PropertyRow key={prop.key} label={prop.label}>
      <NumberInput
        value={body[prop.key] as number}
        onCommit={(v) => changeProperty(prop.key, body[prop.key], v)}
        onLiveChange={(v) => liveUpdate(prop.key, v)}
        step={prop.step}
        min={prop.min}
        max={prop.max}
      />
    </PropertyRow>
  )
))}
```

### ObjectPanel.tsx（注册表驱动分组）

```tsx
// 改造前：手写 BASIC_OBJECTS / SUPPORT_OBJECTS 数组 + icon switch
// 改造后：
const categories = [
  { key: 'basic', title: '基础物体' },
  { key: 'support', title: '支撑面' },
  { key: 'mechanism', title: '机构' },
  { key: 'surface', title: '特殊表面' },
]

{categories.map(cat => {
  const items = getDescriptorsByCategory(cat.key)
  return (
    <ObjectGroup key={cat.key} title={cat.title}>
      {items.map(desc => (
        <DraggableItem key={desc.type} type={desc.type} label={desc.label} icon={<desc.icon size={20} />} />
      ))}
    </ObjectGroup>
  )
})}
```

### Canvas.tsx（消除 factories Record）

```typescript
// 改造前：手写 10 个 key-factory 映射
// 改造后：
const desc = getBodyDescriptor(bodyType as BodyType)
const newBody: SceneBody = {
  id: generateId(),
  type: desc.type,
  label: generateLabel(desc.type, existingBodies),
  position: worldPos,
  angle: 0,
  isStatic: false,
  fixedRotation: false,
  mass: 1,
  friction: 0.3,
  restitution: 0.2,
  initialVelocity: { x: 0, y: 0 },
  ...desc.defaults,
}
```

### defaults.ts（大幅精简）

```typescript
// 改造前：10 个 createDefaultXxx 工厂函数 + LABEL_PREFIX
// 改造后：
// - LABEL_PREFIX 不再需要（label 在 descriptor 中）
// - 10 个工厂函数不再需要（defaults 在 descriptor 中）
// - 仅保留 generateId() 和 generateLabel()（从 registry 读 label）
// - createGround() 保留（内置特殊物体）
```

---

## 文件结构

```
src/models/bodyTypes/
├── descriptor.ts          # BodyTypeDescriptor 接口 + PropertyDef 类型
├── registry.ts            # 注册表 + 查询 API
├── index.ts               # 统一导出 + 触发全部注册（import 所有物体文件）
├── block.ts               # 物块
├── ball.ts                # 球体
├── bar.ts                 # 杆件
├── slope.ts               # 斜面
├── wall.ts                # 墙壁
├── anchor.ts              # 固定锚点
├── pulleyMount.ts         # 滑轮座
├── conveyor.ts            # 传送带
├── hemisphere.ts          # 半球面
└── groove.ts              # V形槽
```

---

## 子任务链路

```
T3.3.1 创建 descriptor 接口 + registry 模块
→ T3.3.2 迁移全部 10 种物体到描述文件
→ T3.3.3 改造 sceneSync.ts + hitTest.ts（消除 switch）
→ T3.3.4 改造 CanvasRenderer.ts（消除 switch + if 链）
→ T3.3.5 改造 PropertyPanel.tsx + ObjectPanel.tsx（数据驱动）
→ T3.3.6 改造 Canvas.tsx + 精简 defaults.ts
→ T3.3.7 验证 + 回归测试
```

---

## T3.3.1 创建 descriptor 接口 + registry 模块

**目标**：建立基础设施

**任务**：
1. 创建 `src/models/bodyTypes/descriptor.ts` — 定义 BodyTypeDescriptor、PropertyDef 接口
2. 创建 `src/models/bodyTypes/registry.ts` — 注册表 Map + registerBodyType / getBodyDescriptor / getAllDescriptors / getDescriptorsByCategory
3. 创建 `src/models/bodyTypes/index.ts` — 空的统一入口

**验收**：`pnpm tsc --noEmit` 通过

---

## T3.3.2 迁移全部 10 种物体到描述文件

**目标**：将现有 switch 中分散的逻辑搬到描述文件

**任务**：
1. 逐个创建 10 个物体描述文件（block.ts ~ groove.ts）
2. 每个文件从当前 6 个源文件中提取对应 case 的逻辑
3. 在 index.ts 中 import 全部物体文件触发注册
4. **不改消费端**，仅确保注册表数据正确

**注意**：
- renderEdit 函数从 CanvasRenderer.renderSceneBody 的对应 case 中提取
- renderSim 仅 conveyor 需要（其他走通用 shape 渲染）
- hitTest 从 hitTest.ts 对应 case 提取
- toShapeConfig/toDensity 从 sceneSync.ts 对应 case 提取
- properties 从 PropertyPanel.tsx 对应条件渲染块中归纳
- icon 从 ObjectPanel.tsx 对应 switch case 提取
- ground 不进入 registry（内置特殊物体，保留原始处理）

**验收**：`pnpm tsc --noEmit` 通过，注册表可被导入且包含 10 种物体

---

## T3.3.3 改造 sceneSync.ts + hitTest.ts

**目标**：用注册表替换 switch

**任务**：
1. `sceneSync.ts`：sceneBodyToBodyConfig 改为 registry 查询，ground 保持特殊处理
2. `hitTest.ts`：hitTestBody 改为 registry 查询

**验收**：
- `pnpm tsc --noEmit` 通过
- 原有物体在编辑模式可选中、仿真模式物理行为不变

---

## T3.3.4 改造 CanvasRenderer.ts

**目标**：消除 renderSceneBody 的 switch 和 renderSelectionHandles 的 if 链

**任务**：
1. renderSceneBody：通用部分（变换、颜色、描边）保留，形状绘制委托给 `desc.renderEdit()`
2. renderSelectionHandles：改为从 `desc.getSelectionBounds()` 获取边界
3. renderBody：检查 userData.bodyType，有自定义 renderSim 则调用，否则走通用 shape 渲染
4. 抽取通用 shape 渲染为独立方法 `renderShape(ctx, shape, scale)`

**验收**：
- `pnpm tsc --noEmit` 通过
- 所有物体在编辑模式和仿真模式渲染正确

---

## T3.3.5 改造 PropertyPanel.tsx + ObjectPanel.tsx

**目标**：数据驱动的面板，消除 10 个条件渲染块和 icon switch

**任务**：
1. `PropertyPanel.tsx`：形状属性区域改为遍历 `desc.properties` 数组渲染
   - number → NumberInput
   - select → select 下拉框
2. `ObjectPanel.tsx`：
   - 移除 IconType、ObjectItem、BASIC_OBJECTS 等手写数据
   - 从 registry 按 category 分组获取物体列表
   - icon 从 `desc.icon` 组件渲染

**验收**：
- `pnpm tsc --noEmit` 通过
- 面板显示与改造前一致

---

## T3.3.6 改造 Canvas.tsx + 精简 defaults.ts

**目标**：消除 factories Record + 清理废弃代码

**任务**：
1. `Canvas.tsx`：handleDrop 改为从 registry 获取 defaults 构造 SceneBody
2. `defaults.ts`：
   - 删除 10 个 createDefaultXxx 工厂函数
   - 删除 LABEL_PREFIX（label 从 registry 读取）
   - 保留 generateId()、generateLabel()（改为从 registry 读 label）、createGround()
3. 清理不再使用的 import

**验收**：
- `pnpm tsc --noEmit && pnpm lint` 通过
- 拖拽创建所有物体正常

---

## T3.3.7 验证 + 回归测试

**目标**：确保重构零行为变化

**验收清单**：
- [ ] 11 种物体全部可从面板拖出到画布
- [ ] 每种物体选中后属性面板显示正确
- [ ] 修改属性后画布实时更新
- [ ] 仿真模式行为正确（传送带带动、半球面滑动、V形槽支撑）
- [ ] Undo/Redo 正常
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 涉及文件范围

```
新增文件（13个）：
├── src/models/bodyTypes/descriptor.ts
├── src/models/bodyTypes/registry.ts
├── src/models/bodyTypes/index.ts
├── src/models/bodyTypes/block.ts
├── src/models/bodyTypes/ball.ts
├── src/models/bodyTypes/bar.ts
├── src/models/bodyTypes/slope.ts
├── src/models/bodyTypes/wall.ts
├── src/models/bodyTypes/anchor.ts
├── src/models/bodyTypes/pulleyMount.ts
├── src/models/bodyTypes/conveyor.ts
├── src/models/bodyTypes/hemisphere.ts
└── src/models/bodyTypes/groove.ts

修改文件（7个）：
├── src/engine/sceneSync.ts           # switch → registry 查询
├── src/core/hitTest.ts               # switch → registry 查询
├── src/renderer/CanvasRenderer.ts    # switch → registry 查询
├── src/components/panels/ObjectPanel.tsx   # 数据驱动
├── src/components/panels/PropertyPanel.tsx # 数据驱动
├── src/components/Canvas.tsx         # factories → registry
└── src/models/defaults.ts            # 精简，删除 10 个工厂函数
```

---

## 下一阶段影响

重构完成后，第4阶段（约束系统）新增的约束类型可以参考同样的 Registry 模式，避免重蹈覆辙。
