# 阶段 8.3.1：锚点/滑轮座交互修复

- **任务ID**: 03-29-stage8.3.1-hittest-fix
- **风险等级**: L1
- **状态**: ✅ 已完成

## 修复内容

### 1. 框选误选（getSelectionBounds 像素下限 bug）
- **根因**：`Math.max(radius * scale, minPx)` 在 scale=1 时像素下限被当作米数（4m/6m），碰撞框巨大
- **修复**：scale ≤ 10 时不应用像素下限，返回真实物理尺寸

### 2. 缩略图裁切
- **根因**：getSelectionBounds 只返回圆的 bounds，缩略图 autoScale 不知道墙壁/连杆范围
- **修复**：scale > 500（缩略图 REF_SCALE=1000）时返回包含 wallLen/strutLen 的完整视觉 bounds

### 3. hover 样式不统一
- **根因**：渲染器为 hover 设置 `setLineDash([6,3])` + 蓝色 stroke，但 renderEdit 覆盖了 strokeStyle
- **修复**：renderEdit 通过 `ctx.getLineDash().length > 0` 检测 hover 状态，使用蓝色

### 4. hitTest 只覆盖圆形
- **根因**：hitTest 只检查物理圆半径附近的小区域（~0.3m）
- **修复**：扩大 hitTest 范围至 ~0.5m/0.6m，覆盖典型缩放下的完整视觉区域

### 5. resize 行为异常
- **根因**：anchor/pulley 走了 block 的双轴独立缩放逻辑，但它们只有单个 radius 参数
- **修复**：在 computeResize 中将 anchor/pulley-mount 纳入 ball 的等比例对角线缩放逻辑

### 6. getSelectionBounds 三层分段
为解决框选/手柄/缩略图的不同需求，getSelectionBounds 按 scale 分三层返回：
- `scale ≤ 10`（框选/对齐/吸附）：物理 radius
- `10 < scale ≤ 500`（手柄/渲染）：圆的 bounds（与 ball 一致）
- `scale > 500`（缩略图）：完整视觉 bounds（含墙壁/连杆）

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/models/bodyTypes/anchor.tsx` | getSelectionBounds 三层分段 + renderEdit hover 检测 + hitTest 扩大 |
| `src/models/bodyTypes/pulleyMount.tsx` | 同上 |
| `src/core/handles/SelectionHandles.ts` | computeResize 球体等比例逻辑扩展到 anchor/pulley-mount |

## 验收结果

- [x] 框选范围未触碰锚点/滑轮座时，不会被选中
- [x] 点击/hover 锚点/滑轮座的墙壁、连杆部分正常触发
- [x] hover 样式（虚线蓝色）与其他物体一致
- [x] 缩略图包含完整墙壁/连杆
- [x] resize 行为与球体一致（等比例对角线缩放）
- [x] lint + tsc 通过
