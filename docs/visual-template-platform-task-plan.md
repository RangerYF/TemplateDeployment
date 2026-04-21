# 可视化模板平台开发任务文档

本文档用于指导可视化模板平台从方案进入实施阶段的全过程开发，结合当前已完成的 `M-05` 模板侧试点结果，以及主项目/后端现状，拆分出模板侧与平台侧的工作边界、阶段任务、交付物和验收标准。

配套文档：

- 平台总体设计稿：[visual-template-platform-design.html](D:/repo/Template/docs/visual-template-platform-design.html)
- 模板接入指南：[template-snapshot-bridge-guide.md](D:/repo/Template/visual_m05/docs/template-snapshot-bridge-guide.md)

---

## 1. 当前阶段结论

当前已经具备进入平台实施阶段的条件：

1. `M-05` 已验证模板侧最小 snapshot / bridge 能力成立
2. 模板接入指南已经形成，可以发给模板负责人并行推进
3. 平台总体架构已经明确，适合启动前后端开发

因此，从现在开始：

- 模板同学可以按文档并行接入
- 平台前后端可以同步启动

不需要等所有模板都接完，才开始平台开发。

---

## 2. 开发目标

本阶段目标不是一次性完成整个最终平台，而是先打通下面这个最小闭环：

1. 用户从模板库选择模板
2. 平台创建模板实例
3. 工作台加载模板实例
4. 宿主调用模板 `getSnapshot()`
5. 平台将 snapshot 存入数据库
6. 用户从历史实例点击“继续编辑”
7. 平台读取 snapshot
8. 宿主调用模板 `loadSnapshot(snapshot)` 恢复状态

一句话：

> 先打通“模板实例创建、保存、继续编辑”的最小产品闭环。

---

## 3. 角色与边界

### 3.1 模板负责人负责

模板负责人只负责让模板具备被平台保存和恢复的能力。

交付内容：

1. `getSnapshot()`
2. `loadSnapshot(snapshot)`
3. `validateSnapshot(snapshot)`
4. `window.__EDUMIND_TEMPLATE_BRIDGE__`
5. 模板接入说明
6. 自测通过

### 3.2 平台负责人负责

平台负责人负责模板平台本身的前后端建设。

交付内容：

1. 模板目录系统
2. runtime/version/instance 数据模型
3. 后端 API
4. 主项目模板库页
5. 主项目实例页
6. 主项目工作台
7. 保存策略
8. 宿主 bridge 调用

---

## 4. 模板侧任务

### 4.1 一期最低要求（L1）

每个模板必须完成：

1. 具备 `getSnapshot()`
2. 具备 `loadSnapshot(snapshot)`
3. 具备 `validateSnapshot(snapshot)`
4. 暴露 `window.__EDUMIND_TEMPLATE_BRIDGE__`
5. 通过“刷新后恢复”测试

### 4.2 建议要求（L2）

建议逐步补充：

1. `dirty` 状态识别
2. embed mode
3. 明确 `snapshotSchemaVersion`
4. 清晰说明“哪些状态保存 / 哪些不保存”

### 4.3 模板负责人交付物

每个模板负责人完成接入后，需要交付：

1. 模板代码
2. 一份 snapshot 示例 JSON
3. 一份保存字段说明
4. 当前 `snapshotSchemaVersion`
5. 自测结果（文字或截图）

---

## 5. 平台侧任务总览

平台侧分为四部分：

1. 数据模型
2. 后端 API
3. 前端页面
4. 宿主调用与保存策略

---

## 6. 平台后端任务

后端目录：

`D:\repo\Backend\edu-mind-ai-backend`

### 6.1 数据模型设计

建议新增以下核心模型：

1. `visual_template_runtimes`
2. `visual_template_runtime_versions`
3. `visual_template_definitions`
4. `visual_template_instances`

可选后续新增：

5. `visual_template_migrations`
6. `visual_template_assets`

### 6.2 需要落地的字段（最小版）

