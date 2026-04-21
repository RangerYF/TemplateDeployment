# 第0阶段：项目脚手架与设计系统集成

- **所属计划**：PROGRESSIVE-PLAN.md
- **预计耗时**：1天
- **风险等级**：L1（多文件改动，常规配置）
- **状态**：已完成

---

## 目标
搭建可运行的空项目，集成 EduMind 设计系统，确保全部依赖就绪、开发环境可用。

---

## 子任务链路（串行）

```
T0.1 Vite 项目初始化
→ T0.2 代码质量工具配置
→ T0.3 Tailwind CSS 集成
→ T0.4 设计系统文件搬移
→ T0.5 核心依赖安装
→ T0.6 验证与首次提交
```

---

## T0.1 Vite 项目初始化

**目标**：生成 React 18 + TypeScript 的 Vite 项目骨架

**任务**：
1. 在项目根目录执行 `pnpm create vite . --template react-ts`（注意：在已有目录初始化，保留现有文件）
2. 确认 `tsconfig.json` 中配置路径别名 `@/` → `src/`
3. 确认 `vite.config.ts` 中配置对应 resolve alias
4. 创建基础目录结构：
   ```
   src/
   ├── components/
   │   └── ui/          # 设计系统 UI 组件（T0.4 搬入）
   ├── styles/          # 设计 token（T0.4 搬入）
   ├── lib/
   │   └── utils/       # 工具函数（T0.4 搬入）
   ├── engine/          # 物理引擎桥接层（第1阶段使用）
   ├── renderer/        # Canvas 渲染层（第1阶段使用）
   ├── core/            # 编辑器核心（第2阶段使用）
   ├── models/          # Scene Model（第2阶段使用）
   ├── store/           # Zustand 状态管理（第1阶段使用）
   ├── App.tsx
   └── main.tsx
   ```

**验收**：`pnpm dev` 可启动，浏览器看到 Vite 默认页面

---

## T0.2 代码质量工具配置

**目标**：配置 ESLint + Prettier + Husky pre-commit hook

**任务**：
1. ESLint 配置（Vite 模板自带基础配置，按需调整）：
   - 启用 TypeScript + React 规则
   - 配置 `@` 路径别名解析
2. Prettier 配置：
   - 创建 `.prettierrc`：单引号、无分号、尾逗号、2空格缩进
3. Husky pre-commit hook：
   - 项目已有 `.husky/pre-commit`（内容：`pnpm lint && pnpm tsc --noEmit`）
   - 确保 `package.json` 中有 `lint` 脚本
   - 安装 husky：`pnpm add -D husky && pnpm exec husky init`（已有 `.husky/` 目录则跳过 init，仅安装依赖）
4. 在 `package.json` 中添加脚本：
   - `"lint": "eslint src/ --ext .ts,.tsx"`
   - `"format": "prettier --write src/"`

**验收**：`pnpm lint` 和 `pnpm tsc --noEmit` 通过

---

## T0.3 Tailwind CSS 集成

**目标**：Tailwind CSS 正常工作，EduMind 色彩 token 可用

**任务**：
1. 安装 Tailwind CSS + 依赖：
   - `pnpm add -D tailwindcss @tailwindcss/typography postcss autoprefixer`
   - `npx tailwindcss init -p`
2. 配置 `tailwind.config.ts`：
   - 基于 `design_guid/tailwind.config.ts` 适配
   - `content` 路径改为 `["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]`
   - 导入路径从 `./styles/colors` 改为 `./src/styles/colors`
   - 保留 `eduMind` 色彩命名空间和圆角扩展
   - 保留 `@tailwindcss/typography` 插件
3. 在 `src/index.css` 中添加 Tailwind 指令：
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

**验收**：`className="bg-eduMind-primary text-white"` 渲染绿色背景白字

**注意**：Tailwind 配置依赖 T0.4 搬移的 `src/styles/colors.ts`，两个子任务需协调顺序（先搬文件再配置 Tailwind，或先创建空文件占位）

---

## T0.4 设计系统文件搬移

**目标**：将 `design_guid/` 中的设计系统文件搬移到 `src/` 正式目录

**任务**：
1. 搬移样式 token（`design_guid/styles/` → `src/styles/`）：
   - `tokens.ts` — 核心 token（COLORS/RADIUS/SHADOWS，UI 组件 inline style 用）
   - `colors.ts` — 色板 + 工具函数（Tailwind 配置用）
   - `typography.ts` — 字体、排版
   - `spacing.ts` — 间距系统
   - `index.ts` — 统一导出
2. 搬移 UI 组件（`design_guid/ui/` → `src/components/ui/`）：
   - 本阶段只搬移编辑器会用到的基础组件：
     - `button.tsx` — 按钮
     - `input.tsx` — 输入框
     - `label.tsx` — 表单标签
     - `slider.tsx` — 滑块（属性面板用）
     - `select.tsx` — 下拉选择
     - `tabs.tsx` — 标签页（视角切换用）
     - `dialog.tsx` — 弹窗
     - `badge.tsx` — 徽章
     - `switch.tsx` — 开关
     - `toast.tsx` — Toast 通知
   - 暂不搬移的（MVP 不需要）：
     - `table.tsx` / `pagination.tsx`（数据表格相关）
     - `markdown.tsx`（Markdown 渲染）
     - `ExampleCard.tsx`（示例卡片）
     - `progress.tsx` / `progress-bar.tsx`（进度条）
     - `Skeleton.tsx`（骨架屏）
     - `card.tsx`（如需要再搬）
     - `popover.tsx`（如需要再搬）
     - `alert.tsx`（如需要再搬）
     - `textarea.tsx`（编辑器不需要多行输入）
     - `checkbox.tsx`（可用 switch 替代）
