# V0.3 功能扩展 — 渐进式开发计划

## 📌 版本目标

在 V0.2 七系统编辑器架构基础上，扩展核心教学功能：新增 5+ 种几何体（正四面体/墙角四面体/正棱柱/圆台/棱台等）、完善坐标系交互（Z 轴朝上/任意点建系/坐标输入点）、实现角度与距离度量、增加面交互与 Hover 高亮，使产品覆盖高中立体几何 80% 的教学场景。

## 🔄 开发流程总览

```
阶段1: UI体验修补（三视图/展开图默认关闭 + 体积表面积显示优化 + 遗留交互修复）  ✅
  → 阶段2: 交互增强（Hover高亮 + 面交互 + 面上取点）                              ✅
    → 阶段2.1: 曲面体交互补全 + 遮挡面选择（Ctrl/⌘穿透）                          ✅
      → 阶段3: 坐标系重构（选面定轴 + 任意点建系 + 坐标输入点）                    ✅
      → 阶段4: 新几何体-基础（正四面体 + 墙角四面体 + 正棱柱 + 选择器分类）        ✅
        → 阶段4.1: P2几何体扩展（圆台 + 棱台 + 对棱相等四面体 + 对棱垂直四面体）  ✅ (原阶段6提前)
          → 阶段5: 度量系统（角度度量：二面角/线面角/线线角）                    ✅
            → 阶段6: P2功能扩展（侧棱长参数 + 实体列表面板 + 距离度量）          ✅
              → 阶段7: UI优化 + 全量回归 + 收尾                              ✅
```

## 📋 串行执行阶段

---

### 第1阶段：UI 体验修补 ⏱️ 2-3天

**目标**：修复 V0.1 遗留的交互问题和 PM 反馈的 UI 优化项，这些是不依赖新架构扩展的纯体验改进，优先处理让产品基线体验达标。

**主要任务**：
1. 三视图/展开图面板默认关闭，点击按钮才展开，再次点击可收起（F03）
2. 体积表面积卡片显示优化：只有结果含 π 时展示公式推导，其余只展示最终结果（F02）
3. 验证并完善 Escape 键退出绘制模式的功能（V0.2 架构已预置，需确认全链路生效）（F04-1）
4. 进入画线/截面模式时，3D 场景显示醒目的模式提示条（F04-2）
5. 画线选第一个点后起点出现脉冲/高亮动画（F04-3）
6. 验证切换几何体时自动清理用户创建的辅助实体（V0.2 ChangeGeometryTypeCommand 已实现，需验证完整性）（F04-4）

**涉及文件范围**：
- `src/editor/store/uiStore.ts` — 展开图/三视图面板开关状态
- `src/components/views/` — 展开图/三视图面板的默认折叠逻辑
- `src/components/info/MeasurementDisplay.tsx` — 体积表面积展示逻辑
- `src/editor/tools/drawSegmentTool.ts` — 画线起点高亮
- `src/editor/tools/crossSectionTool.ts` — 截面模式提示
- `src/components/scene/ToolBar.tsx` — 模式提示条

**验收标准**：
✅ 打开应用后三视图和展开图面板默认收起，点击按钮可展开/收起
✅ 含 π 时显示 `V = 公式 ≈ 数值`，不含 π 整数显示 `V = 值`，不含 π 非整数显示 `V ≈ 数值`
✅ 按 Escape 可从任何绘制模式退回选择工具
✅ 进入画线模式后 3D 场景有文字提示条
✅ 画线选第一个点后起点有视觉高亮反馈
✅ 切换几何体后旧的自定义线段/截面被清理
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
基线体验完善的编辑器，为后续交互增强和新功能开发提供干净的起点。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第2阶段：交互增强 — Hover 高亮与面交互 ⏱️ 3-4天

**目标**：让线段和面成为可交互元素，支持 Hover 高亮反馈、左键选中、右键菜单、面上取点，为后续坐标系重构和角度度量奠定交互基础。

