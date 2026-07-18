# Auth & Base 系统 API 文档

## 概述

本文档描述了 Auth & Base 系统的所有 API 接口，包括认证授权和动态业务表功能，以及完整的权限规则说明。

### 基础信息

- **Base URL**: `http://localhost:3001/api`
- **认证方式**: Bearer Token (除公开接口外)
- **响应格式**: 统一的 JSON 格式

### 统一响应格式

所有 API 响应遵循以下格式：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": {},
  "success": true
}
```

## 权限规则说明

### 权限命名规范

权限规则采用 `模块:资源:操作` 的三级命名规范：
- **模块**: 系统模块，如 `sys`（系统管理）、`base`（基础业务）
- **资源**: 具体资源，如 `user`（用户）、`role`（角色）、`group`（群组）
- **操作**: CRUD操作，如 `view`（查看）、`add`（新增）、`edit`（编辑）、`delete`（删除）、`assign`（分配）

### 系统管理权限

#### 用户管理 (`sys:user:*`)

| 权限代码 | 说明 | 描述 |
|---------|------|------|
| `sys:user:view` | 用户查看 | 查看用户列表、用户详情 |
| `sys:user:add` | 用户新增 | 注册新用户 |
| `sys:user:edit` | 用户编辑 | 更新用户信息 |
| `sys:user:delete` | 用户删除 | 删除用户 |
| `sys:user:assign` | 用户分配 | 给用户分配群组 |

#### 角色管理 (`sys:role:*`)

| 权限代码 | 说明 | 描述 |
|---------|------|------|
| `sys:role:view` | 角色查看 | 查看角色列表、角色详情 |
| `sys:role:add` | 角色新增 | 创建新角色 |
| `sys:role:edit` | 角色编辑 | 更新角色信息 |
| `sys:role:delete` | 角色删除 | 删除角色 |
| `sys:role:assign` | 角色分配 | 给角色分配权限 |

#### 权限管理 (`sys:permission:*`)

| 权限代码 | 说明 | 描述 |
|---------|------|------|
| `sys:permission:view` | 权限查看 | 查看权限列表、权限详情 |
| `sys:permission:add` | 权限新增 | 创建新权限 |
| `sys:permission:edit` | 权限编辑 | 更新权限信息 |
| `sys:permission:delete` | 权限删除 | 删除权限 |

#### 群组管理 (`sys:group:*`)

| 权限代码 | 说明 | 描述 |
|---------|------|------|
| `sys:group:view` | 群组查看 | 查看群组列表、群组树、群组详情 |
| `sys:group:add` | 群组新增 | 创建新群组、根群组 |
| `sys:group:edit` | 群组编辑 | 更新群组信息 |
| `sys:group:delete` | 群组删除 | 删除群组 |

#### 租户管理 (`sys:tenant:*`)

| 权限代码 | 说明 | 描述 |
|---------|------|------|
| `sys:tenant:view` | 租户查看 | 查看租户列表、租户详情 |
| `sys:tenant:add` | 租户新增 | 创建新租户 |
| `sys:tenant:edit` | 租户编辑 | 更新租户信息 |
| `sys:tenant:delete` | 租户删除 | 删除租户 |

### 基础业务权限

#### 动态表管理 (`base:table:*`)

| 权限代码 | 说明 | 描述 |
|---------|------|------|
| `base:table:view` | 表查看 | 查看表列表、表详情 |
| `base:table:add` | 表新增 | 创建新表 |
| `base:table:edit` | 表编辑 | 更新表信息 |
| `base:table:delete` | 表删除 | 删除表 |

#### 字段管理 (`base:field:*`)

| 权限代码 | 说明 | 描述 |
|---------|------|------|
| `base:field:view` | 字段查看 | 查看字段列表、字段详情 |
| `base:field:add` | 字段新增 | 创建新字段 |
| `base:field:edit` | 字段编辑 | 更新字段信息 |
| `base:field:delete` | 字段删除 | 删除字段 |

#### 记录管理 (`base:record:*`)

| 权限代码 | 说明 | 描述 |
|---------|------|------|
| `base:record:view` | 记录查看 | 查看记录列表、记录详情 |
| `base:record:add` | 记录新增 | 创建新记录 |
| `base:record:edit` | 记录编辑 | 更新记录信息 |
| `base:record:delete` | 记录删除 | 删除记录 |

### 特殊角色

#### 超级管理员 (`super_admin`)

超级管理员拥有系统中所有权限，可以跳过所有权限验证，直接访问所有 API 接口。适用于系统管理员或超级用户。

## 认证授权 API

### 1. 用户相关

#### 1.1 用户注册

- **URL**: `POST /user/register`
- **权限**: 无需权限（公开接口）
- **Description**: 创建新用户
- **Request Body**:
  ```json
  {
    "username": "testuser",
    "password": "123456",
    "nickname": "测试用户",
    "avatar": "https://example.com/avatar.png",
    "email": "test@example.com",
    "phone": "13800138000",
    "profile": { "department": "研发部", "title": "工程师" },
    "tenantId": "tenant-uuid"
  }
  ```
  > `avatar`、`email`、`phone`、`nickname`、`profile` 均为可选
- **Response**:
  ```json
  {
    "code": 201,
    "message": "注册成功",
    "data": {
      "id": "user-uuid",
      "username": "testuser",
      "nickname": "测试用户",
      "avatar": "https://example.com/avatar.png",
      "email": "test@example.com",
      "phone": "13800138000",
      "profile": { "department": "研发部", "title": "工程师" },
      "tenantId": "tenant-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 1.2 用户登录

- **URL**: `POST /user/login`
- **权限**: 无需权限（公开接口）
- **Description**: 用户登录获取 Token，登录成功后自动更新 `lastLoginAt`
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "登录成功",
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "15m",
      "id": "user-uuid",
      "username": "admin",
      "nickname": "系统管理员",
      "avatar": "https://example.com/avatar.png",
      "email": "admin@example.com",
      "phone": null
    },
    "success": true
  }
  ```

#### 1.3 获取用户列表

- **URL**: `GET /user/list`
- **权限**: `sys:user:view`
- **Description**: 获取当前租户下的用户列表
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "code": 200,
    "message": "用户列表获取成功",
    "data": [
      {
        "id": "user-uuid",
        "username": "testuser",
        "nickname": "测试用户",
        "tenantId": "tenant-uuid",
        "status": true,
        "roles": [],
        "groups": []
      }
    ],
    "success": true
  }
  ```

