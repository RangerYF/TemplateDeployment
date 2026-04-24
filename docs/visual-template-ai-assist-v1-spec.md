# 可视化模板 AI 辅助搭建 — V1 最终技术规格

基于 [visual-template-ai-assist-v1.md](visual-template-ai-assist-v1.md) 方案审查讨论后的最终结论。
本文档是 AI 辅助搭建功能的**唯一实施依据**，包含全部已确认的技术决策、接口定义和边界条件。

---

## 0. 开发依赖文档

开发 AI 辅助搭建功能需要配合以下文档使用：

| 文档 | 路径 | 用途 | 开发时参考频率 |
|------|------|------|--------------|
| **本文档（V1 技术规格）** | `docs/visual-template-ai-assist-v1-spec.md` | AI 助手的接口定义、数据流、决策记录 | **主要依据，高频** |
| **V1 方案文档** | `docs/visual-template-ai-assist-v1.md` | 产品背景、问题定义、方向判断 | 理解"为什么这样做"时查阅 |
| **平台开发任务文档** | `docs/visual-template-platform-task-plan.md` | 模板平台的 CRUD 闭环、bridge 协议、保存策略、角色分工 | 理解已有基础设施时查阅 |
| **平台总体设计稿** | `docs/visual-template-platform-design.html` | 平台架构全貌、数据模型关系 | 做架构决策时查阅 |
| **模板接入指南** | `visual_m05/docs/template-snapshot-bridge-guide.md` | bridge 协议详细说明、模板侧接入步骤 | 编写 `ai-capability.json` 或调试 bridge 时查阅 |

**日常开发只需要看本文档**。其余文档在需要理解上下文或排查问题时按需查阅。

---

## 1. 已确认的核心决策

| # | 决策项 | 结论 |
|---|--------|------|
| 1 | AI 输出形式 | **Patch**（非整份 snapshot、非 configDraft） |
| 2 | Patch 合并策略 | **Deep merge**（递归合并嵌套对象，使用 `lodash-es` 的 `merge`） |
| 3 | Patch 作用范围 | **只修改 payload**，envelope 由宿主自动维护 |
| 4 | 模板能力描述存储 | **模板仓库静态文件** `ai-capability.json`，通过**后端 Admin API** 录入数据库 |
| 5 | 多轮对话上下文 | **无状态**：每次只传当前 snapshot + 最新指令（但前端对话框保留本次会话的交互历史） |
| 6 | validate 失败处理 | **V1 不做自动修正**，直接回滚 + 提示用户 |
| 7 | 模板 key 标准 | 以 **apps.manifest.json** 的 `id` 为准（`chem02`、`m01`、`c03` 等） |
| 8 | 响应模式 | **SSE 流式** |
| 9 | SSE 事件格式 | 沿用现有 `data.type` 模式（`data: {"type": "thinking", ...}`），不使用 SSE 命名事件 |
| 10 | SSE 链路 | 前端 → **BFF 代理** → 后端 |
| 11 | LLM 提供商 | **可配置 / 多模型**，新增独立配置 `DEFAULT_TEMPLATE_ASSIST_MODEL` |
| 12 | LLM 调用位置 | **后端** |
| 13 | Patch 合并位置 | **前端宿主** |
| 14 | AI 助手 UI 位置 | **工作台页宿主层**，非模板内部 |
| 15 | AI 修改后保存 | **只应用不自动保存**，保存由教师手动触发 |
| 16 | JSON 输出保障 | **Prompt 约束 + 后置 `try_parse_json()` 解析**，解析失败返回 error 事件 |
| 17 | Patch 过滤 | **后端过滤**：只保留 `payloadSchema` 中定义过的字段，剥掉 LLM 幻觉字段 |
| 18 | 对话框历史 | **保留本次会话内的交互历史**（前端内存，刷新即清除） |
| 19 | payloadSchema 结构 | **与实际 payload 嵌套结构一致**（非平铺点号路径） |
| 20 | AI 行为日志 | **应用日志**（Python logging），V1 不建表 |
| 21 | 能力描述录入 | 通过**后端 Admin API** 上传 `ai-capability.json`，不依赖跨仓库 seed |
| 22 | Deep merge 依赖 | 前端新增 **`lodash-es`** 依赖 |

