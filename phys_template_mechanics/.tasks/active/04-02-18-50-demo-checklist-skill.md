# 任务文档：演示清单技能固化

## 1. 任务基本信息（MODE 0）
- 任务 ID：`04-02-18-50-demo-checklist-skill`
- 任务来源：用户显式指令
- 规则来源：`用户显式指令 > 风险分级自动流转 > 当前模式默认路径`
- 任务类型：`流程固化 + 文档资产沉淀`
- 风险等级：`L1`
- 流程路径：`MODE 0 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6`
- 强制门禁：
  - 技能内容需复用本轮已确认的演示清单要求，不做脱离项目实际的泛化。
  - 本轮仅改动 `.agents/skills/` 与 `.tasks/`，不命中 `src/`，按附录 F 记录跳过代码回归原因。

## 2. 用户原始需求
- `把上面创建演示清单的各种要求,固化成一个skill,未来可以复用`

## 3. 范围与决策（MODE 3）
- 新建技能目录：`.agents/skills/demo-checklist/`
- 技能目标：
  - 为当前项目任意版本生成/重写面向用户的演示清单
  - 固化“先判断版本类型，再决定文档结构”的方法
  - 固化“能力优先、增量适配、附录承接、去研发口吻”的写法
  - 固化校验方法，保证未来跨版本复用时口径一致

## 4. 执行产物（MODE 4）
- 新增技能：`.agents/skills/demo-checklist/SKILL.md`

## 5. 审查与验证（MODE 5）
- 审查结论：`:white_check_mark: 实现完全匹配计划`
- 验证命令：
  - `git diff --check -- .agents/skills/demo-checklist/SKILL.md .tasks/active/04-02-18-50-demo-checklist-skill.md`
  - `sed -n '1,260p' .agents/skills/demo-checklist/SKILL.md`
- 结果：
  - `git diff --check ...`：通过，无空白错误和 patch 格式问题。
  - `sed -n '1,260p' ...`：已人工复核，技能内容包含触发条件、文档结构、口吻约束、附录规则与校验方法。
- 回归门禁跳过说明：
  - 本轮未改动 `src/`，不触发 `pnpm lint && pnpm tsc --noEmit`。

## 6. 交付结论（MODE 6）
## 交付DoD
- 变更摘要
  - 新增 `.agents/skills/demo-checklist/SKILL.md`，固化跨版本演示清单的生成与重写方法。
  - 新增 `.tasks/active/04-02-18-50-demo-checklist-skill.md`，记录本轮技能沉淀与验证证据。
- 验证结果（命令 + 结果 + 跳过原因）
  - `git diff --check -- .agents/skills/demo-checklist/SKILL.md .tasks/active/04-02-18-50-demo-checklist-skill.md`：通过。
  - `sed -n '1,260p' .agents/skills/demo-checklist/SKILL.md`：已复核，结构完整。
  - 跳过 `pnpm lint && pnpm tsc --noEmit`：原因是本轮未改动 `src/`。
- 风险与回滚
  - 风险：若未来项目演示文档结构显著变化，skill 需同步更新。
  - 回滚：删除 `.agents/skills/demo-checklist/` 并按新规则重建。
- 任务完成质量模块（bug/文档/规则/根因/改进）
  - 规则：已把本轮反复确认的用户视角、结构选择规则和措辞约束固化为技能。
  - 改进：后续可继续补 `agents/openai.yaml` 或参考模板资产。
- 审查结论（匹配/偏离计划）
  - `:white_check_mark: 实现完全匹配计划`
