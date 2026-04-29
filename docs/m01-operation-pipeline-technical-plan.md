# M01 Operation Pipeline 技术方案

## 1. 背景与目标

M01 现有 AI 能力已经支持：

- `setGeometry` 创建/切换基础几何体；
- `loadPresetScene` 载入高频通用题图；
- `addSegmentByLabels`、`addPointOnEdge`、`addCrossSectionByLabels` 等少量结构性操作；
- `setStyle`、`setLabel`、`setVisible` 对已有实体做低风险修改。

当前问题是：当用户需求不完全命中 preset，又超过单步操作能力时，AI 容易退化为“不知道怎么做”、误选不合适的 preset，或试图通过 patch 写底层实体树。

Operation Pipeline 的目标是：让 AI 用一组受控、可验证、可回滚的 operations 表达“构图步骤”，由 M01 执行器负责几何合法性、实体创建、测量计算和失败回滚。

最终形态：

```text
用户自然语言需求
  -> AI 选择最小充分 operation 序列
  -> M01 校验并顺序执行
  -> 任一步失败则回滚到执行前快照
  -> 返回成功说明或失败 warnings
```

## 2. 设计原则

### 2.1 最小充分步骤

简单需求仍然只输出一步。

示例：

```json
{
  "operations": [
    {
      "type": "setGeometry",
      "geometryType": "sphere",
      "params": { "radius": 2 }
    }
  ],
  "explanation": "已生成半径为 2 的球体。"
}
```

规则：

- 能用单个 operation 完成时，不额外拆步骤；
- 命中明确专题时，优先 `loadPresetScene`；
- 在当前图上增量修改时，只输出必要增量 operations；
- 只有用户需求包含多个教学元素时，才输出多步 pipeline。

### 2.2 高层原语优先

AI 不直接写 `scene.entities`。它只调用 M01 暴露的教学构造原语。

例如：

- AI 可以说“创建外接球”：`addCircumsphere`；
- AI 不可以手写一个 `circumSphere` entity；
- AI 可以说“测量 OA”：`addDistanceMeasurement`；
- AI 不可以伪造 `distanceValue`、`distanceLatex`。

### 2.3 模板负责确定性

所有几何一致性由 M01 决定：

- 点是否存在；
- 点是否属于同一几何体；
- 中点/中心点坐标如何计算；
- 截面是否合法；
- 外接球半径如何计算；
- 角度/距离值如何计算；
- 失败时恢复到执行前状态。

## 3. Operation 分层

### 3.1 L1：已有稳定原语

这些已在 `visual_m01/src/runtime/aiOperations.ts` 中实现，应继续保留。

| operation | 用途 | 备注 |
|---|---|---|
| `setGeometry` | 创建/切换主几何体 | 基础入口 |
| `updateGeometryParams` | 更新当前几何体参数 | 由模板重建内置点线面 |
| `loadPresetScene` | 载入预置场景 | 高频专题优先 |
| `addSegmentByLabels` | 按点名连线 | 已自动避免重复线段 |
| `addPointOnEdge` | 在棱上取点 | 当前只支持顶点之间取点 |
| `addCrossSectionByLabels` | 按点名生成截面 | 多面体截面核心能力 |
| `setStyle` | 修改线段样式 | 低风险 patch 替代 |
| `setLabel` | 修改标签 | 当前主要支持点名 |
| `setVisible` | 显隐实体 | 当前主要支持 entityIds/点名 |

### 3.2 L2：本轮建议新增原语

这些用于把非 preset 场景组合出来。

| operation | 用途 | 输入建议 | 验证规则 |
|---|---|---|---|
| `addMidpointByLabels` | 创建两点中点 | `{ labels: ["A","B"], label: "M" }` | 两点存在；可计算坐标或边约束 |
| `addCenterPoint` | 创建当前几何体中心 | `{ label: "O" }` | 当前存在主几何体；避免重复 label |
| `addFaceCenterPoint` | 创建指定面的中心 | `{ faceLabels?: ["A","B","C","D"], faceId?, label: "O1" }` | 面可解析；至少 3 点 |
| `addAuxiliaryFaceByLabels` | 按点名画辅助面片 | `{ labels: ["A","C","C1"], style? }` | 至少 3 个非共线点 |
| `addCircumsphere` | 添加外接球 | `{ geometryId? }` | 当前几何体不是 sphere；外接球可计算 |
| `addDistanceMeasurement` | 添加距离度量 | `{ kind, labels?, entityIds?, label? }` | 模板计算距离值 |
| `addAngleMeasurement` | 添加角度度量 | `{ kind, labels?, entityIds?, label? }` | 模板计算角度值 |

