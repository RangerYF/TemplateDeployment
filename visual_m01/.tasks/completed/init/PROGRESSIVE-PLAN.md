# 立体几何展示台 V1.0 渐进式开发计划

## 版本目标
高中数学老师打开浏览器，选择几何体、设置参数，即可得到可交互旋转的 3D 模型，支持顶点标注、坐标系、外接球、截面、展开图等教学辅助功能。

## 技术栈
- React 18 + TypeScript + Vite
- Three.js + @react-three/fiber + @react-three/drei
- Zustand（状态管理）
- Tailwind CSS + 已有 EduMind 设计系统

## 设计资产（design_guid/）

已有完整的 EduMind 设计系统，统一存放在 `design_guid/` 目录：

```
design_guid/
├── DESIGN_SYSTEM_GUIDE.md      # 设计系统移植指南（使用方法详见此文档）
├── tailwind.config.ts           # Tailwind 配置（eduMind 命名空间色板）
├── styles/                      # Design Tokens
│   ├── tokens.ts                # 核心 token：COLORS(#00C06B), RADIUS, SHADOWS
│   ├── colors.ts                # Tailwind 色板(#32D583) + 工具函数
│   ├── typography.ts            # 字体层级、文本颜色、组件排版预设
│   ├── spacing.ts               # 8px 网格间距系统
│   └── index.ts                 # 统一导出入口
└── ui/                          # 22 个预制 UI 组件（可按需引入 src/）
    ├── button.tsx               # 按钮（default/outline/ghost/link）
    ├── input.tsx                # 文本输入框
    ├── slider.tsx               # 滑块（参数调节可直接复用）
    ├── select.tsx               # 下拉选择
    ├── switch.tsx               # 开关
    ├── tabs.tsx                 # 标签页
    ├── dialog.tsx               # 弹窗
    ├── card.tsx                 # 卡片容器
    ├── badge.tsx                # 徽章/标签
    ├── label.tsx                # 表单标签
    ├── checkbox.tsx             # 复选框
    ├── textarea.tsx             # 多行输入
    ├── popover.tsx              # 气泡弹出层
    ├── alert.tsx                # 提示信息
    ├── toast.tsx                # Toast 通知
    ├── progress.tsx             # 进度条
    ├── progress-bar.tsx         # PDF 下载进度
    ├── pagination.tsx           # 分页
    ├── table.tsx                # 数据表格
    ├── markdown.tsx             # Markdown + KaTeX 渲染
    ├── Skeleton.tsx             # 骨架屏
    └── ExampleCard.tsx          # 示例卡片
```

**关键依赖**：所有 UI 组件依赖 `cn()` 工具函数（clsx + tailwind-merge）和 `@/styles/tokens`。
项目初始化时需安装：`class-variance-authority clsx tailwind-merge lucide-react`。

**本项目高频复用组件**：Button、Input、Slider、Select、Switch、Tabs、Dialog、Label、Badge。

## 开发策略：混合推进（策略C）

采用 **"先纵向打通代表几何体，再横向铺开"** 的混合策略：

1. 选取 **长方体**（多面体代表）和 **圆锥**（曲面体代表）作为先导几何体
2. 用这两个代表跑通 Builder → 渲染 → 标注 → 计算 → 高级功能 的全链路
3. 验证架构设计能同时适配多面体和曲面体后，再横向铺开剩余 4 种几何体

**为什么选这两个**：
- **长方体**：8 顶点 / 12 棱 / 6 面，标注/截面/展开图/三视图场景最丰富，是多面体最全面的代表
- **圆锥**：参数化曲面、展开图是扇形、无传统棱线，与多面体完全不同，能充分验证架构通用性

## 开发流程总览
```
阶段1:  工程骨架 + 布局 + 空3D画布                              ✅ 已完成
  → 阶段2A: Builder架构 + 长方体&圆锥（验证架构）              ✅ 已完成
    → 阶段2B: 铺开剩余4种几何体（棱锥/正方体/圆柱/球）        ✅ 已完成
      → 阶段3:  标注与交互（几何体通用，不拆分）               ✅ 已完成
        → 阶段4A: 数学计算引擎（长方体&圆锥验证）             ✅ 已完成
          → 阶段4B: 铺开剩余几何体计算                        ✅ 已完成
            → 阶段5A: 高级功能（长方体&圆锥验证）             ✅ 已完成
              → 阶段5B: 铺开剩余几何体高级功能                ✅ 已完成
                → 阶段6:  体验打磨与适配                      🔄 T6.4待执行
                  → 阶段7:  交互增强与显示优化（需求补充）
                    → 阶段8:  撤销重做（需求补充）
```

## 串行执行阶段

---

### 第1阶段：工程初始化与布局骨架 ✅ 已完成

**目标**：跑通 Vite+React+R3F 全链路，完成页面布局骨架，3D 画布能渲染一个占位立方体并支持鼠标旋转。

