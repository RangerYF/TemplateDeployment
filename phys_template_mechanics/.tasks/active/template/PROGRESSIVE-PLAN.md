# 力学模板库整体任务文档（基于编辑器底座）

## 1. 任务基本信息（MODE 0）
- 任务ID：`04-01-16-12-template-library-overall`
- 任务来源：用户显式指令（“分析模块需求并梳理整体任务文档到 `.tasks/active/template`”）
- 规则来源：`用户显式指令 > 风险分级自动流转 > 当前模式默认路径`
- 任务类型：数据处理 + 系统改进（模板资产规划）
- 风险等级：`L2`
- 流程路径：`MODE 0 -> MODE 1 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6`
- 强制门禁：
  - 数据契约校验（模板ID/参数/字段映射需基于真实文档，不做字段猜测）
  - 命中代码目录前，不执行代码回归命令（本轮仅文档产出）

## 2. 任务目标
围绕已完成的编辑器底座能力，为以下 5 个模块梳理可落地模板总清单与实施路线：
- `P-01 受力分析`
- `P-02 运动模拟`
- `P-05 简谐运动`
- `P-12 动量守恒`
- `P-14 机械能守恒`

模板定义：预定义 JSON 场景数据。编辑器加载后可直接呈现物体、约束、受力关系与分析图表，满足教学场景演示。
用户最新约束（2026-04-01）：需求文档中的模型结构仅作说明，模板 JSON 以当前编辑器 `Scene` 数据模型为唯一落地标准。
新增目标（2026-04-01）：先建设“模板工作台”，按需求文档模块分类展示模板卡片；点击卡片后进入编辑器并直接加载该模板场景，且可继续自由编辑。

## 3. 数据结构样例与字段映射（MODE 1）
### 3.1 编辑器场景结构（唯一标准）
- `Scene.settings.gravity`
- `Scene.bodies[]`（`type/position/angle/mass/friction/restitution/initialVelocity/initialAcceleration/...`）
- `Scene.joints[]`（`rope/rod/spring/pulley`）
- `Scene.forces[]`（用户外力）

### 3.2 教学参数到场景字段映射（关键）
- `m` -> `SceneBody.mass`
- `μ` -> `SceneBody.friction`
- `e` -> `SceneBody.restitution`
- `v0` -> `SceneBody.initialVelocity`
- `a0` -> `SceneBody.initialAcceleration`
- `g` -> `Scene.settings.gravity.y = -g`
- `F, θ` -> `SceneForce.magnitude / direction`
- `绳长` -> `SceneJoint.maxLength`
- `杆长` -> `SceneJoint.length`
- `弹簧自然长` -> `SceneJoint.springLength`
- `k（N/m）` -> `SceneJoint.stiffness(Hz)`（需换算，见 `pitfalls.md`）
- `斜面角度θ` -> 由 `baseLength/slopeHeight` 反推或正推（模板侧固化两者）

### 3.3 需求文档的使用方式（降级为语义参考）
- 模型编号（FM/MOT/SHM/MOM/ENE）用于模板命名与教学归档。
- 公式与教学要点用于 `meta/teaching` 描述，不参与运行时解算结构。

## 4. 编辑器底座能力快照（用于模板可行性判定）
### 4.1 已具备能力
- 物体：`block/ball/ground/slope/wall/anchor/pulley-mount/conveyor/hemisphere/half-sphere/groove`
- 约束：`rope/rod/spring/pulley`
- 力学：碰撞、摩擦、重力、约束反力采集、用户外力
- 分析：运动/能量/动量图表与历史记录

### 4.2 当前边界
- 不支持流体浮力、质量喷射（火箭）、爆炸分离、杠杆力矩专用解算
- 水平圆周（俯视图）场景在当前 2D 侧视底座中不自然

## 5. 五大模块模板清单与落地分层
状态定义：
- `A 直接实现`：现有底座可直接模板化
- `B 近似实现`：可展示主现象，但非严格同构
- `C 暂不纳入`：超出现有底座边界

