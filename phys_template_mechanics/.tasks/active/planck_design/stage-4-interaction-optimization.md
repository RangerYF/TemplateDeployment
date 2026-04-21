# 第4阶段：编辑交互优化

## 阶段目标

提升编辑模式下的场景搭建体验，使教师能直观地将物体放在地面上、斜面上，能旋转和缩放物体，能对齐排列多个物体。

完成后，教师可以在编辑器中搭建"物块在斜面上滑动"、"两物块在水平面碰撞"等经典力学场景。

---

## 前置依赖

- 阶段3.3 BodyTypeDescriptor Registry 已完成
- 10种物体类型均有 `getSelectionBounds`、`hitTest`、`renderEdit` 方法
- SelectTool 已实现选中 + 拖拽移动
- Command 系统已有 `MoveBodyCommand`、`ChangePropertyCommand`

---

## 任务拆分

### 4.1 选中手柄系统（旋转 + 缩放）

#### 4.1.1 当前选中手柄现状

- `CanvasRenderer.renderSelectionHandles` 在选中物体四角画 8×8px 蓝色方块
- 通过 `desc.getSelectionBounds(body, scale)` 获取边界（返回 `{halfW, halfH}` 或 `{corners}`）
- **当前手柄仅做视觉装饰，无任何交互响应**

#### 4.1.2 手柄交互设计

**手柄类型与布局：**

```
        [旋转柄]          ← 顶部中心上方 20px，圆形
           |
  [NW]---[N]---[NE]      ← 8个缩放手柄
   |               |
  [W]    物体    [E]
   |               |
  [SW]---[S]---[SE]
```

- **角手柄（NW/NE/SW/SE）**：等比缩放
- **边中点手柄（N/S/E/W）**：单轴缩放
- **旋转柄**：顶部中心上方，拖拽旋转物体

**交互行为：**

| 手柄 | 拖拽效果 | 光标样式 | Command |
|------|---------|---------|---------|
| 角手柄 | 等比缩放 width/height（或 radius） | `nwse-resize` / `nesw-resize` | `ChangePropertyCommand` |
| N/S 手柄 | 改变 height（保持 width） | `ns-resize` | `ChangePropertyCommand` |
| E/W 手柄 | 改变 width（保持 height） | `ew-resize` | `ChangePropertyCommand` |
| 旋转柄 | 改变 angle | `grab` → `grabbing` | `ChangePropertyCommand` |

**约束规则：**
- 最小尺寸限制：width/height >= 0.1m，radius >= 0.05m
- ball 类型只有角手柄（等比缩放 radius），无边中点手柄
- ground 类型不显示手柄（不可缩放/旋转）
- 旋转时以物体中心为旋转轴

#### 4.1.3 实现方案

**新增文件：`src/core/handles/SelectionHandles.ts`**

```ts
interface HandleInfo {
  id: HandleType  // 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate'
  position: Vec2  // 屏幕坐标（相对物体中心，已考虑旋转）
  cursor: string
}

interface SelectionHandles {
  // 根据物体类型和边界，计算手柄位置
  getHandles(body: SceneBody, scale: number): HandleInfo[]

  // 鼠标位置命中哪个手柄
  hitTestHandle(mouseLocal: Vec2, handles: HandleInfo[]): HandleType | null

  // 拖拽手柄时，计算新的属性值
  computeResize(
    handleType: HandleType,
    dragDelta: Vec2,
    body: SceneBody,
    scale: number
  ): Partial<SceneBody>

  computeRotation(
    mouseWorldPos: Vec2,
    bodyCenter: Vec2
  ): number  // 新角度
}
```

**修改文件：**

1. **`SelectTool.ts`** — 扩展拖拽逻辑：
   - `onMouseDown`：先检测是否命中手柄 → 是则进入缩放/旋转模式
   - `onMouseMove`：根据当前模式（移动 / 缩放 / 旋转）执行不同计算
   - `onMouseUp`：根据模式生成对应 Command

2. **`CanvasRenderer.ts`** — `renderSelectionHandles` 扩展：
   - 角手柄改为空心方块（区分边中点的实心）
   - 新增旋转柄渲染（圆形 + 连接线）
   - 根据物体类型决定显示哪些手柄

---

### 4.2 表面吸附系统

