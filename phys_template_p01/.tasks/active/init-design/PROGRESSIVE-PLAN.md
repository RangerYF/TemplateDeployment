# 🎯 物理教具统一模拟器 · 架构设计渐进式开发计划

## 📌 版本目标

完成技术架构设计并初始化项目框架，使两位开发者能够各自独立启动物理域的功能开发。

## 🔄 开发流程总览

```
第1阶段：技术栈选型与验证
    ↓ 产出：确定的技术栈 + 验证过的构建配置
第2阶段：核心类型系统设计
    ↓ 产出：Entity/Relation/State 等 TypeScript 接口定义
第3阶段：注册机制与引擎循环设计
    ↓ 产出：三大注册表 + Simulator 运行循环的接口设计
第4阶段：Preset Schema 与视角层设计
    ↓ 产出：预设 JSON 完整字段定义 + 视角层绑定机制
第5阶段：项目初始化与骨架搭建
    ↓ 产出：可运行的空项目 + core/ + shell/ + renderer/ 骨架代码
第6阶段：参考实现（端到端打通）
    ↓ 产出：一个完整可运行的最简预设，作为两位开发者的开发范本
```

## 📋 串行执行阶段

### 第1阶段：技术栈选型与验证 ⏱️ 1天

**目标**：确定项目使用的全部技术栈，并验证关键技术组合可行。

**主要任务**：
1. 确定前端框架（React 或其他）、状态管理方案
2. 确定 Canvas 2D 渲染方案（原生 Canvas API / Konva / Pixi.js 等）
3. 确定图表库（v-t图、能量条形图的绘制方案）
4. 确定构建工具（Vite / Next.js 等）、包管理器、TypeScript 配置
5. 评估是否需要数学库（Math.js / 手写 RK4 等）
6. 输出技术栈选型文档，记录每个选择的理由

**涉及文件范围**：
- `.tasks/active/init-design/技术栈选型.md` - 选型结论与理由
- 参考 `docs/方案构思/P物理沙盒_产品方案_v2.md` 维度三（页面布局）和维度七（工程组织）

**验收标准**：
✅ 每个技术选型都有明确的选择理由
✅ 关键组合（框架+Canvas+图表）的兼容性已确认
✅ 构建工具能正确处理 TypeScript + React + Canvas 的组合

**本阶段产出**：
技术栈选型文档，第2阶段设计类型系统时将基于确定的 TypeScript 配置和框架能力进行。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第2阶段：核心类型系统设计 ⏱️ 2天

**目标**：定义 Entity System 的完整 TypeScript 类型体系，使后续所有模块（注册机制、预设schema、求解器、渲染器）都基于这套类型工作。

**主要任务**：
1. 设计 Entity 基础接口（id、type、properties、position 等）
2. 设计 Relation 接口（type、from、to、约束属性等）
3. 设计 SimulationState 接口（当前时刻所有实体的状态快照）
4. 设计 PhysicsResult 接口（求解器的输出格式：力、加速度、速度、位置等）
5. 设计参数 Schema 类型（min/max/step/default/label/unit，用于驱动参数面板自动渲染）
6. 设计视角层枚举与视角数据接口（每个视角需要的数据格式）
7. 验证类型设计能覆盖产品方案中所有实体类型和关系类型

**涉及文件范围**：
- `.tasks/active/init-design/核心类型设计.md` - 类型设计文档与示例
- 参考 `docs/方案构思/P物理沙盒_产品方案_v2.md` 维度一（实体系统1.1-1.3）
- 参考各模块需求文档中的实体属性和参数定义

**验收标准**：
✅ Entity 类型能表达产品方案中列出的所有实体类别（物体、表面、连接件、场、观测工具）
✅ Relation 类型能表达所有关系类型（接触、连接、场作用、包含）
✅ 参数 Schema 类型能驱动参数面板自动渲染 slider/input/toggle
✅ 类型设计兼顾 Phase 1（预设加载）和 Phase 2（动态搭建）的需求
✅ 用"斜面物块受力"和"带电粒子在磁场中"两个典型场景验证类型表达力

**本阶段产出**：
完整的 TypeScript 接口定义文档。第3阶段的注册机制将基于这些类型定义来设计 API 签名。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第3阶段：注册机制与引擎循环设计 ⏱️ 2天

**目标**：设计三大注册表（实体、求解器、渲染器）的 API，以及 Simulator 运行循环的接口，使两个域能通过注册机制独立挂载功能。

