# V0.3 阶段4：新几何体（基础）+ 选择器分类

> **阶段目标**：新增正四面体、墙角四面体、正棱柱三种几何体，并将选择器改为分类显示
> **前置条件**：阶段3（坐标系重构）已完成
> **BACKLOG 覆盖**：F07（正四面体）、F08（墙角四面体）、F09（正棱柱）、F12（选择器分类）
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.3/PROGRESSIVE-PLAN.md`（V0.3 全局计划，8个阶段串行）
> - 功能清单：`.tasks/active/v0.3/BACKLOG.md`（F01-F19 完整功能定义与优先级）

---

## 新增几何体的完整流水线

每种新几何体需要走完以下 pipeline（以现有 pyramid 为参照）：

| 步骤 | 文件 | 说明 |
|------|------|------|
| 1. 参数类型 | `src/types/geometry.ts` | 新增 `GeometryType` 值 + `Params` 接口 + 默认参数 + GEOMETRY_LIST |
| 2. Builder | `src/engine/builders/[geo].ts` + `index.ts` | 返回 `PolyhedronResult`，注册到 builders 映射表 |
| 3. Calculator | `src/engine/math/calculators/[geo].ts` + `index.ts` | 体积/表面积精确公式 + LaTeX 步骤 |
| 4. 外接球 | `src/engine/math/circumscribedSphere.ts` | 球心 + 半径 + LaTeX |
| 5. 展开图 | `src/engine/unfolding/[geo]Unfold.ts` + `index.ts` | 面展开 2D 布局 |
| 6. 三视图 | `src/engine/projection/threeView.ts` + `index.ts` | 正视/侧视/俯视投影 |
| 7. 参数面板 | `src/components/panels/ParameterPanel.tsx` | `PARAM_FIELDS` 配置 + 拓扑检测 |
| 8. Inspector | `src/components/panels/inspectors/GeometryInspector.tsx` | `TYPE_LABELS` + `PARAM_LABELS` |

其余功能（Entity 创建、hover/选中、右键菜单、坐标系等）由现有架构自动处理，无需额外代码。

---

## 子任务清单（串行执行）

### T4.1 正四面体（F07）⏱️ 1.5天

**目标**：新增正四面体几何体类型，所有棱长相等。

**数学公式**（来源：BACKLOG F07 + 需求文档 GEO-011）：

```
参数：棱长 a（单一参数）
顶点数：4 ｜ 棱数：6 ｜ 面数：4