#### 4.2.1 核心抽象：SnapSurface

**新增文件：`src/core/snap/types.ts`**

```ts
interface SnapSurface {
  type: 'rest' | 'contact'
  // 'rest' = 承载面（其他物体可以放上来）
  // 'contact' = 接触面（这个物体用来放在别人上面）

  // 世界坐标线段
  start: { x: number; y: number }
  end: { x: number; y: number }

  // 外法线方向（归一化，世界坐标）
  normal: { x: number; y: number }
}

interface SnapResult {
  // 吸附后的物体位置
  position: { x: number; y: number }
  // 吸附后的物体角度
  angle: number
  // 吸附到的目标面（用于视觉反馈高亮）
  targetSurface: SnapSurface
  // 吸附距离（用于判断是否在阈值内）
  distance: number
}
```

#### 4.2.2 BodyTypeDescriptor 扩展

在 `descriptor.ts` 中新增可选方法：

```ts
interface BodyTypeDescriptor {
  // ...现有方法...

  /** 返回该物体在世界坐标中的吸附面列表 */
  getSnapSurfaces?(body: SceneBody): SnapSurface[]
}
```

**各物体类型的吸附面定义：**

| 物体 | rest 面 | contact 面 |
|------|---------|------------|
| **ground** | 顶面：`y=0` 全宽水平线 | 无 |
| **block** | 顶面：`y = pos.y + h/2`（旋转后） | 底面：`y = pos.y - h/2`（旋转后） |
| **ball** | 无（曲面不适合承载） | 最低点（切点，法线方向为圆心→接触点） |
| **slope** | 斜边（v1→v2，旋转到世界坐标） | 底边（v0→v1，旋转到世界坐标） |
| **wall** | 顶面 + 左侧面 + 右侧面 | 底面 |
| **conveyor** | 顶面 | 底面 |
| **bar** | 顶面 | 底面 |
| **anchor** | 无 | 根据 mountSide 决定（top→底点，left→右点，right→左点） |
| **pulley-mount** | 无 | 顶点（悬挂在上方表面） |
| **hemisphere** | 暂不实现曲面吸附 | 暂不实现 |
| **groove** | 暂不实现斜面内壁吸附 | 暂不实现 |

#### 4.2.3 吸附计算引擎

**新增文件：`src/core/snap/SnapEngine.ts`**

```ts
class SnapEngine {
  private threshold: number = 0.3  // 世界坐标，约 15-20px

  /**
   * 核心方法：给定被拖拽的物体和场景中所有物体，计算最佳吸附结果
   */
  computeSnap(
    draggedBody: SceneBody,
    allBodies: SceneBody[],
    disabled: boolean  // Alt 键按住时为 true
  ): SnapResult | null

  /**
   * 水平面吸附：contact 底面 → rest 水平顶面
   * 仅需 y 坐标对齐
   */
  private computeHorizontalSnap(
    contactSurface: SnapSurface,
    restSurface: SnapSurface,
    body: SceneBody
  ): SnapResult | null

  /**
   * 斜面吸附：contact 面 → rest 斜面
   * 需要旋转对齐 + 法线偏移
   */
  private computeSlopeSnap(
    contactSurface: SnapSurface,
    restSurface: SnapSurface,
    body: SceneBody
  ): SnapResult | null
}
```

#### 4.2.4 水平面吸附算法（Step-by-step）

场景：物块拖拽靠近地面

```
输入：
  draggedBody = block, position=(2, 1.5), h=1
  ground rest 面 = { start:(-50,0), end:(50,0), normal:(0,1) }

Step 1：获取 block 的 contact 面
  contact 底面 y = body.position.y - h/2 = 1.5 - 0.5 = 1.0

Step 2：计算距离
  distance = |contact底面.y - rest顶面.y| = |1.0 - 0| = 1.0
  1.0 > threshold(0.3) → 不吸附

... 用户继续拖拽，block position 变为 (2, 0.6) ...

Step 2（重算）：
  contact底面.y = 0.6 - 0.5 = 0.1
  distance = |0.1 - 0| = 0.1 < 0.3 → 触发吸附！

Step 3：计算吸附位置
  吸附后 position.y = rest.y + h/2 = 0 + 0.5 = 0.5
  吸附后 position.x = 保持不变 = 2
  吸附后 angle = 保持不变

Step 4：输出
  SnapResult = {
    position: { x: 2, y: 0.5 },
    angle: 0,
    targetSurface: ground的rest面,
    distance: 0.1
  }
```

