# 04-28 Snapshot 接入

## 用户原文与关键约束
- 工作仓库：`visual_p09`。
- 参考根目录 `接入snapshot的指导.md`，为 `visual_p09` 加上 Snapshot 功能，方便后续模板库数据持久化到 DB。
- 严格按照文档要求实现。
- 可进入 `visual_m05` 查看 Snapshot 相关逻辑，也可运行指定 git diff 查看实现前后修改。
- 完成实现后按指导文档要求检查。
- 给出初版 Snapshot 实现交付文档，说明已检查内容、是否通过、需要人工检查的内容与检查方法。
- 说明是否与指导文档和 M05 接入方式一致。

## MODE 0 任务评估
- 任务类型：跨模块状态持久化接口接入 + 文档交付 + 构建验证。
- 风险等级：L2 高风险。
- 判定依据：涉及外部 bridge 接口、snapshot 数据结构、状态读取/恢复、跨模块 UI 和业务状态联动。
- 流程路径：MODE 0 -> MODE 1 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6。
- 强制门禁：真实状态结构样本校验；`src/` 变更后执行 `pnpm tsc --noEmit` 与 `pnpm build`；补充 snapshot 契约验证；交付文档说明人工浏览器检查项。
- 备注：当前仓库存在大量历史改动，本任务仅修改 Snapshot 接入相关文件，不回滚无关变更。

## MODE 1 研究记录
- 指导文档最低要求：实现并暴露 `getDefaultSnapshot()`、`getSnapshot()`、`loadSnapshot(snapshot)`、`validateSnapshot(snapshot)`，统一外层结构为 `envelope + payload`，包含 `templateKey/runtimeKey/bridgeVersion/snapshotSchemaVersion/createdAt/updatedAt`。
- 指导文档自测要求：DevTools Console 验证 bridge 存在、默认快照、当前快照随操作变化、合法/非法校验、同页恢复、刷新后恢复。
- 指导文档建议：不要保存 hover/loading/toast/拖拽中/动画中间帧/undo redo 历史；优先保存最小可恢复业务状态和必要 UI 模式。
- M05 参考实现：`src/templateBridge.ts` 聚合多个 store，提供 envelope、validate、load、全局 bridge 和 postMessage 支持；加载时清理不该恢复的历史状态。
- P09 当前状态来源：
  - `src/store/simulationStore.ts` 保存当前模型、各模型参数、播放控制、显示开关、霍曼阶段和点火角。
  - `src/components/layout/AppLayout.tsx` 本地保存左右栏宽。
  - `src/components/scene/OrbitCanvas.tsx` 本地保存 Canvas 平移和缩放。
- P09 现有 bridge：已有 `src/templateBridge.ts` 和 `registerTemplateBridge()`，但 `getDefaultSnapshot()` 等同当前快照，校验仅检查 envelope/payload 基本存在，不校验 payload 字段；缺少 postMessage 支持；栏宽和 Canvas 视口不能恢复。

## MODE 3 执行计划
1. 新增 `src/store/uiStore.ts`：定义 `UISnapshot`，保存 `layout.leftWidth/rightWidth` 与 `viewport.offsetX/offsetY/zoom`，提供 `getDefaultSnapshot/getSnapshot/loadSnapshot/setLayoutWidths/setViewport`。
2. 修改 `src/components/layout/AppLayout.tsx`：将 `leftWidth/rightWidth` 从本地 state 迁移到 `useUIStore`，拖拽仍保持本地临时 `resizeState`。
3. 修改 `src/components/scene/OrbitCanvas.tsx`：将 `viewport` 从本地 state 迁移到 `useUIStore`，左键拖拽和滚轮缩放写回 store。
4. 修改 `src/store/simulationStore.ts`：新增 `getDefaultSimulationSnapshot()`；强化 `loadSnapshot()` 合并默认参数、限制非法模型和非法追及半径，加载时清空 `elapsedSeconds`，不恢复动画瞬时帧。
5. 修改 `src/templateBridge.ts`：对齐指导文档与 M05，实现真正默认快照、当前快照、严格字段校验、加载错误返回、全局 bridge、可选 postMessage 支持；payload 聚合 `simulation` 与 `ui`。
6. 新增 `docs/snapshot初版实现交付文档.md`：说明保存/不保存状态、schema 版本、与指导文档/M05 一致性、自动检查结果与人工检查步骤。
7. 执行验证：`pnpm tsc --noEmit`、`pnpm build`、临时 Node/tsx 脚本验证 `getDefaultSnapshot/getSnapshot/validate/load` 契约；检查无旧描述残留。

## MODE 4 执行记录
- 待更新。

## MODE 5 审查记录
- 待更新。

## MODE 6 交付 DoD
- 待更新。
