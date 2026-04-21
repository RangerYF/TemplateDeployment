# EduMind 设计系统移植指南

本指南说明如何在新项目中使用从 EduMind 移植过来的设计系统文件。

---

## 1. 文件清单与目录结构

```
your-project/
├── styles/                  # 设计 token（已拷贝）
│   ├── tokens.ts            # 核心 token：COLORS, RADIUS, SHADOWS
│   ├── colors.ts            # 色板 + 工具函数
│   ├── typography.ts        # 字体、排版、文本颜色
│   ├── spacing.ts           # 间距系统（8px 网格）
│   └── index.ts             # 统一导出入口
├── components/ui/           # UI 组件（需拷贝）
├── lib/utils/cn.ts          # 类名合并工具（需拷贝）
└── tailwind.config.ts       # Tailwind 配置（已拷贝）
```

---

## 2. 依赖安装

### 必装（所有组件依赖）

```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-progress framer-motion
```

### Tailwind 插件

```bash
pnpm add -D @tailwindcss/typography
```

### Markdown 渲染（仅 `markdown.tsx` 需要，不用可跳过）

```bash
pnpm add react-markdown remark-math remark-gfm rehype-katex rehype-highlight katex highlight.js
```

---

## 3. 两套色彩 Token 的区别

项目中存在两套颜色定义，用途不同：

| 文件 | 导出名 | 主色 | 使用场景 |
|------|--------|------|----------|
| `styles/tokens.ts` | `COLORS` (通过 `TOKENS.COLORS` 访问) | `#00C06B` | **UI 组件内部**（`components/ui/` 中用 inline style） |
| `styles/colors.ts` | `COLORS` (直接导入) | `#32D583` | **Tailwind 配置** + 业务组件 |

### 导入方式

```typescript
// 方式 1：从 tokens.ts 导入（组件内部 inline style 用）
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
// COLORS.primary → "#00C06B"

// 方式 2：从 colors.ts 导入（Tailwind 类名/业务代码用）
import { COLORS } from '@/styles/colors';
// COLORS.primary → "#32D583"

// 方式 3：从 index.ts 统一导入
import { COLORS, TOKENS } from '@/styles';
// COLORS → colors.ts 中的版本
// TOKENS.COLORS → tokens.ts 中的版本
```

> **注意**：`components/ui/` 中的组件 import 的是 `@/styles/tokens` 中的 `COLORS`，而 `tailwind.config.ts` 用的是 `@/styles/colors` 中的 `COLORS`。两套色值略有差异（主色 `#00C06B` vs `#32D583`），这是历史原因，实际使用中视觉差异不大。如果你想统一，可以将其中一个的值改为另一个。

---

## 4. 各模块使用方法

### 4.1 颜色（COLORS）

#### 在 Tailwind 类名中使用（来自 `colors.ts`，通过 `tailwind.config.ts` 注入）

```tsx
<button className="bg-eduMind-primary text-eduMind-white hover:bg-eduMind-primaryHover">
  确认
</button>
<span className="text-eduMind-error">出错了</span>
<div className="border border-eduMind-border bg-eduMind-light">...</div>
```

可用的 Tailwind 类名前缀：`eduMind-primary`, `eduMind-primaryHover`, `eduMind-dark`, `eduMind-neutral`, `eduMind-light`, `eduMind-border`, `eduMind-success`, `eduMind-warning`, `eduMind-error`, `eduMind-info` 等。

#### 在 inline style 中使用（来自 `tokens.ts`）

```tsx
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';

<div style={{
  backgroundColor: COLORS.primaryLight,
  borderRadius: RADIUS.card,
  boxShadow: SHADOWS.md,
  color: COLORS.text,
}}>
  ...
</div>
```

#### 在 Tailwind 任意值中使用（来自 `tokens.ts`）

```tsx
import { COLORS } from '@/styles/tokens';

<div className={`bg-[${COLORS.primary}] text-[${COLORS.white}]`}>...</div>
```

### 4.2 圆角（RADIUS）

来自 `tokens.ts`，用于 inline style：

