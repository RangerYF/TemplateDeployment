# V0.4 阶段2：直线方程显示

> **阶段目标**：建立坐标系后，选中线段可在 Inspector 中查看直线方程
> **预计耗时**：1-2 天
> **前置条件**：阶段1已完成
> **BACKLOG 覆盖**：F04
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.4/PROGRESSIVE-PLAN.md`
> - 功能清单：`.tasks/active/v0.4/BACKLOG.md`

---

## 代码现状摘要

| 模块 | 现状 | 备注 |
|------|------|------|
| SegmentInspector | 显示端点标签、长度、颜色/虚实样式 | 需扩展方程显示区域 |
| 坐标转换 | `CoordSystemRenderer` 已有完整的 世界坐标→坐标系坐标 转换逻辑 | 可直接复用 |
| 坐标系实体 | `EntityStore.getCoordinateSystem()` 可获取，properties 含 `originPointId`、`axes` | 已就绪 |
| 精确值格式化 | `symbolic.ts` 支持整数/分数/根号的 LaTeX 输出 | 可直接复用 |
| KaTeX 渲染 | `components/ui/TeX.tsx` 已集成 KaTeX | 可直接复用 |
| 端点坐标获取 | `usePointPosition(point)` 返回世界坐标 `[x,y,z]` | 已就绪 |

**关键发现**：所有基础设施已就绪，只需新增方程计算函数 + 在 SegmentInspector 中调用和显示。

---

## 数据流

```
选中线段 → SegmentInspector
  ↓
EntityStore.getCoordinateSystem() → 有/无坐标系？
  ↓ 有
usePointPosition() 获取两端点世界坐标
  ↓
从 CoordinateSystemProperties 取 originPointId + axes
  ↓
世界坐标 → 坐标系局部坐标（向量投影，复用 CoordSystemRenderer 的逻辑）
  ↓
计算方向向量 d = endCoord - startCoord
  ↓
生成 LaTeX：参数方程 + 对称式
  ↓
TeX 组件渲染
```

---

## 子任务清单（串行执行）

### T2.1 直线方程计算函数 ⏱️ 0.5天

**要做的事**：
1. 新建 `src/engine/math/lineEquation.ts`
2. 实现 `calculateLineEquation(startCoord: Vec3, endCoord: Vec3)` 函数
3. 输入：线段两端点在坐标系下的坐标
4. 输出对象包含：
   - `parametric`：参数方程 LaTeX（`\begin{cases} x = x_0 + at \\ y = y_0 + bt \\ z = z_0 + ct \end{cases}`）
   - `symmetric`：对称式 LaTeX（`\frac{x - x_0}{a} = \frac{y - y_0}{b} = \frac{z - z_0}{c}`）
   - `directionVector`：方向向量 `(a, b, c)` 的 LaTeX
   - `passingPoint`：经过的点坐标 LaTeX
5. 方向向量化简：将 `(a, b, c)` 化为最简整数比（如 `(2, 4, 6)` → `(1, 2, 3)`）
6. 特殊情况处理：
   - 方向向量某分量为 0 时，对称式中该分量写为 `x = x_0`（而非分母为0的分式）
   - 经过原点时简化显示
7. 坐标值格式化：用 `fmtCoord` 风格（整数显示整数，非整数保留1位小数），或复用 symbolic.ts 的精确值

**涉及文件**：
- `src/engine/math/lineEquation.ts` — 新建

**验收**：
- [ ] 方向向量 `(2, 4, 6)` 化简为 `(1, 2, 3)`
- [ ] 经过点 `(1, 0, 2)` 方向 `(1, 2, 3)` 输出正确的参数方程和对称式
- [ ] 方向分量含 0 时对称式正确处理（如方向 `(1, 0, 3)` → `\frac{x-1}{1} = \frac{z-2}{3}, y = 0`）

---

### T2.2 SegmentInspector 扩展 ⏱️ 0.5天

**现状分析**：
- `SegmentInspector.tsx` 当前结构：端点标签 → 长度 → 颜色/虚实样式编辑
- 通过 `usePointPosition(startPoint)` 获取世界坐标
- 坐标系获取：`useEntityStore.getState().getCoordinateSystem()`

**要做的事**：
1. 在 SegmentInspector 中检测坐标系是否存在
2. 若存在坐标系：
   - 从 `CoordinateSystemProperties` 取 `originPointId` 和 `axes`
   - 获取原点世界坐标，计算两端点的坐标系局部坐标
   - 调用 `calculateLineEquation()` 获取方程
   - 在长度下方显示"直线方程"区域，包含：
     - 方向向量显示
     - 参数方程（用 TeX 组件渲染）
     - 对称式（用 TeX 组件渲染）
3. 若不存在坐标系：该区域不显示（或显示"建立坐标系后可查看方程"灰色提示）
4. 样式：方程区域用浅色背景卡片，与现有 Inspector 风格一致

**涉及文件**：
- `src/components/panels/inspectors/SegmentInspector.tsx` — 扩展方程显示

**验收**：
- [ ] 未建坐标系时，选中线段不显示方程区域
- [ ] 建系后选中线段，Inspector 中显示方程
- [ ] 方程 LaTeX 渲染正确（KaTeX 无报错）
- [ ] 棱线和用户线段均可显示方程
- [ ] 坐标系参数变化后（重建坐标系），方程响应式更新
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 执行顺序

```
T2.1 直线方程计算函数
  → T2.2 SegmentInspector 扩展
