# Playbook：新增模板（指令 + JSON）

## 1. 设计阶段

### 1.1 明确模板目标
- 确认模板编号（如 `FM-011`）与所属模块（`P-01/P-02/P-05/P-12/P-14`）。
- 确认教学现象的最小闭环：物体关系、约束关系、外力关系、重力配置。
- 明确哪些关系必须由算法生成（如贴地、贴面、角度对齐），禁止手填估值替代。

### 1.2 设计命令序列
- 按执行顺序组织 `commandProgram`：`setGravity -> addBody -> snapTo -> addJoint -> addForce`。
- 用逻辑 `ref` 组织对象关系（`bodyRef/jointRef/forceRef`），不使用运行时 ID。
- 对 `snapTo` 预先检查初始位姿与阈值关系（默认 0.3m）。
- 支撑体（`slope/conveyor/hemisphere/groove`）必须显式 `snapTo -> ground`，禁止手工估值“贴地坐标”。
- `rope/rod/spring` 约束优先依赖执行器按锚点自动推导长度；只有明确教学意图时才手工 patch 长度参数。
- 竖直圆周模板初速度优先按最小闭环条件设置：`rope: sqrt(5gR)`、`rod: sqrt(4gR)`（可加安全系数）。
- 锚点悬挂模板（anchor + rope/rod）默认按可读性基线设计：固定锚点 `y > 9`，静止悬挂链路 `d > 4`。
- 默认基线：
  - 若无教学必要，`initialVelocity` 保持零；
  - `block/ball` 使用默认尺寸（`0.8x0.6` / `r=0.3`）。

### 1.3 选择模板接入方式
- `ready` 模板（`sceneSource=command`）：同时提供 `sceneJsonPath` 与 `commandProgram`（推荐）。
- `ready` 模板（`sceneSource=manual`）：以 `sceneJsonPath` 为真值，可不依赖 `commandProgram`。
- `planned` 模板：可先仅保留 `meta`，待命令程序就绪后再转 `ready`。
- 运行态元数据统一维护在 `src/templates/catalog-data/templates.json`，不要把运行态目录职责放回 `presets`。
- 教学元信息最小集：`teachingObjective + constructionSteps`。
  - `ready`：`constructionSteps` 由 `commandProgram` 自动推导；
  - `planned`：使用占位步骤，待接入命令后自动替换。

## 2. 实现阶段

### 2.1 编写命令程序
- 在 `src/templates/presets/<module>/<template-id>.json` 新增或更新模板配置。
- `presets` 仅用于生成态命令输入：`ready + sceneSource=command` 模板必须维护 `commandProgram`；
- `ready + sceneSource=manual` 模板不强制维护 `commandProgram`；
- `planned` 模板可先不写 `commandProgram`。
- 同模块的 `module.json` 维护模块级标题、简介与教学关注点。
- 模板 `teaching` 仅维护：
  - `teachingObjective`（可人工撰写）
  - `constructionSteps`（`ready` 不手写，运行时按命令自动生成）
- 使用 `patch` 填入关键参数（质量、摩擦、初速度、约束参数等）。
- 需要贴合关系时，优先使用 `snapTo`，不要直接硬编码最终位姿。
- 若模板确需非零初速度，显式声明 `allowNonZeroInitialVelocity: true`。
- 若模板确需偏离基础尺寸，显式声明 `allowCustomBodySize: true`（并在文档注明教学意图）。

### 2.2 生成 Scene JSON
- 对 `sceneSource=command` 模板：执行 `pnpm run templates:generate-json`。
- 检查产物路径：`public/templates/scenes/<TEMPLATE_ID>.json`。
- 若生成失败，优先排查 `snapTo` 命中与 `ref` 引用是否正确。
- 若报 `sanity check failed`，按摘要修复场景几何问题（如地面穿透、约束长度不一致、圆周初速度不足）后再生成。
- 对 `sceneSource=manual` 模板：通过编辑器开发按钮 `保存预置` 回写 scene JSON，不走批量生成覆盖。

### 2.3 注册到模板目录
- 运行态模板目录维护在 `src/templates/catalog-data/templates.json`（模块目录在 `modules.json`）。
- 注册模板时更新 `templates.json` 对应条目：
  - `meta`（id/module/name/status）
  - `teaching`（teachingObjective/constructionSteps）
  - `sceneSource`
  - `sceneJsonPath`（ready 必填）
