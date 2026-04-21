# 第3阶段：工作台页面

**所属版本**：V0.5
**风险等级**：L1（常规风险）
**流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**前置依赖**：阶段1-2已完成（路由、API 客户端、authStore、登录流程）

## 目标

用户登录后进入工作台，可浏览作品列表（卡片形式），支持搜索、排序、分页，可新建/删除/打开作品。

## 已有基础设施（直接复用）

- `apiClient`：`src/lib/api/client.ts`（get/post/put/delete，自动 Token 注入）
- `MathProject` 类型 + `ApiListResponse<T>`：`src/lib/api/types.ts`
- `useAuthStore`：token / clearToken
- UI 组件：`Button`、`Input`、`Dialog`（含 DialogContent/Header/Title/Footer）、`EmptyState`、`LoadingState`
- 设计令牌：`COLORS`（primary `#00C06B`、bgPage `#F7F8FA`）、`RADIUS`（card `18px`）、`SHADOWS`
- 路由：`/editor/:id?` 已支持可选 projectId 参数
- `useNavigate`：react-router-dom 导航

## 后端接口（本阶段使用）

```
GET    /api/v1/math-projects/          → ApiListResponse<MathProject>
       Query: search, order_by(created_at|updated_at|name), order(asc|desc), page, page_size

POST   /api/v1/math-projects/          → MathProject
       Body: { name: string, thumbnail?: string, scene_data?: object }

DELETE /api/v1/math-projects/{id}      → 204 No Content
```

## 子任务清单（串行执行）

### 3.1 作品 API 函数封装

**要做什么**：封装作品 CRUD 的 API 调用函数。

**涉及文件**：
- `src/lib/api/projects.ts` — 新建
- `src/lib/api/index.ts` — 补充导出

**函数签名**：
```typescript
interface ListProjectsParams {
  search?: string;
  order_by?: 'created_at' | 'updated_at' | 'name';
  order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

function listProjects(params?: ListProjectsParams): Promise<ApiListResponse<MathProject>>
function createProject(data: { name: string }): Promise<MathProject>
function getProject(id: string): Promise<MathProject>
function updateProject(id: string, data: Partial<Pick<MathProject, 'name' | 'thumbnail' | 'scene_data'>>): Promise<MathProject>
function deleteProject(id: string): Promise<void>
```

---

### 3.2 工作台页面布局

**要做什么**：改造 `WorkspacePage` 为完整工作台布局，替换当前占位内容。

**涉及文件**：
- `src/pages/WorkspacePage.tsx` — 改造

**布局结构**：
```
┌─────────────────────────────────────────────┐
│  顶栏：Logo/产品名  ·····  用户区(登出按钮)   │
├─────────────────────────────────────────────┤
│  操作栏：搜索框  |  排序选择  |  新建作品按钮   │
├─────────────────────────────────────────────┤
│                                             │
│  作品卡片网格（响应式，auto-fill）             │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐        │
│  │     │  │     │  │     │  │     │        │
│  │ 缩略图│  │ 缩略图│  │ 缩略图│  │ 缩略图│        │
│  │ 名称 │  │ 名称 │  │ 名称 │  │ 名称 │        │
│  │ 时间 │  │ 时间 │  │ 时间 │  │ 时间 │        │
│  └─────┘  └─────┘  └─────┘  └─────┘        │
│                                             │
├─────────────────────────────────────────────┤
│  分页：  < 1  2  3 ... >    共 N 个作品      │
└─────────────────────────────────────────────┘
```

**页面背景**：`COLORS.bgPage`（`#F7F8FA`）
**内容区最大宽度**：`max-w-7xl mx-auto`，两侧留 padding

---

### 3.3 作品卡片组件

**要做什么**：创建独立的作品卡片组件。

**涉及文件**：
- `src/components/workspace/ProjectCard.tsx` — 新建

**卡片要素**：
- 缩略图区域（固定宽高比 16:10，有缩略图显示图片，无则显示占位 icon/渐变背景）
- 作品名称（单行截断）
- 更新时间（相对时间，如"3 分钟前"、"2 天前"）
- 悬停效果（阴影增强 + 微上移）
- 右上角更多操作按钮（点击弹出删除选项）

**样式**：白色卡片，圆角 `RADIUS.card`，阴影 `SHADOWS.sm`，hover 时 `SHADOWS.md`。

