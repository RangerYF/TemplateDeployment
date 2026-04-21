# 物理编辑器

EduMind AI 互动课件平台 · 物理学科 2D 编辑器

为中国初高中物理教师构建，支持拖拽物体、设置属性与约束关系、运行物理仿真、查看受力分析。

## 技术栈

| 层 | 技术 |
|---|---|
| 物理引擎 | Planck.js（Box2D JS 移植） |
| UI 框架 | React 19 + TypeScript |
| 渲染 | Canvas 2D |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS v4 + EduMind 设计系统 |
| 构建 | Vite + pnpm |

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 代码检查
pnpm lint

# TypeScript 类型检查
pnpm tsc --noEmit

# 代码格式化
pnpm format

# 构建生产版本
pnpm build
```

## 部署到 Vercel

项目已按 Vercel 静态前端部署方式收敛：

- 构建命令：`pnpm build`
- 输出目录：`dist`
- 包管理器：`pnpm@10.32.1`
- Node 版本：`^20.19.0 || >=22.12.0`

如需首次绑定当前仓库，可在已登录 Vercel CLI 的环境中执行：

```bash
vercel project add phys-template-mechanics
vercel link --yes --project phys-template-mechanics
vercel --prod --yes
```

本项目使用 hash 路由（如 `#editor?...`），因此不依赖服务端 rewrite；模板场景资源位于 `public/templates/scenes/*.json`，可直接作为静态资源部署。

## 已实现功能

- **物理引擎**：Planck.js World 封装，支持创建/销毁物体，固定时间步长仿真
- **Canvas 渲染**：物体渲染（矩形/圆形/多边形/弧线/多 Fixture）+ 背景网格线 + 地面渲染 + DPI 适配
- **坐标系转换**：物理世界坐标（y 轴向上，单位米）↔ 屏幕坐标（y 轴向下，单位像素）
- **编辑/仿真切换**：播放（物块自由落体）→ 暂停 → 继续 → 停止（恢复初始位置）
- **画布交互**：中键拖拽平移、空格+左键平移、滚轮以鼠标位置为中心缩放
- **11 种物体类型**（Body Type Registry 架构）：
  - 基础物体：物块、球体、杆件
  - 支撑面：斜面、墙壁、固定锚点
  - 机构：滑轮座
  - 特殊表面：传送带（pre-solve 带动 + 动画履带）、半球面（ChainShape 弧线）、V形槽（双 Fixture）
  - 内置：地面
- **Body Type Registry**：每种物体的物理/渲染/hitTest/属性/图标收敛到一个描述文件，新增物体仅需 1 个文件 + 1 行 import
- **交互能力 Descriptor**：`InteractionCapability` 声明式接口，物体在自己的描述文件中声明交互约束（可选中/移动/缩放/旋转/删除等），SelectTool 读取配置而非硬编码类型判断
- **编辑交互优化**：
  - **选中手柄**：4 角手柄（非等比缩放）+ 边框 hover 检测（单轴缩放）+ 弧形箭头旋转柄
  - **表面吸附**：拖拽物体自动吸附到地面/斜面（含旋转对齐），Alt 键禁用
  - **对齐辅助线**：6 种对齐检测（中心/顶/底/左/右），蓝色虚线穿越视口
- **编辑器框架**：
  - **Scene Model**：独立于物理引擎的场景数据层，编辑模式的唯一真相源
  - **三栏布局**：左侧物体库面板 + 中间画布 + 右侧属性面板
  - **物体面板**：按分类分组显示，拖拽到画布创建物体
  - **属性面板**：数据驱动渲染，选中物体后实时编辑属性（位置/角度/质量/摩擦/弹性/形状参数/初速度等）
  - **Selection 系统**：点击选中（蓝色边框+手柄）、hover 高亮（蓝色虚线）、ESC/空白取消
  - **Tool 系统**：SelectTool 支持选中+拖拽移动物体
  - **Command 系统**：Undo/Redo 支持所有编辑操作（添加/删除/移动/属性修改）

## 快捷键

| 快捷键 | 操作 |
|--------|------|
| Ctrl+Z | 撤销 |
| Ctrl+Shift+Z / Ctrl+Y | 重做 |
| Delete / Backspace | 删除选中物体 |
| ESC | 取消选中 |
| 空格+左键拖拽 | 画布平移 |
| 中键拖拽 | 画布平移 |
| 滚轮 | 画布缩放 |
| Alt+拖拽 | 禁用吸附 |

## 项目结构

