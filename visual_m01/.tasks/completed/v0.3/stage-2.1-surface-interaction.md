# V0.3 阶段2.1：曲面体交互补全 + 遮挡面选择

> **阶段目标**：解决两个阻塞阶段3（坐标系重构）的前置问题
> **前置条件**：阶段2（交互增强）已完成
> **阻塞关系**：阶段3 的"选面定 Z 轴"依赖面可被选中，曲面体和被遮挡面目前无法选中

---

## 问题 A：曲面体（圆柱/圆锥/球）交互缺失

### 现状

| 元素 | 多面体（正方体/长方体/棱锥） | 曲面体（圆柱/圆锥/球） |
|------|---|---|
| 点 | Point Entity ✅ 可交互 | Point Entity ✅ 仅特征点（圆心/顶点） |
| 线 | Segment Entity ✅ 有 hitbox、可 hover/选中 | `GeometryEntityRenderer` 直接画 `<Line>` ❌ 无 Entity、无 userData |
| 面 | Face Entity ✅ 有 userData、可 hover/选中/右键 | `GeometryEntityRenderer` 直接画 `<mesh>` ❌ 无 Entity、无 userData |

### 根因

`entityStore.createBuiltInEntities` 中曲面体只创建特征点，不创建 Segment / Face Entity。线和面由 `GeometryEntityRenderer` 的 `SurfaceBody` 组件直接用 Three.js 原语渲染。

### 曲面体 Builder 数据结构

**圆柱** — featurePoints: [底面圆心O, 顶面圆心O₁], lines: [4条母线, 底圆, 顶圆]
**圆锥** — featurePoints: [顶点P, 底面圆心O], lines: [4条母线, 底圆]
**球** — featurePoints: [球心O], lines: [3条经线, 赤道线]

### 决策 A：统一交互体验

**核心原则**：用户对所有几何体的点、线、面的操作逻辑和感受必须一致。

#### 决策 A1：曲面体的"面" ✅ 已决策 → 方案 A1-c（全面 Entity 化）

为曲面体所有面创建 Face Entity：

| 几何体 | 创建的 Face Entity |
|--------|-------------------|
| 圆柱 | 底面 Face + 顶面 Face + 侧面 Face |
| 圆锥 | 底面 Face + 侧面 Face |
| 球 | 球面 Face |

实现方式：
- `FaceSource` 新增 `{ type: 'surface'; surfaceType: 'disk' | 'lateral' | 'sphere' }`
- 平面面（底面/顶面）：`pointIds` 用圆上采样点，渲染为圆形多边形近似
- 曲面面（侧面/球面）：`pointIds` 为空或引用特征点，渲染仍使用 Three.js 原生几何体
- FaceEntityRenderer 需区分平面面和曲面面的渲染逻辑
- 面积计算：圆面 → πr²，侧面 → 精确公式（非多边形叉积法）
- 面上取点：平面面可复用现有逻辑；曲面面需专门的投影算法（可延后到需要时实现）
- 法向量：平面面法向量明确；曲面面可用几何中心处的法向量

#### 决策 A2：曲面体的"线" ✅ 已决策 → 方案 A2-c（全面 Entity 化）

为曲面体所有线创建对应 Entity，保证 hover/选中/取点体验一致：

| 线类型 | Entity 类型 | 说明 |
|--------|------------|------|
| 母线（直线） | Segment Entity | 复用现有 Segment 体系，有两个端点 |
| 圆弧线（底圆/顶圆/经线/赤道） | 新 Entity 或扩展 Segment | 需要决策用什么方式建模 |

**子决策 A2-sub：圆弧线的建模方式 → 扩展 Segment，新增 `curvePoints?: Vec3[]` 字段**

- SegmentEntityRenderer 检测到 curvePoints 时画曲线而非直线
- hitbox 用沿曲线的多段圆柱拼接
- 复用现有 Segment 的选中/hover/右键菜单/取点逻辑

---

## 问题 B：被遮挡的面无法选中

### 现状

`ToolEventDispatcher.buildToolEvent` 中固定取 `event.intersections[0]`（最近的命中对象），完全忽略后方的命中对象。

### 决策 B1 ✅ 已决策 → Ctrl+穿透

按住 Ctrl 键时：
- **Hover**：跳过最近的命中对象，hover 到后方被遮挡的实体（显示 hover 高亮）
- **点击**：选中当前 Ctrl+hover 到的被遮挡实体

实现要点：
- `ToolEventDispatcher` 的 `handlePointerMove` 和 `buildToolEvent` 检测 `event.nativeEvent.ctrlKey`
- Ctrl 按下时，从 `intersections` 中找到第一个有 `userData.entityId` 且不是当前最前方命中的对象
- 需要处理多层遮挡：Ctrl 时跳过 intersections[0]，取 intersections 中下一个有 entityId 的
- macOS 上 Ctrl 可能与系统冲突，考虑是否也支持 Meta 键

