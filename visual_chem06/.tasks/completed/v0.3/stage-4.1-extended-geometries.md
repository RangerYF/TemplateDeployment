# Stage 4.1 — 扩展几何体（v2 需求覆盖）

> **任务ID**：03-10-16-00-extended-geometries
> **风险等级**：L1 常规风险
> **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> **来源**：v2 需求文档中 P2 优先级几何体（F13-F16），从 BACKLOG 第六批提前纳入

---

## 目标

覆盖 `docs/需求文档v2.md` 中尚未实现的 4 种几何体，使产品完整支持 v2 需求文档定义的全部几何体类型。

---

## 待实现几何体清单

| 子任务 | 几何体 | 需求编号 | BACKLOG | 类型 | 参数 |
|--------|--------|---------|---------|------|------|
| T4.1.1 | 圆台 | GEO-024 | F15 | 曲面体 (SurfaceResult) | 上底半径 r₁、下底半径 r₂、高 h |
| T4.1.2 | 棱台 | GEO-034 | F16 | 多面体 (PolyhedronResult) | 底面边数 n(3~8)、上底边长 a₁、下底边长 a₂、高 h |
| T4.1.3 | 对棱相等四面体 | GEO-032 | F13 | 多面体 (PolyhedronResult) | 三组对棱长 p, q, r |
| T4.1.4 | 对棱垂直四面体 | GEO-033 | F14 | 多面体 (PolyhedronResult) | 六条棱长（需满足对棱垂直约束） |

---

## T4.1.1 圆台（Truncated Cone / Frustum Cone）

### 参数定义

```typescript
export interface TruncatedConeParams {
  topRadius: number;    // 上底半径 r₁
  bottomRadius: number; // 下底半径 r₂（r₂ > r₁）
  height: number;       // 高 h
}
```

### 公式

| 项目 | 公式 |
|------|------|
| 母线长 | l = √((r₂ - r₁)² + h²) |
| 体积 | V = (π/3)h(r₁² + r₂² + r₁r₂) |
| 侧面积 | S_侧 = π(r₁ + r₂)l |
| 表面积 | S = π(r₁² + r₂² + (r₁ + r₂)l) |

### 构建器要点（SurfaceResult）

- 类似 `cone.ts` + `cylinder.ts` 的混合
- Three.js: `CylinderGeometry(topRadius, bottomRadius, height, 64)`
- 底面在 y=0，顶面在 y=h，中心在原点 → `positionOffset: [0, h/2, 0]`
- 特征点：上底圆心 O₁(0, h, 0)、下底圆心 O(0, 0, 0)
- 母线：4 条均匀分布（90° 间隔），从下底圆到上底圆
- 圆轮廓：上底圆 + 下底圆（各 64 段）
- 面类型：`top`(上底圆)、`bottom`(下底圆)、`lateral`(侧面)

### 展开图

- 侧面展开为**扇环**（大扇形 - 小扇形）
- 大扇形半径 R₂ = r₂·l/(r₂-r₁)，小扇形半径 R₁ = r₁·l/(r₂-r₁)
- 扇环圆心角 θ = 2πr₂/R₂ = 2π(r₂-r₁)/l
- 上底圆和下底圆分别放在扇环两端外侧
- 特殊情况：r₁ = r₂ 时退化为矩形（圆柱展开）

### 三视图

- 正视图/侧视图：等腰梯形（上底 2r₁，下底 2r₂，高 h）
- 俯视图：同心圆（半径 r₁ 和 r₂）

### 教学要点

- r₁ = 0 退化为圆锥
- r₁ = r₂ 退化为圆柱
- 体积公式与棱台类比

---

## T4.1.2 棱台（Frustum Pyramid）

### 参数定义

```typescript
export interface FrustumParams {
  sides: number;           // 底面边数 n (3~8)
  bottomSideLength: number; // 下底边长 a₂
  topSideLength: number;    // 上底边长 a₁（a₁ < a₂）
  height: number;           // 高 h
}
```

