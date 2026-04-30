# 自查：P-08 Phase 5

更新时间：2026-04-05

## 1. `静电场 / 重力场中的圆周运动` 是否已完成

结论：已完成。

- preset：
  - 名称：`静电场 / 重力场圆周运动临界`
  - 文件：`src/domains/em/presets/electrogravity-circular-motion.json`
  - id：`P02-EMF044-electrogravity-circular-motion`
- 入口：
  - `/#p08` -> `复合场` -> `静电场 / 重力场圆周运动临界`
- 核心参数：
  - `圆轨道半径 R`
  - `底端初速度 v0`
  - `荷质比 q/m`
  - `电场强度 E`
  - `电场方向`
- 核心公式和结果展示：
  - 公式：
    - `g_eff = g ± qE/m`
    - `v顶临界 = √(g_eff R)`
    - `v底临界 = √(5g_eff R)`
  - 结果展示位置：
    - `P08ResultOverlay` 右下角实时结果区
    - `InfoPanel` 的 P-08 课堂速览
    - `FieldInfoCards` 左下角课堂提示
  - 已展示的核心结果：
    - `底端初速度 v0`
    - `等效重力 g_eff`
    - `顶端临界速度`
    - `底端临界速度`
    - `当前张力 / 支持力`
    - `判定`
- 实现说明：
  - 新增最小求解器：`src/domains/em/solvers/electrogravity-circular-motion.ts`
  - 新增共享逻辑：`src/domains/em/logic/electrogravity-circular-motion.ts`
  - 新场景不是占位页，而是带真实参数、圆轨道导引、受力分析、临界脱轨判定与脱离后类斜抛过程的可讲解模型。

## 2. `平移圆模型 / 旋转圆模型` 是否已被最终解决

结论：已最终解决；本轮选择新增独立场景，不再维持“待确认”。

- 处理方式：
  - 没有把它们硬映射到现有 `双边界磁场` 或 `半圆边界磁场`。
  - 本轮直接补了两个独立 preset，并继续复用现有 `em-charged-particle-in-bfield` 求解器。
- 新增场景：
  - `平移圆模型`
    - 文件：`src/domains/em/presets/bfield-translation-circle.json`
    - id：`P02-EMF037-translation-circle`
    - 入口：`/#p08` -> `带电粒子在磁场中` -> `平移圆模型`
    - 语义：同速度、同荷质比、不同入射点，形成等半径平移圆轨迹族
  - `旋转圆模型`
    - 文件：`src/domains/em/presets/bfield-rotation-circle.json`
    - id：`P02-EMF038-rotation-circle`
    - 入口：`/#p08` -> `带电粒子在磁场中` -> `旋转圆模型`
    - 语义：同一点、同速度、不同入射角，形成等半径旋转圆轨迹族
- 配套处理：
  - `src/shell/pages/p08PresetCatalog.ts`
  - `src/shell/pages/P08FieldMagnetHome.tsx`
  - `src/shell/panels/p08SceneSummary.ts`
  - 验收文档、体验文档、状态梳理都已同步改成“已交付”口径

## 3. 是否更新了验收文档

结论：已更新。

- 文件：`docs/验收清单-P08电场与磁场可视化.md`
- 已补：
  - `平移圆模型`
  - `旋转圆模型`
  - `静电场 / 重力场圆周运动临界`

## 4. 是否更新了体验文档

结论：已更新。

- 文件：`docs/体验文档-P08电场与磁场可视化.md`
- 已去掉：
  - `平移圆模型 / 旋转圆模型` 的“待确认”口径
  - `静电场 / 重力场中的圆周运动` 的“尚未实现”口径
- 已补充：
  - 新场景的课堂用途
  - 新场景的对外可说明口径

## 5. 是否影响已有 P-08 场景入口和运行

结论：未发现破坏性影响。

- `/#p08` 入口保留不变。
- 原有 preset id 未改动。
- 新场景通过新增 preset 接入，不覆盖旧场景。
- 已执行构建验证，现有 P-08 场景仍可正常构建。

## 6. 是否影响其他模块

结论：未影响其他模块。

- 未改 P-04。
- 未扩到 P-13。
- 改动集中在：
  - P-08 preset 注册
  - 一个最小新 solver
  - P-08 首页 / 摘要 / 信息面板适配
  - P-08 验收与体验文档

## 7. 构建验证结果

结论：已执行并通过。

- 执行命令：`pnpm build`
- 结果：
  - `tsc --noEmit` 通过
  - `vite build` 通过
  - `dist/` 正常输出
- 备注：
  - 仍有 Vite 的 chunk size warning，但不影响本轮 Phase 5 交付
