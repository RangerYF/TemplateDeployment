# 第2A阶段：Builder 架构 + 长方体 & 圆锥

**任务ID**: 03-05-14-30-Builder架构验证
**风险等级**: L2（高风险：涉及数学计算、跨模块联动、架构设计决策）
**流程路径**: MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**关联主计划**: `.tasks/active/init/PROGRESSIVE-PLAN.md` 第2A阶段
**状态**: 已完成

---

## 任务目标

设计 Builder 通用输出接口，实现长方体（多面体代表）和圆锥（曲面体代表）的构建与渲染，跑通「参数面板 → Store → Builder → 3D 渲染」的完整数据流。**重点是验证架构能同时适配多面体和曲面体。**

---

## 验收标准

- [x] 点击 TopBar "长方体" 按钮，中央显示半透明面 + 12 条棱线 + 8 个顶点标签的长方体
- [x] 点击 TopBar "圆锥" 按钮，中央显示半透明面 + 母线 + 特征点标签的圆锥
- [x] 左侧参数面板根据几何体类型显示对应的参数输入控件
- [x] 修改参数面板数值，3D 模型实时更新（无需点确认）
- [x] 长方体默认标签为 A/B/C/D（底面）、A₁/B₁/C₁/D₁（顶面）
- [x] 圆锥默认标签为 P（顶点）、O（底面圆心）
- [x] 其他 4 种几何体按钮点击后显示占位提示或复用占位立方体
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 子任务清单（串行执行）

### T2A.1 定义 Builder 输出接口

**目标**：创建 Builder 通用输出类型，用判别联合区分多面体和曲面体。

**产出文件**：
- `src/engine/types.ts`

**验收**：TypeScript 编译无报错

---

### T2A.2 实现长方体 Builder

**目标**：输入长宽高，输出多面体结构（8 顶点 + 6 面 + 12 棱 + 默认标签）。底面在 y=0 平面，Y 轴朝上。

**产出文件**：
- `src/engine/builders/cuboid.ts`

**验收**：调用返回正确的顶点/面/棱数据

---

### T2A.3 实现圆锥 Builder

**目标**：输入底面半径和高，输出曲面体结构（特征点 + 母线 + Three.js 几何体参数）。底面在 y=0 平面，与长方体坐标系一致。

**产出文件**：
- `src/engine/builders/cone.ts`

**验收**：调用返回正确的特征点和母线数据

---

### T2A.4 Builder 注册表

**目标**：创建统一分发入口，根据 GeometryType 调用对应 builder。长方体和圆锥可用，其余返回 null。

**产出文件**：
- `src/engine/builders/index.ts`

**验收**：`buildGeometry('cuboid', ...)` 和 `buildGeometry('cone', ...)` 正常返回

---

### T2A.5 实现 useGeometryBuilder hook

**目标**：连接 Store 和 Builder，currentType 或 params 变化时自动重新构建。

**产出文件**：
- `src/hooks/useGeometryBuilder.ts`

**验收**：hook 可在组件中调用，参数变化时返回新的 BuilderResult

---

### T2A.6 实现 GeometryRenderer 组件

**目标**：根据 BuilderResult 渲染 3D 几何体。渲染风格：半透明面 + 实线棱边/母线 + 顶点标签（HTML overlay）。result 为 null 时显示占位。

**产出文件**：
- `src/components/scene/GeometryRenderer.tsx`

**验收**：长方体和圆锥均能正确渲染面+线+标签

---

### T2A.7 实现 ParameterPanel 组件

**目标**：根据当前几何体类型动态渲染参数输入控件。长方体显示长/宽/高，圆锥显示半径/高，其他类型显示占位。使用已移植的 UI 组件。

**产出文件**：
- `src/components/panels/ParameterPanel.tsx`

**验收**：切换几何体类型时面板正确切换，修改参数后 store 即时更新

---

### T2A.8 集成到 Scene3D 和 LeftPanel

**目标**：将 GeometryRenderer 替换 Scene3D 中的占位立方体，将 ParameterPanel 嵌入 LeftPanel 的参数设置区。

**修改文件**：
- `src/components/scene/Scene3D.tsx`
- `src/components/layout/LeftPanel.tsx`

**验收**：完整数据流跑通——选择几何体 → 参数面板更新 → 修改参数 → 3D 实时更新

---

### T2A.9 回归验证与架构评估

**目标**：执行回归门禁，验证全部验收标准，评估架构对 2B 铺开的适配性。

**动作**：
1. `pnpm tsc --noEmit` + `pnpm lint`
2. `pnpm dev` 手动验证全部验收标准
3. 在"架构验证结论"章节记录评估

**验收**：全部验收标准通过，架构评估结论记录完成

---

## 涉及文件范围汇总

```
新增：
src/engine/
├── types.ts                          # BuilderResult 接口定义
└── builders/
    ├── index.ts                      # Builder 注册表
    ├── cuboid.ts                     # 长方体 Builder
    └── cone.ts                       # 圆锥 Builder
src/hooks/
└── useGeometryBuilder.ts             # Store→Builder 连接 hook
src/components/panels/
└── ParameterPanel.tsx                # 参数输入面板
src/components/scene/
└── GeometryRenderer.tsx              # 几何体 3D 渲染

修改：
src/components/scene/Scene3D.tsx      # 集成 GeometryRenderer
src/components/layout/LeftPanel.tsx   # 集成 ParameterPanel
```

