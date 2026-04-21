# 阶段 8.0：Bug 修复

- **任务ID**: 03-28-stage8.0-bugfix
- **风险等级**: L1
- **状态**: 待执行
- **前置依赖**: 无（阶段8首个子阶段）

## 目标

修复 4 个用户反馈的核心 Bug，消除基础交互中的阻断性问题。

## Bug 列表与根因分析

### Bug-1: 物体可以移动到地面以下

**现象**：拖拽物体可以穿过地面，放到地面下方。

**根因**：`SelectTool.ts:488-537` 的 `handleMoveDrag` 直接调用 `moveBody()` 更新位置，没有检查物体 y 坐标是否低于地面高度。`sceneStore.moveBody()` 也完全信任调用者，无任何边界约束。

**关键文件**：
- `src/core/tools/SelectTool.ts` — `handleMoveDrag` 方法
- `src/store/sceneStore.ts` — `moveBody` 方法
- `src/models/bodyTypes/ground.tsx` — 地面 y 坐标来源

**修复方案**：
在 `handleMoveDrag` 中，计算新位置后、应用 moveBody 前，获取地面 y 坐标，根据被拖拽物体的底部边界（position.y - 半高度），限制 y 坐标不低于地面。需考虑物体有旋转角度时的 AABB 底边。

---

### Bug-2: 物体从斜面拖到地面不自动旋转回正

**现象**：物体在斜面上被自动旋转匹配斜面角度后，拖到地面虽有吸附高亮，但角度保持斜面的旋转值，没有回正。

**根因**：`SnapEngine.ts:72-115` 的 `computeHorizontalSnap()` 返回 `angle: body.angle`（保持原角度），没有将角度重置为 0。而 `computeSlopeSnap()` 会将角度设为 `slopeAngle`。

**关键文件**：
- `src/core/snap/SnapEngine.ts` — `computeHorizontalSnap` 方法

**修复方案**：
在 `computeHorizontalSnap` 返回结果中，将 `angle` 改为 `0`（或根据物体原始角度判断是否需要回正）。当物体吸附到水平面时，角度应重置为 0，使底面与水平面平齐。

---

### Bug-3: 球体拉右下角/左上角手柄无法顺畅改变大小

**现象**：球体拖右上角/左下角手柄可以顺畅缩放，但拖右下角/左上角不行或很不顺畅。

**根因**：`SelectionHandles.ts:175-185` 球体 resize 使用 `avgDelta = (localDx - localDy) / 2`，这个公式在右下角（dx>0, dy>0）和左上角（dx<0, dy<0）方向上 dx 和 -dy 会互相抵消，导致变化量接近 0。而右上角（dx>0, dy<0）和左下角（dx<0, dy>0）方向上 dx 和 -dy 同号，可以正常累加。

**关键文件**：
- `src/core/handles/SelectionHandles.ts` — `computeResize` 方法中的球体分支
- `src/core/tools/SelectTool.ts:819` — 调用处 y 轴翻转 `-localDy`

**修复方案**：
球体 resize 应改为：根据手柄位置和拖拽方向，将鼠标位移投影到从中心到手柄的对角线方向上，取该投影长度作为半径变化量。这样所有 4 个角手柄的行为一致。

具体实现：
```
// 手柄方向向量（从中心指向手柄）
const dir = { x: cornerSigns[handle].sx, y: cornerSigns[handle].sy }
const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y)
// 鼠标位移投影到手柄方向
const projection = (localDx * dir.x + localDy * dir.y) / len
const newR = Math.max(MIN_RADIUS, origRadius + projection / Math.sqrt(2))
```

---

### Bug-4: 属性面板输入框按 Delete 删除了物体

**现象**：选中滑轮后在属性面板的数值输入框中按 Delete/Backspace 想删除数字，结果滑轮被删除了。

**根因**：`Canvas.tsx:479-502` 在 window 上监听键盘事件，`Delete/Backspace` 触发删除选中物体，但**没有检查事件来源**（`e.target`）。输入框中的 Delete 按键事件冒泡到 window 后被全局处理器捕获。PropertyPanel 的 NumberInput 组件也没有对 Delete 键做 `stopPropagation`。

**关键文件**：
- `src/components/Canvas.tsx:479-502` — 全局 Delete 键处理
- `src/components/panels/PropertyPanel.tsx` — NumberInput 组件

**修复方案**：
在 Canvas.tsx 的全局键盘处理函数中，增加输入框焦点检测：
```typescript
if (e.key === 'Delete' || e.key === 'Backspace') {
  // 如果焦点在输入框/文本框中，不拦截
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  // ... 原有删除逻辑
}
```

## 执行计划

串行执行，按修复难度从小到大排序：

| 步骤 | Bug | 预计 |
|------|-----|------|
| 1 | Bug-4: Delete 键输入框冲突 | 15min |
| 2 | Bug-2: 吸附旋转回正 | 20min |
| 3 | Bug-1: 地面穿透限制 | 30min |
| 4 | Bug-3: 球体手柄 resize | 30min |
| 5 | 回归验证 + lint + tsc | 15min |

## 验收标准

✅ 在属性面板输入框中按 Delete 不会删除物体
✅ 物体从斜面拖到地面，自动旋转回正（角度归零）
✅ 拖拽物体到地面以下时自动限制在地面上
✅ 球体 4 个角手柄均可顺畅缩放
✅ `pnpm lint && pnpm tsc --noEmit` 通过

## 执行记录

（待执行时填写）
