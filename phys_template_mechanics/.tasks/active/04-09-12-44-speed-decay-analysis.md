# [任务-04-09-12-44] 部分实验速度衰减归因分析

**创建时间**: 2026-04-09 12:44
**状态**: 已完成（2026-04-09）
**优先级**: 高

## 需求来源
用户要求进入研究模式，处理“部分实验运行中速度存在衰减，例如竖直圆周运动”的问题；本轮禁止修改业务代码，只做真实代码与真实样本基础上的归因分析，并给出执行前结论。

## 目标与范围
**主要目标**: 基于真实模板样本与实现代码，分析速度衰减可能来自模板参数、引擎数值/约束求解、采样与显示链路中的哪一层，并输出后续最小改动建议。
**范围**:
- `src/templates/presets/p01-force-analysis/fm-043.json`
- `src/templates/presets/p01-force-analysis/fm-044.json`
- `src/templates/presets/p02-motion/mot-033.json`
- `src/engine/PhysicsBridge.ts`
- `src/engine/sceneSync.ts`
- `src/templates/commands/validator.ts`
- `src/components/Canvas.tsx`
- `src/components/charts/TimeSeriesChart.tsx`
- `src/store/analysisStore.ts`
**不包括**:
- 不修改业务代码
- 不提交修复实现
- 不做未证实结论的拍脑袋推断

## 关键约束
- 用户显式指定当前为 MODE 1 研究模式。
- 必须基于真实数据样本核对字段名、类型、嵌套层级。
- 本轮仅输出“归因报告 + 后续改动建议”，不得直接给修复代码。
- 最终结论需引用文件路径和关键行附近位置。

## 架构影响评估
本任务属于现有模板与仿真链路的归因分析，横跨模板 JSON、模板校验、Planck 桥接、场景同步、Canvas 仿真循环、分析数据与图表展示链路。若后续进入执行，预计会影响仿真真值链路与观测链路的一致性校验。

## 关键决策记录
- 决策1：本轮按新任务立项，而不是并入现有活跃文档。理由：现有 `.tasks/active/` 中无与“速度衰减归因”直接对应的任务文档。
- 决策2：风险等级判定为 L2。理由：涉及模板数据读取/字段核对、跨模块联动（模板→引擎→分析/图表），且需要数据契约校验。
- 决策3：流程路径采用 `MODE 0 -> MODE 1`。理由：用户显式要求进入研究模式，且本轮不执行改动。
- 决策4：本轮不运行代码修改类验证，仅做只读归因；若证据不足，明确列出后续最小实测需求。

## 执行计划
1. 读取知识库与任务评估规则，完成 MODE 0 记录。
2. 核对三个目标模板的真实结构与关键参数。
3. 逐个检查 PhysicsBridge / sceneSync / validator / Canvas / TimeSeriesChart / analysisStore 的相关链路。
4. 汇总“模板参数层 / 引擎层 / 观测层”的已证实问题与待验证问题。
5. 输出研究结论与后续最小改动建议，不给修复代码。

## 当前进展
已完成真实运行与控制实验，当前结论更新如下：
- 已用临时诊断脚本 `/tmp/vertical_decay_diag.mjs` 直接复用真实 `PhysicsBridge + sceneSync` 跑完 `FM-043 / FM-044 / MOT-033`，导出逐帧结果到 `/tmp/vertical_decay_results.json`。
- 三个样本在 `public/templates/scenes/*.json` 中的 `gravity / friction / restitution / initialVelocity / joint length` 与 preset 一致，未发现模板资产漂移。
- 已证实“上升阶段速度下降”与“逐圈额外衰减”是两个不同问题：
  - 同一圈内从底点到顶点减速，属于重力势能上升的教学预期。
  - 但三组样本都存在额外的逐圈峰值下降，且并非 UI 误读。
- solver 迭代从 `8/3 -> 16/6 -> 32/12` 的对照结果在机器精度内几乎完全一致：
  - `FM-043` 最大位置差 `7.06e-14 m`
  - `FM-044` 最大速度差 `1.51e-14 m/s`
  - `MOT-033` 最大机械能差 `1.04e-12 J`
  - 结论：本问题不随 solver 迭代提高而收敛，`8/3` 不是主因。