**主要任务**：
1. SelectionStore 扩展：增加 `hoveredId` 状态，支持 Hover 追踪（F05）
2. SelectTool 增加面命中检测（raycasting 到 Face Entity），实现面的左键选中（F06）
3. SegmentEntityRenderer 增加 Hover 高亮样式（颜色变亮或加粗）（F05）
4. FaceEntityRenderer 增加 Hover 高亮样式（半透明色变化）和选中高亮样式（F05 + F06）
5. ContextMenu3D 扩展：右键面时弹出菜单，包含"面上取点"操作（F06）
6. 实现面上取点：Point Entity 使用 `constraint.type='face'` 约束，点可在面内拖动（F06）
7. FaceInspector 属性面板：选中面后显示面信息（面积、构成顶点等）（F06）

**涉及文件范围**：
- `src/editor/store/selectionStore.ts` — 增加 hoveredId
- `src/editor/tools/selectTool.ts` — 面命中检测 + Hover 事件处理
- `src/components/scene/renderers/SegmentEntityRenderer.tsx` — Hover 样式
- `src/components/scene/renderers/FaceEntityRenderer.tsx` — Hover + 选中样式
- `src/components/scene/ContextMenu3D.tsx` — 面右键菜单
- `src/components/panels/inspectors/FaceInspector.tsx` — 面属性面板

**验收标准**：
✅ 鼠标移到线段上时线段高亮，移开恢复
✅ 鼠标移到面上时面高亮，移开恢复
✅ 左键点击面可选中，面进入选中态（高亮颜色区分 Hover 和选中）
✅ 右键面弹出菜单，点击"面上取点"可在面上创建一个点
✅ 面上的点可拖动，且始终约束在面内
✅ 面上的点可命名、可被线段连接、可参与截面和外接圆操作
✅ 选中面后右侧面板显示面的属性信息
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
线段和面成为完整的可交互元素（Hover + 选中 + 右键菜单 + 面上取点），为第3阶段坐标系的"选面定轴"交互和第5阶段角度度量的"选线选面"交互提供基础。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第2.1阶段：曲面体交互补全 + 遮挡面选择 ✅ 已完成

**目标**：解决阶段3（坐标系重构）的前置问题——曲面体（圆柱/圆锥/球）的线和面无法交互，以及被遮挡的面无法选中。

**主要任务**：
1. 曲面体的面 Entity 化：为圆柱（底面+顶面+侧面）、圆锥（底面+侧面）、球（球面）创建 Face Entity
2. 曲面体的线 Entity 化：为母线创建 Segment Entity，圆弧线扩展 Segment（新增 `curvePoints` + `lineIndex`）
3. FaceEntityRenderer 支持曲面面渲染（disk 用多边形近似，lateral/sphere 用 openEnded 原生几何体）
4. SegmentEntityRenderer 支持曲线渲染（`CurveSegment` + `CurveHitbox` TubeGeometry）
5. GeometryEntityRenderer 简化为空渲染（全部由 Entity Renderer 接管）
6. Ctrl/⌘ 穿透选中被遮挡元素（`findTargetHit` 按 entityId 去重跳过最前方实体）
7. 曲线和曲面面的右键菜单支持（曲线取点用 curve 约束，曲面取点用 free 约束）
8. 选择工具交互提示文案（ModeIndicator）

**完成时间**：2026-03-10

**详细记录**：见 `stage-2.1-surface-interaction.md`

---

### 第3阶段：坐标系重构 ⏱️ 3-4天 ✅ 已完成

**目标**：重构坐标系交互流程，使其符合数学教学惯例（Z 轴朝上、交互式选轴），并支持坐标输入显示新点功能。

**主要任务**：
1. CoordinateSystem Entity properties 扩展：增加轴方向信息（选定面法向 → Z 轴，选定方向 → X 轴）（F01）
2. CoordSystemTool 重写交互流程：第一步选原点（任意 Point Entity）→ 第二步选面（Face Entity，法向确定 Z 轴方向，默认朝上）→ 第三步选 X 轴方向（点击一个方向或点）→ Y 轴由右手定则自动确定（F01）
3. `engine/math/coordinates.ts` 重构：坐标计算适配新的轴方向定义（F01）
4. CoordSystemRenderer 更新：渲染用户指定方向的 XYZ 轴（F01）
5. CoordSystemInspector 增加"添加坐标点"区域：输入 (x, y, z) 坐标 → 创建 Point Entity（constraint.type='coordinate'）（F11）
6. PointEntityRenderer 增加 coordinate 约束类型的位置计算逻辑（F11）

