# V0.4 阶段1：Bug修复 + 视觉优化

> **阶段目标**：修复参数滑轮无法调节的Bug，优化外接球视觉效果
> **预计耗时**：1-2 天
> **前置条件**：V0.3 全部完成
> **BACKLOG 覆盖**：F01, F02
> **状态**：✅ 已完成
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.4/PROGRESSIVE-PLAN.md`
> - 功能清单：`.tasks/active/v0.4/BACKLOG.md`
> - 子任务：`.tasks/active/v0.4/stage-1.1-sides-slider-glitch.md`（已完成）

---

## 完成摘要

### T1.1 参数滑块排查与修复 ✅

**修复内容**：
1. **Slider 组件可点击区域**：range input 高度从 `h-2`（8px）→ `h-5`（20px），覆盖 thumb 可视区域
2. **Slider 拖拽值追踪**：内部用 ref 追踪拖拽中的 commit 值，防止受控输入值弹回（解决 sides 等拓扑参数滑块无法拖动的根因）
3. **棱锥侧棱长范围**：max 从静态 15 改为 `max(15, R+5)` 动态计算，确保有效滑动范围充足
4. **拓扑参数实时重建**：sides 变化时在 `handleSliderChange` 中同步调用 `getBuilderResult` + `rebuildBuiltInEntities`，拖拽过程中几何体正确重建，无线条错乱

**修改文件**：
- `src/components/ui/slider.tsx` — 可点击区域扩大 + ref 追踪拖拽值
- `src/components/panels/ParameterPanel.tsx` — 拓扑变化实时重建 + 棱锥动态 max

**验收**：
- [x] 棱锥：sideLength=10 时，侧棱长滑块仍可流畅拖动
- [x] 棱锥：sides 在 3~8 间切换时，几何体实时正确重建
- [x] 棱台/棱柱：sides 滑块可正常拖动，几何体实时重建
- [x] 所有 13 种几何体的参数滑块均可正常拖动
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

---

### T1.2 外接球视觉优化 ✅

**修复内容**：
- 去掉 `SphereGeometry` + `wireframe`（密集三角网格），改为 3 条正交大圆（`LineLoop`），教科书风格
- 颜色 `#7c3aed`（中紫），opacity 0.7，`depthWrite=false`
- 64段平滑圆弧，球形辨识度高且不遮挡几何体

**修改文件**：
- `src/components/scene/renderers/CircumSphereRenderer.tsx` — 大圆线框方案

**验收**：
- [x] 外接球视觉清爽，仅3条大圆线
- [x] 线条清晰可辨，不遮挡几何体主体
- [x] 仍可识别为球体（空间感保留）
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
