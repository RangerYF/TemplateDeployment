# 阶段 8.6.3：视觉统一剩余项收敛

- **任务ID**: 04-01-00-07-stage8.6.3-visual-unification
- **风险等级**: L1（常规风险：UI 细节多点改动）
- **状态**: ✅ 已完成（2026-04-01）
- **前置依赖**: 8.6.2
- **规则来源**: 用户显式执行指令（“开始这个任务”）+ 8.6 总任务拆分

## 目标

完成面板、工具栏、物体渲染与交互反馈的视觉统一，减少风格不一致。

## 计划

1. 统一面板与工具栏 Token（字号、间距、边框、阴影）。
2. 收敛力箭头、约束线、辅助线视觉规范（颜色、粗细、透明度）。
3. 统一 hover/selected 的反馈样式与层级。

## 涉及文件（预估）

- `src/components/`
- `src/renderer/`
- `src/styles/`

## 验收标准

- 主要 UI 区域视觉语言一致，无明显风格断层。
- 力箭头/约束线/交互反馈可读且符合统一规范。

## 回归门禁（执行后）

- `pnpm lint && pnpm tsc --noEmit`

---

## 追加需求记录（2026-04-01 14:15）

### 用户原文

> 右侧面板中,现在顶部是空的,就是导航栏的区域  
> 可以把右侧面板顶部的tab放到导航栏的区域，把这块空的区域用上

### 判定与路由

- **任务类型**: 体验设计（UI 布局微调）
- **风险等级**: L1（常规风险，预计 2-3 文件改动）
- **流程路径**: MODE 0 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6
- **强制门禁**: `src/` 命中，执行 `pnpm lint && pnpm tsc --noEmit`

### 实施决策

1. 将属性面板 Tab（属性/力/初始运动）迁移到顶栏右侧空白区（导航栏占位区）。
2. 右侧属性面板主体移除内部 Tab 行，仅保留当前激活 Tab 内容。
3. Tab 激活状态使用共享 store，保证顶栏与面板内容一致。

### 执行与验证结果（2026-04-01 14:28）

- 代码改动：
  - `src/components/layout/EditorLayout.tsx`
  - `src/components/panels/PropertyPanel.tsx`
  - `src/store/propertyPanelStore.ts`（新增）
- 回归命令：
  - `pnpm lint && pnpm tsc --noEmit`（未全量通过：受既有问题 `src/core/tools/SelectTool.ts:27` 未使用变量影响）
  - `pnpm tsc --noEmit`（通过）
  - `pnpm eslint src/components/layout/EditorLayout.tsx src/components/panels/PropertyPanel.tsx src/store/propertyPanelStore.ts`（通过）
- 审查结论：`:white_check_mark: 实现完全匹配计划`

### 续作反馈（2026-04-01 14:34）

- 用户反馈：`文字和tab的选中指示条之间距离太大了`
- 修复策略：将 TabButton 从垂直居中改为底对齐，压缩文案与指示条间距（`pb-1.5 + items-end + leading-none`）。
- 验证：
  - `pnpm eslint src/components/panels/PropertyPanel.tsx`（通过）
  - `pnpm tsc --noEmit`（通过）
  - `pnpm lint && pnpm tsc --noEmit`（未全量通过：既有问题 `src/core/tools/SelectTool.ts:27` 未使用变量）

### 续作反馈（2026-04-01 14:43）

- 用户反馈：`鼠标浮动到左侧面板的物体卡片上时,弄个tooltip,提示用户拖入物体可创建物体`
- 修复策略：在 `DraggableItem` 外层接入 `Tip` 组件，提示文案为“拖入画布可创建物体”。
- 代码改动：
  - `src/components/panels/ObjectPanel.tsx`
- 验证：
  - `pnpm eslint src/components/panels/ObjectPanel.tsx`（通过）
  - `pnpm lint && pnpm tsc --noEmit`（通过）

### 续作反馈（2026-04-01 14:36）

