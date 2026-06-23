# Phys Template Mechanics 五模块 UI 改造落地规格

> 日期：2026-06-23 | 状态：已落地 | 范围：`phys_template_mechanics` 中 P-01 / P-02 / P-05 / P-12 / P-14

## 1. 背景

`phys_template_mechanics` 包含两类前端形态：

1. **P06 波动与振动演示台**：单独页面，走 `P06WavePage`，不在本轮改造范围。
2. **五个共用物理引擎模块**：`P-01` 受力分析、`P-02` 运动模拟、`P-05` 简谐运动、`P-12` 动量分析、`P-14` 机械能分析。五个模块共用 `Canvas`、物体库、属性面板、分析面板、scene store、selection store、physics bridge。

本轮目标是统一五个共用引擎模块的前端外壳和交互，同时不改变 P06、物理引擎、scene JSON、snapshot 与 bridge 协议。

## 2. 参考依据

- V2 设计规格：`docs/superpowers/specs/2026-06-22-template-ui-standard-v2-design.md`
- V2 权威原型目标路径：`docs/superpowers/prototypes/template-ui-authority.html`
- P09 React 标杆：
  - `visual_p9/src/components/layout/AppLayout.tsx`
  - `visual_p9/src/components/layout/TopBar.tsx`
  - `visual_p9/src/index.css`
- P07 Vanilla 标杆：
  - `physics07/packages/core/src/ui/Layout.ts`
  - `physics07/packages/core/src/styles.css`
- 五模块落地实现：
  - `phys_template_mechanics/src/components/layout/PhysicsWorkbenchLayout.tsx`
  - `phys_template_mechanics/src/components/layout/SceneSelector.tsx`
  - `phys_template_mechanics/src/components/layout/EditorLayout.tsx`
  - `phys_template_mechanics/src/components/Canvas.tsx`
  - `phys_template_mechanics/src/components/panels/ObjectPanel.tsx`
  - `phys_template_mechanics/src/components/panels/PropertyPanel.tsx`
  - `phys_template_mechanics/src/components/panels/AnalysisPanel.tsx`

## 3. 设计立场

这五个模块不是单一实验参数面板，而是一个**物理编辑器 / 工作台**：用户要选择场景、添加物体、编辑属性、运行仿真、查看分析图表。

因此本轮采用 V2 的视觉和交互原则，但落地为适配编辑器型模板的 **PhysicsWorkbenchLayout**：

- 统一 48px TopBar
- 统一 V2 CSS variables、字体、边框、圆角、阴影
- 统一蓝色导航强调与绿色控件强调
- 右侧面板承担“属性 / 力 / 初始运动”职责
- 对象库改为按需打开的左侧抽屉
- 分析图表保留在底部面板
- 桌面端面板常驻，移动端使用覆盖式抽屉

## 4. 最终布局

```text
┌────────────────────────────────────────────────────────────────────────┐
│ TopBar 48px                                                            │
│ 模板名 | Scene 下拉 | 添加对象 | 工具 | 时间轴 | 播控 | 状态 | 主题 | 教学 │
├─────────────────────────────────────────────────────────┬──────────────┤
│ Canvas 主工作区                                         │ 属性 / 参数   │
│                                                         │ 320px         │
│ [左侧对象库抽屉：默认关闭，覆盖画布，不挤压画布]         │              │
├─────────────────────────────────────────────────────────┴──────────────┤
│ AnalysisPanel：可折叠，可拖拽高度，多图表分析                          │
└────────────────────────────────────────────────────────────────────────┘
```

核心原则：

- 画布是首屏视觉中心。
- 五个模板单独上架，页面内模板名固定，只切换当前模板内的 scene。
- 物体库默认收起，只在需要添加对象时展开。
- 右侧属性面板桌面端常驻，移动端变抽屉。
- 底部分析面板保留原有折叠、拖拽高度和多图表能力。

## 5. TopBar 规格

高度：`48px`。

从左到右：

1. 固定模板名，例如 `P-01 受力分析`
2. 当前模板内 scene 选择器，例如 `FM-001 水平面受力分解`
3. 添加对象按钮
4. 工具按钮：选择、拖动画布
5. 时间轴：保留秒级刻度和秒数标签，右侧留安全缩进避免贴近播放按钮
6. 播放/暂停、停止、重置
7. 当前时间 / 最大时间
8. 速度选择
9. 状态 badge
10. 显示设置：坐标轴、坐标原点、刻度、位移标注、跳转时间
11. 主题切换
12. 教学按钮

已取消左上角返回按钮，因为五个模板独立上架后运行页不应强调“返回模块列表”。

## 6. Scene 选择器

触发器只显示当前 scene，不展示模板名，模板名由 TopBar 固定文本承担。

```text
FM-011 斜面受力  ▾
```

展开面板：

```text
┌──────────────────────────────────────────────┐
│ 选择场景                              15 个可用 │
│ 搜索场景编号或名称                           │
├──────────────────────────────────────────────┤
│ FM-001 水平面受力分解  │ FM-002 水平面摩擦分析 │
│ FM-011 斜面受力        │ FM-021 单绳悬挂       │
│ ...                                          │
└──────────────────────────────────────────────┘
```

落地规则：

- 面板宽度：`min(720px, calc(100vw - 32px))`
- 列表最大高度：`min(56vh, 430px)`，内部滚动
- 只展示当前 module 的 `ready` scenes
- 支持搜索 scene id 和 scene name
- 列表使用自适应网格：`repeat(auto-fit, minmax(160px, 1fr))`
- item 只展示 scene id 和 scene name，不展示教学解释和“已接入”徽标
- 选中态使用蓝色边框/浅蓝底
- 支持 Esc 关闭、点击外部关闭
- 切换 scene 时走现有 hash 路由，不修改 catalog 数据结构