**主要任务**：
1. 设计实体注册 API（注册实体类型定义、默认属性、参数schema）
2. 设计求解器注册 API（匹配模式的表达方式、求解函数签名、优先级/冲突处理）
3. 设计渲染器注册 API（按实体类型注册渲染函数、视角层渲染器注册）
4. 设计 Simulator 运行循环接口（初始化→求解→事件检测→状态更新→渲染 的管道）
5. 设计解析解与数值积分的统一求解器接口（两种求解方式对外暴露一致的 API）
6. 设计时间轴控制接口（播放/暂停/拖拽/调速 如何与 Simulator 交互）
7. 设计预设加载流程（JSON → Entity注入 → 求解器匹配 → 就绪）

**涉及文件范围**：
- `docs/design/注册机制与引擎设计.md` - API 设计文档
- 参考 `docs/方案构思/P物理沙盒_产品方案_v2.md` 维度一（1.3模拟引擎流程）和维度七（7.3求解器架构）
- 参考 `docs/方案构思/P物理沙盒_产品讨论记录_v2.md` 第五条（求解器实现方式）

**验收标准**：
✅ 求解器注册的 pattern 表达方式已确定，能区分"物块在斜面上"和"带电粒子在磁场中"
✅ 注册 API 支持"只加不改"——新域注册不需要修改已有注册代码
✅ Simulator 运行循环能同时处理解析解场景（直接公式）和 ODE 场景（RK4积分）
✅ 时间轴控制能支持播放/暂停/拖拽到任意时刻/变速
✅ 预设加载流程从 JSON 到渲染就绪的每一步都有明确的接口

**本阶段产出**：
注册机制与引擎的完整 API 设计文档。第4阶段将基于这些接口设计预设 Schema 的具体字段。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第4阶段：Preset Schema 与视角层设计 ⏱️ 1-2天

**目标**：定义预设 JSON 文件的完整字段规范，以及视角层的绑定和切换机制，使"加一个新预设 = 加一个 JSON 文件"成为可能。

**主要任务**：
1. 定义 Preset JSON Schema 的完整字段（元信息、实体列表、关系列表、参数schema、视角、功能开关）
2. 用至少3个典型预设验证 Schema 表达力（斜面受力、平抛运动、洛伦兹力圆周）
3. 设计视角层与预设的绑定机制（预设如何声明支持的视角）
4. 设计视角切换和叠加的行为规范（切换时清除叠加、密度自动调节等）
5. 设计视角层数据流（从求解器输出 → 视角层需要的数据 → 渲染）
6. 编写预设开发指南（开发者如何新增一个预设的标准流程）

**涉及文件范围**：
- `docs/design/预设Schema与视角层设计.md` - Schema 定义与视角层规范
- 参考 `docs/方案构思/P物理沙盒_产品方案_v2.md` 维度三（视角层3.2）和维度四（预设库4.1-4.4）
- 参考各模块需求文档中的具体模型参数

**验收标准**：
✅ Schema 能完整表达产品方案维度五中的3个完整示例（斜面题、跨域综合题、电磁感应题）
✅ 参数 schema 字段能驱动参数面板自动渲染（不需要为每个预设写 UI 代码）
✅ 视角层切换/叠加行为与产品方案维度三（3.2）的设计一致
✅ 预设开发指南清晰到开发者看完就知道"加一个新功能要创建什么文件、填什么字段"

**本阶段产出**：
Preset Schema 规范 + 视角层设计文档 + 预设开发指南。第5阶段将基于以上所有设计产出初始化项目骨架。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第5阶段：项目初始化与骨架搭建 ⏱️ 2-3天

**目标**：创建可运行的项目骨架，实现 core/、shell/、renderer/ 的基础代码，使第6阶段可以直接在上面编写参考预设。

**主要任务**：
1. 初始化项目（包管理器、构建工具、TypeScript配置、ESLint/Prettier）
2. 配置 Git（确认 author 为 `cjn <1229412289@qq.com>`）、生成 `.gitignore`
3. 配置 Husky pre-commit hook（具体检查命令根据第1阶段技术选型确定），同步更新 CLAUDE.md 附录F门禁矩阵
4. 参照 `design_guid/`（EduMind 设计系统规范，已在项目中）落地 UI 基础样式（配色、字号、间距、组件风格等）
5. 实现 core/types.ts（第2阶段定义的所有类型接口）
6. 实现三大注册表（entity-registry、solver-registry、renderer-registry）
7. 实现 core/physics/ 基础工具函数（向量运算、几何判断的初始集合）
8. 实现 shell/ UI 骨架（三栏布局、画布容器、参数面板框架、时间轴控制栏）
9. 实现 renderer/ 基础绘制 primitives（箭头绘制、文字标注、轨迹线等）
10. 实现 Simulator 运行循环骨架（加载→求解→渲染 的基本管道）
11. 实现预设加载器（读取 JSON → 注入 Entity System → 匹配求解器）
12. 创建 domains/mechanics/ 和 domains/em/ 的目录骨架和 index.ts
13. 配置 CLAUDE.md 写明各目录归属，为两位开发者的 Claude Code 划定边界