---

## 2. 接口定义

### 2.1 后端 API

#### `POST /api/v1/visual-center/assist`

SSE 流式响应。

**请求体：**

```typescript
interface AssistRequest {
  templateKey: string       // apps.manifest.json 中的 id，如 "chem02"
  instanceId: string        // 当前实例 ID
  currentSnapshot: {        // 完整的当前 snapshot
    envelope: SnapshotEnvelope
    payload: object
  }
  instruction: string       // 教师自然语言指令
}
```

**SSE 事件流（沿用 `data.type` 模式，与 visualize/lectures 一致）：**

```
data: {"type": "thinking", "content": "正在分析您的需求，将调整温度和催化剂参数..."}

data: {"type": "thinking", "content": "生成参数调整方案..."}

data: {"type": "result", "patch": {"controls": {"temperature": 725}}, "explanation": "已将反应温度调整为 725K", "warnings": []}

data: {"type": "error", "code": "LLM_TIMEOUT", "message": "AI 生成超时，请重试"}

data: {"type": "done"}
```

前端通过 `data.type` 字段区分事件类型，复用现有 `use-sse.ts` 的解析逻辑。

**错误码：**

| 错误码 | 说明 |
|--------|------|
| `LLM_TIMEOUT` | LLM 调用超时 |
| `LLM_INVALID_OUTPUT` | LLM 输出无法解析为合法 JSON |
| `TEMPLATE_NOT_SUPPORTED` | 模板不支持 AI 搭建（aiLevel < L1） |
| `CAPABILITY_NOT_FOUND` | 未找到模板能力描述 |
| `RATE_LIMITED` | 调用频率超限 |

### 2.2 前端 BFF 代理

#### `POST /api/visual-center/assist`

直接代理到后端 `/api/v1/visual-center/assist`，复用现有 `backendSSEProxy` 逻辑。
鉴权：从 httpOnly cookie 提取 token，转为 Bearer header。

### 2.3 Bridge 协议（已有，此处确认）

模板通过 `postMessage` 暴露以下方法，namespace 为 `edumind.templateBridge`：

| 方法 | 请求 payload | 响应 payload |
|------|-------------|-------------|
| `getSnapshot` | 无 | `{ envelope, payload }` |
| `loadSnapshot` | `{ envelope, payload }` | `void`（success: true/false） |
| `validateSnapshot` | `{ envelope, payload }` | `{ ok: boolean, errors: string[] }` |

超时：5000ms（前端 bridge.ts 已实现）。

---

## 3. 数据流

```
教师输入指令
    │
    ▼
┌─────────────────────────────────────┐
│  前端工作台宿主                      │
│                                     │
│  1. 调 bridge getSnapshot()         │
│  2. 构造 AssistRequest              │
│  3. POST /api/visual-center/assist  │
│     (SSE)                           │
│  4. 展示 thinking 事件内容           │
│  5. 收到 result 事件                │
│  6. deep merge patch 到当前         │
│     snapshot.payload                │
│  7. 更新 envelope.updatedAt        │
│  8. 调 bridge validateSnapshot()    │
│  9a. ok → 调 bridge loadSnapshot()  │
│  9b. !ok → 回滚到修改前 snapshot    │
│      并展示 errors                  │
│ 10. 教师手动点"保存"时              │
│     调用现有实例更新接口             │
└─────────────────────────────────────┘
         │ SSE
         ▼
┌─────────────────────────────────────┐
│  前端 BFF (/api/visual-center/...)  │
│  代理转发 + 鉴权                     │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  后端 /api/v1/visual-center/assist  │
│                                     │
│  1. 读取模板能力描述                  │
│     (从 DB capabilities 字段)        │
│  2. 构造 system prompt              │
│  3. 拼装：                           │
│     - system prompt                 │
│     - 能力描述                       │
│     - 当前 snapshot                  │
│     - 用户指令                       │
│     - few-shot 示例                  │
│  4. 调用 LLM (可配置模型)            │
│  5. SSE 流式返回：                   │
│     - thinking 事件                  │
│     - result 事件 (patch)            │
│     - 或 error 事件                  │
└─────────────────────────────────────┘
```

