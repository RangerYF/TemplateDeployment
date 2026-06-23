# Template UI Standard V2 — 设计规格

> 日期：2026-06-22 | 状态：待审批

## 1. 目标

为 EduMind 全部物理模板（后续扩展到化学、数学）制定**唯一权威的 UI 标准**，使得：

1. 任何模板均可直接照此文档 + 原型 HTML 进行前端重构
2. 不同模板之间达到布局统一、控件一致、响应式完备
3. 消除 V1 标准中"文档与 P09 源码不一致"的循环依赖问题

## 2. 交付物

| 产出 | 说明 |
|------|------|
| **本文档** | 唯一设计 spec，描述所有规则和 token |
| **权威原型 HTML** | `docs/superpowers/prototypes/template-ui-authority.html`，自包含、可浏览器打开、可交互，所有 token 以此文件 CSS 为准 |
| **修订后的 template-ui-standard-v2.md** | `docs/superpowers/specs/template-ui-standard-v2.md`，替代 V1，§12 不再引用 P09 源码，改为引用原型 |

**不包含：**
- 不修改 P09 现有代码（跑得好就不动）
- 不做共享 npm UI Kit（技术栈不统一，当前阶段无必要）
- 不做非 ExperimentCanvasLayout 的原型（后续按需补充）

## 3. 设计决策总结

### 3.1 参考源变更

```
V1: 标准文档 → 描述 P09 代码 → 其他模板照抄 P09
     问题：文档与代码有 8 处不一致，信谁？

V2: 标准文档 → 描述原型 HTML → 原型是唯一权威
     原型自包含，右键检查元素即可获取精确 token
```

### 3.2 视觉风格

沿用 P09 现有风格：专业、克制、清晰简明。不做风格升级。

### 3.3 布局类型

当前只做 **ExperimentCanvasLayout**（覆盖所有物理模板），其他布局类型后续按需补充。

### 3.4 原型覆盖范围

原型覆盖 **UI 外壳**，不覆盖画布内容（各模板画布差异大）：

- TopBar（标题、场景 tabs、状态 badge、播控、速度、主题切换、教学按钮）
- 右栏骨架（分区标题、模型选择、参数行、滑块、数字输入、科学计数法输入、开关、重置按钮、读数行）
- 教学浮窗（三 Tab 模态框：公式与关系、教学要点、数据来源）
- 高级设置折叠区
- 响应式全覆盖（断点、抽屉、FAB、遮罩）
- 亮/暗主题切换

画布区放占位示意 + 标注"主工作区"。

## 4. 双强调色规则

这是最易踩坑的规则，必须最先理解：

| 用途 | 名称 | 颜色 | CSS 变量 | 使用场景 |
|------|------|------|----------|----------|
| 导航强调 | 蓝 | `#2563eb` (浅) / `#3b82f6` (暗) | `--theme-primary` | TopBar tabs 选中、播放按钮、状态 badge、教学浮窗 tabs |
| 控件强调 | 绿 | `#00C06B` (浅暗一致) | `--accent-green` | 滑块填充+滑块头、开关 on 态、数字输入聚焦环、模型按钮选中态 |

**规则：**
- 通顶 tabs **始终蓝**，不随学科变
- 控件强调色按学科变：物理蓝、化学青绿、数学紫蓝（但默认绿 `#00C06B`）
- 读数数值默认是**中性文本色** `--theme-text`，不是绿色

## 5. 完整 Token 清单

以原型 HTML 的 `:root` CSS 变量为唯一真相源。

### 5.1 颜色

