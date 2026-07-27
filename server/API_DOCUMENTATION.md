# Auth Core 2 - API 说明文档

## 概述

本文档列出了 Auth Core 2 后端所有 API 接口、权限码和使用说明，用于 AI Agent 工具设计参考。

- Base URL: `/api`
- 认证方式: Bearer Token (`Authorization: Bearer <token>`)
- 响应格式: `{ code: number, message: string, data: any, success: boolean }`

---

## 权限码总览 (39 个)

### 1. 用户管理 (sys:user:*)
| 权限码 | 说明 |
|--------|------|
| `sys:user:view` | 查看用户列表/详情 |
| `sys:user:edit` | 编辑用户信息/恢复用户 |
| `sys:user:add` | 新增用户 |
| `sys:user:delete` | 删除用户 |
| `sys:user:assign` | 分配用户到群组 |

### 2. 角色管理 (sys:role:*)
| 权限码 | 说明 |
|--------|------|
| `sys:role:view` | 查看角色列表/详情 |
| `sys:role:add` | 新增角色 |
| `sys:role:edit` | 编辑角色/恢复角色 |
| `sys:role:delete` | 删除角色 |
| `sys:role:assign` | 分配权限给角色 |

### 3. 权限管理 (sys:permission:*)
| 权限码 | 说明 |
|--------|------|
| `sys:permission:view` | 查看权限列表/详情 |
| `sys:permission:add` | 新增权限 |
| `sys:permission:edit` | 编辑权限 |
| `sys:permission:delete` | 删除权限 |

### 4. 群组管理 (sys:group:*)
| 权限码 | 说明 |
|--------|------|
| `sys:group:view` | 查看群组列表/详情/树结构 |
| `sys:group:add` | 创建群组/根群组/共享镜像 |
| `sys:group:edit` | 编辑群组/恢复/切换公开/接受/拒绝共享 |
| `sys:group:delete` | 删除群组 |

### 5. 租户管理 (sys:tenant:*)
| 权限码 | 说明 |
|--------|------|
| `sys:tenant:view` | 查看租户列表/详情 |
| `sys:tenant:add` | 新增租户 |
| `sys:tenant:edit` | 编辑租户/恢复租户 |
| `sys:tenant:delete` | 删除租户 |

### 6. 动态表-表管理 (dynamic:table:*)
| 权限码 | 说明 |
|--------|------|
| `dynamic:table:view` | 查看表/镜像列表/字段 |
| `dynamic:table:add` | 创建表/镜像 |
| `dynamic:table:edit` | 编辑表/镜像/恢复表 |
| `dynamic:table:delete` | 删除表/镜像 |

### 7. 动态表-字段管理 (dynamic:field:*)
| 权限码 | 说明 |
|--------|------|
| `dynamic:field:view` | 查看字段/引用 |
| `dynamic:field:add` | 新增字段/引用 |
| `dynamic:field:edit` | 编辑字段/引用/恢复字段 |
| `dynamic:field:delete` | 删除字段/引用 |

### 8. 动态表-记录管理 (dynamic:record:*)
| 权限码 | 说明 |
|--------|------|
| `dynamic:record:view` | 查看记录/查找记录 |
| `dynamic:record:add` | 新增记录 |
| `dynamic:record:edit` | 编辑记录/恢复记录 |
| `dynamic:record:delete` | 删除记录 |

### 9. Agent 专用 (agent:*)
| 权限码 | 说明 |
|--------|------|
| `agent:script:execute` | 执行沙箱 JavaScript 脚本 |

---

## API 接口明细

### 模块 1：认证与用户 (`/api/user`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/user/register` | - | 用户注册 |
| POST | `/user/login` | - | 用户登录（带限流） |
| POST | `/user/refresh` | - | 刷新 Token |
| POST | `/user/logout` | 登录 | 退出登录 |
| GET | `/user/permissions` | 登录 | 获取当前用户权限列表 |
| GET | `/user/my-tenant` | 登录 | 获取当前用户所属租户 |
| GET | `/user/list` | `sys:user:view` | 用户列表（分页） |
| GET | `/user/:id` | `sys:user:view` | 用户详情 |
| PUT | `/user/:id` | `sys:user:edit` | 更新用户信息 |
| PUT | `/user/:id/restore` | `sys:user:edit` | 恢复已删除用户 |
| DELETE | `/user/:id` | `sys:user:delete` | 删除用户（软删除） |
| POST | `/user/assign-group` | `sys:user:assign` | 分配用户到群组 |
| POST | `/user/remove-group` | 登录 | 从群组移除用户 |
| POST | `/user/assign-role` | 登录 | 分配角色给用户 |
| POST | `/user/remove-role` | 登录 | 移除用户角色 |

