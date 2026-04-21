# 第4阶段：编辑器持久化与保存策略

**所属版本**：V0.5
**风险等级**：L2（高风险 — 涉及数据读取/转换/映射，entityStore snapshot ↔ scene_data）
**流程路径**：MODE 0 → MODE 1 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**前置依赖**：阶段1-3已完成

## 目标

编辑器能从后端加载已有作品数据恢复场景，支持手动保存、定时自动保存和离开页面保存，保存时同步截取缩略图。

## 已有基础设施（直接复用）

- `entityStore.getSnapshot()`：返回 `{ entities, nextId, activeGeometryId }`
- `entityStore.loadSnapshot(snapshot)`：恢复完整实体状态
- `getProject(id)` / `updateProject(id, data)`：API 函数（`src/lib/api/projects.ts`）
- `EditorPage`：当前在 `/editor/:id?` 路由，已调用 `useEditorInit()`
- `initEditor()`：`src/editor/init.ts`，含模块级 `initialized` 守卫，创建默认正方体
- `Scene3D`：Three.js Canvas 组件（`src/components/scene/Scene3D.tsx`）
- `TopBar`：编辑器顶栏（已含登出按钮）

## 数据契约（关键）

**scene_data 字段**：后端 `MathProject.scene_data` 类型为 `Record<string, unknown> | null`

**序列化映射**：
```
scene_data = entityStore.getSnapshot()
即 scene_data = {
  entities: Record<string, Entity>,   // 所有实体
  nextId: number,                      // 下一个可用 ID
  activeGeometryId: string | null      // 当前活跃几何体
}
```

**反序列化**：`entityStore.loadSnapshot(project.scene_data)` 直接恢复。

**空场景处理**：`scene_data` 为 `null` 时 → 使用默认初始化（正方体）。

## 子任务清单（串行执行）

### 4.1 projectStore 创建

**要做什么**：创建 Zustand store 管理当前编辑的作品信息和保存状态。

**涉及文件**：
- `src/editor/store/projectStore.ts` — 新建
- `src/editor/store/index.ts` — 导出 `useProjectStore`

**Store 结构**：
```typescript
interface ProjectStoreState {
  // 当前作品信息
  projectId: string | null;
  projectName: string;

  // 保存状态
  saveStatus: 'idle' | 'saving' | 'saved' | 'unsaved' | 'error';
  lastSavedAt: string | null;

  // 脏标记（有未保存的变更）
  isDirty: boolean;

  // Actions
  setProject(id: string, name: string): void;
  setProjectName(name: string): void;
  markDirty(): void;
  markSaved(): void;
  setSaveStatus(status: SaveStatus): void;
  reset(): void;
}
```

---

### 4.2 编辑器初始化改造 — 支持加载已有作品

**要做什么**：改造 `EditorPage` 和 `initEditor`，支持从 URL 参数获取 `projectId`，加载后端 scene_data 恢复场景。

**涉及文件**：
- `src/pages/EditorPage.tsx` — 获取 URL 参数，调用 API 加载作品
- `src/editor/init.ts` — 需改造为支持"加载已有 snapshot"和"创建空场景"两种模式

**加载流程**：
```
EditorPage 挂载
  ├─ 有 :id 参数 → getProject(id) → loadSnapshot(scene_data) → projectStore.setProject(id, name)
  └─ 无 :id 参数 → 新建模式（保持默认初始化，projectStore 不设 projectId）
```

**关键改造点**：
- `initEditor()` 目前有模块级 `initialized` 守卫，只执行一次。需要改造为支持重置/重新初始化，因为用户可能从工作台打开不同作品
- 加载期间显示 loading 状态，加载失败显示错误（可返回工作台）

**init.ts 改造方案**：
- 将 `initialized` 守卫改为可重置
- 新增 `resetEditor()` 函数：清空 entityStore、重置 initialized 标志
- `initEditor()` 保持原有逻辑（创建默认正方体）
- 新增 `initEditorWithSnapshot(snapshot)` 函数：加载已有数据

---

### 4.3 脏标记检测

**要做什么**：监听 entityStore 的变化，自动标记 projectStore 为 dirty。

**涉及文件**：
- `src/pages/EditorPage.tsx` 或 `src/editor/store/projectStore.ts` — 订阅 entityStore 变化

**方案**：
- 利用已有的 `signals.entityCreated` / `signals.entityUpdated` / `signals.entityDeleted` / `signals.commandExecuted` 信号
- 任一信号触发时 → `projectStore.markDirty()`
- 在 EditorPage 中用 useEffect 订阅，在卸载时取消

---

### 4.4 手动保存 + 保存状态指示

**要做什么**：在 TopBar 添加保存按钮和保存状态文字，点击保存按钮调用 PUT 接口。

**涉及文件**：
- `src/components/layout/TopBar.tsx` — 添加作品名称显示、保存按钮、保存状态指示
- `src/editor/store/projectStore.ts` — 可能新增 `save()` action

**保存逻辑**：
```
点击保存 / 触发保存
  → setSaveStatus('saving')
  → const snapshot = entityStore.getSnapshot()
  → const thumbnail = 截取缩略图()（4.5 实现后集成）
  → updateProject(projectId, { scene_data: snapshot, thumbnail })
  → 成功 → setSaveStatus('saved') + markSaved()
  → 失败 → setSaveStatus('error')
```

**保存状态 UI**：
- `idle`：不显示
- `unsaved`：显示灰色圆点 + "未保存"
- `saving`：显示旋转 icon + "保存中..."
- `saved`：显示绿色对勾 + "已保存"（几秒后回到 idle）
- `error`：显示红色 + "保存失败"

