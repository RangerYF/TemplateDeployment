# Template UI Standard V1

这是给 AI 或模板负责人执行 UI 改造时使用的具体指南。目标是让不同模板在不改变功能的前提下，改造成统一的 EduMind iframe 教学工具风格。

如果需要项目推进、试点、验收节奏，请看 `template-ui-standard-rollout-plan.md`。本文只回答一个问题：**一个模板的 UI 应该被改成什么样。**

## 1. 改造任务

对单个模板进行 UI 和布局改造时，只做以下事情：

- 统一页面布局。
- 统一顶部工具栏、主工作区、参数区、结果区的位置和层级。
- 统一按钮、输入框、选择器、滑块、开关、tabs、badge、toast、alert、loading、empty、error 等 UI 表达。
- 提升画布、图表、面板、读数区域的视觉质量。
- 保持模板原有功能、交互流程和可用性。

不要做以下事情：

- 不改核心算法。
- 不改 snapshot payload 结构。
- 不改 bridge 协议。
- 不删除已有功能。
- 不改变教师原本能完成的教学操作。
- 不把主项目的保存、AI 助手、用户系统、全局导航放进模板。
- 不把模板改成官网、landing page、标准说明页或 dashboard 首页。

## 2. 改造前先判断布局类型

不要按学科判断布局。数学、物理、化学只影响术语和强调色，不决定界面结构。

按模板的主要交互形态选择布局：

```text
如果模板主要是调参数、看实验/仿真变化：
  使用 ExperimentCanvasLayout

如果模板主要是观察 3D / 空间模型，切换对象、视角、标注：
  使用 ModelExplorerLayout

如果模板主要是输入、作图、计算、浏览数据、查看路径或结果解释：
  使用 DataWorkbenchLayout

如果模板只是入口或总览页：
  使用 PortalIndexLayout
```

当前模板建议归类：

| 布局类型 | 模板 |
| --- | --- |
| `ExperimentCanvasLayout` | `chem06` 电化学演示台、`chem08` 酸碱滴定与 pH 模拟器、`c07` 化学反应速率与平衡模拟器、`m05` 概率统计模拟器、`physics-sandbox` P物理沙盒、`p03` 光学实验台、`p09` 天体运动与引力 |
| `ModelExplorerLayout` | `chem02` 分子结构查看器、`chem05` 晶体结构查看器、`m01` 立体几何展示台 |
| `DataWorkbenchLayout` | `c03` 化学方程式配平器、`c04` 元素周期表、`c09` 有机化学反应路径图、`m02` 函数图像实验室、`m03` 解析几何画板、`m04` 三角函数演示台、`m06` 向量运算演示台 |
| `PortalIndexLayout` | `chemistry-zhd` 化学专题工具总入口、`p-mechanics` 力学模板总入口 |

`p-mechanics` 如果进入具体力学实验，则具体实验按 `ExperimentCanvasLayout` 处理。

## 3. 通用页面骨架

每个真实 iframe 运行模板都应该由这些区域组成：

```text
Template Runtime
├─ Top Runtime Bar
├─ Main Workspace
├─ Control / Parameter Area
├─ Result / Readout Area
└─ Local Feedback Layer
```

### 3.1 Top Runtime Bar

顶部工具栏是模板内部的运行时工具栏，不是主项目导航。

高度：

- 桌面端：44-56px
- 紧凑工具模板：40-48px

应该包含：

- 模板标题或当前模块标题
- 模式切换 tabs / segmented control
- 运行状态 badge
- 局部工具按钮：运行、暂停、重置、截图、撤销、重做、面板折叠

不应该包含：

- 讲义中心、备课中心、可视化中心等主项目导航
- 用户头像
- 保存按钮
- AI 助手按钮
- 大段说明文案
- 品牌 hero 标题

### 3.2 Main Workspace

主工作区必须是首屏视觉中心。

要求：