**涉及文件范围**：
- `src/editor/entities/types.ts` — CoordinateSystemProperties 扩展
- `src/editor/tools/coordSystemTool.ts` — 多步骤交互流程重写
- `src/engine/math/coordinates.ts` — 坐标计算逻辑重构
- `src/components/scene/renderers/CoordSystemRenderer.tsx` — 轴渲染更新
- `src/components/panels/inspectors/CoordSystemInspector.tsx` — 坐标输入 UI
- `src/components/scene/renderers/PointEntityRenderer.tsx` — coordinate 约束位置计算

**验收标准**：
✅ 建系流程：选原点 → 选面定 Z 轴 → 选方向定 X 轴，交互流畅
✅ Z 轴默认朝上，符合数学教学惯例
✅ 任意点（顶点、棱上点、面上点）均可作为原点
✅ 建系后各顶点坐标值正确显示
✅ 在 Inspector 中输入坐标 (x,y,z)，3D 场景中正确显示对应点
✅ 坐标输入点可命名、可选中、可参与画线/截面/外接圆等操作
✅ 切换几何体后坐标系正确清理
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
符合教学惯例的坐标系系统 + 坐标输入点功能，完成"向量法解题"的核心交互链路。

**完成时间**：2026-03-10

**详细记录**：见 `stage-3-coord-system.md`

---

### 第4阶段：新几何体（基础）+ 选择器分类 ⏱️ 4-5天 ✅ 已完成

**目标**：新增正四面体、墙角四面体、正棱柱三种几何体类型，并将几何体选择器从扁平列表改为分类显示。

**主要任务**：
1. 正四面体 Builder 实现：输入棱长 a → 计算顶点坐标、棱线、面（F07）
   - 子任务链：定义参数类型 → 实现 Builder → 注册到 buildGeometry → 实现体积/表面积/外接球公式 → 展开图 → 三视图
2. 墙角四面体 Builder 实现：输入三条直角边 (a, b, c) → 计算顶点坐标、棱线、面（F08）
   - 子任务链：定义参数类型 → 实现 Builder → 注册到 buildGeometry → 实现公式 → 展开图 → 三视图
3. 正棱柱 Builder 实现：输入底面边数 n、边长 a、高 h → 计算顶点坐标、棱线、面（F09）
   - 子任务链：定义参数类型 → 实现 Builder → 注册到 buildGeometry → 实现公式 → 展开图 → 三视图
4. 几何体选择器分类 UI：顶部选择区改为分组显示（棱柱类 / 棱锥类 / 旋转体 / 特殊四面体）（F12）
5. 新几何体的参数面板集成：各几何体在 GeometryInspector / ParameterPanel 中显示对应参数滑块

**涉及文件范围**：
- `src/engine/builders/` — 新增 3 个 Builder 文件
- `src/engine/math/calculators/` — 新几何体的体积/表面积计算
- `src/engine/unfolding/` — 新几何体的展开图
- `src/engine/projection/` — 新几何体的三视图
- `src/types/geometry.ts` — 新增 GeometryType + Params 类型
- `src/components/layout/TopBar.tsx` — 几何体选择器分类 UI

**验收标准**：
✅ 选择"正四面体"后 3D 场景显示正确的正四面体，只有一个"棱长"参数
✅ 正四面体的体积/表面积/外接球计算正确（与需求文档v2 GEO-011 公式一致）
✅ 选择"墙角四面体"后显示三条直角边参数，3D 模型正确渲染
✅ 墙角四面体的体积/外接球计算正确（与 GEO-031 公式一致）
✅ 选择"正棱柱"后可调底面边数（3~8）和边长、高，3D 模型正确渲染
✅ 正棱柱的体积/表面积计算正确
✅ 几何体选择区按分类分组显示，视觉清晰
✅ 新几何体支持现有全部功能（标注、取点、画线、截面、坐标系、外接球/圆、展开图、三视图）
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
3 种新几何体可用 + 分类选择器，覆盖高考常见的四面体和棱柱题型。为第6阶段的 P2 几何体扩展验证了"新增几何体"的完整流程。