**涉及文件范围**：
- `package.json`、`tsconfig.json`、`.eslintrc`、`vite.config.ts` 等项目配置
- `.husky/pre-commit` - pre-commit hook（命令根据技术选型确定）
- `.gitignore` - 按技术栈生成
- `design_guid/` - 已有的 EduMind 设计系统规范，需要在 shell/ UI 骨架中落地应用
- `src/core/` - 类型定义 + 注册表 + 物理工具
- `src/shell/` - UI 骨架组件
- `src/renderer/` - 基础绘制能力
- `src/domains/mechanics/`、`src/domains/em/` - 目录骨架
- `src/app/main.ts` - 应用入口
- `CLAUDE.md` - 更新附录F门禁矩阵 + 开发者目录归属声明

**验收标准**：
✅ `pnpm dev` 能启动项目，浏览器显示三栏布局骨架（左参数面板+中画布+右信息面板+底时间轴）
✅ core/ 三大注册表可以正常注册和查询
✅ renderer/ primitives 能在 Canvas 上绘制箭头和文字标注
✅ 预设加载器能读取一个空的测试 JSON 并注入 Entity System
✅ `pnpm lint && pnpm tsc --noEmit` 通过
✅ Git commit 能正常通过 pre-commit hook（Husky + lint + tsc）
✅ Git author 配置为 `cjn <1229412289@qq.com>`

**本阶段产出**：
可运行的项目骨架。第6阶段将在此基础上实现一个完整的参考预设，打通端到端流程。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第6阶段：参考实现（端到端打通） ⏱️ 2-3天

**目标**：实现"水平面物块受力"这一最简预设，打通从预设加载到画布渲染到参数联动的完整链路，作为两位开发者的开发范本。

**主要任务**：
1. 在 domains/mechanics/ 中注册物块（block）和水平面（surface）两个实体类型
2. 实现"block-on-surface"求解器（计算重力 G=mg 和支持力 N=mg）
3. 实现物块和水平面的 Canvas 渲染器
4. 实现受力视角的力箭头渲染（重力红色向下、支持力蓝色向上）
5. 创建"水平面物块受力"预设 JSON 文件
6. 打通参数面板联动（调节质量 → 力的大小实时更新 → 箭头长度和标注实时变化）
7. 验证注册机制的完整闭环（域注册 → 应用入口导入 → 系统就绪）
8. 编写开发者指引文档（如何参照此范例开发新预设）

**涉及文件范围**：
- `src/domains/mechanics/entities/` - block.ts、surface.ts
- `src/domains/mechanics/solvers/` - block-on-surface.ts
- `src/domains/mechanics/renderers/` - block-renderer.ts、surface-renderer.ts
- `src/domains/mechanics/viewports/` - force-viewport.ts
- `src/domains/mechanics/presets/` - horizontal-block.json
- `src/domains/mechanics/index.ts` - 统一注册入口
- `docs/开发者指引.md` - 如何新增预设的标准流程

