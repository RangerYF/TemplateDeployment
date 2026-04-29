# M02 AI 助手接入技术方案

本文档基于 M02-math 当前代码结构和 M01 AI 助手接入经验整理，作为 M02 函数图像实验室接入 AI 助手的开发参考。

核心目标：让教师用自然语言快速搭建函数图像讲解场景，例如生成函数、设置参数、展示导数和切线、创建分段函数、调整视窗和样式。

## 1. 当前状态

M02 位于 `M02-math`，该工程同时承载三个模板：

- `/m02`：函数图像实验室。
- `/m03`：解析几何画板。
- `/m04`：三角函数演示台。

本阶段只接入 `templateKey = m02`，不要把 M03/M04 能力混入 M02 capability。

M02 已具备的基础能力：

- `src/templateBridge.ts` 已实现 snapshot bridge。
- `getM02Snapshot()` 会导出函数图像状态和参数动画状态。
- `useFunctionStore` 已支持函数列表、激活函数、视窗、显示特征、切线点和分段函数。
- `useParamAnimationStore` 已支持参数动画配置。
- `expressionEngine` 已支持 mathjs 表达式预处理、编译、求值、导数和数值导数。
- `AddFunctionCommand`、`UpdateFunctionParamCommand` 和 `historyStore` 已提供部分命令和撤销基础。

目前缺口：

- bridge 还没有 `getAiContext()`。
- bridge 还没有 `applyOperations()`。
- 没有 `ai-capability.json`。
- 没有 M02 专用 operation executor。
- snapshot 校验较浅，AI 写入前仍需要 operation 层做业务校验。
- M02 的 pinned points / pinned intersections 在 interaction store 中，不在当前 M02 snapshot 中，第一阶段不建议承诺点标记和交点钉住能力。

## 2. 接入策略

M02 建议采用 operation queue，而不是让 AI 直接 patch 函数对象。

原因：

- 新增函数需要生成 id、分配 label、限制数量。
- 表达式需要经过 `compileExpression` 校验。
- 模板函数需要根据 `FUNCTION_TEMPLATES` 生成默认参数和表达式。
- 切线斜率、导函数和函数值应由 M02 引擎计算，AI 不应手写。
- 多步请求需要事务回滚，避免生成半成品。

M02 的 patch 只作为低风险兜底，用于已有字段的简单显隐或 UI 状态；结构性搭建全部走 operations。

## 3. 能力边界

第一阶段建议支持：

- 新增标准函数。
- 新增模板函数。
- 修改已有函数表达式、标签、颜色、显隐。
- 修改模板函数参数。
- 修改函数变换参数 `a, b, h, k`。
- 新增分段函数。
- 设置视窗范围。
- 设置显示开关：网格、坐标轴、特征点、导函数。
- 指定函数在某个 `x` 处显示切线或创建切线函数。
- 设置参数动画配置，但不自动进入播放或录制状态。

第一阶段暂不支持：

- 钉住函数点。
- 钉住交点。
- 自动生成大量采样点。
- 让 AI 写导数表达式、切线斜率、函数值。
- 同时操作 M03/M04 状态。
- 修改渲染缓存、hover 状态、临时交互状态。

## 4. 推荐文件结构

```text
M02-math/
  ai-capability.json
  src/
    runtime/
      aiContext.ts
      aiOperations.ts
```

需要改造：

- `src/templateBridge.ts`
  - 增加 `getAiContext()`
  - 增加 `applyOperations()`
  - postMessage 支持 `getAiContext` 和 `applyOperations`

## 5. aiContext 设计

`aiContext` 不复制完整 snapshot，只给 planner 需要的摘要。

建议结构：

```ts
export interface M02AiContext {
  templateKey: 'm02';
  activeSkill: 'm02';
  summary: string;
  functions: Array<{
    id: string;
    label: string;
    mode: 'standard' | 'piecewise';
    exprStr: string;
    templateId: string | null;
    visible: boolean;
    color: string;
    transform: { a: number; b: number; h: number; k: number };
    namedParams: Array<{ name: string; label: string; value: number }>;
    segmentCount: number;
  }>;
  activeFunctionId: string | null;
  activeFunctionLabel: string | null;
  availableFunctionLabels: string[];
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number };
  features: {
    showDerivative: boolean;
    showTangent: boolean;
    tangentX: number | null;
    showFeaturePoints: boolean;
    showGrid: boolean;
    showAxisLabels: boolean;
  };
  supportedTemplateIds: string[];
  limits: {
    maxFunctions: 8;
  };
  constraints: string[];
}
```

关键规则：