#### 1.4 获取用户详情

- **URL**: `GET /user/:id`
- **权限**: `sys:user:view`
- **Description**: 获取单个用户详情
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 用户 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "用户详情获取成功",
    "data": {
      "id": "user-uuid",
      "username": "testuser",
      "nickname": "测试用户",
      "tenantId": "tenant-uuid",
      "status": true,
      "roles": [],
      "groups": []
    },
    "success": true
  }
  ```

#### 1.5 更新用户

- **URL**: `PUT /user/:id`
- **权限**: `sys:user:edit`
- **Description**: 更新用户信息
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 用户 ID
- **Request Body**:
  ```json
  {
    "nickname": "新昵称",
    "status": false
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "用户更新成功",
    "data": {
      "id": "user-uuid",
      "username": "testuser",
      "nickname": "新昵称",
      "tenantId": "tenant-uuid",
      "status": false,
      "roles": [],
      "groups": []
    },
    "success": true
  }
  ```

#### 1.6 删除用户

- **URL**: `DELETE /user/:id`
- **权限**: `sys:user:delete`
- **Description**: 删除用户
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 用户 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "用户删除成功",
    "data": null,
    "success": true
  }
  ```

#### 1.7 给用户分配群组

- **URL**: `POST /user/assign-group`
- **权限**: `sys:user:assign`
- **Description**: 给用户分配单个群组
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "groupId": "group-uuid"
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "关联群组成功",
    "data": {
      "message": "用户关联群组成功",
      "userId": "user-uuid",
      "groupId": "group-uuid"
    },
    "success": true
  }
  ```

### 2. 租户相关

#### 2.1 创建租户

- **URL**: `POST /tenant/create`
- **权限**: `sys:tenant:add`
- **Description**: 创建新租户
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "id": "tenant-uuid",
    "tenantName": "测试租户",
    "tenantCode": "test_tenant"
  }
  ```