#### `visual_template_runtimes`

- `id`
- `runtime_key`
- `name`
- `entry_type`
- `status`
- `current_version_id`
- `created_at`
- `updated_at`

#### `visual_template_runtime_versions`

- `id`
- `runtime_id`
- `version`
- `entry_url`
- `manifest_url`
- `bridge_version`
- `snapshot_schema_version`
- `status`
- `created_at`

#### `visual_template_definitions`

- `id`
- `template_key`
- `runtime_id`
- `subject`
- `title`
- `summary`
- `tags`
- `default_config`
- `capabilities`
- `is_published`
- `created_at`
- `updated_at`

#### `visual_template_instances`

- `id`
- `user_id`
- `template_id`
- `runtime_version_id`
- `title`
- `snapshot`
- `snapshot_schema_version`
- `thumbnail_url`
- `status`
- `created_at`
- `updated_at`
- `last_opened_at`

### 6.3 后端接口任务

最小一期接口建议：

#### 模板目录

- `GET /api/v1/visual-templates`
- `GET /api/v1/visual-templates/{template_id}`

#### 实例

- `POST /api/v1/visual-template-instances`
- `GET /api/v1/visual-template-instances`
- `GET /api/v1/visual-template-instances/{instance_id}`
- `PUT /api/v1/visual-template-instances/{instance_id}`
- `DELETE /api/v1/visual-template-instances/{instance_id}`
- `POST /api/v1/visual-template-instances/{instance_id}/copy`

#### 可选版本状态

- `GET /api/v1/visual-template-instances/{instance_id}/version-status`

### 6.4 后端任务拆解

1. 设计 SQLAlchemy Model
2. 设计 Pydantic Schema
3. 写 Alembic migration
4. 写 service 层
5. 写 route 层
6. 写最小 seed 数据
7. 补最小接口测试

---

## 7. 平台前端任务

前端目录：

`D:\repo\Frontend\edu-mind-ai-frontend`

### 7.1 模板库页改造

当前问题：

- 仍依赖 `lib/visual-center/templates.ts`
- 目录是前端常量，不是后端源

目标：

- 页面从后端拉模板目录
- 模板卡片展示后端返回的数据
- 点击模板时走“创建实例”流程

需要改的地方：

- `app/visualize/templates/page.tsx`
- `lib/visual-center/templates.ts` 逐步退役为 mock / fallback

### 7.2 实例列表页改造

当前问题：

- 依赖 `localStorage`
- 只是前端卡片 CRUD，不是真正实例 CRUD

目标：

- 改为后端实例列表
- 支持重命名、复制、删除、继续编辑

需要改的地方：

- `app/visualize/projects/page.tsx`
- `lib/visual-center/storage.ts` 退役为缓存层或开发 fallback

### 7.3 工作台页改造

当前问题：

- 通过前端生成 projectId
- 通过 iframe 直接打开 entry URL

目标：

- 围绕 `instanceId` 驱动
- 打开时先取实例详情
- 再加载模板 runtime
- 再调用 `loadSnapshot(snapshot)`

需要改的地方：

- `app/visualize/workbench/[templateId]/page.tsx`

### 7.4 前端接口封装

建议新增：

- `lib/visual-center/api.ts`

至少封装：

- 获取模板目录
- 获取模板详情
- 创建实例
- 获取实例列表
- 获取实例详情
- 更新实例
- 删除实例
- 复制实例

---

## 8. 宿主 bridge 调用任务

这部分属于平台前端。

### 8.1 一期目标

先支持：

1. 手动保存时调用 `getSnapshot()`
2. 继续编辑时调用 `loadSnapshot(snapshot)`
3. 可选支持 `validateSnapshot()`

### 8.2 一期接入方式

继续沿用：

- `iframe + Vercel`

但增加宿主和模板间的调用桥。

### 8.3 一期建议实现

平台侧需要一个 bridge client，负责：

