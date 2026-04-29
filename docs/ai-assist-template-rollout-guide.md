# 可视化模板 AI 助手接入指南

本文档基于 M01 立体几何展示台的 AI 助手接入经验整理，用作后续模板补齐 AI 助手能力的方案指导和技术参考。

核心结论：

> AI 助手不应直接操作 DOM，也不应随意生成完整 snapshot。模板侧应把可控能力抽象为有限的结构化操作，AI 只负责规划操作队列或低风险 patch，模板负责校验、执行和回滚。

## 1. M01 接入经验

M01 从最初的 snapshot patch，演进到当前的 operation queue，主要解决了三个问题：

1. 复杂构图不能只靠 patch。  
   几何体、点、线、面、测量值之间有依赖关系，直接让 AI 写实体树容易出现坐标错误、漏字段、测量值乱写、内置结构不同步等问题。

2. 结构性能力必须由模板确定性执行。  
   AI 输出 `setGeometry`、`addSegmentByLabels`、`addCenterPoint`、`addDistanceMeasurement` 等操作，模板用已有几何引擎计算点位、面、距离和角度。

3. 多步操作必须具备事务语义。  
   M01 的 operation queue 支持顺序执行，任何一步失败都回滚到执行前快照，避免半成品污染画布。

M01 当前能力形态：

- `ai-capability.json` 描述模板支持的 operations、payloadSchema、constraints、examples、planningRules。
- `aiContext` 提供当前画布中的几何体、点名、线段、面和 label 协议。
- `aiOperations` 执行结构化操作队列。
- 后端过滤器放行并校验模板声明过的 operation。
- 前端应用 AI 结果时优先执行 operations，patch 只用于低风险兜底。

## 2. 接入等级

后续模板不需要一次性做到 M01 的复杂度，建议按等级推进。

### L1：参数型 AI

适合参数面板清晰、结构变化少的模板。

AI 输出低风险 patch，修改已有 snapshot payload 字段，例如：

- 选择预设
- 调整参数
- 切换显示模式
- 设置颜色、标签、显隐

必要条件：

- 已有 `getSnapshot` / `loadSnapshot` / `validateSnapshot`
- 有 `ai-capability.json`
- `payloadSchema` 能覆盖 AI 可修改字段

优先模板：

- `visual_chem08`
- `visual_chem06`
- `visual_m05`
- 部分 `chemistry_zhd` 工具

### L2：操作型 AI

适合存在新增对象、复杂依赖或计算派生结果的模板。

AI 输出 operation queue，由模板确定性执行，例如：

- 新增函数、向量、物体、光线、几何实体
- 加载专题场景
- 添加测量、辅助线、切线、法线、投影
- 多步构图

必要条件：

- 已有 snapshot bridge
- 有模板内操作执行器
- 有失败回滚
- 后端 operation 白名单已同步
- 有 aiContext 或等价上下文

优先模板：

- `M02-math`
- `visual_m06`
- `phys_template_p03`
- `phys_template_mechanics`
- `visual_chem02`
- `visual_chem05`

### L0：暂不接 AI

适合 snapshot/bridge 尚不稳定，或模板内部状态还没有收敛的模板。

先完成 snapshot bridge，再考虑 AI。

## 3. 推荐统一架构

每个模板接入 AI 助手时，建议形成以下模块：

```text
template/
  ai-capability.json
  src/
    runtime/
      aiContext.ts       # 可选，L2 推荐
      aiOperations.ts    # L2 必需
    templateBridge.ts    # 已有或新增
```

调用链：

```text
用户自然语言
  -> 后端读取 capability + 当前 snapshot + aiContext
  -> LLM 输出 operations / patch / warnings / explanation
  -> 后端过滤未知字段和未知 operation
  -> 前端宿主调用模板执行 operations 或合并 patch
  -> 模板 validate / load / rollback
```

推荐输出格式：