```

---

## 完成标志

- [x] 所有验收项通过
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 浏览器验收：建系后选中各类线段均可查看方程，LaTeX 渲染正确

---

## 执行总结（2026-03-12）

### T2.1 直线方程计算函数 ✅

**新建文件**：`src/engine/math/lineEquation.ts`
- `calculateLineEquation(startCoord, endCoord)` → 返回 `{ parametric, symmetric, directionVector, passingPoint }`
- 方向向量化简为最简整数比（`simplifyDirection`，支持分数倍如 0.5→整数）
- 对称式特殊处理：方向分量为0时写 `x = x₀`，分母为1时省略分数
- 坐标格式化：`fmtCoord` 整数显示整数，非整数保留1位小数

### T2.2 SegmentInspector 扩展 ✅

**修改文件**：`src/components/panels/inspectors/SegmentInspector.tsx`
- 检测坐标系存在 → 世界坐标转局部坐标（复用 CoordSystemRenderer 的点积逻辑）→ 调用 `calculateLineEquation`
- 有坐标系：显示对称式（16px，`\frac` 紧凑分数）+ 方向向量（12px 辅助信息）
- 无坐标系：显示灰色提示"暂无坐标系，创建坐标系后显示方程"

**UI 迭代决策**：
- 最初方案同时展示参数方程+对称式+方向向量+过点，用户反馈信息过载
- 最终精简为：仅对称式 + 方向向量一行小字，去掉参数方程和过点（对称式中已隐含）

### 额外完成：点拖拽体验优化

开发过程中发现并修复了点拖拽相关的 3 个问题：

**Bug修复：拖拽点时视图跟着动**
- 文件：`src/editor/tools/selectTool.ts`
- 根因：`onPointerDown` 命中 point 时未立即设置 `setIsDragging(true)`，OrbitControls 在阈值内仍响应
- 修复：命中 point 时立即禁用 OrbitControls

**性能优化：拖拽卡顿**
- 文件：`src/components/scene/ToolEventDispatcher.tsx`
- 根因：`pointermove` 触发频率远超屏幕刷新率（120-240Hz），每次都触发 store 更新 + 全量 React 重渲染
- 修复：
  1. RAF 节流 — 每帧最多处理 1 次 pointermove（`requestAnimationFrame` + 缓存最新事件）
  2. Three.js 对象缓存 — `Raycaster`/`Vector2`/`Vector3` 用 `useRef` 复用，减少 GC 压力
  3. transient 拖拽状态 — 新建 `src/editor/store/dragState.ts`，拖拽期间 selectTool 写模块级变量，PointEntityRenderer 通过 `useFrame` 直接移动 mesh（绕过 React），每帧同步一次 store 让线段/面跟着动，松开时提交 undo history

**涉及文件清单**：
| 文件 | 操作 |
|------|------|
| `src/engine/math/lineEquation.ts` | 新建 |
| `src/editor/store/dragState.ts` | 新建 |
| `src/components/panels/inspectors/SegmentInspector.tsx` | 修改 |
| `src/components/scene/ToolEventDispatcher.tsx` | 修改 |
| `src/editor/tools/selectTool.ts` | 修改 |
| `src/components/scene/renderers/PointEntityRenderer.tsx` | 修改 |

### 遗留到 TODO

- T-001 斜角视角下点拖拽不跟手（P2，记录在 `TODO.md`）