- AI 优先用函数 label 引用已有函数。
- label 有歧义或不存在时返回 warnings，不输出依赖该函数的 operation。
- 当前没有函数时，“显示导数/添加切线/修改参数”必须先创建函数，或返回 warnings。
- 函数数量达到 8 时，新增函数返回 warnings。

## 6. Operation 设计

### 6.1 `addFunction`

用途：新增标准函数或模板函数。

payload：

```ts
{
  type: 'addFunction';
  label?: string;
  expression?: string;
  templateId?: 'linear' | 'quadratic' | 'cubic' | 'sine' | 'cosine' | 'exponential' | 'logarithm' | 'power';
  params?: Record<string, number>;
  transform?: Partial<{ a: number; b: number; h: number; k: number }>;
  color?: string;
}
```

执行规则：

- `expression` 和 `templateId` 至少提供一个。
- 有 `templateId` 时按 `FUNCTION_TEMPLATES` 创建默认参数，再合并 `params`。
- 有 `expression` 时用 `compileExpression` 校验。
- 不允许超过 8 个函数。
- 未给 label 时沿用现有标签序列：`f(x), g(x), h(x), p(x), q(x), r(x), s(x), t(x)`。

### 6.2 `updateFunction`

用途：修改已有函数。

payload：

```ts
{
  type: 'updateFunction';
  functionId?: string;
  label?: string;
  fromLabel?: string;
  expression?: string;
  params?: Record<string, number>;
  transform?: Partial<{ a: number; b: number; h: number; k: number }>;
  visible?: boolean;
  color?: string;
}
```

执行规则：

- 通过 `functionId` 或 `fromLabel` 找函数。
- 如果传 `expression`，必须重新编译校验。
- 如果传 `params`，目标函数必须有 `templateId` 和对应 `namedParams`。
- 修改参数后必须用 `buildTemplateExpr` 重建 `exprStr`。
- `transform.b` 不能为 0。

### 6.3 `addPiecewiseFunction`

用途：创建分段函数。

payload：

```ts
{
  type: 'addPiecewiseFunction';
  label?: string;
  segments: Array<{
    expression: string;
    xMin: number | null;
    xMax: number | null;
    xMinInclusive?: boolean;
    xMaxInclusive?: boolean;
  }>;
  color?: string;
}
```

执行规则：

- 至少一个 segment。
- 每段 expression 必须通过 `compileExpression` 校验。
- `xMin < xMax`，允许一端为 `null` 表示无穷。
- 不自动补全缺失分段，也不推断教师未说明的定义域。

### 6.4 `setViewport`

用途：调整坐标视窗。

payload：

```ts
{
  type: 'setViewport';
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
```

执行规则：

- `xMin < xMax`，`yMin < yMax`。
- 建议限制极端范围，避免画布不可读。

### 6.5 `setFeatureFlags`

用途：切换显示设置。

payload：

```ts
{
  type: 'setFeatureFlags';
  showDerivative?: boolean;
  showFeaturePoints?: boolean;
  showGrid?: boolean;
  showAxisLabels?: boolean;
  showTangent?: boolean;
}
```

执行规则：

- 如果打开导数或特征点，必须至少存在一个可见函数。
- `showTangent` 只负责显示切线状态；如果同时需要指定切点，使用 `setTangentAtX`。

### 6.6 `setTangentAtX`

用途：指定已有函数在某个横坐标处显示切线点。

payload：

```ts
{
  type: 'setTangentAtX';
  functionId?: string;
  label?: string;
  x: number;
}
```

执行规则：

- 目标函数必须存在且为标准函数。
- 用 M02 表达式引擎计算 `y` 和 `slope`。
- 如果结果不是有限数，operation 失败并回滚。
- AI 不允许提供 `tangentY` 或 `tangentSlope`。

### 6.7 `addTangentFunction`

用途：将某点切线创建为一条新的函数曲线。

payload：

```ts
{
  type: 'addTangentFunction';
  functionId?: string;
  label?: string;
  x: number;
  tangentLabel?: string;
  color?: string;
}
```

执行规则：

- 由模板计算 `y` 和 `slope`。
- 新函数表达式形如 `m*(x - x0) + y0`。
- 同样受函数数量上限限制。

### 6.8 `setParamAnimation`

用途：配置参数动画。

payload：

```ts
{
  type: 'setParamAnimation';
  functionId?: string;
  label?: string;
  params: Array<{
    key: string;
    from: number;
    to: number;
    enabled?: boolean;
  }>;
  duration?: number;
  easing?: string;
  loop?: boolean;
}
```

执行规则：

- 只设置动画参数、时长、缓动和循环。
- 不设置 `playState = playing`。
- 不开启 `recordEnabled`。
- `key` 只能引用已有 transform 或 named param，例如 `transform.a`、`transform.h`、`named.omega`。

