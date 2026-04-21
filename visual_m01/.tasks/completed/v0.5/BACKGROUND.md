# V0.5 主任务文档

## 任务背景

项目当前为纯前端 3D 数学可视化编辑器（React + Three.js + Zustand），无用户系统和持久化能力。V0.5 需要对接后端 API，实现用户认证和作品管理功能，并新增工作台页面作为作品管理入口。

## 版本目标

1. **用户认证**：登录、注册功能，JWT Token 管理
2. **工作台页面**：作品列表展示、搜索、排序、新建/打开/删除作品
3. **作品持久化**：作品的创建、保存（更新）、打开（加载）功能，对接后端 CRUD 接口

## 功能清单

### 1. 用户认证模块
- 登录页面（用户名 + 密码）
- 注册页面（待确认：后端注册接口文档暂缺，需补充）
- Token 存储与自动携带
- Token 过期处理（24小时有效期）
- 登出功能

### 2. 工作台页面
- 作品卡片列表展示（名称、缩略图、更新时间）
- 搜索（按名称模糊搜索）
- 排序（按创建时间/更新时间/名称）
- 分页
- 新建作品入口
- 打开已有作品（跳转编辑器）
- 删除作品（二次确认）

### 3. 作品管理（编辑器侧）
- 新建作品时调用 POST 创建接口
- 保存作品（PUT 更新 scene_data）
- 自动保存 / 手动保存（待讨论）
- 缩略图生成与上传（3D 视图截图）

### 4. 路由与页面结构
- 需引入路由库（当前项目无 react-router）
- 页面：登录页 → 工作台页 → 编辑器页
- 未登录自动跳转登录页

## 后端接口概览

| 功能 | 方法 | 路径 | 备注 |
|------|------|------|------|
| 登录 | POST | `/api/v1/auth/login/` | 返回 JWT access_token |
| 获取作品列表 | GET | `/api/v1/math-projects/` | 支持 search/order_by/page 等参数 |
| 创建作品 | POST | `/api/v1/math-projects/` | name 必填，scene_data 可选 |
| 获取单个作品 | GET | `/api/v1/math-projects/{project_id}` | |
| 更新作品 | PUT | `/api/v1/math-projects/{project_id}` | 所有字段可选 |
| 删除作品 | DELETE | `/api/v1/math-projects/{project_id}` | 返回 204 |

认证方式：所有接口需 `Authorization: Bearer <token>` 请求头。

## 参考文件

- 后端接口文档：`docs/后端文档/math project 后端接口.md`
- 当前项目入口：`src/main.tsx` / `src/App.tsx`
- 状态管理：Zustand（`zustand@5`）
- 样式：TailwindCSS 3
- 构建工具：Vite 7

## 当前技术栈

- React 19 + TypeScript
- Three.js + @react-three/fiber + @react-three/drei
- Zustand 5（状态管理）
- TailwindCSS 3
- Vite 7
- react-router-dom v7.13.1（V0.5 阶段1新增）
- HTTP 客户端：原生 fetch 封装（`src/lib/api/client.ts`）

## 已确认决策

- **路由库**：react-router-dom v7.13.1
- **HTTP 客户端**：原生 fetch 封装，放在 `src/lib/api/`
- **认证 Store**：Zustand，`src/editor/store/authStore.ts`，Token 存 localStorage（key: `auth_token`）
- **401 处理**：apiClient 收到 401 时调用 authStore.clearToken() 自动登出
- **保存策略**：综合策略 — 手动保存按钮 + 定时自动保存 + 离开页面时保存（beforeunload）
- **缩略图方案**：保存时同步截取 3D Canvas 视图，随 scene_data 一起上传更新
- **scene_data 序列化**：复用 entityStore 已有的 `getSnapshot()` / `loadSnapshot()`
- **路由结构**：`/login`（公开）、`/register`（公开占位）、`/workspace`（需登录）、`/editor/:id?`（需登录）、`/` 重定向
- **工作台模板**：工作台默认展示 13 种几何体模板卡片（按 GEOMETRY_GROUPS 分组），hover 显示"使用模板"按钮，点击即新建作品并进入对应几何体编辑器
- **Mock 模式**：后端未就绪时，auth 和 projects API 使用 localStorage mock，通过 `USE_MOCK` 开关统一管理
- **多学科模板体系**：学科(数学/物理/化学) → 模块(29个) → 模板，配置文件 `src/config/templates.ts`
- **AI 预留**：工作台预留意图输入框，未来接入大模型实现模板推荐和 AI 生成作品

## 开发进度

- [x] 第1阶段：基础设施搭建（路由 + API客户端 + 认证Store）
- [x] 第2阶段：登录与鉴权流程
- [x] 第3阶段：工作台页面
- [x] 第4阶段：编辑器持久化
- [x] 第5阶段：模板推荐 & Mock 模式
- [ ] 第6阶段：多学科模板体系 & AI 预留

## 待确认事项

1. 注册接口：后端文档只有登录接口，注册接口路径和字段需向后端确认
2. 后端 Base URL：当前用环境变量占位 `http://localhost:8000`
