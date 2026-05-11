# Template UI Standard V1 Rollout Plan

## 1. 改造原则

本轮改造以 UI 和布局为主，不改变模板原有功能与可用性。

优先级：

1. 先统一布局认知：主工作区、参数区、结果区、运行状态。
2. 再统一高级 UI：按钮、输入、滑块、面板、图表、状态反馈。
3. 最后按模板特点做局部视觉增强。

布局和信息架构由实际模板现状与 `template-ui-standard-v1.md` 决定。Open Design 只用于探索视觉细节，不作为分类和布局决策来源。

## 2. 今日目标

今天需要完成：

- 确认 `Template UI Standard V1` 的目标、边界和分类方法。
- 确认三类运行时布局与一个入口布局。
- 确认 manifest 中模板到布局类型的映射。
- 确认第一批试点模板。
- 明确后续给各模板负责人的改造口径。

建议今天暂不做全量代码改造，先把标准打稳。

## 3. 试点策略

先选每类一个代表模板试点。试点不是为了追求一次性改完，而是验证标准是否贴合真实模板。

| 布局类型 | 推荐试点 | 验证重点 |
| --- | --- | --- |
| ExperimentCanvasLayout | `p03` 光学实验台 | 三栏实验台结构、参数/读数职责、画布优先级 |
| ModelExplorerLayout | `m01` 立体几何展示台 或 `chem02` 分子结构查看器 | 左对象列表、中央 3D 画布、右属性控制 |
| DataWorkbenchLayout | `m03` 解析几何画板 或 `m02` 函数图像实验室 | 顶部工具条、左/右面板、图表/坐标画布 |

试点完成后，再把经验反馈到标准文档中。

## 4. 负责人改造步骤

每个模板负责人按以下顺序改造：

1. 确认模板所属布局类型。
2. 标出当前模板的主工作区、参数区、结果区和状态反馈区。
3. 对齐对应布局类型的结构，不急着改控件细节。
4. 统一顶部工具栏职责和高度。
5. 统一参数面板位置、宽度、分组方式。
6. 统一结果读数位置。
7. 替换或调整基础 UI 组件视觉。
8. 统一 loading、empty、warning、error、toast、badge。
9. 跑原模板测试 checklist。
10. 截图提交 UI 验收。

## 5. 每类模板改造重点

### ExperimentCanvasLayout

重点：

- 主画布优先，不让说明文案挤占首屏。
- 参数面板固定且分组清晰。
- 结果读数位置稳定。
- 运行状态、参数应用、错误提示有统一反馈。

常见结构：

```text
TopBar
Main Canvas
Right Parameter Panel
Readout Area
```

### ModelExplorerLayout

重点：

- 中央 3D / 空间画布最大化。
- 左侧对象列表或预设库只承担选择职责。
- 右侧面板承担显示、属性、视角、标注控制。
- 模型状态读数轻量展示，不遮挡画布。

常见结构：

```text
TopBar
Left Object List
Center 3D Stage
Right Property Panel
```

### DataWorkbenchLayout

重点：

- 输入、构造、分析流程清晰。
- 图表/数据工作区优先。
- 参数与结果解释不要互相混杂。
- 对错误输入、空状态、计算中状态做明确反馈。

常见结构：

```text
Top Input / Tool Bar
Main Graph / Data Workspace
Right Parameter Panel
Bottom or Side Analysis Panel
```

### PortalIndexLayout

重点：

- 只负责进入具体模板。
- 不套用运行时模板布局。
- 不作为三类运行时标准的主要参考。

## 6. UI Kit 建议

第一阶段不强制做 npm 包。建议先在根仓库沉淀轻量 UI kit：

```text
template-ui-kit/
  tokens.css
  base.css
  layouts.css
  components.css
  README.md
```

等试点稳定后，再决定是同步源码到各模板，还是发布私有 npm 包。

## 7. 验收材料

每个模板改造提交时至少提供：

- 改造前截图
- 改造后截图
- 所属布局类型
- 原功能测试结果
- bridge/snapshot 简单验证结果
- 桌面尺寸截图
- 小屏或平板宽度截图

## 8. 风险与控制

| 风险 | 控制方式 |
| --- | --- |
| 改 UI 时影响功能 | 不改核心状态与算法；保留原 checklist |
| 不同负责人理解不一致 | 先试点，再让大家按标准和截图参考改 |
| Open Design 输出过度具体 | 只用作视觉参考，不决定布局 |
| 三类布局无法覆盖全部模板 | 允许子类型和 Portal 例外，但必须记录原因 |
| 改造后看起来统一但不好用 | UI 验收必须包含可用性和首屏工作区占比 |

## 9. 下一步

建议下一步顺序：

1. 评审 `docs/template-ui-standard-v1.md`。
2. 选定 3 个试点模板。
3. 为试点模板画出改造前布局标注。
4. 起草 `template-ui-kit` 的 tokens 与基础样式。
5. 先改一个试点模板验证方向。