### 5.1 P-01 受力分析（21个）
- A：`FM-001/002/011/021/022/023/031/032/033/043/044/051/052/053/054/055`（16）
- B：`FM-062`（滑轮组可先做定滑轮与简化动滑轮表达）（1）
- C：`FM-041/042/061/063`（水平圆周俯视、浮力、杠杆）（4）

### 5.2 P-02 运动模拟（9个）
- A：`MOT-001/002/011/012/021/022/033`（7）
- C：`MOT-031/032`（水平圆周俯视）（2）

### 5.3 P-05 简谐运动（5个）
- A：`SHM-001/002/003`（3）
- B：`SHM-004`（双摆耦合可先做“两个单摆+耦合弹簧”的近似版本）（1）
- C：`SHM-005`（波形成需要驱动阵列与相位控制体系）（1）

### 5.4 P-12 动量守恒（11个）
- A：`MOM-001/003/011/012/013/031/032`（7）
- B：`MOM-002/041`（粘连碰撞与严格冲量过程需额外机制）（2）
- C：`MOM-021/022`（火箭喷气、爆炸分离）（2）

### 5.5 P-14 机械能守恒（8个）
- A：`ENE-001/002/011/021/022/041/051`（7）
- B：`ENE-031`（轻杆双球竖直圆周需多体刚性组合增强）（1）

### 5.6 汇总
- 总模板需求：`54`
- A 直接实现：`40`
- B 近似实现：`5`
- C 暂不纳入：`9`

## 6. 目标交付结构（模板资产）
建议目录（后续执行阶段落地）：

```text
src/templates/
  index.ts
  schema.ts
  p01/
  p02/
  p05/
  p12/
  p14/
```

单模板建议结构：

```json
{
  "meta": {
    "id": "FM-011",
    "module": "P-01",
    "title": "斜面静止/运动",
    "version": "1.0.0",
    "difficulty": "高中"
  },
  "scene": {
    "settings": { "gravity": { "x": 0, "y": -9.8 } },
    "bodies": [],
    "joints": [],
    "forces": []
  },
  "analysisPreset": {
    "showForces": true,
    "charts": ["v_t", "x_t", "energy", "momentum"]
  },
  "teaching": {
    "keyPoints": [],
    "formulas": []
  }
}
```

## 7. 分阶段实施计划（MODE 3）
### 阶段 T0：工作台骨架与路由切换
- 状态：`已完成（2026-04-01）`
- 新增工作台页面（Workbench）作为模板入口页。
- 默认进入工作台；点击模板卡片切换到编辑器页面。
- 页面状态建议：`#workbench` / `#editor?template=<id>`（或等价路由方案）。
- 详细执行文档：`.tasks/active/template/0-workbench-scaffold.md`
- 实际交付补充：
  - 工作台视觉已按验收反馈扁平化（去渐变、去阴影、去模块分割线）。
  - 编辑器顶栏已新增返回工作台 icon（`ChevronLeft` 无背景无边框）。

### 阶段 T1：模板基础设施
- 状态：`已完成（2026-04-01）`
- 建立模板 schema、模板注册表、按 ID 加载能力
- 模板数据以 `Scene` 为核心结构（可附加 `meta` 字段），不引入需求文档抽象模型
- 详细执行文档：`.tasks/active/template/1-template-infrastructure.md`
- 实际交付补充：
  - 已新增 `schema/index/loader` 并形成统一模板出口（`templateRegistry/listTemplates/getTemplateById`）。
  - `App` 已切换为 `loadTemplateById` 加载链路，ID 不存在时返回可预期失败结果。
  - 根据后续验收决策，已清空阶段一内置模板 `scene` 数据并回调为 `planned`，等待 T2 指令系统统一重建。

### 阶段 T2：模板指令系统（设计/生成/验证）
- 状态：`已完成（2026-04-01）`
- 目标：通过“指令驱动 + 编辑器同源计算”生成模板 Scene，消除手工坐标与真实编辑行为偏差。
- 产物：
  - 模板构建指令 DSL（`setGravity / addBody / snapTo / addJoint / addForce`）。
  - 构建执行器（复用编辑器同源逻辑：`descriptor defaults + computeSnap`）。
  - 一致性验证器（对比指令产物与编辑器实际生成的关键字段与相对关系）。
