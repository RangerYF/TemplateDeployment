# M01 Operation Planning Optimization Plan

## Goal

把 M01 的 AI 构图链路稳定收束到：

```text
教师自然语言需求 -> 正确、完整、最小的 operation queue -> M01 确定性执行
```

其中 operation pipeline 负责执行、校验和回滚；planning 阶段负责把用户意图拆成可执行原语。当前最主要的不确定性在 planning 阶段，而不是 M01 执行器本身。

## Current Finding

后端 `app/services/visual_template_assist.py` 会在 LLM 输出后调用 `filter_operations_by_capability`。该过滤器目前只认识早期 operation：

- `setGeometry`
- `updateGeometryParams`
- `loadPresetScene`
- `addSegmentByLabels`
- `addPointOnEdge`
- `addCrossSectionByLabels`
- `setStyle`
- `setLabel`
- `setVisible`

因此即使 LLM 正确输出了新原语，例如 `addFaceCenterPoint`，后端也可能把它过滤掉，导致前端看不到 `O1`。这解释了“生成正方体，在底面 ABCD 的中心标 O1”未生效的一类可能原因。

## Problem Class 1: Operation Descriptions Are API-like, Not Decision-like

### Symptom

LLM 知道某个 operation 存在，但不知道什么时候必须使用，或者容易混淆相近原语。

例如：

- “几何体中心”应使用 `addCenterPoint`
- “底面中心 / 面 ABCD 的中心”应使用 `addFaceCenterPoint`
- “AB 中点”应使用 `addMidpointByLabels` 或 `addPointOnEdge`

### Optimization

把 capability 中每个 operation 的描述升级为“意图路由表”：

- `useWhen`: 什么时候使用
- `requiredWhenUserSays`: 用户出现哪些表达时必须使用
- `doNotUseWhen`: 相似但不该使用的场景
- `payloadRules`: payload 字段约束和点名规则

少量 examples 用来校准格式，不用于穷举所有自然语言说法。

## Problem Class 2: Missing Intermediate Planning

### Symptom

LLM 可能只完成主体几何体，漏掉用户句子里的后续可见目标。

例如：

```text
生成正方体，在底面 ABCD 的中心标 O1
```

正确拆解应是：

1. 创建正方体
2. 定位底面 `A,B,C,D`
3. 创建该面的中心点
4. 设置标签 `O1`

### Optimization

在 capability 或后端 system prompt 中增加 planning rules：

- 先识别所有可见构图目标，再生成 operations。
- 每个可见目标必须有对应 operation。
- operation queue 必须最小充分。
- 简单需求允许单 operation；复杂需求才输出多步数组。
- 如果点名或面名缺失，返回 `warnings`，不要猜。
- 做 operation 依赖闭包检查：每个 operation 引用的点名、面名、实体或标签，必须来自当前 snapshot/aiContext、本次 setGeometry 的标准点名，或来自前序 operation 的确定性输出。
- 如果后续 operation 需要中间实体，例如几何体中心 `O`、面中心 `O1`、中点 `M`，先输出创建 operation，再输出依赖它的测量、连线或样式 operation。

建议 planning 目标类别：

- 主体几何体
- 新点：中点、中心点、面中心、边上点
- 新线段
- 截面或辅助面
- 外接球
- 距离度量
- 角度度量
- 标签、样式、显隐

## Problem Class 4: Measurement Planning Should Not Become Geometry Solving

### Symptom

LLM 可能在 planning 阶段提前判断两条线是否平行、相交、异面，或者解释说添加了二面角但实际没有输出 operation。

### Optimization

- 当教师已经明确给出测量对象的点名、线名或面名时，AI 不自行判定是否可测，只输出 `addDistanceMeasurement` / `addAngleMeasurement`，由 M01 确定性计算数值或失败原因。
- 当测量对象不完整时，返回 `warnings`，不要默认选择点、线、面或二面角。
- 如果指定两个面来求二面角，必须输出 `addAngleMeasurement(kind=dihedral)`，并提供 `faceLabels` 或 `entityIds`；解释中不能声称已添加角度但 operations 为空。

