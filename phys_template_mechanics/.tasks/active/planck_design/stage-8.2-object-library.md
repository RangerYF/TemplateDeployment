# 阶段 8.2：物体库重构与拖放体验

- **任务ID**: 03-28-stage8.2-object-library
- **风险等级**: L1
- **状态**: ✅ 已完成
- **前置依赖**: 8.1 ✅

## 目标

重构物体库面板为卡片布局，系统性设计物体默认大小，实现拖放实时预览。

---

## 设计方案

### 一、卡片面板设计

#### 当前状态
- 列表式布局，每行一个物体（icon 20px + 文字）
- 面板宽度 `w-60`（240px），内边距 `p-3`（12px），可用宽度 ≈ 216px

#### 目标设计

```
┌─────────────────────────────────┐
│  物体库                          │
│─────────────────────────────────│
│  基础物体                        │
│  ┌────┐ ┌────┐ ┌────┐          │
│  │icon│ │icon│ │icon│          │
│  │物块│ │球体│ │杆件│          │
│  └────┘ └────┘ └────┘          │
│                                  │
│  支撑面                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │icon│ │icon│ │icon│ │icon│  │
│  │斜面│ │墙壁│ │锚点│ │滑轮座│  │
│  └────┘ └────┘ └────┘ └────┘  │
│                                  │
│  特殊表面                        │
│  ┌────┐ ┌────┐ ┌────┐          │
│  │icon│ │icon│ │icon│          │
│  │传送带│ │半球│ │V形槽│          │
│  └────┘ └────┘ └────┘          │
└─────────────────────────────────┘
```

**设计细节**：

| 属性 | 值 | 说明 |
|------|----|------|
| 布局 | CSS Grid，`grid-template-columns: repeat(4, 1fr)` | 自适应，最多一行4个 |
| 卡片尺寸 | ~48×60px（图标区 32px + 文字区 ~16px + padding） | 在 216px 可用宽度内放 4 列 |
| 图标大小 | 28px（从当前 20px 放大） | 卡片模式下需更大图标 |
| 文字 | `text-[10px]` 居中，单行截断 | 避免文字换行撑高卡片 |
| 间距 | `gap-1.5`（6px） | 卡片间紧凑但有呼吸感 |
| hover | 背景 `COLORS.bgHover` + 微弱边框 | 与当前列表 hover 效果一致 |
| 拖拽中 | `opacity-50` + `cursor-grabbing` | 视觉反馈 |

**分类调整**：
- 去掉"机构"空分类（目前无物体）
- 去掉 ground（地面初始就有，不应出现在物体库）
- 最终：基础物体(3) + 支撑面(3: slope/wall/anchor) + 机构(1: pulley-mount) → 合并为"支撑与机构" + 特殊表面(3)

**分类方案（待确认）**：

| 分类 | 物体 | 数量 |
|------|------|------|
| 基础物体 | 物块、球体、杆件 | 3 |
| 支撑与约束 | 斜面、墙壁、固定锚点、滑轮座 | 4 |
| 特殊表面 | 传送带、半球面、V形槽 | 3 |

总共 10 个卡片（去掉 ground），3 个分组。

---

### 二、物体默认大小设计

#### 调研依据

基于中国大陆初高中物理教材和实验器材的调研：

**实际器材尺寸**：
- 摩擦力实验木块：约 10cm×7cm×3.5cm，长宽比约 1.4:1
- 钢球/玻璃球：直径 2-3cm
- 教学滑轮：直径 30-60mm
- 斜面板：长 60-100cm
- 杠杆杆件：长 50-100cm，直径 5-8mm

**高考题典型数值**：
- 斜面：底长 3-5m，高 1-3m，常用角 30°/37°
- 传送带：长 2-4m（典型）
- 圆弧轨道：半径 0.4-1.0m
- 滑轮转轮：半径 0.2-0.4m

**教材示意图比例习惯**：
- 物块占斜面底长约 1/4~1/3
- 球体直径 ≈ 物块短边
- 锚点直径 ≈ 物块边长的 1/10
- 滑轮直径 ≈ 物块边长的 1/2
- 杆件长粗比约 30:1~50:1