**验收标准**：
✅ 浏览器打开后看到：水平面上有一个物块，物块上显示重力（红色向下箭头）和支持力（蓝色向上箭头），箭头旁有数值标注
✅ 左侧参数面板显示"质量"滑块，拖动后力的数值和箭头长度实时更新
✅ 整个实现只涉及 domains/mechanics/ 目录下的文件 + 一个预设 JSON，没有修改 core/ 或 shell/ 的代码
✅ 开发者指引文档清晰到开发者看完就能照着做"斜面下滑"预设
✅ `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
完整的参考实现 + 开发者指引。至此架构设计任务完成，两位开发者可以各自在 domains/mechanics/ 和 domains/em/ 中启动并行开发。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第7阶段：发散审查 ⏱️ 1天

**目标**：逐项对比需求文档（产品方案 v2 + 需求总览）与实际设计/实现，识别所有"需求未提及但设计或实现中新增"的内容，确保初版聚焦核心目标，不含可有可无的发散需求。

**主要任务**：
1. 梳理阶段2-4设计文档中新增的概念/字段/机制，逐项追溯需求来源
2. 梳理阶段5-6实现代码中的功能点，逐项追溯设计来源
3. 对每个"无需求来源"的项做判定：
   - **核心必要**：虽然需求没直接说，但不做就跑不通（如 EntityId 生成机制）
   - **有用但可延后**：Phase 1 不需要，后续再加不影响架构（如 level、预设层级）
   - **纯发散应删除**：设计时发散出来的，删掉更简洁
4. 对"可延后"项：从代码和类型中移除或标注 Phase 2
5. 对"应删除"项：直接删除相关代码/类型/字段

**审查范围**：

| 审查层 | 审查对象 | 对照基准 |
|--------|---------|---------|
| 类型系统 | `core/types.ts` 51个接口 | 产品方案维度一（实体系统） |
| 注册机制 | 三大注册表 + PresetRegistry | 产品方案维度七（工程组织） |
| 预设Schema | PresetData 字段 | 产品方案维度四（预设库） |
| 视角层 | ViewportType/ViewportData | 产品方案维度三（视角层） |
| UI骨架 | shell/ 组件 | 产品方案维度三（页面布局） |
| 引擎管道 | Simulator/PresetLoader | 产品方案维度一（模拟引擎） |
| 参考实现 | domains/mechanics/ 全部 | 阶段6任务文档 |

**已知疑似发散项**（待审查确认）：
- `PresetData.level`（L1/L2/L3 预设层级）：需求文档是否提及？
- `PresetData.duration`：静态预设是否需要这个字段？
- `PresetGallery` 的"基础/进阶"标签：是否过早引入？
- `InfoDensity`（compact/standard/detailed）：Phase 1 是否需要三级密度？
- `OrthogonalDecomposition` 正交分解类型：Phase 1 是否有场景用到？
- `EnergyState` / `MomentumViewportData`：Phase 1 是否有预设需要？

**验收标准**：
✅ 输出完整的发散审查清单，每项有"来源/判定/处理方式"
✅ 所有"应删除"项已从代码中移除
✅ 所有"可延后"项已标注或简化
✅ `pnpm lint && pnpm tsc --noEmit` 通过

---

### 第8阶段：并行开发准备 ⏱️ 1天

**目标**：确保代码推送后，另一位开发者拉取代码即可按设计独立开发，不需要口头沟通，不会产生大量冲突。

**主要任务**：
1. **README 生成**：项目概述、技术栈、启动方式、架构概览、目录结构、开发流程
2. **CLAUDE.md 审查与优化**：确保全局提示词覆盖并行开发约束（目录归属、公共代码修改流程、命名规范、commit 规范）
3. **AGENTS.md 审查**：确认开发者B的 AI 助手能通过此文件理解项目上下文
4. **并行开发预演**：模拟开发者B的完整流程：
   - clone → pnpm install → pnpm dev
   - 阅读 README + 开发者指引
   - 在 `domains/em/` 创建第一个实体类型（如 charged-particle）
   - 注册到 emDomain → 验证不影响 mechanics 域
   - 提交 → pre-commit hook 通过
5. **冲突风险识别**：检查哪些文件两个开发者可能同时修改，制定冲突预防策略
6. **缺失约束补充**：根据预演发现的问题，补充必要的开发规范

**冲突风险清单**（预期需检查）：

| 文件 | 冲突风险 | 预防策略 |
|------|---------|---------|
| `src/main.tsx` | 两人都要注册域 | 已各自独立行，低风险 |
| `src/core/types.ts` | 新增类型 | 约定追加不修改，减少冲突 |
| `package.json` | 新增依赖 | 约定不新增外部依赖（Phase 1） |
| `CLAUDE.md` | 规则更新 | 约定单人维护 |

**验收标准**：
✅ README 完整覆盖新人上手全流程
✅ CLAUDE.md 并行开发约束清晰
✅ 预演通过：在 domains/em/ 创建实体+注册+lint 通过，不影响 mechanics
✅ 冲突风险清单已输出，每项有预防策略
✅ 代码可直接 push，开发者B 拉取后能独立开发

---

## 🎯 当前焦点

init-design 全部 8 个阶段已完成。项目可推送，两位开发者可按物理域并行开发。

## ✅ 阶段检查点

| 阶段 | 完成标志 | 状态 |
|------|---------|------|
| 第1阶段 | 技术栈选型文档已输出，关键组合兼容性已确认 | ✅ |
| 第2阶段 | 核心类型设计文档已输出，两个典型场景验证通过 | ✅ |
| 第3阶段 | 注册机制与引擎 API 设计文档已输出 | ✅ |
| 第4阶段 | Preset Schema 规范 + 视角层设计 + 预设开发指南已输出 | ✅ |
| 第5阶段 | `pnpm dev` 能启动，三栏布局显示，注册表可用，lint 通过 | ✅ |
| 第6阶段 | 两个参考预设完整可运行，端到端链路打通，开发者指引已输出 | ✅ |
| 第7阶段 | 发散项清单输出，所有非核心内容标记处理方式 | ✅ |
| 第8阶段 | 并行开发准备完成，README/提示词/预演全部就绪 | ✅ |

## 🚫 暂时不考虑

- 性能优化（Phase 1 场景计算量极小，无需优化）
- 部署配置（先本地开发跑通）
- 用户认证/账户系统
- 场景保存到云端（Phase 1 用 localStorage）
- 响应式布局适配（先做 1920x1080 主尺寸）
- 国际化
- 自动化测试体系（先跑通功能再补测试）
- P1 优先级模块的具体设计（P-05/06/07/09 等 Phase 1 不做）
- Phase 2 搭建器 UI
- 跨域综合预设（两人各自域做完后再合作）

## 📝 开发笔记

### 第1阶段（2026-03-17 完成）
- 技术栈选型结论文档：`技术栈选型结论.md`
- 关键决策：图表方案选 Canvas 自绘而非 Chart.js/uPlot，原因是 60fps 帧同步需求 + 技术统一
- 关键决策：CSS 方案直接用 Tailwind，因为 design_guid 已有完整配置和 Radix UI 组件
- 公式渲染（KaTeX）Phase 1 暂不引入，后续需要时无缝加入
- 数学库调研结论：调研 10+ 候选库后确认手写是最优解，总代码量 300-500 行 TS
- 积分器修正：默认用 Semi-implicit Euler / Velocity Verlet（辛积分器，保能量），RK4 仅用于非守恒 ODE（如电磁感应阻尼）

### 第2阶段（2026-03-17 完成）
- 核心类型设计文档：`阶段2-核心类型系统设计.md`
- 8个类型模块共51个TypeScript接口/类型定义
- 关键决策：Entity/Relation 采用泛型方案 `Entity<T>`，core 层灵活、域层类型安全
- 关键决策：PhysicsResult 用 `Map<EntityId, ...>` 而非数组，O(1) 查找
- 关键决策：ParamSchema 用 discriminated union（4种控件子类型），TS 自动窄化
- 关键决策：关系有方向性 `source → target`，语义清晰便于求解器匹配
- 两个场景验证通过：斜面物块受力（力学域）、带电粒子在磁场中（电磁域）

### 第3阶段（2026-03-17 完成）
- 注册机制与引擎设计文档：`注册机制与引擎设计.md`
- 10个设计模块共28个新增类型/接口定义
- 关键决策：SolverPattern 选用结构化对象匹配（entityTypes + relationType + qualifier），类型安全且声明式可检索
- 关键决策：SolverFunction 四参数统一签名（scene, time, dt, prevResult），Simulator 无需区分解析解/数值积分
- 关键决策：完整求解器粒度——每个求解器负责一个场景的全部物理计算，与"每个预设硬编码方程"设计一致
- 关键决策：积分器由求解器注册时指定（非预设 JSON 声明），积分器是求解器的实现细节
- 关键决策：RenderLayer 枚举（background→surface→field→object→connector→overlay）确定绘制顺序，选中高亮和叠加层透明度由渲染循环统一处理
- 关键决策：预设 JSON 用 ref 引用实体，PresetLoader 加载时映射为真实 EntityId
- 关键决策：事件检测器由求解器注册时提供，事件-动作映射可由预设 JSON 定义
- 两个全流程伪代码验证通过：斜面物块受力（解析解）、电磁感应单棒（RK4数值积分）

### 第4阶段（2026-03-17 完成）
- 预设Schema与视角层设计文档：`预设Schema与视角层设计.md`
- 8个设计模块，3个新增类型定义（PresetCatalog、PresetModuleGroup、PresetEntry、RealtimeValues）
- 关键决策：PresetData 新增 `version`（Schema版本号）、`displayConfig`（画布初始配置）2个字段（`level` 已在阶段7删除）
- 关键决策：category 直接使用 PRD 模块编号（P-01 ~ P-14），id 格式 `${模块号}-${模型ID}-${变体}`
- 关键决策：supportedViewports 由预设显式声明（教学设计决策），非技术能力自动推断
- 关键决策：切换主视角时清空叠加层+重置密度为standard，叠加层>2自动降为compact
- 关键决策：引入 relationType='none' 支持无关系的自由运动场景（如平抛）
- 关键决策：targetProperty 支持嵌套路径（`x.y` 格式），电路视角数据通过求解器在 PhysicsResult 上扩展 circuitData 字段提供
- 关键决策：toggle 联动 slider 显隐通过命名约定（`-toggle` / `-coeff` 后缀）实现，Phase 1 不需要 ParamLinkage 机制
- 3个完整预设 JSON 验证通过：斜面受力（力学解析解）、平抛运动（无关系场景）、洛伦兹力圆周（电磁域+select联动）

### 第5阶段 · 批次1（2026-03-17 完成）— 项目基础设施
- 子任务文档：`阶段5.1-项目基础设施.md`
- T1 项目初始化：Vite 6 + React 18 + TS strict + Tailwind 3 + pnpm，路径别名 `@/*`
- T2 Git 配置：修正 email 为 `1229412289@qq.com`，创建 `.gitignore`
- T3 Husky + ESLint + Prettier：`.eslintrc.cjs`（@typescript-eslint/recommended + react-hooks + prettier）、`.prettierrc`、pre-commit hook
- 设计系统迁移：`src/styles/` 从 design_guid 完整复制 5 个 token 文件 + `globals.css`；`src/lib/utils.ts` cn() 工具；`tailwind.config.ts` 适配项目路径
- 去掉 `@tailwindcss/typography`（Phase 1 不需要 Markdown 渲染）
- 验收通过：`pnpm dev` ready 394ms、`pnpm lint && pnpm tsc --noEmit` 零错误

### 第5阶段 · 批次2（2026-03-17 完成）— 设计系统 + 类型
- 子任务文档：`阶段5.2-设计系统与类型.md`
- T4 设计系统集成：从 design_guid/ui/ 迁移 8 个参数面板所需 UI 组件到 `src/components/ui/`（button, slider, select, input, label, switch, tabs, card）
- 迁移调整：导入路径 `@/lib/utils/cn` → `@/lib/utils`；移除 `"use client"` 指令；修复 3 个 strict 模式类型错误
- 未迁移的 14 个组件（Phase 1 不需要）：alert, badge, checkbox, dialog, markdown, pagination, popover, progress, progress-bar, Skeleton, table, textarea, toast, ExampleCard
- T5 core/types.ts：8个模块 51 个 TypeScript 接口/类型，单文件方案，`grep -c` 验证 export 数量 = 51
- 验收通过：`pnpm lint` 零错误、`pnpm tsc --noEmit` 零错误

### 第5阶段 · 批次3（2026-03-18 完成）— 核心模块
- 子任务文档：`阶段5.3-核心模块.md`
- T6 三大注册表：`src/core/registries/`（entity-registry + solver-registry + renderer-registry + index），全局单例 + createXxxRegistry() 工厂函数，Map 存储，重复注册 warn
- EntityRegistry：register/get/getByCategory/getAll/has，工厂函数包装自动生成 EntityId
- SolverRegistry：register/match/get/getAll，SolverPattern 结构化匹配（entityTypes + relationType + qualifier + 'none' 特殊值），按 priority 升序排序
- RendererRegistry：registerEntity/registerViewport/get*/getEntityRenderersSorted，RenderLayer 枚举排序
- T7 数学工具：`src/core/physics/`（vec2 + geometry + integrators + index）
- Vec2：10个纯函数（add/subtract/scale/dot/cross2D/magnitude/normalize/rotate/fromAngle/lerp）
- Geometry：3个 hit test 函数（pointInRect/pointInCircle/pointOnLine）
- Integrators：semiImplicitEuler + velocityVerlet，IntegratorState 接口
- T13 Zustand Store：`src/store/`（simulation-store + index）
- 4个状态字段（simulationState/paramValues/selectedEntityId/viewportState）
- 视角状态机：switchPrimaryViewport 清空叠加层+重置密度，toggleOverlayViewport 最多3层+自动降密度，叠加层>2禁止 detailed
- initFromPreset 供 PresetLoader 调用初始化
- 验收通过：`pnpm lint` 零错误、`pnpm tsc --noEmit` 零错误

