# 0-阶段任务文档：工作台骨架与路由切换

- 所属计划：`.tasks/active/template/PROGRESSIVE-PLAN.md`
- 阶段编号：`T0`
- 风险等级：`L1`（1-3文件以上常规功能改动）
- 当前状态：已完成（2026-04-01）

---

## 目标
实现模板工作台入口骨架，满足以下最小闭环：
1. 默认进入工作台页面（按模块展示模板卡片分组占位）。
2. 点击模板卡片可进入编辑器。
3. 进入编辑器时可按模板 ID 加载对应场景数据（后续 T1/T2 填充模板目录）。

## 执行记录（2026-04-01）
- 用户原文：`开始阶段0`
- 规则裁决：`用户显式指令 > 风险分级自动流转 > 当前模式默认路径`
- 流转决策：用户已明确开始执行，按既有 `L1` 路径在 MODE 0 完成确认后直接进入 MODE 4 实施（不重复索要执行口令）。
- 追加需求：`工作台样式扁平化，减少层次`
- 处理决策：在不改功能与路由的前提下，收敛视觉层级（去渐变/去阴影/hover 仅颜色反馈），保持现有 token 体系一致。
- 视觉微调：移除模块间分割线，仅用留白区分模块分组。
- 导航补充：编辑器顶栏新增“返回工作台”icon 按钮（hash 跳转 `#workbench`）。
- 导航微调：返回 icon 改为无背景无边框的 `ChevronLeft`（不带横线左箭头）。

---

## 范围
- 页面级切换：`WorkbenchPage` 与 `EditorLayout`。
- 路由/状态：基于 hash 或等价轻量路由方案完成页面切换。
- 模板目录骨架：先接入 `P-01/P-02/P-05/P-12/P-14` 五组。
- 场景注入接口：在 `sceneStore` 增加 `replaceScene`（或 `setScene`）用于一次性载入模板 Scene。

---

## 非目标（本阶段不做）
- 不做全部 40 个 A 类模板的真实数据填充。
- 不做模板导入导出与持久化。
- 不做工作台视觉精修与复杂筛选搜索。

---

## 实施清单（按顺序）
1. 新增工作台页面组件：
   - `src/components/workbench/WorkbenchPage.tsx`
   - 展示模块分组标题与模板卡片列表（先占位数据）。
2. 新增模板目录数据骨架：
   - `src/templates/catalog.ts`
   - 定义 `module -> cards[]` 结构，卡片至少含 `id/name/module/status`。
3. 改造应用入口切换：
   - 修改 `src/App.tsx`
   - 默认渲染工作台；根据 hash/路由切换编辑器。
4. 增加场景替换能力：
   - 修改 `src/store/sceneStore.ts`
   - 提供 `replaceScene(scene: Scene)`。
5. 打通“卡片点击 -> 编辑器”：
   - 卡片点击后写入目标模板 ID 并切到编辑器页。
   - 若模板场景已存在，调用 `replaceScene` 注入。

---

## 验收标准
- 打开应用默认显示工作台，不直接进入编辑器。
- 工作台可见 `P-01/P-02/P-05/P-12/P-14` 五个模块分组。
- 点击任意模板卡片后进入编辑器页面。
- 控制台无报错，类型检查通过。

---

## 回归检查（命中 `src/`）
- `pnpm lint`
- `pnpm tsc --noEmit`

---

## 风险与回滚
- 风险：路由切换与现有 `#thumbnails` 开发入口冲突。
- 控制：保留 `#thumbnails` 优先分支，工作台/编辑器使用独立 hash。
- 回滚：若入口改造异常，先回退到原 `EditorLayout` 直出模式，仅保留工作台组件代码不挂载。

---

## 完成结果（Checkpoint）
- 代码交付：
  - 工作台页面：`src/components/workbench/WorkbenchPage.tsx`
  - 模板目录骨架：`src/templates/catalog.ts`
  - 路由入口切换：`src/App.tsx`
  - 场景替换接口：`src/store/sceneStore.ts`（`replaceScene`）
  - 返回工作台入口：`src/components/TopBarMeta.tsx`
- 视觉验收：
  - 工作台改为扁平化（去渐变、去阴影、hover 仅颜色反馈）。
  - 移除模块分割线，改为留白分组。
  - 返回 icon 采用无背景无边框 `ChevronLeft`。
- 回归检查：
  - `pnpm lint` ✅
  - `pnpm tsc --noEmit` ✅