#### 设计原则

1. 以物块为基准参考物
2. 支撑面/表面类应明显大于基础物体（能放得下物块）
3. 小配件（锚点、滑轮座）保持合理的小尺寸
4. 教师拖出后应能直接使用，不需要先调大小
5. 物块占斜面底长约 1/4，符合教材示意图习惯

#### 默认尺寸对照表

| 物体 | 当前默认 | 建议默认 | 修改理由 |
|------|----------|----------|----------|
| **物块** block | 1×1m | **0.8×0.6m** | 实际木块长宽比约 1.4:1，正方形不像木块 |
| **球体** ball | r=0.5m（⌀1m） | **r=0.3m（⌀0.6m）** | 球径≈物块短边（0.6m），符合教材比例 |
| **杆件** bar | L=2m, t=0.1m | **L=2m, t=0.06m** | 长粗比 33:1，更符合"轻杆"视觉 |
| **斜面** slope | base=3m, h=2m | **base=3m, h=1.73m** | 对应 30° 角（tan30°≈0.577），最常用教学角度 |
| **墙壁** wall | 0.2×3m | **0.15×2m** | 更薄更矮，与其他物体更协调 |
| **固定锚点** anchor | r=0.1m | **r=0.1m** | ✅ 保持不变，约为物块的 1/8，合理 |
| **滑轮座** pulley-mount | r=0.3m | **r=0.2m** | 直径0.4m ≈ 物块短边的 2/3，更符合教材比例 |
| **传送带** conveyor | 5×0.3m | **4×0.2m** | 长度取典型值 4m，皮带更薄 |
| **半球面** hemisphere | r=1.5m | **r=1.0m** | 取高考典型值 R=1.0m |
| **V形槽** groove | w=2, d=1.5, t=0.15 | **w=1.5, d=1.0, t=0.1** | 整体缩小，与其他器材协调 |

#### 比例关系验证（以物块 0.8m 为基准 = 1）

| 器材 | 相对物块 | 绝对值 | 教材比例是否合理 |
|------|----------|--------|-----------------|
| 物块 | **1**（基准） | 0.8×0.6m | ✅ 扁平矩形 |
| 球体直径 | 0.75 | ⌀0.6m | ✅ 略小于物块 |
| 斜面底长 | 3.75 | 3m | ✅ 物块占斜面约 1/4 |
| 墙壁高度 | 2.5 | 2m | ✅ 能挡住物块 |
| 锚点直径 | 0.25 | ⌀0.2m | ✅ 小圆点 |
| 滑轮直径 | 0.5 | ⌀0.4m | ✅ 约物块短边 2/3 |
| 杆件长度 | 2.5 | 2m | ✅ |
| 传送带长 | 5 | 4m | ✅ 能放几个物块 |
| 半球半径 | 1.25 | 1m | ✅ |

```
比例示意（每格=0.5m，总宽=4m）：

物块        球体       杆件
┌───┐       ○         ════════════
│0.8│      ⌀0.6       L=2m, t=0.06m
└───┘

斜面 (base=3m, 30°)           墙壁
     ╱│                       ┃
   ╱  │1.73m                  ┃ 2m
 ╱ 30°│                       ┃
╱─────┘                       ┃
  3m
```

---

### 三、拖放实时预览设计

#### 当前流程
```
面板 dragStart → Canvas dragOver(仅 preventDefault) → Canvas drop(创建物体)
```
- 拖拽过程中 Canvas 上无任何视觉反馈
- 用户不知道物体会多大、放在哪

#### 目标流程
```
面板 dragStart → Canvas dragEnter(开始预览) → Canvas dragOver(更新预览位置)
→ Canvas drop(创建物体，清除预览) / dragLeave(清除预览，不创建)
```

#### 技术方案

**状态管理**：在 Canvas 组件内部用 `useRef` 或局部 state 维护预览状态

```typescript
interface DragPreview {
  bodyType: BodyType        // 正在拖拽的物体类型
  worldPos: Vec2           // 当前鼠标对应的世界坐标
  snappedPos?: Vec2        // snap 后的位置（如有）
  snappedAngle?: number    // snap 后的角度
}
```

