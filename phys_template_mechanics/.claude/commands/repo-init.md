# 新项目初始化检查清单

当用户要初始化一个新代码仓库时，输出以下检查清单供用户参照执行。不要自动执行任何操作，只提供说明。

## 输出格式

按以下模板输出，根据用户提供的信息（项目名、技术栈、是否有 UI）调整标注：

---

## 新项目初始化清单

### 第一步：必做项（所有项目）

- [ ] **创建项目目录**
- [ ] **复制 `.claude/` 目录**：从已有项目（如 visual_template）复制整个 `.claude/` 目录，包含：
  - `commands/` — 5 个通用 skill（version-plan、agent-eval、handoff.build、handoff.exec、daily-report、repo-init）
  - `settings.json` — Agent Teams 等实验功能开关
- [ ] **复制 `CLAUDE.md`**：从已有项目复制，然后修改以下项目特定部分：
  - 附录 F「最小回归门禁矩阵」— 按新项目技术栈调整检查命令
  - 其余规则（核心规则、RIPER-7、风险分级等）通用，无需改动
- [ ] **创建 `.tasks/` 目录结构**：
  ```
  .tasks/
  ├── active/
  ├── completed/
  └── suspended/
  ```
- [ ] **复制 `VERSION-PLANNING-GUIDE.md`**：从已有项目的 `.tasks/` 下复制到新项目的 `.tasks/` 下
- [ ] **`git init`** 并确认 author 配置为 `cjn <1229412289@qq.com>`

### 第二步：按需项

- [ ] **涉及 UI 的项目**：复制 `design_guid/` 目录（EduMind 设计系统规范）
- [ ] **技术栈确定后**：生成对应的 `.gitignore`
- [ ] **需要代码质量门禁时**：配置 Husky pre-commit hook
  - 安装：`pnpm add -D husky && pnpm exec husky init`
  - 在 `.husky/pre-commit` 中写入技术栈对应的检查命令，例如：
    - React + TS：`pnpm tsc --noEmit && pnpm lint`
    - Python：`ruff check . && mypy .`
  - 同步更新 `CLAUDE.md` 附录 F 的门禁矩阵

### 第三步：开始工作

- [ ] 首次 git 提交
- [ ] 运行 `/version-plan` 制定版本开发计划

---

## 注意事项

- 如果用户没有提供项目信息，先简要询问：项目名称、是否涉及 UI
- 检查清单输出后，不要主动执行任何步骤，等用户指示