### 第5阶段 · 批次4（2026-03-18 完成）— UI骨架 + 渲染Primitives
- 子任务文档：`阶段5.4-UI与渲染.md`
- T8 shell/ UI 骨架：`src/shell/`（App + MainLayout + ParamPanel + InfoPanel + CanvasContainer + TimelineBar + index），7个文件
- MainLayout：三栏 flex 布局（左260px + 中flex-1 + 右300px）+ 底部时间轴52px
- ParamPanel：schema 驱动渲染，按 group 分组，discriminated union 自动选择控件（Slider/Input/Toggle/Select），使用迁移的6个 UI 组件
- CanvasContainer：ResizeObserver 监听容器尺寸变化，devicePixelRatio 高分屏适配（canvas 物理尺寸 * dpr + ctx.scale(dpr, dpr)）
- TimelineBar：播放/暂停/重置按钮 + 进度条 + 时间显示，SimulationStatus 驱动按钮状态
- InfoPanel：骨架占位，阶段6填充视角数据
- 更新 `src/main.tsx` 引用 shell/App 替换临时占位
- T9 renderer/ primitives：`src/renderer/`（coordinate + render-loop + primitives/arrow + text-label + trail + shapes + index × 2），8个文件
- coordinate.ts：worldToScreen / screenToWorld（Y轴翻转）+ worldLengthToScreen 标量转换
- render-loop.ts：createRenderLoop 工厂函数，rAF 循环，按 RenderLayer 排序绘制实体，主视角 alpha=1 + 叠加视角 alpha=0.3，选中高亮虚线圆环
- primitives：drawArrow（箭头自动限制不超过向量40%）、drawTextLabel（可选背景）、drawTrail（fadeTail渐隐）、drawRect/drawCircle/drawLine
- 验收通过：`pnpm lint` 零错误、`pnpm tsc --noEmit` 零错误

