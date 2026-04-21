/handoff.build

请基于当前整个对话，生成一个 handoff 上下文，
并【直接覆盖写入】项目根目录的 handoff.md 文件。

要求：
- 精炼、准确，不要冗长
- 不要复述讨论过程
- 只保留继续完成任务所必需的信息
- 已确认的结论、约束视为权威事实
- 严格按下面结构写入 handoff.md

handoff.md 内容结构：

## Original Goal
## Current Subtask
## Key Decisions
## Constraints
## Dead Ends
## Relevant Files
## Expected Outcome

操作要求：
- 使用文件写入工具直接修改 handoff.md
- 覆盖原有内容（不要 append）
- 写入完成后，在回复中只输出一行：`handoff.md updated`
