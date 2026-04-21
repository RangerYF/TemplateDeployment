# M-06 向量运算演示台 — 调研报告

> **文档类型：** 技术调研 & 实现方案分析
> **关联需求：** `docs/需求文档md/M-06 向量运算演示台 — 演示数据.md`
> **前期调研：** `.tasks/completed/repo_research/outputs/math-M06-analysis.md`
> **日期：** 2026-03-14
> **状态：** 待决策

---

## 一、现有 M-01 架构速览

```
App.tsx
 └─ AppLayout
     ├─ TopBar           ← 几何体类型切换栏
     ├─ EntityListPanel  ← 左侧实体列表
     ├─ Scene3D          ← 主 3D 场景（R3F Canvas）
     │   ├─ SceneContent（实体渲染器循环）
     │   ├─ ToolBar（工具按钮）
     │   └─ OrbitControls / MeasurementDisplay
     └─ RightPanel       ← 右侧参数/Inspector面板
```

**核心系统分层：**
- `src/engine/` — 纯函数计算层（Builders、Math、Unfolding、Projection）
- `src/editor/` — 状态管理层（Entity/Command/Tool/Store 七系统）
- `src/components/` — React UI 渲染层（场景、面板、布局）

---

## 二、M-06 功能矩阵与 M-01 可复用性评估

| 功能 | M-06 需求 | M-01 可用资产 | 复用策略 |
|------|-----------|---------------|----------|
| **3D 坐标系** | 右手系, [-5,5]³, x/y/z轴 | `CoordSystemRenderer.tsx` | ✅ 可直接复用 |
| **3D 场景容器** | OrbitControls, 旋转/缩放 | `Scene3D.tsx` | ✅ 可直接复用 |
| **向量箭头（3D）** | 有向线段+锥形箭头 | `SegmentEntityRenderer`（仅线段无箭头） | ⚠️ 需改造加箭头 |
| **向量端点交互** | 拖拽端点改变方向/长度 | `MovePointCommand` + ToolSystem | ⚠️ 需改造 selectTool |
| **LaTeX 公式渲染** | 向量公式: a·b = \|a\|\|b\|cosθ | `src/components/ui/TeX.tsx` + KaTeX | ✅ 可直接复用 |
| **UI 组件库** | 按钮、输入框、滑块、Badge | `src/components/ui/` | ✅ 可直接复用 |
| **Design Token** | 颜色/字体/间距风格统一 | `src/styles/tokens.ts` | ✅ 可直接复用 |
| **2D Canvas 场景** | 坐标系网格+向量箭头+辅助线 | **M-01无2D Canvas** | ❌ 需全新实现 |
| **数乘滑块 k** | [-5,5] 滑块实时更新向量 | **M-01无参数驱动的滑块场景** | ❌ 需全新实现 |
| **点积投影可视化** | 投影虚线、夹角弧线、实时数值 | `AngleMeasurementRenderer`（参考） | ⚠️ 参考实现，需新写 |
| **向量分解（基底）** | 平行四边形分解动画 | **无对应功能** | ❌ 需全新实现 |
| **预设向量组** | VEC-001~VEC-071 共14组场景 | 几何体预设数据模式 | ⚠️ 借鉴数据结构 |
| **向量运算引擎** | 加减/数乘/点积/叉积/投影/分解 | `src/engine/math/`（几何体专用） | ⚠️ 新建向量数学模块 |

---

## 三、「在 M-01 里加模块」的解读

用户的表述有两种合理解读：

**解读 A（窄）**：在 M-01 的右侧面板/工具栏添加一组"向量工具"，作为立体几何的辅助功能（例如"给当前几何体建立向量坐标系、添加向量标注"）。

**解读 B（宽）**：在现有 M-01 App Shell（TopBar + Layout + Scene3D）的基础上，添加一个完整的"向量演示台"模式，通过 TopBar 切换进入，与几何体展示台并列。

**结论**：基于 M-06 需求文档规模（14组场景、2D/3D双模式、8种运算类型），**解读B更符合产品定位**。以下三个方案均基于解读B展开。

---

## 四、实现方案对比

---

### 方案A：复用 M-01 实体系统 — 在现有 Entity/Command 架构上扩展