**主要任务**：
1. Vite 项目初始化，配置 TypeScript、Tailwind、路径别名（@/）
2. 从 `design_guid/` 移植设计系统到 `src/`：拷贝 styles/ → `src/styles/`，按需拷贝 ui/ 组件 → `src/components/ui/`，创建 `src/lib/utils/cn.ts`
3. 基于 `design_guid/tailwind.config.ts` 配置项目的 tailwind.config.ts（更新 content 路径指向 src/）
4. 安装依赖：three、@react-three/fiber、@react-three/drei、zustand、class-variance-authority、clsx、tailwind-merge、lucide-react
5. 搭建主布局：TopBar（几何体类型选择区）+ LeftPanel（控制面板）+ 中央 3D Canvas，使用 design_guid 中的 UI 组件
6. 3D Canvas 集成 OrbitControls，渲染一个占位立方体线框验证管线
7. 创建 Zustand store 基础结构（几何体类型、参数）

**本阶段产出**：
可运行的项目骨架 + 完整布局 + 3D 渲染管线验证通过。

**完成时间**：2026-03-04

---

### 第2A阶段：Builder 架构 + 长方体 & 圆锥（验证架构）

**目标**：设计 Builder 通用输出接口，实现长方体和圆锥的构建与渲染，跑通参数 → 3D 模型的完整数据流。本阶段重点是 **验证架构设计能同时适配多面体和曲面体**。

**主要任务**：
1. 设计 Builder 通用输出接口 `BuilderResult`：
   - 多面体输出：顶点坐标数组 + 面索引 + 棱线索引 + 默认顶点标签
   - 曲面体输出：Three.js BufferGeometry 参数 + 母线/轮廓线 + 特征点（顶点/圆心等）
   - 统一渲染协议：无论多面体还是曲面体，渲染组件都能通过同一接口获取所需数据
2. 实现长方体 Builder（多面体代表）：
   - 输入：长、宽、高
   - 输出：8 顶点坐标 + 6 面索引 + 12 棱线索引 + 默认标签（A/B/C/D/A₁/B₁/C₁/D₁）
3. 实现圆锥 Builder（曲面体代表）：
   - 输入：底面半径、高
   - 输出：顶点坐标（顶点 + 底面圆心）+ 曲面几何参数 + 母线参数
4. 实现参数面板（ParameterPanel），根据几何体类型动态渲染输入控件
5. 实现 3D 渲染组件：
   - GeometryRenderer：根据 BuilderResult 类型分发渲染（多面体用面索引，曲面体用 BufferGeometry）
   - EdgeRenderer：多面体棱线 / 曲面体母线
   - VertexLabels：顶点标签（HTML overlay）
6. 实现 `useGeometryBuilder` hook：连接 store → builder → renderer 的数据流
7. 渲染风格：半透明面 + 实线棱边 + 默认顶点标签

**涉及文件范围**：
- `src/engine/types.ts` - Builder 通用输出接口定义
- `src/engine/builders/cuboid.ts` - 长方体 Builder
- `src/engine/builders/cone.ts` - 圆锥 Builder
- `src/engine/builders/index.ts` - Builder 注册表
- `src/components/panels/ParameterPanel.tsx` - 参数输入面板
- `src/components/scene/GeometryRenderer.tsx` - 几何体 3D 渲染
- `src/components/scene/VertexLabels.tsx` - 顶点标签渲染
- `src/components/scene/EdgeRenderer.tsx` - 棱线/母线渲染
- `src/hooks/useGeometryBuilder.ts` - 连接 store 和 builder 的 hook
- `src/store/useGeometryStore.ts` - 扩展 store
- `src/components/layout/LeftPanel.tsx` - 集成参数面板
- `src/components/scene/Scene3D.tsx` - 集成几何体渲染

**验收标准**：
- [ ] 点击 TopBar "长方体" 按钮，中央显示半透明面 + 棱线 + 8 个顶点标签的长方体
- [ ] 点击 TopBar "圆锥" 按钮，中央显示半透明面 + 母线 + 特征点标签的圆锥
- [ ] 修改参数面板数值，3D 模型实时更新（无需点确认）
- [ ] 长方体默认标签为 A/B/C/D（底面）、A₁/B₁/C₁/D₁（顶面）
- [ ] Builder 输出接口能适配两类几何体，渲染组件通过统一协议工作
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**架构验证要点**：
本阶段结束时，需确认以下架构决策成立：
1. `BuilderResult` 接口能否同时表达多面体和曲面体？
2. 渲染组件是否真正通用，还是需要 if/else 分支？
3. 顶点标签系统对曲面体（只有少数特征点）是否自然适配？
4. Store 结构是否需要调整？

如有架构问题，在此阶段修正代价最小。

**本阶段产出**：
经过验证的 Builder 架构 + 长方体、圆锥两种几何体的完整构建与渲染能力。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第2B阶段：铺开剩余 4 种几何体

**目标**：基于 2A 验证通过的架构，快速铺开棱锥、正方体、圆柱、球的 Builder 与渲染。

