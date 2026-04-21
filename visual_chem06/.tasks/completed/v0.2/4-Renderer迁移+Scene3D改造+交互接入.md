# 第4阶段：Renderer 迁移 + Scene3D 改造 + 交互接入

**任务ID**: 03-09-phase4-Renderer迁移
**风险等级**: L2（高风险：跨模块联动，改造 src/components/ 接入新系统，是旧→新集中切换阶段）
**流程路径**: MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**关联主计划**: `.tasks/active/v0.2/PROGRESSIVE-PLAN.md` 第4阶段
**关联架构文档**: `.tasks/active/v0.2/ARCHITECTURE.md` §8 + §9
**前置依赖**: 第1-3阶段全部完成（Entity + Store + Command + Tool）
**状态**: 待启动

---

## 任务目标

这是"旧→新"的集中切换阶段。将渲染管线从旧 Store（useGeometryStore）切换到 EntityStore，将交互事件从 useInteraction 切换到 Tool 系统，完成视觉和交互两条线路的全面接入。

**本阶段完成后**：视觉效果与 V0.1 一致，数据来源和交互入口全面切换到新系统。

---

## 验收标准

- [ ] 6 种几何体在新渲染管线下正确渲染（半透明面 + 棱线 + 顶点标签）
- [ ] 所有类型的点（顶点、棱上点、曲面点）渲染正确，选中高亮可用
- [ ] 自定义线段渲染正确（颜色/虚实/长度显示）
- [ ] 顶点标签双击编辑仍可用
- [ ] 工具栏可切换 Select / DrawSegment / CrossSection / CoordSystem 四种工具
- [ ] Escape 键在任何工具下回到 SelectTool
- [ ] SelectTool 下：点击选中顶点/棱线、拖拽移动顶点、右键菜单可用
- [ ] DrawSegmentTool 下：选两点画线段，线段通过 Command 创建（可 undo）
- [ ] CrossSectionTool 下：选点定义截面 → 创建 Face(crossSection) + 交点 Points（可 undo）
- [ ] 选中状态变更正确触发渲染高亮
- [ ] 新增实体类型只需注册渲染器组件，不需修改框架代码
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 现有代码概况（MODE 1 研究成果）

### 需要改造的旧文件

| 文件 | 行数 | 当前职责 | 改造方式 |
|------|------|----------|----------|
| `Scene3D.tsx` | ~316行 | Canvas 容器 + CameraAnimator + SceneContent 组件堆叠 + ViewButtons | 重构 SceneContent 为遍历 EntityStore；接入 Tool 事件分发 |
| `GeometryRenderer.tsx` | ~543行 | 多面体/曲面体渲染分发 + 顶点标签 + 棱线 + 自定义点 | 拆分为多个 EntityRenderer |
| `VertexLabels.tsx` | — | 顶点标签渲染 + 拖拽 | 合并到 PointEntityRenderer |
| `LineHitboxes.tsx` | — | 棱线/曲线命中体积 | 合并到 SegmentEntityRenderer |
| `CustomSegments.tsx` | — | 用户线段渲染 | 合并到 SegmentEntityRenderer |
| `CrossSection.tsx` | ~6867行 | 截面渲染 + 交互 | 合并到 FaceEntityRenderer（阶段5完善） |
| `ContextMenu3D.tsx` | ~264行 | 右键菜单（操作直接调 Store） | 操作改为通过 Command 执行 |
| `TopBar.tsx` | — | 几何体类型切换（直接调 Store） | 改为通过 ChangeGeometryTypeCommand |

### 需要删除/替代的旧 Hook

| Hook | 替代方案 |
|------|----------|
| `useInteraction.ts` | 逻辑拆分到 SelectTool + DrawSegmentTool + CrossSectionTool + CoordSystemTool |

### 已就绪的新系统