---

## 4. Patch 合并规则

### 4.1 合并逻辑

```typescript
import { merge } from 'lodash-es'  // 需新增依赖

function applyPatch(
  currentSnapshot: Snapshot,
  patch: Record<string, unknown>
): Snapshot {
  const candidate = structuredClone(currentSnapshot)
  merge(candidate.payload, patch)
  candidate.envelope.updatedAt = new Date().toISOString()
  return candidate
}
```

### 4.2 约束

- AI 输出的 patch 只包含 payload 的子树，**且已被后端过滤**（只保留 payloadSchema 中定义的字段）
- envelope 由宿主自动维护，AI 不可修改
- patch 的嵌套结构与实际 payload 一致（非点号路径平铺）
- patch 中出现的 key 如果在当前 payload 中不存在，merge 后会新增（这是 deep merge 的正常行为）
- validate 阶段会检查新增字段是否合法

### 4.3 回滚

```typescript
// 在调用 AI 前保存快照
const snapshotBeforeAi = structuredClone(currentSnapshot)

// validate 失败时
if (!validateResult.ok) {
  await bridge.loadSnapshot(snapshotBeforeAi)
  showErrors(validateResult.errors)
}
```

---

## 5. 模板能力描述规范

### 5.1 文件位置

每个模板目录根下放置 `ai-capability.json`。

### 5.2 结构定义

```typescript
interface AiCapability {
  templateKey: string          // 与 apps.manifest.json 的 id 一致
  aiLevel: "L0" | "L1" | "L2" // 能力等级
  supportsAiBuild: boolean     // 是否支持 AI 搭建

  description: string          // 模板用途的一句话描述，给 LLM 看
  supportedIntents: string[]   // 支持的意图，如 ["build-demo", "adjust-params"]

  payloadSchema: {             // payload 中 AI 可操作的字段说明
    [fieldPath: string]: {
      type: string             // "number" | "string" | "boolean" | "enum" | "object"
      description: string      // 字段含义，中文
      range?: [number, number] // 数值范围（可选）
      enum?: string[]          // 枚举值（可选）
      required?: boolean       // 是否必填
      risk?: "low" | "high"    // 高风险字段标记（修改可能导致不可预期行为）
    }
  }

  constraints: string[]        // 不可恢复或特殊限制说明
  examples: PatchExample[]     // few-shot 示例
}

interface PatchExample {
  instruction: string          // 教师输入
  patch: object                // 对应的 payload patch
  explanation: string          // AI 解释
}
```

### 5.3 示例：`visual_chem08/ai-capability.json`

```json
{
  "templateKey": "chem08",
  "aiLevel": "L1",
  "supportsAiBuild": true,
  "description": "酸碱滴定与 pH 模拟器，支持配置酸碱种类、浓度、体积、指示剂等参数",
  "supportedIntents": ["build-demo", "adjust-params"],
  "payloadSchema": {
    "titration": {
      "type": "object",
      "description": "滴定实验配置",
      "children": {
        "acidType": {
          "type": "enum",
          "description": "酸的种类",
          "enum": ["HCl", "H2SO4", "CH3COOH", "H3PO4"]
        },
        "baseType": {
          "type": "enum",
          "description": "碱的种类",
          "enum": ["NaOH", "KOH", "NH3·H2O", "Ca(OH)2"]
        },
        "acidConcentration": {
          "type": "number",
          "description": "酸的浓度 (mol/L)",
          "range": [0.001, 2.0]
        },
        "baseConcentration": {
          "type": "number",
          "description": "碱的浓度 (mol/L)",
          "range": [0.001, 2.0]
        }
      }
    },
    "display": {
      "type": "object",
      "description": "显示配置",
      "children": {
        "indicator": {
          "type": "enum",
          "description": "指示剂选择",
          "enum": ["phenolphthalein", "methyl-orange", "litmus", "none"]
        }
      }
    }
  },
  "constraints": [
    "动画播放进度不可通过 snapshot 恢复",
    "滴定曲线由参数实时计算，不存储在 snapshot 中"
  ],
  "examples": [
    {
      "instruction": "帮我搭建一个盐酸滴定氢氧化钠的演示，浓度都用 0.1mol/L",
      "patch": {
        "titration": {
          "acidType": "HCl",
          "baseType": "NaOH",
          "acidConcentration": 0.1,
          "baseConcentration": 0.1
        },
        "display": {
          "indicator": "phenolphthalein"
        }
      },
      "explanation": "已配置 0.1mol/L HCl 滴定 0.1mol/L NaOH，使用酚酞指示剂"
    }
  ]
}
```

