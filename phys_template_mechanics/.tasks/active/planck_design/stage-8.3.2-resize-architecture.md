# 阶段 8.3.2：统一变换系统重构

- **任务ID**: 03-30-stage8.3.2-resize-architecture
- **风险等级**: L2（跨模块联动，影响所有 body type 的选择/缩放行为）
- **状态**: ✅ 已完成
- **前置依赖**: 8.3.1 ✅

---

## 问题诊断

### 根因

`computeResize` 硬编码了 **"body origin = bbox center"** 假设：

```typescript
localCenterDy = (newH - origH) * sy / 2  // 只在 origin 恰好在 bbox 正中心时成立
```

每加一个 origin 不在中心的 body type（球槽 origin 在 rim 顶部），就要在 `computeResize` 里加 `if` hack。

### 现存架构债

| 问题 | 表现 |
|------|------|
| origin=center 假设 | hemisphere 需要 type-specific hack 补偿 Y 偏移 |
| `getBodyDimensions` 11 分支 switch | 新增 body type 必须改 `SelectionHandles.ts` |
| `setBodyDimensions` 11 分支 switch | 同上，且魔数（2.7, 1.55）散落在外部文件 |
| `circleR` special-case 路径 | ball/anchor/pulley 三种类型硬编码，每加一个圆形体就要改 |
| 维度信息散布三处 | `getSelectionBounds` / `getBodyDimensions` / `setBodyDimensions` 必须手动保持一致 |
| `getSelectionBounds` 两种返回格式 | `halfW/halfH` vs `corners`，增加消费端复杂度 |

### 业界对比

| 编辑器 | 做法 |
|--------|------|
| Fabric.js | 每个对象声明 `originX/originY`，resize 时自动以对角为 pivot |
| Konva | 独立 Transformer 组件，只操作 scale，不需要知道 shape 内部 |
| Excalidraw | 统一 `(x,y)=bbox 左上角`，resize 零 per-type 分支 |

**共同点：resize 系统不知道也不需要知道 shape 的具体类型。**

---

## 方案设计

### 核心思路：引入 `getLocalBBox` + `applyResize` + `resizeMode`

将维度映射从 `SelectionHandles.ts` 的集中式 switch-case **下放到各 body descriptor**。

### 新增接口

```typescript
// descriptor.ts 新增

interface LocalBBox {
  /** body origin 到 bbox 中心的屏幕坐标偏移（Y-down） */
  centerOffsetX: number
  centerOffsetY: number
  /** bbox 半宽 / 半高（物理单位，米） */
  halfW: number
  halfH: number
}

type ResizeMode = 'independent' | 'uniform' | 'radius'

// BodyTypeDescriptor 新增可选方法：
interface BodyTypeDescriptor {
  // ...existing...

  /** 缩放模式。默认 'independent'（双轴独立，如 block） */
  resizeMode?: ResizeMode

  /** 获取局部 bbox（物理单位）。如未定义，从 getSelectionBounds(body, 1) 推导 */
  getLocalBBox?(body: SceneBody): LocalBBox

  /** 给定新的 bbox 尺寸，返回需 merge 的 body props。如未定义，走 fallback */
  applyResize?(body: SceneBody, newHalfW: number, newHalfH: number): Partial<SceneBody> | null
}
```

### resizeMode 说明

| 模式 | 含义 | 适用场景 |
|------|------|----------|
| `independent` | 宽高独立缩放，拖宽不影响高 | 矩形类物体（方块、墙、杆件等） |
| `radius` | 只有一个半径参数，四角拖拽沿对角线投影等比缩放，边缘拖拽禁用 | 圆形类物体（球、锚点、滑轮座） |
| `uniform` | 宽高按同一比例缩放，保持长宽比不变 | 非等轴但需等比的物体（球槽） |

### 各 body type 实现