#### 4.2.5 斜面吸附算法（Step-by-step）

场景：物块拖拽靠近斜面

```
输入：
  draggedBody = block, position=(p), width=1, height=1, angle=0
  slope rest 面（斜边）= { start: v1_world, end: v2_world, normal: n }

Step 1：计算斜面参数
  斜边方向 tangent = normalize(v2 - v1)
  法线 n = (-tangent.y, tangent.x)  // 指向斜面外侧（上方）
  斜面角度 slopeAngle = atan2(tangent.y, tangent.x)

Step 2：将 block 中心投影到斜边所在直线
  projDist = dot(bodyPos - v1, n)  // 物体中心到斜面的有符号距离

Step 3：判断是否在吸附范围
  // block 旋转到与斜面平行后，底面到中心的距离 = h/2
  expectedDist = h / 2
  gap = |projDist - expectedDist|
  gap < threshold → 触发吸附

Step 4：计算吸附位置
  // 投影点（物体中心在斜面上的最近点）
  projPoint = bodyPos - n * projDist
  // 吸附位置 = 投影点 + 法线方向偏移 h/2
  snapPos = projPoint + n * (h / 2)

Step 5：计算吸附角度
  snapAngle = slopeAngle  // 物体旋转到与斜面平行

Step 6：边界检查
  // 确保吸附点在斜边线段范围内（不超出两端）
  t = dot(snapPos - v1, tangent) / length(v2 - v1)
  0 <= t <= 1 → 有效

Step 7：输出
  SnapResult = { position: snapPos, angle: snapAngle, targetSurface, distance: gap }
```

**球体在斜面上的特殊处理：**
```
ball 不需要旋转对齐，angle 保持不变
偏移量 = radius（而不是 h/2）
snapPos = projPoint + n * radius
```

#### 4.2.6 集成点

1. **`SelectTool.onMouseMove`**（拖拽移动物体时）：
   - 计算新位置后，调用 `SnapEngine.computeSnap()`
   - 若有 SnapResult，用吸附位置替代原始位置
   - 将 SnapResult 传给渲染层用于视觉反馈

2. **`Canvas.tsx handleDrop`**（从面板拖入新物体时）：
   - 物体创建后，立即调用 `SnapEngine.computeSnap()`
   - 若有吸附结果，修正物体初始位置和角度

3. **视觉反馈**（`CanvasRenderer` 或 `SelectTool.render`）：
   - 高亮目标 rest 面（蓝色加粗线段）
   - 在吸附位置绘制半透明幽灵预览

---

### 4.3 对齐辅助线

#### 4.3.1 对齐类型

| 对齐类型 | 检测条件 | 视觉表现 |
|---------|---------|---------|
| 中心水平对齐 | 两物体 `position.y` 差 < 阈值 | 水平蓝色虚线穿过两者中心 |
| 中心垂直对齐 | 两物体 `position.x` 差 < 阈值 | 垂直蓝色虚线穿过两者中心 |
| 顶边对齐 | 物体A顶边 y ≈ 物体B顶边 y | 水平虚线沿对齐边 |
| 底边对齐 | 物体A底边 y ≈ 物体B底边 y | 水平虚线沿对齐边 |
| 左边对齐 | 物体A左边 x ≈ 物体B左边 x | 垂直虚线沿对齐边 |
| 右边对齐 | 物体A右边 x ≈ 物体B右边 x | 垂直虚线沿对齐边 |

#### 4.3.2 实现方案

**新增文件：`src/core/align/AlignEngine.ts`**

```ts
interface AlignGuide {
  type: 'horizontal' | 'vertical'
  // 世界坐标中辅助线的位置
  position: number  // horizontal → y值，vertical → x值
  // 被拖拽物体应吸附到的坐标（对齐修正）
  snapValue: number
  // 对齐类型标注（用于调试/后续扩展）
  alignType: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

class AlignEngine {
  private threshold: number = 0.15  // 世界坐标

  /**
   * 计算对齐辅助线
   * @param draggedBody 正在拖拽的物体
   * @param allBodies 场景中所有其他物体
   * @returns 最多返回 1 条水平 + 1 条垂直辅助线
   */
  computeGuides(
    draggedBody: SceneBody,
    allBodies: SceneBody[]
  ): AlignGuide[]
}
```