- 实验、模型、图表类模板中，主工作区至少占主体区域宽度的 60%。
- 不要在主工作区上方堆大标题、说明卡片、统计卡片。
- 主工作区可以是 canvas、SVG、Three.js 场景、图表、表格、路径图或公式结果区。
- 工具说明应放在参数面板中的小型提示，或作为可折叠帮助，不长期占据主区域。

### 3.3 Control / Parameter Area

参数区承担“用户如何改变当前场景”的职责。

推荐位置：

- 大多数模板：右侧固定面板。
- 模型观察类：左侧对象列表 + 右侧属性控制。
- 表单结果类：输入区可放顶部或左侧，结果区放右侧或底部。

尺寸：

- 右侧参数面板宽度：300-360px。
- 左侧对象列表宽度：220-280px。
- 小屏下可折叠为 drawer 或底部面板。

### 3.4 Result / Readout Area

结果区承担“当前状态意味着什么”的职责。

推荐位置：

- 实验仿真类：右侧面板下方或画布底部读数条。
- 模型观察类：右侧属性面板内或画布角落小状态条。
- 数据工作台类：底部分析面板或右侧下半区。

结果区应该展示：

- 核心数值
- 单位
- 简短公式提示
- 当前状态解释
- 警告或异常原因

不要把结果区做成全屏弹窗或长期占据主画布。

### 3.5 Local Feedback Layer

模板内部可以有局部反馈，但只表达模板运行时状态。

包括：

- loading
- empty
- error
- warning
- toast
- badge
- inline validation

位置规则：

- 参数错误靠近参数项。
- 运行状态放在顶部工具栏或画布角落。
- 成功应用参数可以用 toast，但不要遮挡主画布关键内容。
- 严重错误可用 alert，但应保留返回或重试路径。

## 4. Layout A: ExperimentCanvasLayout

适用于实验仿真 / 画布操作类。

最终结构应接近：

```text
┌────────────────────────────────────────────────────────────┐
│ Top Runtime Bar                                            │
├──────────────────────────────────────────────┬─────────────┤
│                                              │ Parameters  │
│ Main Simulation Canvas / Stage               │             │
│                                              ├─────────────┤
│                                              │ Readouts    │
└──────────────────────────────────────────────┴─────────────┘
```

改造规则：

- 主画布优先，画布不应被说明文案挤到首屏下方。
- 参数面板固定在右侧，按实验对象、环境参数、显示选项分组。
- 每个参数项应包含 label、控件、当前值、单位。
- 运行、暂停、重置、截图放顶部工具栏或画布右上角，不散落在各个面板。
- 读数区和公式提示放右侧面板下方或底部读数条。
- 动态仿真状态用 badge 表示，如“运行中”“已暂停”“参数已应用”。

适配示例：

- `p03`：保留现有光学实验台的 stage-canvas + 参数 + readouts 思路，但统一左右面板视觉和顶部工具栏职责。
- `chem06`：电化学场景作为主画布，电极/溶液/预设/电流读数归入右侧参数与读数。
- `m05`：统计实验过程或图表作为主区，抽样参数和统计读数归入右侧。

## 5. Layout B: ModelExplorerLayout

适用于模型观察 / 空间探索类。

最终结构应接近：

```text
┌────────────────────────────────────────────────────────────┐
│ Top Runtime Bar                                            │
├──────────────┬──────────────────────────────┬──────────────┤
│ Object List  │ 3D / Spatial Model Stage      │ Properties   │
│ / Presets    │                              │ / Display    │
└──────────────┴──────────────────────────────┴──────────────┘
```

改造规则：

- 中央 3D / 空间画布最大化。
- 左侧只承担对象选择、预设选择、结构列表，不放复杂参数。
- 右侧承担显示控制、属性、视角、标注、动画、测量。
- 画布内可放轻量视角控件和状态读数，但不要遮挡模型。
- 选择对象后，右侧面板应显示对象属性和可调项。
- 空状态要告诉用户如何选择对象或加载模型。