### 5.4 同步机制

1. 模板开发者在模板仓库维护 `ai-capability.json`
2. 通过**后端 Admin API** 上传到数据库：
   - `PUT /api/v1/visual-center/templates/{template_id}/capabilities`
   - 请求体即 `ai-capability.json` 的内容
   - 可通过脚本批量上传，也可通过 admin 界面手动操作
3. `/api/v1/visual-center/assist` 在处理请求时从数据库 `capabilities` 字段（JSON 列）读取能力描述
4. 后续可在 admin 界面直接在线编辑

不采用跨仓库 seed 方式，避免 Template 仓库和 Backend 仓库的路径耦合。

---

## 6. SSE 事件详细格式

沿用项目现有 SSE 模式：所有事件通过 `data:` 行发送，JSON 内 `type` 字段区分事件类型。

### 6.1 `thinking` 类型

LLM 生成过程中的中间输出，用于前端展示"AI 正在思考"。

```
data: {"type": "thinking", "content": "分析需求：用户希望配置一个盐酸滴定实验..."}
```

- 可以发送多次
- 前端追加展示在对话框中
- 不含结构化数据

### 6.2 `result` 类型

LLM 生成完成，返回最终 patch。

```
data: {"type": "result", "patch": {...}, "explanation": "已将反应温度调整为 725K", "warnings": ["催化剂模式下动画效果可能略有差异"]}
```

- 只发送一次
- `patch`：payload 的 deep merge patch（**已经过后端过滤，只包含 payloadSchema 中定义的字段**）
- `explanation`：给教师看的中文解释
- `warnings`：可选警告信息数组

### 6.3 `error` 类型

任何阶段出错时发送。

```
data: {"type": "error", "code": "LLM_TIMEOUT", "message": "AI 生成超时，请重试"}
```

- 发送后流结束

### 6.4 `done` 类型

流正常结束的标志。

```
data: {"type": "done"}
```

- 在 `result` 之后发送，表示流结束
- 前端收到后关闭 SSE 连接

### 6.5 JSON 解析失败处理

后端通过 `try_parse_json()` 解析 LLM 输出。如果无法解析为合法 JSON：

1. 不重试（V1 不做自动重试）
2. 发送 error 事件：`{"type": "error", "code": "LLM_INVALID_OUTPUT", "message": "AI 生成结果格式异常，请重试"}`
3. 流结束

---

## 7. Prompt 结构建议

后端构造 LLM prompt 时的推荐结构：

```
[System]
你是一个教育可视化模板配置助手。
你的任务是根据教师的自然语言需求，生成模板的 payload patch。
你只能修改模板支持的字段，不能编造不存在的字段。
输出必须是合法 JSON，格式为 {"patch": {...}, "explanation": "...", "warnings": [...]}

[模板能力描述]
{ai-capability.json 的内容}

[当前状态]
{当前 snapshot.payload 的 JSON}

[用户指令]
{教师输入的自然语言}
```

Few-shot 示例从 `ai-capability.json` 的 `examples` 字段注入。

---

## 8. 前端接入位置

- **宿主页面**：`app/(workbench)/visualize/workbench/[templateId]/page.tsx`
- **新增依赖**：`lodash-es`（用于 deep merge）
- **新增组件**：
  - `AiAssistBubble` — 悬浮球入口
  - `AiAssistDialog` — 对话框/抽屉，包含：
    - 指令输入框
    - **会话内历史列表**（本次打开工作台以来的所有交互，前端内存存储，刷新即清除）
    - thinking 展示区
    - result 展示区（explanation + warnings + "应用"/"取消"按钮）
    - 错误提示