```
src/
├── components/
│   ├── ui/              # EduMind 设计系统 UI 组件
│   ├── layout/
│   │   └── EditorLayout.tsx  # 三栏编辑器布局
│   ├── panels/
│   │   ├── ObjectPanel.tsx   # 左侧物体库面板（Registry 驱动分组）
│   │   └── PropertyPanel.tsx # 右侧属性面板（Registry 数据驱动）
│   ├── Canvas.tsx       # 画布组件（渲染 + 交互 + Tool/Selection/DnD 集成）
│   └── Toolbar.tsx      # 工具栏（播放控制 + Undo/Redo）
├── core/
│   ├── geometry.ts      # 几何工具（pointInTriangle/pointInPolygon）
│   ├── hitTest.ts       # 点击检测（委托 Registry descriptor，按 hitTestPriority 排序）
│   ├── tools/
│   │   ├── Tool.ts      # Tool 接口定义
│   │   └── SelectTool.ts # 选择/移动/缩放/旋转工具（读取 InteractionCapability）
│   ├── handles/
│   │   └── SelectionHandles.ts # 选中手柄（位置/hitTest/resize/rotate 计算）
│   ├── snap/
│   │   ├── types.ts     # SnapSurface/SnapResult 类型
│   │   ├── utils.ts     # 局部→世界坐标转换
│   │   └── SnapEngine.ts # 水平面+斜面吸附引擎
│   ├── align/
│   │   └── AlignEngine.ts # 对齐辅助线引擎（6 种对齐检测）
│   └── commands/
│       ├── Command.ts            # Command 接口
│       ├── CommandHistory.ts     # 命令历史管理
│       ├── AddBodyCommand.ts     # 添加物体
│       ├── RemoveBodyCommand.ts  # 删除物体
│       ├── MoveBodyCommand.ts    # 移动物体
│       ├── ChangePropertyCommand.ts # 修改属性
│       └── BatchPropertyCommand.ts  # 批量属性修改（缩放/旋转用）
├── models/
│   ├── types.ts         # 场景数据类型（SceneBody/Scene）
│   ├── defaults.ts      # ID/标签生成 + createGround()
│   └── bodyTypes/       # Body Type Registry（物体类型注册表）
│       ├── descriptor.ts    # BodyTypeDescriptor + InteractionCapability + getInteraction
│       ├── registry.ts      # 注册表 Map + 查询 API
│       ├── index.ts         # 统一入口（触发全部注册 + 导出）
│       ├── block.tsx        # 物块描述
│       ├── ball.tsx         # 球体描述
│       ├── bar.tsx          # 杆件描述
│       ├── slope.tsx        # 斜面描述
│       ├── wall.tsx         # 墙壁描述
│       ├── anchor.tsx       # 固定锚点描述
│       ├── pulleyMount.tsx  # 滑轮座描述
│       ├── conveyor.tsx     # 传送带描述
│       ├── hemisphere.tsx   # 半球面描述
│       ├── groove.tsx       # V形槽描述
│       └── ground.tsx       # 地面描述（vertical-only 移动、不可缩放/旋转/删除）
├── engine/
│   ├── PhysicsBridge.ts # 物理引擎桥接类
│   ├── sceneSync.ts     # Scene Model → PhysicsBridge 同步（Registry 驱动）
│   ├── types.ts         # 引擎层类型定义
│   └── physicsBridgeInstance.ts # 单例实例
├── renderer/
│   ├── CanvasRenderer.ts    # Canvas 渲染器（Registry 委托渲染）
│   └── CoordinateSystem.ts  # 坐标系转换
├── store/
│   ├── editorStore.ts     # 编辑器主状态（模式/仿真状态/重力）
│   ├── viewportStore.ts   # 视口状态（平移/缩放）
│   ├── sceneStore.ts      # 场景数据（Scene Model）
│   ├── selectionStore.ts  # 选中状态
│   ├── toolStore.ts       # 工具状态
│   └── commandStore.ts    # 命令历史（Undo/Redo）
├── styles/              # 设计 token（色彩/排版/间距）
├── lib/utils/           # 工具函数（cn.ts, color.ts）
├── App.tsx
└── main.tsx
```

## 目标设备

- 1920×1080 投影仪（主适配）
- 1280×720 兼容
- iPad 基本可用

## 开发进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| S0 项目脚手架 | Vite + 设计系统 + 依赖安装 | ✅ 已完成 |
| S1 引擎+画布 | Planck.js 集成 + Canvas 渲染 + 编辑/仿真切换 | ✅ 已完成 |
| S2 编辑器框架 | Tool/Selection/Command + 面板拖拽 | ✅ 已完成 |
| S3 物体类型 | 7 种基础物体 + 4 种扩展物体，共 11 种 | ✅ 已完成 |
| S3.3 Registry 重构 | Body Type Registry 消除 switch 耦合 | ✅ 已完成 |
| S4 编辑交互优化 | 选中手柄 + 表面吸附 + 对齐辅助线 | ✅ 已完成 |
| S4.1 Interaction Descriptor | 交互能力声明式重构 + Ground 正式注册 | ✅ 已完成 |
| S5 约束系统 | 绳/杆/弹簧 Joint | 待开始 |
| S6 力的体系 | 受力分析视角 | 待开始 |
| S7 运动视角 | 速度/加速度/图表 | 待开始 |
| S8 打磨 | 视觉风格 + 性能优化 | 待开始 |

详细计划见 [PROGRESSIVE-PLAN.md](./.tasks/active/planck_design/PROGRESSIVE-PLAN.md)
