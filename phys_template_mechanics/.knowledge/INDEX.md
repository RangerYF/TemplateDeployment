# 项目知识库索引

本目录包含经过验证的项目规范与经验教训。Claude Code 在执行任务时按以下时机查阅：

| 文档 | 内容 | 查阅时机 |
|------|------|---------|
| [product.md](product.md) | 产品定位、边界、不做什么 | MODE 0 任务评估 |
| [design.md](design.md) | 交互设计规范、UI 模式、视觉编码 | MODE 2/3 设计与计划 |
| [architecture.md](architecture.md) | 技术架构模式、代码规范 | MODE 3/4 计划与执行 |
| [playbooks/](playbooks/) | 实施手册（标准操作流程） | MODE 4 执行 |
| [pitfalls.md](pitfalls.md) | 已知陷阱、踩坑记录、bug 根因 | MODE 4/5 执行与审查 |
| [user-inputs.md](user-inputs.md) | 用户原始输入归档（决策/Bug/调整/反馈） | 需要追溯历史决策时 |

## Playbooks 目录

| 手册 | 用途 |
|------|------|
| [add-body-type.md](playbooks/add-body-type.md) | 新增物体类型的标准流程 |
| [add-template-command-json.md](playbooks/add-template-command-json.md) | 新增模板的“指令定义 → JSON 生成 → 加载校验”标准流程 |
