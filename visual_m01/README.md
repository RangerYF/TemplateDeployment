# 立体几何展示台 (3D Geometry Visualization Platform)

高中数学立体几何教学辅助工具，面向教师的交互式 3D 几何编辑器。支持 13 种几何体建模、顶点标注、面交互、坐标系、外接球/圆、截面、角度/距离度量、展开图、三视图、文本指令建模、动点动画等功能，并提供用户登录、作品管理工作台与多学科模板体系。

## 技术栈

- **框架**：React 19 + TypeScript + Vite
- **3D 渲染**：Three.js + @react-three/fiber + @react-three/drei
- **路由**：React Router v7（SPA 多页面：登录 / 工作台 / 编辑器）
- **状态管理**：Zustand（EntityStore / SelectionStore / ToolStore / HistoryStore / UIStore / AnimationStore / AuthStore）
- **样式**：Tailwind CSS + EduMind 设计系统

## 架构概览（V0.2 七系统编辑器架构）

所有交互对象统一为 Entity，所有变更通过 Command 执行：

```
用户操作 → Tool 捕获 → Command 封装 → EntityStore 变更 → Signal 广播 → Renderer 更新 / Inspector 刷新
```

| 系统 | 职责 | 位置 |
|------|------|------|
| Entity | 统一实体模型（9 种类型） | `src/editor/entities/` |
| Command | 所有变更封装为可逆命令，支持 Undo/Redo（11 个） | `src/editor/commands/` |
| Signal | 类型安全的发布-订阅事件系统 | `src/editor/signals.ts` |
| Tool | 交互工具（7 个） | `src/editor/tools/` |
| Selection | 实体选中 + Hover 状态管理 | `src/editor/store/selectionStore.ts` |
| Property/Inspector | 选中实体 → 动态属性面板（9 个 Inspector + 通用操作栏） | `src/components/panels/inspectors/` |
| Renderer | 实体类型 → 渲染组件映射（9 个 Renderer） | `src/components/scene/renderers/` |

## 项目结构

```
visual_template/
├── src/
│   ├── pages/                       # 页面（V0.5 新增）
│   │   ├── LoginPage.tsx            # 登录页
│   │   ├── WorkspacePage.tsx        # 作品管理工作台
│   │   └── EditorPage.tsx           # 3D 编辑器页面
│   ├── router/                      # 路由（V0.5 新增）
│   │   ├── index.tsx                # React Router 配置
│   │   └── AuthGuard.tsx            # 路由鉴权守卫
│   ├── lib/api/                     # API 层（V0.5 新增）
│   │   ├── client.ts                # Axios 客户端 + Token 拦截器
│   │   └── auth.ts                  # 登录 / Token 管理
│   ├── config/                      # 配置（模板定义、API 地址等）
│   ├── types/                       # 全局类型定义
│   ├── editor/                      # 编辑器核心系统
│   │   ├── entities/                # Entity 类型定义（9 种实体类型）
│   │   ├── commands/                # 11 个 Command（含 Batch）
│   │   ├── tools/                   # 7 个交互工具
│   │   ├── store/                   # Zustand Store（Entity/Selection/Tool/History/UI/Animation/Auth）
│   │   ├── signals.ts               # Signal 事件系统
│   │   ├── shortcuts.ts             # 全局快捷键（Ctrl+Z/Y/Escape）
│   │   ├── commandParser.ts         # 文本指令解析器（AB画线/ABC截面）
│   │   ├── crossSectionHelper.ts    # 截面计算核心逻辑
│   │   ├── builderCache.ts          # BuilderResult 运行时缓存
│   │   └── init.ts                  # 编辑器初始化
│   ├── engine/                      # 计算引擎（纯函数，不依赖 UI）
│   │   ├── builders/                # 13 种几何体构建器
│   │   ├── math/                    # 度量计算（13 个 Calculator + 角度/距离/直线方程）
│   │   ├── unfolding/               # 展开图算法（11 种几何体）
│   │   └── projection/              # 三视图投影
│   ├── components/
│   │   ├── scene/                   # 3D 场景
│   │   │   ├── renderers/           # 9 个实体渲染器 + RendererRegistry
│   │   │   ├── Scene3D.tsx          # 场景容器（遍历 EntityStore 分发渲染）
│   │   │   ├── ToolEventDispatcher  # 工具事件分发（RAF 节流）
│   │   │   ├── ToolBar.tsx          # 工具栏（顶部居中横排 + 名称标签）
│   │   │   ├── ModeIndicator.tsx    # 工具步骤指示器
│   │   │   ├── TextCommandInput.tsx # 文本指令输入框
│   │   │   └── AnimationDriver.tsx  # 动点动画驱动（useFrame 乒乓运动）
│   │   ├── panels/                  # 面板系统
│   │   │   ├── inspectors/          # 9 个 Inspector + InspectorCommon 通用操作栏
│   │   │   ├── EntityListPanel.tsx  # 左侧实体列表（分组/搜索/隐藏/锁定）
│   │   │   ├── ParameterPanel.tsx   # 参数设置（滑块 + 数字输入）
│   │   │   ├── CoordSystemPanel.tsx # 坐标系独立面板
│   │   │   ├── DataIOPanel.tsx      # 场景导入/导出
│   │   │   └── AuxiliaryTools.tsx   # 辅助功能（展开图/三视图/外接球）
│   │   ├── icons/                   # 自定义 SVG 图标（几何体 + 工具）
│   │   ├── views/                   # 展开图 / 三视图面板
│   │   ├── info/                    # 度量显示 / 计算步骤弹窗
│   │   ├── layout/                  # 布局（TopBar / LeftPanel / AppLayout）
│   │   └── ui/                      # 基础 UI 组件
│   └── styles/                      # Design Tokens
├── design_guid/                     # EduMind 设计系统资产
├── docs/                            # 需求文档 / 演示清单
├── .tasks/                          # 任务管理
│   └── completed/                   # V0.1~V0.5 已完成任务
└── CLAUDE.md                        # AI 协作全局规则
```

