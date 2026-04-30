# V0.3 阶段5：度量系统 — 角度度量

> **阶段目标**：实现二面角、线面角、线线角三种角度度量，输出精确值并在 3D 场景中可视化标注
> **前置条件**：阶段4/4.1（几何体扩展）已完成，线段和面可交互
> **BACKLOG 覆盖**：F10（角度度量）
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.3/PROGRESSIVE-PLAN.md`（V0.3 全局计划）
> - 功能清单：`.tasks/active/v0.3/BACKLOG.md`（F10 角度度量完整定义）

---

## 代码现状摘要

| 模块 | 现状 | 需要做什么 |
|------|------|-----------|
| `EntityType` | 7 种类型，无角度度量 | 新增 `'angleMeasurement'` |
| Tool 系统 | 5 个工具（select/drawSegment/crossSection/coordSystem/circumCircle） | 新增 `angleTool`（多模式多步骤） |
| ToolBar | 5 个按钮，竖排左侧 | 新增角度度量按钮 |
| Renderer 注册 | `registerRenderer(type, component)` | 新增 `AngleMeasurementRenderer` |
| Inspector 注册 | `registerInspector(type, component)` | 新增 `AngleMeasurementInspector` |
| `symbolic.ts` | 支持 num/sqrt/frac/piMul/piMulFrac/add | 需扩展 arctan/arccos 等反三角函数表达 |
| 向量工具 | `coordinates.ts` 有 sub/dot/crossProduct/normalize | 可复用，需在新模块中补充 angle 计算 |
| ModeIndicator | 支持 `toolSteps`（结构化步骤）和 `toolStepInfo`（单行文案） | 新增角度工具的步骤提示 |

---

## 角度度量的三种类型

### 1. 二面角（Dihedral Angle）

**数学定义**：两个半平面沿公共棱所成的角。

**交互输入**：选择一条棱（Segment Entity，必须是 builtIn 棱线）
- 系统自动识别共享这条棱的两个面
- 计算两个面的法向量夹角

**计算方法**：
```
给定棱线 AB 和两个邻接面 F1、F2
n1 = F1 的法向量
n2 = F2 的法向量
二面角 θ = π - arccos(n1 · n2 / (|n1| × |n2|))
（注意：法向量可能朝内或朝外，需要按棱方向统一取法向量方向）
```

**精确方法（更可靠）**：
```
在棱 AB 上取中点 M
从 F1 上取一点 P1 使 MP1 ⊥ AB
从 F2 上取一点 P2 使 MP2 ⊥ AB
二面角 θ = arccos(MP1 · MP2 / (|MP1| × |MP2|))
```

### 2. 线面角（Line-Face Angle）

**数学定义**：线段与面的最小夹角（线段方向向量与面法向量的余角）。

**交互输入**：先选一条线段（Segment Entity），再选一个面（Face Entity）

**计算方法**：
```
d = 线段方向向量（归一化）
n = 面的法向量（归一化）
线面角 α = arcsin(|d · n|) = π/2 - arccos(|d · n|)
取绝对值确保 0 ≤ α ≤ π/2
```

### 3. 线线角（Line-Line Angle）

**数学定义**：两条线段方向向量的夹角（取锐角，0 ≤ θ ≤ π/2）。

**交互输入**：选择两条线段（Segment Entity）

**计算方法**：
```
d1 = 第一条线段方向向量（归一化）
d2 = 第二条线段方向向量（归一化）
cos θ = |d1 · d2|  （取绝对值确保锐角）
θ = arccos(|d1 · d2|)
```
对于异面直线也适用（取方向向量夹角）。

---

## 子任务清单（串行执行）

### T5.1 Entity 类型扩展 + 角度计算引擎 ⏱️ 1天

**目标**：定义 AngleMeasurement Entity 类型，实现三种角度的精确计算。

**要做的事**：

1. **`src/editor/entities/types.ts`** — 新增类型：

   ```ts
   // EntityType 新增
   | 'angleMeasurement'

   // 角度度量类型
   export type AngleMeasurementKind = 'dihedral' | 'lineFace' | 'lineLine';

   export interface AngleMeasurementProperties {
     geometryId: string;
     kind: AngleMeasurementKind;
     /** 引用的实体 ID 列表 */
     entityIds: string[];
     // dihedral: [segmentId]（棱线，自动找两个邻接面）
     // lineFace: [segmentId, faceId]
     // lineLine: [segmentId1, segmentId2]
     /** 缓存的角度值（弧度） */
     angleRadians: number;
     /** 角度精确值 LaTeX */
     angleLatex: string;
     /** 角度近似值（度数） */
     angleDegrees: number;
   }
   ```

2. **`src/editor/entities/types.ts`** — EntityPropertiesMap 扩展 + 类型守卫

3. **`src/engine/math/angleCalculator.ts`** — 新建，核心计算引擎：

   ```ts
   export interface AngleResult {
     radians: number;
     degrees: number;
     latex: string;          // 精确值 LaTeX（如 "\\arctan\\sqrt{2}"）
     degreesLatex: string;   // 度数 LaTeX（如 "54.74°"）
   }

   export function calculateDihedralAngle(
     edgeStart: Vec3, edgeEnd: Vec3,
     face1Points: Vec3[], face2Points: Vec3[],
   ): AngleResult;

   export function calculateLineFaceAngle(
     lineStart: Vec3, lineEnd: Vec3,
     facePoints: Vec3[],
   ): AngleResult;

   export function calculateLineLineAngle(
     line1Start: Vec3, line1End: Vec3,
     line2Start: Vec3, line2End: Vec3,
   ): AngleResult;
   ```

4. **精确值识别逻辑**：
   - 检测常见角度：0°, 30°, 45°, 60°, 90° → 直接输出精确 LaTeX
   - 检测 arctan(√2)、arctan(√3) 等常见高考角度
   - 通用 fallback：输出 `arccos(数值)` 或 `arctan(数值)` 的近似度数

5. **`src/engine/math/symbolic.ts`** — 可选扩展：
   - 新增 `arctan(value: SymbolicValue)` 等函数（如果精确值逻辑需要组合现有 symbolic 系统）

**涉及文件**：
- `src/editor/entities/types.ts` — Entity 类型扩展
- `src/engine/math/angleCalculator.ts` — 新建
- `src/engine/math/symbolic.ts` — 可选扩展

**验收**：
- [x] TypeScript 编译通过
- [x] `calculateDihedralAngle` 对正方体棱线返回 90°
- [x] `calculateLineFaceAngle` 对正方体面对角线与底面返回 arctan(√2)
- [x] `calculateLineLineAngle` 对正方体面对角线返回正确角度

---

### T5.2 AngleTool 交互工具 ⏱️ 1天

**目标**：实现角度度量的交互工具，支持三种度量模式。

**交互设计**：

角度工具采用**单一工具多模式**设计（用户通过选择不同类型的元素自动确定度量类型）：

```
进入角度工具后：
1. 点击一条棱线（builtIn segment）→ 自动识别为二面角 → 直接计算并创建
2. 点击一条线段 → 进入"选第二个元素"状态：
   a. 点击一个面 → 线面角
   b. 点击另一条线段 → 线线角