- **新增 hook**：
  - `useAiAssist` — 封装 SSE 调用、patch 合并、validate、loadSnapshot、回滚、并发取消逻辑
- **bridge.ts 扩展**：新增 `getDefaultSnapshot` 方法支持（用于空白实例场景）
- **复用**：
  - `lib/visual-center/bridge.ts` — getSnapshot / validateSnapshot / loadSnapshot
  - `lib/visual-center/api.ts` — 现有实例更新接口（保存时用）
  - `lib/visualize/use-sse.ts` — SSE 解析（复用 `data.type` 模式，无需修改）

---

## 9. 后端接入位置

- **新增路由**：`app/api/v1/visual_center/route.py` 中新增 `assist` 端点
- **新增 service**：`app/services/visual_template_assist.py`
  - 读取模板能力描述（从 DB `capabilities` 字段）
  - 构造 prompt
  - 调用 LLM（复用 `app/utils/llm.py` 的多模型抽象）
  - **过滤 LLM 输出**：只保留 `payloadSchema` 中定义的字段，剥掉幻觉字段
  - SSE 流式输出（沿用 `sse_event()` + `StreamingResponse` 模式）
- **新增 Admin API**：`app/api/v1/visual_center/route.py` 中新增能力描述管理端点
  - `PUT /api/v1/visual-center/templates/{template_id}/capabilities` — 上传 `ai-capability.json` 内容
  - `GET /api/v1/visual-center/templates/{template_id}/capabilities` — 读取能力描述
  - 需要 admin 权限
- **LLM 配置**：新增环境变量 `DEFAULT_TEMPLATE_ASSIST_MODEL`（默认值建议 `"gateway:strong"`），独立于 `DEFAULT_VISUALIZE_MODEL`
- **日志记录**（应用日志，Python logging，V1 不建表）：
  - `templateKey`
  - `instanceId`
  - `instruction`（脱敏摘要）
  - `model_used`
  - `validate_success`（由前端回传，或 V2 再做）
  - `timestamp`
  - `duration_ms`

---

## 10. 模板 Key 对齐任务

以 `apps.manifest.json` 的 `id` 为唯一标准，需要对齐的位置：

| 系统 | 当前格式 | 需对齐 |
|------|---------|--------|
| apps.manifest.json | `chem02` | 标准 ✓ |
| 模板 bridge 内部 | `chem02` | 已一致 ✓ |
| 前端 templates.ts | `chem-02` | **需改为** `chem02` |
| 后端 seed 数据 | 待确认 | **需与 manifest 对齐** |
| ai-capability.json | 新文件 | 按 manifest id 填写 |

---

## 11. 前置任务清单（阶段 1 必须完成）

1. [ ] 前端 `templates.ts` 的 key 与 `apps.manifest.json` 对齐
2. [ ] 后端 seed 数据的 `template_key` 与 `apps.manifest.json` 对齐
3. [ ] 为第一批试点模板编写 `ai-capability.json`（payloadSchema 结构与实际 payload 嵌套一致）
4. [ ] 后端新增 `assist` 端点骨架（SSE，沿用 `data.type` 模式）
5. [ ] 后端新增 capabilities Admin API（上传/读取 `ai-capability.json`）
6. [ ] 后端新增 `DEFAULT_TEMPLATE_ASSIST_MODEL` 环境变量
7. [ ] 前端安装 `lodash-es` 依赖
8. [ ] 前端 `bridge.ts` 增加 `getDefaultSnapshot` 方法
9. [ ] 前端新增 `AiAssistBubble` + `AiAssistDialog` 组件骨架
10. [ ] 前端 BFF 新增 `/api/visual-center/assist` 代理路由

---

## 12. 第一批试点模板

| 模板 | templateKey | Bridge 状态 | 目录 |
|------|-------------|-------------|------|
| 化学方程式配平器 | `c03` | ✓ | `chemistry_zhd/packages/c03-equation-balancer/` |
| 元素周期表 | `c04` | ✓ | `chemistry_zhd/packages/c04-periodic-table/` |
| 反应速率与平衡 | `c07` | ✓ | `chemistry_zhd/c07_c09_chemistry_tool.html` |
| 有机合成路径 | `c09` | ✓ | `chemistry_zhd/c07_c09_chemistry_tool.html` |

