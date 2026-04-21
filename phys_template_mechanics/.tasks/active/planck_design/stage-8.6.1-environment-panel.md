# 阶段 8.6.1：无选中态环境配置面板（重力加速度）

- **任务ID**: 04-01-00-07-stage8.6.1-environment-panel
- **风险等级**: L1（常规风险：属性面板与状态同步）
- **状态**: ✅ 已完成（2026-04-01）
- **前置依赖**: 8.5 ✅
- **规则来源**: 8.6 总任务拆分

## 目标

当未选中任何物体时，右侧显示环境配置面板，并支持 `g` 自定义输入且即时生效。

## 计划

1. 梳理当前“无选中态”面板渲染路径，切换为空态到环境配置卡片。
2. 在 store 中补齐环境参数（至少 `gravityY`），并统一读写入口。
3. 面板提供 `g` 输入配置，含输入合法性校验。
4. 变更后同步到物理引擎重力配置，保证下一帧仿真生效。

## 涉及文件（预估）

- `src/components/panels/PropertyPanel.tsx`
- `src/store/sceneStore.ts`
- `src/store/editorStore.ts`
- `src/engine/PhysicsBridge.ts`

## 验收标准

- 未选中任何物体时显示环境配置面板。
- `g` 输入后可即时影响仿真。
- 非法输入有提示且不污染状态。

## 回归门禁（执行后）

- `pnpm lint && pnpm tsc --noEmit`

## 执行记录（2026-04-01）

1. 新增无选中态“环境配置”面板，替换原“选中物体查看属性”空提示。
2. 新增重力配置输入（无快捷按钮），含输入合法性校验（`0-50`）。
3. `sceneStore` 新增 `setGravity`，统一更新 `scene.settings.gravity`。
4. `PhysicsBridge` 新增 `setGravity`；`Canvas` 监听 `scene.settings.gravity` 变化并实时同步到引擎，保证下一帧生效。

**变更文件**：
- `src/components/panels/PropertyPanel.tsx`
- `src/store/sceneStore.ts`
- `src/engine/PhysicsBridge.ts`
- `src/components/Canvas.tsx`

**验证结果**：
- `pnpm lint && pnpm tsc --noEmit` ✅

## 追加修正（2026-04-01）

- 按用户反馈移除环境面板中的“当前引擎重力：(x, y)”描述文案。
- 按用户反馈移除 `9.8` / `10` 快捷按钮，仅保留输入框 + 校验。
- 复测：`pnpm lint && pnpm tsc --noEmit` ✅
