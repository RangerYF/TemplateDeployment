# 自查：P-08 Phase 3

更新时间：2026-04-05

## 1. 磁发散模型

结论：已完成。

- preset 文件：`src/domains/em/presets/magnetic-divergence.json`
- 入口位置：`/#p08` -> `磁场中粒子` -> `磁发散模型`
- 运行逻辑：
  - 4 个带电粒子从同一点出发
  - 初速度分别为 `1.2 / 1.8 / 2.4 / 3.0 m/s`
  - 共用同一匀强磁场和相同 `q/m`
  - 复用现有 `em-charged-particle-in-bfield` 求解器
  - 由 `r = mv / (|q|B)` 得到不同回旋半径，因此轨迹逐渐分散，不会像磁聚焦那样汇聚
- 教学补充：
  - `src/shell/panels/p08SceneSummary.ts` 已对该场景补速度范围和半径范围摘要

## 2. 导线在外磁场中的受力方向动画

结论：已完成。

- 场景文件：`src/domains/em/presets/ampere-force-wire-bfield.json`
- 入口位置：`/#p08` -> `静磁场` -> `安培力演示·导线在外磁场中受力`
- 方向显示位置：
  - 电流方向：`current-wire` 实体自身的红色电流箭头
  - 磁场方向：`uniform-bfield` 实体的 `· / ×` 阵列与场强标签
  - 安培力方向：`src/domains/em/viewports/field-viewport.ts` 中新增的紫色安培力箭头和标签
- 动画体现方式：
  - 安培力箭头长度按时间做脉冲变化
  - 同时绘制沿受力方向移动的半透明导线虚影
  - 两者都在 `field viewport` 中按 `performance.now()` 周期更新，不依赖新增 solver
- 教学补充：
  - `src/shell/panels/p08SceneSummary.ts` 已补 `F = BIL`、电流方向、磁场方向、受力方向摘要

## 3. 静电场 / 重力场中的圆周运动

结论：未完成。

- 阻塞点：
  - 当前 P-08 架构已有电场、磁场、复合场粒子求解，但没有“带电小球在竖直面内同时受重力和约束”的现成实体与求解链
  - 若硬补，至少会引入重力、约束/轨道或绳杆模型，超出本轮“优先复用现有 P-08 内核、交付最小可教学闭环”的边界
- 本轮处理：
  - 明确标记未完成，避免交付物理意义不清的拼装版

## 4. 平移圆模型 / 旋转圆模型

结论：未完成，需产品确认。

- 当前已存在的相关预设：
  - `src/domains/em/presets/bfield-dual-boundary.json`
  - `src/domains/em/presets/bfield-semicircle.json`
- 本轮判断：
  - 现有命名和几何语义还不足以严谨承接“平移圆模型 / 旋转圆模型”这两个产品术语
  - 为避免误报完成，本轮没有强行重命名或硬凑新模型

## 5. 对已有 P-08 场景的影响

结论：未发现破坏性影响。

- 未改动已有 preset id，新增能力全部通过新 preset 接入
- `磁聚焦`、边界磁场、复合场等原有场景保留原入口
- `field-viewport` 中新增的安培力动画有显式保护条件：
  - 仅在 `current-wire + uniform-bfield + 无 point-charge` 的场景触发
  - 不会覆盖已有带电粒子磁场场景

## 6. 对其他模块的影响

结论：未影响其他模块。

- 未修改 P-04 电路搭建逻辑
- 未扩展 P-13 电磁感应
- 改动集中在 P-08 预设注册、P-08 摘要层和 `field viewport`

## 7. 构建验证

结论：已执行并通过。

- 执行命令：`pnpm build`
- 结果：
  - `tsc --noEmit` 通过
  - `vite build` 通过
  - 产物正常输出到 `dist/`
- 备注：
  - 仍有 Vite 的大包体积 warning，但不影响本轮 Phase 3 功能构建通过
