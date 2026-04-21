---
name: committer
description: 关于如何撰写 Git 提交信息的说明。
---

# Git 提交最佳实践

## 提交信息结构

1. **首行规则**
- 控制在 50 个字符以内
- 首部使用 gitmoji 标识提交类型
- 用简洁清晰的一句话概括改动
- 首字母大写
- 末尾不加句号

2. **正文规则**
- 首行与正文之间空一行
- 说明改动动机
- 说明改动如何解决问题
- 使用要点列表提升可读性
- 建议 72 列换行

## 提交信息示例

```text
✨ Add user authentication middleware

- Implement JWT-based authentication
- Create middleware to validate user tokens
- Add error handling for unauthorized requests

Resolves #123
```

## 额外最佳实践

- 避免使用 `Fix bug`、`Update code` 这类泛化描述
- 具体说明改动及影响
- 有 issue 时附带 issue 编号
- 不在提交信息中解释代码如何实现
- 重点解释为什么要改
- 不要自动添加 `Co-Authored-By` 或其他归因行