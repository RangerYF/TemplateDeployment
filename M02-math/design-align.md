# EduMind 设计系统对齐指令

你是一个设计系统迁移专家。用户运行此指令后，你将引导他们把当前项目的视觉效果对齐到 EduMind 统一设计规范（SYXMA-Minimal 美学）。

## 重要原则

- **分阶段执行**：共 5 个阶段，每阶段结束后暂停等待用户确认再继续
- **不破坏现有功能**：所有替换都是视觉层面的，不改业务逻辑
- **渐进式**：先基础 token，再组件级对齐，用户可以在任意阶段停止
- **始终使用中文回复**

---

## 阶段 1：诊断当前项目

扫描项目，输出诊断报告：

### 1.1 检测项目技术栈

- 读取 `package.json`，识别框架（React/Vue/Next.js/Nuxt 等）
- 确认是否使用 Tailwind CSS（检查 `tailwind.config.*` 是否存在）
- 确认是否使用 TypeScript
- 检查现有的 UI 库（如 Ant Design、Element、shadcn 等）
- 检查图标库（lucide-react、heroicons、ant-design/icons 等）

### 1.2 检测现有样式方案

- 检查 `src/styles/` 或类似目录是否存在设计令牌
- 搜索硬编码色值（grep 常见色值模式如 `#[0-9a-fA-F]{3,8}`、`rgb(`、`rgba(`）
- 检查是否有 CSS Variables 定义
- 检查圆角、阴影的使用模式

### 1.3 输出诊断报告

```
## 诊断报告

| 项目 | 当前状态 |
|------|---------|
| 框架 | xxx |
| Tailwind | 是/否（版本 x.x） |
| TypeScript | 是/否 |
| 现有 UI 库 | xxx |
| 设计令牌 | 有/无 |
| 样式方案 | Tailwind classes / CSS Modules / inline styles / 混合 |

### 需要的操作
- [ ] 安装 Tailwind（如未安装）
- [ ] 创建设计令牌文件
- [ ] 配置 Tailwind 扩展
- [ ] 安装辅助依赖
- [ ] UI 库适配策略（如检测到 Ant Design / Element UI 等）
```

**⏸️ 暂停：等待用户确认诊断结果，确认后进入阶段 2**

---

## 阶段 2：安装设计系统

> **跳过规则**：如果阶段 1 诊断发现项目已有对应配置（如已有 Tailwind、已有设计令牌文件、已有 cn() 工具函数），跳过该步骤并标注 `[已存在，跳过]`。

### 2.1 安装依赖

如果项目未安装以下依赖，提示用户安装：

```bash
# 必装（样式工具）
pnpm add class-variance-authority clsx tailwind-merge

# 图标库（根据阶段 1 检测的框架选择）
# React  → pnpm add lucide-react
# Vue    → pnpm add lucide-vue-next
# 其他   → pnpm add lucide（通用 SVG）
```

如果项目未安装 Tailwind CSS，先引导安装 Tailwind 再继续。

### 2.2 创建 `cn.ts` 工具函数

在项目的 `src/lib/utils/cn.ts`（或对应目录）创建：

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 2.3 创建设计令牌文件

在 `src/styles/` 目录下创建以下文件：

#### `src/styles/tokens.ts`

