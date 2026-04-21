# [任务-04-02-19-13-vercel-build-fix] Vercel 构建类型错误修复

**创建时间**: 2026-04-02 19:16
**状态**: 完成
**优先级**: 高

## 需求来源
用户反馈 Vercel 部署失败，并给出一组 TypeScript 构建报错，要求定位并修复问题。

## 目标与范围
**主要目标**: 修复 `tsc -b && vite build` 构建链路中的类型错误与 `erasableSyntaxOnly` 兼容问题，恢复 Vercel 构建通过。
**范围**: `src/App.tsx`、图表组件、属性面板、命令类、`PhysicsBridge`、Vite 开发插件及相关未使用变量清理。
**不包括**: 模板数据内容调整、业务逻辑扩展、`handoff.md` 更新。

## 关键约束
- 规则来源：`风险分级自动流转 > 当前模式默认路径`
- 风险等级：`L1`
- 流程路径：`MODE 0 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6`
- 命中 `src/` 目录，需执行 `pnpm lint && pnpm tsc --noEmit`；构建链路额外以 `pnpm build` 复核。
- 不修改用户未授权的无关文件；当前未跟踪文件 `1.txt` 保持不动。

## 架构影响评估
本轮以静态类型兼容和构建配置适配为主，不改变核心运行时架构。重点是让现有实现满足 TypeScript 5.9 + `erasableSyntaxOnly` 的语法与类型要求。

## 关键决策记录
- 决策1：为本次构建故障单独建任务文档，而非并入阶段文档。
  - 理由：问题横跨 `template`、图表、命令系统与开发插件，独立记录更便于追踪构建回归与验证证据。
- 决策2：以本地 `pnpm build` 作为复现基线。
  - 理由：`pnpm tsc --noEmit` 单独执行未暴露全部问题，`tsc -b` 才与 Vercel 构建路径一致。

## 执行计划
1. 修复 `RouteState` 联合类型收窄与图表/Tooltip 类型不匹配。
2. 批量清理命令类和开发插件中的参数属性语法，适配 `erasableSyntaxOnly`。
3. 处理 `PhysicsBridge` 与未使用参数导致的构建失败。
4. 执行 `pnpm build`、`pnpm lint`、`pnpm tsc --noEmit` 完成回归验证。

## 当前进展
- 已读取 `.knowledge/INDEX.md`、`architecture.md`、`pitfalls.md`、任务评估框架与模板总计划。
- 已确认本地 `pnpm build` 可完整复现 Vercel 报错，且实际报错项多于用户贴出的日志。
- 已完成 `App.tsx`、`TimeSeriesChart.tsx`、`PropertyPanel.tsx`、命令类、`PhysicsBridge`、`ForceCollector`、`SelectTool` 与 `vite.template-preset-save-plugin.ts` 的构建兼容修复。
- 已完成回归验证：`pnpm build`、`pnpm lint`、`pnpm tsc --noEmit` 全部通过。

## 对后续任务的影响
- **新约束**: 构建验证以 `pnpm build` 为准，不能只看 `pnpm tsc --noEmit`。
- **依赖变更**: 无
- **必看文件**: `tsconfig.app.json`、`src/App.tsx`、`src/core/commands/*`
- **复用结论**: `erasableSyntaxOnly` 下禁止使用 TypeScript 参数属性，命令/插件类需改为显式字段声明。
- **未决风险**: 若云端 Node/pnpm 版本与本地差异较大，仍需在修复后观察 Vercel 再次构建结果。

## 遗留问题
- Vite 生产构建仍提示主包体积超过 `500 kB`，当前不阻塞部署，但后续可评估代码分割。

## 审查结论
:white_check_mark: 实现完全匹配计划

## 用户对话记录
### 第1轮 [2026-04-02 19:13] - [任务确认模式]
**用户原文**: `19:13:12.706 ... vercel部署报错了,看一下问题`
**关键要点**: Vercel 部署失败；用户已提供 `App.tsx`、`TimeSeriesChart.tsx`、`PropertyPanel.tsx` 与多处 command 文件的 TypeScript 报错日志，期望定位并修复构建问题。