3. 创建 `src/lib/utils/cn.ts`：
   ```typescript
   import { clsx, type ClassValue } from "clsx";
   import { twMerge } from "tailwind-merge";
   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs));
   }
   ```
4. 修正 UI 组件的 import 路径：
   - `@/lib/utils/cn` → 确认与项目 `@/` 别名一致
   - `@/styles/tokens` → 确认路径正确
5. 安装设计系统 UI 组件依赖：
   - `pnpm add class-variance-authority clsx tailwind-merge lucide-react`
   - `pnpm add @radix-ui/react-progress @radix-ui/react-slot @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-dialog @radix-ui/react-switch @radix-ui/react-label @radix-ui/react-slider`
   - `pnpm add framer-motion`（部分组件动画需要）

**验收**：
- `import { COLORS } from '@/styles/tokens'` 不报错
- `import { Button } from '@/components/ui/button'` 不报错
- `<Button>测试</Button>` 渲染出绿色药丸形按钮

---

## T0.5 核心依赖安装

**目标**：安装物理引擎和状态管理库

**任务**：
1. 安装 Planck.js：`pnpm add planck-js`
2. 安装 Zustand：`pnpm add zustand`
3. 在 `src/App.tsx` 中做基础验证：
   - 导入 planck 并创建一个 World 实例（仅验证，后续删除）
   - 导入 zustand 创建一个简单 store（仅验证，后续删除）
4. 创建占位入口文件（空导出，为第1阶段准备目录）：
   - `src/engine/index.ts`
   - `src/renderer/index.ts`
   - `src/store/index.ts`

**验收**：
- `import { World, Vec2 } from 'planck-js'` 不报错
- `const world = new World({ gravity: Vec2(0, -9.8) })` 正常执行
- `pnpm tsc --noEmit` 通过

---

## T0.6 验证与首次提交

**目标**：全量验证 + Git 首次提交

**任务**：
1. 清理 Vite 默认文件：
   - 删除默认 logo/图片
   - 清理 `App.tsx` 为简洁入口（显示项目名称 + 一个 Button 组件）
   - 清理 `App.css` / 默认样式
2. 在 `App.tsx` 中放置验证内容：
   ```tsx
   // 简单展示：项目名称 + Button + Tailwind 类名验证
   <div className="min-h-screen bg-eduMind-light flex items-center justify-center">
     <div className="text-center">
       <h1 className="text-2xl font-bold text-eduMind-dark mb-4">物理编辑器</h1>
       <Button>开始使用</Button>
     </div>
   </div>
   ```
3. 执行全量检查：
   - `pnpm lint` — 通过
   - `pnpm tsc --noEmit` — 通过
   - `pnpm dev` — 页面正常渲染
4. 创建 `.gitignore`（Vite 模板自带，确认包含 `node_modules/`、`dist/`）
5. Git 首次提交：
   - `git add` 项目文件（注意排除 `design_guid/` 原始文件，这些作为参考保留不提交，或按需决定）
   - 提交信息：`feat: 初始化项目脚手架与设计系统集成`
   - 作者：`--author="cjn <1229412289@qq.com>"`

**验收**：
- ✅ `pnpm dev` 启动成功，浏览器可见"物理编辑器"标题 + 绿色 Button
- ✅ Tailwind `eduMind-*` 类名生效（绿色按钮、浅色背景）
- ✅ `import planck from 'planck-js'` 不报错
- ✅ ESLint + TypeScript 检查全部通过
- ✅ pre-commit hook 正常拦截（`pnpm lint && pnpm tsc --noEmit`）
- ✅ Git 提交成功

---

## 产出清单

完成后项目目录结构：
```
phys_template_mechanics/
├── .claude/              # Claude 配置（已有）
├── .husky/               # Git hooks（已有）
├── .tasks/               # 任务文档（已有）
├── design_guid/          # 设计系统参考（保留）
├── docs/                 # 需求文档（已有）
├── node_modules/
├── src/
│   ├── components/
│   │   └── ui/           # EduMind UI 组件（10个）
│   ├── styles/           # 设计 token（5个文件）
│   ├── lib/
│   │   └── utils/
│   │       └── cn.ts     # 类名合并工具
│   ├── engine/
│   │   └── index.ts      # 占位
│   ├── renderer/
│   │   └── index.ts      # 占位
│   ├── store/
│   │   └── index.ts      # 占位
│   ├── core/             # 空目录
│   ├── models/           # 空目录
│   ├── App.tsx           # 入口（验证页面）
│   ├── main.tsx          # React 挂载
│   └── index.css         # Tailwind 指令
├── CLAUDE.md
├── PROGRESSIVE-PLAN.md
├── index.html
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

**下一阶段依赖**：第1阶段将在 `src/engine/`、`src/renderer/`、`src/store/` 中实现 Planck.js 集成和 Canvas 渲染。