```

**状态机**：
```
idle → [点击 builtIn segment 且有两个邻接面] → 创建二面角 → idle
idle → [点击 segment] → waitSecond
waitSecond → [点击 face] → 创建线面角 → idle
waitSecond → [点击 segment] → 创建线线角 → idle
waitSecond → [Escape] → idle
```

**ModeIndicator 步骤提示**：
- idle: `「角度度量 — 点击棱线测二面角，或选择线段/面测角」`
- waitSecond（已选线段）: `「角度度量 — 点击面测线面角，或点击另一条线段测线线角」`

**要做的事**：

1. **`src/editor/tools/angleTool.ts`** — 新建：
   - Tool 接口实现（id: 'angle'）
   - 状态机逻辑
   - `onActivate` / `onDeactivate` 清理状态
   - `onPointerDown` 分支处理
   - `onKeyDown` 处理 Escape / Backspace
   - 二面角的邻接面查找逻辑（从 entityStore 中找共享该棱的两个 Face Entity）

2. **`src/editor/tools/index.ts`** — registerAllTools 新增 angleTool

3. **`src/components/scene/ToolBar.tsx`** — TOOLS 数组新增角度按钮：
   ```ts
   { id: 'angle', label: '角度', Icon: /* lucide 图标 */ }
   ```

4. **`src/components/scene/ModeIndicator.tsx`** — MODE_TIPS 新增 angle 默认文案

5. **二面角邻接面查找**：
   ```ts
   function findAdjacentFaces(segmentEntity: Entity<'segment'>): [Entity<'face'>, Entity<'face'>] | null {
     // 获取线段两端点 ID
     const { startPointId, endPointId } = segmentEntity.properties;
     // 遍历所有 Face Entity，找 pointIds 同时包含这两个点的面
     // 应该恰好找到 2 个（棱线的两个邻接面）
   }
   ```

**涉及文件**：
- `src/editor/tools/angleTool.ts` — 新建
- `src/editor/tools/index.ts` — 注册
- `src/components/scene/ToolBar.tsx` — 按钮
- `src/components/scene/ModeIndicator.tsx` — 提示文案

**验收**：
- [x] 工具栏出现角度度量按钮
- [x] 选择两个面（需共棱）→ 计算二面角
- [x] 先点击一条线段，再点击一个面 → 计算线面角
- [x] 先点击一条线段，再点击另一条线段 → 计算线线角
- [x] Escape 可退出工具
- [x] ModeIndicator 正确显示结构化步骤指示器

---

### T5.3 AngleMeasurementRenderer 可视化 ⏱️ 1天

**目标**：在 3D 场景中渲染角度弧线和角度值标签。

**可视化设计**：

```
二面角：
  - 在棱线中点处，向两个面分别画出一小段辅助线（⊥ 棱线）
  - 在辅助线端点之间画弧线
  - 弧线中间位置放置角度值标签