### 公式

| 项目 | 公式 |
|------|------|
| 下底面积 | S₂ = (n/4)·a₂²·cot(π/n) |
| 上底面积 | S₁ = (n/4)·a₁²·cot(π/n) |
| 体积 | V = (h/3)(S₁ + S₂ + √(S₁S₂)) |
| 斜高 | h' = √(h² + (apothem₂ - apothem₁)²) |
| 侧面积 | S_侧 = ½(C₁ + C₂)·h' = ½·n·(a₁ + a₂)·h' |
| 表面积 | S = S₁ + S₂ + S_侧 |

### 构建器要点（PolyhedronResult）

- 类似 `prism.ts` 但上下底面不等
- 2n 个顶点：下底 A,B,C... 上底 A₁,B₁,C₁...
- 下底正 n 边形在 y=0，上底正 n 边形在 y=h
- 上下底面同心同轴，上底缩小（按 a₁/a₂ 比例）
- 面：1 下底 + 1 上底 + n 梯形侧面
- 棱：n 上棱 + n 下棱 + n 侧棱 = 3n

### 展开图

- n 个等腰梯形侧面排成一排
- 下底正 n 边形向下翻出（连接第一个梯形的下底边）
- 上底正 n 边形向上翻出（连接第一个梯形的上底边）
- 可复用 `buildPolygonAlongEdge()` 函数

### 三视图

- 正视图/侧视图：等腰梯形（上底 = 对应方向投影宽，下底同理，高 h）+ 内部虚线
- 俯视图：两个同心正 n 边形 + 连接线

### 教学要点

- S₁ = 0 退化为棱锥
- S₁ = S₂ 退化为棱柱

---

## T4.1.3 对棱相等四面体（等腰四面体）

### 参数定义

```typescript
export interface IsoscelesTetrahedronParams {
  edgeP: number; // 对棱 AB = CD = p
  edgeQ: number; // 对棱 AC = BD = q
  edgeR: number; // 对棱 AD = BC = r
}
```

### 约束

- 必须满足三角不等式（任意三条棱能构成三角形的面）
- 实际上每个面的三边为 (p, q, r)，所以需 p+q>r, p+r>q, q+r>p

### 公式

| 项目 | 公式 |
|------|------|
| 体积 | V = (√2/12)·√((p²+q²-r²)(p²+r²-q²)(q²+r²-p²)) |
| 外接球半径 | R = √(p²+q²+r²) / (2√2)（仅 p=q=r 时精确） |

### 构建器要点（PolyhedronResult）

- **核心思路**：内接于长方体，长方体三条棱 a,b,c 满足 p²=b²+c², q²=a²+c², r²=a²+b²
- 解方程：a²=(q²+r²-p²)/2, b²=(p²+r²-q²)/2, c²=(p²+q²-r²)/2
- 长方体 8 个顶点取交替的 4 个 → 四面体
- 顶点（以长方体中心为原点）：
  - A = (-a/2, -b/2, -c/2)
  - B = (a/2, b/2, -c/2)
  - C = (a/2, -b/2, c/2)
  - D = (-a/2, b/2, c/2)
- 然后平移使几何体中心在合适位置（y轴居中）

### 展开图

- 4 个全等三角形（边为 p, q, r），花瓣展开
- 中心面 + 3 个面沿边外翻

### 三视图

- 沿三个坐标轴投影，每个视图为矩形 + 对角线（因为内接于长方体）

### 教学要点

- p = q = r 时即为正四面体
- 可内接于长方体（核心考点）

---

## T4.1.4 对棱垂直四面体

### 参数定义

```typescript
export interface OrthogonalTetrahedronParams {
  edgeAB: number; // AB
  edgeAC: number; // AC
  edgeAD: number; // AD
  // BC, BD, CD 由约束自动计算
}
```

### 约束

