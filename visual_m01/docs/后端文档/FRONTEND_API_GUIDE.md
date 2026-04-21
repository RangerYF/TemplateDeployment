# 前端对接接口文档

> **Base URL**: `http://<host>:<port>/api/v1`
>
> 本文档覆盖：认证、用户注册、文件上传（OSS）、数学作品 CRUD 五大模块。
>
> 最后更新：2026-03-17

---

## 目录

- [一、认证机制说明](#一认证机制说明)
- [二、认证相关接口](#二认证相关接口)
  - [2.1 用户登录（用户名）](#21-用户登录用户名)
  - [2.2 用户登录（邮箱）](#22-用户登录邮箱)
  - [2.3 刷新令牌](#23-刷新令牌)
  - [2.4 用户登出](#24-用户登出)
  - [2.5 用户注册](#25-用户注册)
- [三、文件上传接口（OSS）](#三文件上传接口oss)
  - [3.1 图片上传（推荐用于 thumbnail）](#31-图片上传推荐用于-thumbnail)
  - [3.2 通用文件上传](#32-通用文件上传)
  - [3.3 视频上传](#33-视频上传)
  - [3.4 文档上传](#34-文档上传)
  - [3.5 删除已上传文件](#35-删除已上传文件)
  - [3.6 分片上传（大文件）](#36-分片上传大文件)
- [四、数学作品 CRUD](#四数学作品-crud)
  - [4.1 获取作品列表](#41-获取作品列表)
  - [4.2 获取单个作品](#42-获取单个作品)
  - [4.3 创建作品](#43-创建作品)
  - [4.4 更新作品](#44-更新作品)
  - [4.5 删除作品](#45-删除作品)
- [五、典型业务流程：上传缩略图并保存到作品](#五典型业务流程上传缩略图并保存到作品)
- [六、错误响应格式](#六错误响应格式)

---

## 一、认证机制说明

- 认证方式：**JWT Bearer Token**
- 登录后获取 `access_token` 和 `refresh_token`
- 需要认证的接口，请求头中携带：
  ```
  Authorization: Bearer <access_token>
  ```
- `access_token` 过期后，使用 `refresh_token` 换取新的令牌对
- 上传接口（`/upload/*`）**无需认证**
- 数学作品接口（`/subject-templates/math-projects/*`）**需要认证**

---

## 二、认证相关接口

### 2.1 用户登录（用户名）

```
POST /api/v1/auth/login/
```

**请求体** (`application/json`):

```json
{
  "username": "zhangsan",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名 |
| `password` | string | 是 | 密码 |

**成功响应** (`200`):

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "Bearer",
    "user": {
      "id": "uuid-string",
      "username": "zhangsan",
      "email": "zhangsan@example.com"
    }
  }
}
```

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 400 | 用户名和密码不能为空 |
| 401 | 用户名或密码错误 |
| 403 | 账户已被禁用 |

---

### 2.2 用户登录（邮箱）

```
POST /api/v1/auth/login/email
```

**请求体** (`application/json`):

```json
{
  "email": "zhangsan@example.com",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | string (email) | 是 | 邮箱地址 |
| `password` | string | 是 | 密码 |

**响应格式与用户名登录一致。**

---

### 2.3 刷新令牌

```
POST /api/v1/auth/login/refresh
```

**请求体** (`application/json`):

```json
{
  "refresh_token": "eyJhbGciOi..."
}
```

**成功响应** (`200`):

```json
{
  "success": true,
  "message": "令牌刷新成功",
  "data": {
    "access_token": "新的access_token",
    "refresh_token": "新的refresh_token",
    "token_type": "Bearer"
  }
}
```

**错误响应**: `401` — 无效或已过期的刷新令牌

**前端建议**: 使用 axios 拦截器，在 `access_token` 过期（401）时自动调用此接口刷新，无感续期。

---

### 2.4 用户登出

```
POST /api/v1/auth/logout/
```

**请求头**:

```
Authorization: Bearer <access_token>
```

**请求体**: 无

**成功响应** (`200`):

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**说明**: 后端会从 Redis 中删除该 token，使其立即失效。

---

### 2.5 用户注册

```
POST /api/v1/users
```

> 注意：此接口有**频率限制**，每个 IP 每小时最多 5 次请求。

**请求体** (`application/json`):

```json
{
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "password": "123456",
  "role_id": "角色UUID"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名 |
| `email` | string | 是 | 邮箱 |
| `password` | string | 是 | 密码（明文，后端会哈希处理） |
| `role_id` | string | 是 | 角色 ID（需先通过 `GET /api/v1/users/roles` 获取可用角色列表） |

**成功响应** (`200`):

```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "username": "zhangsan",
    "email": "zhangsan@example.com"
  }
}
```

**错误响应**: `400` — 邮箱已注册 / 用户名已存在等

---

## 三、文件上传接口（OSS）

所有上传接口使用 `multipart/form-data` 格式，文件上传到阿里云 OSS，返回公开可访问的 URL。

### 文件类型限制一览

| 类型 | 允许格式 | 大小限制 |
|------|----------|----------|
| `image` | .jpg, .jpeg, .png, .gif, .webp, .svg | 10 MB |
| `video` | .mp4, .mov, .avi, .webm | 5 GB |
| `document` | .pdf, .txt, .doc, .docx | 50 MB |

---

### 3.1 图片上传（推荐用于 thumbnail）

```
POST /api/v1/upload/image
```

**请求格式**: `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 图片文件（.jpg/.png/.gif/.webp/.svg） |

**成功响应** (`200`):

```json
{
  "success": true,
  "data": {
    "url": "https://bucket.oss-cn-xxx.aliyuncs.com/images/2026/03/17/a1b2c3d4e5f6.png",
    "key": "images/2026/03/17/a1b2c3d4e5f6.png",
    "filename": "screenshot.png",
    "size": 102400,
    "mime_type": "image/png",
    "file_type": "image"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | string | 文件的公开访问 URL，**用于 thumbnail 字段** |
| `key` | string | OSS 对象键，**用于后续删除文件** |
| `filename` | string | 原始文件名 |
| `size` | integer | 文件大小（字节） |
| `mime_type` | string | MIME 类型 |
| `file_type` | string | 文件类别 (`"image"`) |

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 400 | 不支持的文件格式 / 文件超过大小限制 |
| 502 | OSS 上传失败（后端服务异常） |

**前端对接示例**:

```typescript
async function uploadThumbnail(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/v1/upload/image', {
    method: 'POST',
    body: formData,
    // 注意：不要手动设置 Content-Type，浏览器会自动带上 boundary
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '上传失败');
  }

  const json = await res.json();
  return json.data.url; // 返回图片 URL，后续用于 PUT 更新作品
}
```

---

### 3.2 通用文件上传

```
POST /api/v1/upload/
```

**请求格式**: `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_type` | string (query param) | 是 | 文件类别：`"image"` \| `"video"` \| `"document"` |
| `file` | File | 是 | 文件 |

**响应格式同图片上传。**

---

### 3.3 视频上传

```
POST /api/v1/upload/video
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 视频文件（.mp4/.mov/.avi/.webm），最大 5 GB |

**响应格式同图片上传。**

> 超过 100MB 的视频建议使用[分片上传](#36-分片上传大文件)。

---

### 3.4 文档上传

```
POST /api/v1/upload/document
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 文档文件（.pdf/.txt/.doc/.docx），最大 50 MB |

**响应格式同图片上传。**

---

### 3.5 删除已上传文件

```
DELETE /api/v1/upload/
```

**请求体** (`application/json`):

```json
{
  "key": "images/2026/03/17/a1b2c3d4e5f6.png"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `key` | string | 是 | 上传时返回的 `key` 值（OSS 对象键） |

**成功响应** (`200`):

```json
{
  "success": true,
  "message": "文件已删除：images/2026/03/17/a1b2c3d4e5f6.png"
}
```

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 404 | 文件不存在 |
| 502 | OSS 删除失败 |

---

### 3.6 分片上传（大文件）

适用于大文件（视频等），支持断点续传。流程如下：

```
初始化 → 逐片上传 → 合并完成
         ↘ (可选) 查询已上传分片（断点续传）
         ↘ (可选) 取消上传
```

#### 3.6.1 初始化分片上传

```
POST /api/v1/upload/multipart/init
```

**请求体** (`application/json`):

```json
{
  "filename": "lecture.mp4",
  "file_type": "video",
  "content_type": "video/mp4"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `filename` | string | 是 | 文件名 |
| `file_type` | string | 是 | `"image"` \| `"video"` \| `"document"` |
| `content_type` | string | 否 | MIME 类型，不传则自动识别 |

**响应**:

```json
{
  "success": true,
  "data": {
    "upload_id": "0004B9894A22E5B1-...",
    "key": "videos/2026/03/17/a1b2c3d4e5f6.mp4",
    "filename": "lecture.mp4"
  }
}
```

#### 3.6.2 上传分片

```
POST /api/v1/upload/multipart/part
```

**请求格式**: `multipart/form-data` + Query 参数

| 字段 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `upload_id` | query | string | 是 | 初始化返回的 upload_id |
| `key` | query | string | 是 | 初始化返回的 key |
| `part_number` | query | integer | 是 | 分片序号（从 1 开始，最大 10000） |
| `file` | body | File | 是 | 分片数据（建议 5~20 MB） |

**响应**:

```json
{
  "success": true,
  "data": {
    "upload_id": "0004B9894A22E5B1-...",
    "part_number": 1,
    "etag": "\"5eb63bbbe01eeed093cb22bb8f5acdc3\""
  }
}
```

> 前端需保存每个分片返回的 `part_number` 和 `etag`，用于最终合并。

#### 3.6.3 查询已上传分片（断点续传）

```
GET /api/v1/upload/multipart/parts?upload_id=xxx&key=xxx
```

**响应**:

```json
{
  "success": true,
  "data": {
    "upload_id": "xxx",
    "key": "videos/2026/03/17/xxx.mp4",
    "parts": [
      { "part_number": 1, "etag": "\"xxx\"", "size": 10485760 },
      { "part_number": 2, "etag": "\"yyy\"", "size": 10485760 }
    ]
  }
}
```

#### 3.6.4 完成分片上传

```
POST /api/v1/upload/multipart/complete
```

**请求体** (`application/json`):

```json
{
  "upload_id": "0004B9894A22E5B1-...",
  "key": "videos/2026/03/17/a1b2c3d4e5f6.mp4",
  "filename": "lecture.mp4",
  "file_type": "video",
  "parts": [
    { "part_number": 1, "etag": "\"5eb63bbbe01eeed093cb22bb8f5acdc3\"" },
    { "part_number": 2, "etag": "\"7c211433f02024a5b5903e30aef1d7e8\"" }
  ]
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "url": "https://bucket.oss-cn-xxx.aliyuncs.com/videos/2026/03/17/a1b2c3d4e5f6.mp4",
    "key": "videos/2026/03/17/a1b2c3d4e5f6.mp4",
    "filename": "lecture.mp4",
    "file_type": "video"
  }
}
```

#### 3.6.5 取消分片上传

```
DELETE /api/v1/upload/multipart/abort
```

**请求体** (`application/json`):

```json
{
  "upload_id": "0004B9894A22E5B1-...",
  "key": "videos/2026/03/17/a1b2c3d4e5f6.mp4"
}
```

**响应**:

```json
{
  "success": true,
  "message": "分片上传已取消"
}
```

---

## 四、数学作品 CRUD

> 以下接口均**需要认证**，请求头必须携带 `Authorization: Bearer <access_token>`。
>
> 所有作品数据按用户隔离，每个用户只能访问/操作自己的作品。

### 4.1 获取作品列表

```
GET /api/v1/subject-templates/math-projects/
```

**Query 参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `search` | string | 否 | - | 按名称模糊搜索 |
| `order_by` | string | 否 | `"updated_at"` | 排序字段：`"created_at"` \| `"updated_at"` \| `"name"` |
| `order` | string | 否 | `"desc"` | 排序方向：`"asc"` \| `"desc"` |
| `page` | integer | 否 | 1 | 页码（>=1） |
| `page_size` | integer | 否 | 20 | 每页数量（1~100） |

**成功响应** (`200`):

```json
{
  "total": 42,
  "items": [
    {
      "id": "uuid-string",
      "user_id": "uuid-string",
      "name": "勾股定理演示",
      "thumbnail": "https://bucket.oss-cn-xxx.aliyuncs.com/images/2026/03/17/xxx.png",
      "scene_data": { "...excalidraw场景数据..." },
      "created_at": "2026-03-17T10:00:00+08:00",
      "updated_at": "2026-03-17T12:30:00+08:00"
    }
  ]
}
```

**响应字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | integer | 符合条件的总记录数 |
| `items` | array | 当前页的作品列表 |
| `items[].id` | string (UUID) | 作品唯一 ID |
| `items[].user_id` | string (UUID) | 所属用户 ID |
| `items[].name` | string | 作品名称 |
| `items[].thumbnail` | string \| null | 缩略图 URL（来自 OSS 上传） |
| `items[].scene_data` | object \| null | 画布/场景数据（JSON） |
| `items[].created_at` | string (datetime) | 创建时间 |
| `items[].updated_at` | string (datetime) | 最后更新时间 |

---

### 4.2 获取单个作品

```
GET /api/v1/subject-templates/math-projects/{template_id}
```

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `template_id` | string | 作品 ID |

**成功响应** (`200`): 返回单个作品对象（格式同列表中的 item）。

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 404 | 作品不存在 |
| 403 | 无权访问该作品（不是自己的） |

---

### 4.3 创建作品

```
POST /api/v1/subject-templates/math-projects/
```

**请求体** (`application/json`):

```json
{
  "name": "勾股定理演示",
  "thumbnail": "https://bucket.oss-cn-xxx.aliyuncs.com/images/2026/03/17/xxx.png",
  "scene_data": { "...画布数据..." }
}
```

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `name` | string | 是 | 长度 1~255 | 作品名称 |
| `thumbnail` | string | 否 | - | 缩略图 URL（先调上传接口获取） |
| `scene_data` | any | 否 | - | 画布/场景 JSON 数据 |

**成功响应** (`201 Created`): 返回创建后的完整作品对象。

---

### 4.4 更新作品

```
PUT /api/v1/subject-templates/math-projects/{template_id}
```

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `template_id` | string | 作品 ID |

**请求体** (`application/json`): 仅需传入要更新的字段（支持部分更新）。

```json
{
  "name": "新名称",
  "thumbnail": "https://bucket.oss-cn-xxx.aliyuncs.com/images/2026/03/17/new-thumb.png",
  "scene_data": { "...更新后的画布数据..." }
}
```

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `name` | string | 否 | 长度 1~255，自动 trim | 更新名称 |
| `thumbnail` | string | 否 | - | 新的缩略图 URL |
| `scene_data` | any | 否 | - | 新的画布/场景 JSON 数据 |

**成功响应** (`200`): 返回更新后的完整作品对象。

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 404 | 作品不存在 |
| 403 | 无权操作该作品 |
| 422 | name 不符合约束 |

---

### 4.5 删除作品

```
DELETE /api/v1/subject-templates/math-projects/{template_id}
```

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `template_id` | string | 作品 ID |

**成功响应**: `204 No Content`（无响应体）

**错误响应**:

| 状态码 | 说明 |
|--------|------|
| 404 | 作品不存在 |
| 403 | 无权删除该作品 |

---

## 五、典型业务流程：上传缩略图并保存到作品

```
┌──────────┐      ┌──────────────────────┐      ┌──────────────────────────────────────┐
│  用户选择  │ ──→ │  POST /upload/image   │ ──→ │  PUT /subject-templates/             │
│  缩略图文件 │      │  上传图片到 OSS        │      │      math-projects/{id}              │
│          │      │  返回 url             │      │  body: { thumbnail: url }            │
└──────────┘      └──────────────────────┘      └──────────────────────────────────────┘
```

**完整 TypeScript 示例**:

```typescript
import axios from 'axios';

const API_BASE = '/api/v1';

// ① 上传缩略图到 OSS，获取 URL
async function uploadThumbnail(file: File): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await axios.post(`${API_BASE}/upload/image`, formData);
  // data.data = { url, key, filename, size, mime_type, file_type }
  return { url: data.data.url, key: data.data.key };
}

// ② 更新作品的 thumbnail
async function updateProjectThumbnail(
  projectId: string,
  thumbnailUrl: string,
  token: string
) {
  const { data } = await axios.put(
    `${API_BASE}/subject-templates/math-projects/${projectId}`,
    { thumbnail: thumbnailUrl },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data; // 返回更新后的完整作品对象
}

// ③ 组合使用：选择图片 → 上传 → 更新作品
async function handleThumbnailChange(file: File, projectId: string, token: string) {
  try {
    // Step 1: 上传图片
    const { url } = await uploadThumbnail(file);

    // Step 2: 将 URL 保存到作品
    const updatedProject = await updateProjectThumbnail(projectId, url, token);

    console.log('缩略图更新成功', updatedProject);
    return updatedProject;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('操作失败:', error.response?.data?.detail || error.message);
    }
    throw error;
  }
}
```

**React 组件示例**:

```tsx
function ThumbnailUploader({ projectId }: { projectId: string }) {
  const token = useAuthStore((s) => s.accessToken);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 前端校验
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('仅支持 JPG / PNG / WebP 格式');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('图片不能超过 10MB');
      return;
    }

    await handleThumbnailChange(file, projectId, token);
  };

  return <input type="file" accept="image/*" onChange={handleFileChange} />;
}
```

---

## 六、错误响应格式

所有接口的错误响应遵循以下格式：

**HTTP 异常** (`4xx` / `5xx`):

```json
{
  "detail": "错误描述信息"
}
```

**前端建议统一拦截处理**:

```typescript
axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    if (status === 401) {
      // access_token 过期，尝试刷新
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/login/refresh`, {
            refresh_token: refreshToken,
          });
          // 保存新 token
          setTokens(data.data.access_token, data.data.refresh_token);
          // 重试原请求
          error.config.headers.Authorization = `Bearer ${data.data.access_token}`;
          return axios(error.config);
        } catch {
          // 刷新也失败，跳转登录
          redirectToLogin();
        }
      }
    }

    if (status === 403) {
      console.error('无权限:', detail);
    }

    return Promise.reject(error);
  }
);
```
