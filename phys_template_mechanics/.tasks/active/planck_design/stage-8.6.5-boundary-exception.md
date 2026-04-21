# 阶段 8.6.5：边界情况与异常处理

- **任务ID**: 04-01-00-07-stage8.6.5-boundary-exception
- **风险等级**: L1（常规风险：异常分支补齐）
- **状态**: 已完成（P0+P1 与空态视觉迭代已落地）
- **前置依赖**: 8.6.4
- **规则来源**: 8.6 总任务拆分

## 目标

补齐空场景、错误操作与仿真异常路径，避免静默失败并提升稳定性。

## 本轮输入归档（2026-04-01）

- 用户原文：`开始8.6.5 先识别可能需要优化的地方,然后列出清单，供我决策`
- 用户追问：`候选优化清单里哪些是用户能感知到的`
- 用户追问：`有什么优化做了之后会增加用户的认知负担、信息负担、操作负担吗`
- 用户决策：`我希望尽量不要增加太多用户的负担，实施一下P0和P1的`
- 用户续作反馈：`空画布提示样式不好看，文本要居中，按钮样式要符合设计规范`
- 用户续作反馈：`去掉说明的外部边框试试`

## MODE 0 评估（本轮）

- 任务类型：重构优化（稳定性与异常处理收口）
- 风险等级：L1（常规风险，1-3+ 文件联动，无数据链路/数据库操作）
- 流程路径：MODE 0 -> MODE 3（识别与清单）-> 待用户确认进入 MODE 4
- 强制门禁：命中 `src/` 时执行 `pnpm lint && pnpm tsc --noEmit`

## 计划

1. 空场景提供明确引导与可执行入口。
2. 常见错误操作（非法选择、非法输入、状态冲突）提供可读提示。
3. 仿真异常（飞出视口、NaN）提供自动恢复或安全终止机制。

## 涉及文件（预估）

- `src/components/Canvas.tsx`
- `src/components/`
- `src/engine/`
- `src/store/`

## 验收标准

- 空场景、错误操作、异常仿真均有明确反馈。
- 异常路径不导致界面卡死或状态损坏。

## 回归门禁（执行后）

- `pnpm lint && pnpm tsc --noEmit`

## 候选优化清单（待决策）

### P0（建议优先执行）

1. **仿真异常熔断与安全终止**
   - 现状：仿真主循环 `step/collect/render` 无统一异常保护，出现异常可能直接中断循环或污染状态。
   - 证据：`src/components/Canvas.tsx` 仿真循环（约 `636-683` 行）、`src/engine/PhysicsBridge.ts` `step()`（约 `103-106` 行）。
   - 建议：增加 `try/catch + finite 校验 + stopAtCurrent + 用户可读提示` 的统一熔断路径。

2. **约束长度调整零除防护（属性面板）**
   - 现状：`enforceConstraintLength` 在 `dist=0` 时直接除法，可能产生 `NaN/Infinity` 并写回位置。
   - 证据：`src/components/panels/PropertyPanel.tsx`（约 `1702-1737` 行），`nx = dx / dist`、`ny = dy / dist`。
   - 建议：加 `dist < epsilon` 早返回或重建方向向量；对 rod/spring 的最小长度做硬钳制。

3. **拖拽约束计算零除防护（SelectTool）**
   - 现状：拖拽过程的绳/杆/滑轮约束同样存在 `dist=0`、`distMy=0` 的除法路径。
   - 证据：`src/core/tools/SelectTool.ts`（约 `701-707`、`775-788` 行）。
   - 建议：统一 `safeDivide` 与 `epsilon` 判定，异常时采用“保持当前位置 + 弱提示”策略。

4. **删除物体后的级联清理**
   - 现状：删除 body 仅移除 `scene.bodies`，关联 joints/forces 会残留为悬挂引用（静默失效）。
   - 证据：`src/store/sceneStore.ts`（约 `48-54` 行）、`src/core/commands/RemoveBodyCommand.ts`（约 `15-18` 行）、`src/engine/sceneSync.ts`（约 `108-111` 行会跳过无效 joint）。
   - 建议：删除 body 时同步清理关联 joint/force，并在 undo 时一并恢复。

### P1（建议本阶段完成）

5. **错误反馈通道统一（避免静默吞错）**
   - 现状：多个 `try/catch` 直接忽略异常；项目有 toast 基础设施但未接入业务链路。
   - 证据：`src/components/Canvas.tsx`（约 `987-1007`、`1060-1064` 行），`src/renderer/CanvasRenderer.ts`（约 `692-702` 行）；toast 仅定义于 `src/components/ui/toast.tsx`。
   - 建议：接入全局 `ToastProvider`，把关键失败（非法拖放、未知类型、仿真熔断）转为可读提示。