## Problem Class 3: Execution Success Is Not Intent Success

### Symptom

operation pipeline 成功执行了 `setGeometry`，但用户要求的 `O1` 没有出现。技术上执行成功，产品上意图失败。

### Optimization

增加离线 test oracle。线上 result validator 暂不启用硬拦截；当前阶段优先暴露模型输出问题，避免把错误静默过滤掉：

- 检查 expected operation sequence
- 检查 snapshot 中是否出现目标实体
- 检查是否错误使用 preset
- 检查是否手写实体树或非法 patch

线上未来可选策略：

- 如果关键目标缺失，触发二次规划。
- 如果缺失点名或面名，返回 warning。
- 如果 operation 被后端过滤，记录过滤原因，便于调试。

## Preset Policy

`loadPresetScene` 不取消，但降级为明确专题快捷入口。

### Allow

只在用户明确要求专题讲解图时使用，例如：

- “我要讲球截面圆面积，直接进入合适图”
- “给我一个正方体外接球专题图”
- “我要讲二面角通用图”

### Avoid

以下普通构图需求不应使用 preset：

- 生成一个基础几何体
- 连接两点
- 添加中点、中心点、面中心
- 作截面或辅助面
- 添加距离或角度度量
- 调整标签、样式、显隐

对于普通构图，优先输出 operation queue。不要为了省步骤而选择 preset。

## Backend Changes Required

后端需要同步升级 `filter_operations_by_capability`，否则新原语即使出现在 capability 和 LLM 输出中，也会被过滤掉。

当前状态：已在 `D:\repo\Backend\edu-mind-ai-backend\app\services\visual_template_assist.py` 放行以下新增 operation，并补充了局部单元测试 `tests/test_visual_template_assist_operations.py`。

需要支持的新 operation：

- `addMidpointByLabels`
- `addCenterPoint`
- `addFaceCenterPoint`
- `addCircumsphere`
- `addAuxiliaryFaceByLabels`
- `addDistanceMeasurement`
- `addAngleMeasurement`

同时建议在 assist result 中增加调试信息：

- raw operation count
- filtered operation count
- dropped operation types and reasons

这样端到端测试时可以区分：

- LLM 没生成
- LLM 生成了但后端过滤
- 后端放行但 M01 执行失败
- M01 执行成功但渲染不符合预期

## Test Strategy

建立批量 planning cases，每条包含：

- `instruction`
- `expectedOperationTypes`
- `forbiddenOperationTypes`
- `expectedEntities`
- `expectedWarnings`
- `notes`

测试目标不是一次性证明全部正确，而是反复暴露 planning 漏洞，迭代 capability、system prompt 和过滤器。

## Automated Planning Evaluation

已新增脚本：

```text
visual_m01/scripts/evaluate-ai-planning.mjs
```

脚本会生成约 100 条 M01 自然语言需求，调用后端 assist 接口，并按以下维度计算正确率：

- strict score: `expectedOperationTypes` 是否与实际 operation type 序列精确一致
- semantic score: 允许 patch 等价于样式/标签/显隐 operation，允许中点原语的等价表达
- `forbiddenOperationTypes` 是否未出现
- 需要 warning 的反例是否返回了相关 warning
- 按 category 汇总正确率
- 输出 top failure reasons
- 单 case 请求有超时保护，避免 SSE 卡住整轮评测

Dry run 查看用例：

```bash
cd visual_m01
npm run eval:planning -- --dry-run --limit=100
```

真实评测需要有效登录 token 和一个属于该用户的 M01 instance id：

```bash
cd visual_m01
M01_ASSIST_BASE_URL=http://localhost:8000 \
M01_ASSIST_TOKEN=<bearer-token-without-Bearer-prefix> \
M01_INSTANCE_ID=<m01-instance-id> \
npm run eval:planning -- --limit=100
```

默认报告输出到：

```text
visual_m01/results/ai-planning-eval.json
```