```css
/* 亮色模式 */
:root, [data-theme="light"] {
  --theme-bg: #f6f8fb;
  --theme-surface: #ffffff;
  --theme-surface-hover: #f0f2f5;
  --theme-border: #e2e8f0;
  --theme-text: #0f172a;
  --theme-text-secondary: #475569;
  --theme-text-muted: #64748b;

  --theme-primary: #2563eb;         /* 导航蓝 */
  --theme-primary-hover: #1d4ed8;
  --theme-primary-light: #eff6ff;

  --accent-green: #00C06B;          /* 控件绿 */
  --accent-green-hover: #00A85A;
  --accent-green-light: #F0FBF6;
  --accent-green-focus-ring: rgba(0, 192, 107, 0.1);

  --track-bg: #F5F5F7;             /* 滑块未填充轨道 */

  --theme-success: #16a34a;
  --theme-success-light: #dcfce7;
  --theme-warning: #d97706;
  --theme-danger: #dc2626;

  --theme-shadow-sm: 0 1px 4px rgba(0,0,0,0.04);
  --theme-shadow-md: 0 2px 12px rgba(0,0,0,0.06);

  --theme-topbar-bg: #ffffff;
  --theme-panel-bg: #ffffff;
}

/* 暗色模式 */
[data-theme="dark"] {
  --theme-bg: #0a0e1a;
  --theme-surface: #111827;
  --theme-surface-hover: #1e293b;
  --theme-border: rgba(255,255,255,0.08);
  --theme-text: #e2e8f0;
  --theme-text-secondary: #94a3b8;
  --theme-text-muted: #64748b;

  --theme-primary: #3b82f6;
  --theme-primary-hover: #60a5fa;
  --theme-primary-light: rgba(59,130,246,0.1);

  --accent-green: #00C06B;
  --accent-green-hover: #00A85A;
  --accent-green-light: rgba(0,192,107,0.08);
  --accent-green-focus-ring: rgba(0, 192, 107, 0.15);

  --track-bg: rgba(255,255,255,0.12);

  --theme-success: #22c55e;
  --theme-success-light: rgba(34,197,94,0.1);
  --theme-warning: #f59e0b;
  --theme-danger: #ef4444;

  --theme-shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --theme-shadow-md: 0 4px 6px rgba(0,0,0,0.4);

  --theme-topbar-bg: #0d1225;
  --theme-panel-bg: #0f1629;
}
```

### 5.2 圆角

| 用途 | 值 |
|------|----|
| 小型（badge、开关） | `8px` |
| 中型（卡片、面板） | `12px` |
| 输入框 | `14px` |
| 胶囊（按钮、滑块头、模型按钮） | `9999px` |

### 5.3 阴影

| 名称 | 值 |
|------|----|
| sm | `0 1px 4px rgba(0,0,0,0.04)` |
| md | `0 2px 12px rgba(0,0,0,0.06)` |

### 5.4 字体

```css
font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif;
```

## 6. 布局骨架 — ExperimentCanvasLayout

```
┌──────────────────────────────────────────────────────────────┐
│ TopBar (48px)                                                │
├──────────────────────────────────────────────┬───────────────┤
│                                              │ 实验参数       │
│                                              │  (模型选择)    │
│ 主工作区 Canvas / Three.js / SVG             │  (参数滑块)    │
│ (flex:1, 至少占 60% 宽度)                     │  (重置按钮)    │
│                                              ├───────────────┤
│                                              │ 高级设置 ▶     │
│                                              ├───────────────┤
│                                              │ 实时读数       │
└──────────────────────────────────────────────┴───────────────┘
```

### 6.1 TopBar

- 高度：**48px**（范围 44-56px）
- 元素从左到右：标题 → tabs → spacer → 状态 badge → 播放/暂停 + 重置 → 速度选择器 → 主题切换 → 教学按钮
- tabs 选中态用 `--theme-primary`（蓝）+ 白字 + `shadow-sm`
- 播放按钮用 `--theme-primary`（蓝）
- 其他工具按钮用 `--theme-surface-hover` 底 + `--theme-text-secondary` 字

**TopBar 不应包含：** 用户头像、保存按钮、AI 助手按钮、大段说明文案、品牌 hero 标题

### 6.2 右栏

- 宽度：**320px**
- 分隔：`border-left: 1px solid var(--theme-border)`
- 底色：`var(--theme-panel-bg)`
- 整体可纵向滚动
- 分组用 `border-bottom + padding:16px` 分隔（不是卡片）

**分区标题 `<h3>`：**
```css
font-size: 12px;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.6px;
color: var(--theme-text-muted);
margin-bottom: 12px;
```

**分区顺序：**
1. 实验参数（模型按钮 + 参数行 + 重置按钮）
2. 高级设置（`<details>` 折叠）
3. 实时读数

### 6.3 控件精确规格