---

## 涉及文件预估

| 文件 | 问题 A | 问题 B |
|------|--------|--------|
| `src/editor/store/entityStore.ts` | ✏️ createBuiltInEntities 扩展 | — |
| `src/engine/builders/cylinder.ts` | ✏️ 补充面/线数据 | — |
| `src/engine/builders/cone.ts` | ✏️ 补充面/线数据 | — |
| `src/engine/builders/sphere.ts` | ✏️ 补充面数据 | — |
| `src/engine/types.ts` | ✏️ SurfaceResult 扩展 | — |
| `src/editor/entities/types.ts` | ✏️ FaceSource 扩展，可能新增 Entity 类型 | — |
| `src/components/scene/renderers/GeometryEntityRenderer.tsx` | ✏️ 移除直接渲染，改由 Entity Renderer 接管 | — |
| `src/components/scene/renderers/FaceEntityRenderer.tsx` | ✏️ 支持曲面面渲染 | — |
| `src/components/scene/renderers/SegmentEntityRenderer.tsx` | ✏️ 可能支持曲线渲染 | — |
| `src/components/scene/ToolEventDispatcher.tsx` | — | ✏️ Ctrl 穿透 hover/选中 |
| `src/editor/tools/selectTool.ts` | — | ✏️ Ctrl 穿透选中 |

---

## 待决策清单

| 编号 | 决策项 | 状态 |
|------|--------|------|
| A1 | 曲面体的面：全面 Entity 化 | ✅ 已决策 |
| A2 | 曲面体的线：全面 Entity 化 | ✅ 已决策（母线部分） |
| A2-sub | 圆弧线建模方式 → 方案 i：扩展 Segment 加 curvePoints | ✅ 已决策 |
| B1 | 被遮挡面选中：Ctrl+穿透 | ✅ 已决策 |

---

## 交付 DoD — V0.3 阶段2.1 ✅

**变更摘要**：

| 文件 | 变更类型 |
|------|---------|
| `src/engine/types.ts` | 新增 `SurfaceFace` 接口，`SurfaceResult` 新增 `faces` 字段 |
| `src/editor/entities/types.ts` | `FaceSource` 新增 `surface` 类型；`SegmentProperties` 新增 `curvePoints`、`lineIndex` |
| `src/engine/builders/cylinder.ts` | 新增 faces 数组（底面disk + 顶面disk + 侧面lateral） |
| `src/engine/builders/cone.ts` | 新增 faces 数组（底面disk + 侧面lateral） |
| `src/engine/builders/sphere.ts` | 新增 faces 数组（球面sphere） |
| `src/editor/store/entityStore.ts` | 曲面体 `createBuiltInEntities` 扩展：创建 Segment Entity（带 curvePoints/lineIndex）+ Face Entity |
| `src/components/scene/renderers/SegmentEntityRenderer.tsx` | 新增 `CurveSegment` + `CurveHitbox`（TubeGeometry），onContextMenu 提升到 group 级别 |
| `src/components/scene/renderers/FaceEntityRenderer.tsx` | 新增 `SurfaceFace` + `CurvedSurfaceMesh`（openEnded 原生几何体） |
| `src/components/scene/renderers/GeometryEntityRenderer.tsx` | 简化为空渲染（全部由 Entity Renderer 接管） |
| `src/components/scene/ToolEventDispatcher.tsx` | `findTargetHit` 支持 Ctrl/⌘ 穿透（跳过同 entityId 的所有交点） |
| `src/components/scene/ContextMenu3D.tsx` | 新增 `buildCurveMenuItems`（曲线上取点）；`useFaceMenuItems` 支持 surface 面 |
| `src/components/scene/ModeIndicator.tsx` | 选择工具新增交互提示文案 |

**验证结果**：
- `pnpm lint`: **PASS**
- `pnpm tsc --noEmit`: **PASS**
- 用户验收：通过

**修复记录**：
- Ctrl/Cmd 穿透不生效：`entityHits[1]` 可能是同一 mesh 的背面交点 → 改为按 entityId 去重查找
- 曲面体右键菜单不弹出（三个层面）：
  - `<Line>` 拦截 raycasting → onContextMenu 提升到 group 级别
  - `useMenuItems` 要求有效端点 → 新增曲线段菜单分支
  - `useFaceMenuItems` 要求 pointIds ≥ 3 → surface 面用 free 约束取点

**风险与回滚**：无破坏性变更，所有改动为增量添加

**审查结论**：✅ 实现匹配计划，已通过用户验收

**完成时间**：2026-03-10

---

*创建时间：2026-03-10*
*状态：✅ 已完成*
