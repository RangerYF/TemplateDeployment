# 6.1 力系统基础设施

## 状态：代码层完成，可观测层由 6.2 调试渲染覆盖

- 7 步计划全部执行，lint + tsc 通过
- 可观测性问题已由 6.2 阶段的调试渲染解决（仿真时显示力文字列表）
- ForceTool 创建外力 → 仿真 → 调试文字显示 F 标签，链路可验收

## 任务 ID
03-26-10-00-force-infrastructure

## 风险评估
- **任务类型**：新功能框架搭建
- **风险等级**：L1（常规风险）
  - 模式已有成熟参考（约束系统 5.1 完全对标）
  - 不涉及数据链路（力收集在 6.2）
  - 文件范围清晰，无高风险联动
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

搭建力系统的类型、Store、Command、Registry 框架和 ForceTool 骨架。本阶段完成后：
- `SceneForce` 类型完整可用
- sceneStore 支持力的 CRUD
- ForceTool 可在画布上拖拽创建外力（箭头暂不渲染，仅数据落地）
- 所有操作可 Ctrl+Z 撤销
- 工具栏出现力工具按钮

## 上游依赖
- 6.0 设计方案已确认 ✅

## 下游消费
- 6.2 力收集：依赖 SceneForce 类型 + forceStore CRUD
- 6.3 力渲染：依赖 ForceTypeDescriptor 的 renderEdit/renderSim + RenderOptions 扩展
- 6.4 视角+面板：依赖 viewMode + 力列表数据

---

## 执行计划（7 步串行）

### 步骤 1：扩展 SceneForce 类型定义

**文件**：`src/models/types.ts`

**当前状态**（第 78-81 行）：
```typescript
export interface SceneForce {
  id: string
  type: string
}
```

**目标扩展**：
```typescript
export type ForceType = 'external'
// 系统力（gravity/normal/friction/tension/spring）不存入 SceneForce，
// 由 ForceCollector 每帧计算（6.2）

export interface SceneForce {
  id: string
  type: ForceType
  targetBodyId: string        // 施力对象
  label: string               // 显示标签，如 "F₁"
  magnitude: number           // 力大小（N）
  direction: number           // 力方向（弧度，0=右，π/2=上）
  visible: boolean            // 是否在画布上显示
  decompose: boolean          // 是否显示正交分解
  decomposeAngle: number      // 分解坐标系角度（0=水平竖直）
}
```

**设计决策**：
- SceneForce 只存用户外力（可序列化、可撤销）
- 系统力（重力/支持力/摩擦力/张力）由引擎每帧计算，不持久化到 Scene
- 这与 p01 的做法一致，也与设计文档"系统力只读，不可编辑"的决策匹配

同时添加 `ForceType` 到导出，Scene 接口中 `forces: SceneForce[]` 已预留。

### 步骤 2：创建 ForceTypeDescriptor + forceRegistry

**新建目录**：`src/models/forceTypes/`

**文件 1**：`src/models/forceTypes/descriptor.ts`

```typescript
export interface ForceTypeDescriptor {
  type: ForceType
  label: string               // "外力"
  icon: string                // lucide 图标名或 emoji
  color: string               // 默认颜色（来自设计方案 A）
  letterSymbol: string        // "F"
  chineseName: string         // "外力"
  defaults: Partial<SceneForce>  // 默认属性值
  // 渲染和 hitTest 在 6.3 补充，此处先声明接口占位
}
```

**文件 2**：`src/models/forceTypes/registry.ts`
- 复用 jointRegistry 模式：`Map<ForceType, ForceTypeDescriptor>`
- 导出 `registerForceType()` / `getForceDescriptor()` / `getAllForceDescriptors()`

**文件 3**：`src/models/forceTypes/external.ts`
- 第一个 descriptor 实例：外力
- defaults: `{ magnitude: 10, direction: 0, visible: true, decompose: false, decomposeAngle: 0 }`
- color: `#ef4444`（红色）
- letterSymbol: `'F'`，chineseName: `'外力'`

**文件 4**：`src/models/forceTypes/index.ts`
- 导入 external.ts 触发注册
- 导出 registry 查询函数

### 步骤 3：扩展 sceneStore（Force CRUD）

**文件**：`src/store/sceneStore.ts`

参考 addJoint/removeJoint/updateJoint 实现，添加：
- `addForce(force: SceneForce)` — 追加到 `scene.forces`
- `removeForce(id: string)` — 过滤掉指定 id
- `updateForce(id: string, partial: Partial<SceneForce>)` — 合并更新

### 步骤 4：实现 Force Command 三件套

**文件 1**：`src/core/commands/AddForceCommand.ts`
```typescript
class AddForceCommand implements Command {
  constructor(private force: SceneForce)
  execute() → sceneStore.addForce(this.force)
  undo() → sceneStore.removeForce(this.force.id)
}
```

**文件 2**：`src/core/commands/RemoveForceCommand.ts`
```typescript
class RemoveForceCommand implements Command {
  constructor(force: SceneForce) → 深拷贝保留完整信息
  execute() → sceneStore.removeForce(this.force.id)
  undo() → sceneStore.addForce(this.force)
}
```

**文件 3**：`src/core/commands/ChangeForcePropertyCommand.ts`
```typescript
class ChangeForcePropertyCommand implements Command {
  constructor(forceId, key, oldValue, newValue)
  execute() → sceneStore.updateForce(id, { [key]: newValue })
  undo() → sceneStore.updateForce(id, { [key]: oldValue })
}
```