**主要任务**：
1. 实现棱锥 Builder：
   - 输入：底面边数（3~8）、底面边长、高
   - 输出：n+1 顶点 + 面索引 + 棱线索引 + 默认标签（P + A/B/C/...）
2. 实现正方体 Builder：
   - 输入：边长
   - 输出：复用长方体 Builder（length=width=height=sideLength）或独立实现
3. 实现圆柱 Builder：
   - 输入：底面半径、高
   - 输出：类似圆锥的曲面体协议
4. 实现球 Builder：
   - 输入：半径
   - 输出：曲面几何参数 + 经纬线参数（球面半透明 + 经纬线渲染）
5. 扩展参数面板：支持棱锥的底面边数选择（3~8）
6. 如 2A 架构验证中发现需要调整的问题，在此阶段修正

**涉及文件范围**：
- `src/engine/builders/pyramid.ts` - 棱锥 Builder
- `src/engine/builders/cube.ts` - 正方体 Builder
- `src/engine/builders/cylinder.ts` - 圆柱 Builder
- `src/engine/builders/sphere.ts` - 球 Builder
- `src/engine/builders/index.ts` - 更新 Builder 注册表
- `src/components/panels/ParameterPanel.tsx` - 扩展参数面板

**验收标准**：
- [ ] 6 种几何体全部可选择、可渲染、可调参
- [ ] 棱锥支持 3~8 棱锥切换，标签自动扩展
- [ ] 球体渲染为半透明球面 + 经纬线
- [ ] 所有几何体的面半透明、棱线/轮廓线清晰、特征点标签可见
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
6 种几何体的完整构建与渲染能力。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第3阶段：标注与交互

**目标**：老师可以双击改顶点名、选线段命名、在边上取点、拖拽顶点调整位置。

**为什么不拆分**：标注系统操作的是 Builder 输出的顶点/棱线数据结构。只要 2A 阶段的 BuilderResult 接口设计合理，标注逻辑对所有几何体通用。球体/圆锥/圆柱的少数特征点也能自然融入同一套标注系统。

**主要任务**：
1. 顶点标签双击编辑：双击标签进入输入状态，支持任意文字（P、Q、A₁、B₁等）
2. 线段选中与命名：点击两个顶点选中线段 → 弹出输入框 → 名字显示在线段中点附近
3. 边上取点：选中边后点击"取中点"按钮自动添加中点；点击边上任意位置取自由点，可沿边滑动
4. 顶点拖拽：按住顶点可拖动，关联线段和面自动更新
5. 选中状态高亮：选中的顶点/线段有明显高亮反馈

**涉及文件范围**：
- `src/components/scene/InteractionHandler.tsx` - 点击/选中/拖拽交互
- `src/components/scene/VertexLabels.tsx` - 扩展：双击编辑
- `src/components/scene/EdgeRenderer.tsx` - 扩展：选中高亮 + 中点标签
- `src/components/panels/LabelingTools.tsx` - 标注工具面板
- `src/store/useGeometryStore.ts` - 扩展：标注数据、选中状态、自定义点
- `src/hooks/useInteraction.ts` - 交互逻辑 hook（raycasting、拖拽）
- `src/types/scene.ts` - 交互相关类型

**验收标准**：
- [ ] 双击顶点标签可修改为任意文字，修改后 3D 模型立即显示新名字
- [ ] 点击两个顶点可选中线段，输入名字后显示在线段中点
- [ ] 选中边后可取中点，中点可命名，中点与两端自动连线
- [ ] 按住顶点可拖动，所有关联几何元素跟随更新
- [ ] 选中元素有明显高亮效果
- [ ] 以上功能在长方体和圆锥上均验证通过

**本阶段产出**：
完整的标注与交互能力。老师可以将 3D 模型"教学化"——加上数学符号和名字标注。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第4A阶段：数学计算引擎（长方体 & 圆锥验证）

**目标**：实现计算引擎核心架构，用长方体和圆锥验证体积/表面积/坐标系/外接球的完整链路。

**主要任务**：
1. 设计计算引擎通用接口：输入 GeometryType + params → 输出体积、表面积（精确值 + 数值近似）
2. 实现精确值格式化引擎：支持根号、分数、π 等符号形式展示
3. 实现长方体的体积/表面积公式（V=lwh, S=2(lw+lh+wh)）
4. 实现圆锥的体积/表面积公式（V=πr²h/3, S=πr²+πrl，l=√(r²+h²)）
5. 右下角实时显示 S = ___、V = ___，参数变化自动更新
6. 点击数值可查看计算步骤
7. 坐标系功能：选择顶点作为原点 → 生成 XYZ 轴 + 刻度 → 各顶点显示坐标值
8. 外接球：长方体外接球计算与渲染（R = √(l²+w²+h²)/2）
9. 外接圆：选 3 个顶点 → 在所在平面画外接圆 + 显示半径

