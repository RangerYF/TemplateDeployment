# 第2阶段：登录与鉴权流程

**所属版本**：V0.5
**风险等级**：L1（常规风险）
**流程路径**：MODE 0 → MODE 3 → MODE 4 → MODE 5 → MODE 6
**前置依赖**：阶段1已完成（路由、API 客户端、authStore）

## 目标

用户可通过登录页完成登录，未登录自动跳转登录页，登录后可访问工作台和编辑器，支持登出。

## 已有基础设施（阶段1产出，直接复用）

- `useAuthStore`：token / isAuthenticated / setToken / clearToken / init
- `apiClient`：get/post/put/delete，自动 Bearer Token 注入，401 自动调 clearToken
- `AuthGuard`：未登录重定向 `/login`
- `router`：`/login`（公开）、`/workspace`、`/editor/:id?`（需登录）
- UI 组件：`Input`（`src/components/ui/input.tsx`）、`Button`（`src/components/ui/button.tsx`）、`Label`（`src/components/ui/label.tsx`）
- 设计系统：`COLORS`（primary `#32D583`、error `#EF4444`、border `#E5E5E5` 等）

## 子任务清单（串行执行）

### 2.1 认证 API 函数

**要做什么**：封装登录接口调用函数。

**涉及文件**：
- `src/lib/api/auth.ts` — 新建

**接口详情**：
```
POST /api/v1/auth/login/
Request Body: { "username": string, "password": string }
Response 200: { "access_token": string, ... }  // 具体结构待确认，至少含 access_token
Response 401: { "detail": "错误描述" }
```

**函数签名**：
```typescript
interface LoginRequest { username: string; password: string }
interface LoginResponse { access_token: string }
function login(data: LoginRequest): Promise<LoginResponse>
```

**注意**：登录接口本身不需要携带 Token（公开接口），但 apiClient 已处理了无 Token 时不注入 header 的逻辑，可直接使用。

---

### 2.2 登录页 UI

**要做什么**：替换 `LoginPage` 占位内容为完整登录表单。

**涉及文件**：
- `src/pages/LoginPage.tsx` — 改造（不新建 `components/auth/` 目录，页面不复杂，直接写在页面组件中）

**UI 要素**：
- 页面居中卡片布局（白色卡片 + 浅色背景）
- 产品名称/Logo 区域（文字即可："数学可视化工作台"）
- 用户名输入框（复用 `Input` 组件）
- 密码输入框（type="password"，复用 `Input` 组件）
- 登录按钮（复用 `Button` variant="primary"，loading 态禁用）
- 错误提示（红色文字，显示接口返回的 detail 或通用错误）
- 表单状态：idle / loading / error

**交互逻辑**：
- 输入为空时按钮禁用
- 点击登录 → 调用 `login()` → 成功：`authStore.setToken(access_token)` → 跳转 `/workspace`
- 失败：显示错误提示
- 支持 Enter 键提交

**样式参考**：使用项目现有 `COLORS` 色系，保持与编辑器一致的视觉风格。

---

### 2.3 登录后重定向逻辑

**要做什么**：已登录用户访问 `/login` 时自动重定向到 `/workspace`。

**涉及文件**：
- `src/pages/LoginPage.tsx` — 在组件顶部添加判断

**逻辑**：
```
如果 isAuthenticated 为 true → Navigate to /workspace
```

---

### 2.4 登出功能

**要做什么**：在编辑器顶栏和工作台页面添加登出入口。

**涉及文件**：
- `src/components/layout/TopBar.tsx` — 右侧添加登出按钮
- `src/pages/WorkspacePage.tsx` — 占位页面中添加临时登出按钮（第3阶段会重建工作台 UI）

**逻辑**：
- 调用 `authStore.clearToken()`
- 使用 `useNavigate()` 跳转到 `/login`

---

### 2.5 注册页占位

**要做什么**：创建注册页占位组件并添加路由，登录页底部添加"去注册"链接。等后端注册接口确认后再实现。

**涉及文件**：
- `src/pages/RegisterPage.tsx` — 新建占位页面（显示"注册功能即将上线"）
- `src/router/index.tsx` — 添加 `/register` 路由
- `src/pages/LoginPage.tsx` — 底部添加"没有账号？去注册"链接

---

## 验收标准

- [x] 未登录访问 `/workspace` 或 `/editor` 自动跳转到 `/login`
- [x] 登录页显示完整表单（用户名、密码、登录按钮）
- [x] 输入正确用户名密码后成功登录并跳转到 `/workspace`
- [x] 登录失败时显示错误提示
- [x] 已登录状态下访问 `/login` 自动跳转到 `/workspace`
- [x] 编辑器顶栏有登出按钮，点击后清除 Token 跳转登录页
- [x] 登录页有"去注册"链接可跳转到注册占位页
- [x] `pnpm lint && pnpm tsc --noEmit` 通过

## 不做的事

- 不实现注册逻辑（等后端接口）
- 不实现"记住密码"/"忘记密码"
- 不实现 Token 刷新（当前 Token 24h 有效期，401 时直接登出）
- 不实现工作台具体内容（第3阶段）
