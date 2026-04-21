# 阶段 8.3.3：锚点/滑轮座挂载面吸附

- **任务ID**: 03-30-stage8.3.3-anchor-pulley-snap
- **风险等级**: L1
- **状态**: 已完成（用户验收通过）
- **前置依赖**: 8.3 渲染优化（已完成锚点/滑轮座重绘）

## 目标

让锚点（anchor）和滑轮座（pulley-mount）的固定面（墙面/hatching 所在的面）能够吸附到斜面、墙壁等物体的 rest surface 上。

## 问题描述

当前锚点和滑轮座没有 `getSnapSurfaces`，无法与其他物体进行吸附。教学场景中，教师经常需要把锚点挂在斜面顶端、把滑轮座固定在斜面上方，目前只能手动对齐。

## 失败尝试记录（2026-03-30）

### 尝试方案：直接添加 contact surface

给 anchor 和 pulley-mount 的 `getSnapSurfaces` 添加了 contact surface（在 mountSide 方向的固定面位置）：

```typescript
// anchor 示例（mountSide=top）
getSnapSurfaces: (body) => {
  const wallDist = r * 2.5
  const wallHalf = r * 4
  return [createSnapSurface('contact',
    { x: -wallHalf, y: wallDist }, { x: wallHalf, y: wallDist },
    x, y, a, { x: 0, y: 1 })]
}
```

**结果**：锚点和滑轮座拖不动了。

**根因**：当前 snap 系统在拖动过程中**实时计算吸附**（`SelectTool.ts` 第 542 行 `computeSnap`），每次 mousemove 都会检查。给小物体加 contact surface 后：
1. 拖动时 contact surface 靠近地面的 rest surface → 立即被吸附到地面
2. 吸附后位置被锁定 → 无法继续拖动到目标斜面
3. 地面的 rest surface 跨度极大（-100 到 100），几乎无处不在

### 同时尝试的 SnapEngine 改动

还修改了 `computeSlopeSnap` 中的 offsetDist 计算，从 `getSelectionBounds(body,1).halfH` 改为 contact surface 中点到 body 中心的距离。这个改法本身是对的（解决了"圆心贴合而非墙面贴合"的问题），但因为上面的拖动问题被一起回退了。

**所有改动已回退**，代码恢复到改动前状态。

## 方案探索方向

需要解决的核心矛盾：**拖动过程中的实时吸附 vs 挂载面吸附**

可能的方向：

### 方向 A：区分吸附模式
- 支撑面吸附（contact 在下方）：实时吸附（当前行为，适合方块/球放到地面/斜面上）
- 挂载面吸附（contact 在侧面/上方）：仅在释放时吸附，或需要更近的阈值

### 方向 B：Snap 系统增加"排除 ground"逻辑
- 对 anchor/pulley 的 contact surface，不与 ground 的 rest surface 匹配
- 只与其他物体（slope、wall 等）的 rest surface 匹配

### 方向 C：释放时吸附
- 拖动过程中不触发挂载面吸附，松开鼠标时计算最终吸附位置
- 可以用视觉预览（虚线/高亮）提示即将吸附的位置

### 方向 D：SnapEngine 中对 offsetDist 的修复
- `computeSlopeSnap` 的 offsetDist 需要从 contact surface 实际位置计算（之前的改法方向正确）
- 这是独立于拖动问题的一个 fix，需要一起解决

## 2026-03-31 续作讨论

### 用户新增约束
- 用户提出：锚点/滑轮座不仅要能挂到斜面/墙壁，也可能需要吸附到地面；目标是保证锚点和滑轮本体位于地面以上，而不是要求固定面始终朝上。
- 用户追问：若把固定面抽象成一个"小矩形物块"，让这个矩形的表面参与吸附，是否能复用现有物块的吸附行为，同时不影响选中、拉伸等交互。

### 当前分析结论
- 若"小矩形物块"仅作为 **snap 用的虚拟几何**（只用于 `getSnapSurfaces` / offset 计算，不改 `toShapeConfig`、`getLocalBBox`、`applyResize`），则选中、拉伸、旋转等现有交互链路基本不受影响。
- 若把锚点/滑轮座的 **真实物理 shape** 改成复合体（圆/滑轮 + 小矩形），则会连带影响：
  - `getLocalBBox` / `getSelectionBounds`：选中框和手柄位置需要改成覆盖复合形状；
  - `applyResize` / `resizeMode`：当前 `radius` 语义不再天然成立，缩放行为需要重新定义；
  - `hitTest`：命中区域应跟随复合形状，否则视觉与交互会错位；
  - 仿真/碰撞：`toShapeConfig` 改为复合 shape 后，未来若这些支撑体参与物理或约束定位，行为会与当前圆形基体不同。