```json
{
  "operations": [],
  "patch": {},
  "warnings": [],
  "explanation": ""
}
```

模板应明确：

- 什么需求用 operation
- 什么需求允许 patch
- 哪些字段禁止 AI 修改
- 缺少对象时返回 warnings，不要猜

## 4. capability 编写原则

### 4.1 描述要短，规则要硬

M01 后期验证表明，过长的 prompt 会带来成本、延迟和规则冲突风险。能力描述应避免百科式说明，只保留影响规划的内容：

- operation 类型
- payload 结构
- useWhen / doNotUseWhen
- 关键 constraints
- 少量代表性 examples
- 通用 planningRules

不建议保留：

- 重复的教学焦点说明
- 过多同义句
- 与 AI 决策无关的 UI 介绍
- 大段知识点解释

### 4.2 结构性目标优先 operation

以下情况应使用 operation，不建议 patch：

- 新增对象
- 删除或隐藏一组对象
- 根据标签查找对象
- 需要模板引擎计算坐标、数值、路径
- 多步依赖构图

以下情况可以使用 patch：

- 修改已有低风险字段
- 调整参数
- 切换显示开关
- 修改颜色、标签、样式

### 4.3 规划规则要通用

不要针对单个测试 case 写规则。优先沉淀为通用规则：

- 识别所有可见目标，不漏后续操作。
- operation queue 必须做依赖闭包检查。
- 引用的标签必须来自当前上下文、本次创建结果或计划几何体标准标签。
- 缺失或歧义时返回 warnings，不同时输出依赖该信息的 operation。
- 测量值由模板计算，AI 不写数值。
- 明确给出测量对象时，不由 AI 判断是否可测，交给模板执行器判断。

## 5. aiContext 设计

L2 模板建议提供 aiContext，帮助 AI 知道“当前能操作什么”。

最小结构：

```ts
type TemplateAiContext = {
  templateKey: string
  summary: string
  availableEntities: Array<{
    id: string
    type: string
    label?: string
    visible?: boolean
  }>
  constraints: string[]
}
```

对象型模板可以扩展：

- 点名、线段、面
- 函数名、曲线 id、关键点
- 向量 id、起点、终点
- 光学元件、光线、模块
- 物理物体、力、关节、场景模板

注意：

- aiContext 是给 planner 用的，不是完整 snapshot 复制。
- 只放 AI 做决策需要的摘要。
- 避免塞入大量模拟结果或渲染缓存。

## 6. operation queue 设计

operation 应满足四个条件：

1. 有限集合：类型必须在 capability 中声明。
2. payload 清晰：字段名稳定，枚举有限。
3. 可校验：后端可做基础过滤，模板可做完整校验。
4. 可回滚：执行前保存快照，失败恢复。

推荐执行器结构：

```ts
export function applyAiOperations(operations: unknown[]): {
  ok: boolean
  applied: number
  errors: string[]
  rolledBack?: boolean
}
```

执行原则：

- 一次 AI 请求中的 operations 视作一个事务。
- 执行前 clone 当前 snapshot。
- 每步执行后进入下一步。
- 任一步失败，loadSnapshot 回到 before。
- 成功后把整体结果压入 undo history，而不是每步散落。

## 7. 后端同步要求

后端过滤器必须与模板 capability 同步，否则会出现“模型输出正确，但后端误拦截”的问题。

后端需要做：

- 读取 capability 中声明的 operation 类型。
- 仅允许白名单 operation。
- 对 payload 做轻量校验。
- 不尝试替模板执行复杂业务校验。
- 对未知字段剥离或丢弃。

后端不应做：

- 不应硬编码模板业务计算。
- 不应根据几何/物理知识提前拒绝明确对象的测量。
- 不应把 AI 输出的实体树直接透传给复杂模板。

## 8. 评测方法

每个 L2 模板至少准备一组 planning eval。

建议分类：