1. 获取 iframe 引用
2. 发送 `postMessage`
3. 等待模板返回结果
4. 统一处理超时和错误

建议新增：

- `lib/visual-center/bridge.ts`

---

## 9. 保存策略任务

### 9.1 一期推荐策略

平台负责：

1. 手动保存
2. 离开页面前保存
3. 可选防抖自动保存

### 9.2 不建议一期做的事情

不建议“每次操作都立即写数据库”。

原因：

- 请求太频繁
- 噪音太多
- 平台复杂度上升
- 后端压力增大

### 9.3 一期保存闭环

#### 新建实例

1. 用户点模板
2. 平台创建实例
3. 后端写入默认 snapshot
4. 跳转工作台

#### 编辑保存

1. 用户点击保存
2. 平台调用模板 `getSnapshot()`
3. 平台写后端实例

#### 继续编辑

1. 用户点击实例历史记录
2. 平台读取实例 snapshot
3. 平台调用模板 `loadSnapshot(snapshot)`

---

## 10. 推荐开发顺序

### 阶段 A：模板侧并行接入

1. 发出模板接入指南
2. 模板负责人并行做 L1
3. 优先拿 2~3 个模板试点

### 阶段 B：平台后端先落地

1. 建表
2. 写 API
3. 准备 seed

### 阶段 C：平台前端骨架改造

1. 模板库页
2. 实例页
3. 工作台页
4. bridge client

### 阶段 D：M-05 联调

先只接 `M-05`：

1. 从模板库创建实例
2. 打开工作台
3. 保存 snapshot
4. 继续编辑恢复

### 阶段 E：第二模板验证

接入另一个模板，用来验证方案是否足够通用。

---

## 11. 当前建议的第一批试点模板

### 第一优先级

- `m05`

原因：

- 已经接入
- 状态清晰
- 无复杂业务系统

### 第二优先级

- `chem08` 或 `m06`

原因：

- 单页模板
- 适合验证第二个案例

### 第三优先级

- `phys_template_mechanics`

原因：

- 可验证“共享 runtime + 多模板定义”模式

### 暂不作为一期硬目标

- `m01`

原因：

- 已经是完整业务应用
- 需要单独拆解 editor core

---

## 12. 一期里程碑

### 里程碑 1：模板接入规范建立

完成标准：

- 模板接入指南发布
- M-05 样板跑通

### 里程碑 2：后端模型可用

完成标准：

- 数据表创建完成
- 最小 API 可用

### 里程碑 3：前端平台骨架可用

完成标准：

- 模板库页从后端拉数据
- 实例页从后端拉数据
- 工作台以 `instanceId` 驱动

### 里程碑 4：M-05 全链路打通

完成标准：

- 新建实例
- 保存 snapshot
- 继续编辑恢复

### 里程碑 5：第二模板接入验证

完成标准：

- 第二个模板成功复用同一套平台流程

---

## 13. 一期验收标准

### 模板侧验收

1. 至少 1 个模板完成 L1 接入
2. 至少 2 个模板按同一指南完成接入更佳

### 平台侧验收

1. 模板目录来自后端
2. 实例可后端创建
3. 实例可保存 snapshot
4. 实例可从历史记录继续编辑
5. 模板恢复后可继续操作

---

## 14. 当前行动建议

你现在可以立即开始两条线：

### 线 1：发给模板负责人

发送：

- `visual_m05/docs/template-snapshot-bridge-guide.md`

要求他们开始按文档做各自模板的 L1 接入。

### 线 2：平台侧立刻开工

你这边先做：

1. 后端表结构
2. 后端 API
3. 前端模板库页/实例页/工作台骨架

然后拿 `M-05` 做第一轮真实联调。

---

## 15. 最终一句话

当前阶段，不再需要继续停留在方案讨论层面。  
可以正式进入：

> **模板并行接入 + 平台前后端同步开发 + M-05 先行联调验证**

这就是当前最合理的推进方式。