**涉及文件范围**：
- `src/engine/math/volume.ts` - 体积公式（长方体 + 圆锥）
- `src/engine/math/surfaceArea.ts` - 表面积公式（长方体 + 圆锥）
- `src/engine/math/symbolicFormat.ts` - 精确值格式化（根号/分数/π 数据结构）
- `src/engine/math/circumscribedSphere.ts` - 外接球求解（长方体）
- `src/engine/math/circumscribedCircle.ts` - 外接圆求解（3 点定圆，通用）
- `src/engine/math/coordinates.ts` - 坐标系变换
- `src/components/info/MeasurementDisplay.tsx` - 右下角体积/表面积显示
- `src/components/info/CalcStepsModal.tsx` - 计算步骤弹窗
- `src/components/scene/CoordinateAxes.tsx` - 坐标轴渲染
- `src/components/scene/CircumSphere.tsx` - 外接球渲染
- `src/components/scene/CircumCircle.tsx` - 外接圆渲染
- `src/components/panels/AuxiliaryTools.tsx` - 辅助功能面板

**验收标准**：
- [ ] 长方体：右下角显示 V 和 S，参数变化实时更新，数值正确
- [ ] 圆锥：体积和表面积含 π 的精确值显示正确
- [ ] 点击数值弹出计算步骤
- [ ] 建立坐标系后各顶点显示坐标值，坐标轴有刻度
- [ ] 长方体外接球半径与手算一致
- [ ] 选 3 个顶点做外接圆，圆渲染在正确平面上，半径正确
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**架构验证要点**：
1. 精确值格式化引擎是否能同时表达 π、√、分数及其组合？
2. 计算步骤的数据结构是否通用？
3. 外接球接口对曲面体是否适用（圆锥有外接球吗）？

**本阶段产出**：
经过验证的计算引擎架构 + 长方体、圆锥的完整计算与辅助可视化能力。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第4B阶段：铺开剩余几何体计算

**目标**：将计算能力扩展到全部 6 种几何体。

**主要任务**：
1. 棱锥体积/表面积（正 n 棱锥解析公式）
2. 正方体体积/表面积（可复用长方体公式）
3. 圆柱体积/表面积（V=πr²h, S=2πr²+2πrh）
4. 球体积/表面积（V=4πr³/3, S=4πr²）
5. 各几何体的外接球计算（适用的）
6. 各几何体的计算步骤模板

**涉及文件范围**：
- `src/engine/math/volume.ts` - 扩展全部几何体
- `src/engine/math/surfaceArea.ts` - 扩展全部几何体
- `src/engine/math/circumscribedSphere.ts` - 扩展全部几何体

**验收标准**：
- [ ] 6 种几何体均有正确的体积和表面积计算
- [ ] 正四面体体积显示精确值 √2/12 × a³
- [ ] 外接球半径计算结果与手算一致（正四棱锥验证）
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
全部 6 种几何体的数学计算能力。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第5A阶段：高级功能（长方体 & 圆锥验证）

**目标**：实现高级功能核心架构，用长方体和圆锥验证自定义线段、截面、展开图、三视图的完整链路。

**主要任务**：
1. 自定义线段：选两点创建线段，可选颜色和虚实线型，可计算线段长度
2. 截面功能（长方体）：选择若干点定义切面 → 渲染截面 → 计算截面面积
3. 展开图（长方体）：将 6 个面展开为十字形 2D 平面图
4. 展开图（圆锥）：展开为扇形 2D 图（验证曲面体展开算法）
5. 三视图：生成正视图、俯视图、侧视图的正交投影
6. 导出功能：三视图和展开图支持下载为图片

**涉及文件范围**：
- `src/components/scene/CustomSegment.tsx` - 自定义线段渲染
- `src/engine/math/crossSection.ts` - 截面计算（平面与棱的交点）
- `src/components/scene/CrossSection.tsx` - 截面 3D 渲染
- `src/engine/unfolding/unfold.ts` - 展开图算法（多面体 + 圆锥）
- `src/components/views/UnfoldingPanel.tsx` - 展开图 2D 渲染
- `src/components/views/ThreeViewPanel.tsx` - 三视图渲染
- `src/components/panels/AuxiliaryTools.tsx` - 扩展：截面/展开图/三视图按钮
- `src/utils/exportImage.ts` - 图片导出工具

**验收标准**：
- [ ] 选两点可创建自定义线段，颜色和虚实可选，长度可显示
- [ ] 长方体截面可正确渲染并计算面积
- [ ] 长方体展开图正确生成十字形
- [ ] 圆锥展开图正确生成扇形
- [ ] 三视图（正视/俯视/侧视）对长方体和圆锥正确渲染
- [ ] 三视图和展开图可下载为 PNG 图片
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**架构验证要点**：
1. 截面算法对多面体（平面与棱求交）和曲面体（平面与曲面求交）是否需要不同策略？
2. 展开图算法对两类几何体的通用性如何？
3. 三视图的正交投影是通用的，不需要按几何体分别实现。