- AB⊥CD, AC⊥BD, AD⊥BC
- 等价条件：AB² + CD² = AC² + BD² = AD² + BC²
- 用户输入 3 条棱（从 A 出发的三条），系统自动计算另 3 条

### 参数方案（简化）

实际上，对棱垂直四面体可以用**三组对棱中点连线长度**或**从一个顶点出发的三条棱长**来参数化。

**方案：以中点连线长度参数化**

```typescript
export interface OrthogonalTetrahedronParams {
  m1: number; // 第一组对棱中点连线长
  m2: number; // 第二组对棱中点连线长
  m3: number; // 第三组对棱中点连线长
}
```

三组对棱中点连线两两垂直，以它们为坐标轴建立坐标系。

### 构建器要点

- 以三组对棱中点连线为坐标轴
- 设中点连线长度为 m₁, m₂, m₃
- 四个顶点可表示为：
  - A = (m₁, m₂, m₃) 的某种组合
- 这是一个数学上较复杂的构建，需要仔细推导

### 展开图与三视图

- 展开图：4 个三角形花瓣展开
- 三视图：沿三组对棱中点连线方向投影

### 教学要点

- 三组对棱中点连线两两垂直
- 可以此建立正交坐标系
- 正四面体是其特例

---

## 每个几何体的完整 Pipeline

每个新几何体需要创建/修改以下文件：

### 新建文件（每个几何体）

1. `src/engine/builders/<name>.ts` — 构建器
2. `src/engine/math/calculators/<name>.ts` — 计算器（体积/表面积）
3. `src/engine/unfolding/<name>Unfold.ts` — 展开图
4. `src/engine/projection/<name>ThreeView.ts`（或在 threeView.ts 中追加）— 三视图

### 修改文件（注册 & UI）

5. `src/types/geometry.ts` — 类型定义、参数接口、DEFAULT_PARAMS、GEOMETRY_LIST、GEOMETRY_GROUPS
6. `src/engine/builders/index.ts` — 注册构建器
7. `src/engine/math/index.ts` — 注册计算器
8. `src/engine/math/circumscribedSphere.ts` — 外接球计算
9. `src/engine/unfolding/index.ts` — 注册展开 + UNFOLDABLE_TYPES
10. `src/engine/projection/index.ts` — 注册三视图 + THREE_VIEW_TYPES
11. `src/components/panels/ParameterPanel.tsx` — 参数面板 PARAM_FIELDS
12. `src/components/panels/inspectors/GeometryInspector.tsx` — TYPE_LABELS + PARAM_LABELS
13. `src/components/layout/TopBar.tsx` — GEOMETRY_GROUPS 更新（圆台→旋转体组，棱台→棱锥组或新组）

---

## 分组 UI 更新

更新 `GEOMETRY_GROUPS`：

```typescript
export const GEOMETRY_GROUPS: GeometryGroup[] = [
  { label: '棱柱', types: ['cube', 'cuboid', 'prism'] },
  { label: '棱锥/棱台', types: ['pyramid', 'frustum'] },
  { label: '旋转体', types: ['cylinder', 'cone', 'truncatedCone', 'sphere'] },
  { label: '四面体', types: ['regularTetrahedron', 'cornerTetrahedron', 'isoscelesTetrahedron', 'orthogonalTetrahedron'] },
];
```

---

## 执行顺序建议

1. **T4.1.1 圆台** — 最直接，复用圆锥/圆柱模式
2. **T4.1.2 棱台** — 复用棱锥/棱柱模式
3. **T4.1.3 对棱相等四面体** — 数学推导清晰（内接长方体）
4. **T4.1.4 对棱垂直四面体** — 最复杂，参数化方案需确认

---

## 验收标准

- [ ] 4 种几何体均可在 TopBar 中选择并切换
- [ ] 参数面板可调参数，几何体实时更新
- [ ] 体积/表面积计算正确（含符号表达式）
- [ ] 外接球计算正确
- [ ] 展开图正确显示（边对齐、不重叠）
- [ ] 三视图正确显示（含虚线、尺寸标注）
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过
- [ ] TopBar 分组显示正确