**请求/响应示例：**
- 登录请求: `{ username: string, password: string }`
- 登录响应: `{ accessToken: string, user: {...} }`
- 列表查询参数: `page`, `pageSize`, `keyword`

---

### 模块 2：角色管理 (`/api/role`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/role/` | `sys:role:view` | 角色列表 |
| GET | `/role/:id` | `sys:role:view` | 角色详情（含权限） |
| POST | `/role/` | `sys:role:add` | 创建角色 |
| PUT | `/role/:id` | `sys:role:edit` | 更新角色 |
| PUT | `/role/:id/restore` | `sys:role:edit` | 恢复已删除角色 |
| DELETE | `/role/:id` | `sys:role:delete` | 删除角色 |
| POST | `/role/:roleId/permissions` | `sys:role:assign` | 分配权限给角色 |

---

### 模块 3：权限管理 (`/api/permission`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/permission/` | `sys:permission:view` | 权限列表 |
| GET | `/permission/:id` | `sys:permission:view` | 权限详情 |
| POST | `/permission/` | `sys:permission:add` | 创建权限 |
| PUT | `/permission/:id` | `sys:permission:edit` | 更新权限 |
| DELETE | `/permission/:id` | `sys:permission:delete` | 删除权限 |

---

### 模块 4：群组管理 (`/api/group`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/group/root` | `sys:group:add` | 创建根群组 |
| GET | `/group/root/:tenantId` | `sys:group:view` | 获取根群组 |
| POST | `/group/` | `sys:group:add` | 创建子群组 |
| GET | `/group/list/:tenantId` | `sys:group:view` | 群组列表 |
| GET | `/group/tree/:tenantId` | `sys:group:view` | 群组树 |
| GET | `/group/tree/:tenantId/:groupId` | `sys:group:view` | 子群组树 |
| GET | `/group/my` | 登录 | 我的群组 |
| GET | `/group/connected` | 登录 | 已建立联系的群组 |
| GET | `/group/pending-relations` | 登录 | 待处理的群组联系请求 |
| GET | `/group/sent-relations` | 登录 | 已发送的群组联系请求 |
| POST | `/group/relation` | 登录 | 创建群组联系 |
| PUT | `/group/relation/:id/accept` | 登录 | 接受群组联系 |
| PUT | `/group/relation/:id/reject` | 登录 | 拒绝群组联系 |
| DELETE | `/group/relation/:id` | 登录 | 删除群组联系 |
| PUT | `/group/relation/:id/reapply` | 登录 | 重新申请群组联系 |
| POST | `/group/relation/delete-by-groups` | 登录 | 按群组删除联系 |
| GET | `/group/public/list` | `sys:group:view` | 搜索公开群组 |
| POST | `/group/share-mirror` | `sys:group:add` | 共享表镜像 |
| PUT | `/group/share-mirror/:mirrorId/accept` | `sys:group:edit` | 接受共享镜像 |
| PUT | `/group/share-mirror/:mirrorId/reject` | `sys:group:edit` | 拒绝共享镜像 |
| GET | `/group/:id` | `sys:group:view` | 群组详情 |
| PUT | `/group/:id` | `sys:group:edit` | 更新群组 |
| DELETE | `/group/:id` | `sys:group:delete` | 删除群组 |
| PUT | `/group/:id/restore` | `sys:group:edit` | 恢复群组 |
| PUT | `/group/:id/public` | `sys:group:edit` | 切换群组公开状态 |
| GET | `/group/:id/mirrors-in` | `sys:group:view` | 收到的共享镜像 |
| GET | `/group/:id/mirrors-out` | `sys:group:view` | 发出的共享镜像 |

---

### 模块 5：租户管理 (`/api/tenant`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/tenant/` | `sys:tenant:view` | 租户列表 |
| POST | `/tenant/create` | `sys:tenant:add` | 创建租户 |
| GET | `/tenant/:id` | `sys:tenant:view` | 租户详情 |
| PUT | `/tenant/:id` | `sys:tenant:edit` | 更新租户 |
| DELETE | `/tenant/:id` | `sys:tenant:delete` | 删除租户 |
| PUT | `/tenant/:id/restore` | `sys:tenant:edit` | 恢复租户 |