适配示例：

- `chem02`：左侧分子/预设，中央分子 3D，右侧键长、键角、标签、渲染模式。
- `chem05`：左侧晶体/材料库，中央晶胞，右侧晶胞、标签、透明度、复制范围。
- `m01`：保留实体列表 + 3D 场景 + 参数面板，可选展开图/三视图作为中间辅助区。

## 6. Layout C: DataWorkbenchLayout

适用于公式图表 / 数据推演 / 知识工具类。

最终结构按子类型选择。

### 6.1 GraphWorkbench

适用于函数、几何、三角、向量、统计图形工作台。

结构：

```text
┌────────────────────────────────────────────────────────────┐
│ Formula / Tool Bar                                         │
├──────────────┬──────────────────────────────┬──────────────┤
│ Entity List  │ Graph / Coordinate Canvas     │ Parameters   │
│ or Presets   │                              │ / Inspector  │
├──────────────┴──────────────────────────────┴──────────────┤
│ Analysis / Result Panel                                    │
└────────────────────────────────────────────────────────────┘
```

规则：

- 顶部放公式输入、当前工具、撤销重做、模式切换。
- 中央图表或坐标画布优先。
- 左侧可放函数/实体/预设列表。
- 右侧放参数、属性和 inspector。
- 底部可放分析、关键点、过程解释。

适配模板：

- `m02`
- `m03`
- `m04`
- `m06`

### 6.2 FormResultTool

适用于输入计算 / 校验 / 结果解释类。

结构：

```text
┌────────────────────────────────────────────────────────────┐
│ Tool Bar                                                    │
├──────────────────────────────┬─────────────────────────────┤
│ Input / Configuration         │ Result / Explanation        │
└──────────────────────────────┴─────────────────────────────┘
```

规则：

- 输入区必须清晰，错误提示靠近输入。
- 结果区展示结构化结果、步骤、解释、警告。
- 不需要强行做大画布。
- 操作按钮靠近输入区，但样式与其他模板一致。

适配模板：

- `c03` 化学方程式配平器

### 6.3 DataKnowledgeBrowser

适用于数据表、知识图谱、路径关系浏览。

结构：

```text
┌────────────────────────────────────────────────────────────┐
│ Filter / Search / Mode Bar                                 │
├────────────────────────────────────────┬───────────────────┤
│ Data Grid / Path Map / Knowledge View  │ Detail Panel      │
└────────────────────────────────────────┴───────────────────┘
```

规则：

- 搜索、筛选、模式切换放顶部。
- 主区展示元素表、路径图、关系图或数据网格。
- 详情面板固定在右侧或作为可折叠面板。
- 选中态、hover、tooltip、空状态必须统一。

适配模板：

- `c04` 元素周期表
- `c09` 有机化学反应路径图

## 7. Layout D: PortalIndexLayout

适用于入口 / 总览页。

规则：

- 只负责进入具体模板。
- 不套用实验、模型、数据工作台布局。
- 可以使用主项目风格的轻量卡片或列表，但不要承担教学运行时功能。
- 入口页不作为运行时模板 UI 标准的主要参考。

适配模板：

- `chemistry-zhd`
- `p-mechanics` 总入口状态

## 8. 视觉规则

### 8.1 风格方向

整体风格应是：

- 专业
- 克制
- 清爽
- 工具型
- 教学友好
- 信息密度适中

避免：

- 官网感
- 营销感
- 大 hero
- 过度插画
- 大面积装饰渐变
- 过大圆角
- 卡片套卡片
- 文字说明压过工具本身

### 8.2 基础 tokens

建议统一使用下列 token 语义。具体落地可使用 CSS variables、Tailwind theme 或组件常量。