| 模块 | 文件 | 状态 |
|------|------|------|
| Entity 类型 | `src/editor/entities/types.ts` | ✅ 阶段1 |
| EntityStore | `src/editor/store/entityStore.ts` | ✅ 阶段1 |
| SelectionStore | `src/editor/store/selectionStore.ts` | ✅ 阶段1 |
| ToolStore | `src/editor/store/toolStore.ts` | ✅ 阶段1 |
| HistoryStore | `src/editor/store/historyStore.ts` | ✅ 阶段1 |
| 全部 Command | `src/editor/commands/*.ts` | ✅ 阶段2 |
| 快捷键 | `src/editor/shortcuts.ts` | ✅ 阶段2（未激活） |
| 四个 Tool | `src/editor/tools/*.ts` | ✅ 阶段3 |
| registerAllTools | `src/editor/tools/index.ts` | ✅ 阶段3 |

---

## 子任务清单

阶段4工作量大，按**四个批次**推进：
1. **批次A**：基础设施（BuilderResult 缓存 + RendererRegistry + 编辑器初始化）
2. **批次B**：四个 EntityRenderer（Geometry + Point + Segment + Face）
3. **批次C**：Scene3D 重构 + Tool 事件接入
4. **批次D**：TopBar / ContextMenu3D 改造 + 旧代码清理

---

### 批次A：基础设施

#### T4.1 BuilderResult 缓存机制

**目标**：实现 `geometry entity id → BuilderResult` 的运行时缓存（ARCH §8.4）。

**产出文件**：`src/editor/builderCache.ts`

**实现内容**：
- `builderResultCache: Map<string, { params: GeometryParams; result: BuilderResult }>`
- `getBuilderResult(geometry: Entity<'geometry'>): BuilderResult | null`
  - 检查缓存：如果 geometry.params 与缓存中一致 → 返回缓存
  - 否则：调用 `buildGeometry(geometryType, params)` 重算 → 更新缓存 → 返回
  - 发射 `geometryRebuilt` Signal（供依赖方监听）
- `invalidateCache(geometryId: string): void` — 手动失效
- `clearCache(): void`

**React Hook 封装**：
- `useBuilderResult(geometryId: string): BuilderResult | null`
  - 内部订阅 EntityStore 的 geometry 实体 params 变化
  - params 变化时自动重算（useMemo / useEffect）

**注意**：替代旧的 `useGeometryBuilder.ts` 的功能，但数据源从 useGeometryStore 改为 EntityStore

---

#### T4.2 RendererRegistry

**目标**：建立实体类型到渲染组件的注册表（ARCH §8.1）。

**产出文件**：`src/components/scene/renderers/index.ts`

**实现内容**：
```typescript
const rendererRegistry: Record<EntityType, React.ComponentType<{ entity: Entity }>> = {
  geometry: GeometryEntityRenderer,
  point: PointEntityRenderer,
  segment: SegmentEntityRenderer,
  face: FaceEntityRenderer,
  // 阶段5补充：coordinateSystem, circumSphere, circumCircle
};

function EntityRenderer({ entity }: { entity: Entity }) {
  const Component = rendererRegistry[entity.type];
  if (!Component) return null;
  return <Component entity={entity} />;
}
```

---

#### T4.3 编辑器初始化

**目标**：应用启动时完成编辑器系统初始化（ARCH 附录B）。

**产出文件**：`src/editor/init.ts`（或在 `src/editor/index.ts` 中）

**实现内容**：
1. 调用 `registerAllTools()` 注册四个 Tool
2. 创建初始 Geometry Entity（`type: 'cube', params: DEFAULT_PARAMS.cube`）
3. 设置 `activeGeometryId`
4. 调用 `buildGeometry()` 获取 BuilderResult
5. 调用 `createBuiltInEntities()` 创建 builtIn Point/Segment/Face
6. 激活 SelectTool 为默认工具
7. 调用 `setupShortcuts()` 绑定全局快捷键

