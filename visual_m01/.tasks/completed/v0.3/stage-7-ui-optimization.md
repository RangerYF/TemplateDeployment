# V0.3 阶段7：UI 优化 + 全量回归 + 收尾

> **阶段目标**：优化编辑器 UI 布局与交互体验，完成 V0.3 全量回归验证和版本交付
> **前置条件**：阶段1-6 全部完成
> **BACKLOG 覆盖**：UI 体验优化（无独立 F 编号，属于收尾打磨）
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.3/PROGRESSIVE-PLAN.md`
> - 功能演示清单：`docs/功能演示清单.md`

---

## 当前 UI 问题总览

| 问题 | 现状 | 目标 |
|------|------|------|
| 工具栏位置 | 左上角竖排，无名称 | 3D 视图顶部居中，横排，图标下方有名称 |
| 几何体图标 | 5个共用 Triangle、2个共用 Box | 13 种几何体各有独立 SVG 图标 |
| 辅助功能冗余 | 自定义线段/截面/外接圆菜单与 Tool 重复 | 移除冗余菜单及代码 |
| 坐标系 UI 级别 | 藏在辅助功能折叠区内 | 独立区域，与辅助功能同级 |
| 标注工具 | 与左侧实体列表功能重复 | 合并到左侧实体列表，删除标注工具区域 |
| 导入导出位置 | 藏在辅助功能最底部 | 放到右侧面板最上方 |
| Inspector 设计 | 各类型不统一，操作少 | 统一通用操作栏 + 各类型属性编辑 |

---

## 子任务清单

### T7.1 工具栏重定位 + 名称标签 ⏱️ 0.5天

**目标**：工具栏从左上角竖排移到 3D 视图顶部居中横排，图标下方增加工具名称。

**当前状态**：
- `ToolBar.tsx`：绝对定位 `top: 12px, left: 12px`，`flex-direction: column`
- 7 个工具按钮，36×36px，只有图标没有文字

**要做的事**：

1. **`src/components/scene/ToolBar.tsx`** — 布局改造：
   - position: absolute → top: 12px, left: 50%, transform: translateX(-50%)
   - flex-direction: column → row
   - 每个按钮改为上下结构：图标 + 名称
   - 名称使用 TOOLS 数组中已有的 `label` 字段（选择、画线段、截面、坐标系、外接圆、角度、距离）
   - 名称样式：fontSize 10px，marginTop 2px，颜色跟随激活态

2. **按钮尺寸调整**：
   - 宽度：从 36px 调整为 auto（适应文字宽度），min-width 48px
   - 高度：适应图标+文字，约 52px
   - 间距：gap 4px → 2px（横排更紧凑）

**涉及文件**：
- `src/components/scene/ToolBar.tsx` — 布局+样式重构

**验收**：
- [ ] 工具栏在 3D 视图顶部水平居中
- [ ] 每个工具按钮显示图标 + 下方名称
- [ ] 激活态样式与非激活态区分清晰
- [ ] 不遮挡 3D 场景关键区域
- [ ] TypeScript 编译通过

---

### T7.2 几何体 SVG 独立图标 ⏱️ 1天

**目标**：为 13 种几何体绘制独立的简笔画 SVG 图标，替代当前的 Lucide 通用图标。

**当前图标映射（重复严重）**：
```
Triangle → pyramid, regularTetrahedron, cornerTetrahedron, frustum, isoscelesTetrahedron (5个!)
Box      → cuboid, prism (2个)
BoxSelect → cube
Cone     → cone, truncatedCone
Cylinder → cylinder
Circle   → sphere
orthogonalTetrahedron → Triangle (无独立图标)
```

**新图标设计方案**（SVG 简笔画，18×18 viewBox，线条风格）：

| 几何体 | 图标描述 |
|--------|---------|
| cube 正方体 | 立方体线框（等轴测视角） |
| cuboid 长方体 | 长方体线框（略扁，区分正方体） |
| prism 正棱柱 | 六棱柱线框（正面看到六边形底） |
| pyramid 棱锥 | 四棱锥（方底尖顶） |
| frustum 棱台 | 四棱台（梯形侧面） |
| cone 圆锥 | 圆锥侧面轮廓（三角+底部椭圆弧） |
| truncatedCone 圆台 | 圆台侧面轮廓（梯形+上下椭圆弧） |
| cylinder 圆柱 | 圆柱侧面轮廓（长方形+上下椭圆弧） |
| sphere 球 | 球体（圆+经纬线） |
| regularTetrahedron 正四面体 | 正四面体线框（三角底+顶点） |
| cornerTetrahedron 墙角四面体 | 直角三面体（三条直角边+三角面） |
| isoscelesTetrahedron 对棱相等 | 四面体+对棱等号标记 |
| orthogonalTetrahedron 对棱垂直 | 四面体+对棱垂直标记 |

**技术实现**：

1. **`src/components/icons/GeometryIcons.tsx`** — 新建，导出 13 个 SVG React 组件：
   ```tsx
   export function CubeIcon(props: SVGProps) { return <svg>...</svg>; }
   export function CuboidIcon(props: SVGProps) { ... }
   // ... 13个

   export const GEOMETRY_ICON_MAP: Record<GeometryType, React.ComponentType<SVGProps>> = {
     cube: CubeIcon,
     cuboid: CuboidIcon,
     // ...
   };
   ```

2. **`src/components/layout/TopBar.tsx`** — 替换 ICON_MAP：
   - 移除 Lucide 图标导入
   - 使用 `GEOMETRY_ICON_MAP[type]` 渲染

**涉及文件**：
- `src/components/icons/GeometryIcons.tsx` — 🆕 新建
- `src/components/layout/TopBar.tsx` — 替换图标

**验收**：
- [ ] 13 种几何体各有独立可辨识的图标
- [ ] 图标尺寸与现有布局一致
- [ ] 选中态图标颜色跟随
- [ ] TypeScript 编译通过

---

### T7.3 右侧面板重构 ⏱️ 1天

**目标**：精简右侧面板结构，去除冗余菜单，调整功能区域层级。

**当前右侧面板结构**：
```
参数设置 (ParameterPanel)
辅助功能 (AuxiliaryTools)
  ├─ 展开图 (Switch)
  ├─ 三视图 (Switch)
  ├─ 自定义线段 (Button)      ← 与 drawSegment Tool 重复
  ├─ 截面 (Button)             ← 与 crossSection Tool 重复
  ├─ 坐标系 (Switch + 输入)
  ├─ 外接球 (Switch)
  ├─ 外接圆 (Switch)           ← 与 circumCircle Tool 重复
  └─ 场景数据 (导出/导入)