### 步骤 5：实现 ForceTool 骨架

**文件**：`src/core/tools/ForceTool.ts`

**状态机**：
```
IDLE → 等待点击物体
DRAGGING → 拖拽确定方向和大小
```

**核心流程**：
1. `onMouseDown`：hitTest 找到物体 → 记录 targetBodyId + 起点 → 进入 DRAGGING
2. `onMouseMove`：
   - 计算拖拽角度和距离
   - 智能吸附方向（6.0 设计方案 B）：
     - 生成候选方向集（全局 + 接触面 + 约束方向）
     - ±12° 内吸附到最近候选
     - Shift → 15° 网格；Alt → 禁用吸附
   - 实时预览：画虚线箭头（简单预览，正式渲染在 6.3）
3. `onMouseUp`：
   - 距离 < 10px → 取消
   - 否则 → 创建 SceneForce，执行 AddForceCommand
   - 回到 IDLE

**render 方法**：DRAGGING 状态时画预览箭头（虚线 + 力大小标签）

**方向吸附辅助函数**：`computeSnapDirection(bodyId, rawAngle, scene)` → 返回吸附后的角度
- 收集候选：全局 4 方向 + 接触面 4 方向 + 约束 4 方向
- 接触面角度：从 SnapEngine.getSnapSurfaces() 获取
- 约束角度：从 scene.joints 中找关联约束，计算连线方向

### 步骤 6：工具栏集成

**文件**：`src/components/Toolbar.tsx`

添加内容：
1. ForceTool 按钮（`MoveRight` 或 `ArrowRight` 图标 + "力" 文字）
2. 位置：约束工具按钮之后，分隔线之前
3. 激活态：`activeToolName === 'force'` → primary variant

同时添加视角切换按钮预留（6.4 完善逻辑，此处先放按钮占位）：
- Eye 图标 + "受力" 文字
- 位置：工具组与仿真按钮之间
- 此步骤只放 UI 占位，viewMode 状态在 6.4 实现

**文件**：`src/store/toolStore.ts`

`createTool` 添加 force case：
```typescript
case 'force':
  return new ForceTool()
```

### 步骤 7：RenderOptions 扩展 + 基础渲染入口

**文件**：`src/renderer/CanvasRenderer.ts`

RenderOptions 扩展：
```typescript
selectedForceId?: string | null
hoveredForceId?: string | null
```

renderScene 方法中添加力渲染调用占位（在物体渲染之后）：
```typescript
// TODO 6.3: renderForces(ctx, scene.forces, bodyStates, options)
```

**文件**：`src/components/Canvas.tsx`

在 hitTest 流程中添加力的检测占位：
```typescript
// TODO 6.3: force hitTest（力箭头点击检测）
```

---

## 涉及文件清单

### 新建文件（6个）
| 文件 | 作用 |
|------|------|
| `src/models/forceTypes/descriptor.ts` | ForceTypeDescriptor 接口 |
| `src/models/forceTypes/registry.ts` | forceRegistry 注册机制 |
| `src/models/forceTypes/external.ts` | 外力 descriptor 实例 |
| `src/models/forceTypes/index.ts` | 导出 + 注册触发 |
| `src/core/tools/ForceTool.ts` | 力工具实现 |
| `src/core/commands/AddForceCommand.ts` | 添加力命令 |

单独文件还是合并：RemoveForceCommand 和 ChangeForcePropertyCommand 可与 AddForceCommand 放在同一文件（如 `forceCommands.ts`），也可各自独立。参考约束系统（各自独立文件），保持一致。

### 新建文件（补充，独立 Command）
| 文件 | 作用 |
|------|------|
| `src/core/commands/RemoveForceCommand.ts` | 删除力命令 |
| `src/core/commands/ChangeForcePropertyCommand.ts` | 修改力属性命令 |

### 修改文件（5个）
| 文件 | 改动 |
|------|------|
| `src/models/types.ts` | 扩展 SceneForce + 新增 ForceType |
| `src/store/sceneStore.ts` | addForce / removeForce / updateForce |
| `src/store/toolStore.ts` | createTool 添加 force case |
| `src/renderer/CanvasRenderer.ts` | RenderOptions 扩展 + 渲染占位 |
| `src/components/Toolbar.tsx` | ForceTool 按钮 + 视角按钮占位 |

### 可能需要读取的文件（方向吸附依赖）
| 文件 | 用途 |
|------|------|
| `src/core/snap/SnapEngine.ts` | 获取接触面方向 |
| `src/components/Canvas.tsx` | hitTest 流程集成 |

---

## 验收标准

✅ `ForceType` 和 `SceneForce` 类型定义完整，TypeScript 编译通过
✅ `forceRegistry` 可注册和查询 external descriptor
✅ `sceneStore.addForce / removeForce / updateForce` 正常工作
✅ ForceTool 可从工具栏切换激活，光标变化正常
✅ ForceTool 点击物体→拖拽→创建 SceneForce 数据（控制台可验证）
✅ 方向智能吸附生效（水平/竖直方向 ±12° 内自动锁定）
✅ Ctrl+Z 可撤销添加的外力
✅ Delete 键可删除选中的外力（通过 selectionStore）
✅ `pnpm lint && pnpm tsc --noEmit` 通过

## 不包含的内容（留给后续子阶段）
- 力箭头的正式 Canvas 渲染（6.3）
- 引擎层力收集（6.2）
- 属性面板力列表（6.4）
- viewMode 状态逻辑（6.4）
- 仿真时 applyForce（6.2）