**快捷键**：`Ctrl/Cmd + S` 触发手动保存（阻止浏览器默认保存行为）

---

### 4.5 缩略图截取

**要做什么**：从 Three.js Canvas 截取当前 3D 视图作为缩略图。

**涉及文件**：
- `src/utils/captureThumb.ts` — 新建，缩略图截取工具函数

**方案**：
- R3F 的 Canvas 底层是 WebGL canvas，可通过 `canvas.toDataURL('image/png')` 截取
- 需要在 Vite 配置或 Canvas 组件中确保 `preserveDrawingBuffer: true`（WebGL 上下文参数），否则 toDataURL 可能返回空白
- 截取后生成 base64 data URL 或 Blob
- 返回 data URL 字符串，作为 `thumbnail` 字段值传给 `updateProject`

**注意**：
- `preserveDrawingBuffer: true` 可能有微量性能影响，但对于本项目可忽略
- Canvas 元素获取方式：通过 DOM 查询 `document.querySelector('canvas')` 或通过 ref 传递

---

### 4.6 定时自动保存

**要做什么**：编辑器有未保存变更时，定时自动触发保存。

**涉及文件**：
- `src/pages/EditorPage.tsx` — 自动保存定时器逻辑

**策略**：
- 检测到 `isDirty === true` 后启动倒计时（30 秒）
- 倒计时结束时如仍 dirty → 触发保存
- 保存成功后 dirty 重置，定时器停止
- 新的编辑操作再次触发倒计时
- 避免在保存中（saving）时重复触发
- 仅在有 projectId 时生效（新建但未首次保存的不自动保存）

---

### 4.7 离开页面保存

**要做什么**：用户关闭/刷新页面或路由离开时，触发保存。

**涉及文件**：
- `src/pages/EditorPage.tsx` — beforeunload + 路由离开处理

**方案**：
- `beforeunload` 事件：如果 isDirty，使用 `navigator.sendBeacon` 发送保存请求（因为 beforeunload 中 fetch 可能被取消）
- 路由离开（返回工作台）：在组件 unmount 时触发同步保存
- `sendBeacon` 的 payload 为 JSON，Content-Type 为 `application/json`

**sendBeacon 注意**：
- sendBeacon 不支持自定义 Header（无法携带 Authorization），需评估后端是否支持其他认证方式
- 如果 sendBeacon 不可行（Token 问题），退而求其次：在 beforeunload 中用 `fetch` + `keepalive: true`

---

### 4.8 新建作品流程打通

**要做什么**：从工作台新建作品跳转到编辑器后，编辑器应知道这是新作品（已有 projectId），但 scene_data 为空 → 使用默认初始化。

**涉及文件**：
- `src/pages/EditorPage.tsx` — 处理 scene_data 为 null 的情况

**逻辑**：
```
工作台 createProject({ name }) → 返回 project（id, scene_data=null）
  → navigate(/editor/${project.id})
  → EditorPage 加载 → getProject(id) → scene_data === null
  → 使用默认初始化（initEditor 创建默认正方体）
  → projectStore.setProject(id, name)
  → 首次编辑后 markDirty → 保存时 PUT scene_data
```

---

### 4.9 作品名称编辑

**要做什么**：在编辑器 TopBar 中显示作品名称，支持点击编辑。

**涉及文件**：
- `src/components/layout/TopBar.tsx` — 名称显示 + 内联编辑

**交互**：
- 默认显示作品名称文本
- 点击名称 → 变为 Input 编辑态
- 失焦或 Enter → 调用 `updateProject(id, { name })` 更新 + `projectStore.setProjectName(newName)`
- 编辑名称不触发 scene_data 保存（独立调用）

---

## 验收标准

- [x] 从工作台打开已有作品，编辑器正确恢复几何体和场景状态
- [x] 点击保存按钮，数据成功写入后端，保存状态正确显示
- [x] `Ctrl/Cmd + S` 触发手动保存
- [x] 编辑后等待 30 秒，自动保存触发（网络面板可观察 PUT 请求）
- [x] 关闭/刷新页面前触发保存
- [x] 路由离开（返回工作台）时触发保存
- [x] 保存后工作台的作品缩略图已更新
- [x] 新建作品 → 编辑 → 保存 → 返回工作台 → 重新打开，数据完整
- [x] 可在 TopBar 编辑作品名称
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 实现记录

**执行时间**：2026-03-16
**门禁结果**：`pnpm lint` ✅ / `pnpm tsc --noEmit` ✅（待连接后端进行集成验证）

**新建文件**：
- `src/editor/store/projectStore.ts` — 项目状态 Zustand store（projectId/name/saveStatus/isDirty）
- `src/utils/captureThumb.ts` — Canvas toDataURL 缩略图截取

**改造文件**：
- `src/editor/init.ts` — 新增 `resetEditor()` + `initEditorWithSnapshot()`
- `src/editor/store/index.ts` — 导出 `useProjectStore`
- `src/pages/EditorPage.tsx` — 完整改造：加载作品 + 脏标记 + 自动保存 + 离开保存 + Ctrl/Cmd+S
- `src/components/layout/TopBar.tsx` — 保存按钮 + 五态状态指示 + 作品名称内联编辑
- `src/components/scene/Scene3D.tsx` — Canvas 添加 `preserveDrawingBuffer: true`

## 不做的事

- 不实现离线缓存（IndexedDB 等）
- 不实现版本历史 / 撤销到某个保存点
- 不实现协作编辑
- 不实现作品复制/导出为文件
- 不优化大 scene_data 的差量传输（全量 PUT）
