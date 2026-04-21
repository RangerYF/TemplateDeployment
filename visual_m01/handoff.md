## Original Goal

为高中数学老师构建"立体几何展示台"V1.0——浏览器端 3D 几何体可视化工具，支持 6 种几何体（长方体/正方体/棱锥/圆锥/圆柱/球）的参数化建模、标注交互、数学计算、高级功能（截面/展开图/三视图）。技术栈：React 19 + TypeScript + Vite + Three.js + R3F + Zustand + Tailwind CSS。

## Current Subtask

**阶段 6: 体验打磨与适配** — 任务文档已创建，待执行

**任务文档**：`.tasks/active/init/6-体验打磨与适配.md`
**风险等级**：L1
**子任务数**：8 个（T6.1 ~ T6.8），其中 T6.4 拆为独立子任务文档

**整体进度**：
- [x] 阶段 1~5B 全部完成 ✅
- [ ] 阶段 6: 体验打磨与适配 🔄

**子任务清单**：
- [ ] T6.1: 修复外接球 UI 限制（`sphereAvailable` 放开 pyramid/cone/cylinder）
- [ ] T6.2: 3D 场景默认视角下移（几何体视觉居中）
- [ ] T6.3: 标注工具默认展开（`defaultOpen={true}`）
- [ ] T6.4: 自定义线段/截面交互优化 — 详见 `6.4-交互优化.md`（6 个子任务）
- [ ] T6.5: 视角快捷按钮（重置/正视/俯视/侧视）
- [ ] T6.6: 触屏适配（单指旋转、双指缩放）
- [ ] T6.7: UI 细节打磨（字体/间距/触摸区域）
- [ ] T6.8: 回归验证

**已发现的遗漏 bug**：
- 外接球：`circumscribedSphere.ts` 已实现 pyramid/cone/cylinder，但 UI `sphereAvailable` 仅允许 cuboid/cube
- 球截面：`sphereCrossSection.ts` 已实现，但 UI `crossSectionAvailable` 仅检查 polyhedron，球体按钮被禁用
- 几何体切换：`setType()` 不清理 drawingMode/crossSectionPoints/customSegments

## Key Decisions

- **截面策略**：多面体用 `crossSection.ts`，球用 `sphereCrossSection.ts`。圆锥/圆柱截面需曲面求交算法，V1 不纳入
- **DrawingMode**：`'none' | 'segment' | 'crossSection'`，工具栏模式切换
- **三栏布局**：3D场景 | 展开图+三视图 | 右侧面板(280px)
- **3D 场景教材风格**：棱线黑色 `#1a1a1a`，面透明灰色 `#9ca3af` opacity 0.12
- **三视图布局**：标准工程制图（正视左上 + 侧视右上 + 俯视左下），SCALE_BASE=60
- **PNG导出**：viewBox 原始宽高 + 最小 1200px 长边，克隆 SVG 时清除 CSS transform
- **R3F Html 覆盖层**：`createPortal(…, document.body)` + z-index ≥ 99999999
- **相机默认位置**：`[4, 3, 4]`，FOV 50，target 默认 `[0, 0, 0]`
- **OrbitControls**：左键旋转、中键平移、右键禁用（用于右键菜单）

## Constraints

- Git 提交必须 `--author="cjn <1229412289@qq.com>"`
- 回复中文，以 `Sir` 开头，声明 `[MODE: 模式名称]`
- 修改 `src/` 后执行 `pnpm lint && pnpm tsc --noEmit`
- 修改 `src/engine/` 数学计算时追加手算验证
- 遵循 RIPER-7 流程（`.tasks/` 文档驱动），详见 `CLAUDE.md`

## Dead Ends

- **右手系强制修正**：已移除，教学场景不需要
- **R3F Html z-index**：必须 createPortal + z-index 99999999
- **react-katex**：改用自封装 TeX 组件
- **棱锥复用长方体坐标系**：改独立函数 + Gram-Schmidt
- **展开图 Dialog 弹窗**：改三栏内联面板
- **SVG strokeWidth 用 viewBox 单位**：改 vectorEffect non-scaling-stroke
- **PNG导出用 getBoundingClientRect**：改 viewBox 原始宽高
- **PNG导出直接用 viewBox 值做像素尺寸**：改最小 1200px 长边
- **PNG导出未清除 CSS transform**：需清除
- **棱锥三视图遍历所有侧棱画虚线**：仅画不与轮廓重合的虚线

## Relevant Files

**阶段 6 将修改**：
- `src/components/panels/AuxiliaryTools.tsx` — 外接球限制修复 + 截面可用性修复
- `src/components/scene/Scene3D.tsx` — 默认视角 + 触屏适配 + 集成 ViewControls
- `src/components/layout/LeftPanel.tsx` — 标注工具默认展开
- `src/store/useGeometryStore.ts` — 切换清理逻辑
- `src/hooks/useInteraction.ts` — Escape 键监听
- `src/components/scene/VertexLabels.tsx` — 起点高亮

**阶段 6 将新增**：
- `src/components/scene/ViewControls.tsx` — 视角快捷按钮
- `src/components/scene/DrawingModeBar.tsx` — 绘制模式提示条

**核心已有文件**：
- `src/engine/types.ts` — BuilderResult (PolyhedronResult / SurfaceResult)
- `src/types/geometry.ts` — GeometryType + 参数类型
- `src/engine/math/circumscribedSphere.ts` — 外接球（已支持 5 种，UI 仅开放 2 种）
- `src/engine/math/sphereCrossSection.ts` — 球截面（已实现，UI 按钮被禁用）

**任务文档**：
- `.tasks/active/init/PROGRESSIVE-PLAN.md` — 主计划
- `.tasks/active/init/6-体验打磨与适配.md` — 阶段 6 主任务（8 个子任务）
- `.tasks/active/init/6.4-交互优化.md` — T6.4 独立子任务（6 个子任务）

## Expected Outcome

阶段 6 完成后，产品达到可交付老师使用的品质：外接球/截面功能覆盖完整、3D 视角合理、交互直观、触屏可用、UI 清晰。V1.0 交付。