---

### 模块 6：系统工具 (`/api/system`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/system/init-super-admin` | - | 初始化超级管理员（首次部署） |
| POST | `/system/seed-permissions` | 登录 | 初始化权限数据 |
| POST | `/system/seed-preset-roles` | 登录 | 初始化预设角色 |
| POST | `/system/cleanup` | 登录 | 清理软删除数据 |

---

### 模块 7：动态表 - 表管理 (`/api/dynamic/tables`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/dynamic/tables` | `dynamic:table:view` | 表列表 |
| POST | `/dynamic/tables` | `dynamic:table:add` | 创建表 |
| GET | `/dynamic/tables/:tableId` | `dynamic:table:view` | 表详情 |
| PUT | `/dynamic/tables/:tableId` | `dynamic:table:edit` | 更新表 |
| DELETE | `/dynamic/tables/:tableId` | `dynamic:table:delete` | 删除表 |
| PUT | `/dynamic/tables/:tableId/restore` | `dynamic:table:edit` | 恢复表 |

---

### 模块 8：动态表 - 字段管理 (`/api/dynamic/tables/:tableId/fields`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/dynamic/tables/:tableId/fields` | `dynamic:field:view` | 字段列表 |
| POST | `/dynamic/tables/:tableId/fields` | `dynamic:field:add` | 创建字段 |
| GET | `/dynamic/tables/:tableId/fields/:fieldId` | `dynamic:field:view` | 字段详情 |
| PUT | `/dynamic/tables/:tableId/fields/:fieldId` | `dynamic:field:edit` | 更新字段 |
| DELETE | `/dynamic/tables/:tableId/fields/:fieldId` | `dynamic:field:delete` | 删除字段 |
| PUT | `/dynamic/tables/:tableId/fields/:fieldId/restore` | `dynamic:field:edit` | 恢复字段 |

---

### 模块 9：动态表 - 记录管理 (`/api/dynamic/tables/:tableId/records`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/dynamic/tables/:tableId/records/list` | `dynamic:record:view` | 记录列表（分页+筛选） |
| POST | `/dynamic/tables/:tableId/records` | `dynamic:record:add` | 创建记录 |
| GET | `/dynamic/tables/:tableId/records/:recordId` | `dynamic:record:view` | 记录详情 |
| PUT | `/dynamic/tables/:tableId/records/:recordId` | `dynamic:record:edit` | 更新记录 |
| DELETE | `/dynamic/tables/:tableId/records/:recordId` | `dynamic:record:delete` | 删除记录 |
| PUT | `/dynamic/tables/:tableId/records/:recordId/restore` | `dynamic:record:edit` | 恢复记录 |

**记录列表请求体:**
```json
{
  "page": 1,
  "pageSize": 20,
  "filters": { "字段名": "值" },
  "sortBy": "createdAt",
  "sortOrder": "desc"
}
```

---

### 模块 10：动态表 - 字段引用 (`/api/dynamic/tables/:tableId/references`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/dynamic/tables/:tableId/references` | `dynamic:field:add` | 创建字段引用 |
| GET | `/dynamic/tables/:tableId/references` | `dynamic:field:view` | 引用列表 |
| GET | `/dynamic/tables/:tableId/references/:refId` | `dynamic:field:view` | 引用详情 |
| PUT | `/dynamic/tables/:tableId/references/:refId` | `dynamic:field:edit` | 更新引用 |
| DELETE | `/dynamic/tables/:tableId/references/:refId` | `dynamic:field:delete` | 删除引用 |
| POST | `/dynamic/tables/:tableId/references/:refId/lookup` | `dynamic:record:view` | 查找引用记录 |

---

### 模块 11：表镜像 (`/api/dynamic/mirrors`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/dynamic/mirrors` | `dynamic:table:view` | 我的镜像列表 |
| GET | `/dynamic/mirrors/categorized` | `dynamic:table:view` | 分类的镜像列表 |
| POST | `/dynamic/tables/:tableId/mirrors` | `dynamic:table:add` | 创建镜像 |
| GET | `/dynamic/tables/:tableId/mirrors` | `dynamic:table:view` | 指定表的镜像 |
| GET | `/dynamic/mirrors/:mirrorId` | `dynamic:table:view` | 镜像详情 |
| PUT | `/dynamic/mirrors/:mirrorId` | `dynamic:table:edit` | 更新镜像 |
| DELETE | `/dynamic/mirrors/:mirrorId` | `dynamic:table:delete` | 删除镜像 |
| POST | `/dynamic/mirrors/:mirrorId/records/list` | `dynamic:record:view` | 镜像记录列表 |
| GET | `/dynamic/mirrors/:mirrorId/records/:recordId` | `dynamic:record:view` | 镜像记录详情 |
| GET | `/dynamic/mirrors/:mirrorId/fields` | `dynamic:table:view` | 镜像可见字段 |

