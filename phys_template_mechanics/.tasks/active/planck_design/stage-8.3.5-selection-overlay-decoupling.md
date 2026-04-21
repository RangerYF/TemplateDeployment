# 阶段 8.3.5：选中高亮与物体本体绘制解耦

- **任务ID**: 03-31-stage8.3.5-selection-overlay-decoupling
- **风险等级**: L2（跨模块渲染架构调整，影响 CanvasRenderer 与多个 body descriptor）
- **流程路径**: MODE 0 -> MODE 1 -> MODE 3 -> MODE 4 -> MODE 5 -> MODE 6
- **强制门禁**: `pnpm lint` + `pnpm tsc --noEmit`
- **状态**: ✅ 已完成（用户验收通过）
- **前置依赖**: 8.3.4 当前验收修复批次 ✅

## 说明

- 仓库中未找到 `.tasks/task_evaluation_framework.md`；本任务风险分级与流程路由依据 AGENTS 中的 RIPER-7 风险矩阵执行。

## 目标

消除“物体本体绘制颜色”和“选中态高亮颜色”之间的上下文耦合，建立明确的渲染分层：

1. 物体本体始终按教材式黑色线稿绘制。
2. 选中态/hover 态始终作为独立 overlay 绘制，不再通过改写 `renderEdit` 的上下文颜色来间接实现。
3. 缩略图、编辑态、仿真态三条渲染链各自职责清晰，避免继续出现“为了修一个视觉问题，连带影响另一条链”的情况。

## 用户原始输入

- "物体本身绘制的颜色和选中的颜色，不应该互相干扰呀。"
- "刚才看你的执行过程，好像这两者目前是会互相干扰的"
- "建议直接在当前会话做，还是我们创建一个独立的任务文档调整这一部分"
- "同意"

## 问题诊断（MODE 1）

### 现状

- [CanvasRenderer.ts](/Users/cjn/Documents/工作/edu/phys_template_mechanics/src/renderer/CanvasRenderer.ts) 目前通过切换 `ctx.strokeStyle` 来表达普通态 / hover / selected。
- 简单物体（如 `block / ball / slope`）直接消费这个描边色，所以看起来正常。
- 若物体 descriptor 内部自定义了局部线条颜色（如 `wall / half-sphere / anchor / pulley-mount`），就会与选中态颜色共享同一套 `ctx` 状态，形成耦合。
- 这导致近期修复不得不让局部绘制“读取外层 strokeStyle”，视觉上虽然对了，但职责边界依然不干净。

### 根因

当前架构把两种语义塞进了同一条渲染链：

1. **对象语义色**：教材式黑色线稿
2. **交互语义色**：选中/hover/手柄/吸附/对齐的蓝色反馈

而 `BodyTypeDescriptor.renderEdit()` 只有一套“直接画最终效果”的接口，没有“本体层”和“交互 overlay 层”的边界。

### 目标架构

- `renderEdit()` 只负责物体本体，不感知 selected/hover 的颜色切换。
- `CanvasRenderer` 在物体本体之后，单独绘制 selection outline / hover outline / handles。
- 对于不规则物体，descriptor 提供可复用的选中轮廓能力，而不是复用本体颜色。

## 暂定涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/models/bodyTypes/descriptor.ts` | 扩展 descriptor 渲染接口，声明选中轮廓能力 |
| `src/renderer/CanvasRenderer.ts` | 将本体渲染与 selected/hover overlay 分层 |
| `src/models/bodyTypes/wall.tsx` | 移除编辑态对外层 strokeStyle 的依赖 |
| `src/models/bodyTypes/halfSphere.tsx` | 同上 |
| `src/models/bodyTypes/anchor.tsx` | 同上 |
| `src/models/bodyTypes/pulleyMount.tsx` | 同上 |
| `src/models/bodyTypes/ground.tsx` | 保留特殊全宽高亮，但归入统一 overlay 语义 |
| `src/dev/ThumbnailGenerator.tsx` | 继续只走本体黑线渲染，不参与交互色逻辑 |

## 计划（MODE 3）

1. 为 body descriptor 增加“选中轮廓”能力接口，优先设计成可选能力，避免影响所有简单物体。
2. 重构 `CanvasRenderer.renderSceneBody()`：
   - 第一层只绘制黑色本体；
   - 第二层统一绘制 hover / selected overlay；
   - 第三层绘制 resize handles / rotate icon。
3. 为不规则或自定义绘制物体补 `renderSelectionOutline` 或等价路径，至少覆盖 `wall / half-sphere / anchor / pulley-mount / ground`。
4. 清理这些 body type 在 `renderEdit()` 中对外层 `strokeStyle` 的依赖，恢复它们只画黑色本体。
5. 验证 `#thumbnails` 不受影响，编辑态蓝色高亮仍正确，仿真态黑线风格保持不变。
6. 执行最小回归：`pnpm lint`、`pnpm tsc --noEmit`。

## 验收标准

- [x] 物体本体颜色与选中/hover 颜色完全解耦
- [x] `renderEdit()` 不再承担选中态着色职责
- [x] `wall / half-sphere / anchor / pulley-mount / ground` 的选中态仍正确显示蓝色
- [x] `#thumbnails` 继续输出黑色且居中的缩略图
- [x] 不影响已有手柄、吸附反馈线、对齐辅助线的蓝色规范
- [x] `pnpm lint` 与 `pnpm tsc --noEmit` 通过

## 本轮执行结果（2026-03-31）

- `BodyTypeDescriptor` 新增 `renderSelectionOutline` 可选接口，用于承载编辑态 hover / selected 的独立 overlay 渲染。
- `CanvasRenderer.renderSceneBody()` 改为两层：
  - 第一层固定绘制黑色本体；
  - 第二层单独绘制蓝色选中/hover overlay；
  - 手柄和旋转图标继续作为第三层交互反馈绘制。
- `ground` 的特殊高亮保持独立实现，但颜色语义统一回蓝色，不再混入黑色 hover/selected 逻辑。
- `wall / half-sphere / anchor / pulley-mount / conveyor` 已从“读取外层 strokeStyle 改变本体颜色”改为：
  - `renderEdit()` 始终只绘制黑色本体；
  - `renderSelectionOutline()` 负责蓝色 overlay。
- `#thumbnails` 继续只调用 `renderEdit()`，因此不会再受到选中态颜色链路影响。
- 验证命令：
  - `pnpm lint` ✅
  - `pnpm tsc --noEmit` ✅

## 审查结论

:white_check_mark: 实现完全匹配计划

## 验收结论

- 2026-03-31：用户确认“验收通过”