线面角：
  - 从线段与面的交点（或线段中点的投影点）出发
  - 画线段方向和投影方向的两条辅助线
  - 在辅助线之间画弧线 + 标签

线线角：
  - 将两条线段平移到公共点（如取其中一条线段的端点）
  - 从公共点画两个方向的辅助线
  - 辅助线之间画弧线 + 标签
```

**弧线渲染**：
- 使用 `THREE.BufferGeometry` + `THREE.Line` 画弧线（多段折线近似圆弧）
- 弧线半径：固定值（如 0.3）或自适应
- 颜色：统一使用橙色或其他区分色

**标签渲染**：
- 使用 `@react-three/drei` 的 `Html` 组件
- 显示内容：精确值（如 `arctan(√2)` 的 LaTeX）+ 度数近似值（如 `≈ 54.74°`）
- 或简化为只显示度数值

**要做的事**：

1. **`src/components/scene/renderers/AngleMeasurementRenderer.tsx`** — 新建：
   - 根据 `kind` 分支渲染不同类型的角度可视化
   - `DihedralAngleVis` — 二面角可视化组件
   - `LineFaceAngleVis` — 线面角可视化组件
   - `LineLineAngleVis` — 线线角可视化组件
   - 公共的 `ArcLine` 组件（给定圆心、两个方向、角度大小 → 画弧线）
   - `AngleLabel` 组件（Html 标签显示角度值）
   - 选中/hover 状态高亮
   - 调用 `registerRenderer('angleMeasurement', AngleMeasurementRenderer)`

2. **弧线计算辅助函数**：
   ```ts
   function generateArcPoints(
     center: Vec3,
     dir1: Vec3,     // 起始方向（归一化）
     dir2: Vec3,     // 结束方向（归一化）
     radius: number,
     segments: number, // 弧线细分数
   ): Vec3[]
   ```

3. **各类型的辅助线/弧线位置计算**：

   **二面角**：
   ```
   棱线中点 M，棱方向 edgeDir
   面1法向量 n1，面2法向量 n2
   辅助线方向1 = normalize(cross(edgeDir, n1))  // 面1上⊥棱线的方向
   辅助线方向2 = normalize(cross(edgeDir, n2))  // 面2上⊥棱线的方向
   弧线圆心 = M
   ```

   **线面角**：
   ```
   线段方向 d，面法向量 n
   投影方向 proj = normalize(d - (d·n)n)  // d 在面上的投影
   弧线圆心 = 线段某端点在面上的投影点（或简化为线段中点）
   ```

   **线线角**：
   ```
   线段1方向 d1，线段2方向 d2
   公共点 = 两线段最近点（或简化为线段1的起点）
   弧线圆心 = 公共点
   ```

**涉及文件**：
- `src/components/scene/renderers/AngleMeasurementRenderer.tsx` — 新建

**验收**：
- [x] 二面角显示弧线 + 角度值标签
- [x] 线面角显示弧线 + 角度值标签
- [x] 线线角显示弧线 + 角度值标签
- [x] 选中角度度量实体时高亮
- [x] 弧线视觉醒目但不遮挡几何体

---

### T5.4 AngleMeasurementInspector + 收尾 ⏱️ 0.5天

**目标**：选中角度度量后显示详细信息面板，完善整体集成。

**要做的事**：

1. **`src/components/panels/inspectors/AngleMeasurementInspector.tsx`** — 新建：
   - 显示角度类型（二面角 / 线面角 / 线线角）
   - 显示精确值（LaTeX 渲染）
   - 显示近似值（度数）
   - 显示关联元素标签（如"棱 AB 的二面角"、"线段 CD 与面 ABCD 的线面角"）
   - 删除按钮
   - 调用 `registerInspector('angleMeasurement', AngleMeasurementInspector)`

2. **完善集成**：
   - 确认角度度量支持 Undo/Redo（通过 CreateEntityCommand）
   - 确认切换几何体时角度度量被正确清理（`getRelatedEntities` 需包含 angleMeasurement）
   - 确认角度度量实体可被选中、hover 高亮

3. **精确值验证**（经典案例手算）：

   **正方体 (a=2)**：
   - 任意两个邻接面的二面角 = 90°
   - 面对角线与底面所成角 = arctan(√2) ≈ 54.74°（面对角线如 AC₁ 与底面 ABCD）
   - 体对角线与底面所成角 = arctan(√2/2) ≈ 35.26°
   - 两条面对角线的线线角 = 90°（如 AC 与 BD）

   **正四面体 (a=2)**：
   - 任意两个面的二面角 = arccos(1/3) ≈ 70.53°
   - 棱与对面的线面角 = arctan(√2) ≈ 54.74°

**涉及文件**：
- `src/components/panels/inspectors/AngleMeasurementInspector.tsx` — 新建
- `src/editor/store/entityStore.ts` — 可能需确认 `getRelatedEntities` 覆盖新类型

**验收**：
- [x] 选中角度度量后右侧面板显示详细信息
- [x] 精确值和度数正确显示
- [x] 关联元素标签正确
- [x] 删除按钮可删除度量
- [x] 支持 Undo/Redo
- [x] 切换几何体后角度度量被清理
- [x] 正方体二面角 = 90° ✓
- [x] 正方体面对角线与底面角 = arctan(√2) ≈ 54.74° ✓

---

## 精确值识别策略

角度计算的结果是一个弧度数值，需要尝试匹配已知的精确表达式：

```ts
const KNOWN_ANGLES: { radians: number; latex: string; degrees: string }[] = [
  { radians: 0, latex: '0', degrees: '0°' },
  { radians: Math.PI / 6, latex: '30°', degrees: '30°' },
  { radians: Math.PI / 4, latex: '45°', degrees: '45°' },
  { radians: Math.PI / 3, latex: '60°', degrees: '60°' },
  { radians: Math.PI / 2, latex: '90°', degrees: '90°' },
  // arctan 类
  { radians: Math.atan(Math.sqrt(2)), latex: '\\arctan\\sqrt{2}', degrees: '54.74°' },
  { radians: Math.atan(Math.sqrt(2) / 2), latex: '\\arctan\\dfrac{\\sqrt{2}}{2}', degrees: '35.26°' },
  { radians: Math.atan(Math.sqrt(3)), latex: '60°', degrees: '60°' }, // = π/3
  // arccos 类
  { radians: Math.acos(1/3), latex: '\\arccos\\dfrac{1}{3}', degrees: '70.53°' },
];