- `FM-044`（杆）在无 slack、joint length error 近似 0 的情况下，仍出现明显机械能下降：
  - 1 秒内机械能漂移 `-3.69%`
  - 6 秒内机械能漂移 `-13.81%`
  - 首次回到底点速度 `8.553 -> 7.646 m/s`
  - 这说明“额外衰减”在 rod 样本中客观存在，不能归咎于 rope slack。
- 进一步控制实验：
  - 去掉 joint、保留重力与球（且移除 ground 防碰撞）时，1 秒机械能漂移仅 `-0.72%`，远小于 rod 的 `-3.69%`。
  - 将 `FM-043 / FM-044` 的重力临时设为 `0` 后，rope / rod 在无 slack 条件下 3 秒仍分别损失 `63.98% / 58.69%` 的机械能。
  - 结论：主要来源是 joint 约束数值耗散，而不是重力势能换算、碰撞或 UI 读图错误。
- `MOT-033` 的模板参数问题也被实测证实会放大现象：
  - 原始 `v0 = 9.8 m/s`，rope slack 占比 `26.0%`，最大 slack 深度 `1.758 m`，第二次底点速度仅 `1.200 m/s`。
  - 仅把初速度提高到 `1.05x / 1.10x` 时，slack 占比分别降到 `16.3% / 15.2%`，最大 slack 深度降到 `1.247 / 0.813 m`，第二次底点速度升到 `3.908 / 6.003 m/s`。
  - 但即便提高初速，机械能漂移仍有 `-36.53% / -32.57%`，说明模板参数是放大器，不是根因。
- 观测链路确有信息缺口：
  - 当前 `AnalysisRecorder` 只记录 `speed / ek / epGravity / displacement` 等量，没有 `joint error / rope slack / per-cycle bottom-top peaks`。
  - 因此用户很难把“正常上升减速”和“额外逐圈衰减”拆开判断。

## 计划模式续作（2026-04-09）
- 用户新增原文：进入计划模式，处理“rope/rod joint 导致的额外数值耗散”这个高风险引擎问题；本轮只给技术方案，不直接改代码。
- 规则裁决：`用户显式指令 > 风险分级自动流转 > 当前模式默认路径`。
- 风险等级维持 `L2`：
  - 命中原因：跨 `PhysicsBridge / jointTypes / Canvas / AnalysisRecorder` 多模块联动，且验收必须依赖真实样本与真实诊断量。
  - 当前流程路径更新为：`MODE 0 -> MODE 1(已完成) -> MODE 3`。

### 本轮补充核对
1. 当前代码已经具备诊断量，不再需要把“补 eMech / jointError / ropeSlack / bottom-top peaks”作为本轮主任务。
   - `src/engine/AnalysisRecorder.ts` 已记录上述字段。
   - `src/store/analysisStore.ts` 已暴露对应诊断标签页。
2. `FM-043 / FM-044 / MOT-033` 当前真实模板参数已核对：
   - 重力统一为 `g = 10`
   - 约束长度分别为 `1.6 / 1.6 / 1.8`
   - 初速度已处于最近一次模板修正后的值
3. 当前物理真值链路仍是：
   - `Canvas` 固定 `dt = 1/60`
   - `PhysicsBridge.step(dt)` 直接调用 `world.step(dt, 8, 3)`
   - rope 使用 `RopeJoint(maxLength)`
   - rod 使用 `DistanceJoint(length, frequencyHz=0, dampingRatio=0)`

### 新增只读实验：子步进敏感性验证
- 实验方式：不改业务代码，仅临时复用 `PhysicsBridge + sceneSync`，保持总步长 `1/60` 不变，把每帧拆成 `1 / 2 / 4 / 8` 个子步，比较 6 秒机械能终值漂移。
- 结果摘要：
  - `FM-043`：`1x -35.30% -> 4x -13.35% -> 8x -6.37%`
  - `FM-044`：`1x -15.42% -> 4x -5.26% -> 8x -3.61%`
  - `MOT-033`：`1x -36.59% -> 4x -9.75% -> 8x -6.11%`
  - rope slack / max slack 也同步下降：
    - `FM-043` 最大 slack `1.2239m -> 0.2625m -> 0`
    - `MOT-033` 最大 slack `1.2325m -> 0.2219m -> 0`