**核心思路**：新增 `VectorEntity` 类型加入 M-01 的实体注册表，复用 M-01 的 Command/HistoryStore/SelectionStore/Tool 系统。通过 TopBar 新增"向量演示台"按钮组，切换到向量模式时，清空几何实体，载入向量工作区。

**架构变更：**
```
editor/entities/types.ts       ← 新增 VectorEntity 类型
editor/entities/vectorTypes.ts ← 向量实体类型定义
engine/vector/                 ← 新增向量数学引擎
  math.ts
  decomposition.ts
components/scene/renderers/
  VectorEntityRenderer.tsx     ← 3D向量箭头渲染
  VectorAuxRenderer.tsx        ← 辅助线/角弧线渲染
components/panels/
  VectorOperationPanel.tsx     ← 向量操作面板
  VectorListPanel.tsx          ← 向量列表
components/scene/
  VectorScene2D.tsx            ← 2D Canvas 场景（与Scene3D并列切换）
```

**优点：**
- 向量的撤销/重做、选中/高亮、属性面板等**零成本继承** M-01 完整系统
- TopBar 导航结构完全复用
- 文件数量少，代码量省约 30%

**缺点：**
- M-01 实体系统强耦合于"几何体编辑器"场景，EntityPropertiesMap 的联合类型扩展会影响 M-01 的所有类型检查
- `VectorEntity` 与 `GeometryEntity` 的 PointConstraint 约束体系完全不兼容（向量端点不挂靠几何体）
- 2D Canvas 场景与 R3F Canvas 共存时需要复杂的模式切换逻辑，且 2D 的拖拽交互与 3D 的 ToolEventDispatcher 体系不兼容
- 后续 M-06 功能迭代会持续污染 M-01 代码库

**风险等级：中-高**

---

### 方案B：独立向量子应用 + App Shell 共享（推荐）

**核心思路**：M-06 向量演示台作为一个**独立的子应用模块**（独立 Store、独立 Scene、独立 Engine），与 M-01 共享同一个外壳（TopBar 扩展增加模式切换）和基础 UI 组件库。两个模块通过一个顶层 `activeModule` 状态切换渲染。

**目录结构：**
```
src/
├── modules/
│   ├── m01-geometry/            ← 现有代码整体迁入
│   │   ├── editor/              ← 现有 editor/
│   │   ├── engine/              ← 现有 engine/
│   │   └── components/          ← 现有 m01 专属组件
│   └── m06-vector/              ← 新建，完全独立
│       ├── store/
│       │   └── vectorStore.ts   ← Zustand: 向量列表/当前运算/结果
│       ├── engine/
│       │   └── vectorMath.ts    ← 纯函数: 加减/数乘/点积/叉积/分解
│       ├── components/
│       │   ├── Vector2DScene.tsx
│       │   ├── Vector3DScene.tsx
│       │   ├── VectorPanel.tsx
│       │   ├── VectorList.tsx
│       │   └── VectorSubTopBar.tsx
│       └── presets/
│           └── vectorData.ts    ← VEC-001~VEC-071 预设数据
├── components/                  ← 共享 UI 组件（buttons/TeX/tokens）
├── App.tsx                      ← 新增 activeModule 切换逻辑
└── ...
```

**TopBar 扩展：**
```
[ 几何体组：长方体 圆柱 ... ] | [ 向量演示台 ]
```
点击"向量演示台"切换至 M-06 子应用，几何体按钮组隐藏（或 disabled）。

**2D/3D 内部切换（M-06 内部）：**
```
向量演示台内的 SubTopBar：[ 平面向量(2D) | 空间向量(3D) ]
```

**App.tsx 改造（最小化）：**
```tsx
// UIStore 新增 activeModule: 'm01' | 'm06'
function App() {
  const module = useUIStore(s => s.activeModule);
  return module === 'm06'
    ? <M06VectorApp />
    : <M01GeometryApp />;  // 现有逻辑不变
}
```

**优点：**
- M-06 拥有**完全独立的类型系统和状态**，不影响 M-01
- 2D Canvas 场景与 3D R3F 场景各自独立实现，无相互污染
- 后续添加 M-02、M-03 等模块，可沿用相同的"独立子应用"模式，形成统一的模块化架构
- 向量引擎可以写得极为精简（向量运算本质简单，不需要 Builder/Cache/Projection 等复杂系统）
- 容易做模块懒加载（code splitting）