```css
:root {
  --et-bg: #f6f8fb;
  --et-surface: #ffffff;
  --et-surface-muted: #f8fafc;
  --et-border: #dbe3ee;
  --et-text: #0f172a;
  --et-text-muted: #64748b;
  --et-primary: #2563eb;
  --et-success: #16a34a;
  --et-warning: #d97706;
  --et-danger: #dc2626;
  --et-radius: 8px;
  --et-control-h: 36px;
}
```

学科强调色：

| 学科 | 强调色建议 | 只用于 |
| --- | --- | --- |
| 化学 | teal / green | 主操作、选中态、关键化学状态 |
| 物理 | blue / indigo | 主操作、运行态、实验强调 |
| 数学 | violet-blue | 主操作、图表强调、选中态 |

不要因为学科色不同而改变基础组件结构。

### 8.3 组件规则

Button：

- 主操作按钮只用于最关键的局部动作。
- 次操作使用 outline 或 ghost。
- 危险操作使用 danger 色，不使用普通强调色。
- 工具栏内优先使用图标按钮或图标 + 短文本。

Input / Select：

- 高度统一为 36px 左右。
- 错误态必须有边框或提示文案。
- 单位显示靠近数值，不让用户猜单位。

Slider：

- 必须显示 label、当前值、单位。
- 重要参数可以同时提供数值输入。
- 不要只给裸滑块。

Tabs / Segmented Control：

- 用于模式切换、视图切换、实验模块切换。
- 选中态清晰，但不要过度装饰。

Panel：

- 面板用于参数、属性、结果、列表。
- 不要把整个页面切成很多大卡片。
- 禁止卡片套卡片，除非是列表项或明确的结果块。

Readout：

- 读数应突出数值和单位。
- 解释文本简短。
- 多个读数用一致的 row 或 compact card。

Toast / Alert：

- Toast 用于短暂反馈。
- Alert 用于需要用户处理的问题。
- 错误优先靠近出错位置显示。

### 8.4 图表与画布规则

图表和画布可以保留各模板特点，但应统一：

- 网格线颜色和密度克制。
- 坐标轴、参考线、选中态有清晰层级。
- tooltip 使用统一圆角、边框、阴影和字体。
- 空画布要有 empty state。
- 计算中要有 loading state。
- 截图 / 导出按钮位置稳定。

## 9. 响应式规则

主要目标尺寸：桌面 iframe 约 1440x900。

最低适配目标：约 1024x768。

规则：

- 小屏下优先保主工作区面积。
- 右侧参数面板可折叠。
- 左侧列表可折叠为 drawer 或 icon rail。
- 顶部工具栏按钮可隐藏文字，只保留图标和 tooltip。
- 不设计成只能在 1920x1080 使用。

## 10. AI 改造流程

AI 改造单个模板时，按以下步骤执行：

1. 阅读模板入口、现有布局组件和主要样式文件。
2. 判断模板属于哪种布局类型。
3. 列出当前主工作区、参数区、结果区、状态反馈区。
4. 保留现有功能和状态逻辑。
5. 只调整布局结构、样式、组件外观和反馈位置。
6. 不修改 bridge/snapshot 协议。
7. 不加入主项目 UI。
8. 改造后运行原有检查或至少说明无法运行的原因。
9. 给出改造前后结构变化说明。

## 11. 完成标准

改造后的模板必须满足：

- 能明确看出所属布局类型。
- 主工作区是首屏视觉中心。
- 参数区位置稳定。
- 结果区位置稳定。
- 顶部工具栏只包含模板运行时工具。
- 按钮、输入、滑块、tabs、面板、badge、toast、alert 风格统一。
- 没有主项目导航、保存、AI 助手、用户入口。
- 没有 landing page、hero、营销介绍。
- 原功能可继续使用。
- bridge/snapshot 不被破坏。
- 桌面和小屏下不出现明显布局溢出。

## 12. P09 标杆实现细则（右栏 / 控件 / 响应式）