- 阶段性结论：
  1. “减小有效步长”对降低数值耗散非常有效，说明问题不仅是 solver 迭代数，而是 **joint 建模 + 离散步进精度** 的组合误差。
  2. 步进策略具备成为主方案的资格，至少应作为第一优先级的低侵入验证方向。
  3. bridge 层约束投影/速度修正仍有必要保留为第二阶段方案，用于进一步压缩 `FM-044` 这类“无 slack 但仍掉能”的残余误差。

### 计划阶段结论（用于后续执行）
1. 推荐主路径：
   - 先做 **scene-aware substepping（仅 rope/rod 场景）**
   - 再视结果决定是否追加 **bridge 层 post-step constraint stabilization**
2. 暂不推荐把“joint 建模替换”为首选实施路径：
   - 需要改动更多接口与受力归因链路
   - 对模板、图表、回放和 ForceCollector 的兼容风险最高
3. `FM-043 / FM-044 / MOT-033` 继续作为第一批验收样本，不在本轮计划中再改模板参数。

## 执行记录（2026-04-09，本轮完成）
- 用户新增原文：`把整个任务完成`
- 规则裁决：`用户显式指令 > 风险分级自动流转 > 当前模式默认路径`
- 实际执行路径：`MODE 0 -> MODE 1 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6`

### 本轮代码改动
1. `src/engine/PhysicsBridge.ts`
   - 新增 `stepFrame(scene, dt)`，把“beginFrame + 连续外力施加 + scene-aware substepping”收敛为统一整帧推进入口。
   - 子步策略改为：
     - rope 场景 `8x`
     - rod-only 场景 `4x`
     - 其他场景 `1x`
   - `probeForces()` 改为复用 `stepFrame()`，避免编辑态探测与仿真主循环走两套步进逻辑。
2. `src/components/Canvas.tsx`
   - 仿真主循环改为调用 `physicsBridge.stepFrame(currentScene, dt)`。
   - 不再在 `Canvas` 外层手动拆散 `applyExternalForces / beginForceFrame / step`。
3. `scripts/check-joint-dissipation.mjs`
   - 新增仓库内验收脚本，固定以 `FM-043 / FM-044 / MOT-033` 为样本，输出：
     - `endDriftPct`
     - `maxAbsJointError`
     - `slackFrameRatioPct`
     - `maxSlackDepth`
     - `bottomRetentionPct`
   - 直接给出 pass/fail，并作为后续回归门禁复用。
4. `package.json`
   - 新增 `pnpm run check:joint-dissipation`。

### 验证结果
- `pnpm run check:joint-dissipation`：通过
  - `FM-043`：`endDriftPct=-6.37%`，`slackFrameRatioPct=0%`，`bottomRetentionPct=97.76%`
  - `FM-044`：`endDriftPct=-5.26%`，`slackFrameRatioPct=0%`，`bottomRetentionPct=96.67%`
  - `MOT-033`：`endDriftPct=-6.11%`，`slackFrameRatioPct=0%`，`bottomRetentionPct=97.89%`
- `pnpm lint`：通过
- `pnpm tsc --noEmit`：通过

### 结果判定
1. `FM-043 / FM-044 / MOT-033` 的 mechanical energy drift 均明显下降，且全部落入本轮验收阈值。
2. rope 样本 `ropeSlack` 从之前的显著占比下降到 `0%`。
3. `jointError` 保持在机器精度量级，没有出现“压掉 slack 但放大长度误差”的副作用。
4. 回放、图表和现有模板数据结构均无需迁移，本轮修复限定在桥接层与验证脚本。

## 交付DoD
- 变更摘要
  - 完成 rope/rod joint 数值耗散主修复，采用 scene-aware substepping 方案。
  - 完成仓库内耗散验收脚本沉淀，后续可重复验证。
