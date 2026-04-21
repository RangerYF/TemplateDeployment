# V0.3 阶段1：UI 体验修补 ✅ 已完成

> **阶段目标**：修复 V0.1 遗留的交互问题和 PM 反馈的 UI 优化项
> **预计耗时**：2-3 天
> **实际完成**：2026-03-10
> **前置条件**：V0.2 架构重构已完成
> **BACKLOG 覆盖**：F02, F03, F04
>
> **关联文档**：
> - 主任务文档：`.tasks/active/v0.3/PROGRESSIVE-PLAN.md`（V0.3 全局计划，8个阶段串行）
> - 功能清单：`.tasks/active/v0.3/BACKLOG.md`（F01-F19 完整功能定义与优先级）

---

## 代码现状摘要

| 功能点 | 现状 | 需要做什么 |
|--------|------|-----------|
| 三视图/展开图默认关闭 | `uiStore.ts` 初始值已是 `false` ✅ | 验证生效 + 面板内加关闭按钮 |
| 体积表面积显示优化 | `MeasurementDisplay.tsx` 不区分 π 含量，统一显示 | 增加 π 检测，含 π 时展示推导过程 |
| Escape 退出绘制模式 | `shortcuts.ts` 已实现，Tool 也各自处理 ✅ | 验证全链路（coordSystem/circumCircle）|
| 模式提示条 | `Scene3D.tsx` 有 `SceneNotification` 但不是工具模式提示 | 新增 `ModeIndicator` 组件 |
| 画线起点高亮 | `drawSegmentTool.ts` 第一点调用 `select()` 选中 ✅，但无脉冲动画 | 给选中的起点加呼吸动画 |
| 切换几何体清理 | `ChangeGeometryTypeCommand` 有完整清理逻辑 ✅ | 验证完整性 |

---

## 子任务清单（串行执行）

### T1.1 三视图/展开图面板完善 ⏱️ 0.5天 ✅

**现状分析**：
- `uiStore.ts`：`unfoldingEnabled` 和 `threeViewEnabled` 初始值已为 `false` ✅
- `AppLayout.tsx`：中间列仅在 `middleColumnVisible` 时渲染 ✅
- `AuxiliaryTools.tsx` 第135-159行：Switch 开关控制状态 ✅
- **缺陷**：展开图/三视图面板内部没有关闭按钮，只能从右侧面板的 Switch 关闭

**要做的事**：
1. 验证初始状态：打开应用确认面板默认收起
2. `UnfoldingPanel.tsx` 面板顶部增加关闭按钮（调用 `useUIStore.getState().setUnfoldingEnabled(false)`）
3. `ThreeViewPanel.tsx` 面板顶部增加关闭按钮（同理）
4. 验证开关按钮交互：点击 Switch 展开 → 面板内关闭按钮收起 → 再次 Switch 展开

**涉及文件**：
- `src/components/views/UnfoldingPanel.tsx` — 加关闭按钮
- `src/components/views/ThreeViewPanel.tsx` — 加关闭按钮

**验收**：
- [x] 打开应用后三视图和展开图面板默认收起
- [x] 面板内有关闭按钮可收起
- [x] Switch 开关和面板关闭按钮双向同步

---

### T1.2 体积表面积显示优化 ⏱️ 0.5天 ✅

**现状分析**：
- `MeasurementDisplay.tsx`：`Row` 组件只判断 `isExact`（是否整数），不区分 π 含量
- `engine/math/symbolic.ts` 的 `piMul/piMulFrac/piMulSqrt` 返回的 LaTeX 中包含 `\\pi` 文本
- 判断方法：`value.latex.includes('\\pi')` 即可检测结果是否含 π
- 公式提取：从 steps 中找 label 为"体积公式"/"表面积公式"的步骤，取等号右侧

**已完成的修改**：
1. `Row` 组件增加 π 检测 + 公式提取逻辑
2. 含 π 且有整体公式步时：显示 `V = 公式 ≈ 数值`（如 `V = ⅓πr²h ≈ 4.71`）
3. 含 π 但无整体公式步时（如圆锥表面积有多个分项公式）：显示 `S ≈ 数值`
4. 不含 π 且为整数时：显示 `V = 值`（如 `V = 8`）
5. 不含 π 且非整数时：只显示近似值 `V ≈ 数值`（如 `V ≈ 2.67`），不显示分数/根号
6. 增加"体积"/"表面积"全称标签
7. 卡片底部增加"点击查看推导过程"提示文字
8. 点击仍弹出完整计算步骤弹窗（保留现有行为）