**完成时间**：2026-03-10

**详细记录**：见 `stage-4-new-geometries.md`

---

### 第4.1阶段：P2 几何体扩展 ⏱️ 3-4天 ✅ 已完成

**目标**：新增 4 种 P2 优先级的几何体（圆台、棱台、对棱相等四面体、对棱垂直四面体），原计划为阶段6，因与阶段4流水线相同提前执行。

**主要任务**：
1. 圆台 Builder（SurfaceResult）：CylinderGeometry 上下半径不等（F15）
2. 棱台 Builder（PolyhedronResult）：上下底面正多边形不等大（F16）
3. 对棱相等四面体 Builder：内接长方体推导顶点坐标（F13）
4. 对棱垂直四面体 Builder：中点连线参数化（F14）
5. 各几何体全 pipeline：Calculator + 外接球 + 展开图 + 三视图
6. GEOMETRY_GROUPS 更新：圆台→旋转体组，棱台→棱锥/棱台组，两种四面体→四面体组

**完成时间**：2026-03-10

**详细记录**：见 `stage-4.1-extended-geometries.md`

**本阶段产出**：
产品几何体库达到 13 种，覆盖 v2 需求文档全部几何体类型。原阶段6的工作已全部完成。

---

### 第5阶段：度量系统 — 角度度量 ⏱️ 4-5天 ✅ 已完成

**目标**：实现二面角、线面角、线线角三种角度度量，输出精确值并在 3D 场景中可视化标注，完成立体几何解题演示的核心链路。

**主要任务**：
1. 新增 EntityType `'angleMeasurement'`，定义 AngleMeasurementProperties（度量类型 + 引用的元素 ID）（F10）
2. 实现角度计算引擎：`engine/math/angleCalculator.ts`，支持三种角度的精确计算（F10）
   - 二面角：两个面 → cross(n, edgeDir) 垂直方向 + 重心修正 → arccos(d1·d2)
   - 线面角：线段 + 面 → arcsin(|d · n|)
   - 线线角：两条线段 → arccos(|d1 · d2|)
3. 精确值输出：匹配 10 种常见精确角度（0°/30°/45°/60°/90°/arctan√2 等）（F10）
4. AngleTool 统一两步交互：选线段或面 → 选第二个线段或面 → 自动判断角度类型（F10）
5. AngleMeasurementRenderer：弧线 + 角度标签 + TubeGeometry 命中体积（F10）
6. AngleMeasurementInspector：角度类型/关联元素/精确值/删除按钮（F10）

**涉及文件范围**：
- `src/editor/entities/types.ts` — 新增 angleMeasurement 实体类型
- `src/engine/math/angleCalculator.ts` — 角度计算 + 可视化数据 + 弧线生成
- `src/editor/tools/angleTool.ts` — 统一两步交互工具
- `src/components/scene/renderers/AngleMeasurementRenderer.tsx` — 3D 弧线可视化
- `src/components/panels/inspectors/AngleMeasurementInspector.tsx` — 角度属性面板
- `src/editor/store/entityStore.ts` — entityReferences/collectChildIds 支持 angleMeasurement

**实现亮点**：
- 统一两步交互：线+线→线线角、线+面→线面角、面+面→二面角（需共棱），结构化步骤指示器
- 弧线定位策略：二面角=棱中点、线面角=线面交点、线线角=共顶点优先/异面线段上最近点
- Zustand 稳定性：Inspector 用 `.join('\0')` 返回 primitive 避免无限循环，Renderer 用单 useMemo 命令式计算

**完成时间**：2026-03-10

**详细记录**：见 `stage-5-angle-measurement.md`

---