- 因此，后续优先考虑"**虚拟小矩形 contact surface + SnapEngine 旋转/翻转判定**"方案，而不是直接改本体物理 shape。

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/models/bodyTypes/anchor.tsx` | 添加 getSnapSurfaces |
| `src/models/bodyTypes/pulleyMount.tsx` | 添加 getSnapSurfaces |
| `src/core/snap/SnapEngine.ts` | 新增基于 contact 局部几何的旋转/翻转吸附逻辑 |
| `src/core/snap/types.ts` | 为 SnapSurface 增加局部几何元数据 |
| `src/core/snap/utils.ts` | createSnapSurface 写入局部几何元数据 |

## 本轮实现记录（2026-03-31）

### 已完成实现
- `anchor` / `pulley-mount` 新增 `getSnapSurfaces`，将固定墙面抽象为 **虚拟 contact 面**；未改 `toShapeConfig`，因此本体物理 shape、选中框主逻辑和 `radius` 缩放语义保持不变。
- `SnapSurface` 新增 `localStart` / `localEnd` / `localNormal` 元数据，供 SnapEngine 在目标姿态下重算 contact 面位置。
- `SnapEngine` 新增通用线面吸附分支：先根据 contact 局部切线与目标 rest surface 切线求目标角度，再在 contact normal 与 rest normal 同向时自动追加 `π`，实现“吸附到地面时自动翻转 180°”。
- 新的线面吸附分支按 **contact 面中点** 而非 body center 计算吸附位置，解决固定面贴合目标表面时圆心/轴心错位的问题。
- 本轮未修改 `SelectTool.ts`。最终方案通过 SnapEngine 的姿态解算避免了之前“直接加 contact 面后拖不动”的问题扩散到交互层。

### 与原计划的实际差异
- 未新增 `mount` surface 类型，也未增加“排除 ground”专用分支；改为保留 `contact` 语义，并通过自动翻转支持地面吸附。
- 未改 `SelectTool.ts` 的拖拽流程。吸附行为调整全部收敛在 `getSnapSurfaces` 与 `SnapEngine`。

## 2026-03-31 贴地修正（续作 bugfix）

### 用户反馈
- 滑轮座吸附到地面后，带斜线的固定墙面落到地面以下。
- 锚点吸附到地面后，固定墙面悬在地面以上，存在可见间隙。

### 根因
- `anchor` / `pulley-mount` 的 `renderEdit` 使用的是一套视觉几何，而 `getSnapSurfaces` 使用的是另一套吸附几何，两者不一致。
- `SnapEngine` 的通用 `VISUAL_GAP` 对普通物块是合理的，但对“固定面必须贴合目标面”的锚点/滑轮座会额外制造缝隙。

### 修复动作
- 在 `anchor.tsx` / `pulleyMount.tsx` 中分别提取固定面几何函数，让 `renderEdit` 与 `getSnapSurfaces` 共享同一套固定面位置。
- 在 `SnapEngine.ts` 中对 `anchor` / `pulley-mount` 返回 `visualGap = 0`，其余物体继续保留原描边补偿。
- 修复后目标语义改为：此类物体的固定面应与地面/斜面/墙壁 **紧贴**，而不是保留通用视觉缝隙。

## 验证结果

- `pnpm lint`：通过
- `pnpm tsc --noEmit`：通过
- `pnpm build`：失败；失败点位于既有文件，如 `src/components/Canvas.tsx`、`src/core/commands/*`、`src/engine/PhysicsBridge.ts`，与本轮改动文件不重合，判定为工作区现存问题，未在本任务中处理
- 浏览器内手动拖拽验收：用户已验证通过；确认 8.3.3 完成

## 审查结论

:white_check_mark: 实现完全匹配修订后的执行方向（虚拟小矩形 contact surface + SnapEngine 自动翻转）

## 验收标准

- [x] 锚点可以吸附到斜面的 rest surface（固定面贴合斜面）
- [x] 滑轮座可以吸附到斜面的 rest surface
- [x] 锚点 mountSide=left/right 时可吸附到墙壁
- [x] 拖动过程流畅，不会被地面吸住拖不动
- [x] 现有物体（方块、球、球槽等）的吸附行为不受影响