---

## 状态

- [x] T4.1.1 圆台 — ✅ 已完成
- [x] T4.1.2 棱台 — ✅ 已完成
- [x] T4.1.3 对棱相等四面体 — ✅ 已完成
- [x] T4.1.4 对棱垂直四面体 — ✅ 已完成

---

## 执行总结

### 完成情况

| 子任务 | 状态 | 类型 | 新建文件 |
|--------|------|------|----------|
| T4.1.1 圆台 | ✅ | SurfaceResult | builder + calculator + unfold |
| T4.1.2 棱台 | ✅ | PolyhedronResult | builder + calculator + unfold |
| T4.1.3 对棱相等四面体 | ✅ | PolyhedronResult | builder + calculator + unfold |
| T4.1.4 对棱垂直四面体 | ✅ | PolyhedronResult | builder + calculator + unfold |

### 新建文件（12 个）

- `src/engine/builders/truncatedCone.ts`
- `src/engine/builders/frustum.ts`
- `src/engine/builders/isoscelesTetrahedron.ts`
- `src/engine/builders/orthogonalTetrahedron.ts`
- `src/engine/math/calculators/truncatedCone.ts`
- `src/engine/math/calculators/frustum.ts`
- `src/engine/math/calculators/isoscelesTetrahedron.ts`
- `src/engine/math/calculators/orthogonalTetrahedron.ts`
- `src/engine/unfolding/truncatedConeUnfold.ts`
- `src/engine/unfolding/frustumUnfold.ts`
- `src/engine/unfolding/isoscelesTetrahedronUnfold.ts`
- `src/engine/unfolding/orthogonalTetrahedronUnfold.ts`

### 修改文件（13 个）

- `src/types/geometry.ts` — 4 种 GeometryType + Params + DEFAULT_PARAMS + GEOMETRY_GROUPS 更新
- `src/engine/types.ts` — SurfaceResult.geometryType 扩展 truncatedCone
- `src/engine/builders/index.ts` — 注册 4 个 builder
- `src/engine/math/index.ts` — 注册 4 个 calculator
- `src/engine/math/circumscribedSphere.ts` — 4 种外接球计算
- `src/engine/unfolding/index.ts` — 注册 4 个展开图 + TruncatedConeUnfoldResult 类型
- `src/engine/projection/threeView.ts` — 4 种三视图函数
- `src/engine/projection/index.ts` — 注册 4 种
- `src/components/panels/ParameterPanel.tsx` — PARAM_FIELDS + 棱台拓扑检测
- `src/components/panels/inspectors/GeometryInspector.tsx` — TYPE_LABELS + PARAM_LABELS
- `src/components/scene/renderers/FaceEntityRenderer.tsx` — truncatedCone case
- `src/components/scene/renderers/SegmentEntityRenderer.tsx` — DynamicCurveSegment（曲面体线条动态更新修复）
- `src/components/views/UnfoldingPanel.tsx` — 圆台扇环展开图渲染

### 门禁检查

- `pnpm lint` ✅ 通过
- `pnpm tsc --noEmit` ✅ 通过

### 分组更新

```
棱柱：正方体、长方体、正棱柱
棱锥/棱台：棱锥、棱台
旋转体：圆柱、圆锥、圆台、球
四面体：正四面体、墙角四面体、对棱相等四面体、对棱垂直四面体
```

共 13 种几何体，覆盖 v2 需求文档全部几何体类型。

## 额外修复

- [x] 曲面体参数变更后线条不更新 — 新增 `DynamicCurveSegment` 从 builder result 动态获取 curvePoints

## 已知限制

- 等腰四面体参数 p,q,r 未做合法性约束（退化检测），极端参数可能导致扁平化

*完成时间：2026-03-10*