```typescript
import { RADIUS } from '@/styles/tokens';

RADIUS.xs     // "4px"   — 小元素（标签、徽章）
RADIUS.sm     // "8px"   — 按钮、输入框
RADIUS.md     // "12px"  — 中等容器
RADIUS.input  // "14px"  — 输入框专用
RADIUS.lg     // "16px"  — 大容器
RADIUS.card   // "18px"  — 卡片
RADIUS.pill   // "26px"  — 药丸形按钮/标签
RADIUS.full   // "9999px" — 圆形
```

```tsx
<div style={{ borderRadius: RADIUS.card }}>卡片内容</div>
```

### 4.3 阴影（SHADOWS）

来自 `tokens.ts`，用于 inline style：

```typescript
import { SHADOWS } from '@/styles/tokens';

SHADOWS.sm    // "0 1px 4px rgba(0,0,0,0.04)"  — 微弱阴影
SHADOWS.md    // "0 2px 12px rgba(0,0,0,0.06)" — 卡片默认阴影
SHADOWS.lg    // "0 4px 20px rgba(0,0,0,0.1)"  — 弹窗/浮层
SHADOWS.toast // "0 4px 16px rgba(0,0,0,0.12)" — Toast 通知
```

### 4.4 排版（TYPOGRAPHY）

来自 `typography.ts`，直接作为 Tailwind 类名字符串使用：

```typescript
import { TYPOGRAPHY, TEXT_COLORS, FONT_FAMILY } from '@/styles/typography';

TYPOGRAPHY.h1        // "text-2xl font-bold text-[#1A1A2E]"
TYPOGRAPHY.h2        // "text-xl font-semibold text-[#1A1A2E]"
TYPOGRAPHY.h3        // "text-base font-medium text-[#1A1A2E]"
TYPOGRAPHY.body      // "text-sm text-[#595959]"
TYPOGRAPHY.bodyLarge // "text-base text-[#1A1A2E]"
TYPOGRAPHY.caption   // "text-xs text-[#6B7280]"
TYPOGRAPHY.label     // "text-sm font-medium text-[#1A1A2E]"
TYPOGRAPHY.link      // "text-sm text-[#00C06B] hover:text-[#00A85A] transition-colors"
```

```tsx
<h1 className={TYPOGRAPHY.h1}>页面标题</h1>
<p className={TYPOGRAPHY.body}>正文内容</p>
<span className={TYPOGRAPHY.caption}>辅助说明</span>
<a className={TYPOGRAPHY.link} href="/path">链接文字</a>
```

#### 组件级排版预设

```typescript
import { COMPONENT_TYPOGRAPHY } from '@/styles/typography';

// 卡片
<h2 className={COMPONENT_TYPOGRAPHY.card.title}>卡片标题</h2>
<p className={COMPONENT_TYPOGRAPHY.card.subtitle}>副标题</p>

// 表单
<label className={COMPONENT_TYPOGRAPHY.form.label}>字段名</label>
<span className={COMPONENT_TYPOGRAPHY.form.error}>必填项</span>
```

#### 排版工具函数

```typescript
import { typographyUtils } from '@/styles/typography';

// 组合字号 + 字重 + 颜色
const style = typographyUtils.combine('lg', 'bold', 'primary');
// → "text-lg font-bold text-[#1A1A2E]"

// 文本截断
const singleLine = typographyUtils.truncate(1);  // → "truncate"
const twoLines = typographyUtils.truncate(2);     // → "line-clamp-2"
```

### 4.5 间距（SPACING）

来自 `spacing.ts`，值为 Tailwind 类名字符串：

```typescript
import { SPACING, SPACING_UTILS, COMPONENT_SPACING } from '@/styles/spacing';

// Gap
SPACING["4"]  // "gap-4"  (16px)
SPACING.md    // "gap-4"  (16px)
SPACING.lg    // "gap-6"  (24px)

// Padding
SPACING_UTILS.padding.lg    // "p-6"  (24px)
SPACING_UTILS.paddingX.md   // "px-4" (16px)
SPACING_UTILS.paddingY["3"] // "py-3" (12px)

// Margin
SPACING_UTILS.margin.md     // "m-4"  (16px)
SPACING_UTILS.marginY.lg    // "my-6" (24px)

// 子元素间距
SPACING_UTILS.spaceY.md     // "space-y-4" (16px)
```

