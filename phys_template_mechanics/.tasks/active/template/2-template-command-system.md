# 2-阶段任务文档：模板指令系统（设计/生成/验证）

- 所属计划：`.tasks/active/template/PROGRESSIVE-PLAN.md`
- 阶段编号：`T2`
- 风险等级：`L2`（涉及模板数据生成链路、相对关系计算与一致性校验）
- 当前状态：已完成（2026-04-01）

---

## 目标
建立“指令驱动”的模板生成系统，确保模板 Scene 由编辑器同源逻辑计算得到，而不是手工估值。

---

## 范围
- 指令模型：`src/templates/commands/schema.ts`
- 执行器：`src/templates/commands/executor.ts`
- 验证器：`src/templates/commands/validator.ts`
- 样例接入：至少将 `FM-001 / MOT-001 / SHM-001` 改为由指令生成
- 输出产物：统一 `Scene`，接入现有 `loader/registry`

---

## 非目标（本阶段不做）
- 不做完整 40 个 A 类模板批量迁移
- 不做 UI 交互改造

---

## 用户补充约束（2026-04-01）
1. 样例接入改为“先生成 `Scene JSON` 文件，再加载 JSON 并验证”。
2. 指令系统 API 需先完成结构设计与分类清单，再逐个实现 API。
3. API 设计需满足后续模板扩展（不仅限当前 3 个样例）。

---

## 指令系统设计约束
1. 指令应覆盖最小闭环：
   - `setGravity`
   - `addBody`（使用 body descriptor defaults 补齐）
   - `snapTo`（复用 `computeSnap`）
   - `addJoint`
   - `addForce`
2. 执行顺序可重放，且结果稳定（同输入同输出）。
3. 输出必须是标准 `Scene`，可直接进入 `replaceScene(scene)`。
4. 禁止在模板定义里手工填写“应由算法得出”的关键位姿。

---

## 一致性验证（强制）
- 对 `position/angle`、关键物理参数、约束锚点、重力配置做结构化校验。
- 至少覆盖 3 个样例模板：
  - `FM-001`：贴地与外力关系
  - `MOT-001`：地面接触下的匀速直线
  - `SHM-001`：竖直弹簧单自由度关系
- 验证失败时输出明确 diff（字段路径 + 期望/实际）。

---

## 实施清单（按顺序）
1. 定义指令 schema 与类型。
2. 实现执行器（含 defaults 合并、snap 计算、场景组装）。
3. 实现一致性验证器。
4. 迁移 3 个 ready 模板为“指令生成”。
5. 接入 loader 链路并保留回滚开关（可退回静态 scene）。

---

## 验收标准
- 三个样例模板全部由指令生成，且通过一致性验证。
- 模板进入编辑器后的初始表现与编辑器实际操作行为一致（含吸附关系）。
- `pnpm lint` 与 `pnpm tsc --noEmit` 通过。

---

## 回归检查（命中 `src/`）
- `pnpm lint`
- `pnpm tsc --noEmit`

---

## 风险与回滚
- 风险：执行器与编辑器核心行为出现漂移，导致模板表现回归不稳定。
- 控制：执行器复用现有编辑器同源算法（`computeSnap` + descriptor defaults），并加验证器守护。
- 回滚：保留静态 `scene` 回退路径；逐模板开关切换，避免全量失败。

---

## 本次执行记录（2026-04-01）

### 1) API 结构与分类清单
- 指令分类：`scene / body / placement / joint / force`
- 指令列表：
  - `scene`：`setGravity`
  - `body`：`addBody`、`patchBody`
  - `placement`：`snapTo`
  - `joint`：`addJoint`、`patchJoint`
  - `force`：`addForce`、`patchForce`

### 2) 代码交付
- 新增：`src/templates/commands/schema.ts`
- 新增：`src/templates/commands/executor.ts`
- 新增：`src/templates/commands/validator.ts`
- 新增：`src/templates/commands/examples.ts`
- 新增：`src/templates/commands/index.ts`
- 新增：`scripts/generate-template-scene-json.mjs`
- 新增：`public/templates/scenes/FM-001.json`
- 新增：`public/templates/scenes/MOT-001.json`
- 新增：`public/templates/scenes/SHM-001.json`
- 改造：`src/templates/schema.ts`、`src/templates/catalog.ts`、`src/templates/index.ts`
- 改造：`src/templates/loader.ts`（JSON 加载 + 指令校验 + diff 失败返回）
- 改造：`src/App.tsx`（异步加载模板 + 验证失败日志）
- 改造：`package.json`（新增 `templates:generate-json` 脚本）

### 3) 样例接入策略
- `FM-001 / MOT-001 / SHM-001` 使用 `commandProgram + sceneJsonPath` 双轨定义：
  - `commandProgram`：作为指令真值
  - `sceneJsonPath`：作为运行时加载资产
- loader 在加载 JSON 后执行一致性验证：`commandProgram` 生成结果 vs JSON 场景，失败返回结构化 diff。

### 4) 回归检查
- `pnpm lint`：通过
- `pnpm tsc --noEmit`：通过

### 5) Checkpoint 同步（2026-04-01）
- 已归档用户关键输入到 `.knowledge/user-inputs.md`（T2 相关输入 4 条）。
- 已调用 `update-knowledge` 并更新知识库：
  - `architecture.md` 新增模板指令 DSL + JSON 双轨链路规范。
  - `pitfalls.md` 新增模板漂移与 `snapTo` 阈值陷阱。
  - `playbooks/add-template-command-json.md` 新增模板接入操作手册。