**显示规则**：
```
含 π 的情况（如圆锥体积）：
  体积
  V = ⅓πr²h ≈ 4.71

不含 π 且整数（如正方体）：
  体积
  V = 8

不含 π 且非整数（如棱锥）：
  体积
  V ≈ 2.67
```

**涉及文件**：
- `src/components/info/MeasurementDisplay.tsx` — 核心修改

**验收**：
- [x] 正方体(a=2)：V=8, S=24，不展示公式
- [x] 圆锥：含 π 的显示 `V = 公式 ≈ 数值`
- [x] 圆柱：含 π 的显示 `V = 公式 ≈ 数值`
- [x] 棱锥(非整数)：只显示 `V ≈ 数值`，不显示分数/根号精确值
- [x] 点击任意数值仍可弹出完整计算步骤弹窗
- [x] 卡片底部有"点击查看推导过程"提示

---

### T1.3 模式提示条 ⏱️ 0.5天 ✅

**现状分析**：
- `Scene3D.tsx` 已有 `SceneNotification` 组件（顶部居中黑底白字通知条），但它是通用通知，不是工具模式指示器
- `ToolBar.tsx`：5 个工具按钮，活跃工具绿色高亮，但场景中无文字提示当前模式
- `toolStore.ts`：`activeToolId` 追踪当前工具
- 需要的工具模式提示：
  - `select`：不显示提示（默认模式）
  - `drawSegment`：`画线模式 — 点击选择起点` / `画线模式 — 点击选择终点`
  - `crossSection`：`截面模式 — 点击选择定义点（至少3个）`
  - `coordSystem`：`坐标系模式 — 点击选择原点`
  - `circumCircle`：`外接圆模式 — 点击选择3个点`

**要做的事**：
1. 新建 `ModeIndicator` 组件（或直接在 `Scene3D.tsx` 中添加）
2. 根据 `activeToolId` 条件渲染提示条
3. 提示条样式：场景顶部居中，与 SceneNotification 区分（用绿色主色调背景或绿色边框，避免与黑底通知混淆）
4. `select` 模式不显示提示条
5. 画线模式需要根据 `startPointId` 状态显示不同文案 — 这需要 drawSegmentTool 暴露状态

**提示条状态需求**：
- drawSegmentTool 需要暴露 `startPointId` 给 UI（目前是模块级 let 变量，UI 无法读取）
- 方案：在 toolStore 中增加工具状态字段（如 `toolState: Record<string, unknown>`），drawSegmentTool 在选点时写入状态
- 或：简化处理，画线模式统一显示一条提示（不区分起点/终点状态）

**涉及文件**：
- `src/components/scene/Scene3D.tsx` — 添加 ModeIndicator 渲染
- 可选新建 `src/components/scene/ModeIndicator.tsx`
- `src/editor/store/toolStore.ts` — 可选扩展，暴露工具内部状态

**验收**：
- [x] 切换到画线工具后 3D 场景顶部出现绿色提示条
- [x] 切换到截面工具后提示条文案切换
- [x] 切换回选择工具后提示条消失
- [x] 提示条不遮挡 3D 操作，视觉醒目但不刺眼

---

### T1.4 画线起点脉冲动画 ⏱️ 0.5天 ✅

**现状分析**：
- `drawSegmentTool.ts` 第一次点击后调用 `useSelectionStore.getState().select(event.hitEntityId)` 选中起点
- `PointEntityRenderer.tsx`：选中状态体现为标签背景变绿（builtIn 点）或球体变黄（自定义点）
- 缺少"起点正在被选为画线起点"的脉冲/呼吸动画

**要做的事**：
1. `PointEntityRenderer.tsx` 中，当 drawSegment 工具激活且该点被选中时，给视觉元素添加呼吸动画
2. builtIn 顶点：标签 boxShadow 呼吸（或背景色呼吸）
3. 自定义点：球体 scale 脉冲 + 发光效果
4. 动画实现方案：
   - 方案A（推荐）：CSS animation `@keyframes pulse`，通过 Html 组件的 style 控制
   - 方案B：Three.js useFrame 驱动 scale 动画

**判断条件**：`activeToolId === 'drawSegment' && isSelected`

**涉及文件**：
- `src/components/scene/renderers/PointEntityRenderer.tsx` — 添加脉冲动画样式