---

### 模块 12：文件管理 (`/api/file`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/file/upload` | 登录 | 上传文件 |
| GET | `/file/tags` | 登录 | 文件标签列表 |
| POST | `/file/list` | 登录 | 文件列表 |
| POST | `/file/trash/list` | 登录 | 回收站列表 |
| POST | `/file/trash/restore` | 登录 | 批量恢复文件 |
| POST | `/file/trash/permanent-delete` | 登录 | 永久删除文件 |
| POST | `/file/trash/empty` | 登录 | 清空回收站 |
| GET | `/file/:fileId/content` | 登录 | 流式获取文件内容 |
| GET | `/file/:fileId/convert-pdf` | 登录 | 转换为 PDF |
| GET | `/file/:fileId/thumbnail` | 登录 | 获取缩略图 |
| POST | `/file/:fileId/version` | 登录 | 上传新版本 |
| GET | `/file/:fileId/versions` | 登录 | 版本列表 |
| GET | `/file/:fileId/versions/:version/download` | 登录 | 下载指定版本 |
| PATCH | `/file/:fileId/rename` | 登录 | 重命名文件 |
| GET | `/file/:fileId/download` | 登录 | 下载文件 |
| GET | `/file/:fileId` | 登录 | 文件详情 |
| PUT | `/file/:fileId` | 登录 | 更新文件信息 |
| DELETE | `/file/:fileId` | 登录 | 删除文件（软删除到回收站） |

---

### 模块 13：AI Agent (`/api/agent`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/agent/conversations` | 登录 | 创建会话 |
| GET | `/agent/conversations` | 登录 | 会话列表 |
| GET | `/agent/conversations/:id/messages` | 登录 | 获取会话消息 |
| DELETE | `/agent/conversations/:id` | 登录 | 删除会话 |
| POST | `/agent/chat` | 登录 | SSE 流式对话 |
| GET | `/agent/tools` | 登录 | 可用工具列表（含权限状态） |

**SSE 事件类型:**
- `thinking`: 思考过程 `{ content: string }`
- `text`: 文本输出 `{ content: string, delta: string }`
- `tool_start`: 工具开始执行 `{ toolCallId: string, name: string, arguments: object }`
- `tool_result`: 工具执行结果 `{ toolCallId: string, success: boolean, result: any, error?: string }`
- `error`: 错误 `{ message: string, code?: string }`
- `done`: 流结束 `{ conversationId: string }`
- `usage`: Token 用量 `{ promptTokens: number, completionTokens: number, totalTokens: number }`

---

### 模块 14：开发者工具 (`/api/developer`)

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/developer/ai-generate` | 登录 | AI 代码生成 |

---

## 数据模型速查

### 核心实体关系
```
Tenant (租户)
  ├── User (用户) ── UserRole ── Role (角色) ── RolePermission ── Permission (权限)
  ├── Group (群组) ── UserGroup ── User
  │     └── GroupRelation (群组联系)
  ├── DynamicTable (动态表)
  │     ├── DynamicField (字段)
  │     ├── DynamicRecord (记录)
  │     └── TableMirror (表镜像)
  └── File (文件)
        └── FileVersion (文件版本)
```

### 特殊标识规则
- 表 ID: `tbl_xxxx`
- 字段 ID: `fld_xxxx`
- 记录 ID: `rec_xxxx`
- 引用 ID: `ref_xxxx`
- 镜像 ID: `mir_xxxx`
- 文件 ID: `f_xxxx` (或 fileId 字段)
- 文件版本 ID: `fv_xxxx`

---

## 通用响应格式

### 成功响应
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... },
  "success": true
}
```

### 分页响应
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "success": true
}
```

### 错误响应
```json
{
  "code": 400 | 401 | 403 | 404 | 429 | 500,
  "message": "错误描述",
  "data": null,
  "success": false
}
```

### 错误码说明
| 状态码 | 说明 |
|--------|------|
| 400 | 参数错误 |
| 401 | 未登录 / Token 失效 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁（限流） |
| 500 | 服务器内部错误 |
