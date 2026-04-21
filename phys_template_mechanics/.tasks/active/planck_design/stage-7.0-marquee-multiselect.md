# 7.0 框选与多选

## 状态：已完成 ✅

## 任务 ID
03-26-stage7-0-marquee-multiselect

## 风险评估
- **任务类型**：交互系统重构 + 新功能
- **风险等级**：L1（常规风险）
  - selectionStore 从单选扩展为多选，消费端较多（13 文件）
  - 但多数文件只需 API 适配，逻辑不变
  - 不涉及物理引擎或数据链路
- **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

实现框选和 Shift+点击多选，为后续分析组创建提供基础交互能力。

## 上游依赖
- 7.0 设计方案已确认 ✅（`stage-7-analysis-system-design.md` 第 2.3 节）

## 下游消费
- 7.6 分析组：依赖多选能力，多选后出现"创建分析组"按钮

---

## 现有架构分析

### selectionStore 现状

```typescript
// src/store/selectionStore.ts
interface SelectionState {
  selected: SelectableObject | null    // ← 单选
  hovered: SelectableObject | null
  selectedForceId: string | null       // 力选中独立
  hoveredForceId: string | null
}
```

### 消费端影响分析（13 文件）

| 影响级别 | 文件 | 当前用法 | 改动说明 |
|---------|------|---------|---------|
| **HIGH** | `Canvas.tsx` | 读取 `selected`，提取 `selectedId`/`selectedJointId` 传给渲染器 | 改为从数组提取 ID 集合 |
| **HIGH** | `PropertyPanel.tsx` | `selected?.type === 'body'` 找单个 body 显示属性 | 多选时显示共有属性或提示"已选 N 个物体" |
| **HIGH** | `SelectTool.ts` | 读取 `selected` 做手柄 hitTest + 拖拽移动 | 多选拖拽整体移动；手柄仅单选时启用 |
| **MED** | `CanvasRenderer.ts` | `RenderOptions.selectedId` 单个 ID 对比高亮 | 改为 `selectedIds: string[]`，用 `includes()` |
| **MED** | `SelectionHandles.ts` | 接收单个 body 计算手柄 | 多选时不显示手柄 |
| **LOW** | `ForceTool.ts` | 只调用 `select()` 设置选中 | API 适配 |
| **LOW** | `JointTool.ts` | 只调用 `select()` 设置选中 | API 适配 |
| **LOW** | `ForceRenderer.ts` | `selectedForceId` 单力高亮 | 不影响（力选中独立于物体选中） |
| **NONE** | `AlignEngine.ts` | 不引用 selectionStore | 无改动 |
| **NONE** | `spring.tsx` | 接收 `isSelected` 参数 | 无改动 |
| **NONE** | `rod.tsx` | 接收 `isSelected` 参数 | 无改动 |
| **NONE** | `ground.tsx` | 接收 `isSelected` 参数 | 无改动 |

---

## 执行计划（6 步串行）

### 步骤 1：重构 selectionStore（单选 → 多选）

**文件**：`src/store/selectionStore.ts`

**改动**：
```typescript
// 之前
selected: SelectableObject | null
select: (obj: SelectableObject) => void
deselect: () => void

// 之后
selected: SelectableObject[]              // 空数组 = 无选中
select: (obj: SelectableObject) => void   // 清除已有，仅选中 obj（单击行为）
addToSelection: (obj: SelectableObject) => void    // 追加到选中集合
removeFromSelection: (obj: SelectableObject) => void // 从选中集合移除
toggleSelection: (obj: SelectableObject) => void   // 有则移除，无则追加（Shift+点击）
setSelection: (objs: SelectableObject[]) => void   // 直接设置整个选中集合（框选）
clearSelection: () => void                // 清空（替代 deselect）
```

**兼容辅助 getter**（简化消费端迁移）：
```typescript
// 便捷 selector，供消费端使用
const selectedBodyIds = (state) => state.selected.filter(s => s.type === 'body').map(s => s.id)
const selectedJointIds = (state) => state.selected.filter(s => s.type === 'joint').map(s => s.id)
const primarySelected = (state) => state.selected[0] ?? null  // 第一个选中项，用于属性面板等
```

**要点**：
- `select()` 保留单选语义（清除+设置），保证 ForceTool/JointTool 等不需要改逻辑
- `deselect()` 保留为 `clearSelection()` 的别名，减少迁移工作
- `selectedForceId` / `hoveredForceId` 不变（力选中独立）

### 步骤 2：适配 CanvasRenderer

**文件**：`src/renderer/CanvasRenderer.ts`

**改动**：
```typescript
// RenderOptions 接口
// 之前
selectedId?: string | null
hoveredId?: string | null
selectedJointId?: string | null
hoveredJointId?: string | null

// 之后
selectedIds?: string[]       // body ID 集合
hoveredId?: string | null    // hover 仍是单个
selectedJointIds?: string[]  // joint ID 集合
hoveredJointId?: string | null
```

**渲染逻辑改动**：
- `options.selectedId === body.id` → `options.selectedIds?.includes(body.id)`
- `options.selectedJointId === joint.id` → `options.selectedJointIds?.includes(joint.id)`
- 高亮样式不变（每个选中物体都画高亮边框）

### 步骤 3：适配 Canvas.tsx

**文件**：`src/components/Canvas.tsx`