**滑块：**
- 轨道 `height: 8px`，`border-radius: 9999px`，底色 `var(--track-bg)`
- 已填充段：`var(--accent-green)`
- 滑块头 `20×20px`，白底 + `2px solid var(--accent-green)`，`border-radius: 9999px`
- `box-shadow: 0 1px 4px rgba(0,0,0,0.04)`，hover `scale(1.1)`

**数字输入框：**
- `height: 28px`，`padding: 0 8px`，`font-size: 12px`
- `border-radius: 14px`，`border: 1px solid var(--theme-border)`
- `background: var(--theme-surface-hover)`
- 聚焦：`border-color: var(--accent-green)`，`box-shadow: 0 0 0 3px var(--accent-green-focus-ring)`

**科学计数法输入：**
- 系数框 `width: 68px` + "×10^" 标签 + 指数框 `width: 52px; text-align: center`

**参数行布局（间距 12px）：**
- 上行：flex justify-between（标签 12px muted + 数值 11px muted）
- 中行：整宽滑块
- 下行：数字输入框

**重置按钮：**
- `border-radius: 9999px`，`background: var(--track-bg)`，`color: var(--theme-text)`
- `font-size: 13px`，`padding: 8px 14px`，`width: 100%`
- hover 底变 `#F0F0F0`

**读数行：**
- flex justify-between，`padding: 6px 0`
- 行间 `border-top`（首行无）
- 标签 `font-size: 14px`，`color: var(--theme-text-muted)`
- 数值 `font-size: 14px`，`font-weight: 600`，`font-variant-numeric: tabular-nums`，`color: var(--theme-text)`（中性色，不是绿色）
- 底部可接一句 `font-size: 12px` muted 说明

**模型/分段按钮：**
- 选中态：`border: 1px solid var(--accent-green)` + `background: var(--accent-green-light)` + `color: var(--accent-green)`

**开关：**
- `width: 36px`，`height: 20px`，`border-radius: 9999px`
- off 态：`background: var(--track-bg)`
- on 态：`background: var(--accent-green)`
- 滑块头 `16×16px`，白底，`box-shadow: 0 1px 3px rgba(0,0,0,0.1)`

### 6.4 教学浮窗

- 触发：TopBar 右侧 📖 按钮
- 遮罩：`rgba(0,0,0,0.4)` + `backdrop-filter: blur(4px)`
- 弹窗：`width: 600px`，`max-width: 90vw`，`max-height: 80vh`
- `border-radius: 12px`，`box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25)`
- 三个 Tab：公式与关系 / 教学要点 / 数据来源
- Tab 选中态：`color: var(--theme-primary)`，`border-bottom: 2px solid var(--theme-primary)`
- 关闭方式：× 按钮 / 点击遮罩 / Esc 键

## 7. 响应式规则

### 7.1 断点定义

| 断点 | 范围 | 布局变化 |
|------|------|----------|
| **桌面** | ≥ 1024px | 右栏常驻（width: 320px） |
| **平板/小屏桌面** | 768px - 1023px | 右栏隐藏 → 滑入抽屉 + FAB 唤出 |
| **手机横屏** | 600px - 767px | 同上 + badge 隐藏 |
| **手机竖屏** | < 600px | 同上 + TopBar 标题隐藏，tab 条紧凑，间距缩小 |

### 7.2 移动端抽屉

- `position: fixed`，覆盖式，**不挤压画布**
- `width: min(320px, 86vw)`
- `translateX` 动画（cubic-bezier(0.4, 0, 0.2, 1)）
- 遮罩 `rgba(0,0,0,0.42)`
- `box-shadow: -8px 0 28px rgba(0,0,0,0.12)`
- 右下角 **48px** 圆形 ⚙ 悬浮按钮（FAB）唤出
- 关闭方式：× 按钮 / 点击遮罩 / Esc 键

### 7.3 TopBar 响应式

- 标题：`min-width: 0` + `text-overflow: ellipsis`，永不撑破视口
- Tab 条：`flex: 1` + `overflow-x: auto`，可横向滚动
- < 600px：隐藏标题文字，只保留 tabs 和控件

### 7.4 不白屏铁律（最重要）

**Canvas 2D：**
- 必须用 `ResizeObserver` 监听容器
- 尺寸变化时重算 backing store：`canvas.width = containerWidth * devicePixelRatio`
- 不可使用固定宽高