---

## 技术决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| BuilderResult 类型 | 判别联合（polyhedron / surface） | 两类几何体数据结构差异大，统一接口会导致大量可选字段 |
| 多面体渲染 | 手动 BufferGeometry | 需要精确控制顶点/面/棱 |
| 曲面体渲染 | Three.js 内置几何体 | ConeGeometry 等已提供高质量曲面 |
| 顶点标签 | @react-three/drei Html 组件 | 支持任意文字和样式，比 3D 文本更清晰 |
| 坐标系约定 | Y 轴朝上，底面在 y=0 | Three.js 默认 Y-up，统一底面便于后续坐标系功能 |

---

## 风险与注意事项

1. **ConeGeometry 坐标偏移**：Three.js 默认圆锥中心在原点，需偏移使底面在 y=0
2. **面的三角化**：多面体矩形面需拆为两个三角形，注意法线方向
3. **双面渲染**：半透明面需要 `DoubleSide`
4. **标签始终可见**：教学场景下标签不应被遮挡

---

## 架构验证结论

1. **BuilderResult 接口适配性**：判别联合（polyhedron/surface）设计成功。多面体用顶点+面+棱的数学描述，曲面体用 Three.js 几何体参数+特征点+线条，两者数据结构差异大但通过 kind 字段统一分发，无多余可选字段。
2. **渲染组件通用性**：GeometryRenderer 通过 kind 分发到 PolyhedronRenderer/SurfaceRenderer，各自独立渲染逻辑清晰。渲染风格（半透明面+棱线+标签）在两类几何体上自然统一。
3. **标签系统对曲面体适配**：多面体用 vertices[].label，曲面体用 featurePoints[].label，两者结构一致（LabeledPoint），渲染代码复用同一套 Html 组件方案。
4. **Store 结构评估**：现有 Store 无需修改。currentType + params 的分离设计 + 泛型 setParams 完全满足需求。
5. **2B 铺开预估**：新增几何体只需：(1) 新建 builder 文件 (2) 注册到 builders map。ParameterPanel 已预配置所有 6 种几何体参数，无需额外修改。预估 2B 工作量低。

---

## 执行日志

### 2026-03-05 执行记录

**T2A.1 定义 Builder 输出接口** ✅
- 创建 `src/engine/types.ts`
- 判别联合：`PolyhedronResult`（多面体）+ `SurfaceResult`（曲面体）
- 多面体：vertices(LabeledPoint[]) + faces(number[][]) + edges([number,number][])
- 曲面体：geometryType + geometryArgs + positionOffset + featurePoints + lines

**T2A.2 实现长方体 Builder** ✅
- 创建 `src/engine/builders/cuboid.ts`
- 8 顶点（底面 ABCD、顶面 A₁B₁C₁D₁）+ 6 面 + 12 棱
- 底面 y=0，XZ 平面居中

**T2A.3 实现圆锥 Builder** ✅
- 创建 `src/engine/builders/cone.ts`
- 特征点 P（顶点）+ O（底面圆心），4 条母线 + 底圆轮廓线
- ConeGeometry 参数 + positionOffset=[0, h/2, 0] 使底面对齐 y=0

**T2A.4 Builder 注册表** ✅
- 创建 `src/engine/builders/index.ts`
- buildGeometry() 分发函数，cuboid/cone 已注册，其余返回 null

**T2A.5 实现 useGeometryBuilder hook** ✅
- 创建 `src/hooks/useGeometryBuilder.ts`
- useMemo 连接 store.currentType + params → buildGeometry

**T2A.6 实现 GeometryRenderer 组件** ✅
- 创建 `src/components/scene/GeometryRenderer.tsx`
- PolyhedronRenderer：BufferGeometry 三角化 + Line 棱线 + Html 标签
- SurfaceRenderer：Three.js 原生几何体 + Edges 轮廓 + Line 母线 + Html 标签
- PlaceholderRenderer：未实现几何体的占位显示

**T2A.7 实现 ParameterPanel 组件** ✅
- 创建 `src/components/panels/ParameterPanel.tsx`
- 根据 currentType 动态渲染参数控件（Slider + Input）
- 6 种几何体参数配置已全部定义

**T2A.8 集成到 Scene3D 和 LeftPanel** ✅
- 修改 `src/components/scene/Scene3D.tsx`：替换占位立方体为 GeometryRenderer
- 修改 `src/components/layout/LeftPanel.tsx`：参数设置区嵌入 ParameterPanel

**T2A.9 回归验证** ✅
- `pnpm tsc --noEmit` ✅ 通过
- `pnpm lint` ✅ 通过
- `pnpm build` ✅ 通过（修复 2 个 tsc -b 严格模式类型错误）
- `pnpm dev` ✅ 启动成功