**算法步骤：**

```
对拖拽物体 D，提取 5 个参考值：
  水平方向：center.y, top.y, bottom.y
  垂直方向：center.x, left.x, right.x

对场景中每个其他物体 B，提取同样 5 个值

遍历所有 (D参考值, B参考值) 对：
  若 |D值 - B值| < threshold：
    记录为候选对齐，存储 (辅助线位置, 吸附修正量)

水平方向取距离最近的一条，垂直方向取距离最近的一条
```

#### 4.3.3 视觉渲染

**在 `CanvasRenderer` 中新增 `renderAlignGuides` 方法：**

- 样式：`strokeStyle = '#3b82f6'`（蓝色），`lineWidth = 1`，`setLineDash([4, 4])`
- 范围：穿越整个可见视口
- 时机：仅在拖拽物体时渲染，松手后消失

#### 4.3.4 集成点

- **`SelectTool.onMouseMove`**（拖拽时）：
  1. 先计算表面吸附（SnapEngine）
  2. 再计算对齐辅助线（AlignEngine）
  3. 两者可叠加：吸附修正 position 后，对齐再微调 x 或 y
- **`SelectTool.render`**：渲染当前帧的辅助线

---

## 实现顺序建议

```
Step 1: 选中手柄系统
  1a. SelectionHandles 模块（手柄位置计算 + hitTest）
  1b. CanvasRenderer 手柄渲染升级
  1c. SelectTool 集成缩放/旋转交互

Step 2: 表面吸附系统
  2a. SnapSurface 类型定义 + SnapEngine 核心
  2b. 各物体类型实现 getSnapSurfaces（先做 ground/block/slope/wall）
  2c. SelectTool + Canvas.tsx 集成吸附
  2d. 吸附视觉反馈（高亮面 + 幽灵预览）

Step 3: 对齐辅助线
  3a. AlignEngine 核心
  3b. 辅助线渲染
  3c. SelectTool 集成对齐
```

---

## 涉及文件范围

**新增文件：**
- `src/core/handles/SelectionHandles.ts` — 手柄计算与命中检测
- `src/core/snap/types.ts` — SnapSurface / SnapResult 类型
- `src/core/snap/SnapEngine.ts` — 吸附计算引擎
- `src/core/align/AlignEngine.ts` — 对齐辅助线计算

**修改文件：**
- `src/models/bodyTypes/descriptor.ts` — 新增 `getSnapSurfaces?` 方法
- `src/models/bodyTypes/*.ts` — 各物体类型实现 getSnapSurfaces
- `src/core/tools/SelectTool.ts` — 集成手柄交互 + 吸附 + 对齐
- `src/renderer/CanvasRenderer.ts` — 手柄渲染升级 + 吸附反馈 + 辅助线渲染
- `src/components/Canvas.tsx` — handleDrop 集成吸附

---

## 验收标准

- [x] 选中物体后出现 4 个角手柄 + 边框 hover 缩放 + 弧形旋转柄
- [x] 拖拽角手柄可缩放物体（非等比，对角锚点固定），Ctrl+Z 可撤销
- [x] 拖拽旋转柄可旋转物体，Ctrl+Z 可撤销
- [x] 拖拽物块靠近地面时，自动吸附到地面顶部（底面贴合）
- [x] 拖拽物块靠近斜面时，自动吸附并旋转对齐斜面角度
- [x] 斜面底边靠近地面时，自动吸附到地面
- [x] 球体靠近斜面/地面时，正确吸附（圆心偏移 = 半径）
- [x] 吸附时目标表面蓝色高亮
- [x] 按住 Alt 键可禁用吸附，自由放置
- [x] 从面板拖入新物体时也触发吸附
- [x] 拖拽时出现对齐辅助线（中心/边缘对齐）
- [x] 松手时物体自动微调到对齐位置
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 暂不实现（留给后续阶段）

- 曲面吸附（hemisphere 内弧面、groove V形槽内壁）
- 等距辅助线
- 多选/框选后的批量缩放/旋转
- 吸附到网格（Grid Snap）
- 半透明幽灵预览（当前仅高亮目标面，未实现预览影子）