### 第5阶段 · 批次5（2026-03-18 完成）— 引擎管道
- 子任务文档：`阶段5.5-引擎管道.md`
- T10 Simulator 运行循环骨架：`src/core/engine/simulator.ts`（createSimulator 工厂 + 全局 simulator 单例）
- ISimulator 接口：loadPreset/unload/play/pause/reset/seekTo/setPlaybackRate/updateParam/step/getState/getCurrentResult/on/off
- step 管道：计算有效dt → 推进时间 → 调用 SolverFunction → 执行 EventDetector → emit('frame')
- 解析解支持预计算（precompute），seekTo 用二分查找最近帧
- updateParam 支持嵌套属性路径（setNestedProperty），变更后重置时间线+重新求解 t=0
- 无求解器注册时使用 stub 求解器兜底
- T11 预设加载器：`src/core/engine/preset-loader.ts`（validatePreset + loadPreset）
- validatePreset：校验 ref 唯一性、类型已注册、关系引用合法、参数 targetEntityId 引用合法、defaultViewport 在 supportedViewports 中
- loadPreset 7步管道：校验 → 创建实体+ref映射 → 创建关系 → 替换paramGroups ref → 组装SceneDefinition → 匹配求解器 → 替换eventActions ref
- types.ts 新增10个类型：PresetEntityDef/PresetRelationDef/EventAction/EventActionMapping/PresetData/ValidationResult/SimulatorEvent/PhysicsEvent/SimulatorEventHandler
- `src/core/engine/index.ts` 统一导出
- 验收通过：`pnpm lint` 零错误、`pnpm tsc --noEmit` 零错误