- 验证结果（命令 + 结果 + 跳过原因）
  - `pnpm run check:joint-dissipation`：通过
  - `pnpm lint`：通过
  - `pnpm tsc --noEmit`：通过
  - 无跳过项
- 风险与回滚
  - 风险：rope 场景 `8x`、rod 场景 `4x` 会增加仿真 CPU 成本。
  - 回滚：若后续发现性能不可接受，可仅回退 `PhysicsBridge.getRecommendedSubsteps()` 的倍率，不影响模板/图表/schema。
  - 本轮未引入模板 JSON 迁移、未引入新的 joint schema 字段，回滚面较小。
- 任务完成质量模块（bug/文档/规则/根因/改进）
  - bug：已修复
  - 文档：已补任务文档与执行证据
  - 规则：符合“高风险先研究再计划再执行”的流转
  - 根因：确认主因是 joint 建模与离散步进组合带来的数值耗散，不是 solver iterations
  - 改进：若未来出现更复杂多体 rope/rod 场景，再评估是否追加 bridge stabilization 或更换 joint 建模
- 审查结论（匹配/偏离计划）
  - `:white_check_mark: 实现完全匹配计划`

## 对后续任务的影响
- **新约束**: 本轮禁止修改业务代码；所有结论必须给出真实文件证据。
- **依赖变更**: 无
- **必看文件**: `.knowledge/architecture.md`、`.knowledge/pitfalls.md`、`src/engine/PhysicsBridge.ts`、`src/components/Canvas.tsx`
- **复用结论**: 速度衰减问题需拆成“真值链路”和“观测链路”两条并行分析，不可混为一谈。
- **未决风险**: 若仅凭静态代码无法定位，需要补充单模板运行日志或 frame 级采样数据。

## 遗留问题
- 已证实存在“逐圈峰值持续下降”的额外能量损失。
- 待后续执行阶段决定是否：
  - 给分析链路补充 `joint error / rope slack / bottom-top peak` 诊断量；
  - 评估是否需要替换 rope/rod 的建模方式，或对 joint 场景增加数值补偿/教学说明；
  - 将 solver 参数从可疑项降级为“非主因”。

## 用户对话记录
### 第1轮 [2026-04-09 12:44] - 研究模式
**用户原文**: 进入研究模式，处理“部分实验运行中速度存在衰减，例如竖直圆周运动”的问题，但本轮先不要修改业务代码，只做归因分析和执行前结论。

已知背景：
1. 重点样本先看：
   - src/templates/presets/p01-force-analysis/fm-043.json
   - src/templates/presets/p01-force-analysis/fm-044.json
   - src/templates/presets/p02-motion/mot-033.json
2. 相关实现重点检查：
   - src/engine/PhysicsBridge.ts
   - src/engine/sceneSync.ts
   - src/templates/commands/validator.ts
   - src/components/Canvas.tsx
   - src/components/charts/TimeSeriesChart.tsx
   - src/store/analysisStore.ts
3. 当前模板里重力仍有 9.8，竖直圆周模板已经显式写了初速度，但用户反馈运行中仍观察到速度衰减。

你的任务：
1. 基于真实代码，分析“速度衰减”可能来自哪些层面：
   - 模板参数设置问题
   - 引擎数值耗散/约束求解问题
   - 采样、图表或显示链路导致的观测偏差
2. 以 FM-043、FM-044、MOT-033 为首批样本，逐个核对：
   - gravity
   - friction / restitution
   - joint 类型与长度
   - initialVelocity 是否满足教学预期
   - 是否存在会导致能量损失或闭环不稳的隐性参数
3. 说明 Planck step(8,3)、rope/rod 对应 joint 配置、initialVelocity 注入方式，是否可能导致非预期衰减。
4. 不要直接给修复代码，先输出“归因报告 + 后续改动建议”。

输出要求：
1. 先给结论摘要。
2. 然后按样本分别分析 FM-043 / FM-044 / MOT-033。
3. 最后给出归因分类表：
   - 确认存在的问题
   - 暂未证实但需要实测的问题
   - 下一步最小修改建议
