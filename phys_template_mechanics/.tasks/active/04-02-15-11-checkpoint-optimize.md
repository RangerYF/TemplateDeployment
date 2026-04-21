# [任务-Checkpoint优化] checkpoint 流程降耗与分层

**创建时间**: 2026-04-02 15:11
**状态**: 完成
**优先级**: 中

## 需求来源
用户原始需求：
- “分析一下之前2天的使用记录,看看有什么优化的思路没”
- “按上面的方案落地”

## 目标与范围
**主要目标**: 降低 `checkpoint` 常规使用等待时间，同时保留知识沉淀质量。
**范围**:
- `.agents/skills/checkpoint/`
- `.agents/skills/update-knowledge/`
- `.claude/commands/checkpoint/`
- `.claude/commands/update-knowledge/`
- 新增显式快慢入口 skill/command
**不包括**:
- 不修改 AGENTS/CLAUDE 全局流程规则
- 不改动 `.knowledge/` 业务知识内容
- 不处理当前工作区其他未提交业务改动

## 任务评估
- **任务类型**: 系统改进类
- **风险等级**: L1
- **流程路径**: MODE 0 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6
- **强制门禁**: 纯文档/skill 改动，无代码回归命令；交付时记录跳过原因

## 关键约束
- 保持现有 `/checkpoint` 可继续使用
- 默认行为要兼顾低等待和知识沉淀
- Codex/Claude 两侧 skill 文案保持一致

## 关键决策记录
- 决策：`/checkpoint` 保留为智能入口，而不是直接改成 full。
  - 理由：兼容现有使用习惯，避免每次都要求用户切换命令。
- 决策：新增显式 `checkpoint-fast` / `checkpoint-full`。
  - 理由：把常用快速收尾和阶段级完整收尾分开，减少隐性等待。
- 决策：`update-knowledge` 增加 preflight 短路。
  - 理由：主要耗时来自“每次都完整评估 5 个维度”，应先判断是否值得评估。
- 决策：`checkpoint-fast` 保留三层文档链同步，只跳过知识沉淀。
  - 理由：用户当前工作流依赖“子任务文档 -> 阶段文档 -> 总计划文档”的连续更新来承接后续子任务，不能把文档链同步误当成可裁剪负担。

## 执行计划
1. 改造 `checkpoint` 为智能入口，增加 preflight 决策矩阵。
2. 新增 `checkpoint-fast` 与 `checkpoint-full` skill/command。
3. 改造 `update-knowledge`，增加短路规则与按需读取。
4. 同步 `.claude/commands/` 镜像文件。
5. 审查文案一致性，输出新用法与验证结论。

## 当前进展
- 已完成近两天使用记录抽样与耗时分析。
- 已完成 `checkpoint` 智能入口改造，加入 fast/full 决策规则。
- 已新增显式 `checkpoint-fast` / `checkpoint-full` 入口。
- 已完成 `update-knowledge` preflight 短路规则，并同步 `.claude/commands/` 镜像文件。
- 已根据用户工作流修正边界：`fast` 保留文档链同步与“后续承接信息”，仅跳过 `update-knowledge`。
- 已将“后续承接信息”固化进 `.tasks/template.md`，供后续子任务文档直接复用。
- 已执行本轮 `checkpoint-fast`：完成关键输入归档与当前任务文档同步，未调用 `update-knowledge`。

## 对后续任务的影响
- **新约束**: `checkpoint-fast` 必须保留“当前子任务文档 -> 父级阶段文档 -> 总计划文档”的文档链同步能力，不能把它和知识沉淀一起裁掉。
- **依赖变更**: 后续任务收尾可优先使用 `checkpoint-fast` 维持 `.tasks/` 连续性；只有在阶段闭环或需要沉淀稳定知识时再使用 `checkpoint-full`。
- **必看文件**: `.agents/skills/checkpoint/SKILL.md`、`.agents/skills/checkpoint-fast/SKILL.md`、`.agents/skills/checkpoint-full/SKILL.md`、`.agents/skills/update-knowledge/SKILL.md`、`.tasks/template.md`
- **复用结论**: 高频承接信息应优先沉淀在 `.tasks/` 文档链；低频、稳定、跨任务可复用的规则才进入 `.knowledge/`。
- **未决风险**: 智能入口与 fast/full 的边界仍需经过后续真实子任务收尾场景验证，重点观察信息是否足够承接且等待是否显著下降。

## 用户对话记录
### 第1轮 [2026-04-02 15:xx] - MODE 0/1
**用户原文**: 项目里有一个checkpoint skill... 分析一下之前2天的使用记录,看看有什么优化的思路没
**关键要点**: 用户关注 checkpoint 高频执行的累计等待成本，希望在不牺牲知识库价值的前提下优化流程。

### 第2轮 [2026-04-02 15:xx] - MODE 4
**用户原文**: 按上面的方案落地
**关键要点**: 用户确认按“智能入口 + fast/full 分层 + knowledge preflight”实施。

### 第3轮 [2026-04-02 15:xx] - MODE 3
**用户原文**: Checkpoint fast这样改的话好像没有这个能力了 / 同意
**关键要点**: 用户明确要求保留子任务完成后的文档链连续性，确认将 `fast` 修正为“保留任务文档链同步，只跳过知识沉淀”。

### 第4轮 [2026-04-02 15:xx] - MODE 6
**用户原文**: 先这样,我们之后用一下试一下 / 现在有了fast和full,之前的原版的还要保留吗 / $checkpoint-fast
**关键要点**: 用户决定先按当前分层方案试运行，确认 `checkpoint` 继续保留为智能默认入口，并触发本轮 `checkpoint-fast` 收尾。