### 第5阶段 · 批次6（2026-03-18 完成）— 收尾
- 子任务文档：`阶段5.6-收尾.md`
- T12 domains/ 目录骨架：`src/domains/mechanics/index.ts`（registerMechanicsDomain）+ `src/domains/em/index.ts`（registerEmDomain），`src/main.tsx` 中调用
- T14 CLAUDE.md 更新：附录F路径修正（`src/engine/` → `src/core/engine/`）+ 新增附录F2开发者目录归属声明（mechanics→开发者A，em→开发者B，其余→公共代码需协商）
- 域子目录（entities/solvers/renderers/viewports/presets/）不在本批创建，留到阶段6实现时按需创建
- 验收通过：`pnpm lint` 零错误、`pnpm tsc --noEmit` 零错误
- **阶段5全部6批次完成**

### 第6阶段（2026-03-18 完成）— 参考实现与端到端打通

**子任务 6.1：域注册（实体 + 求解器）**
- `src/domains/mechanics/entities/block.ts` — block 实体注册（type:'block', category:'object', hitTest用pointInRect）
- `src/domains/mechanics/entities/surface.ts` — surface 实体注册（type:'surface', category:'surface', hitTest用pointOnLine）
- `src/domains/mechanics/solvers/block-on-surface.ts` — 静力平衡求解器（G=mg↓, N=mg↑, 合力=0）
- `src/domains/mechanics/solvers/block-friction-deceleration.ts` — 摩擦减速求解器（解析解 v=v0-μgt, x=v0t-½μgt², 事件检测v=0时stop）