- 详细执行文档：`.tasks/active/template/2-template-command-system.md`
- 实际交付补充：
  - API 已按 `scene/body/placement/joint/force` 分类，逐项实现到执行器。
  - 样例接入改为 JSON 资产链路：先生成 `public/templates/scenes/*.json`，再由 loader 加载。
  - loader 已接入“JSON vs 指令产物”一致性验证；失败返回结构化 diff。
  - `FM-001 / MOT-001 / SHM-001` 已切为 `ready` 并接入上述链路。
  - 已完成 checkpoint：任务文档链与知识库（architecture/pitfalls/playbooks/user-inputs）同步完成。

### 阶段 T3：A类模板纵向交付（40个）
- 状态：`已完成（2026-04-02，T3.1/T3.2/T3.3/T3.4/T3.5 全部完成）`
- 本轮指令（2026-04-01）：用户要求“阶段3按模块拆分子任务文档，每个模块一个文档（如 3.1-*）”。
- 验收修复（2026-04-01）：已完成 T3.1 根因级修复（锚点长度推导、探测受力时刻、支撑体贴地放置、竖直圆周初速度约束）并接入场景健全性校验门禁。
- T3.2 进展（2026-04-02）：已完成 `P-02` 的 `MOT-001/002/011/012/021/022/033` 纵向闭环交付（preset + catalog + scene JSON + lint/tsc）。
- T3.3 进展（2026-04-02）：已完成 `P-05` 的 `SHM-001/002/003` 纵向闭环交付（preset + catalog + scene JSON + lint/tsc）。
- T3.4 进展（2026-04-02）：已完成 `P-12` 的 `MOM-001/003/011/012/013/031/032` 纵向闭环交付（preset + catalog + scene JSON + lint/tsc）。
- T3.5 进展（2026-04-02）：已完成 `P-14` 的 `ENE-001/002/011/021/022/041/051` 纵向闭环交付（preset + catalog + scene JSON + lint/tsc）。
- Checkpoint（2026-04-02，fast）：已完成 T3.3 子任务文档链同步，并补充 T3.4 承接信息（运行态/生成态边界、必看文件、未决 UI 验收风险）；`update-knowledge` 按 fast 模式跳过。
- Checkpoint（2026-04-01）：已完成 user-inputs 归档与知识库同步（模板场景健全性门禁、根因修复沉淀）。
- 新增分流（2026-04-01）：
  - `C1 参数与初始条件一致性`（尺寸默认值、绳杆默认长度、初速度判定策略）
  - `C2 模板配置工程化与教学元信息`（每模板独立配置 + 教学语义增强）
  - `C3 预置模板回写能力`（加载后人工调整并覆盖保存）
  - 建议顺序：`C1 -> C2 -> C3`
- C1 执行进展（2026-04-01）：
  - 已落地门禁：`anchor.y > 9`、静止悬挂 `rope/rod d > 4`、初速度默认零、基础尺寸默认值校验。
  - 生成/加载链路已接入上述 sanity 策略位并完成 FM/MOT/SHM 现有模板重生成。
  - 已完成 C1 checkpoint：用户输入归档与知识库沉淀（architecture/pitfalls/playbook/product）同步完成。
- C2 结构改造进展（2026-04-01）：
  - 新增约束已执行：`src/templates/commands/examples.ts` 拆为 `examples/` 目录化结构。
  - 按模块目录 + 按模板文件组织：`p01-force-analysis/*`、`p02-motion/*`、`p05-shm/*`，并保留稳定导出入口。
  - 已完成配置外置：`src/templates/presets/<module>/module.json + <template>.json`，catalog 改为目录自动装载并做结构化校验。
  - 已完成教学元信息 schema：模板级（`teachingObjective + constructionSteps`）+ 模块级（summary/teachingFocus）。
  - 已按用户反馈收敛教学字段：仅保留 `teachingObjective + constructionSteps`；其中 `constructionSteps` 对 ready 模板由 commands 自动生成。
  - 已完成生成链路改造：`templates:generate-json` 改为从 catalog 的 ready 模板批量生成。
