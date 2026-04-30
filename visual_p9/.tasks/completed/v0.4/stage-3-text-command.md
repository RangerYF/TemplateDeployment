# V0.4 阶段3：文本指令输入 ✅ 已完成

> **阶段目标**：在线段工具/截面工具激活时，提示条上方出现输入框，输入"AB"创建线段、"ABC"创建截面
> **预计耗时**：2-3 天
> **实际完成**：2026-03-12
> **前置条件**：阶段2已完成
> **BACKLOG 覆盖**：F05
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.4/PROGRESSIVE-PLAN.md`
> - 功能清单：`.tasks/active/v0.4/BACKLOG.md`

---

## 交互设计

```
┌──────────────────────────────────────┐
│  选择  画线段  截面  坐标系  ...     │  ← ToolBar (top: 10)
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  画线段模式 — 选择第一个点           │  ← ModeIndicator (top: 72)
├──────────────────────────────────────┤
│  输入点名画线，如 AB ▏              │  ← TextCommandInput (紧贴提示条下方)
└──────────────────────────────────────┘
```

- **触发条件**：`activeToolId === 'drawSegment'` 或 `'crossSection'` 时显示
- **线段工具** placeholder：`输入点名画线，如 AB`
- **截面工具** placeholder：`输入点名创建截面，如 ABC`
- 输入回车后执行指令，成功则清空输入框并保持当前工具（方便连续操作）
- 输入无效时在输入框下方显示红色错误提示（如"未找到点 X"）
- Escape 键关闭输入框焦点（回到 3D 交互）

---

## 代码现状摘要

| 模块 | 现状 | 备注 |
|------|------|------|
| ModeIndicator | `top: 72px`，水平居中，根据 activeToolId 显示提示文案 | 输入框紧贴其下方 |
| DrawSegmentTool | 两次点击创建线段，用 `CreateEntityCommand<'segment'>` | 文本指令复用相同 Command |
| CrossSectionTool | 多次点击选点+截面计算，用 `CreateCrossSectionCommand` | 文本指令复用相同逻辑 |
| EntityStore | 有 `getEntitiesByType('point')`，**无** `findPointByLabel` 方法 | 需新增 |
| ToolStore | `activeToolId` 状态，ModeIndicator 已监听 | 输入框监听同一状态 |

---

## 子任务清单（串行执行）

### T3.1 EntityStore 增加按 label 查找方法 ⏱️ 0.5天

**要做的事**：
1. 在 `entityStore.ts` 中新增 `findPointByLabel(label: string): Entity<'point'> | undefined`
   - 在当前活跃几何体的所有 point 实体中，按 `properties.label` 匹配（不区分大小写）
   - 返回第一个匹配的 Point Entity，未找到返回 undefined
2. 新增 `findPointsByLabels(labels: string[]): Map<string, Entity<'point'> | undefined>`
   - 批量查找，返回 label → Entity 的映射
   - 记录未找到的 label，供错误提示使用

**涉及文件**：
- `src/editor/store/entityStore.ts` — 新增方法

**验收**：
- [x] `findPointByLabel('A')` 能找到标签为 A 的点
- [x] `findPointByLabel('a')` 也能找到（不区分大小写）
- [x] `findPointByLabel('A1')` 能匹配到标签为 A₁ 的点（下标自动映射）
- [x] 不存在的标签返回 undefined
- [x] `pnpm tsc --noEmit` 通过

---

### T3.2 指令解析器 ⏱️ 0.5天

**要做的事**：
1. 新建 `src/editor/commandParser.ts`
2. 实现 `parseTextCommand(input: string, toolId: string)` 函数：
   - 去除空格，将输入拆分为单个字母（点名）
   - 根据当前工具和点名数量判断指令类型：
     - `drawSegment` 工具 + 2个点名 → `{ type: 'segment', labels: ['A', 'B'] }`
     - `crossSection` 工具 + 3个及以上点名 → `{ type: 'crossSection', labels: ['A', 'B', 'C'] }`
     - 其他 → `{ type: 'error', message: '...' }`
3. 实现 `executeTextCommand(parsed, geometryId)` 函数：
   - 调用 `findPointsByLabels` 获取点实体
   - 未找到的点 → 返回错误信息（如"未找到点 X"）
   - 线段已存在 → 返回提示（如"线段 AB 已存在"）
   - 线段指令 → 执行 `CreateEntityCommand<'segment'>`
   - 截面指令 → 复用 `crossSectionTool.ts` 中的截面计算逻辑，执行 `CreateCrossSectionCommand`
4. 返回 `{ success: boolean, message: string }` 供 UI 显示

**涉及文件**：
- `src/editor/commandParser.ts` — 新建

**验收**：
- [x] `parseTextCommand('AB', 'drawSegment')` 正确解析为线段指令
- [x] `parseTextCommand('ABC', 'crossSection')` 正确解析为截面指令
- [x] `parseTextCommand('A1B1', 'drawSegment')` 正确拆分为 `['A1', 'B1']`（支持下标点名）
- [x] `parseTextCommand('XY', 'drawSegment')` 中 X/Y 不存在时返回正确错误
- [x] 线段创建通过 Command 执行（可 undo）
- [x] 截面创建通过 Command 执行（可 undo）

---

### T3.3 截面计算逻辑提取 ⏱️ 0.5天

**背景**：当前截面计算逻辑耦合在 `crossSectionTool.ts` 的 `tryCreateCrossSection()` 函数中（平面拟合→棱交点→多边形排序→子面分割→创建 Command）。文本指令需要复用这段逻辑。

**要做的事**：
1. 将 `crossSectionTool.ts` 中的截面计算核心逻辑提取为独立函数
2. 新建 `src/editor/crossSectionHelper.ts`（或在现有文件中提取）：
   - `createCrossSectionFromPoints(geometryId: string, pointIds: string[]): { success: boolean, message: string }`
   - 内部包含：获取点坐标 → 拟合平面 → 计算棱交点 → 多边形排序 → 子面分割 → 创建 Command
3. `crossSectionTool.ts` 的 `tryCreateCrossSection()` 改为调用提取后的函数
4. `commandParser.ts` 的截面指令也调用同一函数

**涉及文件**：
- `src/editor/crossSectionHelper.ts` — 新建（提取自 crossSectionTool.ts）
- `src/editor/tools/crossSectionTool.ts` — 改为调用提取后的函数
- `src/editor/commandParser.ts` — 调用提取后的函数

**验收**：
- [x] 原有截面工具（鼠标点击方式）功能不变
- [x] 文本指令方式创建的截面与鼠标方式创建的截面效果一致
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

---

### T3.4 TextCommandInput UI 组件 ⏱️ 1天

**要做的事**：
1. 新建 `src/components/scene/TextCommandInput.tsx`
2. 显示条件：`activeToolId === 'drawSegment' || 'crossSection'` 时显示
3. 定位：紧贴 ModeIndicator 下方，与其等宽居中
4. UI 结构：
   - 输入框（`<input>`），白色背景，与 ModeIndicator 视觉风格一致
   - placeholder 根据当前工具动态变化：
     - `drawSegment` → `"输入点名画线，如 AB"`
     - `crossSection` → `"输入点名创建截面，如 ABC"`
   - 输入框下方可显示错误/成功提示（红色/绿色，1.5秒后自动消失）
5. 交互逻辑：
   - 回车 → 调用 `parseTextCommand` + `executeTextCommand`
   - 成功 → 清空输入框，显示成功提示（如"已创建线段 AB"），保持工具不切换
   - 失败 → 保留输入内容，显示错误提示
   - Escape → 取消输入框焦点（blur），回到 3D 交互
   - 工具切换时自动清空输入框和提示
6. 键盘冲突处理：输入框获得焦点时，阻止全局快捷键（Escape 除外）

**涉及文件**：
- `src/components/scene/TextCommandInput.tsx` — 新建
- `src/components/scene/Scene3D.tsx` — 引入 TextCommandInput 组件

**验收**：
- [x] 切到线段工具时，提示条上方出现输入框
- [x] 切到截面工具时，placeholder 变化
- [x] 切到其他工具时，输入框消失，说明条自动上移
- [x] 输入"AB"回车 → 成功创建线段 AB，输入框清空
- [x] 输入"ABC"回车（截面工具下）→ 成功创建截面
- [x] 输入"XY"回车（X不存在）→ 显示"未找到点 X"错误提示
- [x] 创建的线段/截面可 Ctrl+Z 撤销
- [x] 输入框获焦时，键盘输入不触发全局快捷键（如按 D 不会切换工具）
- [x] Escape 键可退出输入框焦点
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

---

## 执行顺序

```
T3.1 EntityStore 按 label 查找
  → T3.2 指令解析器
    → T3.3 截面计算逻辑提取
      → T3.4 TextCommandInput UI 组件