**预览渲染流程**：
1. `dragEnter` / `dragOver`：解析 bodyType → 构造临时 SceneBody（用 defaults） → 计算 snap → 更新预览状态 → 触发 Canvas 重绘
2. CanvasRenderer 在常规渲染后，检查预览状态，若有则：
   - 用 `globalAlpha = 0.5` 渲染预览物体
   - 如果有 snap，显示吸附高亮线（复用已有 snap 渲染逻辑）
3. `drop`：创建物体（已有逻辑），清除预览
4. `dragLeave`：清除预览，不创建物体

**性能注意**：
- `dragOver` 高频触发（~60fps），snap 计算可能较重
- 方案：dragOver 中用 `requestAnimationFrame` 去重，每帧最多计算一次 snap
- 或者简单方案：预览只跟随鼠标位置，不做实时 snap（仅 drop 时 snap）

**方案：完整预览（实时 snap）**

根据用户要求，预览位置必须与最终创建位置完全一致，因此必须做实时 snap：

- dragOver 中用 `requestAnimationFrame` 节流，每帧最多计算一次 snap
- 半透明物体渲染在 snap 后的位置
- 松手时直接用预览的位置创建物体，不再二次 snap → 位置零跳变
- 复用 `desc.renderEdit()` 画预览，加 `ctx.globalAlpha = 0.5`

#### 拖回面板不创建

- `dragLeave` 事件在鼠标离开 Canvas 时触发 → 清除预览
- 如果鼠标拖回面板区域松手，Canvas 的 `drop` 不会触发 → 不创建物体
- HTML5 DnD 原生就支持这个行为，无需额外处理

---

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `src/components/panels/ObjectPanel.tsx` | 列表 → 网格卡片布局，去掉 ground 和空分类 |
| `src/components/Canvas.tsx` | 新增 dragEnter/dragLeave 预览逻辑、预览状态 |
| `src/renderer/CanvasRenderer.ts` | 新增 `renderDragPreview()` 方法 |
| `src/models/bodyTypes/block.tsx` | defaults 调整：height 1→0.6 |
| `src/models/bodyTypes/ball.tsx` | defaults 调整：radius 0.5→0.4 |
| `src/models/bodyTypes/bar.tsx` | defaults 调整：barThickness 0.1→0.08 |
| `src/models/bodyTypes/slope.tsx` | defaults 调整：base 3→2.5, height 2→1.5 |
| `src/models/bodyTypes/wall.tsx` | defaults 调整：wallHeight 3→2 |
| `src/models/bodyTypes/anchor.tsx` | defaults 调整：anchorRadius 0.1→0.15 |
| `src/models/bodyTypes/conveyor.tsx` | defaults 调整：conveyorWidth 5→3 |
| `src/models/bodyTypes/hemisphere.tsx` | defaults 调整：hemisphereRadius 1.5→1.2 |
| `src/models/bodyTypes/groove.tsx` | defaults 调整：grooveDepth 1.5→1.2 |

## 执行顺序

| 步骤 | 任务 | 预计 |
|------|------|------|
| 1 | 卡片面板布局重构 | 30min |
| 2 | 物体默认大小调整 | 20min |
| 3 | 拖放预览实现 | 40min |
| 4 | 回归验证 + lint + tsc | 15min |

## 验收标准

- ✅ 物体库为卡片网格布局（最多一行4个），图标 + 名称清晰
- ✅ ground 不出现在物体库中
- ✅ 各物体拖出时大小比例协调，视觉上自然
- ✅ 拖入 Canvas 时显示半透明物体预览
- ✅ 拖回面板区域松手不创建物体

---

### 四、卡片缩略图生成方案

**方案**：预生成静态 PNG，不在列表中实时渲染。