**改动**：
- 读取 `selected` 后用 selector 提取 `selectedBodyIds` / `selectedJointIds`
- 传给 CanvasRenderer 的 `RenderOptions` 改为数组形式
- `handleDrop` 中 `select()` 保持不变（新建物体单选）
- 键盘事件 Delete：遍历 `selected` 删除所有选中物体/约束

### 步骤 4：适配 SelectTool（核心：框选 + 多选拖拽）

**文件**：`src/core/tools/SelectTool.ts`

#### 4a：框选交互

**新增状态**：
```typescript
private isMarqueeSelecting = false
private marqueeStart: Vec2 | null = null
private marqueeEnd: Vec2 | null = null
```

**onMouseDown**：
- 点击空白区域（无 hitTest 命中）时：
  - 不按 Shift → 记录 `marqueeStart`，等待拖拽
  - 按 Shift → 不处理（Shift+空白无意义）

**onMouseMove**：
- 如果 `marqueeStart` 存在且拖拽距离 > 3px → `isMarqueeSelecting = true`
- 更新 `marqueeEnd`，触发重绘

**onMouseUp**：
- 如果 `isMarqueeSelecting`：
  - 计算框选矩形内所有物体（AABB 交集判定）
  - `setSelection(hitBodies)` 设置选中
  - 重置 marquee 状态
- 如果不是框选（只是点击空白）：
  - `clearSelection()` 取消选中

#### 4b：Shift+点击

**onMouseDown**：
- hitTest 命中物体时：
  - 按 Shift → `toggleSelection({ type: 'body', id: hitId })`
  - 不按 Shift → `select({ type: 'body', id: hitId })`（单选）

#### 4c：多选拖拽移动

**当前逻辑**：单选物体时记录 `dragBodyId`，拖拽移动该物体。

**改动**：
- 如果拖拽的物体在选中集合中 → 移动所有选中物体（保持相对位置）
- 如果拖拽的物体不在选中集合中 → 先 `select()` 单选该物体，再移动
- 移动命令改为 `BatchMoveCommand`（一个 Command 包含多个物体的移动，一次 Ctrl+Z 全部撤销）

**新增状态**：
```typescript
private dragBodyIds: string[] = []
private dragOffsets: Map<string, Vec2> = new Map()  // 每个物体的拖拽偏移
```

#### 4d：手柄交互

- **多选时不显示手柄**（手柄仅在 `selected.length === 1 && selected[0].type === 'body'` 时显示）
- 逻辑不变，只加一个 `selected.length === 1` 的守卫条件

#### 4e：框选矩形渲染

**render() 方法新增**：
- 如果 `isMarqueeSelecting`，绘制蓝色半透明矩形 + 蓝色虚线边框

### 步骤 5：适配 PropertyPanel

**文件**：`src/components/panels/PropertyPanel.tsx`

**改动策略**：

- **单选物体** → 行为不变，显示完整属性面板
- **多选物体** → 显示简化面板：
  - 标题："已选中 N 个物体"
  - 显示物体列表（名称 + 类型）
  - 共有属性（如 friction、restitution）可批量编辑
  - 不显示力分析 Tab（力分析只在单选时有意义）
- **单选约束** → 行为不变
- **混合选中（物体+约束）** → 显示"已选中 N 个对象"，仅支持删除

**获取选中数据**：
```typescript
const selected = useSelectionStore(s => s.selected)
const primaryBody = selected.length === 1 && selected[0].type === 'body'
  ? scene.bodies.find(b => b.id === selected[0].id) : null
```

### 步骤 6：适配其余文件

**ForceTool.ts**：
- `select()` 调用不变（ForceTool 中选中是单选语义）
- `deselect()` → `clearSelection()`（如果 deselect 改名的话；或保留别名）

**JointTool.ts**：
- 同 ForceTool，`select()` 调用不变

**ForceRenderer.ts**：
- 不改（力选中独立于物体选中）

---

## 框选 hitTest 算法

```typescript
function getBodyIdsInRect(rect: { x1, y1, x2, y2 }, bodies: SceneBody[]): string[] {
  const result: string[] = []
  for (const body of bodies) {
    const aabb = getBodyAABB(body)  // 从 descriptor 获取
    if (rectsOverlap(rect, aabb)) {
      result.push(body.id)
    }
  }
  return result
}
```

- 使用 AABB 交集判定（简单高效）
- 复用现有 descriptor 的 `getAABB` 或从 body 位置+尺寸计算
- ground 不参与框选

---

## 验收标准

- [ ] 空白区域拖拽出现蓝色框选矩形，松手选中框内物体
- [ ] Shift+点击追加/移除选中
- [ ] 多选后拖拽整体移动（保持相对位置）
- [ ] 多选后 Delete 删除全部选中物体
- [ ] 点击空白（非拖拽）取消全部选中
- [ ] 单击物体（不按 Shift）仅选中该物体（取消其他）
- [ ] 多选时不显示缩放/旋转手柄
- [ ] 属性面板多选时显示"已选中 N 个物体"
- [ ] ForceTool / JointTool 正常工作（不受多选影响）
- [ ] Ctrl+Z 撤销多选移动（一次撤销全部）
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 不在本步骤做的事

- 创建分析组按钮（7.6 实现）
- 框选约束（只框选物体）
- 多选旋转/缩放（复杂度高，教学场景不需要）
- 多选属性批量编辑（MVP 后续考虑，本步骤只显示"已选中 N 个"）