**本阶段产出**：
经过验证的高级功能架构 + 长方体、圆锥的截面/展开图/三视图能力。

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第5B阶段：铺开剩余几何体高级功能 ✅ 已完成

**目标**：将高级功能扩展到剩余几何体。

**主要任务**：
1. 棱锥截面 + 展开图
2. 正方体截面 + 展开图（可复用长方体逻辑）
3. 圆柱展开图（侧面展开为矩形）
4. 球的截面（大圆/小圆）
5. 适配各几何体的三视图细节（如有差异）

**验收标准**：
- [x] 棱锥截面可正确渲染并计算面积
- [x] 正方体/棱锥展开图正确生成
- [x] 圆柱展开图正确生成（侧面矩形 + 两个底面圆）
- [x] 所有支持的展开图和三视图可下载为 PNG
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

**本阶段产出**：
全部功能清单覆盖完成。

**完成时间**：2026-03-06

---

### 第6阶段：体验打磨与适配

**目标**：视角快捷操作、触屏适配、整体 UI 打磨，达到可交付给老师使用的品质。

**主要任务**：
1. 视角快捷按钮：重置视角 + 正视图/俯视图/侧视图一键切换
2. 触屏适配：平板单指旋转、双指缩放
3. UI 细节打磨：按钮尺寸（老师友好）、字体≥14px、操作反馈、高亮效果
4. 投影仪适配：1080p 下文字和模型清晰可辨
5. 整体功能回归测试，修复遗留问题

**涉及文件范围**：
- `src/components/scene/ViewControls.tsx` - 视角快捷按钮
- `src/components/scene/Scene3D.tsx` - 扩展：触屏事件支持
- 各组件 - UI 尺寸/字体/间距微调（基于 design_guid 中的 design tokens）

**验收标准**：
- [x] 点击"重置视角"回到默认角度，正/俯/侧视图按钮正确切换
- [x] 平板触屏操作流畅（单指旋转、双指缩放）
- [x] 所有按钮和文字在 1080p 投影仪上清晰可辨
- [ ] 一位非技术用户 5 分钟内能独立制作"正四棱锥，底面边长4，高3，顶点标P、A、B、C、D"

**本阶段产出**：
可交付的 V1.0 产品。

**执行进度（2026-03-06）**：
- [x] T6.1: 外接球 UI 限制修复
- [x] T6.2: 默认视角下移
- [x] T6.3: 标注工具默认展开
- [ ] T6.4: 交互优化（待独立会话执行）
- [x] T6.5: 视角快捷按钮（重置/正视/俯视/侧视 + lerp 动画）
- [x] T6.6: 触屏适配
- [x] T6.7: UI 细节打磨（全面 ≥14px）
- [x] T6.8: 回归验证（tsc + lint + build 通过）
- [x] 追加: 棱锥底面边数参数（sides 滑块 3~8）
- [x] 追加: 坐标系拖拽实时更新

---

### 第7阶段：交互增强与显示优化（需求补充）

**目标**：提升线段/面的交互体验（hover 高亮、面选中、面上取点），优化体积表面积的显示逻辑。

**来源**：产品经理演示后反馈，详见 `docs/需求补充.md`

**主要任务**：
1. 线段/面 hover 高亮：鼠标悬停时高亮目标线段或面
2. 面选中态：左键点击面进入选中态，新增 `SelectionTarget` face 类型
3. 面右键菜单：右键点击面出现菜单（与棱线/顶点右键菜单对齐）
4. 面上取点：支持在面上取任意点（新增 `FaceCustomPoint` 类型）
5. 体积表面积显示优化：
   - 卡片上直接加说明文字
   - 仅含 π 时展示公式，其他情况只展示最终结果数值
   - 点击展示计算过程（已有 CalcStepsModal，需调整触发方式）

**涉及文件范围**：
- `src/components/scene/GeometryRenderer.tsx` — 面 hover/选中渲染
- `src/types/scene.ts` — 新增 face SelectionTarget/ContextMenuTarget
- `src/hooks/useInteraction.ts` — 面选中/hover 逻辑
- `src/components/scene/ContextMenu3D.tsx` — 面右键菜单
- `src/components/info/MeasurementDisplay.tsx` — 显示逻辑优化
- `src/store/useGeometryStore.ts` — hover 状态、face 选中

**验收标准**：
- [ ] 鼠标悬停棱线/面时有高亮反馈
- [ ] 左键点击面可选中，选中态有视觉区分
- [ ] 右键点击面弹出菜单，支持在面上取点
- [ ] 面上取的点可作为线段端点、截面定义点
- [ ] 体积表面积卡片：含 π 显示公式，不含 π 仅显示数值
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

### 第8阶段：撤销重做（需求补充）

**目标**：实现 Ctrl+Z 撤销 / Ctrl+Y 重做功能，覆盖用户对几何体的所有操作。