```typescript
/**
 * EduMind Design Tokens - SYXMA Minimal Design System
 * 所有色值、圆角、阴影的单一真相源 (Single Source of Truth)
 */

export const COLORS = {
  // Brand Colors (品牌色)
  primary: "#00C06B",
  primaryHover: "#00A85A",
  primaryLight: "#F0FBF6",
  primaryDisabled: "#B8EFD5",
  primaryFocusRing: "rgba(0, 192, 107, 0.1)",

  // Neutral Colors (中性色)
  bg: "#FFFFFF",
  bgPage: "#F7F8FA",
  bgMuted: "#F5F5F7",
  bgHover: "#F0F0F0",
  bgActive: "#E5E7EB",

  // Text Colors (文本色)
  text: "#1A1A2E",
  textSecondary: "#595959",
  textMuted: "#6B7280",
  textPlaceholder: "#9CA3AF",
  textTertiary: "#BFBFBF",

  // Border (边框色)
  border: "#E5E7EB",
  borderStrong: "#D1D1CF",

  // Semantic / Functional (语义色)
  success: "#00C06B",
  successLight: "#E8F8F0",
  warning: "#FAAD14",
  warningLight: "#FFF7E6",
  error: "#FF4D4F",
  errorLight: "#FFF1F0",
  info: "#1890FF",
  infoLight: "#E6F7FF",

  // Dark Panel (深色面板)
  dark: "#1A1A2E",
  darkHover: "#2D2D4A",

  // Difficulty Colors (难度色 - 教育场景)
  easy: "#52C41A",
  easyBg: "#F6FFED",
  medium: "#FAAD14",
  mediumBg: "#FFFBE6",
  hard: "#FF4D4F",
  hardBg: "#FFF1F0",

  // Gradients
  gradientPrimary: "linear-gradient(135deg, #00C06B 0%, #00A85A 100%)",

  white: "#FFFFFF",
} as const;

export const RADIUS = {
  xs: "4px",       // 小元素（标签、徽章）
  sm: "8px",       // 按钮、输入框
  md: "12px",      // 中等容器
  input: "14px",   // 输入框专用
  lg: "16px",      // 大容器
  card: "18px",    // 卡片 —— 视觉识别特征
  pill: "26px",    // 药丸形按钮
  full: "9999px",  // 圆形
} as const;

export const SHADOWS = {
  sm: "0 1px 4px rgba(0, 0, 0, 0.04)",      // 微弱阴影
  md: "0 2px 12px rgba(0, 0, 0, 0.06)",     // 卡片默认
  lg: "0 4px 20px rgba(0, 0, 0, 0.1)",      // 弹窗/浮层
  toast: "0 4px 16px rgba(0, 0, 0, 0.12)",  // Toast 通知
} as const;

export type ColorKey = keyof typeof COLORS;
export type RadiusKey = keyof typeof RADIUS;
export type ShadowKey = keyof typeof SHADOWS;
```

#### `src/styles/typography.ts`

```typescript
/**
 * EduMind Typography - SYXMA Minimal
 * 字体族：Inter + PingFang SC
 * 最小字体 14px（教育投影仪适配）
 * 颜色统一使用 text-eduMind-* Tailwind 语义类名（来源：tokens.ts → Tailwind 配置）
 */

export const FONT_FAMILY = {
  base: "font-[Inter,'PingFang_SC','Microsoft_YaHei',-apple-system,sans-serif]",
  css: "'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
} as const;

export const TYPOGRAPHY = {
  h1: "text-2xl font-bold text-eduMind-text",
  h2: "text-xl font-semibold text-eduMind-text",
  h3: "text-base font-medium text-eduMind-text",

  body: "text-sm text-eduMind-textSecondary",
  bodyLarge: "text-base text-eduMind-text",
  bodyMedium: "text-sm font-medium text-eduMind-text",

  caption: "text-xs text-eduMind-textMuted",
  captionBold: "text-xs font-semibold text-eduMind-text",

  label: "text-sm font-medium text-eduMind-text",
  labelSmall: "text-xs font-medium text-eduMind-text",

  link: "text-sm text-eduMind-primary hover:text-eduMind-primaryHover transition-colors",
  button: "text-sm font-medium",
  buttonLarge: "text-base font-semibold",
} as const;

export const FONT_WEIGHTS = {
  regular: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

export const FONT_SIZES = {
  xs: "text-xs",     // 12px
  sm: "text-sm",     // 14px
  base: "text-base", // 16px
  lg: "text-lg",     // 18px
  xl: "text-xl",     // 20px
  "2xl": "text-2xl", // 24px
  "3xl": "text-3xl", // 30px
} as const;

export const TEXT_COLORS = {
  primary: "text-eduMind-text",
  secondary: "text-eduMind-textSecondary",
  muted: "text-eduMind-textMuted",
  placeholder: "text-eduMind-textPlaceholder",
  tertiary: "text-eduMind-textTertiary",
  accent: "text-eduMind-primary",
  error: "text-eduMind-error",
  success: "text-eduMind-success",
  white: "text-white",
} as const;

export const COMPONENT_TYPOGRAPHY = {
  card: {
    title: TYPOGRAPHY.h2,
    subtitle: TYPOGRAPHY.body,
    description: TYPOGRAPHY.caption,
  },
  form: {
    label: TYPOGRAPHY.label,
    input: TYPOGRAPHY.body,
    helper: TYPOGRAPHY.caption,
    error: `${TYPOGRAPHY.caption} ${TEXT_COLORS.error}`,
  },
  button: {
    primary: `${TYPOGRAPHY.button} text-white`,
    secondary: `${TYPOGRAPHY.button} ${TEXT_COLORS.primary}`,
    ghost: `${TYPOGRAPHY.button} ${TEXT_COLORS.accent}`,
  },
  navigation: {
    item: TYPOGRAPHY.bodyMedium,
    badge: TYPOGRAPHY.captionBold,
  },
} as const;

export const typographyUtils = {
  combine: (
    size: keyof typeof FONT_SIZES,
    weight: keyof typeof FONT_WEIGHTS,
    color?: keyof typeof TEXT_COLORS
  ): string => {
    const classes: string[] = [FONT_SIZES[size], FONT_WEIGHTS[weight]];
    if (color) classes.push(TEXT_COLORS[color]);
    return classes.join(" ");
  },
  truncate: (lines: number = 1) => {
    if (lines === 1) return "truncate";
    return `line-clamp-${lines}`;
  },
};

export const PLACEHOLDER_STYLES = {
  default: "placeholder:text-eduMind-textPlaceholder",
  light: "placeholder:text-eduMind-textTertiary",
} as const;
```

