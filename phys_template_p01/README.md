# P物理沙盒

> 为中国初高中物理教师构建的**统一物理模拟器**——一个模拟器覆盖全部物理域。
>
> 所属产品线：EduMind AI 互动课件平台 · 物理学科教具

## 产品愿景

**核心价值**：老师从预设场景库加载场景、调整参数、切换视角，3 分钟内复现一道物理题的完整过程。

**为什么是统一模拟器？** 物理世界没有"力学工具"和"电磁工具"的边界。一道高考综合题可能同时涉及斜面下滑 + 进入磁场做圆周运动，需要在同一画布上完整呈现。因此所有物理域（力学、电磁、振动、热学、天体）共存于同一实体系统和渲染引擎。

**产品路线**：

| Phase | 产品形态 | 覆盖率 |
|-------|---------|--------|
| **Phase 1**（当前） | 预设场景库 + 参数微调 | ≈85% |
| Phase 2 | 结构化搭建（用户拖入组件） | ≈95% |
| Phase 3 | 深化教学体验（专项模板、导出增强） | ≈98% |

## 技术栈

- **框架**：React 18 + TypeScript
- **构建**：Vite
- **渲染**：Canvas 2D（自研渲染管线）
- **状态管理**：Zustand
- **样式**：Tailwind CSS
- **部署**：Vercel

## 快速开始

```bash
git clone <repo-url>
cd phys_template_p01
pnpm install
pnpm dev
```

## 目录结构

```
src/
├── core/                  # 核心层（注册表、引擎、类型系统、物理工具）
│   ├── types.ts           # 全局 TypeScript 接口定义
│   ├── visual-constants.ts # 力颜色映射（唯一来源）
│   ├── registries/        # 实体/求解器/渲染器/预设 四大注册表
│   ├── engine/            # Simulator + PresetLoader
│   └── physics/           # Vec2、几何、积分器
├── domains/               # 物理域（独立开发）
│   ├── mechanics/         # 力学域（开发者A）
│   │   ├── entities/      # 实体类型（block、surface）
│   │   ├── solvers/       # 求解器（block-on-surface 等）
│   │   ├── renderers/     # 实体渲染器
│   │   ├── viewports/     # 视角渲染器（受力视角）
│   │   ├── presets/       # 预设 JSON
│   │   └── index.ts       # 域注册入口
│   └── em/                # 电磁域（开发者B）
│       └── index.ts       # 域注册入口（待实现）
├── renderer/              # 渲染基础设施（坐标转换、渲染循环、基础图元）
├── shell/                 # UI 外壳（三栏布局、参数面板、预设库）
├── store/                 # Zustand 全局状态
├── components/ui/         # UI 组件库
├── styles/                # 设计 Token + 全局样式
└── main.tsx               # 应用入口（域注册）
```

## 架构概念

```
PresetJSON → PresetLoader → SceneDefinition → Simulator → PhysicsResult → Renderer → Canvas
```

- **Entity**：场景中的物理对象（物块、平面、电荷等），通过 EntityRegistry 注册
- **Relation**：实体间的物理关系（接触、连接等）
- **Solver**：物理求解器，根据场景模式匹配自动选择，计算力、运动状态
- **Renderer**：实体渲染器 + 视角渲染器，将物理结果绘制到 Canvas
- **Viewport**：视角层（受力、运动、能量等），控制显示哪些物理量
- **Preset**：预设 JSON 文件，描述完整的物理场景配置

域开发者通过注册 API 将实体/求解器/渲染器接入系统，无需修改核心代码。

## 开发流程

新增物理预设的标准流程（5步）：

1. 注册实体类型
2. 实现求解器
3. 实现实体渲染器
4. 实现视角渲染器
5. 编写预设 JSON

详细指引见 `docs/开发者指引.md`。

## 设计文档

| 文档 | 内容 |
|------|------|
| [技术栈选型结论](docs/design/技术栈选型结论.md) | 技术栈决策及理由 |
| [核心类型系统-接口设计](docs/design/核心类型系统-接口设计.md) | TypeScript 接口设计意图 |
| [注册机制与引擎设计](docs/design/注册机制与引擎设计.md) | 注册表 API + Simulator + 预设加载 |
| [预设Schema与视角层设计](docs/design/预设Schema与视角层设计.md) | 预设 JSON 规范 + 视角机制 |
| [开发者指引](docs/开发者指引.md) | **首次开发必读** |
