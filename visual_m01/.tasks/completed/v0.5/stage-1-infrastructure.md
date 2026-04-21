# 第1阶段：基础设施搭建

**所属版本**：V0.5
**风险等级**：L1（常规风险，1-3文件以上改动，常规功能）
**流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6

## 目标

项目具备多页面路由能力、统一的 API 请求层和认证状态管理，为后续所有阶段提供底层支撑。

## 子任务清单（串行执行）

### 1.1 安装依赖

**要做什么**：安装 `react-router-dom`。HTTP 客户端使用原生 `fetch` 封装，不额外引入 axios。

**涉及文件**：
- `package.json` — 新增 react-router-dom

---

### 1.2 环境变量配置

**要做什么**：创建环境变量文件，配置 API Base URL 占位。同步更新 `.gitignore` 确保 `.env.local` 不被提交。

**涉及文件**：
- `.env.development` — `VITE_API_BASE_URL=http://localhost:8000`（占位值，待确认后替换）
- `.env.production` — `VITE_API_BASE_URL=`（待填入生产地址）
- `.gitignore` — 确认 `.env.local` 已忽略
- `src/vite-env.d.ts` — 补充 `ImportMetaEnv` 类型声明（`VITE_API_BASE_URL`）

---

### 1.3 API 客户端封装

**要做什么**：基于 `fetch` 封装统一的 API 请求模块，功能包括：
- 自动读取 `VITE_API_BASE_URL` 拼接请求地址
- 自动从 localStorage 读取 Token 并注入 `Authorization: Bearer` 请求头
- 统一 JSON 请求/响应处理
- 统一错误处理（抛出包含 status 和 detail 的自定义错误）
- 401 响应时触发登出（清除 Token + 跳转登录页）—— 登出回调在 1.4 认证 Store 中注入

**涉及文件**：
- `src/lib/api/client.ts` — fetch 封装（`apiClient.get/post/put/delete`）
- `src/lib/api/types.ts` — API 错误类型、通用响应类型
- `src/lib/api/index.ts` — 统一导出

**关键设计**：
```
apiClient 结构：
- baseUrl: 从 import.meta.env.VITE_API_BASE_URL 读取
- getToken(): 从 localStorage 读取
- onUnauthorized: 可注入的 401 回调（由 authStore 设置）
- request(method, path, options): 核心请求方法
- get/post/put/delete: 快捷方法
```

---

### 1.4 认证 Store

**要做什么**：创建 Zustand store 管理认证状态。

**涉及文件**：
- `src/editor/store/authStore.ts` — 认证状态管理
- `src/editor/store/index.ts` — 导出 `useAuthStore`

**Store 结构**：
```
authStore:
- token: string | null          // JWT Token
- isAuthenticated: boolean      // 计算属性（token !== null）
- setToken(token): void         // 登录成功后设置（同步写 localStorage）
- clearToken(): void            // 登出时清除（同步清 localStorage）
- init(): void                  // 应用启动时从 localStorage 读取 Token
```

**localStorage key**: `auth_token`

**与 API 客户端的关联**：authStore 初始化时将 `clearToken` 注册为 apiClient 的 `onUnauthorized` 回调，实现 401 自动登出。

---

### 1.5 路由结构搭建

**要做什么**：配置 react-router-dom 路由，定义三个页面路由。本阶段各页面使用占位组件，不实现具体功能。

**涉及文件**：
- `src/router/index.tsx` — 路由配置（createBrowserRouter）
- `src/router/AuthGuard.tsx` — 路由守卫组件（读取 authStore 判断登录态，未登录重定向 `/login`）
- `src/pages/LoginPage.tsx` — 登录页占位（仅显示"登录页"文字）
- `src/pages/WorkspacePage.tsx` — 工作台占位（仅显示"工作台"文字）
- `src/pages/EditorPage.tsx` — 编辑器页（包裹现有 `AppLayout` + `Scene3D`）

**路由结构**：
```
/login          → LoginPage（公开路由）
/workspace      → WorkspacePage（需登录）
/editor/:id?    → EditorPage（需登录，可选 projectId 参数）
/               → 重定向到 /workspace
```

---

### 1.6 改造入口文件

**要做什么**：改造 `main.tsx` 和 `App.tsx`，将现有编辑器嵌入路由体系。

**涉及文件**：
- `src/main.tsx` — 引入 RouterProvider，挂载路由
- `src/App.tsx` — 改为路由根布局或移除（由 router 直接管理页面）

**改造方案**：
- `main.tsx`：替换 `<App />` 为 `<RouterProvider router={router} />`，在 RouterProvider 之前调用 `authStore.init()` 初始化 Token
- `App.tsx`：保留为根布局组件（仅包裹 `<Outlet />`），或直接由 router 配置管理
- `EditorPage.tsx`：内部引用 `useEditorInit()` + `<AppLayout>` + `<Scene3D />`，保持现有编辑器功能不变

---

## Vite 代理配置（待 Base URL 确认后）

当后端 Base URL 确认后，在 `vite.config.ts` 中添加开发代理：
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://实际后端地址',
      changeOrigin: true,
    }
  }
}
```
本阶段先不配置代理，使用环境变量中的完整 URL。

---

## 验收标准

- [x] `pnpm dev` 启动后，访问 `/login` 显示登录页占位
- [x] 访问 `/workspace` 显示工作台占位（或被守卫重定向到 `/login`）
- [x] 访问 `/editor` 显示完整的现有编辑器界面，功能不受影响
- [x] 手动在 localStorage 设置 `auth_token` 后，路由守卫放行工作台页
- [x] apiClient 发起请求时自动携带 Authorization 请求头
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 不做的事

- 不实现登录表单和登录逻辑（第2阶段）
- 不实现工作台内容（第3阶段）
- 不实现数据持久化（第4阶段）
- 不配置 Vite 代理（等 Base URL 确认）