function matchExactAngle(radians: number): { latex: string; degrees: string } | null {
  const eps = 1e-8;
  for (const known of KNOWN_ANGLES) {
    if (Math.abs(radians - known.radians) < eps) return known;
  }
  return null; // fallback: 用度数近似值
}
```

---

## 涉及文件预估

| 文件 | T5.1 | T5.2 | T5.3 | T5.4 |
|------|------|------|------|------|
| `src/editor/entities/types.ts` | ✏️ | — | — | — |
| `src/engine/math/angleCalculator.ts` | 🆕 | — | — | — |
| `src/engine/math/symbolic.ts` | ✏️? | — | — | — |
| `src/editor/tools/angleTool.ts` | — | 🆕 | — | — |
| `src/editor/tools/index.ts` | — | ✏️ | — | — |
| `src/components/scene/ToolBar.tsx` | — | ✏️ | — | — |
| `src/components/scene/ModeIndicator.tsx` | — | ✏️ | — | — |
| `src/components/scene/renderers/AngleMeasurementRenderer.tsx` | — | — | 🆕 | — |
| `src/components/panels/inspectors/AngleMeasurementInspector.tsx` | — | — | — | 🆕 |
| `src/editor/store/entityStore.ts` | — | — | — | ✏️? |

**新建文件**：3（angleCalculator + angleTool + AngleMeasurementRenderer + AngleMeasurementInspector = 4）
**修改文件**：约 5 个

---

## 门禁检查

阶段完成后执行：
```bash
pnpm lint && pnpm tsc --noEmit
```
命中 `src/engine/` 数学计算 → 追加手算验证（附录F）。

---

## 风险与注意事项

1. **T5.1 二面角法向量方向**：面的法向量方向（朝内/朝外）会影响二面角计算结果。需要按棱线方向统一法向量朝向，或使用基于垂线的方法（从面上取⊥棱线的方向向量）更可靠。

2. **T5.1 精确值匹配**：基于浮点数比较匹配精确角度值，需要合适的容差（1e-8）。对于用户自定义参数的几何体，大部分角度不会命中精确值表，fallback 到度数近似值是合理的。

3. **T5.2 二面角邻接面查找**：需要从 Face Entity 的 `pointIds` 中判断哪两个面共享给定棱线的两个端点。对于曲面体（surface 类型的面），`pointIds` 可能为空 → 二面角度量暂不支持曲面体面，仅支持多面体。

4. **T5.3 弧线渲染性能**：每个角度度量画一段弧线（~20 个点的折线），性能无压力。但需注意弧线在不同视角下的可见性，考虑始终面向相机或固定在 3D 空间中。

5. **T5.3 弧线与几何体重叠**：弧线可能被几何体面遮挡。可以使用 `depthTest: false` 让弧线始终可见，但这可能在某些视角下造成视觉混乱。建议默认 `depthTest: true`，与现有轴线渲染保持一致。

6. **T5.4 getRelatedEntities 覆盖**：新增的 `angleMeasurement` Entity 需要被 `getRelatedEntities` 覆盖，确保切换几何体时被清理。需要确认 entityStore 的相关逻辑是否自动覆盖新类型（通过 `geometryId` 字段过滤），还是需要显式添加。

---

---

## 实现记录

### 与原计划的偏差

1. **交互流程重设计**：原计划为"点击棱线自动识别二面角"，实际改为统一两步交互（选线/面 → 选线/面），更直观且覆盖全部组合
2. **二面角交互**：原计划 entityIds = `[segmentId]`（棱线），实际改为 `[faceId1, faceId2]`（两个面），用户选两个面后系统查找共棱
3. **精确值系统**：未扩展 symbolic.ts，改为 angleCalculator 内置 KNOWN_ANGLES 查表匹配

### 关键 Bug 修复历程

| Bug | 根因 | 修复 |
|-----|------|------|
| Inspector 无限循环 | `useEntityStore` 选择器中 `.map()` 每次返回新数组 | `.join('\0')` 返回 primitive string |
| Renderer 无限循环 | 多个 zustand 选择器各自产生新引用 | 改为单 `useMemo` + `s.entities` 命令式计算 |
| 二面角计算错误 | `π - arccos(d1·d2)` 公式多余的 `π -` 修正 | 直接 `arccos(d1·d2)` |
| 线面角弧线方向反 | `dot(lineDir, proj) < 0` 翻转导致 lineDir 指向面内 | lineDir 始终指向远离面的端点 |
| 线线角弧线位置飘到几何体外 | `closestPointBetweenSegments` 中点可能在空中 | 共顶点优先 + 异面取线段1上最近点 |
| 线线角弧线画在夹角外侧 | d1/d2 使用全局方向而非从共顶点出发 | 共顶点时 dir = normalize(另一端 - 共顶点) |
| 弧线扫掠角不匹配 | `actualSweep` 启发式与计算角度不一致 | 直接使用 atan2 几何角度 |

### 新增文件

- `src/engine/math/angleCalculator.ts` — 角度计算引擎 + 可视化数据 + 弧线生成
- `src/editor/tools/angleTool.ts` — 统一两步交互工具
- `src/components/scene/renderers/AngleMeasurementRenderer.tsx` — 3D 弧线渲染
- `src/components/panels/inspectors/AngleMeasurementInspector.tsx` — 角度属性面板

### 修改文件

- `src/editor/entities/types.ts` — 新增 angleMeasurement 类型
- `src/editor/store/entityStore.ts` — entityReferences/collectChildIds 支持
- `src/editor/tools/index.ts` — 注册 angleTool
- `src/components/scene/ToolBar.tsx` — 角度工具按钮
- `src/components/scene/Scene3D.tsx` — side-effect import
- `src/components/panels/inspectors/index.ts` — side-effect import

*创建时间：2026-03-10*
*完成时间：2026-03-10*
*状态：✅ 已完成*