**来源**：产品经理演示后反馈，详见 `docs/需求补充.md`

**主要任务**：
1. 设计 undo/redo 状态管理架构（Zustand temporal middleware 或自建 command pattern）
2. 确定哪些状态纳入历史记录（标注编辑、自定义点、自定义线段、截面点、参数修改等）
3. 实现 Ctrl+Z / Ctrl+Y 键盘快捷键绑定
4. 可选：工具栏撤销/重做按钮
5. 边界处理：历史栈上限、几何体切换时清空历史

**涉及文件范围**：
- `src/store/useGeometryStore.ts` — undo/redo middleware 集成
- `src/hooks/useKeyboardShortcuts.ts` — 键盘快捷键
- 可选 UI 按钮

**验收标准**：
- [ ] Ctrl+Z 可撤销上一步操作（标注编辑、取点、画线段等）
- [ ] Ctrl+Y 可重做已撤销的操作
- [ ] 连续多次撤销/重做正确
- [ ] 切换几何体类型后历史栈清空
- [ ] `pnpm lint && pnpm tsc --noEmit` 通过

**注意**：具体实现细节将在执行本阶段时另建子任务文档详细规划

---

## 当前焦点

**V0.3 阶段4.1 已完成**（2026-03-10）：扩展几何体（圆台/棱台/等腰四面体/正交四面体）
**V0.3 阶段3**：坐标系重构 — 待启动

**5A 子任务拆分**（按 VERSION-PLANNING-GUIDE 规则，5A 整体约 8 天，超出 2-5 天窗口）：
- [x] 5A-1: 自定义线段与截面（~3天）— 详见 `5A-1-自定义线段与截面.md` ✅ 已完成
- [x] 5A-2: 展开图（~3天）— 详见 `5A-2-展开图.md` ✅ 已完成
- [x] 5A-3: 三视图与导出（~2天）— 详见 `5A-3-三视图与导出.md` ✅ 已完成

**阶段4A已完成**：
- [x] T4A.1 计算引擎类型定义 + 注册表
- [x] T4A.2 精确值格式化工具（symbolic.ts）
- [x] T4A.3 长方体体积/表面积计算器
- [x] T4A.4 圆锥体积/表面积计算器
- [x] T4A.5 KaTeX + TeX 组件
- [x] T4A.6 MeasurementDisplay 右下角浮层
- [x] T4A.7 CalcStepsModal 计算步骤弹窗
- [x] T4A.8 坐标系功能（坐标轴 + 顶点坐标值）
- [x] T4A.9 外接球（长方体/正方体）
- [x] T4A.10 外接圆（三点定圆通用算法）
- [x] T4A.11 辅助功能面板（AuxiliaryTools）
- [x] T4A.12 回归验证 + 3轮共11个bug修复

**阶段3已完成**：
- [x] T3.1 交互类型定义 + Store 扩展
- [x] T3.2 顶点标签双击编辑
- [x] T3.3 选中状态与高亮
- [x] T3.4 线段命名
- [x] T3.5 边上取点（中点/n等分）
- [x] T3.6 顶点拖拽（仅多面体）✅ 已修复稳定性 bug
- [x] T3.7 集成与参数变化重置
- [x] T3.8 回归验证（lint + tsc + build 通过）
- [x] T3.1子任务：右键菜单 + 曲面体取点 ✅ 已完成
- [x] T3.2子任务：遗留 bug 修复（棱线标签遮挡 + 拖拽不稳定）✅ 已完成

## 阶段检查点

| 阶段 | 检查项 | 状态 |
|------|--------|------|
| 1 | 项目可运行 + 布局 + 3D 旋转 | ✅ |
| 2A | Builder 架构 + 长方体&圆锥构建渲染 | ✅ |
| 2B | 剩余 4 种几何体铺开 | ✅ |
| 3 | 标注编辑 + 顶点拖拽 | ✅ 全部完成（含 3.1 交互优化 + 3.2 bug 修复） |
| 4A | 数学计算引擎 + 长方体&圆锥验证 | ✅ 全部完成（含3轮共11个bug修复） |
| 4B | 剩余几何体计算铺开 | ✅ 全部完成（含2个坐标系bug修复） |
| 5A | 高级功能 + 长方体&圆锥验证 | ✅ 5A-1 ✅, 5A-2 ✅, 5A-3 ✅ 全部完成 |
| 5B | 剩余几何体高级功能铺开 | ✅ 已完成 — 详见 `5B-高级功能铺开.md` |
| 6 | 触屏/视角/UI打磨/交付 | 🔄 T6.4待执行，其余已完成 |
| 7 | 交互增强与显示优化（需求补充） | ⬜ |
| 8 | 撤销重做（需求补充） | ⬜ |
| V0.2 | 编辑器架构重构（阶段1-8） | ✅ 已完成 |
| V0.3-1 | 基础完善（截面法线翻转/外接球UI/视觉统一） | ✅ 已完成 |
| V0.3-2 | 交互增强（hover高亮/面选中/拖拽/画线优化） | ✅ 已完成 |
| V0.3-2.1 | 曲面体交互补全 + 遮挡面选择 | ✅ 已完成（2026-03-10） |
| V0.3-4 | 新几何体（正四面体/墙角四面体/正棱柱） + 选择器分类 | ✅ 已完成（2026-03-10） |
| V0.3-4.1 | 扩展几何体（圆台/棱台/等腰四面体/正交四面体） | ✅ 已完成（2026-03-10） |
| V0.3-3 | 坐标系重构（选面定Z轴） | ⬜ 待启动 |

