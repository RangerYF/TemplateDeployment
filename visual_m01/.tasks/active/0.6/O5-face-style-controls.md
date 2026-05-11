# O5: 每个表面调色、虚化（透明度）控制

## 任务信息
- **ID**: 05-11-14-30-face-style
- **风险等级**: L1
- **流程路径**: MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 用户原文
> 立体几何展示中，能否增加每个表面调色、虚化的按钮，更易于展示

## 任务理解
为 Face 实体增加可配置的颜色和透明度属性，用户选中面后可在 Inspector 面板中调整外观。

## 执行计划

### 步骤 1：数据层 — FaceProperties 增加 style 字段
- **文件**: `src/editor/entities/types.ts`
- **改动**: `FaceProperties` 增加可选 `style?: { color: string; opacity: number }`
- **说明**: 设为可选，未设置时使用渲染器默认值，避免破坏已有实体数据

### 步骤 2：实体创建 — 默认不设 style
- **文件**: `src/editor/store/entityStore.ts`
- **改动**: 无需改动。style 为可选字段，createBuiltInEntities 创建 Face 时不传 style，渲染器用默认值

### 步骤 3：渲染层 — FaceEntityRenderer 读取实体 style
- **文件**: `src/components/scene/renderers/FaceEntityRenderer.tsx`
- **改动**: 修改 `useFaceStyle` hook，优先读取实体的 `style` 属性，hover/select 状态仍覆盖
- **逻辑**: 
  ```
  base = entity.style ?? { color: FACE_COLOR, opacity: FACE_OPACITY }
  if selected → 用 selected 颜色+透明度
  if hovered → 用 hovered 颜色+透明度
  else → 用 base
  ```

### 步骤 4：UI 层 — FaceInspector 增加外观控件
- **文件**: `src/components/panels/inspectors/FaceInspector.tsx`
- **改动**: 增加颜色选择器和透明度滑块
- **UI 设计**:
  - 颜色选择器：复用 SegmentInspector 的色板风格，预设 6-8 色
  - 透明度滑块：range 0~100，步进 1，当前值显示百分比
  - 重置按钮：恢复默认值（清除 style 字段）
- **命令**: 使用 `UpdatePropertiesCommand` 实现 undo/redo

### 步骤 5：回归门禁
- 执行 `pnpm lint && pnpm tsc --noEmit`