### 3.3 不暴露能力

| 能力 | 不暴露原因 |
|---|---|
| 直接写 `scene.entities` | 容易破坏 ID、约束、内置实体关系 |
| 直接改 `geometry.properties.params` | 不会自动重建内置实体 |
| 直接写 `distanceValue` / `angleRadians` | 测量值必须由模板计算 |
| 任意自由点坐标 | 容易构造出数学上不受约束的假点 |
| 动画、相机、hover、selected | 不属于 snapshot 可恢复能力 |

## 4. 执行器设计

### 4.1 入口

现有入口：

```ts
applyAiOperations(operations: unknown): Promise<BridgeOperationResult>
```

继续保持该入口，避免影响前端桥接协议。

### 4.2 返回结构

建议扩展为：

```ts
interface BridgeOperationResult {
  ok: boolean;
  errors: string[];
  applied: number;
  rolledBack?: boolean;
}
```

兼容现有调用方：原有字段不变，只新增可选字段。

### 4.3 事务回滚

执行前保存快照：

```ts
const before = useEntityStore.getState().getSnapshot();
```

执行策略：

```text
for each operation:
  validate payload
  execute operation
  applied += 1
  if failed:
    loadSnapshot(before)
    return { ok: false, errors, applied, rolledBack: true }
```

注意点：

- 回滚应恢复实体状态；
- 不继续执行后续步骤；
- `applied` 表示失败前已尝试成功的步骤数；
- 失败消息必须给 AI/教师可理解的原因，如“未找到点 G”“两个面没有公共棱”。

### 4.4 历史栈策略

短期方案：

- operation 内部继续复用 `useHistoryStore.execute(...)`；
- pipeline 失败时用 `loadSnapshot(before)` 恢复实体；
- 成功时保留每一步进入历史栈。

中期优化：

- 新增 pipeline batch command；
- 将整条 AI pipeline 作为一次 undo；
- 失败时不污染 undo stack；
- 成功后教师一次撤销即可撤销整次 AI 构图。

M01 当前已有 `BatchCommand`，后续可以将原语从“立即执行”改为“生成 command”，由 pipeline 统一 batch 执行。

## 5. 原语实现建议

### 5.1 点解析

继续复用：

- `findPointByLabelOrThrow`
- `findSegmentByLabelsOrThrow`

新增：

- `findFaceByLabelsOrThrow(labels)`
- `findEntityByLabelOrId`
- `resolveOperationTargets`

### 5.2 中心点与中点

`addMidpointByLabels`：

- 如果两点是同一几何体的顶点，优先创建 `constraint.type = "edge"` 且 `t = 0.5`；
- 如果不是顶点边关系，但能计算坐标，则创建 `constraint.type = "free"`；
- 默认 label 为 `M`，但应避免与已有点名冲突。

`addCenterPoint`：

- 对当前主几何体计算中心；
- 创建 `constraint.type = "free"`；
- 默认 label 为 `O`；
- 如果已有同名点，返回已有或报 warning，具体策略开发时统一。

### 5.3 外接球

`addCircumsphere`：

- 复用现有 `CreateEntityCommand('circumSphere', { geometryId })`；
- 如果已有外接球，直接返回成功；
- 如果当前几何体为 sphere，返回错误“球体本身不需要外接球”。

### 5.4 距离与角度

现有工具里已经有计算逻辑：

- `distanceTool.ts`
- `angleTool.ts`

开发时建议将公共计算函数抽到：

- `visual_m01/src/editor/measurements/distance.ts`
- `visual_m01/src/editor/measurements/angle.ts`

AI operation 与交互工具共同复用，避免两套计算逻辑。

`addDistanceMeasurement` 支持：

- `pointPoint`
- `pointLine`
- `pointFace`
- `lineLine`
- `lineFace`