高：h = (√6/3)·a
体积：V = (√2/12)·a³
表面积：S = √3·a²
外接球半径：R = (√6/4)·a
内切球半径：r = (√6/12)·a
外接球球心：重心位置，距底面 h/4 = (√6/12)·a
```

**顶点坐标设计**：

底面正三角形在 y=0 平面，重心在 XZ 原点：
```
底面外接圆半径 R_底 = a / √3
A = (R_底·cos(-π/2), 0, R_底·sin(-π/2))
B = (R_底·cos(π/6), 0, R_底·sin(π/6))
C = (R_底·cos(5π/6), 0, R_底·sin(5π/6))
D = (0, h, 0)  -- 顶点
```
标签：底面 A/B/C，顶点 D

**拓扑**：
- faces: [底面 CBA], [侧面 ABD], [侧面 BCD], [侧面 CAD]
- edges: AB, BC, CA, AD, BD, CD

**Pipeline 清单**：

1. **`src/types/geometry.ts`**：
   - `GeometryType` 新增 `'regularTetrahedron'`
   - 新增 `RegularTetrahedronParams { sideLength: number }`
   - `GeometryParams` 新增映射
   - `DEFAULT_PARAMS` 新增 `{ sideLength: 2 }`
   - `GEOMETRY_LIST` 暂不改（T4.4 统一改为分类 UI）

2. **`src/engine/builders/regularTetrahedron.ts`** — 新建：
   - `buildRegularTetrahedron(params)` → `PolyhedronResult`
   - 4 顶点 + 4 面 + 6 棱

3. **`src/engine/builders/index.ts`** — 注册到 builders 映射表

4. **`src/engine/math/calculators/regularTetrahedron.ts`** — 新建：
   - `calculateRegularTetrahedron(params)` → `CalculationResult`
   - 体积：V = (√2/12)·a³，精确符号表达 + LaTeX 步骤
   - 表面积：S = √3·a²，精确符号表达

5. **`src/engine/math/index.ts`** — 注册到 calculators 映射表

6. **`src/engine/math/circumscribedSphere.ts`** — 新增分支：
   - R = (√6/4)·a，球心在 (0, h/4, 0)

7. **`src/engine/unfolding/regularTetrahedronUnfold.ts`** — 新建：
   - 布局：底面正三角形 + 3 个等边三角形侧面外翻（花瓣式，类比 pyramidUnfold）
   - 因为所有面都是相同的等边三角形，展开图是经典的"一个三角形外接三个三角形"

8. **`src/engine/unfolding/index.ts`** — 注册 + 加入 `UNFOLDABLE_TYPES`

9. **`src/engine/projection/threeView.ts`** — 新增 `regularTetrahedronThreeView()`：
   - 正视图：等腰三角形（底=a，高=h）
   - 侧视图：等腰三角形（类似）
   - 俯视图：正三角形

10. **`src/engine/projection/index.ts`** — 注册 + 加入 `THREE_VIEW_TYPES`

11. **`src/components/panels/ParameterPanel.tsx`** — `PARAM_FIELDS` 新增：
    ```ts
    regularTetrahedron: [
      { key: 'sideLength', label: '棱长', min: 0.5, max: 10, step: 0.1 },
    ],
    ```

12. **`src/components/panels/inspectors/GeometryInspector.tsx`** — `TYPE_LABELS` 新增 `regularTetrahedron: '正四面体'`

13. **`src/editor/entities/types.ts`** — `GeometryProperties.params` 联合类型自动覆盖（通过 `geometry.ts` 导入）

**手算验证**（a=2）：
```
h = (√6/3)·2 = 2√6/3 ≈ 1.633
V = (√2/12)·8 = 2√2/3 ≈ 0.943
S = √3·4 = 4√3 ≈ 6.928
R_球 = (√6/4)·2 = √6/2 ≈ 1.225
```

**验收**：
- [ ] 选择正四面体后 3D 场景显示正确的等边四面体
- [ ] 只有一个"棱长"参数，滑块调节实时渲染
- [ ] 体积 V = (√2/12)·a³ 精确显示
- [ ] 表面积 S = √3·a² 精确显示
- [ ] 外接球渲染正确，半径公式正确
- [ ] 展开图正确（4 个等边三角形）
- [ ] 三视图正确
- [ ] 坐标系建系功能正常
- [ ] 标注、画线、截面等全部现有功能可用

---

### T4.2 墙角四面体（F08）⏱️ 1.5天

**目标**：新增墙角四面体（直角四面体），三条棱两两垂直。

**数学公式**（来源：BACKLOG F08 + 需求文档 GEO-031）：

```
参数：三条直角边 a, b, c
顶点数：4 ｜ 棱数：6 ｜ 面数：4

