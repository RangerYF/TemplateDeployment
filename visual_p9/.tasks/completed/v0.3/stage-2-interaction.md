# V0.3 阶段2：交互增强 — Hover 高亮与面交互

> **阶段目标**：让线段和面成为完整的可交互元素，支持 Hover 高亮、左键选中、右键菜单、面上取点
> **预计耗时**：3-4 天
> **前置条件**：阶段1（UI 体验修补）已完成
> **BACKLOG 覆盖**：F05（Hover 高亮）、F06（面交互）
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.3/PROGRESSIVE-PLAN.md`（V0.3 全局计划，8个阶段串行）
> - 功能清单：`.tasks/active/v0.3/BACKLOG.md`（F01-F19 完整功能定义与优先级）

---

## 代码现状摘要

| 模块 | 现状 | 需要做什么 |
|------|------|-----------|
| SelectionStore | 只有 `selectedIds` + `primaryId`，无 hoveredId | 新增 `hoveredId` 字段 |
| SelectTool | 只检测 Point 和 Segment 命中，无 Face raycasting | 增加 Face 命中检测 + Hover onPointerMove |
| FaceEntityRenderer | 半透明灰色渲染，mesh 无 `userData` 标记，无选中/Hover 样式 | 加 userData + Hover/选中高亮 |
| SegmentEntityRenderer | 有 hitbox + 选中高亮，无 Hover 高亮 | 增加 Hover 样式 |
| PointEntityRenderer | 有选中高亮 + 脉冲动画，无 Hover 高亮 | 增加 Hover 样式 |
| ContextMenu3D | 只支持 `segment` 和 `point` 类型右键菜单 | 扩展支持 `face` 类型 |
| ToolEventDispatcher | onPointerDown 构建 ToolPointerEvent，无 pointerMove hover 追踪 | Canvas onPointerMove 中追踪 Hover |
| FaceInspector | 显示面类型/索引/构成顶点，无面积，无交互选项 | 增加面积显示 |
| Entity types | PointConstraint 缺少 `face` 约束类型 | 新增 `{ type: 'face'; faceId: string; u: number; v: number }` |
| usePointPosition | 支持 vertex/edge/curve/free/coordinate，缺少 face | 增加 face 约束位置计算 |

---

## 子任务清单（串行执行）

### T2.1 SelectionStore 扩展 + Hover 事件链路 ⏱️ 0.5天

**现状分析**：
- `selectionStore.ts`：存储 `selectedIds: string[]` 和 `primaryId: string | null`
- 有 `selectionChanged` Signal 广播选中变更
- 完全没有 Hover 状态追踪

**要做的事**：
1. `selectionStore.ts` 新增字段和方法：
   - `hoveredId: string | null` — 当前 Hover 的实体 ID
   - `setHovered(id: string | null)` — 更新 Hover 状态
2. `ToolEventDispatcher.tsx` 中增加 Canvas 级 `onPointerMove` 处理：
   - 从 `event.intersections[0]` 提取 `userData.entityId`
   - 调用 `selectionStore.setHovered(entityId)` 更新 Hover
   - 无命中时调用 `setHovered(null)` 清除
3. 确保 Hover 状态变更不触发不必要的重渲染（各 Renderer 用 selector 精确订阅自己的 entity ID）

**涉及文件**：
- `src/editor/store/selectionStore.ts` — 新增 hoveredId
- `src/components/scene/ToolEventDispatcher.tsx` — Canvas onPointerMove hover 追踪

**验收**：
- [x] `useSelectionStore.getState().hoveredId` 能正确追踪鼠标下方的实体
- [x] 鼠标移出所有实体时 `hoveredId` 为 null
- [x] Hover 状态变更不影响选中状态

---

### T2.2 Segment Hover 高亮 ⏱️ 0.5天

**现状分析**：
- `SegmentEntityRenderer.tsx`：
  - hitbox 已有 `userData={{ entityId, entityType: 'segment' }}`，raycasting 可识别 ✅
  - 选中高亮已实现（颜色 #f59e0b，线宽加粗）✅
  - 无 Hover 样式

**要做的事**：
1. `SegmentEntityRenderer.tsx` 中订阅 `hoveredId`：
   ```
   const isHovered = useSelectionStore(s => s.hoveredId === entity.id)
   ```
2. Hover 样式（与选中样式区分）：
   - builtIn 棱线：颜色从黑色变为 `#60a5fa`（浅蓝）或线宽微增
   - 用户自定义线段：颜色变亮或加发光
3. 选中态优先于 Hover 态（同时选中和 Hover 时显示选中样式）

**涉及文件**：
- `src/components/scene/renderers/SegmentEntityRenderer.tsx` — 增加 Hover 样式

**验收**：
- [x] 鼠标移到棱线上时线段高亮，移开恢复
- [x] 鼠标移到自定义线段上时线段高亮，移开恢复
- [x] 选中态和 Hover 态视觉可区分
- [x] 选中态优先于 Hover 态

---

### T2.3 Face Hover 高亮 + 左键选中 ⏱️ 1天