### ~~第6阶段~~（原编号）：P2 几何体扩展 ⏱️ 4-5天 ✅ 已完成（由阶段4.1提前完成，编号已回收）

**目标**：新增 4 种 P2 优先级的几何体（对棱相等四面体、对棱垂直四面体、圆台、棱台），进一步覆盖高考题型。

**主要任务**：
1. 对棱相等四面体（等腰四面体）Builder：输入三组对棱长 (p, q, r)（F13）
   - 子任务链：定义参数 → Builder（从长方体推导顶点坐标）→ 公式 → 展开图 → 三视图
   - 参数校验：三组对棱长需满足三角不等式约束
2. 对棱垂直四面体 Builder：输入六条棱长（需满足垂直约束）（F14）
   - 参数校验：AB²+CD² = AC²+BD² = AD²+BC²
3. 圆台 Builder：输入上底半径 r₁、下底半径 r₂、高 h（F15）
   - 渲染：旋转体曲面渲染（类比圆锥/圆柱的现有渲染方式）
   - 退化检查：r₁=0 退化为圆锥提示
4. 棱台 Builder：输入底面边数 n、上底边长 a₁、下底边长 a₂、高 h（F16）
   - 参数校验：a₁ < a₂
5. 更新几何体选择器分类，将新几何体归入对应分类组

**涉及文件范围**：
- `src/engine/builders/` — 新增 4 个 Builder 文件
- `src/engine/math/calculators/` — 新几何体的体积/表面积计算
- `src/engine/unfolding/` — 新几何体的展开图
- `src/engine/projection/` — 新几何体的三视图
- `src/types/geometry.ts` — 新增 GeometryType + Params 类型
- `src/components/layout/TopBar.tsx` — 选择器分类更新

**验收标准**：
✅ 对棱相等四面体：输入 p=q=r=a 时退化为正四面体，体积公式与 GEO-032 一致
✅ 对棱垂直四面体：参数不满足垂直约束时给出提示
✅ 圆台：渲染正确，r₁=0 退化为圆锥形状一致
✅ 棱台：渲染正确，a₁=0 退化为棱锥形状一致
✅ 4 种新几何体均支持标注、取点、画线、截面、坐标系、外接球/圆
✅ 几何体选择器分类显示完整且合理
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
产品几何体库从 6 种扩展到 13 种（正方体/长方体/棱锥/圆锥/圆柱/球 + 正棱柱/正四面体/墙角四面体 + 对棱相等/对棱垂直四面体/圆台/棱台），覆盖高中立体几何主要题型。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第6阶段：P2 功能扩展 ⏱️ 4-5天 ✅ 已完成

**目标**：完成 P2 优先级的功能项：棱锥侧棱长参数、实体列表面板、距离度量。

**主要任务**：
1. 棱锥侧棱长参数支持（F17）
   - 参数面板同时显示"高度"和"侧棱长"两个字段，联动同步
   - "↕ 高度与侧棱长联动"视觉标记，绿色边框标识关联字段
   - 修改一个参数时实时更新另一个（含 sides/sideLength 变化时的 R 重算）
2. 实体列表面板（F18）
   - 左侧新增实体列表面板，按8种类型分组展示所有实体
   - 搜索功能：支持按显示名过滤
   - 所有分类始终显示，空分类显示"暂无xx"
   - 点击选中、hover 显示隐藏/锁定按钮、面板可折叠
   - 距离度量实体显示可读名称（如 `A → 面DCBA`）
3. 距离度量（F19）— 5种距离类型
   - 点到点距离：两个点之间的直线距离
   - 点到线距离：点到线段的垂直距离 + 垂足直角标记
   - 点到面距离：点到面的垂直距离 + 垂足直角标记
   - 线到线距离：异面直线公垂线段 + 两端直角标记（平行线自动退化）
   - 线到面距离：平行约束，不平行时提示（距离=0无意义）
   - 精确值输出（√n、a√b、分数有理化）+ 近似值
   - 完整 3D 可视化：虚线 + 直角标记 + 距离标签

**完成时间**：2026-03-11

**详细记录**：见 `stage-6-p2-features.md`

