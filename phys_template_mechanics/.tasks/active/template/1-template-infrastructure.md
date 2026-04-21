# 1-阶段任务文档：模板基础设施（Schema + Registry + Loader）

- 所属计划：`.tasks/active/template/PROGRESSIVE-PLAN.md`
- 阶段编号：`T1`
- 风险等级：`L2`（涉及模板数据结构定义、ID 映射与加载链路）
- 当前状态：已完成（2026-04-01）

---

## 目标
在现有工作台入口基础上，建立可复用的模板基础设施，满足以下最小闭环：
1. 定义统一模板结构（以当前编辑器 `Scene` 为核心真值）。
2. 建立模板注册表与按 ID 加载能力。
3. 输出稳定的模板加载接口，供 `App`/工作台/后续阶段复用。

---

## 范围
- 模板类型定义：`src/templates/schema.ts`
- 模板注册与导出：`src/templates/index.ts`
- 模板目录兼容改造：`src/templates/catalog.ts`
- 模板加载接口：`src/templates/loader.ts`（或等价文件）
- 入口对接（如需要）：`src/App.tsx`（从 catalog 直读切换为 loader）

---

## 非目标（本阶段不做）
- 不做 40 个 A 类模板的真实场景批量填充。
- 不做模板导入导出与持久化存储。
- 不做模板卡片视觉升级与筛选搜索。

---

## 数据契约（执行前需二次校验）
以当前编辑器 `Scene` 结构为唯一标准，不引入需求文档中的抽象运行时模型。

建议模板结构（最小版）：
- `meta.id: string`
- `meta.module: 'P-01' | 'P-02' | 'P-05' | 'P-12' | 'P-14'`
- `meta.name: string`
- `meta.status: 'ready' | 'planned'`
- `scene?: Scene`

关键约束：
- `scene` 字段存在时，必须可直接交给 `replaceScene(scene)`。
- 不允许推测字段；字段名与类型以 `src/models/types.ts` 实际定义为准。

---

## 实施清单（按顺序）
1. 新增模板 schema：
   - 创建 `src/templates/schema.ts`
   - 明确 `TemplateMeta / TemplateDefinition / TemplateModule` 等类型。
2. 建立注册表与统一出口：
   - 创建 `src/templates/index.ts`
   - 统一导出 `templateRegistry`、`listTemplates`、`getTemplateById`。
3. 抽离加载器：
   - 创建 `src/templates/loader.ts`
   - 提供 `loadTemplateById(id)`，返回模板定义或明确失败结果。
4. 对齐 catalog：
   - 调整 `src/templates/catalog.ts` 以复用 schema 类型，避免重复定义。
5. （可选）入口链路切换：
   - 若 `App.tsx` 仍直接依赖 catalog，改为调用 loader 接口。

---

## 验收标准
- 能通过模板 ID 稳定获取模板定义。
- `scene` 模板可直接注入 `sceneStore.replaceScene`，无类型错误。
- 模板类型定义与 `Scene` 保持一致（不出现自定义偏移字段）。
- 加载失败路径可预期（ID 不存在时返回空或错误信息）。

---

## 回归检查（命中 `src/`）
- `pnpm lint`
- `pnpm tsc --noEmit`

---

## 风险与回滚
- 风险：模板 schema 与 `Scene` 类型漂移，导致注入失败或隐性字段不一致。
- 控制：schema 直接引用 `src/models/types.ts` 的 `Scene` 类型。
- 回滚：保留 `catalog.ts` 旧读取路径；若 loader 链路异常，先回退到 `getTemplateById` 直读。

---

## 本次执行记录（2026-04-01）

### 数据契约校验（L2 强制）
- 已核对 `src/models/types.ts` 的 `Scene` 真值字段：`id/name/bodies/joints/forces/settings.gravity`。
- `src/templates/schema.ts` 直接引用 `Scene` 类型，模板结构定为 `meta + scene?`，未引入抽象运行时字段。

### 实际变更
- 新增：`src/templates/schema.ts`
- 新增：`src/templates/index.ts`
- 新增：`src/templates/loader.ts`
- 改造：`src/templates/catalog.ts`（从扁平字段改为 `meta` 结构并复用 schema）
- 对接：`src/App.tsx`（模板加载改为 `loadTemplateById`）
- 对接：`src/components/workbench/WorkbenchPage.tsx`（读取 `template.meta` 与 `group.templates`）

### 验收结果
- 模板可通过 ID 获取定义：`getTemplateById` / `loadTemplateById` 已接通。
- ID 不存在时返回可预期失败：`{ ok: false, reason: 'not_found', templateId }`。
- `scene` 可直接进入 `replaceScene(scene)` 注入链路。

### 回归检查证据
- `pnpm lint`：通过
- `pnpm tsc --noEmit`：通过

### 验收补丁（2026-04-01）
- 用户验收反馈：`FM-001 / MOT-001 / SHM-001` 进入后仍为空白并出现“开始搭建场景”提示。
- 根因：`ready` 模板仅包含 `ground`，命中编辑器空场景提示条件（无非地面物体/约束/外力）。
- 修复：为 5 个 `ready` 模板补充最小可见可仿真数据（非地面物体，`SHM-001` 追加弹簧约束，`FM-001` 追加外力）。
- 回归：`pnpm lint`、`pnpm tsc --noEmit` 再次通过。
- 追加修正：
  - `FM-001` 物块初始高度调整为贴地位置（与编辑器吸附观感一致）。
  - `MOT-001` 调整为贴地匀速版本（重力开启 + 地面接触 + 零摩擦 + 初速度），并复用 `computeSnap` 计算贴地位姿。
  - `SHM-001` 按需求回调为竖直弹簧场景（重力开启 + 上下方向单自由度 + 物块固定转动）。
  - `FM-001` 贴地位姿改为复用 `computeSnap` 计算，避免手填坐标与编辑器吸附结果漂移。
  - 用户后续决策：清除阶段一内置模板场景数据；`catalog` 仅保留模板元信息，状态统一回调为 `planned`，待 T2 指令系统产出后再逐模板上架。

### 后续一致性约束（模板数据 vs 编辑器行为）
- 位置关系优先复用编辑器算法生成（吸附位姿使用 `computeSnap`），避免手工估值。
- 模板体参数优先沿用编辑器创建字段集合（`mass/friction/restitution/initialVelocity/initialAcceleration + type defaults`）。
- 复杂相对关系（约束锚点、多体间距）建议先在编辑器搭建并以 Scene 真值回填模板，避免语义偏差。