**生成流程**：
1. 创建临时 dev 组件 `src/dev/ThumbnailGenerator.tsx`
2. App.tsx 中加 dev-only 入口（URL hash `#thumbnails`）
3. 组件对每种物体：创建 96×96 离屏 Canvas → `ctx.translate(48,48)` → 设默认样式 → `desc.renderEdit(ctx, defaultBody, autoScale)` → 导出 PNG
4. 页面显示全部缩略图 + "下载全部" 按钮
5. 确认效果后 PNG 保存到 `public/thumbnails/block.png` 等
6. ObjectPanel 卡片用 `<img src="/thumbnails/block.png">` 显示
7. 删除临时组件

**autoScale 计算**：根据物体的 selectionBounds 自动计算 scale，使物体填满 80% 画布区域。

**执行时机**：确定默认尺寸后再生成缩略图。

---

## 涉及文件（更新）

| 文件 | 修改内容 |
|------|----------|
| `src/components/panels/ObjectPanel.tsx` | 列表 → 网格卡片布局，用 `<img>` 显示缩略图，去掉 ground 和空分类 |
| `src/components/Canvas.tsx` | 新增 dragEnter/dragLeave 预览逻辑、预览状态，实时 snap |
| `src/renderer/CanvasRenderer.ts` | 新增 `renderDragPreview()` 方法 |
| `src/models/bodyTypes/block.tsx` | defaults：width 1→0.8, height 1→0.6 |
| `src/models/bodyTypes/ball.tsx` | defaults：radius 0.5→0.3 |
| `src/models/bodyTypes/bar.tsx` | defaults：barThickness 0.1→0.06 |
| `src/models/bodyTypes/slope.tsx` | defaults：slopeHeight 2→1.73 |
| `src/models/bodyTypes/wall.tsx` | defaults：wallWidth 0.2→0.15, wallHeight 3→2 |
| `src/models/bodyTypes/pulleyMount.tsx` | defaults：pulleyRadius 0.3→0.2 |
| `src/models/bodyTypes/conveyor.tsx` | defaults：conveyorWidth 5→4, conveyorHeight 0.3→0.2 |
| `src/models/bodyTypes/hemisphere.tsx` | defaults：hemisphereRadius 1.5→1.0 |
| `src/models/bodyTypes/groove.tsx` | defaults：grooveWidth 2→1.5, grooveDepth 1.5→1.0, grooveThickness 0.15→0.1 |
| `public/thumbnails/*.png` | 预生成的卡片缩略图 |

---

## 执行记录

### 已完成 ✅ 2026-03-28

**代码改动**：

1. **默认尺寸调整**（9 个 bodyType defaults 文件）— 全部按设计表修改
2. **卡片面板重构** — `ObjectPanel.tsx` → CSS Grid 4 列，去掉 ground + 空分类，3 分组
3. **缩略图生成工具** — `src/dev/ThumbnailGenerator.tsx`，访问 `#thumbnails` 打开
4. **拖放实时预览** — `Canvas.tsx` dragOver 半透明物体 + 实时 snap + 零跳变
5. **共享拖拽状态** — `dragState.ts` 解决浏览器 getData 限制
6. **CanvasRenderer** — 新增 `renderDragPreview()` 方法

**新增文件**：
- `src/dev/ThumbnailGenerator.tsx` — 临时缩略图生成器
- `src/components/panels/dragState.ts` — DnD body type 共享状态

**验证**：`pnpm lint && pnpm tsc --noEmit` 通过

### 收尾修复 ✅ 2026-03-28

1. **隐藏 DnD ghost image** ✅ — `ObjectPanel.tsx` dragStart 中 `e.dataTransfer.setDragImage(emptyImg, 0, 0)` 用 1×1 透明 GIF
2. **缩略图生成器修复** ✅ — `computeAutoScale` 改用 REF_SCALE=1000 避免像素下限干扰小物体缩放
3. **面板改为 3 列** ✅ — `grid-cols-4` → `grid-cols-3`，缩略图改为 `w-full aspect-square` 自适应列宽
4. **生成缩略图 PNG** ✅ — 10 个物体缩略图已生成并放入 `public/thumbnails/`
5. **App.tsx hash 路由** ✅ — 改为 `useState + hashchange` 监听，HMR 后也能正确加载 ThumbnailGenerator
6. **保留 ThumbnailGenerator** — 用户决策：未来样式优化时需重新生成，不删除