---

### 3.4 列表渲染与数据获取

**要做什么**：在 WorkspacePage 中调用 `listProjects` 获取数据并渲染卡片网格。

**涉及文件**：
- `src/pages/WorkspacePage.tsx` — 数据获取与状态管理

**状态管理**（组件内 useState，不新建 store）：
```typescript
- projects: MathProject[]
- total: number
- page: number
- loading: boolean
- error: string | null
- search: string
- orderBy: 'updated_at' | 'created_at' | 'name'
- order: 'desc' | 'asc'
```

**加载流程**：
- 组件挂载 + page/search/orderBy/order 变化时 → 调用 `listProjects` → 更新 projects/total
- 加载中显示 `LoadingState` 组件
- 无数据显示 `EmptyState` 组件（区分"无作品"和"搜索无结果"两种文案）
- 请求失败显示错误提示

---

### 3.5 搜索与排序

**要做什么**：实现搜索和排序控件。

**涉及文件**：
- `src/pages/WorkspacePage.tsx` — 操作栏区域

**搜索**：
- 复用 `Input` 组件，placeholder "搜索作品..."
- 输入防抖（300ms），变化时重置 page 为 1

**排序**：
- 复用 `Select` 组件（如果项目有的话）或简单的按钮组/下拉
- 选项：最近更新 / 最近创建 / 名称排序
- 切换时重置 page 为 1

---

### 3.6 分页

**要做什么**：实现底部分页控件。

**涉及文件**：
- `src/components/workspace/Pagination.tsx` — 新建

**功能**：
- 上一页/下一页按钮
- 页码显示（当前页/总页数）
- 总数显示（"共 N 个作品"）
- page_size 固定 20（与后端默认值一致）
- 首页/末页禁用对应按钮

---

### 3.7 新建作品

**要做什么**：点击"新建作品"按钮，弹出命名弹窗，确认后调用 POST 接口创建，然后跳转编辑器。

**涉及文件**：
- `src/pages/WorkspacePage.tsx` — 新建按钮 + 弹窗逻辑

**流程**：
1. 点击"新建作品"按钮
2. 弹出 Dialog：输入作品名称（默认值"未命名作品"），确认/取消
3. 确认 → 调用 `createProject({ name })` → 成功后 `navigate(/editor/${project.id})`
4. 失败 → 弹窗内显示错误

**复用**：`Dialog`、`DialogContent`、`DialogHeader`、`DialogTitle`、`DialogFooter`、`Input`、`Button`

---

### 3.8 删除作品

**要做什么**：作品卡片上的删除操作，需二次确认。

**涉及文件**：
- `src/components/workspace/ProjectCard.tsx` — 删除按钮触发
- `src/pages/WorkspacePage.tsx` — 删除确认弹窗 + 调用 API + 刷新列表

**流程**：
1. 卡片右上角更多按钮 → 点击"删除"
2. 弹出确认 Dialog："确定删除「作品名称」吗？此操作不可恢复。"
3. 确认 → 调用 `deleteProject(id)` → 成功后刷新列表
4. 失败 → 显示错误提示

---

### 3.9 打开作品

**要做什么**：点击卡片跳转编辑器页面。

**涉及文件**：
- `src/components/workspace/ProjectCard.tsx` — 卡片点击事件

**逻辑**：
- 点击卡片（非操作按钮区域）→ `navigate(/editor/${project.id})`

---

## 验收标准

- [x] 工作台页面正确展示当前用户的作品列表（卡片形式）
- [x] 搜索输入后列表按名称过滤，有防抖
- [x] 可切换排序方式（最近更新/最近创建/名称），列表顺序正确变化
- [x] 分页功能正常（页码切换、总数显示）
- [x] 点击"新建作品"弹出命名弹窗，确认后创建作品并跳转编辑器
- [x] 卡片上可删除作品，有二次确认，删除后列表刷新
- [x] 点击卡片跳转到 `/editor/{id}`
- [x] 空状态（无作品 / 搜索无结果）有友好提示
- [x] 加载中显示 loading 状态
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 不做的事

- 不实现编辑器内的数据加载/保存（第4阶段）
- 不实现作品重命名（可在第4阶段编辑器内实现）
- 不实现批量操作（多选删除等）
- 不实现列表/网格视图切换
- 不实现虚拟滚动（作品量不大时无需优化）