---

## 13. 安全考量

1. **输入过滤**：教师指令在后端做基本长度限制（建议 500 字符）和敏感词过滤
2. **输出安全**：patch 中的 string 字段在前端渲染时需要转义（防止 XSS，特别是如果 payload 中包含 HTML 内容）
3. **频率限制**：后端对 `/assist` 端点做 rate limit（建议 10 次/分钟/用户）
4. **密钥安全**：LLM API key 只存在后端，前端不接触

---

## 14. 并发与取消策略

### 14.1 并发控制

教师在上一次 AI 生成未完成时发出新指令，前端采用**丢弃旧请求**策略：

1. 前端 abort 当前 SSE 连接（`AbortController.abort()`）
2. 清除 thinking 区域内容
3. 立即发起新请求

不采用排队或阻止策略——教师改变想法时应能立即操作。

### 14.2 实现要点

```typescript
const abortRef = useRef<AbortController | null>(null)

function sendAssist(instruction: string) {
  // 丢弃旧请求
  abortRef.current?.abort()
  abortRef.current = new AbortController()

  // 发起新 SSE
  fetchSSE('/api/visual-center/assist', {
    body: { templateKey, instanceId, currentSnapshot, instruction },
    signal: abortRef.current.signal,
    onThinking: (content) => { /* 追加展示 */ },
    onResult: (result) => { /* merge + validate + load */ },
    onError: (error) => { /* 展示错误 */ },
  })
}
```

### 14.3 后端侧

后端无需特殊处理——前端 abort 后 SSE 连接断开，后端检测到连接关闭后停止 LLM 调用（大多数 LLM SDK 支持取消）。

---

## 15. 空白实例处理

### 15.1 问题

教师刚创建实例、模板尚未完成初始化时，`getSnapshot()` 可能返回空或默认状态。

### 15.2 处理规则

1. 前端调用 `getSnapshot()` 后检查返回值
2. 如果返回 `null` / `undefined` / 空对象，改为调用 `getDefaultSnapshot()`（所有标准 bridge 模板均实现了此方法）
3. 将获取到的 snapshot 作为 `currentSnapshot` 传给后端

```typescript
async function getCurrentSnapshot(bridge: BridgeClient): Promise<Snapshot> {
  const snapshot = await bridge.getSnapshot()
  if (!snapshot || !snapshot.payload || Object.keys(snapshot.payload).length === 0) {
    return await bridge.getDefaultSnapshot()
  }
  return snapshot
}
```

### 15.3 bridge 协议补充

需要在前端 `bridge.ts` 中新增 `getDefaultSnapshot` 的调用支持（当前只有 `getSnapshot`/`loadSnapshot`/`validateSnapshot`）。

---

## 16. Snapshot 体积控制

### 16.1 问题

复杂模板（如 `phys_template_mechanics` 含场景草稿、`visual_m01` 含 100+ 预设）的 payload 可能非常大。完整传入 LLM prompt 会导致 token 浪费和注意力稀释。

### 16.2 请求体限制

前端在发送请求前检查 `currentSnapshot` 的 JSON 序列化大小：

- **软限制 50KB**：超过时在前端 console 输出警告
- **硬限制 200KB**：超过时拒绝发送，提示教师"当前模板状态过大，暂不支持 AI 辅助"

### 16.3 后端 prompt 精简

后端在拼装 prompt 时**不传完整 payload**，而是只提取 `ai-capability.json` 中 `payloadSchema` 定义过的字段：

```python
def extract_ai_relevant_fields(payload: dict, capability: dict) -> dict:
    """只保留 AI 可操作的字段，忽略其余"""
    schema_keys = capability.get("payloadSchema", {}).keys()
    return {k: v for k, v in flatten_payload(payload).items() if k in schema_keys}
```

这样既节省 token，又减少 LLM 生成无关字段的概率。

### 16.4 patch 仍基于完整 payload 合并

虽然 prompt 中只传了部分字段，但前端 merge patch 时仍基于完整的 `currentSnapshot.payload`，确保未被 AI 修改的字段不受影响。

---

