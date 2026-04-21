# M-06 向量运算演示台 — 实现说明

> 版本：V1.0 | 日期：2026-03-14 | 工作目录：visual_m06/

---

## 实现概览

按照 visual_template 的七系统架构，完整实现了 M-06 向量运算演示台。

---

## 文件结构

```
visual_m06/
├── index.html                        # 入口 HTML
├── package.json                      # 依赖（React 19, Three.js, Zustand 5, Vite 7）
├── tsconfig.json / tsconfig.app.json # TypeScript strict 配置
├── vite.config.ts                    # Vite + @/ 别名
├── tailwind.config.ts                # Tailwind 3.x（与 visual_template 一致）
├── postcss.config.js / eslint.config.js
├── src/
│   ├── main.tsx                      # React DOM 入口
│   ├── App.tsx                       # 根组件（Canvas路由 + 键盘快捷键）
│   ├── index.css                     # 全局样式（Tailwind base）
│   ├── vite-env.d.ts
│   │
│   ├── styles/tokens.ts              # 设计 token（与 visual_template 一致 + 向量色）
│   ├── lib/utils/cn.ts               # clsx + tailwind-merge 工具
│   │
│   ├── editor/                       # 七系统架构
│   │   ├── signals.ts                # Signal<T> 发布订阅
│   │   ├── entities/types.ts         # 类型定义（Vec2D/Vec3D/OperationType/Meta）
│   │   ├── commands/
│   │   │   ├── types.ts              # Command 接口
│   │   │   └── updateVector.ts       # UpdateVec2D/3D/Scalar/LoadPreset 命令
│   │   ├── store/
│   │   │   ├── vectorStore.ts        # 主状态（向量、运算类型、UI配置）
│   │   │   ├── historyStore.ts       # 撤销/重做（MAX=50，与 visual_template 一致）
│   │   │   ├── uiStore.ts            # UI 面板状态
│   │   │   └── index.ts              # 汇总导出
│   │   └── index.ts                  # 编辑器层统一导出
│   │
│   ├── engine/vectorMath.ts          # 向量数学计算（2D+3D）
│   ├── data/presets.ts               # 全部预设数据（VEC-011~VEC-062，29个场景）
│   │
│   └── components/
│       ├── layout/
│       │   ├── AppLayout.tsx         # 三列布局（场景库|主画布|参数面板）
│       │   └── TopBar.tsx            # 运算类型分组切换 + 撤销/重做按钮
│       ├── canvas/
│       │   ├── Canvas2D.tsx          # SVG 画布（6种2D运算，可拖拽向量）
│       │   └── Canvas3D.tsx          # R3F 三维画布（空间向量+叉积）
│       └── panels/
│           ├── ScenarioPanel.tsx     # 左侧场景库（预设列表，按运算分组）
│           └── ParamPanel.tsx        # 右侧参数面板（输入+结果+教学要点）
└── .tasks/
    └── implementation.md             # 本文档
```

---

## 七系统适配说明

| 系统 | visual_template | visual_m06 适配 |
|------|-----------------|-----------------|
| **Entity** | 10种实体类型 | Vec2D/Vec3D/OperationType（简化） |
| **Signal** | Signal<T> 发布订阅 | 完全相同 |
| **Command + History** | Command接口 + historyStore | 完全相同结构，命令简化为向量更新 |
| **Tool** | selectTool/drawSegmentTool等 | 无独立 Tool（SVG 拖拽内联实现） |
| **Store** | entityStore（复杂） | vectorStore（向量状态）+ uiStore |
| **Inspector** | 10种实体 Inspector | ParamPanel（按运算类型分支渲染） |
| **Renderer** | Three.js R3F 实体渲染 | Canvas2D（SVG）+ Canvas3D（R3F） |

---

## 覆盖的需求文档场景

### 2D 运算（Canvas2D.tsx）
| ID | 运算 | 预设数量 | 可拖拽 |
|----|------|----------|--------|
| VEC-011 | 平行四边形法则 | 5 | ✓ vecA, vecB |
| VEC-012 | 三角形法则 | 3 | ✓ vecA, vecB终点 |
| VEC-021 | 向量减法 | 3 | ✓ vecA, vecB |
| VEC-031 | 数乘向量 | 3 | ✓ vecA + k滑块 |
| VEC-041 | 数量积（点积） | 5 | ✓ vecA, vecB + 角度弧/投影 |
| VEC-051 | 基底分解 | 3 | ✓ 目标向量 + 两基底 |

### 3D 运算（Canvas3D.tsx）
| ID | 运算 | 预设数量 | 交互 |
|----|------|----------|------|
| VEC-061 | 空间向量 | 3 | OrbitControls 旋转缩放 |
| VEC-062 | 叉积（向量积） | 4 | 平行四边形面片 + 法向量显示 |

---

## 设计规范

- **颜色**：与文档 11.1 完全一致
  - vecA: `#FF6B6B`（红）
  - vecB: `#4ECDC4`（青）
  - 和/差: `#FFD700`（金）
  - 数乘: `#9C27B0`（紫）
  - basis1: `#2196F3`（蓝），basis2: `#FF9800`（橙）

- **2D 坐标系**：viewBox="-400 -300 800 600"，1数学单位=50SVG单位
  - X轴范围：[-8, 8]，Y轴范围：[-6, 6]
  - 拖拽吸附：0.5单位网格

- **3D**：Three.js ArrowHelper + React Three Fiber OrbitControls
  - 坐标轴：x红/y绿/z蓝（右手系）

---

## 启动方式

```bash
cd visual_m06
pnpm install
pnpm dev
```

## 构建验证

```bash
pnpm lint && pnpm tsc --noEmit
pnpm build
```