---

## 实施记录（2026-03-25）

### Bug 修复

**旋转方向与鼠标不一致**：
- 根因：`computeRotation` 使用 `atan2(dx, dy)` 计算角度，但物理引擎 angle 为 CCW 正方向，导致物体局部 Y-up `(-sin(a), cos(a))` 指向与鼠标相反
- 修复：改为 `atan2(-dx, dy)`

**缩放灵敏度过高**：
- 根因：每帧用累积增量（mouse - dragStart）叠加到已被修改的当前 body 尺寸上，相当于二次叠加
- 修复：保存 `dragStartBody` 快照，`computeResize` 始终基于原始尺寸 + 总增量计算绝对值

**缩放从中心等比**：
- 根因：角手柄用 `avgDelta = (dx + dy) / 2` 做等比，且 position 偏移对称
- 修复：角手柄改为独立双轴 `(sx * dx, sy * dy)`，中心偏移 = 尺寸变化的一半，使对角锚点固定

**旋转柄样式**：
- 原设计：顶部中心上方圆形 + 虚线连接
- 改为：左上角外侧弧形双向箭头图标 + SVG data URI 自定义旋转光标

### 第二轮 Bug 修复（2026-03-25）

**旋转开始瞬间抖动（角度跳变）**：
- 现象：开始旋转的一瞬间，物体跳到一个大角度，之后才跟随鼠标连续旋转
- 根因：`handleRotateDrag` 直接使用 `computeRotation` 计算绝对角度，但拖拽起始鼠标在 NW 角旋转柄位置而非正上方，第一帧计算出的角度与当前 body.angle 差距很大
- 修复：拖拽开始时记录 `rotateAngleOffset = body.angle - mouseAngle`，之后每帧 `newAngle = mouseAngle + offset`，实现从当前角度开始的平滑相对旋转

**边缘 hover 光标未变化**：
- 现象：鼠标浮到选中物体的边框上时，光标没有变成 resize 样式，但实际可以拖拽缩放
- 根因：`hitTestHandle` 返回 `edge-n/s/e/w`，但这些类型不在 `getHandles()` 返回的数组中（只有 4 角 + rotate），`updateHoverState` 中 `handles.find(h => h.id === handleHit)` 找不到匹配，光标回退为 `'default'`
- 修复：导出 `CURSOR_MAP`，hover 时直接 `CURSOR_MAP[handleHit]` 取光标
- 附带修复：边缘检测代码中左右边判断重复（左边 -halfW 检测了两次，右边 +halfW 漏掉），修正为 left→`edge-w`，right→`edge-e`

**旋转图标样式优化**：
- 原始实现：canvas 手动绘制弧线+箭头，样式不理想
- 重构：SVG 资源文件管理 `src/assets/icons/rotate.svg`，通过 `?raw` import + Blob URL 动态着色
- 旋转图标三态交互：
  - 默认：灰色（`#aaa`）
  - hover：黑色（`#333`），鼠标光标保持默认（图标变色已足够指示）
  - 拖拽旋转中：隐藏图标（鼠标保持可见），松手后图标恢复
- 新增 `RenderOptions.rotateIconState` 传递图标状态
- 新增 `SelectTool.rotateIconState` 属性暴露三态

**Canvas 重绘时机**：
- 问题：`rotateIconState` 变化时画布不重绘（非 React 状态，不触发 re-render）
- 修复：`handleMouseMove` 中 tool 处理后调用 `renderFrame()` 确保视觉状态同步

### 设计调整（与原计划差异）
- 原计划：8 个缩放柄 + 1 个旋转柄 → 实际：4 个角柄 + 边框 hover 检测 + 1 个旋转柄
- 原计划：等比缩放 → 实际：非等比，对角锚点固定
- 原计划：ChangePropertyCommand → 实际：BatchPropertyCommand（多属性同时修改）
- 新增 `src/core/snap/utils.ts`（坐标转换辅助，未在原计划中）
- 新增 `src/assets/icons/rotate.svg`（SVG 资源文件管理）
- anchor/pulley-mount/hemisphere/groove 未实现 getSnapSurfaces（暂不需要）

---

## 第三轮 Bug 修复

### 1. 斜面/半球面选中框位置偏移

