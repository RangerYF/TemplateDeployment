# Codex CLI 提示音配置说明

本文说明如何在 `codex` 结束一轮响应时播放声音提示。

## 1. 生效机制

- 顶层 `notify`：定义“响应完成后执行的外部命令”。
- `[tui].notifications`：订阅触发事件，常用为 `agent-turn-complete`。
- `[tui].notification_method`：TUI 内置通知方式，`"bel"` 表示终端响铃。

关键点：`notify` 必须是 **顶层键**，不能写在 `[tui]` 表里。

## 2. 配置步骤

### 2.1 新建通知脚本

文件：`~/.codex/notify.sh`

```bash
#!/bin/zsh
payload="$1"
printf '%s\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$payload" >> "$HOME/.codex/notify.log"
/usr/bin/afplay /System/Library/Sounds/Glass.aiff >/dev/null 2>&1 || true
```

赋予执行权限：

```bash
chmod +x ~/.codex/notify.sh
```

### 2.2 修改配置文件

文件：`~/.codex/config.toml`

```toml
notify = ["/Users/你的用户名/.codex/notify.sh"]

[tui]
notification_method = "bel"
notifications = ["agent-turn-complete"]
```

说明：
- `notify` 建议放在第一个 `[table]` 之前，避免误进某个表。
- `notification_method = "bel"` 依赖终端本身允许响铃。

## 3. 验证方式

1. 手工验证脚本（应能听到声音）：

```bash
~/.codex/notify.sh '{"event":"agent-turn-complete"}'
```

2. 重启 `codex` 后发起一次短对话。
3. 查看是否真的触发了 notify：

```bash
tail -n 5 ~/.codex/notify.log
```

如果有新日志但没声音，通常是系统音量/输出设备或终端响铃设置问题。

## 4. 常见问题

- 只配置了 `[tui]` 两项，没有顶层 `notify`。
- `notify` 写在 `[tui]` 下面，变成了 `tui.notify`，不会按预期触发。
- `notify.sh` 没有执行权限。
- `afplay` 路径或音频文件路径错误。

## 5. 官方参考

- https://developers.openai.com/codex/config-reference
- https://developers.openai.com/codex/config-advanced
