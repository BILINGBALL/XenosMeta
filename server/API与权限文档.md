# Auth & Base 系统 API 与权限文档

## 目录

1. [概述](#概述)
2. [统一响应格式](#统一响应格式)
3. [基础信息](#基础信息)
4. [系统管理 API](#系统管理-api)
   - [用户管理](#用户管理)
   - [租户管理](#租户管理)
   - [群组管理](#群组管理)
   - [角色管理](#角色管理)
   - [权限管理](#权限管理)
5. [动态业务表 API](#动态业务表-api)
   - [表管理](#表管理)
   - [字段管理](#字段管理)
   - [记录管理](#记录管理)
6. [权限规则说明](#权限规则说明)
   - [权限规则命名规范](#权限规则命名规范)
   - [系统管理权限](#系统管理权限)
   - [基础业务权限](#基础业务权限)
   - [特殊角色](#特殊角色)
   - [权限校验流程](#权限校验流程)

---

## 概述

本文档描述了 Auth & Base 系统的所有 API 接口和权限规则，包括认证授权和动态业务表功能。
系统采用基于角色的访问控制(RBAC)模式，每个接口都需要相应的权限才能访问。

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

### 错误码说明

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

---

## 系统管理 API

### 用户管理

| 方法 | 路径 | 权限代码 | 说明 |
|------|------|----------|------|
| POST | `/user/register` | - | 用户注册（公开接口） |
| POST | `/user/login` | - | 用户登录（公开接口） |
| GET | `/user/list` | `sys:user:view` | 获取用户列表 |
| GET | `/user/:id` | `sys:user:view` | 获取用户详情 |
| PUT | `/user/:id` | `sys:user:edit` | 更新用户信息 |
| DELETE | `/user/:id` | `sys:user:delete` | 删除用户 |
| POST | `/user/assign-group` | `sys:user:assign` | 给用户分配群组 |

#### 1. 用户注册

```http
POST /api/user/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "123456",
  "nickname": "测试用户",
  "tenantId": "tenant-uuid"
}
```

响应：
```json
{
  "code": 201,
  "message": "注册成功",
  "data": {
    "id": "user-uuid",
    "username": "testuser",
    "nickname": "测试用户",
    "tenantId": "tenant-uuid"
  },
  "success": true
}
```

#### 2. 用户登录

```http
POST /api/user/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

响应：
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "id": "user-uuid",
    "username": "admin",
    "nickname": "系统管理员"
  },
  "success": true
}
```

#### 3. 获取用户列表

```http
GET /api/user/list
Authorization: Bearer <token>
```

响应：
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

---

### 租户管理

| 方法 | 路径 | 权限代码 | 说明 |
|------|------|----------|------|
| POST | `/tenant/create` | `sys:tenant:add` | 创建新租户 |
| GET | `/tenant` | `sys:tenant:view` | 获取所有租户列表 |
| GET | `/tenant/:id` | `sys:tenant:view` | 获取租户详情 |
| PUT | `/tenant/:id` | `sys:tenant:edit` | 更新租户信息 |
| DELETE | `/tenant/:id` | `sys:tenant:delete` | 删除租户 |

#### 1. 创建租户

```http
POST /api/tenant/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "id": "tenant-uuid",
  "tenantName": "测试公司",
  "tenantCode": "test-company"
}
```

---

### 群组管理

| 方法 | 路径 | 权限代码 | 说明 |
|------|------|----------|------|
| POST | `/group/root` | `sys:group:add` | 创建根群组 |
| GET | `/group/root/:tenantId` | `sys:group:view` | 获取根群组 |
| POST | `/group` | `sys:group:add` | 创建新群组 |
| GET | `/group/list/:tenantId` | `sys:group:view` | 获取群组列表 |
| GET | `/group/tree/:tenantId` | `sys:group:view` | 获取根群组树 |
| GET | `/group/tree/:tenantId/:groupId` | `sys:group:view` | 获取指定群组树 |
| GET | `/group/:id` | `sys:group:view` | 获取群组详情 |
| PUT | `/group/:id` | `sys:group:edit` | 更新群组 |
| DELETE | `/group/:id` | `sys:group:delete` | 删除群组 |

---

### 角色管理

| 方法 | 路径 | 权限代码 | 说明 |
|------|------|----------|------|
| GET | `/role` | `sys:role:view` | 获取角色列表 |
| GET | `/role/:id` | `sys:role:view` | 获取角色详情 |
| POST | `/role` | `sys:role:add` | 创建新角色 |
| PUT | `/role/:id` | `sys:role:edit` | 更新角色信息 |
| DELETE | `/role/:id` | `sys:role:delete` | 删除角色 |
| POST | `/role/:roleId/permissions` | `sys:role:assign` | 给角色分配权限 |

#### 1. 创建角色

```http
POST /api/role
Authorization: Bearer <token>
Content-Type: application/json

{
  "roleName": "部门经理",
  "roleCode": "dept-manager",
  "tenantId": "tenant-uuid",
  "status": true
}
```

---

### 权限管理

| 方法 | 路径 | 权限代码 | 说明 |
|------|------|----------|------|
| GET | `/permission` | `sys:permission:view` | 获取所有权限列表 |
| GET | `/permission/:id` | `sys:permission:view` | 获取权限详情 |
| POST | `/permission` | `sys:permission:add` | 创建新权限 |
| PUT | `/permission/:id` | `sys:permission:edit` | 更新权限信息 |
| DELETE | `/permission/:id` | `sys:permission:delete` | 删除权限 |

---

## 动态业务表 API

### 表管理

| 方法 | 路径 | 权限代码 | 说明 |
|------|------|----------|------|
| GET | `/base/tables` | `base:table:view` | 获取表列表 |
| POST | `/base/tables` | `base:table:add` | 创建新表 |
| GET | `/base/tables/:tableId` | `base:table:view` | 获取表详情 |
| PUT | `/base/tables/:tableId` | `base:table:edit` | 更新表信息 |
| DELETE | `/base/tables/:tableId` | `base:table:delete` | 删除表 |

#### 1. 创建表

```http
POST /api/base/tables
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "客户管理表",
  "tenantId": "tenant-uuid"
}
```

---

### 字段管理

| 方法 | 路径 | 权限代码 | 说明 |
|------|------|----------|------|
| GET | `/base/tables/:tableId/fields` | `base:field:view` | 获取字段列表 |
| POST | `/base/tables/:tableId/fields` | `base:field:add` | 创建新字段 |
| GET | `/base/tables/:tableId/fields/:fieldId` | `base:field:view` | 获取字段详情 |
| PUT | `/base/tables/:tableId/fields/:fieldId` | `base:field:edit` | 更新字段 |
| DELETE | `/base/tables/:tableId/fields/:fieldId` | `base:field:delete` | 删除字段 |

#### 字段类型说明

- `text`：文本类型
- `number`：数字类型
- `date`：日期类型
- `select`：下拉选择
- `checkbox`：复选框

---

### 记录管理

| 方法 | 路径 | 权限代码 | 说明 |
|------|------|----------|------|
| POST | `/base/tables/:tableId/records/list` | `base:record:view` | 获取记录列表 |
| POST | `/base/tables/:tableId/records` | `base:record:add` | 创建新记录 |
| GET | `/base/tables/:tableId/records/:recordId` | `base:record:view` | 获取记录详情 |
| PUT | `/base/tables/:tableId/records/:recordId` | `base:record:edit` | 更新记录 |
| DELETE | `/base/tables/:tableId/records/:recordId` | `base:record:delete` | 删除记录 |

---

## 权限规则说明

### 权限规则命名规范

权限规则采用 `模块:资源:操作` 的三级命名规范：
- **模块**：系统模块，如 `sys`（系统管理）、`base`（基础业务）
- **资源**：具体资源，如 `user`（用户）、`role`（角色）、`group`（群组）
- **操作**：CRUD操作，如 `view`（查看）、`add`（新增）、`edit`（编辑）、`delete`（删除）、`assign`（分配）

---

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

---

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

---

### 特殊角色

#### 超级管理员 (`super_admin`)

超级管理员拥有系统中所有权限，可以跳过所有权限校验，直接访问所有 API 接口。
适用于系统管理员或超级用户。

#### 管理员 (`admin`)

管理员角色拥有所有权限（通过角色-权限关联），与超级管理员类似，但需要显式配置权限。

---

### 权限校验流程

```
1. 用户发送请求
   ↓
2. authMiddleware 验证 Token，获取用户信息
   ↓
3. hasPermission 中间件检查权限
   ↓
4. 查询用户角色列表
   ↓
5. 检查是否有超级管理员角色（roleCode: super_admin）
   ├─ 是 → 直接放行，执行后续逻辑
   └─ 否 → 继续检查
   ↓
6. 查询角色关联的权限
   ↓
7. 检查是否有所需的权限代码
   ├─ 有 → 放行，执行后续逻辑
   └─ 无 → 返回 403 权限不足
```

---

### 权限设计原则

1. **最小权限原则**：只为用户分配完成工作所需的最小权限集
2. **职责分离原则**：敏感操作（如删除、分配）应分配给不同角色
3. **默认拒绝原则**：未明确授权的权限默认拒绝访问
4. **层级管理原则**：使用群组树结构实现权限的继承和隔离

---

### 最佳实践

1. **使用角色而非直接分配权限**：将权限打包到角色中，然后分配角色给用户
2. **定期审查权限**：定期检查用户权限是否符合最小权限原则
3. **记录权限变更**：记录所有权限的创建、修改、删除操作
4. **权限缓存**：使用 Redis 缓存权限数据，提高校验性能
5. **日志审计**：记录所有权限相关的操作，便于审计追踪

---

## 附录

### 快速参考

#### 默认账户

- **用户名**：admin
- **密码**：admin123
- **角色**：管理员
- **权限**：拥有所有权限

#### 相关文件

- API 测试脚本：`tests/api-test.ts`
- 测试结果：`test-results.json`
- 数据库清理脚本：`scripts/clear-all-database.ts`
- 测试数据生成脚本：`scripts/generate-complete-test-data.ts`

#### NPM 脚本命令

```bash
npm run dev              # 启动开发服务器
npm run clear:all        # 完全清空数据库
npm run init:admin       # 初始化 admin 用户
npm run generate:complete  # 生成完整测试数据
npm run test:api         # 运行 API 测试
```
