# 阶段3：LLM API 基础设施

> 任务ID：03-23-stage3-llm-infra
> 风险等级：L1 常规风险
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 创建时间：2026-03-23
> 状态：待计划

## 目标

前端具备调用 LLM API 的能力，包括客户端封装、API Key 管理和基础 Prompt 模板。用户输入自然语言后，LLM 从 108 个作品 meta 中推荐最匹配的作品。

## 前置条件

- [x] 阶段1完成：108 个 scene_data JSON + meta 数据就绪
- [x] 阶段2跳过：用户已简单校验，质量基本符合要求（未来另行优化）

## 子任务链路

```
3.1 确认 LLM 选型 + SDK/API 调用方式
  → 3.2 API Key 管理方案
    → 3.3 封装 LLM 调用客户端（src/lib/ai/）
      → 3.4 设计推荐 Prompt 模板
        → 3.5 端到端冒烟测试
```

### 3.1 确认 LLM 选型

**待决策项**：
- LLM 提供商：Claude / OpenAI / 国产模型（DeepSeek/通义千问等）
- 调用方式：SDK（@anthropic-ai/sdk / openai）vs REST API 直调
- 前端直调 vs 后端代理（计划中标注前端直调，需确认 Key 暴露风险可接受）

**约束**：
- 当前项目为纯前端 SPA（Vite + React），无后端服务
- 部署在 Vercel，可用 Vercel Edge Functions 做代理（备选方案）
- 需支持流式响应（提升用户体验，非必须）

### 3.2 API Key 管理方案

**方案选项**：
- A. 环境变量 `VITE_LLM_API_KEY`（前端构建时注入，会暴露在客户端代码中）
- B. 用户在 UI 中自行输入 Key，存 localStorage（Key 不入代码库）
- C. Vercel Edge Function 代理（Key 存服务端环境变量，不暴露）

**当前倾向**：方案待用户确认

### 3.3 封装 LLM 调用客户端

**文件规划**：
```
src/lib/ai/
├── types.ts          # 类型定义（请求/响应/推荐结果）
├── client.ts         # LLM API 调用封装（统一接口）
├── prompts.ts        # Prompt 模板（System + User）
└── index.ts          # 统一导出
```

**客户端要求**：
- 统一的 `recommend(query: string): Promise<RecommendResult>` 接口
- 错误处理：网络异常、超时（30s）、API 限流、响应格式错误
- 可配置的 API endpoint 和 model 参数

### 3.4 设计推荐 Prompt 模板

**System Prompt 内容**：
- 角色定义：高中立体几何教学场景推荐助手
- 作品知识库：108 个作品的精简 meta（id, title, tags, difficulty, geometryType, sceneType）
- 输出格式约束：JSON 数组，每项含 id + reason

**User Prompt**：
- 直接传入用户输入的自然语言

**输出格式**：
```json
{
  "recommendations": [
    { "id": "cube-line-plane-parallel-midpoint", "reason": "该作品展示正方体中..." },
    { "id": "cube-skew-distance", "reason": "..." }
  ]
}
```

**Prompt 优化方向**：
- 支持模糊匹配（"角度" → 二面角/线面角/异面角 相关作品）
- 支持题目粘贴（识别题目中的几何体和考点）
- 推荐数量控制（默认 3-5 个，按相关度排序）

### 3.5 端到端冒烟测试

**测试用例**：
1. 输入"正方体外接球" → 返回包含外接球相关作品
2. 输入"二面角怎么求" → 返回包含二面角作品
3. 输入一道完整题目 → 返回匹配的作品
4. 网络断开 → 返回友好错误信息
5. 无效 API Key → 返回认证错误提示

**验证方式**：控制台调用或临时测试页面

## 涉及文件范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/ai/types.ts` | 新建 | 类型定义 |
| `src/lib/ai/client.ts` | 新建 | LLM 调用客户端 |
| `src/lib/ai/prompts.ts` | 新建 | Prompt 模板 |
| `src/lib/ai/index.ts` | 新建 | 统一导出 |
| `.env.development` | 修改 | 添加 LLM API Key 配置 |

## 验收标准

- [ ] 调用 LLM API 返回结构化推荐结果（作品 ID 列表）
- [ ] 推荐结果中的 ID 能在 108 个作品 meta 中找到对应条目
- [ ] 网络异常和超时有友好的错误处理
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

## 数据依赖

- `src/data/projects/math/m01/meta.ts` — 108 个作品元数据，Prompt 中需注入精简版
- `scripts/data/test-queries.jsonl` — 319 条推荐测试查询（阶段4正式使用）

## 决策记录

| 日期 | 决策项 | 结论 | 依据 |
|------|--------|------|------|
| 2026-03-23 | 阶段2跳过 | 用户确认跳过 | 用户已简单校验，质量基本合格 |
| 2026-03-23 | LLM 选型 | Claude（通过代理） | 用户指定，代理地址 edumindai.nocoder.win |
| 2026-03-23 | API Key 方案 | 环境变量写死，不做用户自定义 | 用户指定，单一 Key 全局使用 |
| 2026-03-23 | 调用方式 | REST API 直调（兼容 OpenAI 格式代理） | 代理已提供，无需 SDK |