- C3 状态（2026-04-01）：
  - 用户决策：`C3 先不做`，当前阶段继续聚焦 C2 收敛与稳定性。
  - 状态更新（2026-04-02）：
    - 用户恢复执行 C3，并确认采用 `sceneSource=command/manual` 双来源策略。
    - 已接入“保存预置”能力：编辑器手动调整后可回写 `preset + public scene json`。
    - 已新增“导出 JSON”按钮：可下载当前场景数据到本地用于手工构建模板数据。
    - 交互收敛：`保存预置/导出JSON` 迁移到右侧栏顶部，仅在本地开发环境显示。
    - 布局约束：按钮采用绝对定位覆盖层，贴右侧栏顶部放置，不影响现有顶栏元素布局流。
    - 当前结论：`C3 首版已完成（开发态）`，后续若进入生产可见需增加权限与环境边界设计。
  - C4 架构收敛（2026-04-02）：
    - 用户确认“运行态与生成态拆分”：`preset` 仅用于生成态命令输入；应用启动后只消费 `catalog + scene`。
    - 已新增运行态目录源：`src/templates/catalog-data/modules.json + templates.json`。
    - 已改造运行时加载：`catalog.ts` 仅解析 `catalog-data`；`loader` 仅做 scene 加载与 sanity，不再做运行时 command diff。
    - 已改造生成脚本：仅生成 `ready + sceneSource=command`，并显式跳过 `manual` 模板，防止覆盖手动保存资产。
    - 已改造开发态回写：保存动作改为回写 `catalog-data/templates.json + public scene json`（不再回写 preset 元数据）。
  - 交互回归修复（2026-04-02）：
    - 力箭头避让改为锚点几何驱动，张力按 `sourceId->joint` 精确避让，重力改为质心起点。
    - 拖拽链路改为“受约束体禁用吸附 + 长度约束回收优先”，修复 rope/rod/pulley 拖拽时长度漂移。
    - `pulleyMount` 拖拽纳入 `totalLength` 守恒求解，避免“拖滑轮座导致绳长变长”观感。
    - 验证：`pnpm lint && pnpm tsc --noEmit` 通过。
  - 交互回归修复（续，2026-04-02）：
    - 张力-连接件避让阈值放宽为同线判定（`abs(dot)>0.6`），修复双绳/绳杆“单侧重叠”漏判。
    - 重力箭头改为 `destination-over` 绘制层，保留质心语义同时消除物体主体覆盖。
    - 拖拽吸附策略由“整体禁用”改为“先吸附再约束回收”，恢复受绳约束物体可吸附行为。
    - 新增统一地面防穿透钳制，覆盖直接拖拽与绳/杆/滑轮联动拖拽链路。
    - 验证：`pnpm lint && pnpm tsc --noEmit` 通过。
  - 交互回归修复（再续，2026-04-02）：
    - 重力箭头取消 `destination-over`（此前会造成“虚线感”），恢复实线完整绘制。
    - 张力避让新增锚点外偏方向判定（`anchorVector`）并提高偏移量，修复右侧绳线仍重合问题。
    - 验证：`pnpm lint && pnpm tsc --noEmit` 通过。
  - 交互回归修复（重力层级，2026-04-02）：
    - 重力箭头保持“质心起点”语义，但绘制阶段增加 `evenodd` 外部裁剪，仅显示物体外部段。
    - 结果：物体视觉层级稳定在最上层，且无“虚线感/覆盖主体”问题。
    - 验证：`pnpm lint && pnpm tsc --noEmit` 通过。
- Checkpoint（2026-04-02，C3）：
  - 已同步 `user-inputs`、`3.1` 子任务文档与总计划状态。
  - 已执行 `update-knowledge`：补充模板双来源模式、开发态回写边界、开发动作布局规范与实施手册。
- Checkpoint（2026-04-02，C3 交互回归续）：
  - 已归档本轮 7 条验收输入（双绳避让、重力层级、受约束吸附与防穿透）到 `user-inputs.md`。
  - 已补齐 `3.1-p01-a-force-analysis.md` 交互回归收口记录并对齐总计划状态。
  - 已调用 `update-knowledge` 评估本轮可复用知识（结果见本次 checkpoint 摘要）。
