# 阶段4：AI 推荐功能对接工作台 UI

> 任务ID：03-23-stage4-ai-recommend-ui
> 风险等级：L1 常规风险
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 创建时间：2026-03-23
> 状态：✅ 已完成

## 目标

用户在工作台 AI 面板输入自然语言，点击搜索后 LLM 返回推荐的作品卡片列表，点击即可加载 scene_data 到编辑器。

## 完成的子任务

- [x] 4.1 替换 handleAiSearch Mock → 真实 `recommend()` 调用
- [x] 4.2 改造结果状态类型与卡片渲染（ProjectMeta + 推荐理由）
- [x] 4.3 点击卡片 → 加载 scene_data → 跳转编辑器
- [x] 4.4 加载状态优化 + 错误处理 UI（AIError 按 code 分类提示）
- [x] 4.5 更新热门推荐词 + 去 Mock 标记 + 隐藏 AI 生成按钮
- [x] 4.6 端到端测试
- [x] 4.7 API 代理层（解决 CORS + API Key 安全）
- [x] 4.8 作品卡片右键"在新标签页中打开"

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/pages/WorkspacePage.tsx` | 修改 | AI 面板核心改造 + 作品卡片改为 `<a>` 标签 |
| `src/pages/EditorPage.tsx` | 修改 | 支持 `?preset=xxx` query param 加载预置作品 |
| `src/components/workspace/ProjectCard.tsx` | 修改 | 外层改为 `<a>` 标签支持右键新标签页 |
| `src/lib/ai/client.ts` | 修改 | URL 改为 `/api/recommend`，移除客户端 API Key |
| `src/lib/ai/types.ts` | 修改 | 移除不再需要的 `AIConfig` 接口 |
| `src/lib/ai/index.ts` | 修改 | 更新导出 |
| `api/recommend.ts` | 新建 | Vercel Edge Function，代理 LLM API 请求 |
| `vite.config.ts` | 修改 | 添加 `/api/recommend` dev proxy |
| `.env.development` | 修改 | API Key 改为非 `VITE_` 前缀（服务端专用） |

## 架构决策

### API 代理层

```
浏览器 → /api/recommend (POST body, 无 API Key)
  ├─ 本地开发: Vite proxy → edumindai.nocoder.win/v1/messages (注入 Key)
  └─ 生产部署: Vercel Edge Function → edumindai.nocoder.win/v1/messages (注入 Key)
```

- 解决浏览器直调 CORS 问题
- API Key 不暴露给客户端（非 `VITE_` 前缀环境变量）

### 右键新标签页

- 所有作品卡片用 `<a href>` 包裹，支持原生右键菜单
- 预置作品 URL 格式：`/editor?preset=${id}`
- 我的作品 URL 格式：`/editor/${id}`
- 左键 `e.preventDefault()` + SPA `navigate()` 保持原有体验

## 验收标准

- [x] 输入"正方体外接球"能推荐相关作品
- [x] 输入"二面角怎么求"能推荐二面角场景类型的作品
- [x] 点击推荐结果能成功加载 3D 场景到编辑器
- [x] LLM 调用超时或失败时 UI 有友好提示
- [x] 去掉 Mock 标记，热门词更新为立体几何相关
- [x] 作品卡片支持右键在新标签页中打开
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 决策记录

| 日期 | 决策项 | 结论 | 依据 |
|------|--------|------|------|
| 2026-03-23 | AI 直接生成按钮 | 暂时隐藏 | v0.7 才有生成能力 |
| 2026-03-23 | CORS 解决方案 | Vercel Edge Function + Vite dev proxy | 无需引入 Next.js，零迁移风险 |
| 2026-03-23 | API Key 安全 | 服务端注入，客户端不可见 | 环境变量无 `VITE_` 前缀 |
| 2026-03-23 | 右键新标签页 | `<a href>` + EditorPage `?preset=xxx` | 不依赖 `location.state`，新标签页可独立加载 |

## Vercel 部署提醒

需要在 Vercel 项目 Settings → Environment Variables 中添加：
- `AI_API_KEY` = `sk-534c8eb...`
- `AI_BASE_URL` = `https://edumindai.nocoder.win`