```tsx
<div className={`flex flex-col ${SPACING.md}`}>
  <div className={SPACING_UTILS.padding.lg}>卡片内容</div>
</div>
```

#### 组件级间距预设

```typescript
import { COMPONENT_SPACING } from '@/styles/spacing';

// 卡片
COMPONENT_SPACING.card.padding  // "p-6"   (24px)
COMPONENT_SPACING.card.gap      // "gap-4" (16px)

// 表单
COMPONENT_SPACING.form.fieldGap    // "gap-4" (16px) 字段之间
COMPONENT_SPACING.form.labelGap    // "gap-3" (12px) 标签与输入框之间
COMPONENT_SPACING.form.sectionGap  // "gap-6" (24px) 分组之间

// 按钮
COMPONENT_SPACING.button.paddingX  // "px-4"  (16px)
COMPONENT_SPACING.button.paddingY  // "py-2.5" (10px)
COMPONENT_SPACING.button.gap       // "gap-2" (8px) 图标与文字间距
```

---

## 5. cn() 工具函数

`lib/utils/cn.ts` 封装了 `clsx`，用于条件性合并类名：

```typescript
import { cn } from '@/lib/utils/cn';

// 基本合并
cn('text-sm', 'font-bold')
// → "text-sm font-bold"

// 条件类名
cn('base-class', isActive && 'bg-green-500', isDisabled && 'opacity-50')
// isActive=true, isDisabled=false → "base-class bg-green-500"

// 对象语法
cn('base', { 'text-red-500': hasError, 'text-green-500': isValid })
```

UI 组件中大量使用此函数，**必须拷贝 `lib/utils/cn.ts` 到新项目**。

---

## 6. Tailwind 配置说明

`tailwind.config.ts` 做了以下扩展：

1. **自定义颜色**：将 `styles/colors.ts` 中的色板注入 `eduMind` 命名空间
2. **扩展圆角**：`xl` (0.75rem), `2xl` (1rem), `3xl` (1.5rem)
3. **Typography 插件**：`@tailwindcss/typography`，用于 Markdown 渲染的 `prose` 类

### 适配新项目

如果新项目的 `tailwind.config.ts` 已有内容，将以下部分合并进去：

```typescript
import { COLORS } from "./styles/colors";

// 在 theme.extend 中加入：
colors: {
  eduMind: {
    primary: COLORS.primary,
    primaryHover: COLORS.primaryHover,
    primaryLight: COLORS.primaryLight,
    dark: COLORS.dark,
    neutral: COLORS.neutral,
    light: COLORS.light,
    lightAlt: COLORS.lightAlt,
    border: COLORS.border,
    white: COLORS.white,
    placeholder: COLORS.placeholder,
    success: COLORS.success,
    successAlt: COLORS.successAlt,
    warning: COLORS.warning,
    error: COLORS.error,
    danger: COLORS.dangerAlt,
    info: COLORS.info,
  },
},
```

### content 路径

确保 `content` 数组包含你项目中使用 Tailwind 类名的所有目录：

```typescript
content: [
  "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  "./components/**/*.{js,ts,jsx,tsx,mdx}",
  "./app/**/*.{js,ts,jsx,tsx,mdx}",
  // 如果有其他目录也加上
],
```

---

## 7. components/ui/ 组件列表