**现状分析**：
- `FaceEntityRenderer.tsx`：
  - 面用 `<mesh>` 渲染，半透明灰色 `#9ca3af` opacity=0.12
  - ❌ mesh 没有 `userData` 标记 — 这是关键缺陷，raycasting 无法识别面
  - 无选中/Hover 样式
- `selectTool.ts`：
  - `onPointerDown` 中只处理 `hitEntityType === 'point'` 的情况（拖拽）
  - 对其他类型只做 `select()` — 理论上已支持 Segment 和 Face 选中
  - 但 Face 缺少 userData，所以实际上不会被命中

**要做的事**：
1. `FaceEntityRenderer.tsx` 中所有 `<mesh>` 添加 `userData={{ entityId: entity.id, entityType: 'face' }}`
2. `FaceEntityRenderer.tsx` 订阅 `hoveredId` 和 `selectedIds`，根据状态切换样式：
   - 默认：半透明灰色 opacity=0.12
   - Hover：半透明蓝色 `#3b82f6` opacity=0.2
   - 选中：半透明绿色 `#00C06B` opacity=0.25
3. `selectTool.ts` 确认 Face 命中后能正确 `select(entityId)`（可能已支持，加 userData 后自动生效）
4. 选中面后 Inspector 面板显示 FaceInspector（确认 InspectorRegistry 已注册）

**涉及文件**：
- `src/components/scene/renderers/FaceEntityRenderer.tsx` — userData + 样式
- `src/editor/tools/selectTool.ts` — 确认 Face 选中逻辑（可能无需修改）

**验收**：
- [x] 鼠标移到面上时面高亮（半透明蓝色），移开恢复
- [x] 左键点击面可选中（半透明绿色高亮）
- [x] 再次点击其他位置取消选中
- [x] 选中面后右侧面板显示 FaceInspector
- [x] Hover 和选中态视觉可区分

---

### T2.4 Point Hover 高亮 ⏱️ 0.5天

**现状分析**：
- `PointEntityRenderer.tsx`：
  - builtIn 点有不可见命中球 + 标签，`userData` 已标记 ✅
  - 自定义点有可见小球 + 命中体积，`userData` 已标记 ✅
  - 选中态已实现（标签变绿/球体变黄）
  - 画线模式脉冲动画已实现（阶段1）
  - 无 Hover 样式

**要做的事**：
1. `PointEntityRenderer.tsx` 订阅 `hoveredId`
2. builtIn 点 Hover 样式：标签背景从半透明白色变为浅高亮（如浅蓝背景或底部加下划线）
3. 自定义点 Hover 样式：球体颜色变亮或添加发光
4. 选中态仍优先于 Hover 态

**涉及文件**：
- `src/components/scene/renderers/PointEntityRenderer.tsx` — 增加 Hover 样式

**验收**：
- [x] 鼠标移到顶点标签附近时标签高亮，移开恢复
- [x] 鼠标移到自定义点上时点高亮，移开恢复
- [x] 选中态优先于 Hover 态
- [x] 画线模式脉冲动画不受 Hover 影响

---

### T2.5 Face 右键菜单 + 面上取点 ⏱️ 1天

**现状分析**：
- `ContextMenu3D.tsx`（及 `contextMenuStore.ts`）：
  - `targetEntityType` 只支持 `'segment' | 'point'`
  - 线段右键菜单有：取中点、在此处取点、2等分、3等分
  - 完全没有 face 菜单
- `entities/types.ts`：
  - `PointConstraint` 没有 `face` 类型
- `usePointPosition.ts`（`computePointPosition`）：
  - 没有 `face` 约束的位置计算逻辑

**要做的事**：
1. `entities/types.ts` 新增 face 约束类型：
   ```typescript
   | { type: 'face'; faceId: string; u: number; v: number }
   ```
   其中 u, v 是面内的重心坐标参数
2. `contextMenuStore.ts` 扩展 `targetEntityType` 为 `'segment' | 'point' | 'face'`
3. `SegmentEntityRenderer.tsx` 或 `FaceEntityRenderer.tsx` 中增加右键事件，打开面的 contextMenu
4. `ContextMenu3D.tsx` 增加 face 分支菜单项：
   - "面上取点" — 在右键点击位置创建一个约束在面上的 Point Entity
5. `computePointPosition` 增加 face 约束计算：
   - 从 faceId 获取 Face Entity → 获取构成顶点位置 → 用 u, v 重心坐标插值计算位置
6. 面上取点的位置计算：右键点击位置 → 投影到面平面 → 计算 u, v 参数
7. 面上点拖拽约束：SelectTool 中拖拽面上点时，投影到面平面内

**涉及文件**：
- `src/editor/entities/types.ts` — 新增 face 约束
- `src/components/scene/contextMenuStore.ts` — 扩展 targetEntityType
- `src/components/scene/ContextMenu3D.tsx` — 面菜单项
- `src/components/scene/renderers/FaceEntityRenderer.tsx` — 右键事件
- `src/components/scene/renderers/usePointPosition.ts` — face 约束位置计算
- `src/editor/tools/selectTool.ts` — 面上点拖拽约束