**React 集成**：
- 提供 `useEditorInit()` Hook 或 `<EditorProvider>` 组件，在应用顶层调用一次
- 确保初始化只执行一次（useRef guard）

---

### 批次B：四个 EntityRenderer

#### T4.4 GeometryEntityRenderer

**目标**：渲染几何体自身（曲面体 Three.js 几何体 + 母线/轮廓线），**不渲染面**（ARCH §8.3）。

**产出文件**：`src/components/scene/renderers/GeometryEntityRenderer.tsx`

**迁移来源**：`GeometryRenderer.tsx` 的 `SurfaceRenderer` 部分

**实现内容**：
- 接收 `entity: Entity<'geometry'>`
- 通过 `useBuilderResult(entity.id)` 获取 BuilderResult
- **多面体**：不渲染任何内容（顶点由 PointEntityRenderer、棱线由 SegmentEntityRenderer、面由 FaceEntityRenderer 渲染）
- **曲面体**：
  - 渲染 Three.js 几何体（ConeGeometry / CylinderGeometry / SphereGeometry）
  - 渲染母线 / 轮廓线（从 `result.lines` 读取）
  - 半透明材质（与 V0.1 样式一致：颜色 #9ca3af，透明度 0.12）
  - **不渲染面**（曲面体暂无 Face Entity）

**样式保持**：与旧 `SurfaceRenderer` 视觉效果一致

---

#### T4.5 PointEntityRenderer

**目标**：统一渲染所有点类型（顶点/棱上点/曲面点/截面交点），保留选中高亮、标签显示、双击编辑。

**产出文件**：`src/components/scene/renderers/PointEntityRenderer.tsx`

**迁移来源**：`VertexLabels.tsx` + `GeometryRenderer.tsx` 中的 `CustomPointsRenderer` + `CurveCustomPointsRenderer`

**实现内容**：
- 接收 `entity: Entity<'point'>`
- **位置计算**（统一逻辑）：
  - 从 EntityStore 获取 geometryId 对应的 geometry Entity
  - 通过 `useBuilderResult(geometryId)` 获取 BuilderResult
  - 根据 `constraint.type` 计算 3D 位置：
    - `vertex`：从 BuilderResult.vertices[vertexIndex].position + positionOverride
    - `edge`：从两端点位置按 t 值插值
    - `curve`：从 BuilderResult.lines[lineIndex] 按 t 值插值
  - 提供 `usePointPosition(pointEntity)` 统一 Hook

- **渲染**：
  - **builtIn 顶点**：HTML 标签（`<Html>`）显示 label，与旧 VertexLabels 样式一致
  - **用户创建的点**：小球体（红色 #ef4444）+ HTML 标签
  - **选中高亮**：从 SelectionStore 读取 selectedIds，选中时添加高亮效果
  - **双击编辑**：双击标签进入编辑模式，确认后通过 `RenameEntityCommand` 提交

- **命中检测**：
  - mesh `userData` 携带 `{ entityId: entity.id, entityType: 'point' }`
  - 供 Tool 系统的 raycasting 命中识别

**提取公共 Hook**：
- `usePointPosition(pointEntity: Entity<'point'>): [number, number, number] | null`
  - 阶段5的辅助功能渲染器也需要此 Hook

---

#### T4.6 SegmentEntityRenderer

**目标**：统一棱线和用户线段渲染，保留颜色/虚实/长度显示 + 不可见命中体积。

**产出文件**：`src/components/scene/renderers/SegmentEntityRenderer.tsx`

**迁移来源**：
- `GeometryRenderer.tsx` 中的棱线渲染
- `CustomSegments.tsx`
- `LineHitboxes.tsx`（命中体积）