**验收**：
- [x] 进入画线模式 → 点击第一个点 → 该点出现脉冲呼吸动画
- [x] 点击第二个点完成画线后 → 动画消失
- [x] Escape 退出画线模式 → 动画消失
- [x] 选择模式下普通选中不触发脉冲动画（只在画线模式下）

---

### T1.5 Escape 退出 + 切换清理验证 ⏱️ 0.5天 ✅

**现状分析**：

Escape 链路：
- `shortcuts.ts` 第22-32行：捕获 Escape → 转发给当前 Tool → 强制切到 select → 清除选中
- `drawSegmentTool.onKeyDown`：Escape → 清除 startPointId + 清除选中 + 切换工具 ✅
- `crossSectionTool.onKeyDown`：Escape → 清除 definingPointIds + 清除选中 + 切换工具 ✅
- 需验证：`coordSystemTool` 和 `circumCircleTool` 是否也正确处理 Escape

切换清理链路：
- `ChangeGeometryTypeCommand.execute()`：获取 `getRelatedEntities()` → 逐个 `deleteEntity()` → 创建新 builtIn
- 需验证：`getRelatedEntities()` 是否覆盖所有用户创建的实体（segment/face/point builtIn=false）

**要做的事**：
1. 读取 `coordSystemTool.ts` 和 `circumCircleTool.ts`，确认 Escape 处理
2. 手动验证：进入各工具模式 → 按 Escape → 确认回到选择工具
3. 读取 `entityStore.ts` 的 `getRelatedEntities()` 实现，确认覆盖范围
4. 手动验证：创建线段/截面/取点 → 切换几何体 → 确认旧实体被清理
5. 如有缺陷则修复

**涉及文件**：
- `src/editor/tools/coordSystemTool.ts` — 检查 Escape 处理
- `src/editor/tools/circumCircleTool.ts` — 检查 Escape 处理（如果存在独立文件）
- `src/editor/store/entityStore.ts` — 检查 `getRelatedEntities()` 实现

**验收**：
- [x] 画线模式 → Escape → 回到选择工具，选中状态清除
- [x] 截面模式 → Escape → 回到选择工具，临时状态清除
- [x] 坐标系模式 → Escape → 回到选择工具
- [x] 外接圆模式 → Escape → 回到选择工具
- [x] 创建自定义线段 + 截面 + 取点 → 切换几何体 → 所有用户创建实体被清理
- [x] 切换后 undo → 旧几何体及其关联实体恢复

---

## 门禁检查

阶段完成后执行：
```bash
pnpm lint && pnpm tsc --noEmit
```
命中 `src/` 变更 → 执行最小回归门禁（CLAUDE.md 附录F）。

---

## 风险与注意事项

1. **T1.2 公式推导显示**：需要确认所有几何体的 `calculate()` 返回的 `steps` 格式一致，特别是步骤数量和标签文案
2. **T1.3 工具状态暴露**：drawSegmentTool 的 `startPointId` 目前是模块级 let 变量，如果要让 ModeIndicator 感知"选了几个点"，需要将状态提升到 toolStore 或用其他机制
3. **T1.4 动画性能**：脉冲动画建议用 CSS animation 而非 Three.js useFrame，避免不必要的帧循环开销
4. **T1.5 验证为主**：Escape 和切换清理在 V0.2 中已有实现框架，主要是验证覆盖完整性，修改量可能很小

---

## 交付 DoD — V0.3 阶段1

- **变更摘要**：
  - `src/components/views/UnfoldingPanel.tsx` — 新增关闭按钮
  - `src/components/views/ThreeViewPanel.tsx` — 新增关闭按钮
  - `src/components/info/MeasurementDisplay.tsx` — π 检测 + 公式/近似值分级显示 + 全称标签 + 推导提示
  - `src/components/scene/ModeIndicator.tsx` — **新建**，工具模式提示条
  - `src/components/scene/Scene3D.tsx` — 引入 ModeIndicator
  - `src/components/scene/renderers/PointEntityRenderer.tsx` — 画线模式脉冲动画
- **验证结果**：
  - pnpm lint: PASS
  - pnpm tsc --noEmit: PASS
  - 手动验证：全部通过（用户验收确认）
- **风险与回滚**：无破坏性变更，所有改动为 UI 增强
- **审查结论**：实现匹配计划，T1.2 显示规则经用户反馈迭代修正为最终版本