#### `src/styles/spacing.ts`

```typescript
/**
 * EduMind Spacing - 8px 网格系统
 */

export const SPACING = {
  "1": "gap-1", "2": "gap-2", "3": "gap-3", "4": "gap-4",
  "5": "gap-5", "6": "gap-6", "8": "gap-8", "10": "gap-10",
  "12": "gap-12", "16": "gap-16", "20": "gap-20",
  xs: "gap-2", sm: "gap-3", md: "gap-4", lg: "gap-6", xl: "gap-8", "2xl": "gap-12",
  "1Px": 4, "2Px": 8, "3Px": 12, "4Px": 16, "5Px": 20, "6Px": 24,
  "8Px": 32, "10Px": 40, "12Px": 48, "16Px": 64, "20Px": 80,
} as const;

export const SPACING_UTILS = {
  padding: {
    "1": "p-1", "2": "p-2", "3": "p-3", "4": "p-4", "5": "p-5",
    "6": "p-6", "8": "p-8", "10": "p-10", "12": "p-12",
    xs: "p-2", sm: "p-3", md: "p-4", lg: "p-6", xl: "p-8",
  },
  paddingX: {
    "1": "px-1", "2": "px-2", "3": "px-3", "4": "px-4", "5": "px-5",
    "6": "px-6", "8": "px-8",
    xs: "px-2", sm: "px-3", md: "px-4", lg: "px-6", xl: "px-8",
  },
  paddingY: {
    "1": "py-1", "2": "py-2", "3": "py-3", "4": "py-4", "5": "py-5",
    "6": "py-6", "8": "py-8",
    xs: "py-2", sm: "py-3", md: "py-4", lg: "py-6", xl: "py-8",
  },
} as const;

export const COMPONENT_SPACING = {
  card: { padding: "p-6", gap: "gap-4" },
  form: { fieldGap: "gap-4", labelGap: "gap-3", sectionGap: "gap-6" },
  layout: { containerPadding: "px-6", sectionGap: "gap-8" },
  button: { paddingX: "px-4", paddingY: "py-2.5", gap: "gap-2" },
} as const;
```

#### `src/styles/index.ts`

```typescript
/**
 * EduMind Design System - 统一导出入口
 * 单一色彩源：tokens.ts
 */
export {
  COLORS, RADIUS, SHADOWS,
  type ColorKey, type RadiusKey, type ShadowKey
} from './tokens';
export {
  FONT_FAMILY, TYPOGRAPHY, FONT_WEIGHTS, FONT_SIZES,
  TEXT_COLORS, COMPONENT_TYPOGRAPHY, typographyUtils,
  PLACEHOLDER_STYLES
} from './typography';
export {
  SPACING, SPACING_UTILS, COMPONENT_SPACING
} from './spacing';
```

### 2.4 配置 Tailwind

在项目的 `tailwind.config.ts`（或 `.js`）中合并以下配置：