## 17. Thinking 事件来源策略

### 17.1 问题

不同 LLM 提供商对"思考过程"的支持不同：
- DeepSeek / Claude：有 `reasoning` token，可以流式输出思考内容
- OpenAI / Qwen / 其他：部分模型没有独立的 reasoning 输出

### 17.2 策略

后端采用**混合策略**：

```python
async def stream_assist(request, llm_stream):
    # 阶段 1：固定进度消息
    yield sse_event("thinking", {"content": "正在分析您的需求..."})

    # 阶段 2：LLM 流式输出
    async for chunk in llm_stream:
        if chunk.type == "reasoning":
            # 有 reasoning token 的模型：转发真实思考过程
            yield sse_event("thinking", {"content": chunk.text})
        elif chunk.type == "content":
            # 累积 content，最后解析为 result
            content_buffer += chunk.text

    # 阶段 3：解析并返回结果
    result = parse_patch_result(content_buffer)
    yield sse_event("result", result)
```

- 有 reasoning 的模型 → 转发真实思考内容，体验更丰富
- 没有 reasoning 的模型 → 只展示固定进度消息，不影响功能

---

## 18. 结果预览与应用

### 18.1 规则

AI 生成的 patch **不自动应用**，需要教师确认后再执行 merge + validate + load。

### 18.2 前端交互流程

1. 收到 `result` 事件后，在对话框中展示：
   - `explanation`（AI 解释了改了什么）
   - `warnings`（如有）
   - "应用" / "取消"按钮
2. 教师点击"应用"后：
   - 执行 deep merge
   - 调用 `validateSnapshot`
   - 通过则 `loadSnapshot`
   - 失败则回滚并展示 errors
3. 教师点击"取消"后：
   - 不做任何操作
   - 保持当前模板状态不变

### 18.3 连续微调场景

教师确认应用后，可以继续输入新指令。此时前端重新 `getSnapshot()` 获取最新状态，再走同一条链路。由于采用无状态模式，每次请求都是独立的。

---

## 19. SSE 断连恢复

### 19.1 策略

网络不稳定导致 SSE 中途断开时：

1. 前端展示"网络连接中断"提示
2. **不自动重试**（LLM 调用有成本，重复调用浪费 token）
3. 教师可以手动重新发送指令
4. 如果断连时已收到部分 thinking 内容，保留展示

### 19.2 超时处理

前端设置 **30 秒整体超时**（从发起请求到收到 result/error）：

- 超时后 abort 连接
- 展示"AI 响应超时，请重试"
- 后端 LLM 调用本身也应设置超时（建议 25 秒），确保不会无限等待

---

## 20. 测试策略

### 20.1 后端测试

| 测试类型 | 覆盖范围 |
|---------|---------|
| 单元测试 | `visual_template_assist.py` 的 prompt 构造、patch 解析逻辑 |
| 集成测试 | `/assist` 端点的 SSE 事件格式（mock LLM 返回固定内容） |
| 边界测试 | 空 snapshot、超大 snapshot、非法 instruction、capabilities 缺失 |

### 20.2 前端测试

| 测试类型 | 覆盖范围 |
|---------|---------|
| Hook 测试 | `useAiAssist` 的 SSE 消费、patch 合并、回滚逻辑（mock SSE 流） |
| 组件测试 | `AiAssistDialog` 的状态切换（空闲/thinking/result/error） |
| Bridge 测试 | `getSnapshot`/`validateSnapshot`/`loadSnapshot` 的 postMessage 往返 |

### 20.3 联调验收清单

每个试点模板的端到端验证必须通过以下 checklist：

- [ ] 空白实例 → 输入指令 → AI 生成 → validate 通过 → load 成功
- [ ] 已有状态 → 输入微调指令 → patch 正确合并 → 状态符合预期
- [ ] 输入不相关指令（如"帮我写作文"）→ AI 返回合理的拒绝/提示
- [ ] validate 失败 → 回滚到修改前状态 → 模板状态不变
- [ ] 网络中断 / 超时 → 错误提示 → 模板状态不变
- [ ] 连续发送两次指令 → 第一次被 abort → 第二次正常完成
- [ ] 教师点"取消"→ 不应用 → 模板状态不变
- [ ] 应用成功后点"保存"→ 实例 snapshot 更新到数据库