- Checkpoint（2026-04-01，C2）：
  - 已完成 user-inputs 归档与知识库同步（模板配置工程化、步骤生成规则、工作台卡片信息密度决策）。
- 范围：`A 直接实现`模板（40个）。
- 执行方式：按模块波次推进（`P-01 -> P-02 -> P-05 -> P-12 -> P-14`），每个模板独立闭环。
- 强制要求：每完成 1 个模板，必须同步完成工作台上架、加载链路、编辑可用与仿真验收，不再拆成独立阶段。
- 详细执行文档：
  - `.tasks/active/template/3.1-p01-a-force-analysis.md`（已完成）
  - `.tasks/active/template/3.2-p02-a-motion.md`
  - `.tasks/active/template/3.3-p05-a-shm.md`
  - `.tasks/active/template/3.4-p12-a-momentum.md`
  - `.tasks/active/template/3.5-p14-a-energy.md`

### 阶段 T4：B类近似模板纵向交付（5个）
- 状态：`暂缓（2026-04-02，用户指令“近似先不实现，工作台去掉”）`
- 范围：`B 近似实现`模板（5个）。
- 执行方式：本阶段暂不推进实现；运行态目录与工作台均不展示近似模板，待用户恢复指令后再重启。
- 详细执行文档：恢复执行时创建。
- Checkpoint（2026-04-02，fast）：已归档上述用户决策；运行态目录移除 `SHM-004`，工作台改为仅展示 `ready` 模板；`update-knowledge` 跳过。

### 阶段 T5：C类模板评审与能力缺口规划（9个）
- 状态：`待执行`
- 范围：`C 暂不纳入`模板（9个）。
- 执行方式：逐模板输出“无法直接落地原因、所需引擎能力、替代教学方案、优先级建议”。
- 详细执行文档：阶段开始时创建。

### 7.1 单模板统一 DoD（T3/T4 强制）
每个模板完成必须同时满足：
1. 工作台可见：卡片在正确模块分组展示，元信息完整（编号/名称/状态/标签）。
2. 可加载：点击卡片进入编辑器并正确注入模板 `Scene`，无报错。
3. 可编辑：物体、约束、外力可正常编辑，关键交互不异常。
4. 可仿真：主现象与教学预期一致，关键观察量可复现。
5. 可验收：通过模板验收清单（数据契约校验 + 最小回归门禁）。

## 8. 验收标准（本任务文档层）
- 已形成 5 模块模板全量清单（含 ID、分层、数量）
- 已形成参数到编辑器字段映射
- 已形成模板目录与 JSON 结构约定
- 已形成分阶段执行路径（可直接转开发任务）
- 已纳入“按模板纵向交付 + 单模板统一 DoD”的实施规划

## 9. 工作台需求细化（新增）
### 9.1 用户路径
1. 进入工作台，看到按模块分组的模板卡片列表。
2. 点击任一卡片，进入编辑器并自动加载对应模板 Scene。
3. 在编辑器中直接自由编辑（移动、改属性、加约束、加外力、仿真与分析）。

### 9.2 页面与状态设计
- 页面层：`WorkbenchPage`、`EditorLayout`。
- 数据层：`TemplateCatalog`（模块分组 + 卡片元数据 + Scene 数据）。
- 场景注入：`sceneStore.replaceScene(scene)`。
- 编辑行为：加载后与普通场景一致，不加只读限制。

### 9.3 首版范围
- 模块分组：`P-01/P-02/P-05/P-12/P-14`（与当前底座能力一致）。
- 其他需求文档模块先预留分组位，状态标记为“待接入”，不阻塞本轮上线。

## 10. 风险与回滚
- 风险：B类模板若无“近似说明”，容易被误解为严格物理解算
- 控制：模板 metadata 增加 `fidelity: exact | approximate`
- 回滚：若某模板验证失败，先从模板注册表下线该 ID，不影响其他模板