6. **空场景/低内容场景引导层**
   - 现状：无选中仅显示环境面板，画布侧缺少“下一步可操作入口”。
   - 证据：`src/components/panels/PropertyPanel.tsx`（约 `449-451` 行），`src/components/Canvas.tsx` 无 empty overlay 分支。
   - 建议：在画布显示空态引导（拖拽物体、快捷入口、示例场景）。

7. **输入校验策略一致化**
   - 现状：部分输入非法值只“忽略/回退”，缺少统一错误提示与字段级校验规范。
   - 证据：`src/components/Toolbar.tsx`（约 `108-114` 行）、`src/components/panels/PropertyPanel.tsx`（多处 `parseFloat` 后静默处理）。
   - 建议：抽象数值输入校验器（范围、精度、错误态 UI）并复用。

### P2（可选）

8. **长时会话状态回收**
   - 现状：`hiddenForceKeys/_manualOverrides/decomposedForceKeys` 与时间快照存在长期积累风险。
   - 证据：`src/store/forceDisplayStore.ts`（无失效 key 清理），`src/components/Canvas.tsx` 快照常量 `MAX_TIMELINE_SNAPSHOTS = 36000`。
   - 建议：在 setAvailableForces 和清场/重置时做 key 回收；可配置快照上限策略。

## 补充：用户可感知性分层（2026-04-01，待你决策）

- 高可感知（用户直接看到 UI/提示变化）：5、6、7
- 中高可感知（用户在边界操作中明显感到“更稳/不崩”）：1、2、3、4
- 低可感知（主要是长期稳定性与性能底层收益）：8

说明：本阶段候选项中，除 8 外其余均属于用户可感知优化；差异主要在“日常立即可见”与“仅在异常/极端场景可见”。

## 补充：用户负担影响评估（2026-04-01，待你决策）

- 可能增加认知/信息/操作负担的候选：`5、6、7`
- 基本不增加用户负担、反而降低操作出错成本：`1、2、3、4、8`

### 分项说明

1. `1 仿真异常熔断与安全终止`：若提示频率过高会造成信息负担；默认做“单次提示 + 自动停机”可控。
2. `2 约束长度零除防护`：底层保护，不新增步骤，几乎无负担。
3. `3 拖拽约束零除防护`：底层保护，不新增步骤，几乎无负担。
4. `4 删除级联清理`：行为更符合预期，减少“为什么还残留”的认知负担。
5. `5 错误反馈通道统一`：提示过多/过长会增加信息负担；需做分级与节流。
6. `6 空场景引导层`：引导文案过多会增加认知负担；建议渐进披露+可关闭。
7. `7 输入校验一致化`：若改成强拦截会增加操作负担；建议“可输入中间态 + 失焦校验”。
8. `8 长时会话状态回收`：后台优化，用户无新增操作，几乎无负担。

## 本轮验证记录

- `pnpm lint && pnpm tsc --noEmit`：通过（无报错）

## 本轮执行记录（2026-04-01，低负担落地 P0+P1）

### 规则来源与流程

- 规则来源：用户显式执行指令优先（“实施一下P0和P1”）
- 流程路径：MODE 3（已决策）-> MODE 4（执行）-> MODE 5（自审）
- 风险等级：维持 L1（常规风险）

### 实施清单映射（1-7）

1. **仿真异常熔断与安全终止（P0-1）**
   - 文件：`src/components/Canvas.tsx`
   - 变更：仿真主循环增加 `try/catch`、`BodyState/ForceData` 有限值校验，异常时 `stopAtCurrent` + 节流 toast 提示，避免循环污染与卡死。

2. **约束长度零除防护（P0-2）**
   - 文件：`src/components/panels/PropertyPanel.tsx`
   - 变更：`enforceConstraintLength` 增加 `epsilon` 与安全方向向量回退；对约束长度进行最小值钳制；并补齐 `springLength` 变更触发约束收敛。

3. **拖拽约束零除防护（P0-3）**
   - 文件：`src/core/tools/SelectTool.ts`
   - 变更：滑轮/绳/杆拖拽约束加入安全归一化逻辑，消除 `dist=0`、`distMy=0` 除法路径。

4. **删除 body 的级联清理 + undo 恢复（P0-4）**
   - 文件：`src/core/commands/RemoveBodyCommand.ts`
   - 变更：执行删除时同步清理关联 joints/forces；undo 时一并恢复，避免悬挂引用静默失效。

5. **错误反馈通道统一（P1-5）**
   - 文件：`src/App.tsx`、`src/components/Canvas.tsx`
   - 变更：全局接入 `ToastProvider`；在关键失败路径（仿真熔断、拖拽预览失败、drop 类型异常）给出节流提示，避免信息轰炸。