## 7. 对象库

对象库由 TopBar 的“添加对象”打开。

桌面端：

- 默认关闭，不占布局宽度
- 打开后覆盖画布左侧，不挤压画布
- 宽度：`280px`，最大 `86vw`
- 高度：TopBar 下方到视口底部
- 背景：`var(--theme-panel-bg)`
- 右侧边框：`1px solid var(--theme-border)`
- 关闭方式：关闭按钮、Esc
- overlay 外层不得拦截从对象库拖到画布的拖拽事件

内容保留原有分组：

- 基础物体
- 支撑与约束
- 特殊表面
- 连接件

功能保留：

- 拖拽到画布创建物体
- 触屏 / 粗指针环境点击创建物体
- 连接件拖拽和点击创建流程

资源补齐：

- `public/thumbnails/person.png`
- `public/thumbnails/channel.png`

这两张 96×96 透明底缩略图用于替代 fallback SVG，保证人和槽型船与其它物块视觉一致。

## 8. 右侧属性面板

桌面端常驻，宽度统一为 `320px`。

内容顺序：

1. 选中对象 / 环境配置标题
2. 状态 badge
3. 属性 / 力 / 初始运动 tabs
4. 参数编辑区
5. 删除等操作按钮

移动端：

- 右侧属性面板变为覆盖式抽屉
- 入口使用 P09 风格齿轮状 `⚙` 圆形按钮
- 抽屉打开后保留原属性面板内容

## 9. 时间轴与播放控制

旧 `Toolbar.tsx` 的时间轴能力已迁入 `PhysicsWorkbenchLayout` 中的 `PlaybackTimeline`。

必须保留：

- 播放/暂停
- 停止
- 重置
- 当前时间 / 最大时间
- 倍速选择
- 进度拖动 seek
- 秒级 tick
- 秒数标签
- 接近整秒时吸附到整数秒
- 右侧安全缩进，避免滑块最右端贴近播放按钮

## 10. 显示设置

旧工具栏中的坐标系功能迁移到 TopBar 右侧的“显示设置”浮层。

必须保留：

- 坐标轴模式：关 / H / V / HV
- 世界原点
- 选中物体原点
- 坐标刻度
- 位移标注
- 跳转到指定时间

## 11. 分析面板

保留 `AnalysisPanel` 的已有能力：

- 折叠 / 展开
- 拖拽高度
- 运动、能量、动量等图表切换
- 多数据源选择
- 图表与播放时间同步

本轮不重写分析图表逻辑，只将其纳入新的工作台布局。

## 12. 教学弹窗

五模块统一使用 TopBar 右侧教学入口。

Tab：

1. 场景目标
2. 构造步骤
3. 物理关系
4. 数据来源

内容来源：

- `templates.json` 的 `teaching.teachingObjective`
- `teaching.constructionSteps`
- 当前 scene / module metadata

## 13. 不可修改范围

本轮 UI 改造不修改：

- 物理引擎行为
- `physicsBridge`
- scene JSON 结构
- snapshot payload
- template bridge 协议
- template catalog schema
- command / undo / redo 语义
- 画布渲染器的物理图形含义

允许修改：

- `EditorLayout` 结构
- TopBar 组合
- 对象库呈现方式
- 属性面板容器
- 分析面板容器
- CSS variables / token 映射
- 教学弹窗 UI
- 响应式抽屉行为

## 14. 响应式

| 断点 | 行为 |
|------|------|
| ≥ 1280px | 右侧属性面板常驻 320px；对象库默认关闭，可 overlay 打开；时间轴显示 |
| 1024-1279px | 右侧属性面板仍常驻；TopBar 隐藏次要文字 |
| 768-1023px | 属性面板变右侧抽屉；对象库变左侧抽屉；时间轴让位给播控 |
| < 600px | TopBar 隐藏长标题；scene 触发器截断；属性入口使用 `⚙` |

## 15. 验收标准

- [x] P-01/P-02/P-05/P-12/P-14 都使用统一 `PhysicsWorkbenchLayout`
- [x] P06 不受影响
- [x] TopBar 高度 48px，职责清晰，无入口页式大标题
- [x] 模板名固定，scene 可在当前模板内通过下拉选择器切换
- [x] 左侧物体库默认关闭，可从 TopBar 打开
- [x] 右侧属性面板桌面端 320px 常驻
- [x] 小于 1024px 时属性面板为覆盖式抽屉
- [x] 对象库抽屉覆盖画布，不挤压画布
- [x] 对象库拖拽不被 overlay 阻断
- [x] 分析面板保留折叠、拖拽高度和多图表能力
- [x] 时间轴保留秒级刻度和秒数标签
- [x] 坐标系设置完整保留
- [x] 蓝色用于 scene 导航、播控、教学 tabs
- [x] 绿色用于滑块、输入聚焦、开关、对象添加/选中控件
- [x] Canvas 在打开/关闭对象库和属性抽屉时不白屏
- [x] 教学弹窗能展示当前 scene 的目标和构造步骤
- [x] 原有拖拽添加、点击添加、属性编辑、运行仿真、分析图表可用
- [x] bridge/snapshot/scene JSON 不被破坏
- [x] build 成功

## 16. 收尾记录

- 旧 `Toolbar.tsx` 的播放、坐标系和时间轴刻度能力已迁移到 `PhysicsWorkbenchLayout`。
- `Toolbar.tsx` 删除前确认无任何引用。
- 移动端属性入口统一为 P09 风格 `⚙` 圆形按钮。
- 物体库补齐 `person.png`、`channel.png` 缩略图。