**缺点：**
- 初期需要移动现有 M-01 文件到 `modules/m01-geometry/` 目录（路径重构，但 tsconfig 别名可平滑过渡）
- 需要新建 `modules/m06-vector/` 下约 12-15 个文件

**风险等级：低**

---

### 方案C：最小化侵入 — 2D Canvas Overlay + 3D 场景复用

**核心思路**：不重构 M-01 目录，在现有 App 中通过全局模式标记（`activeModule: 'm01' | 'm06'` 加入 UIStore）控制渲染。M-06 的 2D 模式用 Canvas Overlay 覆盖 Scene3D；3D 模式复用 Scene3D 但注入向量渲染器。

**优点：**
- 改动最小，不重构目录结构
- M-06 的向量 Store 和 Engine 独立新建，不影响 M-01

**缺点：**
- 2D Canvas Overlay 在 3D Canvas 上方覆盖，事件分发复杂（需要精确的 pointer event 路由）
- 3D 模式下向量渲染器和几何体渲染器共存于同一 SceneContent，需要额外的过滤逻辑
- UIStore 会混入 M-01 专属逻辑（`unfoldingEnabled`, `threeViewEnabled`）和 M-06 逻辑，耦合度高
- 随着功能增加，Overlay 模式维护成本持续上升

**风险等级：中**

---

## 五、方案横向对比

| 维度 | 方案A（扩展实体系统）| 方案B（独立子应用）| 方案C（Overlay）|
|------|---------------------|-------------------|-----------------|
| **实现工作量** | 中（~1500行） | 中（~2000行） | 小（~1200行） |
| **类型安全** | ⚠️ 中（实体联合类型扩展有风险） | ✅ 高（完全独立） | ✅ 高（独立Store） |
| **2D 场景实现难度** | 高（与R3F共存复杂） | 低（独立Canvas） | 中（Overlay路由） |
| **可维护性** | 低（M-01/M-06 代码耦合） | 高（完全隔离） | 中 |
| **M-02/M-03扩展性** | 差（模式越来越多） | ✅ 优（模式可复用） | 差 |
| **对现有代码侵入** | 高（改 entities/types.ts 核心文件） | 低（新建目录） | 低 |
| **Undo/Redo** | 自动继承 | 需新建（简单版即可） | 需新建 |
| **3D 场景复用程度** | 高 | 中（R3F setup复用） | 高 |

---

## 六、推荐方案：方案B（独立子应用 + App Shell 共享）

**推荐理由：**

1. **M-06 的 2D Canvas 是刚需**：平面向量（必修课）占全部需求的 70%，Canvas 2D 的拖拽精度、辅助线绘制（平行四边形、投影虚线）远优于 Three.js 正交模式。必须独立实现，不宜与 R3F 体系混合。

2. **类型隔离比代码复用更重要**：方案A扩展 `EntityPropertiesMap` 联合类型，会让 M-01 所有依赖该类型的函数都需要处理向量 case，逐渐失控。方案B完全避免这个问题。

3. **为后续模块奠定架构**：`modules/m06-vector/` 的目录模式可直接作为 M-02（函数图像）、M-03（解析几何）的模板。现在做对，后面少踩坑。

4. **复用量仍然可观**：
   - `@react-three/fiber` + `@react-three/drei`（OrbitControls、Line、Html）全部复用
   - `src/components/ui/`（Button、Input、TeX、Switch）全部复用
   - `src/styles/tokens.ts` 设计 token 全部复用
   - 向量箭头渲染可参考 `SegmentEntityRenderer` + 新增 `ConeGeometry` 箭头

---

## 七、推荐方案的详细模块结构