6. **空场景引导层（P1-6）**
   - 文件：`src/components/Canvas.tsx`
   - 变更：编辑态空场景显示轻量引导层，提供“添加方块/添加小球”快捷入口，不遮挡主画布交互。

7. **输入校验一致化（P1-7）**
   - 文件：`src/lib/utils/number.ts`、`src/components/panels/PropertyPanel.tsx`、`src/components/Toolbar.tsx`
   - 变更：抽象统一数值解析/钳制工具；输入策略改为“允许中间态、失焦校验、错误态轻提示”，减少强拦截造成的操作负担。

### 低负担约束（本轮已遵循）

- toast 走节流与关键事件触发，避免高频打断。
- 引导层文案精简，且仅空场景出现。
- 输入不在键入中途强阻断，主要在 blur/提交时规范化。

### 自审结论（MODE 5）

:white_check_mark: 实现完全匹配计划（P0+P1 全部落地，且按“低负担”约束实施）

### 回归门禁

- `pnpm lint && pnpm tsc --noEmit`：通过（exit code 0）

## 续作UI微调（2026-04-01）

### 需求

- 空画布提示文案视觉需居中。
- 引导按钮需与项目设计规范一致。

### 落地

- 文件：`src/components/Canvas.tsx`
- 调整：
  1. 空态卡片增加 `text-center`，标题/说明与按钮区域视觉居中。
  2. 两个快捷按钮由原生 `<button>` 改为统一 `Button` 组件，使用 `primary/outline` 规范化变体。
  3. 保留原有交互语义（点击添加方块/小球）不变，仅调整视觉层。

### 验证

- `pnpm lint && pnpm tsc --noEmit`：通过（exit code 0）

### 追加视觉微调

- 文件：`src/components/Canvas.tsx`
- 调整：去除空态说明卡片外部边框，仅保留圆角、背景与阴影。
- 验证：`pnpm lint && pnpm tsc --noEmit` 通过（exit code 0）

## Checkpoint 同步（2026-04-01）

- user-inputs 已补充本轮“低负担执行决策 + 空态视觉反馈/设计偏好”原话归档。
- 父级阶段文档 `stage-8.6-environment-and-velocity.md` 已同步 8.6.5 完成状态。
- 总阶段文档 `stage-8-polish-delivery.md` 与 `PROGRESSIVE-PLAN.md` 已同步阶段进展。

---

## 续作缺陷修复记录（2026-04-01）

### 子任务信息

- **子任务ID**: `04-01-15-21-bugfix-force-zoom-dnd`
- **规则来源**: 用户显式修复指令 > 风险分级自动流转（L1）
- **流程路径**: MODE 0 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6
- **强制门禁**: `pnpm lint && pnpm tsc --noEmit`

### 用户原始输入（归档）

- “弹窗被压缩的时候，连接在弹簧上的物体的力的方向不对，应该是往外推的，现在还是往弹窗方向拉的”
- “在画布上使用滚轮缩放的时候，不是以鼠标为中心的,应该要以鼠标为中心”
- “浏览器，打开开发者工具，打开设备工具栏，模拟其他尺寸的屏幕之后，物体无法从左侧面板中拖出来”

### 执行计划与落地

1. `src/engine/ForceCollector.ts`：为 `spring` 单独按“压缩/拉伸”判定力方向。
2. `src/store/viewportStore.ts`：重写 `zoom` 偏移换算，保持鼠标点为缩放中心。
3. `src/components/Canvas.tsx`：`drop` 增加 `dragState` 类型兜底。
4. `src/components/panels/ObjectPanel.tsx`：触屏/设备模拟新增点击创建兜底。

### 结果摘要

- 弹簧压缩时，受力方向改为外推；拉伸时保持内拉。
- 滚轮缩放改为严格鼠标中心，不再出现明显漂移。
- 设备模拟场景下，拖拽类型读取更稳，并提供触屏点击创建兜底路径。

### 续作反馈与决策（同日）

- 用户反馈：设备工具栏模拟尺寸下“仍不能拖出，但点击可以创建”。
- 结论：这是触摸语义下原生 HTML5 DnD 的已知限制，不属于当前代码回归。
- 决策：将“设备模拟/触摸环境拖拽创建一致性（Pointer 自定义拖拽链路）”作为后续优化，当前轮不实施。
- 记录：已写入 `.tasks/active/planck_design/TODO.md`。

### 审查结论

:white_check_mark: 实现完全匹配计划

### 验证证据

- `pnpm lint && pnpm tsc --noEmit`：通过（exit code 0）
