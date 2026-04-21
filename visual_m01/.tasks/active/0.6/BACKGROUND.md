# V0.6 主任务文档

## 任务背景

项目已完成 V0.1~V0.5 的开发，具备完整的 3D 几何编辑器、用户认证、作品管理工作台和多学科模板体系。V0.5 中 AI 功能为 Mock 实现（关键词匹配推荐模板）。V0.6 的目标是实现真正的 AI 能力：AI 作品推荐和 AI 作品生成。

## 版本目标

**AI 作品推荐**：用户输入自然语言（知识点/题目/可视化需求），LLM 理解意图后从预置作品库中匹配最合适的作品返回。

> AI 作品生成（LLM 输出 scene_data）为 V0.7 范围，不在本版本内。

## 核心概念

- **模板 (Template)** = class：定义几何体类型和能力范围（如"正方体"模板）
- **作品 (Project)** = object：模板的具体实例化（如"棱长为2的正方体 + 外接球 + 坐标系"）
- 推荐返回的是**作品级别**的完整可加载场景，不是模板级别
- 系统预置的和未来用户发布的都叫 project，通过 `source: 'system' | 'community'` 区分

## 技术决策

- **LLM 调用方式**：前端直接调用 LLM API（Claude/OpenAI），不经过后端中转
- **作品数据存放**：第一阶段静态 JSON 内置在前端项目中（`src/data/projects/`）
- **第一版范围**：仅覆盖"数学 - M01 立体几何"模块

## 已完成的工作

### 1. 数据架构（已搭建）

```
src/data/projects/
├── types.ts                    # ProjectMeta + SceneSnapshot 类型定义
├── index.ts                    # 注册表（getAllProjectMetas / loadSceneData / filterProjects）
├── math/m01/
│   ├── meta.ts                 # 作品 meta 数据
│   └── scenes/*.json           # scene_data JSON 文件
```

### 2. 作品库 UI（已搭建，DEV 标记）

- 工作台左侧导航新增"作品库 DEV"菜单
- 作品按几何体分组展示，支持难度筛选
- 点击卡片加载 scene_data 跳转编辑器（预览模式，不触发保存）
- 卡片上可复制作品 ID

### 3. 文档梳理（已完成）

- `docs/作品数据/作品数据梳理思路.md`：知识体系 → 题型 → 场景需求 → 作品矩阵
- `docs/作品数据/作品清单v1.md`：53 个作品的详细清单

### 4. 生成脚本（需重写）

- `scripts/generate-scenes.ts`：当前版本存在严重问题
- 已生成的 53 个 scene_data JSON 中，大部分 C 级作品（度量/截面/坐标系类）数据不正确
- **问题根因**：未调用引擎的 calculator 函数预计算度量值，angleMeasurement/distanceMeasurement 实体缺失

## 当前存在的问题

### 作品数据质量问题

| 场景类型 | 数量 | 状态 | 问题 |
|---------|------|------|------|
| S01 基础认知 | ~9 | ✓ 正确 | 纯几何体，无额外实体 |
| S02 对角线 | ~4 | 需验证 | 自定义线段，需确认顶点标签匹配 |
| S03 外接球 | ~8 | ✓ 正确 | circumSphere 实体，渲染时自动计算 |
| S04 截面 | ~2 | ✗ 不完整 | 只加了部分中点和线，未创建 crossSection face 实体 |
| S05 二面角 | ~4 | ✗ 错误 | 只画了辅助线，缺少 angleMeasurement 实体 |
| S06 线面角 | ~3 | ✗ 错误 | 同上 |
| S07 异面角 | ~3 | ✗ 错误 | 同上 |
| S08 点面距 | ~3 | ✗ 缺失 | 缺少 distanceMeasurement 实体 |
| S09 异面距离 | ~3 | ✗ 错误 | 只画了线，缺少 distanceMeasurement 实体 |
| S10 坐标系 | ~5 | 需验证 | coordinateSystem 实体已创建，需验证轴方向 |
| S11 展开图 | ~3 | 不需要 | 展开图是辅助功能，不需要单独作品 |
| S12 三视图 | ~5 | 不需要 | 三视图是辅助功能，不需要单独作品 |
| S13 中点连线 | ~2 | 需改进 | 辅助线不够完整 |

### 实体系统关键约束

度量实体（angleMeasurement / distanceMeasurement）创建时**必须预计算精确值**：

```typescript
// angleMeasurement 必填字段
angleRadians: number;    // 从 calculateDihedralAngle() 等函数获得
angleLatex: string;      // 精确值 LaTeX（如 "\\arctan\\sqrt{2}"）
angleDegrees: number;    // 度数

// distanceMeasurement 必填字段
distanceValue: number;   // 从 calculatePointPointDistance() 等函数获得
distanceLatex: string;   // 精确值 LaTeX（如 "\\sqrt{2}"）
distanceApprox: string;  // 近似值字符串（如 "≈ 1.41"）
```

生成脚本需导入引擎的 calculator 函数，用 builder 输出的顶点坐标预计算这些值。

## 参考文件

- 实体类型定义：`src/editor/entities/types.ts`
- 角度计算器：`src/engine/math/angleCalculator.ts`
- 距离计算器：`src/engine/math/distanceCalculator.ts`
- 坐标系计算：`src/engine/math/coordinates.ts`
- 外接球计算：`src/engine/math/circumscribedSphere.ts`
- 截面计算：`src/editor/crossSectionHelper.ts`
- 构建器入口：`src/engine/builders/index.ts`
- 作品 meta 定义：`src/data/projects/math/m01/meta.ts`
- 生成脚本：`scripts/generate-scenes.ts`

## 当前技术栈

- React 19 + TypeScript + Vite 7
- Three.js + @react-three/fiber + @react-three/drei
- React Router v7（SPA 多页面）
- Zustand 5（状态管理）
- Tailwind CSS 3 + EduMind 设计系统