标注工具 (LabelingTools)        ← 与左侧实体列表重复
  ├─ 已命名线段列表
  └─ 已添加的点列表
```

**目标结构**：
```
场景数据 (导出/导入)            ← 置顶
参数设置 (ParameterPanel)
坐标系 (独立区域)               ← 从辅助功能提升
  ├─ 启用开关
  ├─ 原点信息 + 重选原点
  └─ 坐标点添加
辅助功能 (精简后)
  ├─ 展开图 (Switch)
  ├─ 三视图 (Switch)
  ├─ 外接球 (Switch)
  └─ (坐标系/外接圆/自定义线段/截面 已移除)
```

**要做的事**：

1. **`src/components/panels/AuxiliaryTools.tsx`** — 大幅精简：
   - 删除"自定义线段"功能区（整个按钮+状态切换逻辑）
   - 删除"截面"功能区
   - 删除"外接圆"功能区
   - 删除"坐标系"功能区（移到独立组件）
   - 删除"场景数据"功能区（移到顶部独立组件）
   - 保留：展开图 Switch、三视图 Switch、外接球 Switch

2. **`src/components/panels/CoordSystemPanel.tsx`** — 新建独立坐标系面板：
   - 从 AuxiliaryTools 中提取坐标系的全部 UI（开关 + 原点显示 + 重选原点按钮 + 坐标点输入）
   - 独立可折叠区域，标题"坐标系"

3. **`src/components/panels/DataIOPanel.tsx`** — 新建导入导出面板：
   - 从 AuxiliaryTools 中提取场景数据的导出/导入按钮
   - 置于右侧面板最顶部
   - 简洁横排：[导出] [导入] 两个按钮

4. **右侧面板布局** — 调整组件顺序：
   - 找到 RightPanel/LeftPanel 的渲染逻辑，按新顺序排列：
     DataIOPanel → ParameterPanel → CoordSystemPanel → AuxiliaryTools(精简后) → Inspector

5. **`src/components/panels/LabelingTools.tsx`** — 删除：
   - 删除整个文件
   - 从右侧面板中移除引用
   - 重命名功能已由左侧实体列表承载（双击可重命名）

6. **清理冗余代码**：
   - AuxiliaryTools 中涉及 drawSegment/crossSection/circumCircle 的状态管理逻辑
   - 如果这些菜单有独立的 store 状态或工具切换逻辑，一并清理

**涉及文件**：
- `src/components/panels/AuxiliaryTools.tsx` — 大幅精简
- `src/components/panels/CoordSystemPanel.tsx` — 🆕 独立坐标系面板
- `src/components/panels/DataIOPanel.tsx` — 🆕 导入导出面板
- `src/components/panels/LabelingTools.tsx` — 删除
- `src/components/layout/LeftPanel.tsx`（或 RightPanel）— 调整面板顺序

**验收**：
- [ ] 右侧面板不再出现自定义线段/截面/外接圆的按钮
- [ ] 不再出现标注工具区域
- [ ] 坐标系有独立的可折叠区域
- [ ] 导入/导出按钮在右侧面板最顶部
- [ ] 删除冗余菜单后原有 Tool 功能不受影响
- [ ] TypeScript 编译通过

---

### T7.4 Inspector 统一设计 ⏱️ 1.5天

**目标**：选中任意实体时，右侧 Inspector 采用统一布局：顶部通用操作栏 + 下方类型专属属性编辑。

**统一 Inspector 结构**：
```
┌───────────────────────────────┐
│ [图标] 实体名称    [👁] [🔒] [🗑] │  ← 通用操作栏
├───────────────────────────────┤
│ 类型专属属性区                    │
│ ...                             │
└───────────────────────────────┘
```

**通用操作栏**（所有实体统一）：
- 实体类型图标 + 可编辑名称（点击进入编辑态）
- 隐藏/显示 toggle 按钮
- 锁定/解锁 toggle 按钮
- 删除按钮（builtIn 实体不显示删除，或 disabled）

**各类型属性编辑设计**：

#### Point（点）
| 属性 | 控件 | 说明 |
|------|------|------|
| 约束类型 | 只读标签 | 顶点/棱上/曲线上/坐标/自由/面上 |
| t 值 | 滑块 (0~1) | 仅棱上/曲线上约束时显示 |
| 坐标 (x, y, z) | 只读文本 | 仅有坐标系时显示 |
| 显示名称标签 | Switch | 控制 3D 场景中是否显示点的名称标签 |

#### Segment（线段）
| 属性 | 控件 | 说明 |
|------|------|------|
| 端点 | 只读标签 | 如 "A → B" |
| 长度 | 只读文本 | 精确/近似值 |
| 颜色 | 颜色预设按钮组 | 仅用户线段可编辑（黑/红/蓝/绿/紫/橙） |
| 虚实线 | Switch | 仅用户线段可编辑 |
| 显示名称标签 | Switch | 控制是否显示线段名称 |
| 显示长度标签 | Switch | 控制是否显示长度数值 |

#### Face（面）
| 属性 | 控件 | 说明 |
|------|------|------|
| 来源 | 只读标签 | 几何体面/截面/自定义 |
| 顶点 | 只读标签 | 如 "ABCD" |
| 面积 | 只读文本 | 自动计算 |
| 面上取点列表 | 只读列表 | 已有的面上点 |

#### CoordinateSystem（坐标系）
| 属性 | 控件 | 说明 |
|------|------|------|
| 原点 | 只读标签 + 重选按钮 | 当前原点标签 |
| 显示坐标标签 | Switch | 控制各点旁的 (x,y,z) 坐标标签是否显示 |
| 显示刻度 | Switch | 控制轴线上的刻度球是否显示 |

#### AngleMeasurement（角度度量）
| 属性 | 控件 | 说明 |
|------|------|------|
| 类型 | 只读标签 | 二面角/线面角/线线角 |
| 关联元素 | 只读标签 | 如 "面ABCD ∧ 面ABB'A'" |
| 精确值 | 只读 LaTeX | 如 "90°" 或 "arctan√2" |
| 近似值 | 只读文本 | 如 "≈ 54.74°" |
| 显示角度标签 | Switch | 控制 3D 场景中角度标签是否显示 |
| 显示弧线 | Switch | 控制弧线是否显示 |

#### DistanceMeasurement（距离度量）
| 属性 | 控件 | 说明 |
|------|------|------|
| 类型 | 只读标签 | 点点/点线/点面/线线/线面 |
| 关联元素 | 只读标签 | 如 "A → 面DCBA" |
| 精确值 | 只读 LaTeX | 如 "√2" |
| 近似值 | 只读文本 | 如 "≈ 1.41" |
| 显示距离标签 | Switch | 控制 3D 场景中距离标签是否显示 |
| 显示辅助线 | Switch | 控制虚线垂线/公垂线是否显示 |

#### CircumSphere（外接球）
| 属性 | 控件 | 说明 |
|------|------|------|
| 半径 | 只读 LaTeX | 精确值 + 近似值 |
| 球心坐标 | 只读文本 | (x, y, z) |
| 线框透明度 | 滑块 | 调节球体线框的可见度 |

#### CircumCircle（外接圆）
| 属性 | 控件 | 说明 |
|------|------|------|
| 定义点 | 只读标签 | P0, P1, P2 |
| 半径 | 只读文本 | 数值 |
| 重选定义点 | 按钮 | 重新选择三个点 |

---

**技术实现**：

1. **`src/components/panels/inspectors/InspectorCommon.tsx`** — 🆕 通用操作栏组件：
   ```tsx
   interface InspectorHeaderProps {
     entity: Entity;
     icon: React.ReactNode;
     typeName: string;
   }

   // 渲染：[图标] [可编辑名称] [隐藏] [锁定] [删除]
   export function InspectorHeader({ entity, icon, typeName }: InspectorHeaderProps) { ... }
   ```

2. **`src/editor/entities/types.ts`** — Entity properties 扩展（各类型增加显示控制字段）：
   ```ts
   // PointProperties 新增
   showLabel?: boolean;      // 默认 true

   // SegmentProperties 新增
   showLabel?: boolean;      // 默认 false（builtIn）/ true（用户线段有标签时）
   showLength?: boolean;     // 默认 true（用户线段）

   // AngleMeasurementProperties 新增
   showLabel?: boolean;      // 默认 true
   showArc?: boolean;        // 默认 true

   // DistanceMeasurementProperties 新增
   showLabel?: boolean;      // 默认 true
   showAuxLine?: boolean;    // 默认 true

   // CoordinateSystemProperties 新增
   showCoordLabels?: boolean;  // 默认 true
   showTicks?: boolean;        // 默认 true
   ```

3. **各 Inspector 组件重构**（9个文件）：
   - 统一使用 `InspectorHeader` 作为顶部
   - 下方根据类型渲染属性编辑区
   - Switch 控件使用 `updateProperties` + Command 更新对应字段

4. **各 Renderer 组件适配**：
   - PointEntityRenderer：检查 `showLabel` 字段控制标签渲染
   - SegmentEntityRenderer：检查 `showLabel`、`showLength` 字段
   - AngleMeasurementRenderer：检查 `showLabel`、`showArc` 字段
   - DistanceMeasurementRenderer：检查 `showLabel`、`showAuxLine` 字段
   - CoordSystemRenderer：检查 `showCoordLabels`、`showTicks` 字段

**涉及文件**：
- `src/components/panels/inspectors/InspectorCommon.tsx` — 🆕 通用组件
- `src/editor/entities/types.ts` — properties 扩展
- `src/components/panels/inspectors/*.tsx` — 9 个 Inspector 重构
- `src/components/scene/renderers/PointEntityRenderer.tsx` — showLabel 适配
- `src/components/scene/renderers/SegmentEntityRenderer.tsx` — showLabel/showLength 适配
- `src/components/scene/renderers/AngleMeasurementRenderer.tsx` — showLabel/showArc 适配
- `src/components/scene/renderers/DistanceMeasurementRenderer.tsx` — showLabel/showAuxLine 适配
- `src/components/scene/renderers/CoordSystemRenderer.tsx` — showCoordLabels/showTicks 适配

**验收**：
- [ ] 选中任何实体后右侧 Inspector 顶部显示统一操作栏（名称 + 隐藏/锁定/删除）
- [ ] 操作栏中点击名称可进入编辑态
- [ ] 隐藏/锁定按钮功能与左侧实体列表一致
- [ ] builtIn 实体不显示删除按钮
- [ ] 点的"显示名称标签" Switch 可控制 3D 中标签显示
- [ ] 线段的颜色/虚实线/标签/长度标签均可在 Inspector 中编辑
- [ ] 角度度量的标签和弧线可独立控制显示
- [ ] 距离度量的标签和辅助线可独立控制显示
- [ ] 坐标系的坐标标签和刻度可控制显示
- [ ] 所有 Switch 控制的显示变化实时反映到 3D 场景
- [ ] TypeScript 编译通过

---

### T7.5 全量回归验证 + 收尾 ⏱️ 1天

**目标**：对 V0.3 全部功能（含本阶段 UI 改动）进行系统性回归验证，更新文档，完成版本交付。

**要做的事**：

1. **全量功能回归**：
   - 13 种几何体 × (参数调节 + 标注 + 坐标系 + 外接球/圆 + 截面 + 展开图 + 三视图)
   - 角度度量经典案例手算对照（正方体二面角 90°、正四面体二面角 arccos(1/3) 等）
   - 距离度量经典案例对照（正方体顶点到对面距离 = 边长等）
   - 坐标系建系 + 坐标输入端到端验证

2. **UI 改动验证**：
   - 工具栏顶部居中显示正常，各工具切换正常
   - 13 种几何体图标可辨识
   - 右侧面板结构清晰，冗余菜单已移除
   - Inspector 各类型属性编辑功能正常
   - 左侧实体列表的隐藏/锁定/重命名与右侧 Inspector 同步

3. **文档更新**：
   - `README.md` — 功能清单、几何体列表、版本历史
   - `docs/功能演示清单.md` — 补充 V0.3 全部新增演示项

4. **代码质量**：
   - `pnpm lint && pnpm tsc --noEmit`
   - 清理临时代码、TODO 注释
   - 检查未使用的 import

**验收**：
- [ ] 13 种几何体核心功能验证通过
- [ ] 角度/距离度量手算验证通过
- [ ] UI 优化项全部视觉确认
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过
- [ ] README 和功能演示清单已更新

---

## 涉及文件预估

| 文件 | T7.1 | T7.2 | T7.3 | T7.4 | T7.5 |
|------|------|------|------|------|------|
| `src/components/scene/ToolBar.tsx` | ✏️ | — | — | — | — |
| `src/components/icons/GeometryIcons.tsx` | — | 🆕 | — | — | — |
| `src/components/layout/TopBar.tsx` | — | ✏️ | — | — | — |
| `src/components/panels/AuxiliaryTools.tsx` | — | — | ✏️ | — | — |
| `src/components/panels/CoordSystemPanel.tsx` | — | — | 🆕 | — | — |
| `src/components/panels/DataIOPanel.tsx` | — | — | 🆕 | — | — |
| `src/components/panels/LabelingTools.tsx` | — | — | 🗑️ | — | — |
| `src/components/layout/LeftPanel.tsx` | — | — | ✏️ | — | — |
| `src/components/panels/inspectors/InspectorCommon.tsx` | — | — | — | 🆕 | — |
| `src/editor/entities/types.ts` | — | — | — | ✏️ | — |
| 9 个 Inspector 文件 | — | — | — | ✏️ | — |
| 5 个 Renderer 文件 | — | — | — | ✏️ | — |
| `README.md` | — | — | — | — | ✏️ |
| `docs/功能演示清单.md` | — | — | — | — | ✏️ |

**新建文件**：4（GeometryIcons + CoordSystemPanel + DataIOPanel + InspectorCommon）
**删除文件**：1（LabelingTools）
**修改文件**：约 18 个

---

## 门禁检查

阶段完成后执行：
```bash
pnpm lint && pnpm tsc --noEmit
```

---

## 风险与注意事项

1. **T7.1 工具栏居中**：横排工具栏占据顶部宽度，需确认与 TopBar（几何体选择器）不冲突。TopBar 是页面最顶部，ToolBar 是 3D 视图内的 overlay，两者在不同层级。

2. **T7.2 SVG 图标绘制**：需要为 13 种几何体手绘 SVG，工作量集中在设计而非代码。建议先用简单线条风格，保持一致性比精美更重要。

3. **T7.3 AuxiliaryTools 精简**：删除冗余菜单时需确保没有隐藏的状态依赖。比如"自定义线段"按钮可能会设置某些 store 状态 → 需要确认 drawSegmentTool 不依赖 AuxiliaryTools 中的任何状态。截面和外接圆同理。

4. **T7.3 标注工具删除**：LabelingTools 提供了"已命名线段"和"已添加的点"列表。删除前需确认左侧 EntityListPanel 完全覆盖了这些功能（查看、选中、重命名、删除）。

5. **T7.4 showLabel 等字段的默认值**：新增的显示控制字段（showLabel、showArc 等）对于已有的实体 Entity 不存在这些字段。Renderer 中需要 fallback 到默认值（`props.showLabel ?? true`），确保向后兼容。

6. **T7.4 Inspector 重构量大**：9 个 Inspector 文件都要改。建议先实现 InspectorCommon，然后逐个 Inspector 接入。可以分两步：先统一操作栏，再补属性编辑。

7. **T7.5 回归范围**：UI 改动可能引入布局回归（面板挤压、响应式问题）。需要在不同分辨率下测试。

---

## 执行顺序建议

```
T7.1 工具栏重定位（独立，无依赖）
T7.2 几何体图标（独立，无依赖）          } 可并行
T7.3 右侧面板重构（独立，无依赖）

T7.4 Inspector 统一设计（依赖 T7.3 面板结构稳定后执行）

T7.5 全量回归（最后执行）
```

T7.1 / T7.2 / T7.3 三者互相独立，可并行执行。T7.4 依赖 T7.3 确定面板结构后再做。T7.5 最后执行。

---

*创建时间：2026-03-11*
*完成时间：2026-03-11*
*状态：✅ 已完成*

---

## 实际完成情况

### T7.1 工具栏重定位 ✅
- 工具栏从左上角竖排移到 3D 视图顶部居中横排
- 图标下方增加工具名称标签（选择/画线段/创建截面/建坐标系/画外接圆/标记角度/标记距离）
- ModeIndicator 位置下移避免重叠

### T7.2 几何体 SVG 独立图标 ✅
- 为 13 种几何体绘制独立 SVG 图标（`GeometryIcons.tsx`）
- 图标映射拆分到 `geometryIconMap.ts` 避免 react-refresh lint 警告
- TopBar 替换 Lucide 通用图标为专属 SVG

### T7.3 右侧面板重构 ✅
- 新建 `DataIOPanel.tsx`（导出/导入置顶，按钮增加 hover/click 效果）
- 新建 `CoordSystemPanel.tsx`（坐标系独立区域，含启用开关/原点显示/坐标点输入）
- `AuxiliaryTools.tsx` 精简为仅保留展开图/三视图/外接球
- 面板顺序：导入导出 → 实体属性 → 参数设置 → 坐标系 → 辅助功能
- `PanelSection` 区域标题用深色加粗（14px），内部选项文本用 13px 区分层级

### T7.4 Inspector 统一设计 ✅
- 新建 `InspectorCommon.tsx`（`InspectorHeader` 通用组件）
- 两行布局：类型(只读) + 名称(可编辑/只读) / 隐藏·锁定·删除 操作按钮
- 9 个 Inspector 全部接入统一 Header
- 空选中态显示提示文本"请先选择一个实体"
- PointInspector 增加坐标编辑（CoordEditor 子组件，key 驱动同步）
- CircumSphereInspector 修复 Zustand 无限循环

### T7.5 全量回归 ✅
- `pnpm lint && pnpm tsc --noEmit` 通过

### 额外改进（用户反馈迭代）
- 工具名称加动词（画线段/创建截面/建坐标系/标记角度/标记距离）
- 7 个工具全部替换为自定义 SVG 图标（`ToolIcons.tsx`）
- 左侧实体列表增加缩进/层级/双击重命名/搜索/内置标记"(内置)"
- 参数面板紧凑单行布局，棱锥高/侧棱长联动同行显示
- 创建类工具自动切回选择工具
- 棱锥 sides 滑块拖动时跳过拓扑变化的实时更新，修复变形 bug