```
src/modules/m06-vector/
├── store/
│   └── vectorStore.ts
│       ├── vectors: Vec[]          ← 向量列表 {id, start, end, color, label}
│       ├── operation: OpType       ← 当前运算 ('add'|'sub'|'scale'|'dot'|...)
│       ├── selectedIds: string[]   ← 选中向量
│       ├── scalarK: number         ← 数乘系数
│       ├── showAux: boolean        ← 显示辅助线
│       ├── dimension: '2D'|'3D'   ← 当前模式
│       └── preset: string|null    ← 当前预设ID (VEC-011-A等)
│
├── engine/
│   └── vectorMath.ts
│       ├── add(a, b) → Vec
│       ├── sub(a, b) → Vec
│       ├── scale(v, k) → Vec
│       ├── dot(a, b) → number
│       ├── cross(a, b) → Vec3       ← 仅3D
│       ├── magnitude(v) → number
│       ├── angle(a, b) → number     ← 弧度
│       ├── project(a, b) → Vec      ← a在b上的投影向量
│       ├── decompose(v, e1, e2) → [number, number]  ← 基底分解
│       ├── isCollinear(a, b) → boolean
│       └── isPerpendicular(a, b) → boolean
│
├── components/
│   ├── Vector2DScene.tsx
│   │   ├── Canvas-based 2D场景
│   │   ├── 坐标系网格渲染
│   │   ├── 向量箭头渲染（canvas.beginPath + arrowhead）
│   │   ├── 辅助线（平行四边形/投影/角弧线）
│   │   ├── 拖拽交互（端点/中部/起点 三种模式）
│   │   └── 实时数值标注（HTML Overlay）
│   │
│   ├── Vector3DScene.tsx
│   │   ├── R3F Canvas（复用 OrbitControls/Light setup）
│   │   ├── VectorArrow3D（Line + ConeGeometry）
│   │   ├── CoordAxes3D（复用/改写 CoordSystemRenderer 逻辑）
│   │   └── AuxPlane3D（叉积平行四边形面）
│   │
│   ├── VectorPanel.tsx            ← 右侧操作面板
│   │   ├── 运算类型选择按钮组
│   │   ├── 向量坐标输入（精确输入）
│   │   ├── 数乘滑块 k [-5,5]
│   │   ├── 实时计算结果展示（TeX公式）
│   │   └── 判定结论（共线/垂直/夹角）
│   │
│   ├── VectorList.tsx             ← 左侧向量列表
│   │   ├── 向量列表（颜色标记）
│   │   ├── 删除/重命名
│   │   └── 预设场景选择下拉
│   │
│   └── VectorSubTopBar.tsx        ← M-06 内部的 2D/3D 切换栏 + 预设选择
│
└── presets/
    └── vectorData.ts              ← VEC-001~VEC-071 全量预设数据
```

---

## 八、2D Canvas 场景技术要点

2D 场景是 M-06 的核心难点，具体实现要点：

| 问题 | 解决方案 |
|------|----------|
| **向量箭头绘制** | Canvas Path + 旋转变换画锥形箭头 |
| **端点拖拽拾取** | 每帧检查 mouse 位置与端点距离（阈值 8px） |
| **辅助线（平行四边形）** | 4点连线 + 虚线 strokeStyle = dashed |
| **投影可视化** | 向量点积计算投影点，绘制垂足虚线 |
| **角度弧线** | ctx.arc() + 扇形填充 |
| **数值标注** | HTML Overlay div（支持 LaTeX，优于 fillText） |
| **性能** | requestAnimationFrame 帧驱动，仅在状态变更时重绘 |
| **响应式** | ResizeObserver 监听容器大小，重算视口变换矩阵 |

---

## 九、关键技术风险

| 风险点 | 等级 | 应对策略 |
|--------|------|----------|
| 2D 拖拽精度与性能 | 中 | Canvas 分层渲染（静态层+动态层）；拾取使用距离阈值而非精确碰撞 |
| M-01 目录重构（迁入 modules/m01-geometry/） | 中 | 使用 tsconfig paths 别名，路径切换对消费方透明 |
| 2D/3D 状态同步 | 低 | Zustand store 单一数据源，两个渲染器均订阅同一 store |
| 向量箭头在 3D 中的可见性 | 低 | ConeGeometry 做箭头，或 billboard 技术确保始终朝向相机 |
| 基底分解的边界情况 | 低 | 行列式判零 + 用户提示"基底共线，无法分解" |

---

## 十、待决策事项

- [ ] **是否现在重构 M-01 目录到 `modules/m01-geometry/`**？（影响方案B的执行顺序）
- [ ] **M-06 的 Undo/Redo 是否需要**？（向量操作比几何体简单，可考虑仅支持"重置"而非完整历史栈）
- [ ] **预设数据的载入方式**：直接 import 静态 TS 对象（简单）还是未来接 API（灵活）？
- [ ] **2D 场景的坐标拖拽是否需要吸附到整数坐标**（snap to grid）？