## 7. 执行器设计

建议导出：

```ts
export interface BridgeOperationResult {
  ok: boolean;
  applied: number;
  errors: string[];
  rolledBack?: boolean;
}

export async function applyAiOperations(operations: unknown): Promise<BridgeOperationResult>
```

执行流程：

1. 校验 operations 是数组。
2. 执行前保存 `getM02Snapshot()`。
3. 按顺序执行每个 operation。
4. 任一步失败，调用 `loadM02Snapshot(before)` 回滚。
5. 成功后返回 `ok: true` 和 applied 数量。

第一版可以直接操作 store，但更推荐用 command 包装整体操作，保证 undo/redo 语义清晰。

如果短期内命令不足，可以先实现事务回滚，后续再补“一次 AI 请求作为一个 undo 步”的 composite command。

## 8. capability 编写建议

`ai-capability.json` 应保持精简，重点让模型知道：

- M02 是函数图像实验室。
- 结构性搭建必须用 operations。
- 表达式、导数、切线、函数值都由 M02 计算或校验。
- 引用已有函数必须来自 `aiContext.availableFunctionLabels`。
- 对象缺失或歧义时返回 warnings，不输出依赖该对象的 operation。
- 不要操作 M03/M04 payload。

建议 supportedIntents：

- `add-function`
- `update-function`
- `add-piecewise-function`
- `set-viewport`
- `adjust-function-transform`
- `show-derivative`
- `show-feature-points`
- `add-tangent`
- `adjust-function-style`
- `set-param-animation`
- `simplify-current-scene`

建议 examples 控制在 6-8 条：

- 生成二次函数并显示顶点/特征点。
- 生成正弦函数并调整振幅和周期。
- 创建分段函数。
- 给 `f(x)` 在 `x=1` 处添加切线。
- 把当前视窗设为 `[-5,5] x [-3,3]`。
- 把 `f(x)` 改成红色并显示导函数。
- 当用户要求修改不存在函数时返回 warning。

## 9. 后端同步

后端需要允许 M02 的 operation 类型：

- `addFunction`
- `updateFunction`
- `addPiecewiseFunction`
- `setViewport`
- `setFeatureFlags`
- `setTangentAtX`
- `addTangentFunction`
- `setParamAnimation`

后端只做基础白名单和 payload 类型过滤，不做表达式合法性、导数、切线、定义域等业务判断。

表达式能否解析、切线能否计算、函数是否存在，应由 M02 operation executor 决定。

## 10. 评测计划

建议先做 40 条左右 planning eval。

分类：

- 基础函数创建：线性、二次、三角、指数、对数。
- 自定义表达式：`x^2 - 2x + 1`、`sin(x)+cos(x)`。
- 参数修改：开口、振幅、周期、平移。
- 分段函数：两段、三段、半开区间。
- 导数和特征点：显示导函数、显示极值/零点。
- 切线：指定函数和 x。
- 视窗：范围调整。
- 样式：颜色、显隐、标签。
- 组合任务：生成函数 + 设置视窗 + 显示导数。
- 负例：函数不存在、表达式不合法、对象缺失、超过函数数量。

评分不要只做 JSON 严格匹配，应允许语义等价：

- `addFunction(templateId=quadratic, params={...})` 与等价 expression 可视为同类正确。
- 显示导数可以通过 `setFeatureFlags(showDerivative=true)` 完成。
- 切线必须由 `setTangentAtX` 或 `addTangentFunction` 完成，不能手写斜率。

## 11. 开发顺序

推荐顺序：

1. 实现 `src/runtime/aiContext.ts`。
2. 实现 `src/runtime/aiOperations.ts`，先覆盖 `addFunction`、`updateFunction`、`setViewport`、`setFeatureFlags`。
3. 改造 `templateBridge.ts`，暴露 `getAiContext` 和 `applyOperations`。
4. 编写 `ai-capability.json`。
5. 增加后端 M02 operation 白名单。
6. 增加基础 eval cases。
7. 补 `addPiecewiseFunction`、`setTangentAtX`、`addTangentFunction`。
8. 接入参数动画。
9. 跑评测并根据通用失败模式微调 planningRules。

## 12. 验收标准

M02 第一阶段完成可以按以下标准判断：

- 用户能用自然语言新增常见函数图像。
- 用户能要求调整函数参数和图像变换。
- 用户能要求显示导函数、特征点、切线。
- 用户能创建简单分段函数。
- 用户能调整视窗和基础样式。
- 缺失函数、表达式错误、对象歧义时能给出 warning，不污染画布。
- operation queue 失败会回滚。
- 后端不会误拦截 M02 合法 operations。
- 至少一轮 planning eval 能覆盖主要能力和负例。