第 1-11 节定义"应该长什么样"。本节是**像素级照抄清单**：以 `visual_p9`（天体运动与引力）为唯一标杆，凡 `ExperimentCanvasLayout` 模板的右栏、控件、响应式都按此实现，做到与 P09、P03 完全一致。改造时优先复制本节的精确数值，不要凭感觉近似。

标杆源码位置（出现分歧时以源码为准）：
- 主题变量：`visual_p9/src/index.css`（`--theme-*`）
- 设计 token：`visual_p9/src/styles/tokens.ts`（`COLORS` / `RADIUS` / `SHADOWS`）
- 右栏骨架：`visual_p9/src/components/layout/AppLayout.tsx`
- 控件：`visual_p9/src/components/ui/{slider,input,button}.tsx`
- 参数 / 读数：`visual_p9/src/components/panels/{ParameterPanel,MetricsPanel}.tsx`

### 12.1 双强调色规则（最易踩坑，务必先读）

P09 同时存在**两套强调色**，职责不同，不可混用：

| 用途 | 颜色 | 取值（浅 / 暗） | 来源 |
| --- | --- | --- | --- |
| **导航强调** = 通顶模块切换 tabs 选中态 | **蓝** | `#2563eb` / `#3b82f6` | `index.css` `--theme-primary` |
| **控件强调** = 右栏滑块、开关、聚焦环、数字框聚焦、模型按钮选中 | **绿** | `#00C06B`（浅暗一致） | `tokens.ts` `COLORS.primary` |

> 注意：本文件 §8.2 早期写的 `--et-success: #16a34a` 是占位值，**标杆实际控件绿是 `#00C06B`**，以本节为准。学科色（§8.2）只换"控件强调色"的色相（化学青绿、物理蓝、数学紫蓝），**通顶 tabs 始终蓝**、不随学科变。

读数数值默认是**中性文本色**（`--theme-text`），不是绿色；只有需要强调的行（如校验值）才点绿。

### 12.2 精确 token

```css
/* 颜色（浅色） */
--theme-primary:        #2563eb;   /* tabs 选中（暗:#3b82f6） */
--accent-green:         #00C06B;   /* 控件强调，浅暗一致 */
--track-bg:             #F5F5F7;   /* 滑块未填充轨道（暗: rgba(255,255,255,.12)） */
--theme-text:           #0f172a;   /* 读数值、正文（暗:#e2e8f0） */
--theme-text-muted:     #64748b;   /* 标签、参数值、分区标题 */
--theme-border:         #e2e8f0;   /* 分区/行分隔线（暗: rgba(255,255,255,.08)） */
--theme-panel-bg:       #ffffff;   /* 右栏底色（暗:#0f1629） */
--theme-surface-hover:  #f0f2f5;   /* 数字输入框底（暗:#1e293b 档） */

/* 圆角（tokens.ts RADIUS） */
input: 14px;  sm: 8px;  md: 12px;  full: 9999px;

/* 阴影 */
shadow-sm: 0 1px 4px rgba(0,0,0,.04);
```

### 12.3 右栏骨架

- 宽度 **320px**，`border-left`，底色 `--theme-panel-bg`，整体可纵向滚动。
- 分组用 **`border-b` + `padding:16px`** 分隔（不是玻璃卡片、不是每行卡片）。
- 分区标题 `<h3>`：`font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.6px; color:--theme-text-muted; margin-bottom:12px`。**不带英文副标签**。
- 顺序：`实验参数`（模型按钮 + 参数 + 重置按钮）→ 可选 `高级设置`（`<details>`）→ `实时读数`。

### 12.4 控件精确规格（照抄）

**滑块**（`slider.tsx`）— 最易做错，P09 是粗轨大圆头：
- 轨道 `height:8px`，`border-radius:9999px`，底色 `--track-bg`；已填充段为绿 `--accent-green`。
- 滑块头 `20px×20px`，**白底 + `2px solid 绿`**，`border-radius:9999px`，`box-shadow:0 1px 4px rgba(0,0,0,.04)`，hover `scale(1.1)`。
- native `<input type=range>` 落地：input 高 20px、`background:transparent`，轨道画在 `::-webkit-slider-runnable-track`（8px + 填充渐变），thumb `margin-top:-6px` 居中；Firefox 用 `::-moz-range-track/-progress/-thumb`。填充比例用内联 `--fill:<pct>%` 在 input/外部赋值时更新。