## 功能清单

### 几何体库（13 种）

| 分类 | 几何体 | 参数 |
|------|--------|------|
| 棱柱 | 正方体、长方体、正棱柱(3~8边) | 边长/长宽高/边数+边长+高 |
| 棱锥/棱台 | 棱锥(3~8边)、棱台(3~8边) | 边数+边长+高(+侧棱长联动) |
| 旋转体 | 圆柱、圆锥、圆台、球 | 半径/高/上下底半径 |
| 四面体 | 正四面体、墙角四面体、对棱相等四面体、对棱垂直四面体 | 棱长/直角边/对棱长 |

### 标注与交互
- Hover 高亮（线段/面）+ 左键选中
- 顶点标签编辑（双击重命名）
- 棱上/曲面上/面上取点
- 自定义线段（颜色/虚实可调）
- 截面工具（交点自动计算 + 面分割渲染）
- 右键菜单（删除/重命名/取点）
- Ctrl/⌘ 穿透选中被遮挡元素

### 文本指令输入
- 线段/截面工具激活时出现输入框
- 输入 "AB" 回车创建线段，输入 "ABC" 回车创建截面
- 下标点名支持（输入 A1 自动匹配 A₁）
- 错误提示（点名不存在时友好提示）

### 坐标系
- 交互式建系：选原点 → 选面定 Z 轴（朝上）→ 选方向定 X 轴 → Y 轴自动确定
- 任意点（顶点/棱上点/面上点）可作原点
- 建系后显示各点坐标值
- 坐标输入创建新点
- 选中线段查看直线方程（对称式 + 方向向量）

### 度量计算
- 体积 / 表面积（精确值 LaTeX + 近似值 + 分步计算弹窗）
- 角度度量（7 个工具之一）：二面角 / 线面角 / 线线角
  - 精确值识别（0°/30°/45°/60°/90°/arctan√2 等 10 种常见角度）
  - 3D 弧线可视化标注
- 距离度量（7 个工具之一）：点点 / 点线 / 点面 / 线线 / 线面
  - 精确值输出（√n 简化、a√b 化简、分数有理化）
  - 虚线垂线/公垂线 + 直角标记 + 距离标签

### 动点功能
- 棱上动点参数控制（t 参数滑块 0~1）
- 动画播放/暂停/重置（乒乓往返运动）
- 速度滑块（0.1x ~ 3x）
- 动点移动时关联度量（角度/距离）实时更新
- 动画撤销（整段播放为一个 undo 单元）

### 辅助分析
- 外接球（3条正交大圆线 + 半径精确值 + 球心坐标）
- 外接圆（选 3 点定义 + 半径）

### 展开图 / 三视图
- 11 种几何体展开图（SVG 渲染，可缩放/平移/导出 PNG）
- 13 种几何体三视图（可见边/隐藏边/标注线/导出 PNG）

### 编辑器能力
- 完整 Undo/Redo（Ctrl+Z / Ctrl+Y，50 步历史）
- 实体列表面板（左侧，按类型分组/搜索/隐藏内置/锁定）
- Inspector 统一设计（通用操作栏 + 类型专属属性编辑）
- 级联删除（删除点时自动清理关联线段/截面/度量）
- 场景导出/导入（JSON 序列化）

### 用户系统与作品管理（V0.5）
- 用户登录（JWT 认证 + Token 自动续期）
- 路由守卫（未登录自动跳转登录页）
- 作品工作台（列表/搜索/排序/新建/删除/打开）
- 编辑器持久化（手动保存/自动保存/场景序列化与反序列化）
- 缩略图截取（Canvas 快照 → 作品封面）
- 模板推荐（工作台模板卡片 + 多学科分类）
- Mock 模式（无后端环境下全链路可用）

### 7 个交互工具
| 工具 | 功能 |
|------|------|
| 选择 | 点击选中/拖拽/Hover 高亮 |
| 画线段 | 选两点创建自定义线段（支持文本指令） |
| 创建截面 | 选三点定义截面平面（支持文本指令） |
| 建坐标系 | 三步交互建立坐标系 |
| 画外接圆 | 选三点定义外接圆 |
| 标记角度 | 选线/面组合度量角度 |
| 标记距离 | 选点/线/面组合度量距离 |

## 常用命令

```bash
pnpm dev                         # 启动开发服务器（http://localhost:5173）
pnpm build                       # 构建生产版本
pnpm lint                        # ESLint 代码检查
pnpm tsc --noEmit                # TypeScript 类型检查
```

## 设计规范

- 主色调：`#00C06B`
- 字体大小：≥ 14px
- 适配目标：1080p 教室投影仪
- 设计系统详见 `design_guid/DESIGN_SYSTEM_GUIDE.md`

## 版本历史

| 版本 | 目标 | 状态 |
|------|------|------|
| V0.1 | 功能实现（6 种几何体全功能） | ✅ 已完成 |
| V0.2 | 架构重构（七系统编辑器架构：Entity/Command/Signal/Tool/Selection/Property/Renderer） | ✅ 已完成 |
| V0.3 | 功能扩展（面交互/坐标系重构/13种几何体/角度距离度量/实体列表/UI优化） | ✅ 已完成 |
| V0.4 | 教学反馈迭代（滑块修复/外接球优化/直线方程/文本指令/动点功能） | ✅ 已完成 |
| V0.5 | 用户系统与作品管理（登录鉴权/工作台/编辑器持久化/缩略图/模板推荐/Mock模式） | ✅ 已完成 |