4. 如果证据不足，要明确指出缺什么验证，而不是猜测。
5. 引用文件路径和关键行附近位置。
**关键要点**:
- 显式进入研究模式
- 禁止修改业务代码
- 重点关注三个模板样本和六个实现文件
- 归因需覆盖模板参数、引擎约束/数值、采样显示链路
- 最终必须给出执行前结论与证据引用

### 第2轮 [2026-04-09] - 研究模式续作
**用户原文**: 进入研究模式，继续处理“部分实验运行中是否存在逐圈额外速度衰减”的问题。

本轮目标：
不是修复代码，而是拿到足够证据，判断“额外衰减”是否真实存在、主要来自哪里。

硬性约束：
1. 优先不改业务代码。
2. 如必须补诊断能力，只允许最小化临时调试手段，不得顺手改业务逻辑。
3. 本轮输出必须基于真实运行结果，不要只做静态推断。

已知前置结论：
1. FM-043、FM-044、MOT-033 都是在最低点一次性注入初速度，之后没有持续驱动，所以“上升阶段速度下降”本身是物理预期。
2. 目前尚未证实的问题是：是否存在超出教学预期的“逐圈额外衰减”。
3. 优先怀疑对象：
   - RopeJoint / DistanceJoint 的数值近似
   - step(1/60, 8, 3) 的求解精度
   - MOT-033 初速安全余量偏小
   - 观测链路是否缺少足够直观的诊断量

本轮新增实测记录：
- 真实样本：
  - `public/templates/scenes/FM-043.json`
  - `public/templates/scenes/FM-044.json`
  - `public/templates/scenes/MOT-033.json`
- 真实链路：
  - `src/engine/sceneSync.ts`
  - `src/engine/PhysicsBridge.ts`
  - `src/engine/AnalysisRecorder.ts`
  - `src/components/Canvas.tsx`
  - `src/models/jointTypes/rope.tsx`
  - `src/models/jointTypes/rod.tsx`
- 临时手段（非业务修复）：
  - `/tmp/vertical_decay_diag.mjs`
  - `/tmp/vertical_decay_results.json`

## 文档补充（2026-04-11）
- 用户新增原文：`6有的实验运行中速度会存在衰减，但是我没找到原因，例如竖直圆周运动。7力学中斜面模型不能调节斜面角。重力加速度取10就行。其他实验需要在以上基础上进行逐个观测，例如速度慢下来才能观察到碰撞过程中问题。 这两部分应该改好了 给我写个改动文档`
- 规则裁决：`用户显式指令 > 风险分级自动流转 > 当前模式默认路径`
- 本轮任务判定：
  - 类型：简单任务 / 文档交付
  - 风险等级：L0
  - 流程路径：`MODE 0 -> MODE 4 -> MODE 6`
  - 强制门禁：纯文档改动，回归检查可记录跳过原因
- 决策5：本轮不再修改业务代码，只基于已落地实现与真实提交补写问题6/7的改动文档。
- 决策6：文档范围覆盖三部分：
  - 问题6“竖直圆周等场景额外速度衰减”的已修复内容与验证结果
  - 问题7“斜面角可调 + 重力默认取10”的已落地内容
  - 其他实验在当前修复基线上的逐个观测建议
- 产出文件：
  - `docs/改动说明-问题6-7-速度衰减与斜面角.md`

### 第3轮 [2026-04-11] - 文档补充
**用户原文**: 6有的实验运行中速度会存在衰减，但是我没找到原因，例如竖直圆周运动。
7力学中斜面模型不能调节斜面角。重力加速度取10就行。
其他实验需要在以上基础上进行逐个观测，例如速度慢下来才能观察到碰撞过程中问题。 这两部分应该改好了 给我写个改动文档
**关键要点**:
- 不再要求新增修复实现，而是补一份面向交付的改动说明
- 说明范围要同时覆盖问题6与问题7
- 需要把“其他实验逐个观测”的后续建议写进文档，而不是默认全部已验收