**数字输入框**（滑块下方，`input.tsx` + ParameterPanel override）：
- `height:28px; width:100%; padding:0 8px; font-size:12px; border-radius:14px; border:1px solid 边框; background:surface-hover`。
- 聚焦：`border-color:绿; box-shadow:0 0 0 3px rgba(0,192,107,.1)`。失焦/回车提交并 clamp 到 min/max，双向同步滑块。

**参数行**（`space-y-1.5`=6px）：上行 `flex justify-between`（标签 `text-xs`=12px muted + 数值 `text-[11px]`=11px muted）→ 整宽滑块 → 数字输入框。参数间距 `space-y-3`=12px。

**重置按钮**（Button `variant=secondary size=sm`）：胶囊 `border-radius:9999px`，底 `bgMuted #F5F5F7`，文字 `--theme-text` 深色，`font-size:13px; padding:8px 14px`，`width:100%`，hover 底变 `#F0F0F0`。

**读数行**（`MetricsPanel`，`space-y-1`=4px）：`flex justify-between; padding:6px 0`，行间 `border-bottom`（最后一行无）；标签 `text-sm`=14px muted；数值 `text-sm font-semibold tabular-nums` **中性色**。底部可接一句 `text-xs` muted 说明。

**模型/分段按钮**：选中态用绿（边框 + `rgba(0,192,107,.12)` 底 + 绿字）；开关 `on` 态绿。

### 12.5 响应式（断点 1024px，照 `AppLayout.tsx`）

- **≥1024px（lg）**：右栏常驻（`width:320`）。
- **<1024px**：右栏移出文档流，变 `position:fixed` 右侧**滑入抽屉**（`width:min(320px,86vw)`，`translateX` 动画，半透明遮罩 `rgba(0,0,0,.42)`，`-8px 0 28px` 阴影）；右下角 `48px` 圆形 **⚙ 悬浮按钮**唤出；抽屉内 **×** / 点遮罩 / **Esc** 关闭。
- **<600px**：隐藏标题文字与次要信息给 tab 让位；收紧底部图表高度。
- TopBar：标题 `min-width:0 + ellipsis` 永不撑破视口；tab 条 `flex:1` 且 `overflow-x:auto` 可横向滚动。

**不变性 / 不白屏铁律**：
- 画布管理器必须用 `ResizeObserver` 监听容器，尺寸变化时重算 backing store（`canvas.width = w*dpr`），避免拉伸/白屏。
- 3D 场景（Three.js）除 `show()` 外，也必须 `ResizeObserver` 监听容器，运行时 `setSize + camera.aspect` 跟随，否则窗口/方向变化会变形。
- 抽屉用覆盖式 `fixed`，不挤压画布，避免开关抽屉触发画布重排。

### 12.6 落地参考

P07（`physics07`，Vanilla TS）已按本节实现，可作为非 React 模板的抄写样板：
- 主题 + 控件 + 响应式 CSS：`physics07/packages/core/src/styles.css`
- 右栏骨架 / 抽屉 / FAB：`physics07/packages/core/src/ui/Layout.ts`
- 参数控件（滑块填充 / 数字框 / reset）：`physics07/packages/core/src/ui/ParameterPanel.ts`
- 读数行：`physics07/packages/p07-thermodynamics/src/teachingPanel.ts`
- 3D ResizeObserver：`physics07/packages/p07-thermodynamics/src/scenes/three/PistonScene3D.ts`

P03 / P04 等其它 `ExperimentCanvasLayout` 模板改造时，对照本节逐项核对即可，做到与 P09 一致。
