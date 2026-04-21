# V0.4 阶段1.1：底面边数滑块拖拽时线条错乱

> **任务ID**：03-12-16-sides-slider-glitch
> **风险等级**：L1（常规风险，1-2文件改动，UI逻辑修复）
> **流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> **前置条件**：阶段1基础修复已完成
> **状态**：✅ 已完成

---

## 问题描述

拖拽棱锥/棱台/棱柱的「底面边数」滑块时，参数实时更新到 store（sides 值变化），但 builder 未重建拓扑（顶点/边/面数量不匹配新的 sides），导致渲染器用旧拓扑结构去渲染新参数，出现错乱线条。松手后 `handleSliderCommit` 执行完整拓扑重建，几何体恢复正常。

**用户原文**：「实时更新的时候，很多时候显示的是一些乱的线，松手才恢复正常」

## 根因分析

阶段1修复中，为解决 sides 滑块无法拖动的问题，去掉了 `handleSliderChange` 中 `isTopologyChange → return` 的提前返回，使 sides 变化也实时更新 store params。但 sides 是拓扑参数——改变它意味着顶点/边/面数量变化，必须重建 builder 才能得到正确的几何结构。仅更新 params 而不重建 builder，渲染器会用错误的拓扑数据渲染。

## 解决方案（最终实施）

**方案**：拓扑变化参数（sides）拖拽时，在 `handleSliderChange` / `handleSliderChangeSynced` 中同步调用 `getBuilderResult` + `rebuildBuiltInEntities` 实时重建几何体，使拖拽过程中几何体始终正确。

具体改动：
1. `ParameterPanel.tsx`：`handleSliderChange` / `handleSliderChangeSynced` 中检测拓扑变化，若命中则在更新 params 后立即调用 `getBuilderResult` 获取新 BuilderResult，再调用 `store.rebuildBuiltInEntities` 实时重建
2. `ParameterPanel.tsx`：移除棱台/圆台的动态 min/max 范围调整（修复附带 bug：相邻滑块 thumb 跳动 + 填充条长度失真）

## 附带修复：棱台/圆台滑块跳动

**问题**：棱台拖拽上底边长时，下底边长滑块 thumb 跳动且填充条比例失真。
**根因**：`displayFields` 用实时 params 动态计算互相约束参数的 min/max。拖拽时 min/max 变化导致 `percentage = (value - min) / (max - min)` 改变，未被拖拽的滑块 thumb 跟着跳；范围被压缩也导致填充条长度失真。
**修复**：移除棱台和圆台的动态 min/max，恢复 PARAM_FIELDS 静态范围。builder 不依赖此约束。棱锥侧棱长的动态范围（基于几何约束 R）保留。

## 涉及文件

- `src/components/panels/ParameterPanel.tsx` — 拓扑变化实时重建 + 移除动态 min/max

## 验收标准

- [x] 拖拽 sides 滑块时，thumb 跟随手指移动，几何体实时正确重建
- [x] 拖拽过程中不出现错乱线条
- [x] 松手后几何体正确重建为新的边数
- [x] 非拓扑参数（长/宽/高/半径等）拖拽时仍实时更新几何体
- [x] 棱台/圆台拖拽参数时，相邻滑块不再跳动
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
