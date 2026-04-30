# P-13 Phase 1 基座说明

## 本阶段做了什么

- 新增 `#p13` 独立入口页，当前用于承接电磁感应模块说明、现有可用模型和后续模型预留位。
- 将现有 `矩形线框·穿过匀强磁场` 预设的分类从 `P-02` 调整为 `P-13`，但保留原 preset id，降低兼容风险。
- 把原来散落在 `wire-frame-induction.ts` 中的通用感应计算整理为 P-13 核心层：
  - 磁通量计算
  - 感应电动势计算
  - 感应电流计算
  - 安培力计算
- 保持现有 Phase 1 物理行为不升级：
  - 线框仍按匀速运动
  - 安培力仍只做标注，不反作用到速度

## 新的 P-13 基座结构

- `src/domains/em/p13/types.ts`
  - P-13 模型 key
  - 匀强磁场区域、矩形线框快照、磁通量样本、安培力样本、runtime snapshot
- `src/domains/em/p13/core.ts`
  - `extractUniformBFieldRegions`
  - `createRectangularLoopSnapshot`
  - `computeRectangularLoopFlux`
  - `computeInducedEmf`
  - `computeInducedCurrent`
  - `computeAmpereForceFromMotion`
  - `computeRectangularLoopInductionStep`
- `src/domains/em/logic/flux-calculator.ts`
  - 保留兼容门面，内部转调新的 P-13 核心层
- `src/domains/em/solvers/wire-frame-induction.ts`
  - 只负责场景推进、runtime 回写和 ForceAnalysis 输出

## 当前样例如何接入

- 现有预设仍使用 `wire-frame` + `uniform-bfield`。
- solver 每帧会把结果继续写回原有字段：
  - `emf`
  - `current`
  - `flux`
- 同时新增运行时快照：
  - `entity.properties.inductionRuntime`

## Phase 2 / 3 承接点

- Phase 2
  - 在 `src/domains/em/p13/` 下新增磁棒-线圈、单棒模型适配层
  - 复用核心层的 `computeInducedEmf / computeInducedCurrent / computeAmpereForceFromMotion`
  - 如需多匝线圈，只在模型层补 `turns` 和几何面积，不要回退到 solver 内部硬编码
- Phase 3
  - 在模型层加入动力学耦合与终态分析
  - 将 `inductionRuntime` 扩展到终态量、过程标注、图像联动数据
  - 如需 builder，单独新增 P-13 builder 路径，不要挤进现有 P-08 builder 结构