体积：V = abc/6
底面积（斜面）：S_斜面 = ½√(a²b² + b²c² + a²c²)
表面积：S = ½(ab + bc + ac) + S_斜面
外接球半径：R = √(a² + b² + c²) / 2
外接球球心：斜面中点 = (a/2, c/2, b/2)（对角线中点）
直角顶点到斜面距离：d = abc / √(a²b² + b²c² + a²c²)
```

**顶点坐标设计**：

直角顶点在原点，三条直角边沿坐标轴方向：
```
O = (0, 0, 0)  — 直角顶点
A = (a, 0, 0)  — 沿 X 轴
B = (0, 0, b)  — 沿 Z 轴
C = (0, c, 0)  — 沿 Y 轴（朝上）
```
标签：O（直角顶点）、A、B、C

**注意**：为了保持与其他几何体一致（底面在 y=0），将斜面 ABC 视为"底面"不太自然。考虑以下布局：
- O 在原点 (0, 0, 0)
- A 沿 X 方向 (a, 0, 0)
- B 沿 Z 方向 (0, 0, b)
- C 沿 Y 方向（朝上）(0, c, 0)

这样直角顶点 O 在 y=0 平面，C 在顶部，符合"底面在下"的视觉习惯。

**拓扑**：
- faces: [底面 OAB], [侧面 OAC], [侧面 OBC], [斜面 ABC]
- edges: OA, OB, OC, AB, AC, BC

**Pipeline 清单**：

1. **`src/types/geometry.ts`**：
   - `GeometryType` 新增 `'cornerTetrahedron'`
   - 新增 `CornerTetrahedronParams { edgeA: number; edgeB: number; edgeC: number }`
   - `DEFAULT_PARAMS` 新增 `{ edgeA: 2, edgeB: 2, edgeC: 2 }`

2. **`src/engine/builders/cornerTetrahedron.ts`** — 新建

3. **`src/engine/builders/index.ts`** — 注册

4. **`src/engine/math/calculators/cornerTetrahedron.ts`** — 新建：
   - V = abc/6，精确分数表达
   - 表面积 = ½(ab + bc + ac) + ½√(a²b² + b²c² + a²c²)

5. **`src/engine/math/index.ts`** — 注册

6. **`src/engine/math/circumscribedSphere.ts`** — 新增分支：
   - R = √(a² + b² + c²) / 2
   - 球心 = (a/2, c/2, b/2)

7. **`src/engine/unfolding/cornerTetrahedronUnfold.ts`** — 新建：
   - 4 个三角形面展开（3 个直角三角形 + 1 个斜面三角形）
   - 布局：斜面 ABC 居中，三个直角面外翻

8. **`src/engine/unfolding/index.ts`** — 注册

9. **`src/engine/projection/threeView.ts`** — 新增 `cornerTetrahedronThreeView()`：
   - 正视图（沿 -Z 看）：直角三角形 OAC（宽 a，高 c）
   - 侧视图（沿 +X 看）：直角三角形 OBC（宽 b，高 c）
   - 俯视图（沿 -Y 看）：直角三角形 OAB（宽 a，深 b）+ 斜线 AB

10. **`src/engine/projection/index.ts`** — 注册

11. **`src/components/panels/ParameterPanel.tsx`** — `PARAM_FIELDS` 新增：
    ```ts
    cornerTetrahedron: [
      { key: 'edgeA', label: '直角边 a', min: 0.5, max: 10, step: 0.1 },
      { key: 'edgeB', label: '直角边 b', min: 0.5, max: 10, step: 0.1 },
      { key: 'edgeC', label: '直角边 c', min: 0.5, max: 10, step: 0.1 },
    ],
    ```

12. **`src/components/panels/inspectors/GeometryInspector.tsx`** — `TYPE_LABELS` + `PARAM_LABELS` 扩展

**教学要点验证**：
- 以直角顶点 O 为原点、三条棱为坐标轴是最自然的建系方式 → 建系后 A=(a,0,0), B=(0,0,b), C=(0,c,0)
- 外接球球心在斜面上 → 验证球心坐标 (a/2, c/2, b/2) 到四个顶点距离相等

**手算验证**（a=b=c=2）：
```
V = 2·2·2/6 = 8/6 = 4/3 ≈ 1.333
S_斜面 = ½√(4·4 + 4·4 + 4·4) = ½√48 = 2√3 ≈ 3.464
S = ½(4+4+4) + 2√3 = 6 + 2√3 ≈ 9.464
R_球 = √(4+4+4)/2 = √12/2 = √3 ≈ 1.732
```

**验收**：
- [ ] 选择墙角四面体后显示三条直角边参数
- [ ] 3D 渲染正确：三条棱两两垂直
- [ ] V = abc/6 精确显示
- [ ] 外接球渲染正确，球心在斜面上
- [ ] 以直角顶点 O 建系后，A/B/C 坐标值与参数一致
- [ ] 展开图 + 三视图正确

---

### T4.3 正棱柱（F09）⏱️ 1.5天

**目标**：新增正棱柱几何体类型，底面为正多边形的直棱柱。

**数学公式**（来源：BACKLOG F09 + 需求文档 GEO-003/004/005）：

```
参数：底面边数 n（3~8）、底面边长 a、高 h
顶点数：2n ｜ 棱数：3n ｜ 面数：n+2

