# Auth-Core 全量 API 测试文档

> 测试日期: 2026-06-05
> 总测试数: 76
> 通过: 76 / 失败: 0
> 通过率: 100.0%

---

## 测试环境

| 项目 | 值 |
|------|-----|
| API Base URL | `http://localhost:3001/api` |
| System Admin | `system_admin` / `admin123` |
| Tenant Admin | `full_test_admin` / `test1234` |

---

## API 测试明细

### 用户模块 (16/16)

| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |
|---|--------|-----|------|----------|----------|------|----------|
| 1 | ✅ POST | `/user/login` | {"username":"system_admin","password":"admin123"} | 200 | 200 | PASS | 登录成功 |
| 2 | ✅ POST | `/user/login` | {"username":"system_admin","password":"wrong"} | 401 | 401 | PASS | 密码错误 |
| 3 | ✅ POST | `/user/login` | {"username":"full_test_admin_1780676894292","password":"test | 200 | 200 | PASS | 登录成功 |
| 4 | ✅ POST | `/user/register` | {"username":"testuser_1780676894678","password":"test1234"," | 200 | 200 | PASS | 注册成功 |
| 5 | ✅ POST | `/user/register` | {"username":"test"} | 400 | 400 | PASS | password: Required; tenantId: Required |
| 6 | ✅ POST | `/user/register` | {"username":"test","password":"123","tenantId":"ROOT"} | 400 | 400 | PASS | password: 密码至少8个字符 |
| 7 | ✅ POST | `/user/register` | {"username":"system_admin","password":"test1234","tenantId": | 200,400,409 | 409 | PASS | 账号已存在 |
| 8 | ✅ GET | `/user/list` | - | 200 | 200 | PASS | 用户列表获取成功 |
| 9 | ✅ GET | `/user/list?page=1&pageSize=2` | - | 200 | 200 | PASS | 用户列表获取成功 |
| 10 | ✅ GET | `/user/:id` | - | 200 | 200 | PASS | 用户详情获取成功 |
| 11 | ✅ PUT | `/user/:id` | {"nickname":"已更新"} | 200 | 200 | PASS | 用户更新成功 |
| 12 | ✅ PUT | `/user/:id/restore` | - | 200,404 | 404 | PASS | 已删除的用户不存在 |
| 13 | ✅ DELETE | `/user/:id` | - | 200 | 200 | PASS | 用户删除成功 |
| 14 | ✅ PUT | `/user/:id/restore` | - | 200 | 200 | PASS | 用户恢复成功 |
| 15 | ✅ DELETE | `/user/:id` | - | 200 | 200 | PASS | 用户删除成功 |
| 16 | ✅ POST | `/user/assign-group` | {} | 200,400 | 400 | PASS | groupId: Required |

### 租户模块 (13/13)

| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |
|---|--------|-----|------|----------|----------|------|----------|
| 1 | ✅ POST | `/tenant/create` | {"tenantName":"全量测试租户","tenantCode":"FULL_TEST_1780676894292 | 200 | 200 | PASS | 租户创建成功 |
| 2 | ✅ GET | `/tenant` | - | 200 | 200 | PASS | 租户列表获取成功 |
| 3 | ✅ GET | `/tenant?page=1&pageSize=2` | - | 200 | 200 | PASS | 租户列表获取成功 |
| 4 | ✅ GET | `/tenant/:id` | - | 200 | 200 | PASS | 租户详情获取成功 |
| 5 | ✅ PUT | `/tenant/:id` | {"tenantName":"已更新"} | 200 | 200 | PASS | 租户更新成功 |
| 6 | ✅ DELETE | `/tenant/:id` | - | 200 | 200 | PASS | 租户删除成功 |
| 7 | ✅ PUT | `/tenant/:id/restore` | - | 200 | 200 | PASS | 租户恢复成功 |
| 8 | ✅ GET | `/tenant` | - | 403 | 403 | PASS | 权限不足，无法访问 |
| 9 | ✅ POST | `/tenant/create` | {"tenantName":"非法","tenantCode":"ILLEGAL"} | 403 | 403 | PASS | 权限不足，无法访问 |
| 10 | ✅ GET | `/tenant/:id` | - | 403 | 403 | PASS | 权限不足，无法访问 |
| 11 | ✅ PUT | `/tenant/:id` | {"tenantName":"HACKED"} | 403 | 403 | PASS | 权限不足，无法访问 |
| 12 | ✅ DELETE | `/tenant/:id` | - | 403 | 403 | PASS | 权限不足，无法访问 |
| 13 | ✅ GET | `/tenant` | - | 401 | 401 | PASS | 未登录，请先授权 |

### 权限模块 (10/10)

| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |
|---|--------|-----|------|----------|----------|------|----------|
| 1 | ✅ GET | `/permission` | - | 200 | 200 | PASS | 权限列表获取成功 |
| 2 | ✅ GET | `/permission?page=1&pageSize=5` | - | 200 | 200 | PASS | 权限列表获取成功 |
| 3 | ✅ GET | `/permission/:id` | - | 200 | 200 | PASS | 权限详情获取成功 |
| 4 | ✅ PUT | `/permission/:id` | {"permName":"已更新权限"} | 200 | 200 | PASS | 权限更新成功 |
| 5 | ✅ DELETE | `/permission/:id` | - | 200 | 200 | PASS | 权限删除成功 |
| 6 | ✅ GET | `/permission` | - | 200 | 200 | PASS | 权限列表获取成功 |
| 7 | ✅ POST | `/permission` | {"permName":"非法","permCode":"illegal"} | 403 | 403 | PASS | 权限不足，无法访问 |
| 8 | ✅ PUT | `/permission/:id` | {"permName":"HACKED"} | 403 | 403 | PASS | 权限不足，无法访问 |
| 9 | ✅ DELETE | `/permission/:id` | - | 403 | 403 | PASS | 权限不足，无法访问 |
| 10 | ✅ GET | `/permission` | - | 401 | 401 | PASS | 未登录，请先授权 |

### 角色模块 (8/8)

| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |
|---|--------|-----|------|----------|----------|------|----------|
| 1 | ✅ GET | `/role` | - | 200 | 200 | PASS | 角色列表获取成功 |
| 2 | ✅ GET | `/role?page=1&pageSize=3` | - | 200 | 200 | PASS | 角色列表获取成功 |
| 3 | ✅ GET | `/role/:id` | - | 200 | 200 | PASS | 角色详情获取成功 |
| 4 | ✅ PUT | `/role/:id` | {"roleName":"已更新角色"} | 200 | 200 | PASS | 角色更新成功 |
| 5 | ✅ DELETE | `/role/:id` | - | 200 | 200 | PASS | 角色删除成功 |
| 6 | ✅ PUT | `/role/:id/restore` | - | 200 | 200 | PASS | 角色恢复成功 |
| 7 | ✅ POST | `/role/:roleId/permissions` | {"permissionIds":[]} | 200 | 200 | PASS | 权限分配成功 |
| 8 | ✅ GET | `/role` | - | 401 | 401 | PASS | 未登录，请先授权 |

### 群组模块 (8/8)

| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |
|---|--------|-----|------|----------|----------|------|----------|
| 1 | ✅ GET | `/group/list/:tenantId` | - | 200 | 200 | PASS | 群组列表获取成功 |
| 2 | ✅ GET | `/group/tree/:tenantId` | - | 200 | 200 | PASS | 群组树获取成功 |
| 3 | ✅ GET | `/group/root/:tenantId` | - | 200 | 200 | PASS | 根群组获取成功 |
| 4 | ✅ GET | `/group/:id` | - | 200 | 200 | PASS | 群组详情获取成功 |
| 5 | ✅ GET | `/group/tree/:tenantId/:groupId` | - | 200 | 200 | PASS | 群组树获取成功 |
| 6 | ✅ PUT | `/group/:id` | {"groupName":"已更新群组"} | 200 | 200 | PASS | 群组更新成功 |
| 7 | ✅ DELETE | `/group/:id` | - | 200 | 200 | PASS | 群组删除成功 |
| 8 | ✅ PUT | `/group/:id/restore` | - | 200 | 200 | PASS | 群组恢复成功 |

### 动态表格模块 (17/17)

| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |
|---|--------|-----|------|----------|----------|------|----------|
| 1 | ✅ GET | `/base/tables` | - | 200 | 200 | PASS | 表格列表获取成功 |
| 2 | ✅ GET | `/base/tables?page=1&pageSize=2` | - | 200 | 200 | PASS | 表格列表获取成功 |
| 3 | ✅ GET | `/base/tables/:tableId` | - | 200 | 200 | PASS | 表格详情获取成功 |
| 4 | ✅ PUT | `/base/tables/:tableId` | {"name":"已更新表_1780676894911"} | 200 | 200 | PASS | 表格更新成功 |
| 5 | ✅ GET | `/base/tables/:tableId/fields` | - | 200 | 200 | PASS | 字段列表获取成功 |
| 6 | ✅ GET | `/base/tables/:tableId/fields/:fieldId` | - | 200 | 200 | PASS | 字段详情获取成功 |
| 7 | ✅ PUT | `/base/tables/:tableId/fields/:fieldId` | {"name":"已更新字段"} | 200 | 200 | PASS | 字段更新成功 |
| 8 | ✅ POST | `/base/tables/:tableId/records/list` | {"filter":{}} | 200 | 200 | PASS | 记录列表获取成功 |
| 9 | ✅ GET | `/base/tables/:tableId/records/:recordId` | - | 200 | 200 | PASS | 记录详情获取成功 |
| 10 | ✅ PUT | `/base/tables/:tableId/records/:recordId` | {"data":{"fld3jSTaHnYq300":"新值","fldO9wzwyLZaqUl":99}} | 200 | 200 | PASS | 记录更新成功 |
| 11 | ✅ DELETE | `/base/tables/:tableId/records/:recordId` | - | 200 | 200 | PASS | 记录删除成功 |
| 12 | ✅ PUT | `/base/tables/:tableId/records/:recordId/restore` | - | 200 | 200 | PASS | 记录恢复成功 |
| 13 | ✅ DELETE | `/base/tables/:tableId/fields/:fieldId` | - | 200 | 200 | PASS | 字段删除成功 |
| 14 | ✅ PUT | `/base/tables/:tableId/fields/:fieldId/restore` | - | 200 | 200 | PASS | 字段恢复成功 |
| 15 | ✅ DELETE | `/base/tables/:tableId` | - | 200 | 200 | PASS | 表格删除成功 |
| 16 | ✅ PUT | `/base/tables/:tableId/restore` | - | 200 | 200 | PASS | 表格恢复成功 |
| 17 | ✅ GET | `/base/tables` | - | 401 | 401 | PASS | 未登录，请先授权 |

### Token (8/8)

| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |
|---|--------|-----|------|----------|----------|------|----------|
| 1 | ✅ POST | `/user/refresh` | {"refreshToken":"invalid"} | 401 | 401 | PASS | refreshToken 无效或已过期，请重新登录 |
| 2 | ✅ POST | `/user/refresh` | {"refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZC | 200 | 200 | PASS | Token 刷新成功 |
| 3 | ✅ POST | `/user/logout` | - | 200 | 200 | PASS | 登出成功 |
| 4 | ✅ GET | `/user/list` | - | 401 | 401 | PASS | 未登录，请先授权 |
| 5 | ✅ GET | `/tenant` | - | 401 | 401 | PASS | 未登录，请先授权 |
| 6 | ✅ GET | `/role` | - | 401 | 401 | PASS | 未登录，请先授权 |
| 7 | ✅ GET | `/permission` | - | 401 | 401 | PASS | 未登录，请先授权 |
| 8 | ✅ GET | `/base/tables` | - | 401 | 401 | PASS | 未登录，请先授权 |

### 未认证 (5/5)

| # | Method | URL | Body | 预期状态 | 实际状态 | 结果 | 响应摘要 |
|---|--------|-----|------|----------|----------|------|----------|
| 1 | ✅ GET | `/user/list` | - | 401 | 401 | PASS | 未登录，请先授权 |
| 2 | ✅ GET | `/tenant` | - | 401 | 401 | PASS | 未登录，请先授权 |
| 3 | ✅ GET | `/role` | - | 401 | 401 | PASS | 未登录，请先授权 |
| 4 | ✅ GET | `/permission` | - | 401 | 401 | PASS | 未登录，请先授权 |
| 5 | ✅ GET | `/base/tables` | - | 401 | 401 | PASS | 未登录，请先授权 |

