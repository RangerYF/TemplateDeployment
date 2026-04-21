# Claude Code -> Codex 迁移说明

本仓库已新增一套 Codex 版本配置，且保留原有 Claude 版本不变。

## 已新增内容

- `AGENTS.md`：`CLAUDE.md` 的 Codex 版本
- `.agents/skills/`：Codex skills（对应原 `.claude/commands/`）
- `codex-system-install.md`：`knowledge-system-install.md` 的 Codex 版本

## 命令映射

| Claude 命令 | Codex skill |
|---|---|
| `/version-plan` | `version-plan` |
| `/agent-eval` | `agent-eval` |
| `/daily-report` | `daily-report` |
| `/findskill` | `find-skill` |
| `/handoff.build` | `handoff-build` |
| `/handoff.exec` | `handoff-exec` |
| `/repo-init` | `repo-init` |
| `/checkpoint` | `checkpoint` |
| `/update-knowledge` | `update-knowledge` |

## 在 Codex 中的调用方式

- 直接在对话中点名 skill：`请使用 version-plan skill ...`
- 或使用 `$skill-name` 形式：`$version-plan`、`$checkpoint`

## 兼容策略

- Claude 版本仍在 `.claude/` 和 `CLAUDE.md` 中，未删除、未覆盖。
- Codex 版本使用 `.agents/skills/` 与 `AGENTS.md`，两套可并行维护。