底面积：S_底 = (n/4)·a²·cot(π/n)
体积：V = S_底 · h
侧面积：S_侧 = n·a·h
表面积：S = S_侧 + 2·S_底
底面外接圆半径：R_底 = a / (2·sin(π/n))
外接球半径：R = √(R_底² + h²/4)
外接球球心：(0, h/2, 0)
```

**顶点坐标设计**：

与 pyramid 类似，底面在 y=0，顶面在 y=h：
```
底面：A_i = (R_底·cos(2πi/n - π/2), 0, R_底·sin(2πi/n - π/2))  i=0..n-1
顶面：A_i' = (同X, h, 同Z)  i=0..n-1
```
标签：底面 A/B/C/D/...，顶面 A₁/B₁/C₁/D₁/...（与 cuboid 一致的命名规则）

**拓扑**：
- faces: 1 个底面(n边形) + 1 个顶面(n边形) + n 个矩形侧面
- edges: n 条底边 + n 条顶边 + n 条侧棱 = 3n 条

**与现有 cuboid/cube 的关系**：
- 正四棱柱(n=4, a=a, h=a) = 正方体
- 正四棱柱(n=4) ≈ 长方体（但棱柱底面正方形边长相同）
- 这是独立几何体类型，不需要与 cuboid/cube 合并

**Pipeline 清单**：

1. **`src/types/geometry.ts`**：
   - `GeometryType` 新增 `'prism'`
   - 新增 `PrismParams { sides: number; sideLength: number; height: number }`
   - `DEFAULT_PARAMS` 新增 `{ sides: 6, sideLength: 1.5, height: 2 }`（默认六棱柱）

2. **`src/engine/builders/prism.ts`** — 新建：
   - `buildPrism(params)` → `PolyhedronResult`
   - 2n 顶点 + (n+2) 面 + 3n 棱

3. **`src/engine/builders/index.ts`** — 注册

4. **`src/engine/math/calculators/prism.ts`** — 新建：
   - 精确计算：n=3 时 S_底 = (√3/4)a²，n=4 时 S_底 = a²，n=6 时 S_底 = (3√3/2)a²
   - 其余 n 用数值近似

5. **`src/engine/math/index.ts`** — 注册

6. **`src/engine/math/circumscribedSphere.ts`** — 新增分支：
   - R = √(R_底² + h²/4)
   - 球心 = (0, h/2, 0)

7. **`src/engine/unfolding/prismUnfold.ts`** — 新建：
   - 布局：底面 + 侧面展开为一排矩形 + 顶面
   - 类似 cuboidUnfold 的十字形布局，但底面是正 n 边形

8. **`src/engine/unfolding/index.ts`** — 注册

9. **`src/engine/projection/threeView.ts`** — 新增 `prismThreeView()`：
   - 正视图：矩形（宽 = 2R_底 或 a，高 = h，取决于n和视角）
   - 侧视图：矩形
   - 俯视图：正 n 边形

10. **`src/engine/projection/index.ts`** — 注册

11. **`src/components/panels/ParameterPanel.tsx`** — `PARAM_FIELDS` 新增：
    ```ts
    prism: [
      { key: 'sides', label: '底面边数', min: 3, max: 8, step: 1 },
      { key: 'sideLength', label: '底面边长', min: 0.5, max: 10, step: 0.1 },
      { key: 'height', label: '高', min: 0.5, max: 10, step: 0.1 },
    ],
    ```

12. **`src/components/panels/ParameterPanel.tsx`** — `isTopologyChange` 新增 prism 的 `sides` 检测

13. **`src/components/panels/inspectors/GeometryInspector.tsx`** — `TYPE_LABELS` 新增 `prism: '正棱柱'`

**手算验证**（正六棱柱 n=6, a=1.5, h=2）：
```
R_底 = 1.5 / (2·sin(π/6)) = 1.5 / 1 = 1.5
S_底 = (3√3/2)·1.5² = (3√3/2)·2.25 = 3.375√3 ≈ 5.846
V = 5.846 × 2 ≈ 11.691
S_侧 = 6·1.5·2 = 18
S = 18 + 2·5.846 ≈ 29.691
R_球 = √(1.5² + 1) = √3.25 ≈ 1.803
```

**验收**：
- [ ] 可调底面边数（3~8），边数变化实时重建
- [ ] n=3 正三棱柱渲染正确
- [ ] n=6 正六棱柱渲染正确
- [ ] 体积/表面积精确计算
- [ ] 外接球正确
- [ ] 展开图 + 三视图正确
- [ ] 坐标系建系 + 画线 + 截面功能正常

---

### T4.4 几何体选择器分类 UI（F12）⏱️ 0.5天

**目标**：将 TopBar 几何体选择器从扁平列表改为分类分组显示。

**现状分析**：

`src/components/layout/TopBar.tsx`：
- `GEOMETRY_LIST` 是扁平数组，直接 `map` 渲染为一排按钮
- 新增 3 种几何体后共 9 种，扁平列表会过长

**分类设计**：

```
棱柱类：正方体、长方体、正棱柱
棱锥类：棱锥
旋转体：圆柱、圆锥、球
特殊四面体：正四面体、墙角四面体
```

**UI 方案**：分组标签 + 按钮组

```
┌─ 棱柱 ──────────────────┐ ┌─ 棱锥 ─┐ ┌─ 旋转体 ──────────┐ ┌─ 四面体 ──────────────┐
│ 正方体  长方体  正棱柱  │ │  棱锥  │ │ 圆柱  圆锥  球   │ │ 正四面体  墙角四面体  │
└─────────────────────────┘ └────────┘ └───────────────────┘ └──────────────────────┘
```

**要做的事**：

1. `src/types/geometry.ts` 新增分组元数据：
   ```ts
   export interface GeometryGroup {
     label: string;
     types: GeometryType[];
   }
   export const GEOMETRY_GROUPS: GeometryGroup[] = [
     { label: '棱柱', types: ['cube', 'cuboid', 'prism'] },
     { label: '棱锥', types: ['pyramid'] },
     { label: '旋转体', types: ['cylinder', 'cone', 'sphere'] },
     { label: '四面体', types: ['regularTetrahedron', 'cornerTetrahedron'] },
   ];
   ```

2. `src/components/layout/TopBar.tsx` 改为遍历 `GEOMETRY_GROUPS`：
   - 每组渲染一个分组区域（小标签 + 按钮组）
   - 组之间有分隔线或间距
   - 保留现有的按钮样式和交互逻辑

3. `GEOMETRY_LIST` 可保留（兼容其他引用处），但 TopBar 改为使用 `GEOMETRY_GROUPS`

**涉及文件**：
- `src/types/geometry.ts` — 新增 `GEOMETRY_GROUPS`
- `src/components/layout/TopBar.tsx` — UI 重构

**验收**：
- [ ] 几何体选择区按分类分组显示
- [ ] 每个分组有小标签
- [ ] 点击切换几何体功能正常
- [ ] 当前选中的几何体按钮高亮正确
- [ ] 视觉清晰不拥挤

---

## 涉及文件预估

| 文件 | T4.1 | T4.2 | T4.3 | T4.4 |
|------|------|------|------|------|
| `src/types/geometry.ts` | ✏️ | ✏️ | ✏️ | ✏️ |
| `src/engine/builders/regularTetrahedron.ts` | 🆕 | — | — | — |
| `src/engine/builders/cornerTetrahedron.ts` | — | 🆕 | — | — |
| `src/engine/builders/prism.ts` | — | — | 🆕 | — |
| `src/engine/builders/index.ts` | ✏️ | ✏️ | ✏️ | — |
| `src/engine/math/calculators/regularTetrahedron.ts` | 🆕 | — | — | — |
| `src/engine/math/calculators/cornerTetrahedron.ts` | — | 🆕 | — | — |
| `src/engine/math/calculators/prism.ts` | — | — | 🆕 | — |
| `src/engine/math/index.ts` | ✏️ | ✏️ | ✏️ | — |
| `src/engine/math/circumscribedSphere.ts` | ✏️ | ✏️ | ✏️ | — |
| `src/engine/unfolding/regularTetrahedronUnfold.ts` | 🆕 | — | — | — |
| `src/engine/unfolding/cornerTetrahedronUnfold.ts` | — | 🆕 | — | — |
| `src/engine/unfolding/prismUnfold.ts` | — | — | 🆕 | — |
| `src/engine/unfolding/index.ts` | ✏️ | ✏️ | ✏️ | — |
| `src/engine/projection/threeView.ts` | ✏️ | ✏️ | ✏️ | — |
| `src/engine/projection/index.ts` | ✏️ | ✏️ | ✏️ | — |
| `src/components/panels/ParameterPanel.tsx` | ✏️ | ✏️ | ✏️ | — |
| `src/components/panels/inspectors/GeometryInspector.tsx` | ✏️ | ✏️ | ✏️ | — |
| `src/components/layout/TopBar.tsx` | — | — | — | ✏️ |
| `src/editor/entities/types.ts` | ✏️ | ✏️ | ✏️ | — |

**新建文件数**：9（每种几何体 3 个：Builder + Calculator + Unfold）
**修改文件数**：约 10 个注册点/配置文件

---

## 门禁检查

每完成一种几何体后立即执行：
```bash
pnpm lint && pnpm tsc --noEmit
```
命中 `src/engine/` 数学计算 → 追加手算验证（附录F）。

---

## 风险与注意事项

1. **T4.1 正四面体展开图**：4 个等边三角形的花瓣展开需要精确计算外翻方向，与 pyramidUnfold 类似但更简单（所有面相同）。

2. **T4.2 墙角四面体顶点布局**：三条直角边沿坐标轴方向是最自然的选择，但需确保与现有 y=0 底面约定兼容。直角顶点 O 在 y=0 并非传统底面概念，但 3D 渲染无歧义。

3. **T4.3 正棱柱拓扑变化**：`sides` 参数变化时需要重建 builtIn 实体（类比 pyramid）。`isTopologyChange` 需要覆盖 `prism` 类型。

4. **T4.3 正棱柱标签**：底面标签 A/B/C/...，顶面标签 A₁/B₁/C₁/...。需要 Unicode 下标数字（₁₂₃...）或使用不同命名约定（如 cuboid 的 A→A₁ 映射）。参考现有 cuboid Builder 的标签模式。

5. **T4.4 分组 UI 响应式**：9 个几何体分 4 组，需确保在窄屏下不溢出。考虑用横向滚动或自适应折行。

6. **公式精确性**：所有精确公式的 LaTeX 表达需要与 BACKLOG 和需求文档中的公式一致。实现后用手算数据对照验证。

7. **坐标系兼容**：阶段3 重构后坐标系使用用户指定轴方向（而非自动推断），新几何体无需在 `coordinates.ts` 中添加特殊分支。但需验证 `buildCoordinateSystem` 的 fallback 路径（无用户轴方向时的自动推断）对新几何体的处理。

---

---

## 执行总结

### 完成情况

| 子任务 | 状态 | 新建文件 | 修改文件 |
|--------|------|----------|----------|
| T4.1 正四面体 | ✅ | builder + calculator + unfold | 7 个注册/配置文件 |
| T4.2 墙角四面体 | ✅ | builder + calculator + unfold | 7 个注册/配置文件 |
| T4.3 正棱柱 | ✅ | builder + calculator + unfold | 7 个注册/配置文件 + 拓扑检测 |
| T4.4 选择器分类 UI | ✅ | — | geometry.ts + TopBar.tsx |

### 新建文件（9 个）

- `src/engine/builders/regularTetrahedron.ts`
- `src/engine/builders/cornerTetrahedron.ts`
- `src/engine/builders/prism.ts`
- `src/engine/math/calculators/regularTetrahedron.ts`
- `src/engine/math/calculators/cornerTetrahedron.ts`
- `src/engine/math/calculators/prism.ts`
- `src/engine/unfolding/regularTetrahedronUnfold.ts`
- `src/engine/unfolding/cornerTetrahedronUnfold.ts`
- `src/engine/unfolding/prismUnfold.ts`

### 修改文件（10 个）

- `src/types/geometry.ts` — 3 种 GeometryType + Params + DEFAULT_PARAMS + GEOMETRY_GROUPS
- `src/engine/builders/index.ts` — 注册 3 个 builder
- `src/engine/math/index.ts` — 注册 3 个 calculator
- `src/engine/math/circumscribedSphere.ts` — 3 种外接球计算
- `src/engine/unfolding/index.ts` — 注册 3 个展开图 + UNFOLDABLE_TYPES
- `src/engine/projection/threeView.ts` — 3 种三视图函数
- `src/engine/projection/index.ts` — 注册 3 种 + THREE_VIEW_TYPES
- `src/components/panels/ParameterPanel.tsx` — PARAM_FIELDS + 拓扑检测(prism)
- `src/components/panels/inspectors/GeometryInspector.tsx` — TYPE_LABELS + PARAM_LABELS
- `src/components/layout/TopBar.tsx` — 分类分组 UI

### 门禁检查

- `pnpm lint` ✅ 通过
- `pnpm tsc --noEmit` ✅ 通过

### 分组结果

```
棱柱：正方体、长方体、正棱柱
棱锥/棱台：棱锥
旋转体：圆柱、圆锥、球
四面体：正四面体、墙角四面体
```

---

*创建时间：2026-03-10*
*完成时间：2026-03-10*
*状态：✅ 已完成*