**验收**：
- [x] 右键面弹出菜单，包含"面上取点"选项
- [x] 点击"面上取点"在点击位置创建一个点
- [x] 面上的点显示为自定义点样式（红色小球+标签）
- [x] 面上的点可拖动，投影到面所在平面（边界约束见 PENDING-DECISIONS.md D02）
- [x] 面上的点可命名（双击编辑标签）
- [x] 面上的点可被线段连接（画线工具选择）
- [x] 面上的点可参与截面、外接圆等操作
- [x] 面上的点支持 Undo/Redo
- [ ] 删除面时，面上取的点如无其他引用则级联删除（未验证）

---

### T2.6 FaceInspector 增强 ⏱️ 0.5天

**现状分析**：
- `FaceInspector.tsx`：
  - 显示面类型（几何体面/截面/自定义面）
  - 显示面索引（geometry 类型）
  - 显示构成顶点标签列表
  - 截面有删除按钮
  - 无面积显示

**要做的事**：
1. 增加面积计算和显示：
   - 多面体面：用顶点坐标计算多边形面积（叉积法）
   - 截面：已有面积计算逻辑（确认并展示）
2. 增加"面上取的点"列表：显示该面上所有 `constraint.type='face'` 的 Point Entity
3. 考虑增加面颜色/透明度自定义（P2，可延后）

**涉及文件**：
- `src/components/panels/inspectors/FaceInspector.tsx` — 面积 + 关联点列表

**验收**：
- [x] 选中面后 Inspector 显示面积（精确值或近似值）
- [x] 选中面后 Inspector 显示该面上的所有取点

---

## 门禁检查

阶段完成后执行：
```bash
pnpm lint && pnpm tsc --noEmit
```
命中 `src/` 变更 → 执行最小回归门禁（CLAUDE.md 附录F）。

---

## 风险与注意事项

1. **Hover 性能**：`onPointerMove` 每帧触发，`setHovered()` 需避免无变化时的无效更新（相同 ID 不重复 set）
2. **Face raycasting 精度**：半透明面 opacity 很低，Three.js raycaster 默认能命中透明 mesh，但需确认 `side: THREE.DoubleSide` 设置
3. **面上取点的重心坐标**：多边形面（非三角形）的重心坐标计算需要先三角化，或用投影方式简化
4. **面上点拖拽**：拖拽时需要实时投影到面平面，计算新的 u, v 参数 → 可能需要 Three.js Plane 辅助
5. **渲染顺序**：Face 在渲染排序中排最前（`TYPE_ORDER.face = 0`），确保 Hover/选中样式不被后续渲染覆盖
6. **与阶段3的衔接**：面交互是坐标系重构（"选面定 Z 轴"）的前置依赖，本阶段必须让面可被 SelectTool 选中

---

## 交付 DoD 模板

## 交付 DoD — V0.3 阶段2 ✅

**变更摘要**：
| 文件 | 变更类型 |
|------|---------|
| `src/editor/store/selectionStore.ts` | 新增 hoveredId + setHovered |
| `src/components/scene/ToolEventDispatcher.tsx` | 新增 onPointerMove/onPointerLeave hover 追踪 |
| `src/components/scene/renderers/SegmentEntityRenderer.tsx` | 新增 Hover 样式 |
| `src/components/scene/renderers/FaceEntityRenderer.tsx` | 新增 userData + Hover/选中样式 + 右键菜单 |
| `src/components/scene/renderers/PointEntityRenderer.tsx` | 新增 Hover 样式 |
| `src/editor/entities/types.ts` | PointConstraint 新增 face 约束类型 |
| `src/components/scene/contextMenuStore.ts` | 扩展 targetEntityType + hitPoint |
| `src/components/scene/ContextMenu3D.tsx` | 新增面菜单分支（面上取点） |
| `src/components/scene/renderers/usePointPosition.ts` | 新增 face 约束位置计算 |
| `src/editor/tools/selectTool.ts` | 面上点拖拽约束（面平面投影） |
| `src/components/panels/inspectors/FaceInspector.tsx` | 新增面积显示 + 关联点列表 |

**验证结果**：
- pnpm lint: **PASS**
- pnpm tsc --noEmit: **PASS**
- 手动验证：用户验收通过

**修复记录**：
- 选中颜色统一：线段选中从 `#f59e0b`(橙) → `#00C06B`(绿)
- Hover 颜色统一：所有元素统一使用 `#60a5fa`(浅蓝)
- 面上取点不生效：修复 `getBuilderResult` 调用参数不足的问题

**风险与回滚**：无破坏性变更，所有改动为增量添加

**遗留事项**：
- 曲面体（圆柱/圆锥/球）交互缺失 → 见 `PENDING-DECISIONS.md` D01
- 自定义点拖拽无边界约束 → 见 `PENDING-DECISIONS.md` D02

**审查结论**：:white_check_mark: 实现匹配计划，已通过用户验收

**完成时间**：2026-03-10