## 暂时不考虑
- 自然语言 / LLM Agent 入口（需求文档明确 V1 不接入）
- 用户账号体系 / 数据持久化
- 多人协作 / 分享功能
- 后端服务 / API
- 国际化
- 单元测试（开发阶段以验收标准手动验证为主）

## 开发笔记
- 设计系统源文件统一存放在 `design_guid/`，开发时移植到 `src/` 中使用
- 两套色彩 token 并存：`tokens.ts` 主色 #00C06B（UI 组件 inline style 用），`colors.ts` 主色 #32D583（Tailwind 类名用），详见 `design_guid/DESIGN_SYSTEM_GUIDE.md`
- 主色调以 #00C06B 为准（对齐需求文档要求）
- UI 组件依赖 `cn()` 工具函数（clsx + tailwind-merge），需在 `src/lib/utils/cn.ts` 中创建
- 最终交付为标准前端工程，不约束为单 HTML
- 数学计算需确保精度：外接球半径、体积等需与手算一致
- 展开图算法对曲面几何体（圆锥/圆柱）复杂度较高，阶段 5A 用圆锥先验证
- **策略C决策记录（2026-03-05）**：采用混合推进策略，先用长方体（多面体）+ 圆锥（曲面体）纵向打通全链路验证架构，再横向铺开剩余几何体。标注系统（阶段3）因操作的是通用的顶点/棱线数据结构，不需要拆分。
- **2A架构验证结论（2026-03-05）**：BuilderResult 判别联合（polyhedron/surface）设计成功验证。2B 铺开只需新建 builder 文件并注册到 builders map，ParameterPanel 已预配置所有 6 种几何体参数。Slider 组件 Thumb div 需 pointerEvents:'none' 防止拦截拖拽事件（已修复）。
- **2B完成记录（2026-03-05）**：4 种几何体 Builder 铺开完成（pyramid/cube/cylinder/sphere）。默认参数调优：高度统一为 2，球半径为 1。
- **阶段3主体完成记录（2026-03-05）**：标注与交互系统 T3.1-T3.8 全部实现。新建文件：`src/types/scene.ts`、`src/components/scene/VertexLabels.tsx`、`src/hooks/useInteraction.ts`、`src/components/panels/LabelingTools.tsx`。重度修改：`GeometryRenderer.tsx`（新增 EdgeLabels/EdgeNameInput/CustomPointsRenderer/CustomPointLabel/DragHandles 5个子组件）。经历2轮 bug 修复共7个 bug，修复5个，遗留2个（棱线标签遮挡中点、拖拽事件竞争）。发现新需求：曲面体无法取点，需引入右键菜单交互模型。遗留问题分别归入 3.1（交互优化）和 3.2（bug修复）子任务文档。
- **自定义线段/面决策（2026-03-05）**：用户提出需要"连线"和"创建新面"能力。决策：推迟到阶段5A实现，3.1保持原定范围。交互方案确定为工具栏模式切换（非右键菜单），需设计统一点引用系统（PointRef）。详细设计草案记录在 3.1 任务文档中。
- **3.1交互优化完成记录（2026-03-05）**：右键菜单 + 曲面体取点全部实现。新建3个文件（LineHitboxes.tsx、ContextMenu3D.tsx、curveProjection.ts），修改5个文件。CustomPoint 改为判别联合（EdgeCustomPoint | CurveCustomPoint），支持棱线和曲线上取点。棱线用 CylinderGeometry hitbox，曲线用 TubeGeometry hitbox。OrbitControls 右键平移改为中键平移。LabelingTools 面板操作按钮迁移到右键菜单。lint + tsc + build 全部通过。
- **3.2 bug修复完成记录（2026-03-05）**：2个遗留 bug 全部修复。BUG-2（拖拽不稳定）：删除 DragHandles 不可见球体组件，拖拽逻辑统一到 VertexLabel HTML 元素的 onPointerDown + window 级 move/up，彻底消除 Three.js 事件与 DOM 事件竞争。BUG-1（标签遮挡）：EdgeLabels 移除 3D 叉积偏移，改用 CSS translateY(-18px) 固定像素偏移。lint + tsc 通过。阶段3全部完成。
- **4A完成记录（2026-03-05）**：数学计算引擎全部实现。新增16个文件：types.ts、index.ts、symbolic.ts、cuboid.ts(calc)、cone.ts(calc)、coordinates.ts、circumscribedSphere.ts、circumscribedCircle.ts、TeX.tsx、MeasurementDisplay.tsx、CalcStepsModal.tsx、CoordinateAxes.tsx、CircumSphere.tsx、CircumCircle.tsx、AuxiliaryTools.tsx。修改5个文件：useGeometryStore.ts、Scene3D.tsx、GeometryRenderer.tsx、useInteraction.ts、LeftPanel.tsx。新增依赖：katex + @types/katex。经历3轮用户测试反馈共11个bug，全部修复。核心经验：R3F `<Html>` 组件 z-index 极高（~16M），覆盖层需用 createPortal + z-index 99999999；Html 默认拦截 pointer events，需设 `pointerEvents: 'none'`；坐标系轴方向不应强制右手系，教学场景需保证邻接顶点坐标为正。
- **4B完成记录（2026-03-05）**：剩余4种几何体计算器铺开完成。新增4个文件：pyramid.ts、cube.ts、cylinder.ts、sphere.ts（均在 src/engine/math/calculators/）。修改2个文件：index.ts（注册4个计算器）、circumscribedSphere.ts（扩展pyramid/cylinder/cone外接球）。修复2个坐标系bug：(1) 棱锥点击顶点崩溃（CUBOID_ADJACENCY越界，增加边界检查）；(2) 棱锥坐标系轴不正交（新增buildPyramidCoordinateSystem，用Gram-Schmidt正交化）。另修改coordinates.ts。lint + tsc + build 全部通过，手算验证全部通过。
- **5A-1完成记录（2026-03-05）**：自定义线段与截面功能全部实现。新增4个文件：pointRef.ts（PointRef 统一点引用 + resolvePointRef 坐标解析）、CustomSegments.tsx（线段渲染）、crossSection.ts（截面算法：平面与棱求交 + 角度排序 + 面积计算）、CrossSection.tsx（半透明截面渲染 + 面积标签）。修改6个文件：scene.ts（PointRef/CustomSegment/DrawingMode 类型）、useGeometryStore.ts（segments/crossSection/drawingMode 状态）、useInteraction.ts（画线/截面模式点击 + selectCustomPoint）、AuxiliaryTools.tsx（画线/截面按钮 + 线段管理列表 + 5色/虚实切换）、Scene3D.tsx（集成新组件）、GeometryRenderer.tsx（CustomPointLabel 增加 onPointClick）。另修改 LeftPanel.tsx：PanelSection 改为可折叠，辅助功能区提升至第二位。截面手算验证：长方体(3,2,2)对角截面面积 = 2√13 ≈ 7.21。lint + tsc + build 全部通过。
- **5A-2完成记录（2026-03-06）**：展开图功能全部实现。新增5个文件：cuboidUnfold.ts（长方体十字形展开，底面居中）、coneUnfold.ts（圆锥扇形展开）、unfolding/index.ts（展开图注册表）、UnfoldingPanel.tsx（SVG 渲染面板，支持缩放/平移/PNG导出）、exportImage.ts（SVG→PNG 导出）。修改7个文件：AppLayout.tsx（三栏布局：3D场景|展开图|右侧面板）、LeftPanel.tsx（重命名为 RightPanel，移到右侧）、TopBar.tsx（选项居中）、MeasurementDisplay.tsx（移至3D场景右上角）、AuxiliaryTools.tsx（展开图开关）、useGeometryStore.ts（unfoldingEnabled 状态）、GeometryRenderer.tsx（教材风格：黑色棱线 #1a1a1a + 透明灰面 #9ca3af）。关键技术决策：SVG vectorEffect="non-scaling-stroke" 保证线宽不随缩放变化；flex: 1 1 0% + minWidth: 0 确保三栏等分。经历多轮迭代修复：字号/线宽动态计算、铰链边标签一致性、底面居中布局、标签质心外推偏移。lint + tsc 全部通过。
- **5A-3完成记录（2026-03-06）**：三视图与导出功能全部实现。新增3个文件：threeView.ts（cuboidThreeView + coneThreeView，长方体=3矩形投影，圆锥=正视/侧视等腰三角形+俯视圆，含尺寸标注+虚实线区分）、projection/index.ts（投影注册表，注册cuboid/cube/cone）、ThreeViewPanel.tsx（标准工程制图布局：正视左上+侧视右上+俯视左下，SCALE_BASE=60缩放，尺寸标注线+PNG导出）。修改4个文件：useGeometryStore.ts（threeViewEnabled 默认开启）、AuxiliaryTools.tsx（三视图Switch开关）、AppLayout.tsx（中间列上下分割，展开图+三视图各占50%，条件渲染）、exportImage.ts（修复PNG导出压扁问题：改用viewBox原始宽高+克隆SVG设固定尺寸）。Bug修复：视图间距GAP 30→55避免标注文字与标题重叠。阶段5A全部完成。lint + tsc 通过。