---

### 第7阶段：UI 优化 + 全量回归 + 收尾 ⏱️ 4-5天

**目标**：优化编辑器 UI 布局与交互体验（工具栏重定位、几何体图标、右侧面板重构、Inspector 统一设计），完成全量回归验证和版本交付。

**主要任务**：
1. 工具栏重定位到 3D 视图顶部居中 + 增加工具名称标签
2. 为 13 种几何体绘制独立 SVG 图标，解决图标重复问题
3. 右侧面板重构：去除冗余辅助菜单、坐标系独立区域、标注工具合并到左侧、导入导出置顶
4. Inspector 统一设计：通用操作栏（隐藏/锁定/重命名）+ 各类型属性编辑（标签显示控制、样式调节）
5. 全量功能回归测试 + 文档更新 + 代码质量检查

**完成时间**：2026-03-11

**详细记录**：见 `stage-7-ui-optimization.md`

---

## 🎯 当前焦点

> **V0.3 全部阶段已完成** — 阶段1-7 全部交付 (2026-03-10 ~ 2026-03-11)

## ✅ 阶段检查点

| 阶段 | 检查项 | 状态 |
|------|--------|------|
| 第1阶段 | UI 体验修补（三视图默认关闭 + 体积显示优化 + 遗留交互） | ✅ 已完成 (2026-03-10) |
| 第2阶段 | 交互增强（Hover 高亮 + 面交互 + 面上取点） | ✅ 已完成 (2026-03-10) |
| 第2.1阶段 | 曲面体交互补全 + 遮挡面选择（Ctrl/⌘穿透） | ✅ 已完成 (2026-03-10) |
| 第3阶段 | 坐标系重构（选面定轴 + 任意点建系 + 坐标输入点） | ✅ 已完成 (2026-03-10) |
| 第4阶段 | 新几何体基础（正四面体 + 墙角四面体 + 正棱柱 + 选择器分类） | ✅ 已完成 (2026-03-10) |
| 第4.1阶段 | P2 几何体扩展（圆台 + 棱台 + 对棱相等/垂直四面体） | ✅ 已完成 (2026-03-10) |
| 第5阶段 | 度量系统（角度度量） | ✅ 已完成 (2026-03-10) |
| ~~第6阶段~~ | P2 几何体扩展 | ✅ 由阶段4.1提前完成（编号已回收） |
| 第6阶段 | P2 功能扩展（侧棱长参数 + 实体列表面板 + 距离度量） | ✅ 已完成 (2026-03-11) |
| 第7阶段 | UI优化 + 全量回归 + 收尾 | ✅ 已完成 (2026-03-11) |

## 🚫 暂时不考虑

- 动点功能（P3，V0.4+）
- LLM 智能入口（自然语言→自动建模）
- 用户账号 / 数据持久化
- 国际化
- 单元测试框架
- 性能优化（当前实体数量 ≤50，无性能瓶颈）
- 部署配置变更

## 📝 开发笔记

### 架构扩展要点
- V0.2 七系统架构已为 V0.3 预留扩展路径，所有新功能均不需要修改框架代码
- 新几何体：新 Builder + 新 GeometryType → `createBuiltInEntities()` 自动处理
- 新度量类型：新 EntityType + Renderer + Inspector + Tool → 注册即用
- 面交互：Face 已是 Entity，架构已验证（ARCHITECTURE.md §12.4）
- Point constraint 已预留 `coordinate` 和 `face` 类型

### BACKLOG 对照
详细功能清单见 `BACKLOG.md`（F01-F19），本计划中的阶段与 BACKLOG 功能编号的映射：
- 阶段1 → F02, F03, F04
- 阶段2 → F05, F06
- 阶段3 → F01, F11
- 阶段4 → F07, F08, F09, F12
- 阶段5 → F10
- 阶段4.1(原阶段6) → F13, F14, F15, F16
- 阶段6(原阶段7) → F17, F18(实体列表面板，原截面切割), F19
- 阶段7(原阶段8) → UI优化（工具栏/几何体图标/面板重构/Inspector统一）+ 全量回归