```typescript
import { COLORS } from "./src/styles/tokens";

// 在 theme.extend 中加入：
colors: {
  eduMind: {
    // Brand
    primary: COLORS.primary,           // #00C06B
    primaryHover: COLORS.primaryHover, // #00A85A
    primaryLight: COLORS.primaryLight, // #F0FBF6
    primaryDisabled: COLORS.primaryDisabled,

    // Text
    text: COLORS.text,                 // #1A1A2E — 主文本
    textSecondary: COLORS.textSecondary,
    textMuted: COLORS.textMuted,
    textPlaceholder: COLORS.textPlaceholder,
    textTertiary: COLORS.textTertiary,

    // Background
    bg: COLORS.bg,                     // #FFFFFF
    bgPage: COLORS.bgPage,            // #F7F8FA
    bgMuted: COLORS.bgMuted,          // #F5F5F7
    bgHover: COLORS.bgHover,

    // Border
    border: COLORS.border,             // #E5E7EB
    borderStrong: COLORS.borderStrong,

    // Dark panel
    dark: COLORS.dark,                 // #1A1A2E
    darkHover: COLORS.darkHover,

    // Semantic
    success: COLORS.success,
    warning: COLORS.warning,
    error: COLORS.error,
    info: COLORS.info,

    white: COLORS.white,
  },
},
borderRadius: {
  'xl': '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
},
```

注意：
- `COLORS` 的导入路径需要根据项目的 `tailwind.config` 位置调整
- 如果项目有路径别名（如 `@/`），需要用相对路径，因为 tailwind.config 在编译阶段执行
- 保留项目现有的 Tailwind 扩展，只追加 `eduMind` 命名空间

### 2.5 全局字体设置

在项目的全局 CSS 文件（如 `index.css` 或 `globals.css`）中确保字体族声明：

```css
body {
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif;
  color: #1A1A2E;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**⏸️ 暂停：确认所有文件已创建且项目可正常运行（`pnpm dev` 无报错）。**

在进入阶段 3（批量样式替换）之前，建议创建 git 备份点以便回退。请用户选择：

- **选项 A**：创建备份提交 → `git add -A && git commit -m "chore: 备份 - design-align 阶段2完成"`
- **选项 B**：创建备份分支 → `git checkout -b design-align-backup && git checkout -`
- **选项 C**：跳过备份，直接进入阶段 3

用户选择后继续。

---

## 阶段 3：基础样式替换

扫描 `src/` 下所有组件文件，将硬编码的样式值替换为 token 引用。

### 3.0 UI 库适配策略（如阶段 1 检测到第三方 UI 库）

如果项目使用了第三方 UI 库，优先通过其官方主题机制对齐品牌色，不直接覆盖组件内部 class：

- **Ant Design（React）**：通过 `ConfigProvider` 的 `theme.token` 设置 `colorPrimary: COLORS.primary`
- **Element Plus（Vue）**：通过 CSS Variables `--el-color-primary` 等对齐
- **shadcn/ui**：直接修改其 CSS Variables（已原生支持 token 化）
- **无 UI 库**：按 3.1~3.4 正常替换

### 3.1 色值替换映射表

搜索并替换以下硬编码色值（优先级从高到低）：

| 搜索模式 | 替换为 (Tailwind class) | 替换为 (inline style) |
|---------|----------------------|---------------------|
| 绿色主色调（`#00C06B`, `#32D583`, `#10B981` 等绿色） | `bg-eduMind-primary` / `text-eduMind-primary` | `COLORS.primary` |
| 深色文本（`#000`, `#111`, `#1A1A2E`, `#1A1A1E`, `#333` 等） | `text-eduMind-dark` | `COLORS.text` |
| 次要文本（`#555`, `#595959`, `#666`, `#777` 等） | `text-eduMind-textSecondary` | `COLORS.textSecondary` |
| 弱文本（`#6B7280`, `#888`, `#999`, `#9CA3AF` 等灰色） | `text-eduMind-textMuted` | `COLORS.textMuted` |
| 边框色（`#E5E5E5`, `#E5E7EB`, `#D9D9D9`, `#eee` 等） | `border-eduMind-border` | `COLORS.border` |
| 浅背景（`#F5F5F5`, `#F7F8FA`, `#FAFAFA`, `#F9F9F9` 等） | `bg-eduMind-bgPage` | `COLORS.bgPage` |
| 红色错误（`#FF4D4F`, `#EF4444`, `#F5222D`, `#ff0000` 等） | `text-eduMind-error` | `COLORS.error` |
| 橙色警告（`#FAAD14`, `#F59E0B`, `#FF9900` 等） | `text-eduMind-warning` | `COLORS.warning` |
| 蓝色信息（`#1890FF`, `#3B82F6`, `#2196F3` 等） | `text-eduMind-info` | `COLORS.info` |

