---
name: find-skill
description: 根据用户需求并行搜索多个 skill 来源，给出最匹配的可安装技能推荐。
---

根据用户的需求描述，从 3 个 skill 来源中搜索匹配的 agent skill，并给出推荐。

## 你的角色

你是一个 Skill 搜索助手。用户描述了一个需求，你帮他从主流 skill 来源中找到最合适的现成 skill。

## 搜索来源（按优先级排序）

| 优先级 | 来源 | 定位 | 搜索方式 |
|--------|------|------|----------|
| 1 | [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 质量最高，知名团队出品 | GitHub 仓库 README + 目录结构 |
| 2 | [openai/skills](https://github.com/openai/skills) | 官方仓库 | GitHub 仓库目录 |
| 3 | [SkillsMP](https://skillsmp.com) | 最大索引站，50万+ | 网页搜索 |

## 执行步骤

### 第1步：明确需求

如果用户已经给出具体需求，直接使用。否则询问：
- 你想找什么功能的 skill？
- 用于什么场景？

### 第2步：并行搜索 3 个来源

同时从 3 个来源搜索，方法如下：

**来源1 — VoltAgent（GitHub）**：
- 读取 `https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md`
- 在内容中搜索与用户需求相关的关键词

**来源2 — openai/skills（GitHub）**：
- 用 Bash 执行 `gh api repos/openai/skills/git/trees/main?recursive=1` 列出目录
- 从目录名和路径中匹配相关 skill

**来源3 — SkillsMP（Web 搜索）**：
- 搜索 `site:skillsmp.com {用户需求关键词} skill`
- 如果有结果，抓取详情页并提取安装信息

### 第3步：汇总结果

对每个找到的 skill，提取：
- 名称
- 来源（VoltAgent / openai / SkillsMP）
- 一句话描述
- 安装方式或链接

### 第4步：输出推荐报告

```
## Skill 搜索结果

### 需求：[用户的需求描述]

### 找到的 Skill

| # | 名称 | 来源 | 描述 | 链接 |
|---|------|------|------|------|
| 1 | ... | VoltAgent | ... | ... |
| 2 | ... | openai | ... | ... |
| 3 | ... | SkillsMP | ... | ... |

### 推荐
[推荐最匹配的 1-2 个，说明理由]

### 没找到？
如果 3 个来源都没有匹配的 skill，直接告知用户"没有现成的 skill"，并简要建议是否值得自己写一个。
```

## 注意事项

- 不要强行推荐不相关的 skill，宁可说"没找到"
- 优先推荐 VoltAgent 和 openai 的（质量有保证），SkillsMP 作为兜底
- 如果某个来源访问失败（如被 Cloudflare 拦截），跳过并说明，不要卡住