- 基础创建
- 参数修改
- 预置场景
- 新增对象
- 样式/标签/显隐
- 多步组合
- 测量/计算
- 缺失对象/歧义输入
- 负例

评测不要只看严格 JSON 完全一致，也要加入语义评分。例如：

- `addMidpointByLabels(A,B)` 与 `addPointOnEdge(A,B,t=0.5)` 可视为语义等价。
- patch 修改样式与 `setStyle` 可视为同类结果。
- 合理 warning 文案不应要求逐字一致。

评测目标不是追满分，而是发现通用失败模式。

## 9. 现有模板接入建议

### 9.1 `visual_m01`

状态：L2 已基本完成。

后续只建议观察真实使用样本，不再主动堆 prompt。若出现问题，按以下分类处理：

- 模板能力缺口：新增 deterministic operation。
- planner 规则缺口：补通用 planningRule。
- 评测 oracle 问题：调整评分，不改业务。

### 9.2 `M02-math`：函数 / 解析几何 / 三角函数

现状：

- 已有 `templateBridge.ts`
- 多个子模板共用一个工程
- 多个 store 已具备 `loadSnapshot`

建议优先级：高。

推荐 L2，但分模块推进：

- M02 函数图像：`addFunction`、`updateFunction`、`setViewport`、`addTangent`、`addPointMarker`、`highlightIntersection`
- M03 解析几何：`addConic`、`setConicParams`、`addLine`、`addFocusDirectrix`、`markPoint`
- M04 三角函数：`setTrigFunction`、`setTransform`、`showUnitCircle`、`setAngle`、`addComparisonCurve`

关键点：

- capability 应按 `templateKey` 区分 m02/m03/m04，不要把三个模板的全部能力塞进同一个 prompt。
- aiContext 应暴露当前模块、已有函数/曲线/点名、当前 viewport。
- 函数表达式应由模板用 mathjs 校验，AI 不直接写运行时代码。

### 9.3 `visual_m05`：概率统计模拟器

现状：

- 已有 snapshot bridge。
- 文档中已强调大结果应保存 seed/params/summary，不保存全量随机结果。

建议优先级：高。

推荐先做 L1，再补少量 L2：

- L1：切换实验类型、调整试验次数、概率参数、图表显示。
- L2：`loadExperimentPreset`、`runSimulationWithSeed`、`addComparisonGroup`。

关键点：

- 不要让 AI 写大量模拟结果。
- 如果要“生成一组实验数据”，优先输出 seed + 参数，由模板重算。
- AI 可设置“演示目标”，例如“大数定律演示”“二项分布对比”。

### 9.4 `visual_m06`：向量运算演示台

现状：

- 已有 snapshot bridge。
- 有 Three.js 依赖，适合对象级 operation。

建议优先级：高。

推荐 L2：

- `addVector`
- `setVector`
- `addResultant`
- `addProjection`
- `addDotProductMeasurement`
- `addCrossProductMeasurement`
- `setCoordinateSystem`
- `loadPresetScene`

关键点：

- aiContext 需要暴露已有向量标签、坐标、可用坐标系。
- AI 不直接写三维渲染对象，只写向量定义和操作。
- 计算结果由模板向量引擎生成。

### 9.5 `phys_template_p03`：光学实验台

现状：

- 已有 `snapshot-bridge.ts`
- 模块包括 refraction、lens、doubleslit、diffraction、thinfilm。

建议优先级：高。

推荐 L1 -> L2：

- L1：切换模块、主题、光线粗细、实验参数。
- L2：`loadOpticsModule`、`setMedium`、`addLens`、`setObjectDistance`、`addRay`、`setSlitParams`、`setFilmParams`。

关键点：

- capability 应按 activeModule 组织，避免所有光学模块规则混在一起。
- aiContext 暴露当前模块和模块内关键参数。
- 曲线/干涉条纹等结果由模板计算，不由 AI 写结果数组。