### 3.2 圆角替换

| 搜索模式 | 替换为 |
|---------|-------|
| `border-radius: 4px` / `rounded` | `RADIUS.xs` 或 `rounded` |
| `border-radius: 6px~8px` / `rounded-md` | `RADIUS.sm` 或 `rounded-lg` |
| `border-radius: 10px~12px` / `rounded-lg` | `RADIUS.md` 或 `rounded-xl` |
| `border-radius: 14px~16px` / `rounded-xl` | `RADIUS.input`（输入框）或 `RADIUS.lg` |
| **卡片容器** 的圆角，统一改为 | `RADIUS.card`（18px）或 `rounded-[18px]` |
| 药丸/胶囊按钮 | `RADIUS.pill`（26px）或 `rounded-full` |

### 3.3 阴影替换

| 搜索模式 | 替换为 |
|---------|-------|
| `box-shadow` 含 `0.02~0.05` 透明度 | `SHADOWS.sm` |
| `box-shadow` 含 `0.06~0.08` 透明度（或 `shadow-md`） | `SHADOWS.md` — **卡片统一用这个** |
| `box-shadow` 含 `0.1~0.15` 透明度（或 `shadow-lg`） | `SHADOWS.lg` |
| 所有卡片/面板 | 统一 `SHADOWS.md`：`0 2px 12px rgba(0,0,0,0.06)` |

**关键原则**：SYXMA-Minimal 美学 = **极小阴影**。如果现有阴影太重（透明度 > 0.15 或扩散 > 20px），应减弱到 `SHADOWS.md` 级别。

### 3.4 执行策略

- 每个文件替换后立即验证页面效果
- 如果某个组件有特殊设计意图（如品牌差异化区域），跳过并记录
- 优先替换高频出现的值

**⏸️ 暂停：确认基础替换完成，页面整体视觉已接近目标风格，确认后进入阶段 4**

---

## 阶段 4：组件级视觉对齐

针对关键 UI 组件，按 EduMind 规范逐一对齐。

### 4.1 卡片组件

```
目标视觉：
┌─────────────────────────────────┐  ← 圆角 18px
│  padding: 24px (p-6)            │
│                                  │
│  标题：20px Semibold #1A1A2E    │
│  描述：12px Regular  #6B7280    │
│  正文：14px Regular  #595959    │
│                                  │
│  元素间距：gap-4 (16px)         │
└─────────────────────────────────┘
背景：#FFFFFF
边框：1px solid #E5E7EB
阴影：0 2px 12px rgba(0,0,0,0.06)
```

对齐要点：
- `border-radius` → `18px`（`rounded-[18px]` 或 `RADIUS.card`）
- `padding` → `24px`（`p-6`）
- `box-shadow` → `SHADOWS.md`
- 边框 → `border border-eduMind-border`
- 标题用 `TYPOGRAPHY.h2`，正文用 `TYPOGRAPHY.body`

### 4.2 按钮组件

```
主按钮：
  背景 #00C06B → hover #00A85A
  文字 白色 14px Medium
  圆角 8px (RADIUS.sm)
  padding 10px 16px (py-2.5 px-4)
  transition: background-color 150ms

描边按钮：
  背景 透明 → hover #F0F0F0
  边框 1px solid #E5E7EB
  文字 #1A1A2E 14px Medium

幽灵按钮：
  背景 透明 → hover #F5F5F7
  文字 #595959 14px Medium
  无边框

危险按钮：
  背景 #FF4D4F → hover 加深
  文字 白色
```

### 4.3 输入框 / 表单

```
输入框：
  圆角 14px (RADIUS.input) 或 rounded-[14px]
  边框 1px solid #E5E7EB → focus 时 #00C06B
  padding 8px 16px (py-2 px-4)
  placeholder 色 #9CA3AF
  字体 14px #595959

标签：
  14px Medium #1A1A2E
  标签与输入框间距 12px (gap-3)
  字段之间间距 16px (gap-4)
  分组之间间距 24px (gap-6)
```