**Three.js / WebGL：**
- 同样必须 `ResizeObserver` 监听容器
- 运行时更新：`renderer.setSize(w, h)` + `camera.aspect = w / h` + `camera.updateProjectionMatrix()`
- 窗口、方向变化都必须响应

**通用规则：**
- 抽屉用覆盖式 `fixed`，不挤压画布，避免开关抽屉触发画布重排
- 任何断点下画布都必须有内容渲染，不允许出现白屏
- 最低适配宽度 320px（iPhone SE），此宽度下仍可操作
- 主要目标尺寸：1440×900（桌面 iframe）
- 最低目标尺寸：1024×768

### 7.5 iframe 宿主兼容

模板运行在 iframe 内，需要注意：
- 用 `width: 100vw; height: 100vh` 或 `width: 100%; height: 100%` 填满 iframe
- `overflow: hidden` 防止出现双滚动条
- 不假设 iframe 有特定宽高

## 8. 主题系统

### 8.1 切换机制

- 通过 `<body data-theme="light|dark">` 属性切换
- CSS 变量在 `:root` / `[data-theme="light"]` 和 `[data-theme="dark"]` 中分别定义
- 用户偏好存入 `localStorage`
- 切换按钮在 TopBar 最右侧区域（🌙 / ☀️）

### 8.2 暗色模式注意

- `--accent-green` 浅暗一致 `#00C06B`
- 背景从白变为深蓝黑 `#0a0e1a`
- 边框变为半透明白 `rgba(255,255,255,0.08)`
- 阴影加深
- 重置按钮底色跟随 `--theme-surface-hover`

## 9. 不可修改区域

改造 UI 时以下内容不可修改：

- 物理引擎 / 核心算法
- snapshot payload 结构
- bridge 通信协议（templateBridge）
- 状态管理逻辑（simulationStore 等）
- 模型数据定义

## 10. V1 → V2 变更清单

| 项目 | V1 | V2 |
|------|----|----|
| 权威参考源 | P09 源码 | 原型 HTML |
| `--accent-green` | 不存在（只在 tokens.ts） | CSS 变量，原型中定义 |
| `--track-bg` | 不存在 | CSS 变量，原型中定义 |
| `shadow-sm` | 文档写 `0 1px 4px`，CSS 写 `0 1px 2px` | 统一为 `0 1px 4px rgba(0,0,0,0.04)` |
| 遮罩透明度 | 文档写 0.42，代码写 0.40 | 统一为 `0.42` |
| "primary" 含义 | tokens.ts 和 CSS 各一个 | 文档明确区分：`--theme-primary`（蓝）vs `--accent-green`（绿） |
| 响应式 | 简要描述 | 完整断点表 + 不白屏铁律 + ResizeObserver 强制 |
| Input 高度 | 由调用方 override | 原型明确 `28px` |

## 11. 实施流程

各模板改造时按以下顺序执行：

1. 在浏览器打开原型 HTML，对照实际效果
2. 确认模板属于 ExperimentCanvasLayout（物理模板均是）
3. 复制原型的 CSS 变量（`:root` 和 `[data-theme="dark"]` 完整块）
4. 按原型实现 TopBar 骨架
5. 按原型实现右栏骨架（分区、标题、间距）
6. 逐个实现控件（滑块、输入、按钮、开关、读数行）
7. 实现教学浮窗
8. 实现响应式（断点、抽屉、FAB）
9. 实现亮/暗主题切换
10. 验证 ResizeObserver 画布适配
11. 全尺寸测试（1440、1024、768、375 宽度）
12. 验证原有功能和 bridge/snapshot 未被破坏

## 12. 验收标准

- [ ] 布局与原型一致（TopBar + Canvas | RightPanel）
- [ ] 双强调色正确（蓝 tabs / 绿控件）
- [ ] 所有 token 值与原型 CSS 变量一致
- [ ] 亮/暗主题切换正常
- [ ] 教学浮窗三 Tab 可用
- [ ] 高级设置可折叠展开
- [ ] 响应式：1024px 断点右栏 → 抽屉
- [ ] 响应式：600px 断点标题隐藏
- [ ] 响应式：375px 宽度不白屏不溢出
- [ ] Canvas 使用 ResizeObserver 适配
- [ ] 原有功能正常
- [ ] bridge/snapshot 未被破坏
- [ ] build 成功无报错