### 9.6 `phys_template_mechanics`：力学模板总入口

现状：

- 已有 template bridge。
- 内部已经有模板目录、命令/校验器、场景模型和物理引擎。

建议优先级：中高。

推荐 L2，但应复用现有命令体系：

- `loadMechanicsPreset`
- `addBody`
- `addForce`
- `addJoint`
- `setBodyParams`
- `setSimulationParams`
- `runOrResetSimulation`
- `setVisibility`

关键点：

- 不要让 AI 写完整物理世界状态。
- 优先让 AI 输出已有 command program 或少量 scene operation。
- 物理合法性由现有 validator 判断。
- 时间轴、逐帧轨迹、播放状态不进入 AI 可恢复能力。

### 9.7 `phys_template_p01`：物理沙盒

现状：

- 未在扫描结果中看到统一 template bridge。
- 有 simulation store 和 mechanics domain。

建议优先级：中。

推荐先补 L1 基础：

- 完成 snapshot bridge。
- 明确 payload 中哪些状态可保存。
- 先支持预设加载、参数修改、显示开关。

再考虑 L2：

- `addBlock`
- `addForce`
- `addConnector`
- `setMass`
- `setFriction`

### 9.8 `visual_chem02`：分子结构查看器

现状：

- 已有 snapshot bridge。
- 有分子数据、元素/结构数据源。

建议优先级：中高。

推荐 L1 -> L2：

- L1：选择分子、切换球棍/空间填充/标签、显示极性/杂化/VSEPR 信息。
- L2：`loadMolecule`、`highlightAtom`、`highlightBond`、`showFunctionalGroup`、`compareMolecules`。

关键点：

- AI 只能引用数据集中存在的 molecule id、atom id、bond id。
- 如果用户说的物质无法匹配，应 warning，不要编造结构。
- 分子结构由数据源/引擎提供，不由 AI 写坐标。

### 9.9 `visual_chem05`：晶体结构查看器

现状：

- 已有 snapshot bridge。
- 有晶体数据和结构引擎。

建议优先级：中高。

推荐 L2：

- `loadCrystal`
- `setUnitCellRepeat`
- `highlightIon`
- `highlightCoordinationPolyhedron`
- `showVoid`
- `setRepresentation`

关键点：

- AI 不写晶胞坐标。
- 高亮对象必须来自当前晶体数据。
- 如果需要“解释配位数/空隙”，优先通过模板已有计算或数据字段展示。

### 9.10 `visual_chem06`：电化学演示台

现状：

- 已有 snapshot bridge。
- 更偏参数/场景型。

建议优先级：中。

推荐 L1：

- 选择电池/电解池模型。
- 切换场景。
- 调整电极、电解质、浓度、外电路显示。
- 控制离子流、电子流、标签显隐。

少量 L2：

- `loadElectrochemScenario`
- `setReactionModel`
- `highlightElectrode`
- `showIonFlow`

关键点：

- 反应式和电极过程优先来自模板内置模型。
- AI 不直接写化学反应计算结果。

### 9.11 `visual_chem08`：酸碱滴定与 pH 模拟器

现状：

- 已有 snapshot bridge。
- 参数结构清晰，适合快速做 L1。

建议优先级：高。

推荐 L1：

- 设置酸/碱类型。
- 设置浓度、体积、滴定剂。
- 切换指示剂。
- 显示等量点、缓冲区、滴定曲线。

可选 L2：

- `loadTitrationPreset`
- `markEquivalencePoint`
- `markBufferRegion`
- `compareIndicators`

关键点：

- pH 曲线、等量点由模板计算。
- AI 只改参数或请求标记，不写曲线采样数组。

### 9.12 `chemistry_zhd`

现状：

- 单仓多工具，多数以 distEntry 区分。
- 各工具复杂度差异较大。

建议优先级：按工具拆分。

推荐：