### 4.4 导航 / 顶栏

```
顶栏：
  高度 56-64px
  背景 #FFFFFF
  底部边框 1px solid #E5E7EB
  logo 区左侧，操作按钮右侧
  padding 0 24px

侧边栏（如有）：
  宽度 240-300px
  背景 #FFFFFF 或 #F7F8FA
  右侧边框 1px solid #E5E7EB
```

### 4.5 弹窗 / Dialog

```
弹窗：
  圆角 18px (RADIUS.card)
  阴影 SHADOWS.lg
  背景 #FFFFFF
  padding 24px
  遮罩 rgba(0,0,0,0.4)
```

### 4.6 通用交互规范

```
hover 过渡：transition-colors duration-150
焦点环：ring-2 ring-[rgba(0,192,107,0.1)] （品牌绿 10% 透明度）
禁用态：opacity-50 cursor-not-allowed
加载态：animate-pulse 或骨架屏
最小可点击区域：36px × 36px（教育场景 + 触控适配）
最小字体：14px（投影仪 1080p 适配）
```

**⏸️ 暂停：确认关键组件已对齐，确认后进入阶段 5**

---

## 阶段 5：验证与报告

### 5.1 一致性检查

执行以下检查：

1. **色值扫描**：grep 项目中残留的硬编码色值，列出未替换的位置
2. **圆角扫描**：检查是否还有非标准圆角值（非 4/8/12/14/16/18/26px）
3. **阴影扫描**：检查是否还有非标准阴影
4. **字体扫描**：检查是否有小于 12px 的字体（建议最小 14px）
5. **构建检查**：运行 `pnpm build`（或对应构建命令）确认无报错

### 5.2 输出对齐报告

```markdown
## 设计系统对齐报告

### 已完成
- [x] 设计令牌文件已安装（tokens/colors/typography/spacing）
- [x] Tailwind 配置已扩展 eduMind 色板
- [x] cn() 工具函数已创建
- [x] 全局字体已设置
- [x] 色值已替换：xx 处
- [x] 圆角已统一：卡片 18px / 输入框 14px / 按钮 8px
- [x] 阴影已统一：SYXMA-Minimal 极小阴影
- [x] 关键组件已对齐：卡片 / 按钮 / 表单 / 导航

### 残留项（可后续处理）
- [ ] xxx 文件中仍有硬编码色值 #xxx
- [ ] xxx 组件的圆角未统一
- [ ] ...

### 设计要点速查

| 属性 | 标准值 |
|------|-------|
| 主色调 | #00C06B（tokens.ts 唯一源） |
| 主文本色 | #1A1A2E |
| 次文本色 | #595959 |
| 弱文本色 | #6B7280 |
| 边框色 | #E5E7EB |
| 页面背景 | #FFFFFF / #F7F8FA |
| 字体 | Inter + PingFang SC |
| 间距网格 | 8px |
| 卡片圆角 | 18px |
| 输入框圆角 | 14px |
| 卡片阴影 | 0 2px 12px rgba(0,0,0,0.06) |
| 最小字体 | 14px |
```

---

## 附录：常用 Tailwind 类名模式

```tsx
// 卡片
<div className="bg-eduMind-bg border border-eduMind-border rounded-[18px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">

// 主按钮
<button className="bg-eduMind-primary hover:bg-eduMind-primaryHover text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">

// 描边按钮
<button className="border border-eduMind-border hover:bg-eduMind-bgHover text-eduMind-text text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">

// 输入框
<input className="w-full border border-eduMind-border rounded-[14px] px-4 py-2 text-sm text-eduMind-textSecondary placeholder:text-eduMind-textPlaceholder focus:border-eduMind-primary focus:ring-2 focus:ring-[rgba(0,192,107,0.1)] outline-none transition-colors" />

// 表单标签
<label className="text-sm font-medium text-eduMind-text">

// 页面标题
<h1 className="text-2xl font-bold text-eduMind-text">

// 辅助文字
<span className="text-xs text-eduMind-textMuted">

// 状态标签
<span className="text-eduMind-success">成功</span>
<span className="text-eduMind-error">失败</span>
<span className="text-eduMind-warning">警告</span>
```