```

---

## 完成标志

- [x] 所有验收项通过
- [x] `pnpm lint && pnpm tsc --noEmit` 通过
- [x] 浏览器验收：线段工具/截面工具下输入框正常显示，文本指令创建线段和截面均正常

---

## 交付记录

### 变更文件清单
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/editor/store/entityStore.ts` | 修改 | 新增 `findPointByLabel`/`findPointsByLabels` + `normalizeLabel`（A1↔A₁ 映射） |
| `src/editor/commandParser.ts` | 新建 | 文本指令解析+执行，支持"字母+数字"点名拆分 |
| `src/editor/crossSectionHelper.ts` | 新建 | 截面计算核心逻辑（从 crossSectionTool 提取） |
| `src/editor/tools/crossSectionTool.ts` | 修改 | 精简为委托调用 crossSectionHelper |
| `src/components/scene/TextCommandInput.tsx` | 新建 | 文本指令输入 UI 组件（蓝色圆角胶囊框） |
| `src/components/scene/ModeIndicator.tsx` | 修改 | 有输入框时 top 下移，无输入框时自动上移 |
| `src/components/scene/Scene3D.tsx` | 修改 | 集成 TextCommandInput |

### 计划外增补
- 下标点名支持：输入 `A1` 自动匹配 `A₁`（用户反馈驱动）
- 输入框放在说明条上方（用户反馈驱动布局调整）
- Placeholder 改为更清晰的 Enter 键提示
