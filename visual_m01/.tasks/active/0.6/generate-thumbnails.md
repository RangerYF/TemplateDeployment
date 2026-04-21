# 自动化生成预置作品缩略图

> 任务ID：03-23-generate-thumbnails
> 风险等级：L1 常规风险
> 流程路径：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
> 创建时间：2026-03-23
> 状态：✅ 已完成

## 目标

为 108 个预置作品自动生成缩略图（960×600 PNG），存为静态文件，推荐卡片和作品库直接展示。

## 方案

Playwright 脚本连接 dev server，逐个打开 `/editor?preset=xxx`，等待 3D 渲染完成后截取 Canvas 区域。

## 渐进验证策略

```
截 1 个 → 确认效果
  → 截 5 个 → 确认批量稳定性
    → 截全部 108 个
```

## 子任务链路

- [x] 1. 安装 Playwright 依赖
- [x] 2. 编写 `scripts/generate-thumbs.ts` 脚本
- [x] 3. 截 1 个作品验证效果
- [x] 4. 截 5 个作品验证稳定性
- [x] 5. 截全部 108 个（108 成功，0 失败）
- [x] 6. UI 展示缩略图（作品库卡片已集成 `<img>` 标签）

## 涉及文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/generate-thumbs.ts` | 新建 | Playwright 截图脚本 |
| `public/thumbs/*.png` | 新建 | 108 个缩略图静态文件（总计 10MB） |
| `package.json` | 修改 | 添加 Playwright devDependency |
| `src/pages/WorkspacePage.tsx` | 修改 | 作品库卡片 + AI 推荐卡片展示缩略图 |

## 技术方案

- Playwright Chromium + `--use-gl=angle` 实现 headless WebGL 渲染
- `page.evaluate()` 直接从 WebGL Canvas 读像素（绕过 UI 覆盖层）
- `context.addInitScript()` 注入 auth token 绕过 AuthGuard
- 960×600 PNG，16:10 比例，居中适配，`#f8f9fa` 背景
- 支持 `--limit N`、`--id xxx`、`--headed`、`DEV_URL` 参数

## 验收标准

- [x] 缩略图清晰，几何体居中，背景干净
- [x] 108 个作品全部生成缩略图（108/108，0 失败，总计 10MB）
- [x] 作品库卡片展示缩略图
- [x] AI 推荐结果卡片展示缩略图
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 决策记录

| 日期 | 决策项 | 结论 | 依据 |
|------|--------|------|------|
| 2026-03-23 | Canvas 截取方式 | `page.evaluate` 读 WebGL 像素 | `locator.screenshot()` 会捕获 UI 覆盖层 |
| 2026-03-23 | Headless WebGL | `--use-gl=angle` | 默认 headless 模式 WebGL buffer 被清空 |
| 2026-03-23 | Auth 绕过 | `addInitScript` 注入 token | EditorPage 有 AuthGuard |