---

## 21. `ai-capability.json` 校验

### 21.1 JSON Schema

在模板仓库根目录提供校验 schema：`schemas/ai-capability.schema.json`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["templateKey", "aiLevel", "supportsAiBuild", "description", "payloadSchema", "examples"],
  "properties": {
    "templateKey": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "aiLevel": { "enum": ["L0", "L1", "L2"] },
    "supportsAiBuild": { "type": "boolean" },
    "description": { "type": "string", "minLength": 10 },
    "supportedIntents": {
      "type": "array",
      "items": { "type": "string" }
    },
    "payloadSchema": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["type", "description"],
        "properties": {
          "type": { "enum": ["number", "string", "boolean", "enum", "object", "array"] },
          "description": { "type": "string" },
          "range": { "type": "array", "items": { "type": "number" }, "minItems": 2, "maxItems": 2 },
          "enum": { "type": "array", "items": { "type": "string" } },
          "required": { "type": "boolean" },
          "risk": { "enum": ["low", "high"] }
        }
      }
    },
    "constraints": { "type": "array", "items": { "type": "string" } },
    "examples": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["instruction", "patch", "explanation"],
        "properties": {
          "instruction": { "type": "string" },
          "patch": { "type": "object" },
          "explanation": { "type": "string" }
        }
      }
    }
  }
}
```

### 21.2 校验时机

1. **开发时**：模板开发者可在 IDE 中引用 schema 获得智能提示
2. **CI**：在 `build-all.mjs` 中增加校验步骤，检查所有 `ai-capability.json` 是否符合 schema
3. **Seed 时**：后端 seed 脚本在写入数据库前做格式校验，不合法则跳过并输出警告

---

## 22. 演进路线

### V1.5 — V1 打磨（V1 上线后 2-4 周）

| 能力 | 说明 | 依赖 |
|------|------|------|
| Validate 失败自动修正 | 把 `errors` 反馈给 LLM 重新生成一次 patch | 后端增加 retry 逻辑 |
| 操作历史栈 | 前端维护本次会话的 snapshot 历史，支持多步撤销 | 前端内存实现 |
| Patch diff 可视化 | 在确认对话框中以 before/after 对比展示变化字段 | 前端 diff 组件 |
| 更多模板接入 | M01、M02、chem02、chem05 等已有 bridge 的模板 | 编写 `ai-capability.json` |

### V2 — 体验升级

| 能力 | 说明 |
|------|------|
| 有状态多轮对话 | 传递历史对话让 AI 理解意图演变 |
| 预设推荐 | AI 根据需求推荐模板内已有的 preset/场景，而非从零生成 |
| 教师反馈闭环 | 对 AI 结果点赞/点踩，用于优化 prompt 和 few-shot |
| AI 行为分析仪表盘 | 生成成功率、validate 通过率、教师采纳率（Grafana） |
| 批量操作 | "把这 5 个实例的温度都改成 800K" |

### V3 — 深度智能

| 能力 | 说明 |
|------|------|
| 模板内多轮 Agent（L3） | AI 调用模板暴露的动作级 API（"添加一个力"、"画辅助线"） |
| 跨模板编排 | 教师说"帮我准备一节力学课"，AI 自动选模板 + 配置多个实例 |
| 与课件系统打通 | AI 配好的模板实例直接嵌入 lectures-v3 课件编辑器 |
| 语音输入 | 教师直接说需求，前端转文字后走同一条链路 |
| 自学习优化 | 基于历史教师修正数据自动优化 few-shot 示例和 prompt |

### 演进全景

```
V1 (当前)              V1.5                 V2                   V3
───────────────────────────────────────────────────────────────────────

patch + 预览确认       + 自动修正重试        + 有状态多轮         + 模板内 Agent
SSE 流式              + 撤销历史栈          + 预设推荐           + 跨模板编排
无状态                + diff 可视化         + 反馈闭环           + 课件系统打通
4 个化学试点           + 更多模板接入        + 行为分析           + 语音输入
                                           + 批量操作           + 自学习
```