**实现内容**：
- 接收 `entity: Entity<'segment'>`
- **端点位置**：通过 `usePointPosition` 获取 startPoint / endPoint 的 3D 位置
- **渲染**：
  - **builtIn 棱线**：黑色实线（#1a1a1a，宽度2），与旧版一致
  - **用户线段**：按 `style.color` / `style.dashed` 渲染
  - **选中高亮**：选中时 amber-500 (#f59e0b)，宽度3
  - **长度显示**：用户线段显示长度标签
  - **标签**：如果有 `label`，显示标签

- **不可见命中体积**（迁移自 LineHitboxes）：
  - 沿线段方向的透明圆柱体
  - `userData: { entityId: entity.id, entityType: 'segment' }`
  - 供 raycasting 命中识别 + 右键菜单触发

---

#### T4.7 FaceEntityRenderer

**目标**：统一渲染所有面（builtIn 几何体面 + 截面）。

**产出文件**：`src/components/scene/renderers/FaceEntityRenderer.tsx`

**迁移来源**：
- `GeometryRenderer.tsx` 中的多面体半透明面渲染
- `CrossSection.tsx` 中的截面面渲染

**实现内容**：
- 接收 `entity: Entity<'face'>`
- **顶点位置**：通过 `usePointPosition` 获取每个 pointId 的 3D 位置
- **渲染**：
  - **builtIn 几何体面**（`source.type='geometry'`）：
    - 半透明填充（#9ca3af，opacity 0.12）
    - 使用 BufferGeometry + 三角化
  - **截面面**（`source.type='crossSection'`）：
    - 半透明填充（截面颜色，与 V0.1 一致）
    - 截面边界线
  - **选中高亮**：预留（V0.3 面交互时启用）

- **注意**：
  - 多面体面的渲染可以从 BuilderResult 直接获取已三角化的 indices（性能优化）
  - 截面面需要自行三角化 pointIds 构成的多边形

---

### 批次C：Scene3D 重构 + 交互接入

#### T4.8 Scene3D 重构

**目标**：从组件堆叠改为遍历 EntityStore 实体、按类型分发渲染器。

**修改文件**：`src/components/scene/Scene3D.tsx`

**改造内容**：

**SceneContent 重写**：
```tsx
function SceneContent() {
  const entities = useEntityStore(state => Object.values(state.entities));
  const visibleEntities = entities.filter(e => e.visible);

  return (
    <>
      {visibleEntities.map(entity => (
        <EntityRenderer key={entity.id} entity={entity} />
      ))}
    </>
  );
}
```

**保留不变**：
- `CameraAnimator`（相机动画）
- `ViewButtons`（视角快捷按钮）
- Canvas 基础配置（背景色、相机参数）
- OrbitControls（触屏手势：单指旋转，双指缩放+平移）
- isDragging 控制 OrbitControls 启用（现从 Tool 系统获取状态）

**删除**：
- 旧的 `<GeometryRenderer>` / `<CoordinateAxes>` / `<CircumSphere>` / `<CircumCircle>` / `<CustomSegments>` / `<CrossSection>` 硬编码引用
- 旧 Store 的 `useGeometryStore` 订阅

---

#### T4.9 Tool 事件接入

**目标**：Canvas pointer 事件分发到 ToolStore 的活跃 Tool（替代 useInteraction）。

**修改文件**：`src/components/scene/Scene3D.tsx`（或新建 `src/components/scene/ToolEventDispatcher.tsx`）

**实现内容**：

**事件分发层**：
```tsx
function ToolEventDispatcher({ children }) {
  const getActiveTool = useToolStore(s => s.getActiveTool);

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    const tool = getActiveTool();
    if (!tool?.onPointerDown) return;

    const toolEvent: ToolPointerEvent = {
      nativeEvent: event.nativeEvent,
      intersection: event.intersections[0],
      hitEntityId: event.object?.userData?.entityId,
      hitEntityType: event.object?.userData?.entityType,
    };
    tool.onPointerDown(toolEvent);
  }, [getActiveTool]);

  // 同理 handlePointerMove, handlePointerUp

  return (
    <group onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      {children}
    </group>
  );
}
```

**Raycasting 命中识别**：
- 每个 EntityRenderer 的可交互 mesh 都在 `userData` 中携带 `{ entityId, entityType }`
- R3F 的 `onPointerDown` 事件自动包含 `intersections` 数组
- 取第一个交点的 `object.userData` 提取 `hitEntityId`

**SelectTool 拖拽接入**：
- SelectTool.onPointerMove 中的 positionOverride 计算：
  - 从 `event.intersection.point`（Three.js 世界坐标）提取拖拽目标位置
  - 注意：需要考虑拖拽平面（当前 V0.1 的拖拽逻辑需要迁移）
- 拖拽期间需设置 `isDragging = true` 以禁用 OrbitControls

**onPointerMissed**：
- 点击空白区域 → `SelectionStore.clear()` + 关闭右键菜单

---

#### T4.10 Selection → 渲染高亮接入

**目标**：SelectionStore 变更触发渲染器高亮更新。

**实现方式**：各 Renderer 内部订阅 SelectionStore

```tsx
// 在各 EntityRenderer 内部
const isSelected = useSelectionStore(s => s.selectedIds.includes(entity.id));
// 根据 isSelected 切换高亮样式
```

**高亮规则**：
- Point：选中时放大 + 高亮色
- Segment：选中时 amber-500 (#f59e0b)，宽度从 2 → 3
- Face：V0.2 暂不实现面选中高亮

---

### 批次D：TopBar / ContextMenu / 旧代码清理

#### T4.11 TopBar 改造

**目标**：几何体类型切换通过 ChangeGeometryTypeCommand 执行。

**修改文件**：`src/components/layout/TopBar.tsx`

**改造内容**：
- 数据源：从 `useGeometryStore.currentType` → `useEntityStore` 读取 activeGeometry 的 geometryType
- 点击切换：
  - 旧：`store.setType(newType)`
  - 新：构造 `ChangeGeometryTypeCommand(geometryId, newType, newDefaultParams, newBuilderResult)` → `HistoryStore.execute(cmd)`
- 保留：图标映射、按钮样式、布局不变

---

#### T4.12 ContextMenu3D 改造

**目标**：右键菜单操作通过 Command 执行，菜单状态改为组件局部状态。

**修改文件**：`src/components/scene/ContextMenu3D.tsx`

**改造内容**：
- **菜单状态**：从全局 Store → 组件局部 useState（ARCH D7）
- **菜单触发**：从 Renderer 的 `userData` 获取 `entityId`，右键时打开菜单
- **操作执行**（改为通过 Command）：
  - "取中点"：`CreateEntityCommand('point', { builtIn: false, constraint: { type: 'edge', edgeStart, edgeEnd, t: 0.5 }, ... })`
  - "在此处取点"：同上，t 值从命中位置计算
  - "2/3等分"：`BatchCommand` 封装多个 CreateEntityCommand
  - "命名线段"：直接选中对应 Segment Entity 进入编辑
- **菜单项生成**：
  - 右键命中 Segment Entity → 显示取点/等分/命名选项
  - 右键命中 Point Entity（builtIn=false）→ 显示删除选项

---

#### T4.13 工具栏 UI

**目标**：3D 区域增加工具栏，提供 Tool 切换按钮。

**产出文件**：`src/components/scene/ToolBar.tsx`（或在 Scene3D 中内联）

**实现内容**：
- 四个工具按钮：Select / DrawSegment / CrossSection / CoordSystem
- 当前激活工具高亮
- 点击切换：`ToolStore.setActiveTool(toolId)`
- 放置位置：3D 区域左上角悬浮

---

#### T4.14 编辑器初始化集成

**目标**：在应用入口调用编辑器初始化，替换旧 Store 的初始化。

**修改文件**：`src/App.tsx` 或 `src/components/layout/AppLayout.tsx`

**实现内容**：
- 在应用顶层调用 `useEditorInit()`（T4.3 产出）
- 确保 EntityStore 中已有初始 Geometry + builtIn 子实体
- 确保 Tool 系统就绪

---

#### T4.15 旧组件渐进替换

**目标**：确保旧的渲染组件被新 Renderer 替代后可以移除引用。

**改造策略**：
- `GeometryRenderer.tsx`：内容被拆分到四个 EntityRenderer 后，删除或保留为空壳（过渡期）
- `VertexLabels.tsx`：合并到 PointEntityRenderer 后，移除 Scene3D 中的引用
- `LineHitboxes.tsx`：合并到 SegmentEntityRenderer 后，移除引用
- `CustomSegments.tsx`：合并到 SegmentEntityRenderer 后，移除引用
- `CrossSection.tsx`：截面渲染合并到 FaceEntityRenderer，交互部分阶段5完善
- `useInteraction.ts`：逻辑已迁移到 Tool 系统，移除 Scene3D 中的调用

**注意**：旧文件本阶段暂不物理删除（阶段8统一清理），仅移除引用

---

### T4.16 门禁验证

**目标**：执行完整的回归验证。

**验证内容**：

1. **编译检查**：`pnpm lint && pnpm tsc --noEmit`
2. **视觉回归**（浏览器手动验证）：
   - 6 种几何体渲染正确（正方体/长方体/棱锥/圆锥/圆柱/球）
   - 半透明面 + 棱线 + 顶点标签与 V0.1 一致
   - 参数滑块调整后渲染实时更新
3. **交互回归**：
   - 点击顶点选中 → 高亮
   - 点击棱线选中 → 高亮
   - 拖拽顶点 → 位置跟随 → 松开后可 undo
   - 双击顶点标签 → 进入编辑 → 确认后可 undo
   - 右键棱线 → 取点/等分菜单可用
   - DrawSegmentTool：选两点画线段 → 可 undo
   - CrossSectionTool：选点创建截面 → 可 undo
   - Ctrl+Z / Ctrl+Y 正常工作
   - Escape 回到 SelectTool
4. **几何体切换**：
   - TopBar 切换几何体类型 → 渲染正确更新 → 可 undo

---

## 涉及文件范围

**新增文件**：

```
src/editor/
├── builderCache.ts                           # T4.1: BuilderResult 缓存
└── init.ts                                   # T4.3: 编辑器初始化

src/components/scene/
├── renderers/
│   ├── index.ts                              # T4.2: RendererRegistry + EntityRenderer
│   ├── GeometryEntityRenderer.tsx            # T4.4
│   ├── PointEntityRenderer.tsx               # T4.5
│   ├── SegmentEntityRenderer.tsx             # T4.6
│   └── FaceEntityRenderer.tsx                # T4.7
├── ToolEventDispatcher.tsx                   # T4.9: Tool 事件分发
└── ToolBar.tsx                               # T4.13: 工具栏 UI
```

**修改文件**：

```
src/components/scene/Scene3D.tsx              # T4.8: 重构 SceneContent
src/components/scene/ContextMenu3D.tsx        # T4.12: Command 化
src/components/layout/TopBar.tsx              # T4.11: Command 化
src/App.tsx 或 AppLayout.tsx                  # T4.14: 初始化集成
src/editor/index.ts                          # 更新导出
```

**旧文件（移除引用，不物理删除）**：
- `src/components/scene/GeometryRenderer.tsx`
- `src/components/scene/VertexLabels.tsx`
- `src/components/scene/LineHitboxes.tsx`
- `src/components/scene/CustomSegments.tsx`
- `src/hooks/useInteraction.ts`

---

## 依赖关系与推进顺序

```
批次A（基础设施）：
  T4.1 BuilderResult 缓存 ─┐
  T4.2 RendererRegistry ────┤ 彼此独立
  T4.3 编辑器初始化 ────────┘
    ↓
批次B（四个 Renderer）：
  T4.4 GeometryEntityRenderer ─┐
  T4.5 PointEntityRenderer ────┤ 彼此独立（但 Segment/Face 依赖 Point 的 usePointPosition）
  T4.6 SegmentEntityRenderer ──┤
  T4.7 FaceEntityRenderer ─────┘
    ↓
批次C（Scene3D + 交互）：
  T4.8 Scene3D 重构（依赖 T4.2 + T4.4~T4.7）
  T4.9 Tool 事件接入（依赖 T4.8）
  T4.10 Selection 高亮（依赖 T4.5~T4.7）
    ↓
批次D（改造 + 清理）：
  T4.11 TopBar 改造 ──────────┐
  T4.12 ContextMenu3D 改造 ───┤ 彼此独立
  T4.13 工具栏 UI ────────────┤
  T4.14 编辑器初始化集成 ─────┘
  T4.15 旧组件替换（依赖 T4.8~T4.14 全部完成）
    ↓
  T4.16 门禁验证
```

---

## 技术要点

### usePointPosition Hook（核心公共逻辑）

```typescript
function usePointPosition(point: Entity<'point'>): [number, number, number] | null {
  const geometry = useEntityStore(s => s.getEntity(point.properties.geometryId));
  const builderResult = useBuilderResult(point.properties.geometryId);

  return useMemo(() => {
    if (!builderResult) return null;
    const { constraint, positionOverride } = point.properties;

    switch (constraint.type) {
      case 'vertex': {
        const base = builderResult.kind === 'polyhedron'
          ? builderResult.vertices[constraint.vertexIndex].position
          : builderResult.featurePoints[constraint.vertexIndex].position;
        if (positionOverride) return positionOverride; // 拖拽覆盖
        return [base.x, base.y, base.z];
      }
      case 'edge': {
        // 从两端点按 t 插值
        // ...
      }
      case 'curve': {
        // 从曲线按 t 插值
        // ...
      }
    }
  }, [point.properties, builderResult]);
}
```

### Tool 事件分发与 OrbitControls 协调

- Tool 的 isDragging 状态需要传递给 OrbitControls 以禁用旋转
- 方案：在 ToolEventDispatcher 中维护 isDragging 状态，通过 context 或 prop 传递给 OrbitControls

### 右键菜单触发方式

- SegmentEntityRenderer 的命中体积 mesh 添加 `onContextMenu` 事件
- 事件中设置 ContextMenu3D 的局部状态（position + targetEntityId）
- ContextMenu3D 根据 targetEntityId 从 EntityStore 读取实体信息生成菜单项

### 渲染顺序

EntityRenderer 遍历所有可见实体，渲染顺序：
1. Face（半透明面，先渲染以免遮挡）
2. Segment（棱线/线段）
3. Point（顶点/自定义点，最后渲染以保持在最上层）
4. Geometry（曲面体几何体）

可在 SceneContent 中按 type 分组排序，或在各 Renderer 中设置 renderOrder。

---

## 注意事项

1. **这是整个重构的关键切换点**：本阶段完成后，数据来源和交互入口全面切换到新系统，V0.1 的视觉效果必须完整保持
2. **渐进式切换**：可以先让新旧系统并行，逐个组件切换验证，避免一次性全部替换导致难以调试
3. **样式保持**：所有颜色、透明度、线宽、字体等必须与 V0.1 完全一致
4. **性能关注**：EntityStore 的 `Object.values(entities)` 在每次渲染都会创建新数组，考虑使用 Zustand selector 优化
5. **触屏兼容**：OrbitControls 的触屏手势（单指旋转、双指缩放+平移）必须保持
6. **阶段5预留**：CoordinateSystem / CircumSphere / CircumCircle 的 Renderer 在本阶段注册为空实现（或不注册），阶段5完善
7. **旧文件暂不删除**：移除引用即可，物理删除放在阶段8

---

## 执行记录

### 2026-03-09 批次A~D 完成

**批次A（基础设施）**：
- T4.1 ✅ `src/editor/builderCache.ts` — BuilderResult 缓存 + useBuilderResult Hook
- T4.2 ✅ `src/components/scene/renderers/index.ts` — RendererRegistry + EntityRenderer 分发
- T4.3 ✅ `src/editor/init.ts` — initEditor() + useEditorInit() Hook

**批次B（四个 EntityRenderer）**：
- T4.4 ✅ `src/components/scene/renderers/GeometryEntityRenderer.tsx` — 曲面体渲染（多面体返回 null）
- T4.5 ✅ `src/components/scene/renderers/PointEntityRenderer.tsx` — builtIn 顶点标签 + 用户自定义点 + 双击编辑（RenameEntityCommand）
- T4.5 ✅ `src/components/scene/renderers/usePointPosition.ts` — 公共 Hook 提取（供 Segment/Face 复用）
- T4.6 ✅ `src/components/scene/renderers/SegmentEntityRenderer.tsx` — 棱线/用户线段 + Hitbox + 右键菜单 + 选中高亮
- T4.7 ✅ `src/components/scene/renderers/FaceEntityRenderer.tsx` — 几何体面 + 截面面

**批次C（Scene3D + 交互）**：
- T4.8 ✅ `src/components/scene/Scene3D.tsx` — SceneContent 改为遍历 EntityStore + 按类型排序渲染
- T4.9 ✅ `src/components/scene/ToolEventDispatcher.tsx` — Tool 事件分发 + 拖拽平面投影
- T4.10 ✅ Selection 高亮已在各 Renderer 中实现（useSelectionStore 订阅）
- 补充 ✅ `src/editor/store/toolStore.ts` — 添加 isDragging 状态（替代旧 useGeometryStore.isDragging）
- 补充 ✅ `src/editor/tools/selectTool.ts` — 实现实际拖拽逻辑（intersection.point 提取 3D 坐标）

**批次D（改造 + 清理）**：
- T4.11 ✅ `src/components/layout/TopBar.tsx` — 改为 EntityStore + ChangeGeometryTypeCommand
- T4.12 ✅ `src/components/scene/ContextMenu3D.tsx` — 改为 Command 操作（CreateEntityCommand/BatchCommand）
- T4.12 ✅ `src/components/scene/contextMenuStore.ts` — 新建右键菜单状态 store
- T4.13 ✅ `src/components/scene/ToolBar.tsx` — 四个工具切换按钮（左上角悬浮）
- T4.14 ✅ `src/App.tsx` — 添加 useEditorInit() 调用
- T4.15 ✅ Scene3D 中旧组件引用已移除（GeometryRenderer/CoordinateAxes/CircumSphere 等）

**门禁验证**：
- T4.16 ✅ `pnpm lint` 通过（0 errors）
- T4.16 ✅ `pnpm tsc --noEmit` 通过
- T4.16 ✅ `pnpm build` 通过（built in 6.13s）
- 额外修复：entityStore/selectTool/coordSystemTool/crossSectionTool/drawSegmentTool 中的联合类型窄化问题（build 比 tsc 更严格）

**状态**: ✅ 全部完成（含浏览器验证）

### 2026-03-09 子任务 4.1.2 截面生成逻辑重设计

- ✅ 交点复用：t≈0/1 复用顶点 Point，棱内部检查已有点，坐标级去重
- ✅ 方案C面分割：定义点三角形 + 延伸部分三角扇，无重叠
- ✅ Segment 创建：多边形边实线、定义点间虚线，已有棱线自动跳过
- ✅ entityStore 新增 `findPointAtVertex` / `findPointOnEdge` / `findSegmentByPoints`
- ✅ 门禁通过 + 浏览器视觉验证通过
- 详见 `.tasks/active/v0.2/4.1.2-截面生成逻辑重设计.md`