- C03 方程式配平：L1/L2，`setEquation`、`balanceEquation`、`showSteps`。
- C04 元素周期表：L1，筛选元素、突出族/周期、显示性质。
- C07 反应速率与平衡：L1，调温度、浓度、催化剂、平衡条件。
- C09 有机反应路径：L2，加载反应类型、添加路径、高亮官能团。

关键点：

- 每个 distEntry 应有独立 templateKey 和 capability。
- 不建议为整个 `chemistry_zhd` 写一个巨大的 capability。

## 10. 接入步骤

每个模板建议按以下顺序推进：

1. 确认 snapshot bridge 可用。
2. 梳理当前 payload 中哪些字段 AI 可安全修改。
3. 编写最小 `ai-capability.json`。
4. 先支持 L1 patch。
5. 如果存在新增对象或复杂依赖，再设计 operations。
6. 实现 `aiOperations.ts`。
7. 实现 `aiContext.ts`。
8. 同步后端 operation 白名单。
9. 补 smoke 测试和 planning eval。
10. 用 SQL 或 Admin API 更新数据库 capabilities。

## 11. 验收清单

L1 验收：

- 能从当前 snapshot 生成合法 patch。
- patch 只修改 capability 允许字段。
- validate 失败能回滚。
- 缺失信息会 warning。
- 前端交互不遮挡模板主要画布。

L2 验收：

- 每个 operation 有明确 payload schema。
- 后端不过滤合法 operation。
- 模板执行器能顺序执行。
- 失败能整体回滚。
- aiContext 能减少错误引用。
- 有至少 20 条 planning eval，覆盖正例、组合、负例。

## 12. 常见风险

### prompt 过长

风险：成本高、延迟高、模型注意力分散、规则冲突。

处理：

- 删除重复描述。
- 按模块拆 capability。
- 用短 examples 覆盖关键模式。

### 测试集过拟合

风险：评测变好，真实输入变差。

处理：

- 只补通用规则。
- 保留真实失败样本分类。
- 不为单个用例写硬规则。

### AI 编造对象

风险：引用不存在的点、函数、物体、分子、晶体对象。

处理：

- aiContext 暴露 available labels。
- planningRules 明确禁止猜测。
- 模板执行器二次校验。

### 结果数据过大

风险：snapshot 膨胀、LLM prompt 膨胀、恢复慢。

处理：

- 保存参数、seed、摘要。
- 可重算结果不进 snapshot。
- AI 不写大数组。

### 后端误拦截

风险：模板已支持 operation，但后端过滤掉。

处理：

- 每次新增 operation 同步后端过滤器。
- 增加过滤器单测。
- planning eval 要覆盖新增 operation。

## 13. 推荐推进顺序

第一批：

1. `visual_chem08`
2. `visual_m05`
3. `M02-math` 中的 M02 函数图像
4. `phys_template_p03`

原因：已有 snapshot bridge，参数结构或模块边界相对清晰，能较快出效果。

第二批：

1. `visual_m06`
2. `visual_chem02`
3. `visual_chem05`
4. `visual_chem06`

原因：需要对象级操作或数据源约束，但确定性引擎较清晰。

第三批：

1. `phys_template_mechanics`
2. `phys_template_p01`
3. `chemistry_zhd` 中复杂专题工具

原因：状态复杂、物理/化学业务约束更强，应先收敛 snapshot 和 command/operation 边界。

## 14. 最终建议

后续模板接入 AI 助手时，不要直接复制 M01 的 operation 列表，而应复制 M01 的方法论：

- 模板自己定义有限操作原语。
- AI 只规划，不直接写复杂实体树。
- 上下文只给可决策摘要。
- 执行器负责确定性计算。
- 失败整体回滚。
- 评测驱动优化，但只沉淀通用规则。

这样每个模板可以按照自己的业务复杂度逐步升级，从 L1 参数助手走向 L2 结构化构建助手。