- `ready + sceneSource=command`：确保 `sceneJsonPath` 可由生成脚本产出。
- `ready + sceneSource=manual`：确保 `sceneJsonPath` 指向手工回写资产，并保持 `sceneSource='manual'`。

### 2.4 接入加载校验
- 确认 `src/templates/loader.ts` 已走 JSON 加载链路。
- 运行时统一仅执行 `scene sanity`，失败返回 `sanity_failed`。
- `commandProgram` 一致性校验迁移到生成阶段（`templates:generate-json`）执行，不再在运行时做 diff。

## 3. 验证清单

- [ ] `pnpm run templates:generate-json` 成功生成目标 JSON。
- [ ] 模板可从工作台进入编辑器并成功加载。
- [ ] 生成阶段 `validateSceneSanity` 通过（无 `error` 级问题）。
- [ ] `sceneSource=command` 模板在生成阶段通过命令一致性校验（脚本失败即阻断）。
- [ ] loader 仅执行 sanity 校验（无运行时 diff 校验分支）。
- [ ] `sceneSource=manual` 模板不会被 `templates:generate-json` 覆盖。
- [ ] `ready` 模板的 `constructionSteps` 能与命令序列一一对应（由系统自动推导）。
- [ ] anchor 悬挂模板满足 `anchor.y > 9` 与静止悬挂 `d > 4`（若适用）。
- [ ] 未显式声明 `allowNonZeroInitialVelocity` 时，所有动态体初速度为零。
- [ ] 未显式声明 `allowCustomBodySize` 时，`block/ball` 使用默认尺寸基线。
- [ ] 若故意改错 JSON，可看到 `sanity_failed` 摘要；若命令模板不一致，应在生成阶段报错。
- [ ] 编辑态受力探测与仿真首帧受力一致（避免“开仿真前后受力变化”）。
- [ ] 双绳/绳杆悬挂场景下，两个张力箭头都不与连接件重合（无单侧贴绳）。
- [ ] 重力箭头从质心语义出发，但不覆盖物体主体（物体视觉层级在最上）。
- [ ] 模板在编辑器中可继续编辑，不出现引用污染（`replaceScene` 深拷贝）。
- [ ] 受绳/杆/滑轮约束物体拖拽仍可吸附，且直接拖拽与联动拖拽都不能进入地面以下。
- [ ] 开发态按钮仅本地可见（生产不可见），且绝对定位不影响顶栏布局。
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过。

## 4. 常见问题

- **snapTo 报无目标**：初始位姿超出阈值（默认 0.3m）；将初始点放近目标面，或显式提高 `threshold`。
- **命令与 JSON 不一致**：更新命令后忘记重新生成 JSON；重新执行 `templates:generate-json`。
- **开仿真后杆/绳长度突变**：优先检查是否手工 patch 了与锚点几何冲突的长度参数；默认应让执行器自动推导。
- **模板受力开仿真前后不一致**：确认本地代码已包含 `probeForces(steps=1)` 与 EMA reset 的修复链路。
- **模板加载成功但行为不对**：优先检查 `commandProgram` 是否使用了正确 `bodyRef` 与锚点定义。
- **命令与场景漂移未在运行时暴露**：这是预期；请在 `templates:generate-json` 阶段执行一致性门禁，不要把 diff 校验放回 loader。
- **构造步骤和命令不一致**：不要手写 ready 模板的 `constructionSteps`，应以命令推导结果为准。
- **运行时污染模板数据**：模板注入必须走 `sceneStore.replaceScene`，不要直接复用注册表对象引用。
- **模板默认就“自己动起来”**：检查是否遗漏 `allowNonZeroInitialVelocity` 策略声明，或误写了非零 `initialVelocity`。
- **悬挂模板画面过挤**：优先调整锚点高度与链路几何（`y > 9`、`d > 4`），不要用 rope slack 做默认补偿。
- **手工回写后被脚本覆盖**：确认该模板 `sceneSource` 已切换为 `manual`；`templates:generate-json` 只覆盖 `sceneSource=command`。