- **现象**：斜面和半球面的选中框（角手柄 + 旋转手柄）没有包围住实际形状
- **根因**：`getSelectionBBox` 对 `corners` 格式计算 AABB 后，只返回 halfW/halfH 但忽略了 AABB 中心与 body 原点 (0,0) 的偏移。斜面的 AABB 垂直中心在 y=-h/6（非原点），半球面在 y=r/2
- **修复**：`SelectionBBox` 接口增加 `centerX/centerY` 偏移字段；`getHandles()` 和 `hitTestHandle()` 中所有坐标应用偏移
- **文件**：`src/core/handles/SelectionHandles.ts`

### 2. 斜面吸附完全失效（法线方向错误）

- **现象**：物块靠近斜面时不会自动吸附和旋转对齐，斜面也没有蓝色高亮反馈
- **根因**：slope.tsx 中 `createSnapSurface('rest', v1, v2, ...)` 的顶点顺序导致 `createSnapSurface` 的左手法线指向三角形**内部**而非外部。`computeSlopeSnap` 基于错误法线将物体推向斜面内侧，gap 远超阈值导致吸附不触发
- **修复**：交换顶点顺序为 `createSnapSurface('rest', v2, v1, ...)`，使法线指向三角形外部（上方）
- **连锁修复**：斜面蓝色高亮（依赖 snapResult）和面板拖入斜面吸附（handleDrop 中已有 computeSnap）同时恢复
- **文件**：`src/models/bodyTypes/slope.tsx`

### 3. 物块吸附斜面后描边重叠

- **现象**：物块吸附到斜面后，物块和斜面之间有轻微视觉重叠
- **根因**：几何计算完全正确（物块底面精确对齐斜面斜边），但 Canvas 描边 `lineWidth=2` 以几何边界为中心线向两侧各扩展 1px。物块底边和斜面斜边的描边各自向对方延伸 1px，沿整条线段产生 ~2px 的视觉重叠。球体因是切点接触（单像素），不可见
- **修复**：`computeSlopeSnap` 中为非球体增加 0.008m 法线偏移补偿描边重叠
- **文件**：`src/core/snap/SnapEngine.ts`

### 4. 对齐辅助线暂时关闭

- **原因**：用户反馈辅助线干扰操作体验
- **处理**：SelectTool 中 `handleMoveDrag` 移除 `computeAlignGuides` 调用，不再计算和显示辅助线
- **状态**：功能代码保留（AlignEngine.ts 未删除），后续可重新启用
- **文件**：`src/core/tools/SelectTool.ts`

### 5. 视口默认位置优化

- **现象**：地面默认在画布最底部，物体放在地面上时不在视野中央
- **修复**：默认 `offset.y` 从 0 改为 480，地面出现在画布中上部
- **文件**：`src/store/viewportStore.ts`

### 6. Ground 可交互

- **需求**：地面可选中、可上下拖拽调整高度
- **实现**：
  - `hitTest.ts`：ground 命中检测（鼠标距地面线 ±0.15m）
  - `SelectTool.ts`：ground 可选中拖拽，X 锁定只允许 Y 移动，hover 显示 `ns-resize`
  - `CanvasRenderer.ts`：ground 选中蓝色实线高亮 / hover 蓝色虚线
  - `SnapEngine.ts`：ground rest surface 使用实际 `body.position.y`
- **限制**：ground 不可删除、不可旋转、不可缩放

### 7. 地面样式优化

- **原样式**：一条线 + 下方大面积灰色填充
- **新样式**：物理课本风格 — 实线 + 下方 45° 斜线阴影（hatching，12px 高，8px 间距）
- **文件**：`src/renderer/CanvasRenderer.ts`

### 第三轮改动文件清单

```
src/core/handles/SelectionHandles.ts  — +centerX/centerY 偏移
src/models/bodyTypes/slope.tsx        — rest surface 顶点顺序修正
src/core/snap/SnapEngine.ts           — 非球体描边补偿 + ground Y 动态化
src/core/tools/SelectTool.ts          — 关闭辅助线 + ground 拖拽/hover
src/core/hitTest.ts                   — ground 命中检测
src/renderer/CanvasRenderer.ts        — ground 高亮 + hatching 样式 + groundY 动态化
src/store/viewportStore.ts            — 默认 offset.y=480
```