- 用户反馈：`连接件也改一下`
- 修复策略：将连接件卡片的原生 `title` 提示替换为统一 `Tip` 组件，文案包含“拖入画布可创建 + 用途 + 步骤”。
- 代码改动：
  - `src/components/panels/ObjectPanel.tsx`
- 验证：
  - `pnpm lint && pnpm tsc --noEmit`（通过）

### 续作反馈（2026-04-01 14:40）

- 用户反馈：
  - `tooptip会超过屏幕左边缘`
  - `连接件的也只需要说明拖入画布后并选择要连接的物体可创建xx`
- 修复策略：
  - `Tip` 组件增加视口边缘防溢出：根据触发器与 tooltip 实际尺寸做 `left/top` 钳制（固定定位 + Portal 保持不变）。
  - 连接件 tooltip 文案改为统一短句：`拖入画布后并选择要连接的物体可创建xx`。
- 代码改动：
  - `src/components/ui/Tip.tsx`
  - `src/components/panels/ObjectPanel.tsx`
- 验证：
  - `pnpm lint && pnpm tsc --noEmit`（通过）

### 文档链同步（checkpoint）

- 已将本轮关键用户输入归档到 `.knowledge/user-inputs.md`。
- 已同步父级文档 `stage-8-polish-delivery.md` 与总计划 `PROGRESSIVE-PLAN.md` 的 8.6.3 续作进展。
- 已按 `update-knowledge` 评估更新 `.knowledge/design.md` 与 `.knowledge/pitfalls.md`。

---

## 执行记录（2026-04-01 8.6.3 视觉统一收敛）

### 用户原文

> '/Users/cjn/Documents/工作/edu/phys_template_mechanics/.tasks/active/planck_design/stage-8.6.3-visual-unification.md'  
> 开始这个任务

### 路由与结论

- **风险等级**: L1（常规风险）
- **流程路径**: MODE 0 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6
- **审查结论**: `:white_check_mark: 实现完全匹配计划`

### 本轮实现

1. 统一样式 Token：在 `src/styles/tokens.ts` 增加 `EDITOR_CHROME / FEEDBACK_VISUAL / CONSTRAINT_VISUAL`，并将交互蓝色基准统一到 `#3B82F6`。
2. 面板与工具栏统一：`Toolbar` 与画布左下角撤销/重做按钮复用统一尺寸、边框与阴影参数；面板标题字号/字距与内边距使用统一 token。
3. 渲染反馈统一：`CanvasRenderer / SelectTool / ground` 的选中描边、hover 虚线、吸附线、对齐线、框选反馈统一到同一参数集。
4. 约束线视觉收敛：`rope / rod / spring / pulley` 的默认、hover、selected 颜色与线宽统一到 `CONSTRAINT_VISUAL`。
5. 力交互反馈收敛：`ForceRenderer` 修正选中线宽；`PropertyPanel` 力列表选中高亮与分解激活态改为统一反馈色体系。

### 实际改动文件

- `src/styles/tokens.ts`
- `src/components/Toolbar.tsx`
- `src/components/layout/EditorLayout.tsx`
- `src/components/TopBarMeta.tsx`
- `src/components/Canvas.tsx`
- `src/core/tools/SelectTool.ts`
- `src/renderer/CanvasRenderer.ts`
- `src/renderer/ForceRenderer.ts`
- `src/models/bodyTypes/ground.tsx`
- `src/models/jointTypes/rope.tsx`
- `src/models/jointTypes/rod.tsx`
- `src/models/jointTypes/spring.tsx`
- `src/models/jointTypes/pulley.tsx`
- `src/components/panels/ObjectPanel.tsx`
- `src/components/panels/PropertyPanel.tsx`
- `src/components/panels/AnalysisPanel.tsx`
- `src/components/panels/DataSourceSelector.tsx`

### 验证证据

- `pnpm lint && pnpm tsc --noEmit`：通过