`addAngleMeasurement` 支持：

- `lineLine`
- `lineFace`
- `dihedral`

测量值由 M01 计算并写入 entity，AI 不传测量值。

## 6. Capability 更新

新增或强化约束：

```text
operations 必须使用最小充分步骤；如果单个 operation 可满足用户意图，不要额外添加构造、标注或样式操作。
复杂构图可以输出多个 operations，M01 会按顺序执行并在失败时回滚。
AI 不得直接创建或修改 point/segment/face/circumSphere/angleMeasurement/distanceMeasurement 实体树。
中点、中心点、外接球、角度和距离必须通过对应 operation 创建，由 M01 确定性计算。
如果需求无法由已暴露 operations 表达，应返回 warnings 请求教师确认，而不是手写底层实体。
```

建议 capability 暴露 operation 列表：

```json
[
  "setGeometry",
  "updateGeometryParams",
  "loadPresetScene",
  "addSegmentByLabels",
  "addPointOnEdge",
  "addMidpointByLabels",
  "addCenterPoint",
  "addFaceCenterPoint",
  "addCrossSectionByLabels",
  "addAuxiliaryFaceByLabels",
  "addCircumsphere",
  "addDistanceMeasurement",
  "addAngleMeasurement",
  "setStyle",
  "setLabel",
  "setVisible"
]
```

## 7. 示例

用户需求：

```text
讲正方体外接球，标出球心、体对角线和半径。
```

AI 输出：

```json
{
  "operations": [
    {
      "type": "setGeometry",
      "geometryType": "cube",
      "params": { "sideLength": 2 }
    },
    {
      "type": "addCenterPoint",
      "label": "O"
    },
    {
      "type": "addSegmentByLabels",
      "labels": ["A", "C1"],
      "style": { "color": "#3498db", "dashed": false },
      "label": "AC1"
    },
    {
      "type": "addCircumsphere"
    },
    {
      "type": "addSegmentByLabels",
      "labels": ["O", "A"],
      "style": { "color": "#e74c3c", "dashed": false },
      "label": "OA"
    },
    {
      "type": "addDistanceMeasurement",
      "kind": "pointPoint",
      "labels": ["O", "A"],
      "label": "R"
    }
  ],
  "explanation": "已构造正方体外接球，标出球心 O、体对角线 AC1 和外接球半径 OA。"
}
```

如果 `addDistanceMeasurement` 失败：

```text
M01 恢复到执行前快照
返回 ok=false, rolledBack=true, errors=["未找到点 O"]
```

## 8. 开发步骤

### Phase 1：执行器事务化

- 为 `applyAiOperations` 增加执行前快照；
- 任一步失败立即停止；
- 恢复执行前快照；
- 返回 `rolledBack`；
- 补充最小测试或手动验证场景。

### Phase 2：新增 L2 构图原语

- `addMidpointByLabels`
- `addCenterPoint`
- `addCircumsphere`
- `addDistanceMeasurement`
- `addAngleMeasurement`

先做这 5 个，覆盖最核心 pipeline。

### Phase 3：补充面相关原语

- `addFaceCenterPoint`
- `addAuxiliaryFaceByLabels`
- 面 label/point-label 解析；
- `setVisible` 支持按线段标签/面点名解析。

### Phase 4：更新 capability 与 SQL

- 更新 `visual_m01/ai-capability.json`；
- 更新 `docs/update-m01-capabilities.mysql.sql`；
- 增加 pipeline 示例；
- 增加最小充分步骤约束。

### Phase 5：验证

- TypeScript 编译；
- 构建；
- 手动验证：
  - 单步：生成球体；
  - 两步：正方体连 AC1；
  - 多步：正方体外接球；
  - 失败回滚：引用不存在点；
  - preset：球截面圆面积仍直接载入 preset。

## 9. 收尾标准

M01 Operation Pipeline 初版完成标准：

- 简单需求仍稳定单步执行；
- 复杂需求可由多个 operations 构图；
- 不命中 preset 的常见场景可以通过原语组合完成；
- 失败不留下半成品；
- AI capability 明确禁止手写底层实体树；
- 文档可迁移到其它模板，形成“模板能力暴露与 operation pipeline”通用方法。