- **Response**:
  ```json
  {
    "code": 201,
    "message": "租户创建成功",
    "data": {
      "id": "tenant-uuid",
      "tenantName": "测试租户",
      "tenantCode": "test_tenant",
      "status": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 2.2 获取租户列表

- **URL**: `GET /tenant`
- **权限**: `sys:tenant:view`
- **Description**: 获取所有租户列表
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "code": 200,
    "message": "租户列表获取成功",
    "data": [
      {
        "id": "tenant-uuid",
        "tenantName": "测试租户",
        "tenantCode": "test_tenant",
        "status": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "success": true
  }
  ```

#### 2.3 获取租户详情

- **URL**: `GET /tenant/:id`
- **权限**: `sys:tenant:view`
- **Description**: 获取单个租户详情
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 租户 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "租户详情获取成功",
    "data": {
      "id": "tenant-uuid",
      "tenantName": "测试租户",
      "tenantCode": "test_tenant",
      "status": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 2.4 更新租户

- **URL**: `PUT /tenant/:id`
- **权限**: `sys:tenant:edit`
- **Description**: 更新租户信息
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 租户 ID
- **Request Body**:
  ```json
  {
    "tenantName": "新租户名称",
    "status": false
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "租户更新成功",
    "data": {
      "id": "tenant-uuid",
      "tenantName": "新租户名称",
      "tenantCode": "test_tenant",
      "status": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 2.5 删除租户

- **URL**: `DELETE /tenant/:id`
- **权限**: `sys:tenant:delete`
- **Description**: 删除租户
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 租户 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "租户删除成功",
    "data": null,
    "success": true
  }
  ```

### 3. 群组相关

#### 3.1 创建根群组

- **URL**: `POST /group/root`
- **权限**: `sys:group:add`
- **Description**: 创建租户的根群组
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "tenantId": "tenant-uuid",
    "groupName": "测试公司根组织"
  }
  ```
- **Response**:
  ```json
  {
    "code": 201,
    "message": "根群组创建成功",
    "data": {
      "id": "group-uuid",
      "groupName": "根组织",
      "groupCode": "ROOT_test_tenant",
      "tenantId": "tenant-uuid",
      "parentId": null,
      "status": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 3.2 获取根群组

- **URL**: `GET /group/root/:tenantId`
- **权限**: `sys:group:view`
- **Description**: 获取指定租户的根群组
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tenantId`: 租户 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "根群组获取成功",
    "data": {
      "id": "group-uuid",
      "groupName": "根组织",
      "groupCode": "ROOT_test_tenant",
      "tenantId": "tenant-uuid",
      "parentId": null,
      "status": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 3.3 创建群组

- **URL**: `POST /group`
- **权限**: `sys:group:add`
- **Description**: 创建新群组
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "tenantId": "tenant-uuid",
    "groupName": "财务部",
    "groupCode": "finance",
    "parentId": "parent-group-uuid"
  }
  ```
- **Response**:
  ```json
  {
    "code": 201,
    "message": "群组创建成功",
    "data": {
      "id": "group-uuid",
      "groupName": "财务部",
      "groupCode": "finance",
      "tenantId": "tenant-uuid",
      "parentId": "parent-group-uuid",
      "status": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 3.4 获取群组列表

- **URL**: `GET /group/list/:tenantId`
- **权限**: `sys:group:view`
- **Description**: 获取指定租户的所有群组列表
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tenantId`: 租户 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "群组列表获取成功",
    "data": [
      {
        "id": "group-uuid",
        "groupName": "财务部",
        "groupCode": "finance",
        "tenantId": "tenant-uuid",
        "parentId": "parent-group-uuid",
        "status": true,
        "parent": {},
        "children": [],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "success": true
  }
  ```

#### 3.5 获取根群组树

- **URL**: `GET /group/tree/:tenantId`
- **权限**: `sys:group:view`
- **Description**: 获取指定租户的完整群组树
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tenantId`: 租户 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "群组树获取成功",
    "data": {
      "id": "root-group-uuid",
      "groupName": "根组织",
      "groupCode": "ROOT_test_tenant",
      "tenantId": "tenant-uuid",
      "parentId": null,
      "status": true,
      "children": []
    },
    "success": true
  }
  ```

#### 3.6 获取指定群组树

- **URL**: `GET /group/tree/:tenantId/:groupId`
- **权限**: `sys:group:view`
- **Description**: 获取从指定群组开始的子树
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tenantId`: 租户 ID
  - `groupId`: 群组 ID
- **Response**: 格式同上

#### 3.7 获取群组详情

- **URL**: `GET /group/:id`
- **权限**: `sys:group:view`
- **Description**: 获取单个群组详情
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 群组 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "群组详情获取成功",
    "data": {
      "id": "group-uuid",
      "groupName": "财务部",
      "groupCode": "finance",
      "tenantId": "tenant-uuid",
      "parentId": "parent-group-uuid",
      "status": true,
      "parent": {},
      "children": [],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 3.8 更新群组

- **URL**: `PUT /group/:id`
- **权限**: `sys:group:edit`
- **Description**: 更新群组信息
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 群组 ID
- **Request Body**:
  ```json
  {
    "groupName": "新部门名称",
    "groupCode": "new_code",
    "status": false
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "群组更新成功",
    "data": {
      "id": "group-uuid",
      "groupName": "新部门名称",
      "groupCode": "new_code",
      "tenantId": "tenant-uuid",
      "parentId": "parent-group-uuid",
      "status": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 3.9 删除群组

- **URL**: `DELETE /group/:id`
- **权限**: `sys:group:delete`
- **Description**: 删除群组
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 群组 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "群组删除成功",
    "data": null,
    "success": true
  }
  ```

### 4. 角色相关

#### 4.1 获取角色列表

- **URL**: `GET /role`
- **权限**: `sys:role:view`
- **Description**: 获取当前租户的所有角色
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "code": 200,
    "message": "角色列表获取成功",
    "data": [
      {
        "id": "role-uuid",
        "roleName": "超级管理员",
        "roleCode": "super_admin",
        "tenantId": "tenant-uuid",
        "status": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "permissions": []
      }
    ],
    "success": true
  }
  ```

#### 4.2 获取角色详情

- **URL**: `GET /role/:id`
- **权限**: `sys:role:view`
- **Description**: 获取单个角色详情
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 角色 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "角色详情获取成功",
    "data": {
      "id": "role-uuid",
      "roleName": "超级管理员",
      "roleCode": "super_admin",
      "tenantId": "tenant-uuid",
      "status": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "permissions": []
    },
    "success": true
  }
  ```

#### 4.3 创建角色

- **URL**: `POST /role`
- **权限**: `sys:role:add`
- **Description**: 创建新角色
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "roleName": "普通用户",
    "roleCode": "normal_user",
    "status": true
  }
  ```
- **Response**:
  ```json
  {
    "code": 201,
    "message": "角色创建成功",
    "data": {
      "id": "role-uuid",
      "roleName": "普通用户",
      "roleCode": "normal_user",
      "tenantId": "tenant-uuid",
      "status": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 4.4 更新角色

- **URL**: `PUT /role/:id`
- **权限**: `sys:role:edit`
- **Description**: 更新角色信息
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 角色 ID
- **Request Body**:
  ```json
  {
    "roleName": "新角色名称",
    "status": false
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "角色更新成功",
    "data": {
      "id": "role-uuid",
      "roleName": "新角色名称",
      "roleCode": "normal_user",
      "tenantId": "tenant-uuid",
      "status": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 4.5 删除角色

- **URL**: `DELETE /role/:id`
- **权限**: `sys:role:delete`
- **Description**: 删除角色
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 角色 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "角色删除成功",
    "data": null,
    "success": true
  }
  ```

#### 4.6 给角色分配权限

- **URL**: `POST /role/:roleId/permissions`
- **权限**: `sys:role:assign`
- **Description**: 给角色分配权限
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `roleId`: 角色 ID
- **Request Body**:
  ```json
  {
    "permissionIds": ["perm-uuid-1", "perm-uuid-2"]
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "权限分配成功",
    "data": {
      "id": "role-uuid",
      "roleName": "超级管理员",
      "roleCode": "super_admin",
      "tenantId": "tenant-uuid",
      "status": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "permissions": []
    },
    "success": true
  }
  ```

### 5. 权限相关

#### 5.1 获取权限列表

- **URL**: `GET /permission`
- **权限**: `sys:permission:view`
- **Description**: 获取所有权限
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "code": 200,
    "message": "权限列表获取成功",
    "data": [
      {
        "id": "perm-uuid",
        "permName": "用户查看",
        "permCode": "sys:user:view",
        "parentId": null,
        "type": 2,
        "sort": 1,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "success": true
  }
  ```

#### 5.2 获取权限详情

- **URL**: `GET /permission/:id`
- **权限**: `sys:permission:view`
- **Description**: 获取单个权限详情
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 权限 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "权限详情获取成功",
    "data": {
      "id": "perm-uuid",
      "permName": "用户查看",
      "permCode": "sys:user:view",
      "type": 2,
      "parentId": null,
      "sort": 1,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 5.3 创建权限

- **URL**: `POST /permission`
- **权限**: `sys:permission:add`
- **Description**: 创建新权限
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "permName": "新权限",
    "permCode": "new:perm",
    "type": 2,
    "parentId": null,
    "sort": 0
  }
  ```
- **Response**:
  ```json
  {
    "code": 201,
    "message": "权限创建成功",
    "data": {
      "id": "perm-uuid",
      "permName": "新权限",
      "permCode": "new:perm",
      "type": 2,
      "parentId": null,
      "sort": 0,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 5.4 更新权限

- **URL**: `PUT /permission/:id`
- **权限**: `sys:permission:edit`
- **Description**: 更新权限信息
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 权限 ID
- **Request Body**:
  ```json
  {
    "permName": "新权限名称",
    "type": 1,
    "parentId": "parent-perm-uuid",
    "sort": 1
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "权限更新成功",
    "data": {
      "id": "perm-uuid",
      "permName": "新权限名称",
      "permCode": "new:perm",
      "type": 1,
      "parentId": "parent-perm-uuid",
      "sort": 1,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 5.5 删除权限

- **URL**: `DELETE /permission/:id`
- **权限**: `sys:permission:delete`
- **Description**: 删除权限
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `id`: 权限 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "权限删除成功",
    "data": null,
    "success": true
  }
  ```

### 6. 系统相关

#### 6.1 初始化超级管理员

- **URL**: `POST /system/init-super-admin`
- **权限**: 无需权限
- **Description**: 初始化超级管理员角色和权限
- **Request Body**:
  ```json
  {
    "userId": "user-uuid",
    "tenantId": "tenant-uuid"
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "超级管理员初始化成功，拥有全部权限",
    "data": null,
    "success": true
  }
  ```

## 动态业务表 API

### 1. 表相关

#### 1.1 获取表列表

- **URL**: `GET /base/tables`
- **权限**: `base:table:view`
- **Description**: 获取当前用户有权访问的表列表
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `tableName` (optional): 表名搜索
- **Response**:
  ```json
  {
    "code": 200,
    "message": "表格列表获取成功",
    "data": [
      {
        "id": "table-uuid",
        "tableId": "tbl_abc123",
        "name": "客户表",
        "tenantId": "tenant-uuid",
        "groupId": "group-uuid",
        "createdBy": "user-uuid",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "success": true
  }
  ```

#### 1.2 创建表

- **URL**: `POST /base/tables`
- **权限**: `base:table:add`
- **Description**: 创建新的动态表
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "订单表",
    "tenantId": "tenant-uuid"
  }
  ```
- **Response**:
  ```json
  {
    "code": 201,
    "message": "表格创建成功",
    "data": {
      "id": "table-uuid",
      "tableId": "tbl_abc123",
      "name": "订单表",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 1.3 获取表详情

- **URL**: `GET /base/tables/:tableId`
- **权限**: `base:table:view`
- **Description**: 获取单个表的详细信息
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID (格式: tbl_xxxx)
- **Response**:
  ```json
  {
    "code": 200,
    "message": "表格详情获取成功",
    "data": {
      "id": "table-uuid",
      "tableId": "tbl_abc123",
      "name": "客户表",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "createdBy": "user-uuid",
      "fields": [],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 1.4 更新表

- **URL**: `PUT /base/tables/:tableId`
- **权限**: `base:table:edit`
- **Description**: 更新表信息
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
- **Request Body**:
  ```json
  {
    "name": "新表名"
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "表格更新成功",
    "data": {
      "id": "table-uuid",
      "tableId": "tbl_abc123",
      "name": "新表名",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 1.5 删除表

- **URL**: `DELETE /base/tables/:tableId`
- **权限**: `base:table:delete`
- **Description**: 删除表
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "表格删除成功",
    "data": null,
    "success": true
  }
  ```

### 2. 字段相关

#### 2.1 获取字段列表

- **URL**: `GET /base/tables/:tableId/fields`
- **权限**: `base:field:view`
- **Description**: 获取指定表的所有字段
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "字段列表获取成功",
    "data": [
      {
        "id": "field-uuid",
        "fieldId": "fld_abc123",
        "name": "客户姓名",
        "type": "text",
        "options": null,
        "tableId": "tbl_abc123",
        "tenantId": "tenant-uuid",
        "groupId": "group-uuid",
        "createdBy": "user-uuid",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "success": true
  }
  ```

#### 2.2 创建字段

- **URL**: `POST /base/tables/:tableId/fields`
- **权限**: `base:field:add`
- **Description**: 为表添加新字段
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
- **Request Body**:
  ```json
  {
    "name": "年龄",
    "type": "number",
    "options": null,
    "tenantId": "tenant-uuid"
  }
  ```
- **字段类型说明**:
  - `text`: 文本（短文本/长文本/邮箱/电话/链接 等通用文本）
  - `number`: 数字
  - `date`: 日期/时间
  - `select`: 下拉选择（需配合 `options` 配置选项列表）
  - `checkbox`: 复选框/布尔
  - `user`: 人员（存储用户ID，单选或多选，data 中存 `userId` 或 `userIds[]`）
  - `attachment`: 附件（不限制文档类型，data 中存 `{ name, url, size, mimeType }`）
- **Response**:
  ```json
  {
    "code": 201,
    "message": "字段创建成功",
    "data": {
      "id": "field-uuid",
      "fieldId": "fld_abc123",
      "name": "年龄",
      "type": "number",
      "options": null,
      "tableId": "tbl_abc123",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 2.3 获取字段详情

- **URL**: `GET /base/tables/:tableId/fields/:fieldId`
- **权限**: `base:field:view`
- **Description**: 获取单个字段详情
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
  - `fieldId`: 字段 ID (格式: fld_xxxx)
- **Response**:
  ```json
  {
    "code": 200,
    "message": "字段详情获取成功",
    "data": {
      "id": "field-uuid",
      "fieldId": "fld_abc123",
      "name": "客户姓名",
      "type": "text",
      "options": null,
      "tableId": "tbl_abc123",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 2.4 更新字段

- **URL**: `PUT /base/tables/:tableId/fields/:fieldId`
- **权限**: `base:field:edit`
- **Description**: 更新字段信息
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
  - `fieldId`: 字段 ID
- **Request Body**:
  ```json
  {
    "name": "新字段名",
    "type": "text",
    "options": null
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "字段更新成功",
    "data": {
      "id": "field-uuid",
      "fieldId": "fld_abc123",
      "name": "新字段名",
      "type": "text",
      "options": null,
      "tableId": "tbl_abc123",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 2.5 删除字段

- **URL**: `DELETE /base/tables/:tableId/fields/:fieldId`
- **权限**: `base:field:delete`
- **Description**: 删除字段
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
  - `fieldId`: 字段 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "字段删除成功",
    "data": null,
    "success": true
  }
  ```

### 3. 记录相关

#### 3.1 获取记录列表

- **URL**: `POST /base/tables/:tableId/records/list`
- **权限**: `base:record:view`
- **Description**: 获取表的记录列表
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
- **Request Body**:
  ```json
  {
    "tenantId": "tenant-uuid"
  }
  ```
- **Response**: 返回的记录会自动将 fieldId 转换为字段名
  ```json
  {
    "code": 200,
    "message": "记录列表获取成功",
    "data": [
      {
        "id": "record-uuid",
        "recordId": "rec_abc123",
        "tableId": "tbl_abc123",
        "tenantId": "tenant-uuid",
        "groupId": "group-uuid",
        "data": {
          "客户姓名": "张三",
          "年龄": 25
        },
        "createdBy": "user-uuid",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "success": true
  }
  ```

#### 3.2 创建记录

- **URL**: `POST /base/tables/:tableId/records`
- **权限**: `base:record:add`
- **Description**: 创建新记录
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
- **Request Body**: 使用字段名或者 fieldId 都可以
  ```json
  {
    "data": {
      "客户姓名": "李四",
      "年龄": 30
    },
    "tenantId": "tenant-uuid"
  }
  ```
- **Response**:
  ```json
  {
    "code": 201,
    "message": "记录创建成功",
    "data": {
      "id": "record-uuid",
      "recordId": "rec_abc123",
      "tableId": "tbl_abc123",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "data": {
        "fld_客户姓名": "李四",
        "fld_年龄": 30
      },
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 3.3 获取记录详情

- **URL**: `GET /base/tables/:tableId/records/:recordId`
- **权限**: `base:record:view`
- **Description**: 获取单个记录详情
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
  - `recordId`: 记录 ID (格式: rec_xxxx)
- **Response**:
  ```json
  {
    "code": 200,
    "message": "记录详情获取成功",
    "data": {
      "id": "record-uuid",
      "recordId": "rec_abc123",
      "tableId": "tbl_abc123",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "data": {
        "客户姓名": "张三",
        "年龄": 25
      },
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 3.4 更新记录

- **URL**: `PUT /base/tables/:tableId/records/:recordId`
- **权限**: `base:record:edit`
- **Description**: 更新记录
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
  - `recordId`: 记录 ID
- **Request Body**:
  ```json
  {
    "data": {
      "客户姓名": "王五",
      "年龄": 35
    }
  }
  ```
- **Response**:
  ```json
  {
    "code": 200,
    "message": "记录更新成功",
    "data": {
      "id": "record-uuid",
      "recordId": "rec_abc123",
      "tableId": "tbl_abc123",
      "tenantId": "tenant-uuid",
      "groupId": "group-uuid",
      "data": {
        "fld_客户姓名": "王五",
        "fld_年龄": 35
      },
      "createdBy": "user-uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    },
    "success": true
  }
  ```

#### 3.5 删除记录

- **URL**: `DELETE /base/tables/:tableId/records/:recordId`
- **权限**: `base:record:delete`
- **Description**: 删除记录
- **Headers**: `Authorization: Bearer <token>`
- **Path Parameters**:
  - `tableId`: 表 ID
  - `recordId`: 记录 ID
- **Response**:
  ```json
  {
    "code": 200,
    "message": "记录删除成功",
    "data": null,
    "success": true
  }
  ```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 操作成功 |
| 201 | 创建成功 |
| 204 | 删除成功 |
| 400 | 请求参数错误 |
| 401 | 未授权，需要登录 |
| 403 | 无权限操作 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 注意事项

1. 所有需要认证的接口都需要在请求头中携带 `Authorization: Bearer <token>`
2. 表 ID、字段 ID、记录 ID 都有特定的前缀格式（tbl_、fld_、rec_）
3. 租户隔离：大多数接口会根据当前登录用户的 tenantId 进行数据隔离
4. 群组权限：动态表的访问权限基于用户所属的群组
5. 记录数据中的字段值会在查询时自动从 fieldId 转换为字段名
6. 超级管理员（roleCode 为 super_admin）会跳过所有权限验证

## 快速参考

### 默认账户

- **用户名**: admin
- **密码**: admin123
- **角色**: 管理员
- **权限**: 拥有所有权限

### NPM 脚本命令

```bash
npm run dev                  # 启动开发服务器
npm run clear:all            # 完全清空数据库
npm run init:admin           # 初始化 admin 用户和权限
npm run generate:complete    # 生成完整测试数据
npm run test:complete        # 运行完整 API 测试
```