| 组件文件 | 导出 | 用途 |
|----------|------|------|
| `button.tsx` | `Button` | 按钮（多变体：default/outline/ghost/link） |
| `input.tsx` | `Input` | 文本输入框 |
| `textarea.tsx` | `Textarea` | 多行文本输入 |
| `select.tsx` | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | 下拉选择 |
| `checkbox.tsx` | `Checkbox` | 复选框 |
| `switch.tsx` | `Switch` | 开关 |
| `label.tsx` | `Label` | 表单标签 |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `DifficultyBadge` | 卡片容器 |
| `dialog.tsx` | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` | 弹窗 |
| `tabs.tsx` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | 标签页 |
| `popover.tsx` | `Popover`, `PopoverTrigger`, `PopoverContent` | 气泡弹出层 |
| `table.tsx` | `DataTable`, `TableToolbar` | 数据表格 |
| `badge.tsx` | `Badge` | 徽章/标签 |
| `pagination.tsx` | `Pagination` | 分页 |
| `alert.tsx` | `Alert`, `AlertTitle`, `AlertDescription` | 提示信息 |
| `toast.tsx` | `ToastProvider`, `useToast` | Toast 通知 |
| `progress.tsx` | `Progress` | 进度条 |
| `progress-bar.tsx` | `ProgressBar`, `usePdfDownload` | PDF 下载进度 |
| `slider.tsx` | `Slider` | 滑块 |
| `Skeleton.tsx` | `Skeleton`, `SkeletonCard`, `SkeletonText` | 骨架屏加载 |
| `markdown.tsx` | `MarkdownRenderer` | Markdown + KaTeX 数学公式渲染 |
| `ExampleCard.tsx` | `ProblemCardSimple`, `KnowledgeCard` | 示例卡片（可能不需要拷贝） |

### 组件内部依赖关系

- 几乎所有组件都依赖 `@/lib/utils/cn` 和 `@/styles/tokens`
- `table.tsx` 内部引用了 `button.tsx` 和 `pagination.tsx`
- `ExampleCard.tsx` 引用了 `card.tsx`

---

## 8. 实际开发示例

### 卡片布局

```tsx
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { TYPOGRAPHY } from '@/styles/typography';
import { COMPONENT_SPACING } from '@/styles/spacing';

export function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div
      className={COMPONENT_SPACING.card.padding}
      style={{
        backgroundColor: COLORS.bg,
        borderRadius: RADIUS.card,
        boxShadow: SHADOWS.md,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <h3 className={TYPOGRAPHY.h3}>{title}</h3>
      <p className={TYPOGRAPHY.body}>{desc}</p>
    </div>
  );
}
```

### 表单

```tsx
import { TYPOGRAPHY, COMPONENT_TYPOGRAPHY } from '@/styles/typography';
import { COMPONENT_SPACING } from '@/styles/spacing';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  return (
    <form className={`flex flex-col ${COMPONENT_SPACING.form.sectionGap}`}>
      <div className={`flex flex-col ${COMPONENT_SPACING.form.labelGap}`}>
        <Label className={COMPONENT_TYPOGRAPHY.form.label}>用户名</Label>
        <Input placeholder="请输入用户名" />
      </div>
      <div className={`flex flex-col ${COMPONENT_SPACING.form.labelGap}`}>
        <Label className={COMPONENT_TYPOGRAPHY.form.label}>密码</Label>
        <Input type="password" placeholder="请输入密码" />
      </div>
      <Button>登录</Button>
    </form>
  );
}
```

### 状态提示

```tsx
import { COLORS } from '@/styles/tokens';
import { TEXT_COLORS } from '@/styles/typography';

<span className={TEXT_COLORS.success}>操作成功</span>
<span className={TEXT_COLORS.error}>操作失败</span>
<span className={TEXT_COLORS.muted}>暂无数据</span>
```

---

## 9. 设计要点速查

| 属性 | 值 |
|------|-----|
| 主色调 | 绿色 `#00C06B` / `#32D583` |
| 主文本色 | `#1A1A2E` |
| 次文本色 | `#595959` |
| 弱文本色 | `#6B7280` |
| 边框色 | `#E5E7EB` / `#E5E5E5` |
| 页面背景 | `#FFFFFF` / `#F7F8FA` |
| 字体 | Inter + PingFang SC + 系统回退 |
| 间距网格 | 8px |
| 卡片圆角 | 18px |
| 输入框圆角 | 14px |
| 卡片阴影 | `0 2px 12px rgba(0,0,0,0.06)` |