| body type | 中文名 | resizeMode | centerOffset | getLocalBBox | applyResize |
|-----------|--------|-----------|--------------|-------------|-------------|
| block | 物块 | independent | (0, 0) | halfW=w/2, halfH=h/2 | width=2*halfW, height=2*halfH |
| slope | 斜面 | independent | (0, -h/6) | halfW=base/2, halfH=height/2 | baseLength=2*halfW, slopeHeight=2*halfH |
| wall | 墙壁 | independent | (0, 0) | halfW=w/2, halfH=h/2 | wallWidth=2*halfW, wallHeight=2*halfH |
| bar | 杆件 | independent | (0, 0) | halfW=len/2, halfH=thick/2 | barLength=2*halfW, barThickness=2*halfH |
| conveyor | 传送带 | independent | (0, 0) | halfW=w/2, halfH=h/2 | conveyorWidth=2*halfW, conveyorHeight=2*halfH |
| groove | V形槽 | independent | (0, 0) | halfW=w/2, halfH=depth/2 | grooveWidth=2*halfW, grooveDepth=2*halfH |
| ball | 球体 | radius | (0, 0) | halfW=r, halfH=r | radius=halfW |
| anchor | 固定锚点 | radius | (0, 0) | halfW=r, halfH=r | anchorRadius=halfW |
| pulley-mount | 滑轮座 | radius | (0, 0) | halfW=r, halfH=r | pulleyRadius=halfW |
| hemisphere | 球槽 | uniform | (0, +0.775r) | halfW=1.35r, halfH=0.775r | hemisphereRadius 从主维度反推 |

### 通用 `computeResize` 重写

```
function computeResize(handle, localDx, localDy, origBody):
  desc = getBodyDescriptor(origBody.type)
  bbox = desc.getLocalBBox(origBody)      // 获取 origin offset + 尺寸
  mode = desc.resizeMode ?? 'independent'

  // 1. 根据 handle 方向和 mode 计算 newHalfW, newHalfH

  // 2. 用 origin offset 计算正确的 center shift：
  //    handleY_in_screen = centerOffsetY + sy * halfH
  //    newHandleY_in_screen = newCenterOffsetY + sy * newHalfH
  //    bodyShift = oppositeHandleY - newOppositeHandleY
  //    （保持"对角不动"）

  // 3. desc.applyResize(body, newHalfW, newHalfH) → props

  // 4. 旋转到世界坐标 → newPosition
```

**关键数学**（保持对角不动）：

```
对角 handle 在屏幕局部坐标（相对 body origin）：
  anchorX = centerOffsetX + (-sx) * halfW
  anchorY = centerOffsetY + (-sy) * halfH

resize 后：
  newAnchorX = newCenterOffsetX + (-sx) * newHalfW
  newAnchorY = newCenterOffsetY + (-sy) * newHalfH

body origin 位移 = anchor 前 - anchor 后：
  localShiftX = anchorX - newAnchorX
  localShiftY = anchorY - newAnchorY
```

对于 block（offset=0）：localShiftX = (-sx)*halfW - (-sx)*newHalfW = sx*(newHalfW-halfW) = sx*ΔW/2 ✓
对于 hemisphere（offsetY=0.775r）：自动正确，无需 hack。

---

## 执行步骤

| 步骤 | 任务 | 涉及文件 |
|------|------|----------|
| 1 | 在 `descriptor.ts` 添加 `LocalBBox`、`ResizeMode`、`getLocalBBox`、`applyResize` 接口 | `descriptor.ts` |
| 2 | 为每个 body type 实现 `getLocalBBox` + `applyResize` + `resizeMode` | 11 个 `bodyTypes/*.tsx` |
| 3 | 重写 `computeResize`，使用 descriptor 方法 + origin offset 公式 | `SelectionHandles.ts` |
| 4 | 删除 `getBodyDimensions` / `setBodyDimensions` / `circleR` 路径 / hemisphere hack | `SelectionHandles.ts` |
| 5 | 统一 `getSelectionBounds` 返回格式（消除 `corners` 分支，复用 `getLocalBBox`） | `descriptor.ts` + 各 body type |
| 6 | 回归验证：lint + tsc + 逐个物体手动验证 resize/move/rotate/snap | — |

**步骤 1-4 是核心改动，步骤 5 是清理优化。**

---

## 验收标准

- [x] `computeResize` 中 **零 body.type switch-case**
- [x] `getBodyDimensions` / `setBodyDimensions` 已删除
- [x] `circleR` 特殊路径已删除
- [x] hemisphere 的 `if (origBody.type === 'hemisphere')` hack 已删除
- [x] 所有 11 种 body type 的 resize 行为正确（对角不动、尺寸跟随鼠标）
- [x] 球槽（hemisphere）resize 不漂移
- [x] 锚点 / 滑轮座 resize 保持等比例缩放
- [x] 框选、hover、缩略图不受影响
- [x] lint + tsc 通过
- [x] 翻转穿越平滑跟踪（rawHalfW 修复）
- [x] 仿真模式 flipped 渲染正确（双重镜像 bug 修复）
- [x] `getSelectionBounds` 统一返回 `{ halfW, halfH }`（消除 corners 分支）