**子任务 6.2：渲染实现**
- `src/domains/mechanics/renderers/block-renderer.ts` — 物块渲染（圆角矩形，浅蓝填充深蓝边框，运动时跟随motionState位置）
- `src/domains/mechanics/renderers/surface-renderer.ts` — 水平面渲染（实线+底部斜线填充，教材风格）
- `src/domains/mechanics/viewports/force-viewport.ts` — 受力视角（力箭头+数值标注，对数映射长度，水平力标注在终点外侧）

**子任务 6.3：预设与集成**
- `src/domains/mechanics/presets/horizontal-block.json` — 静态预设（水平面物块受力，duration:0）
- `src/domains/mechanics/presets/friction-deceleration.json` — 动态预设（摩擦减速，duration:5，初速度3m/s，μ=0.3）
- `src/core/registries/preset-registry.ts` — 预设注册表（register/get/getAll/getByCategory/getCategories）
- `src/shell/pages/PresetGallery.tsx` — 预设选择首页（按域分类卡片网格）
- `src/shell/App.tsx` — 双页面路由（首页↔模拟器），URL hash持久化预设ID，独立rAF播放驱动
- `src/shell/timeline/TimelineBar.tsx` — 播放/暂停/重置同步simulator，静态场景禁用播放
- `src/shell/panels/InfoPanel.tsx` — 信息面板（受力表+运动状态，力类型中文名，合力关联说明）
- `src/shell/panels/ParamPanel.tsx` — 返回按钮，schema驱动参数面板
- `src/renderer/render-loop.ts` — extractViewportData从PhysicsResult提取视角数据，motionState临时位置更新
- `tsconfig.json` — 添加 resolveJsonModule
- `src/components/ui/slider.tsx` — 修复thumb阻塞拖拽（pointer-events:none）

**子任务 6.4：开发者指引**
- `docs/开发者指引.md` — 5步预设开发流程 + 代码模板 + API签名 + 斜面扩展说明

**关键设计决策**：
- 求解器 qualifier 必须精确匹配：静力平衡 `{surface:'horizontal', motion:'static'}` vs 摩擦减速 `{surface:'horizontal', motion:'friction-deceleration'}`，避免子集匹配歧义
- 预设注册机制：域 index.ts 调用 presetRegistry.register()，首页自动发现，新增预设不需改公共代码
- 播放驱动与渲染解耦：useEffect订阅status驱动simulator.step的独立rAF循环，render loop只负责绘制
- 信息面板为公共组件：读取 core/types 中的 ForceAnalysis/MotionState，不依赖域特有知识
- 合力展示：与某个独立力完全一致时不单独画箭头，面板中注明关联
- URL hash 持久化预设ID：刷新不丢失，支持浏览器前进/后退

**验收通过**：
- `pnpm lint && pnpm tsc --noEmit` 零错误
- `pnpm dev` Vite 编译成功
- 静态预设：物块+水平面+G/N力箭头+参数联动+信息面板
- 动态预设：摩擦减速动画+播放/暂停/重置+摩擦力箭头+运动状态实时更新
- **阶段6全部完成，架构设计任务交付**

### 第7阶段（2026-03-18 完成）— 发散审查
- 审查文档：`阶段7-发散审查.md`
- 需求基线：以 `docs/需求文档md/P物理教具产品线 · 产品需求文档.md` 为唯一权威来源
- Phase 1 范围澄清：~100 预设 + 6 视角层 + P0/P1 全部模块（非仅当前 2 个参考预设）
- 审查结果：36 项逐条审查，3 项删除 / 5 项保留 / 28 项核心必要
- 删除项：`ParamLinkage` 接口（零引用）、`PresetData.level` 字段（PRD 无预设难度分级）、PresetGallery level 标签
- 实现一致性修复：新增 `src/core/visual-constants.ts` 统一力颜色常量，修复 4 处力颜色偏离设计规范（含 resultant 色系完全错误：绿→紫）
- 关键决策：T13 渲染样式类型保留——Phase 1 将有大量渲染器，统一视觉语言映射有价值
- 验收通过：`pnpm lint && pnpm tsc --noEmit` 零错误
